from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from app.models.organization import Organization
from app.models.contact import Contact
from app.models.opportunity import Opportunity
from app.models.project import Project
from app.models.research import OrganizationResearchRecord


class ResearchAggregator:
    """
    Collects rich, verified commercial context from existing ELLY database records:
    Organization dossier, Contact profile, Research intelligence, Opportunities, and Showcase projects.
    Universal for any B2B vertical (Healthcare, SaaS, FinTech, Logistics, Manufacturing, etc.).
    """

    @classmethod
    def collect_context(
        cls,
        db: Session,
        contact_id: int,
        sender_user: Optional[Any] = None,
        preferred_project_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        contact = db.query(Contact).filter(Contact.id == contact_id).first()
        if not contact:
            raise ValueError(f"Contact with ID {contact_id} not found.")

        org = db.query(Organization).filter(Organization.id == contact.organization_id).first()
        if not org:
            raise ValueError(f"Organization for contact {contact_id} not found.")

        # Research Record
        research = None
        try:
            research = db.query(OrganizationResearchRecord).filter(
                OrganizationResearchRecord.organization_name == org.name
            ).first()
        except Exception:
            pass

        # Opportunity if any
        opportunity = None
        try:
            opportunity = db.query(Opportunity).filter(
                Opportunity.organization_id == org.id
            ).first()
        except Exception:
            pass

        # Showcase project matching
        project = None
        if preferred_project_id:
            project = db.query(Project).filter(Project.id == preferred_project_id).first()
        if not project:
            # Match project by industry/tag or take first active showcase
            all_projects = db.query(Project).filter(Project.is_featured == True).all()
            if not all_projects:
                all_projects = db.query(Project).all()
            
            # Find best match based on organization type or description
            org_desc = f"{org.organization_type or ''} {org.industry or ''} {org.description or ''}".lower()
            for p in all_projects:
                p_text = f"{p.name} {p.category} {p.short_description or ''} {p.description or ''}".lower()
                if org.organization_type and org.organization_type.lower() in p_text:
                    project = p
                    break
                if any(word in p_text for word in org_desc.split() if len(word) > 4):
                    project = p
                    break
            if not project and all_projects:
                project = all_projects[0]

        # Extract name parts safely
        full_name = contact.full_name or f"{contact.first_name} {contact.last_name or ''}".strip()
        first_name = contact.first_name or (full_name.split()[0] if full_name else "Colleague")
        last_name = contact.last_name or (full_name.split()[-1] if len(full_name.split()) > 1 else "")

        sender_name = getattr(sender_user, "name", None) or getattr(sender_user, "full_name", None) or "Business Development Team"
        sender_email = getattr(sender_user, "email", None) or "outreach@elly.ai"

        context = {
            # Contact Fields
            "contact_id": contact.id,
            "contact_name": full_name,
            "first_name": first_name,
            "last_name": last_name,
            "contact_role": contact.designation or "Leadership",
            "contact_email": contact.email or "",
            "contact_phone": contact.phone or "",
            "contact_linkedin": contact.linkedin_url or "",
            "contact_department": contact.department or "",
            
            # Organization Fields
            "organization_id": org.id,
            "organization_name": org.name,
            "industry": org.industry or org.organization_type or "Enterprise",
            "organization_type": org.organization_type or "Enterprise",
            "city": org.city or "",
            "country": org.country or "",
            "website": org.website or "",
            "organization_description": org.description or "",
            
            # Research & Opportunity
            "research_notes": getattr(research, "brief_json", "") or "",
            "icp_score": 90,
            "opportunity_name": opportunity.name if opportunity else "",
            "opportunity_value": opportunity.estimated_value if opportunity else 0,
            
            # Project Showcase Fields
            "project_id": project.id if project else None,
            "project_name": project.name if project else "ELLY Intelligence Suite",
            "project_description": project.short_description if project else "Enterprise-grade intelligence and workflow acceleration platform",
            "project_category": project.category if project else "Enterprise Platform",
            
            # Sender Fields
            "sender_name": sender_name,
            "sender_email": sender_email,
            
            # Dynamic meeting tokens defaults
            "meeting_date": "next week",
            "meeting_time": "11:00 AM",
            "meeting_link": "meet.google.com/elly-demo",
        }

        return context
