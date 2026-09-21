import csv
import io
import math
import re
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, desc

from app.auth.deps import require_business_development
from app.core.database import get_db
from app.core.audit import log_audit_event
from app.models.user import User
from app.models.organization import (
    Organization,
    OrganizationType,
    ConnectionStatus,
    PriorityLevel,
)
from app.models.contact import Contact
from app.models.discovery import (
    DiscoveredOrganization,
    DiscoveredContact,
    DiscoverySearchHistory,
    DiscoveryStatus,
    PotentialFit,
)
from app.schemas.discovery import (
    DiscoverySearchQuery,
    DiscoveredOrganizationOut,
    DiscoveredContactOut,
    PaginatedDiscoveryOut,
    DiscoveryQualifyIn,
    DiscoveryAddIn,
    ContactDiscoveryQuery,
    ContactEnrichIn,
    DiscoveryHistoryOut,
    DiscoveryStatsOut,
    ProviderListOut,
    CsvImportRowValidation,
    CsvImportPreviewOut,
    CsvImportExecuteIn,
    CsvImportResultOut,
    DiscoveryPromptParseIn,
    DiscoveryPromptParseOut,
)
from app.schemas.organization import OrganizationDetailOut
from app.services.discovery.prompt_parser import parse_discovery_prompt
from app.services.discovery_providers import discovery_registry
from app.services.discovery_engine import (
    check_organization_duplicate,
    check_contact_duplicate,
    convert_discovered_org_to_crm,
)
from app.services.search_cache import get_cached_results, set_cached_results
from app.services.google_sheets_service import save_search_results as sheets_save
from app.services.discovery.discovery_orchestrator import DiscoveryOrchestrator

router = APIRouter(
    prefix="/api/business-development/discover",
    tags=["Organization Discovery & Sourcing"],
    dependencies=[Depends(require_business_development)],
)

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _enrich_org_out(db: Session, disc_org: DiscoveredOrganization) -> DiscoveredOrganizationOut:
    """Helper to convert DiscoveredOrganization model to DiscoveredOrganizationOut schema with duplicate metadata."""
    is_dup, existing_id, existing_name = check_organization_duplicate(
        db, name=disc_org.name, website=disc_org.website, city=disc_org.city
    )

    contacts_out = []
    for c in disc_org.contacts:
        c_dup, c_existing_id, c_existing_name = check_contact_duplicate(
            db, email=c.email, full_name=c.full_name, organization_id=disc_org.organization_id
        )
        contacts_out.append(
            DiscoveredContactOut(
                id=c.id,
                discovered_org_id=c.discovered_org_id,
                full_name=c.full_name,
                job_title=c.job_title,
                seniority_level=c.seniority_level,
                department=c.department,
                business_relevance=c.business_relevance,
                email=c.email,
                email_status=c.email_status,
                phone=c.phone,
                linkedin_url=c.linkedin_url,
                fit_level=c.fit_level,
                fit_reason=c.fit_reason,
                status=c.status,
                matched_existing_contact_id=c.matched_existing_contact_id or c_existing_id,
                is_existing_duplicate=c_dup,
                existing_contact_name=c_existing_name,
                created_at=c.created_at,
            )
        )

    return DiscoveredOrganizationOut(
        id=disc_org.id,
        name=disc_org.name,
        organization_type=disc_org.organization_type,
        country=disc_org.country or "Unknown",
        state=disc_org.state,
        city=disc_org.city,
        address=disc_org.address,
        website=disc_org.website,
        email=disc_org.email,
        phone=disc_org.phone,
        description=disc_org.description,
        product_description=disc_org.product_description,
        target_icp=disc_org.target_icp,
        discovery_objective=disc_org.discovery_objective,
        source_type=disc_org.source_type,
        source_name=disc_org.source_name,
        source_url=disc_org.source_url,
        status=disc_org.status,
        potential_fit=disc_org.potential_fit,
        potential_fit_score=disc_org.potential_fit_score or 75,
        qualification_reason=disc_org.qualification_reason,
        organization_id=disc_org.organization_id,
        discovered_by_id=disc_org.discovered_by_id,
        is_existing_duplicate=is_dup,
        existing_org_id=existing_id,
        existing_org_name=existing_name,
        search_history_id=disc_org.search_history_id,
        contacts=contacts_out,
        created_at=disc_org.created_at,
        updated_at=disc_org.updated_at,
    )


# -------------------------------------------------------------
# Static Routes (Defined First to Avoid Path Parameter Collisions)
# -------------------------------------------------------------

@router.get("/providers", response_model=ProviderListOut)
def list_providers(current_user: User = Depends(require_business_development)):
    """Lists all registered discovery, contact, and email enrichment providers."""
    return discovery_registry.list_available_providers()


@router.get("/saved", response_model=PaginatedDiscoveryOut)
def list_saved_discoveries(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    """Convenience endpoint to retrieve all saved/bookmarked discovered organizations."""
    return list_discoveries(
        status="saved",
        organization_type=None,
        potential_fit=None,
        location=None,
        search=None,
        page=page,
        page_size=page_size,
        db=db,
        current_user=current_user,
    )


@router.get("/history", response_model=List[DiscoveryHistoryOut])
def get_search_history(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    """Retrieves discovery search and prompt history."""
    history = db.query(DiscoverySearchHistory).order_by(desc(DiscoverySearchHistory.timestamp)).limit(limit).all()
    out = []
    for h in history:
        out.append(
            DiscoveryHistoryOut(
                id=h.id,
                user_id=h.user_id,
                user_name=h.user.name if h.user else None,
                query_keyword=h.query_keyword,
                location=h.location,
                organization_type=h.organization_type,
                product_description=h.product_description,
                target_icp=h.target_icp,
                discovery_objective=h.discovery_objective,
                provider_used=h.provider_used,
                results_count=h.results_count,
                contacts_found=h.contacts_found,
                timestamp=h.timestamp,
            )
        )
    return out


@router.get("/history/{history_id}/results", response_model=PaginatedDiscoveryOut)
def get_search_history_results(
    history_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    """Retrieves the discovered organizations from a specific search history run."""
    h = db.query(DiscoverySearchHistory).filter(DiscoverySearchHistory.id == history_id).first()
    if not h:
        raise HTTPException(status_code=404, detail="Search history entry not found.")

    query = db.query(DiscoveredOrganization).filter(
        DiscoveredOrganization.search_history_id == history_id
    )
    total = query.count()

    # Fallback for historical searches without search_history_id
    if total == 0:
        query = db.query(DiscoveredOrganization)
        if h.query_keyword:
            kw = f"%{h.query_keyword.strip()}%"
            query = query.filter(
                DiscoveredOrganization.name.ilike(kw)
                | DiscoveredOrganization.description.ilike(kw)
            )
        if h.organization_type and h.organization_type != "All":
            query = query.filter(DiscoveredOrganization.organization_type == h.organization_type)
        if h.location:
            loc = f"%{h.location.strip()}%"
            query = query.filter(
                DiscoveredOrganization.city.ilike(loc)
                | DiscoveredOrganization.state.ilike(loc)
                | DiscoveredOrganization.country.ilike(loc)
            )
        total = query.count()

    offset = (page - 1) * page_size
    items = query.order_by(desc(DiscoveredOrganization.potential_fit_score), desc(DiscoveredOrganization.created_at)).offset(offset).limit(page_size).all()

    out_items = [_enrich_org_out(db, org) for org in items]
    return PaginatedDiscoveryOut(
        items=out_items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total > 0 else 1,
    )


@router.post("/parse-prompt", response_model=DiscoveryPromptParseOut)
def parse_prompt_endpoint(
    payload: DiscoveryPromptParseIn,
    current_user: User = Depends(require_business_development),
):
    """Parses a single natural language lead discovery prompt into structured search parameters."""
    parsed = parse_discovery_prompt(payload.prompt)
    return DiscoveryPromptParseOut(**parsed)



@router.get("/stats", response_model=DiscoveryStatsOut)
def get_discovery_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    """Returns discovery conversion and sourcing statistics."""
    total_disc = db.query(DiscoveredOrganization).count()
    total_added = db.query(DiscoveredOrganization).filter(DiscoveredOrganization.status == DiscoveryStatus.ADDED.value).count()
    total_saved = db.query(DiscoveredOrganization).filter(DiscoveredOrganization.status == DiscoveryStatus.SAVED.value).count()
    total_skipped = db.query(DiscoveredOrganization).filter(DiscoveredOrganization.status == DiscoveryStatus.SKIPPED.value).count()
    total_imported = db.query(DiscoveredOrganization).filter(DiscoveredOrganization.source_type == "csv_import").count()

    conversion_rate = round((total_added / total_disc) * 100, 1) if total_disc > 0 else None
    return DiscoveryStatsOut(
        total_discovered=total_disc,
        total_added=total_added,
        total_saved=total_saved,
        total_skipped=total_skipped,
        total_imported=total_imported,
        conversion_rate=conversion_rate,
        is_sufficient_data=total_disc >= 5,
    )


@router.get("/export")
def export_discoveries_csv(
    status: Optional[str] = Query(None),
    potential_fit: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    """Exports discovered leads, qualification reasons, and contacts to CSV."""
    query = db.query(DiscoveredOrganization)
    if status and status != "All":
        query = query.filter(DiscoveredOrganization.status == status.lower())
    if potential_fit and potential_fit != "All":
        query = query.filter(DiscoveredOrganization.potential_fit == potential_fit)

    leads = query.order_by(desc(DiscoveredOrganization.created_at)).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Organization Name",
        "Organization Type",
        "Location",
        "Website",
        "Fit Level",
        "Fit Score",
        "Fit Reason",
        "Status",
        "Primary Contact Name",
        "Primary Contact Title",
        "Primary Contact Email",
        "Source Name",
        "Discovered Date",
    ])

    for lead in leads:
        loc = ", ".join(filter(None, [lead.city, lead.state, lead.country]))
        primary_c = lead.contacts[0] if lead.contacts else None
        writer.writerow([
            lead.name,
            lead.organization_type,
            loc,
            lead.website or "",
            lead.potential_fit or "High",
            lead.potential_fit_score or 75,
            lead.qualification_reason or "",
            lead.status,
            primary_c.full_name if primary_c else "",
            primary_c.job_title if primary_c else "",
            primary_c.email if primary_c else "",
            lead.source_name,
            lead.created_at.strftime("%Y-%m-%d %H:%M"),
        ])

    output.seek(0)
    filename = f"elly_discovered_leads_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.post("/import/preview", response_model=CsvImportPreviewOut)
async def preview_csv_import(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    """Validates and previews a CSV file containing organizations for lead import."""
    contents = await file.read()
    try:
        decoded = contents.decode("utf-8-sig")
    except UnicodeDecodeError:
        decoded = contents.decode("latin-1")

    reader = csv.DictReader(io.StringIO(decoded))
    preview_rows: List[CsvImportRowValidation] = []
    valid_count = 0
    invalid_count = 0
    duplicate_count = 0

    valid_types = [e.value for e in OrganizationType]

    for idx, row in enumerate(reader, start=1):
        name = row.get("name", "").strip()
        org_type = row.get("organization_type", "Unknown").strip()
        website = row.get("website", "").strip() or None
        email = row.get("email", "").strip() or None
        phone = row.get("phone", "").strip() or None
        city = row.get("city", "").strip() or None

        errors = []
        if not name:
            errors.append("Organization name is required")
        if org_type not in valid_types:
            errors.append(f"Invalid organization_type '{org_type}'. Must be one of: {', '.join(valid_types)}")
        if email and not EMAIL_REGEX.match(email):
            errors.append(f"Invalid email format: {email}")

        is_dup = False
        existing_name = None
        if name:
            is_dup, _, existing_name = check_organization_duplicate(db, name=name, website=website, city=city)
            if is_dup:
                duplicate_count += 1

        is_valid = len(errors) == 0
        if is_valid:
            valid_count += 1
        else:
            invalid_count += 1

        preview_rows.append(
            CsvImportRowValidation(
                row_number=idx,
                name=name,
                organization_type=org_type,
                website=website,
                email=email,
                phone=phone,
                city=city,
                is_valid=is_valid,
                is_duplicate=is_dup,
                existing_org_name=existing_name,
                errors=errors,
                error_message="; ".join(errors) if errors else None,
            )
        )

    return CsvImportPreviewOut(
        total_rows=len(preview_rows),
        valid_rows=valid_count,
        invalid_rows=invalid_count,
        duplicate_rows=duplicate_count,
        valid_rows_count=valid_count,
        invalid_rows_count=invalid_count,
        duplicate_rows_count=duplicate_count,
        rows=preview_rows,
        preview_rows=preview_rows,
    )


@router.post("/import/execute")
def execute_csv_import(
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    """Imports validated organization records from CSV into DiscoveredOrganization."""
    rows = payload.get("rows", [])
    skip_duplicates = payload.get("skip_duplicates", True)

    imported_ids = []
    skipped_count = 0
    errors = []

    for row in rows:
        if not row.get("is_valid", True):
            skipped_count += 1
            continue

        name = row.get("name", "").strip()
        if not name:
            skipped_count += 1
            continue

        website = row.get("website", "").strip() or None
        city = row.get("city", "").strip() or None

        is_dup, _, _ = check_organization_duplicate(db, name=name, website=website, city=city)
        if is_dup and skip_duplicates:
            skipped_count += 1
            continue

        new_rec = DiscoveredOrganization(
            name=name,
            organization_type=row.get("organization_type", "Unknown"),
            country=row.get("country", "Unknown"),
            state=row.get("state"),
            city=city,
            address=row.get("address"),
            website=website,
            email=row.get("email"),
            phone=row.get("phone"),
            description=row.get("description"),
            source_type="csv_import",
            source_name="CSV Batch Sourcing",
            status=DiscoveryStatus.DISCOVERED.value,
            potential_fit="High",
            potential_fit_score=80,
            qualification_reason="Imported via verified BD CSV sourcing list.",
            discovered_by_id=current_user.id,
        )
        db.add(new_rec)
        db.flush()
        imported_ids.append(new_rec.id)

    db.commit()
    return {
        "imported_count": len(imported_ids),
        "imported_ids": imported_ids,
        "skipped_count": skipped_count,
        "errors": errors,
    }


@router.post("/search", response_model=PaginatedDiscoveryOut)
def search_discoveries(
    payload: DiscoverySearchQuery,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    """
    OpenOutreach-style B2B Lead Discovery:
    When Multi-Source is selected, routes through the full orchestrator pipeline
    (multi-source search → dedup → research → explainable qualification).
    Falls back to single-provider for specific providers.
    """
    offset = (payload.page - 1) * payload.page_size
    use_orchestrator = (
        not payload.provider
        or payload.provider == ""
        or payload.provider == "Multi-Source Discovery (Recommended)"
    )

    provider = None  # ponytail: only set in single-provider path

    if use_orchestrator:
        # Full orchestrator pipeline: search → dedup → research → qualify
        orchestrator = DiscoveryOrchestrator(db)
        orch_result = orchestrator.discover(
            keyword=payload.keyword or "",
            location=payload.location or "",
            organization_type=payload.organization_type or "",
            product_description=payload.product_description or "",
            target_icp=payload.target_icp or "",
            discovery_objective=payload.discovery_objective or "",
            provider=payload.provider or "",
            limit=payload.page_size,
            research=True,
        )
        provider_results = orch_result.get("organizations", [])
        total_count = orch_result.get("total_deduplicated", len(provider_results))
    else:
        # Single-provider path (original behavior)
        provider = discovery_registry.get_org_provider(payload.provider)
        cached = get_cached_results(
            keyword=payload.keyword,
            location=payload.location,
            organization_type=payload.organization_type,
            product_description=payload.product_description,
            target_icp=payload.target_icp,
            discovery_objective=payload.discovery_objective,
        )
        if cached:
            provider_results, total_count = cached
        else:
            provider_results, total_count = provider.search_organizations(
                keyword=payload.keyword,
                location=payload.location,
                organization_type=payload.organization_type,
                product_description=payload.product_description,
                target_icp=payload.target_icp,
                discovery_objective=payload.discovery_objective,
                limit=payload.page_size,
                offset=offset,
            )
            if provider_results:
                set_cached_results(
                    keyword=payload.keyword,
                    location=payload.location,
                    organization_type=payload.organization_type,
                    product_description=payload.product_description,
                    target_icp=payload.target_icp,
                    discovery_objective=payload.discovery_objective,
                    results=provider_results,
                    total=total_count,
                )
                try:
                    sheets_save(
                        keyword=payload.keyword,
                        location=payload.location,
                        organization_type=payload.organization_type,
                        product_description=payload.product_description,
                        target_icp=payload.target_icp,
                        discovery_objective=payload.discovery_objective,
                        provider_name=provider.provider_name if provider else "multi-source",
                        results=provider_results,
                    )
                except Exception:
                    pass

    # Log search history early so discovered organizations can link to it
    history_entry = DiscoverySearchHistory(
        user_id=current_user.id,
        query_keyword=payload.keyword,
        location=payload.location,
        organization_type=payload.organization_type,
        product_description=payload.product_description,
        target_icp=payload.target_icp,
        discovery_objective=payload.discovery_objective,
        provider_used=provider.provider_name if provider else "multi-source",
        results_count=total_count,
    )
    db.add(history_entry)
    db.flush()

    out_items: List[DiscoveredOrganizationOut] = []
    for res in provider_results:
        clean_name = res["name"].strip()
        existing_record = db.query(DiscoveredOrganization).filter(
            DiscoveredOrganization.name == clean_name
        ).first()

        # Orchestrator may provide explainable qualification results
        qual_score = res.get("potential_fit_score", res.get("qualification", {}).get("score", 75))
        qual_tier = res.get("potential_fit", res.get("qualification", {}).get("tier", PotentialFit.HIGH.value))
        qual_reason = res.get("qualification_reason", "")
        if not qual_reason and res.get("qualification"):
            qual_reason = "; ".join(res["qualification"].get("positive_signals", [])[:3])

        if not existing_record:
            new_record = DiscoveredOrganization(
                name=clean_name,
                organization_type=res.get("organization_type", "Unknown"),
                country=res.get("country", "Unknown"),
                state=res.get("state"),
                city=res.get("city"),
                address=res.get("address"),
                website=res.get("website"),
                email=res.get("email"),
                phone=res.get("phone"),
                description=res.get("description"),
                product_description=payload.product_description,
                target_icp=payload.target_icp,
                discovery_objective=payload.discovery_objective,
                source_type=res.get("source_type", "search"),
                source_name=res.get("source_name", "multi-source"),
                source_url=res.get("source_url"),
                status=DiscoveryStatus.DISCOVERED.value,
                potential_fit=qual_tier,
                potential_fit_score=qual_score,
                qualification_reason=qual_reason,
                discovered_by_id=current_user.id,
                search_history_id=history_entry.id,
            )
            db.add(new_record)
            db.flush()

            # Store research data if orchestrator provided it
            if res.get("research") and res["research"].get("research_status") == "completed":
                from app.models.discovery import OrganizationResearchRecord
                research_rec = OrganizationResearchRecord(
                    discovered_org_id=new_record.id,
                    organization_name=new_record.name,
                    research_data=res["research"],
                    qualification_score=qual_score,
                    research_version="orchestrator-v1",
                    provider_used=res["research"].get("provider", "scrapegraph"),
                )
                db.add(research_rec)

            out_items.append(_enrich_org_out(db, new_record))
            target_org = new_record
        else:
            if qual_tier:
                existing_record.potential_fit = qual_tier
            if qual_score:
                existing_record.potential_fit_score = qual_score
            if qual_reason:
                existing_record.qualification_reason = qual_reason
            existing_record.product_description = payload.product_description or existing_record.product_description
            existing_record.target_icp = payload.target_icp or existing_record.target_icp
            existing_record.discovery_objective = payload.discovery_objective or existing_record.discovery_objective
            existing_record.search_history_id = history_entry.id
            out_items.append(_enrich_org_out(db, existing_record))
            target_org = existing_record

        # Persist discovered executive decision-makers if provided
        if res.get("contacts") and target_org:
            for c in res["contacts"]:
                c_name = (c.get("full_name") or c.get("name") or "").strip()
                if not c_name:
                    continue
                c_exists = db.query(DiscoveredContact).filter(
                    DiscoveredContact.discovered_org_id == target_org.id,
                    DiscoveredContact.full_name == c_name,
                ).first()
                if not c_exists:
                    new_contact = DiscoveredContact(
                        discovered_org_id=target_org.id,
                        full_name=c_name,
                        job_title=c.get("job_title") or c.get("role") or "Executive",
                        seniority_level=c.get("seniority_level") or "Executive",
                        department=c.get("department") or "Executive",
                        email=c.get("email"),
                        email_status=c.get("email_status") or "predicted",
                        phone=c.get("phone"),
                        linkedin_url=c.get("linkedin_url"),
                        fit_level=c.get("fit_level") or "High",
                        fit_reason=c.get("fit_reason") or "Key executive decision-maker",
                        status=DiscoveryStatus.DISCOVERED.value,
                    )
                    db.add(new_contact)
            db.flush()

    history_entry.results_count = total_count
    db.commit()

    total_pages = math.ceil(total_count / payload.page_size) if payload.page_size else 1
    return PaginatedDiscoveryOut(
        items=out_items,
        total=total_count,
        page=payload.page,
        page_size=payload.page_size,
        total_pages=total_pages,
    )


@router.get("/list", response_model=PaginatedDiscoveryOut)
def list_discoveries(
    status: Optional[str] = Query(None),
    organization_type: Optional[str] = Query(None),
    potential_fit: Optional[str] = Query(None),
    location: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    """Lists saved, discovered, or qualified organization leads from the database."""
    query = db.query(DiscoveredOrganization)

    if isinstance(status, str) and status.strip() and status != "All":
        query = query.filter(DiscoveredOrganization.status == status.strip().lower())
    if isinstance(organization_type, str) and organization_type.strip() and organization_type != "All":
        query = query.filter(DiscoveredOrganization.organization_type == organization_type.strip())
    if isinstance(potential_fit, str) and potential_fit.strip() and potential_fit != "All":
        query = query.filter(DiscoveredOrganization.potential_fit == potential_fit.strip())
    if isinstance(location, str) and location.strip():
        loc = f"%{location.strip()}%"
        query = query.filter(
            or_(
                DiscoveredOrganization.city.ilike(loc),
                DiscoveredOrganization.state.ilike(loc),
                DiscoveredOrganization.country.ilike(loc),
            )
        )
    if isinstance(search, str) and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                DiscoveredOrganization.name.ilike(term),
                DiscoveredOrganization.description.ilike(term),
                DiscoveredOrganization.qualification_reason.ilike(term),
            )
        )

    total = query.count()
    offset = (page - 1) * page_size
    records = query.order_by(desc(DiscoveredOrganization.potential_fit_score), desc(DiscoveredOrganization.created_at)).offset(offset).limit(page_size).all()

    items = [_enrich_org_out(db, r) for r in records]
    total_pages = math.ceil(total / page_size) if page_size else 1
    return PaginatedDiscoveryOut(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


# -------------------------------------------------------------
# Parameterized Entity Routes (Defined After Static Routes)
# -------------------------------------------------------------

@router.get("/{id}", response_model=DiscoveredOrganizationOut)
def get_discovery_detail(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    """Retrieves a discovered organization profile with contacts and duplicate analysis."""
    rec = db.query(DiscoveredOrganization).filter(DiscoveredOrganization.id == id).first()
    if not rec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Discovered organization not found")
    return _enrich_org_out(db, rec)


@router.post("/{id}/contacts/search", response_model=List[DiscoveredContactOut])
def discover_decision_makers(
    id: int,
    payload: ContactDiscoveryQuery = ContactDiscoveryQuery(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    """
    Finds and qualifies executive decision-makers for the discovered organization.
    Filters by specified leadership roles (e.g. CEO, CDO, CTO, CIO, VP of Sales, Partnerships Head).
    """
    org = db.query(DiscoveredOrganization).filter(DiscoveredOrganization.id == id).first()
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Discovered organization not found")

    contact_provider = discovery_registry.get_contact_provider()
    discovered_roster = contact_provider.search_decision_makers(
        organization_name=org.name,
        organization_type=org.organization_type,
        website=org.website,
        target_roles=payload.target_roles,
        product_description=org.product_description,
        discovery_objective=org.discovery_objective,
        limit=payload.limit,
    )

    out_contacts: List[DiscoveredContactOut] = []
    for c_data in discovered_roster:
        clean_name = c_data["full_name"].strip()
        # Check if already present in DiscoveredContact table for this org
        existing = db.query(DiscoveredContact).filter(
            DiscoveredContact.discovered_org_id == org.id,
            DiscoveredContact.full_name == clean_name,
        ).first()

        if not existing:
            new_c = DiscoveredContact(
                discovered_org_id=org.id,
                full_name=clean_name,
                job_title=c_data.get("job_title", "Executive"),
                seniority_level=c_data.get("seniority_level", "Executive"),
                department=c_data.get("department", "Management"),
                business_relevance=c_data.get("business_relevance"),
                email=c_data.get("email"),
                email_status=c_data.get("email_status", "unverified"),
                phone=c_data.get("phone"),
                linkedin_url=c_data.get("linkedin_url"),
                fit_level=c_data.get("fit_level", "High"),
                fit_reason=c_data.get("fit_reason"),
                status=DiscoveryStatus.DISCOVERED.value,
            )
            db.add(new_c)
            db.flush()
            existing = new_c

        c_dup, c_existing_id, c_existing_name = check_contact_duplicate(
            db, email=existing.email, full_name=existing.full_name, organization_id=org.organization_id
        )

        out_contacts.append(
            DiscoveredContactOut(
                id=existing.id,
                discovered_org_id=existing.discovered_org_id,
                full_name=existing.full_name,
                job_title=existing.job_title,
                seniority_level=existing.seniority_level,
                department=existing.department,
                business_relevance=existing.business_relevance,
                email=existing.email,
                email_status=existing.email_status,
                phone=existing.phone,
                linkedin_url=existing.linkedin_url,
                fit_level=existing.fit_level,
                fit_reason=existing.fit_reason,
                status=existing.status,
                matched_existing_contact_id=existing.matched_existing_contact_id or c_existing_id,
                is_existing_duplicate=c_dup,
                existing_contact_name=c_existing_name,
                created_at=existing.created_at,
            )
        )

    db.commit()
    return out_contacts


@router.post("/{id}/contacts/{contact_id}/enrich", response_model=DiscoveredContactOut)
def enrich_decision_maker_contact(
    id: int,
    contact_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    """
    Enriches a single decision-maker contact with verified business email and professional links.
    Strictly follows rate limiting and format validation.
    """
    org = db.query(DiscoveredOrganization).filter(DiscoveredOrganization.id == id).first()
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Discovered organization not found")

    contact = db.query(DiscoveredContact).filter(
        DiscoveredContact.id == contact_id,
        DiscoveredContact.discovered_org_id == org.id,
    ).first()
    if not contact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Discovered contact not found")

    enrichment_prov = discovery_registry.get_enrichment_provider()
    result = enrichment_prov.enrich_contact(
        full_name=contact.full_name,
        organization_name=org.name,
        website=org.website,
        job_title=contact.job_title,
    )

    if result.get("email"):
        contact.email = result["email"]
        contact.email_status = result.get("email_status", "enriched")
    if result.get("linkedin_url"):
        contact.linkedin_url = result["linkedin_url"]
    if result.get("phone"):
        contact.phone = result["phone"]

    db.commit()
    db.refresh(contact)

    c_dup, c_existing_id, c_existing_name = check_contact_duplicate(
        db, email=contact.email, full_name=contact.full_name, organization_id=org.organization_id
    )

    return DiscoveredContactOut(
        id=contact.id,
        discovered_org_id=contact.discovered_org_id,
        full_name=contact.full_name,
        job_title=contact.job_title,
        seniority_level=contact.seniority_level,
        department=contact.department,
        business_relevance=contact.business_relevance,
        email=contact.email,
        email_status=contact.email_status,
        phone=contact.phone,
        linkedin_url=contact.linkedin_url,
        fit_level=contact.fit_level,
        fit_reason=contact.fit_reason,
        status=contact.status,
        matched_existing_contact_id=contact.matched_existing_contact_id or c_existing_id,
        is_existing_duplicate=c_dup,
        existing_contact_name=c_existing_name,
        created_at=contact.created_at,
    )


@router.post("/{id}/qualify", response_model=DiscoveredOrganizationOut)
def manually_qualify_discovery(
    id: int,
    payload: DiscoveryQualifyIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    """Allows manual override of AI qualification rating and reasoning."""
    rec = db.query(DiscoveredOrganization).filter(DiscoveredOrganization.id == id).first()
    if not rec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Discovered organization not found")

    rec.potential_fit = payload.potential_fit
    if payload.qualification_reason:
        rec.qualification_reason = payload.qualification_reason
    db.commit()
    db.refresh(rec)
    return _enrich_org_out(db, rec)


@router.post("/{id}/save", response_model=DiscoveredOrganizationOut)
def save_discovery(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    """Bookmarks a discovered organization lead for subsequent BD review."""
    rec = db.query(DiscoveredOrganization).filter(DiscoveredOrganization.id == id).first()
    if not rec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Discovered organization not found")
    rec.status = DiscoveryStatus.SAVED.value
    db.commit()
    db.refresh(rec)
    return _enrich_org_out(db, rec)


@router.post("/{id}/skip", response_model=DiscoveredOrganizationOut)
def skip_discovery(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    """Dismisses a discovered organization lead from active view."""
    rec = db.query(DiscoveredOrganization).filter(DiscoveredOrganization.id == id).first()
    if not rec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Discovered organization not found")
    rec.status = DiscoveryStatus.SKIPPED.value
    db.commit()
    db.refresh(rec)
    return _enrich_org_out(db, rec)


@router.post("/{id}/add", response_model=OrganizationDetailOut)
def add_discovery_to_crm(
    id: int,
    payload: DiscoveryAddIn = DiscoveryAddIn(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    """
    Converts a DiscoveredOrganization and its selected DiscoveredContacts into
    official ELLY Organization and Contact CRM entities with ConnectionStatus.POTENTIAL.
    """
    disc_org = db.query(DiscoveredOrganization).filter(DiscoveredOrganization.id == id).first()
    if not disc_org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Discovered organization not found")

    # Duplicate check guard
    is_dup, existing_id, existing_name = check_organization_duplicate(
        db, name=disc_org.name, website=disc_org.website, city=disc_org.city
    )
    if is_dup and not payload.allow_duplicate:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"An organization named '{existing_name}' already exists in ELLY CRM (ID: {existing_id}). Use existing or enable allow_duplicate."
        )

    notes_content = payload.custom_notes or payload.notes

    # Convert to ELLY CRM
    created_org, created_contacts = convert_discovered_org_to_crm(
        db=db,
        discovered_org=disc_org,
        selected_contact_ids=payload.selected_contact_ids,
        user_id=current_user.id,
        initial_priority=payload.priority or "Medium",
        internal_notes=notes_content,
    )

    log_audit_event(
        db=db,
        action="DISCOVERY_ADDED_TO_CRM",
        user=current_user,
        resource_type="Organization",
        resource_id=created_org.id,
        metadata={
            "discovered_org_id": disc_org.id,
            "organization_name": created_org.name,
            "contacts_imported": len(created_contacts),
            "potential_fit": disc_org.potential_fit,
        },
    )

    return created_org


# ─────────────────────────────────────────────────────────────
# PHASE 19: RESEARCH & INTELLIGENCE ENDPOINTS
# ─────────────────────────────────────────────────────────────

@router.post("/{org_id}/research")
def research_discovered_org(
    org_id: int,
    force_refresh: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    """Deep-research a discovered organization via ScrapeGraphAI."""
    disc_org = db.query(DiscoveredOrganization).filter(DiscoveredOrganization.id == org_id).first()
    if not disc_org:
        raise HTTPException(status_code=404, detail="Discovered organization not found")

    from app.services.discovery.discovery_orchestrator import DiscoveryOrchestrator
    orch = DiscoveryOrchestrator(db)
    result = orch.research_single(org_id)
    if not result:
        raise HTTPException(status_code=500, detail="Research failed")
    return result


@router.get("/{org_id}/brief")
def get_research_brief_endpoint(
    org_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    """Generate Account Intelligence Brief for a discovered organization."""
    disc_org = db.query(DiscoveredOrganization).filter(DiscoveredOrganization.id == org_id).first()
    if not disc_org:
        raise HTTPException(status_code=404, detail="Discovered organization not found")

    from app.services.discovery.discovery_orchestrator import DiscoveryOrchestrator
    orch = DiscoveryOrchestrator(db)
    result = orch.get_brief(org_id)
    if not result:
        raise HTTPException(status_code=500, detail="Brief generation failed")
    return result


@router.post("/{org_id}/qualify")
def re_qualify_org(
    org_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    """Re-qualify a discovered organization with explainable scoring."""
    disc_org = db.query(DiscoveredOrganization).filter(DiscoveredOrganization.id == org_id).first()
    if not disc_org:
        raise HTTPException(status_code=404, detail="Discovered organization not found")

    from app.services.discovery.discovery_orchestrator import DiscoveryOrchestrator
    orch = DiscoveryOrchestrator(db)
    result = orch.qualify_single(org_id)
    if not result:
        raise HTTPException(status_code=500, detail="Qualification failed")
    return result


@router.post("/{org_id}/decision-makers")
def discover_decision_makers_endpoint(
    org_id: int,
    roles: Optional[List[str]] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    """Discover decision-makers for a discovered organization."""
    disc_org = db.query(DiscoveredOrganization).filter(DiscoveredOrganization.id == org_id).first()
    if not disc_org:
        raise HTTPException(status_code=404, detail="Discovered organization not found")

    from app.services.discovery.discovery_orchestrator import DiscoveryOrchestrator
    orch = DiscoveryOrchestrator(db)
    return orch.discover_decision_makers(org_id, roles=roles)


@router.get("/analytics/intelligence")
def get_discovery_intelligence_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    """Get discovery intelligence metrics."""
    from app.services.discovery.analytics import get_discovery_analytics
    return get_discovery_analytics(db)


# ─────────────────────────────────────────────────────────────
# PHASE 20: ENRICHMENT & PROVIDER HEALTH ENDPOINTS
# ─────────────────────────────────────────────────────────────

@router.post("/{org_id}/enrich")
def enrich_organization_contacts_endpoint(
    org_id: int,
    contacts: List[Dict[str, str]],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    """Enrich contacts at a discovered organization using BetterContact."""
    disc_org = db.query(DiscoveredOrganization).filter(DiscoveredOrganization.id == org_id).first()
    if not disc_org:
        raise HTTPException(status_code=404, detail="Discovered organization not found")

    from app.services.enrichment.bettercontact_adapter import get_bettercontact_adapter
    adapter = get_bettercontact_adapter()
    if not adapter.is_available:
        raise HTTPException(status_code=503, detail="BetterContact not configured. Set BETTERCONTACT_API_KEY.")

    result = adapter.enrich_organization_contacts(
        organization=disc_org.name,
        contacts=contacts,
        domain=disc_org.website or "",
    )
    return result.to_dict()


@router.get("/providers/health")
def get_provider_health_endpoint(
    current_user: User = Depends(require_business_development),
):
    """Get health status for all external providers."""
    from app.services.discovery.provider_health import ProviderHealthTracker
    tracker = ProviderHealthTracker.get_instance()
    return tracker.get_all_status()


@router.post("/{org_id}/research/cache")
def get_cached_research_endpoint(
    org_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    """Get cached research for an organization (if valid and not expired)."""
    disc_org = db.query(DiscoveredOrganization).filter(DiscoveredOrganization.id == org_id).first()
    if not disc_org:
        raise HTTPException(status_code=404, detail="Discovered organization not found")

    from app.services.discovery.research_cache import get_cached_research
    cached = get_cached_research(db, organization=disc_org.name)
    if not cached:
        raise HTTPException(status_code=404, detail="No valid cached research found")
    return cached


@router.delete("/{org_id}/research/cache")
def invalidate_research_cache_endpoint(
    org_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    """Invalidate cached research for an organization (forces fresh research)."""
    disc_org = db.query(DiscoveredOrganization).filter(DiscoveredOrganization.id == org_id).first()
    if not disc_org:
        raise HTTPException(status_code=404, detail="Discovered organization not found")

    from app.services.discovery.research_cache import invalidate_research
    count = invalidate_research(db, organization=disc_org.name)
    return {"invalidated": count, "organization": disc_org.name}
