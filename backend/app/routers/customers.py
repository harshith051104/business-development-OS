from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.database import get_db
from app.auth.deps import get_current_user
from app.models.user import User
from app.models.organization import Organization, ConnectionStatus
from app.models.opportunity import Opportunity, OpportunityStage
from app.models.contact import Contact
from app.models.project import Project
from app.models.customer import Customer, CustomerStatus, AccountHealth
from app.core.audit import log_audit_event
from app.schemas.customer import (
    CustomerCreate,
    CustomerUpdate,
    CustomerOut,
    CustomerConvertRequest,
)

router = APIRouter(prefix="/api/business-development/customers", tags=["Customers"])


def _customer_to_out(c: Customer) -> CustomerOut:
    return CustomerOut(
        id=c.id,
        organization_id=c.organization_id,
        primary_contact_id=c.primary_contact_id,
        opportunity_id=c.opportunity_id,
        project_id=c.project_id,
        owner_id=c.owner_id,
        contract_value=c.contract_value or 0.0,
        currency=c.currency or "USD",
        status=c.status,
        account_health=c.account_health,
        start_date=c.start_date,
        renewal_date=c.renewal_date,
        next_review_date=c.next_review_date,
        notes=c.notes,
        organization_name=c.organization.name if c.organization else None,
        primary_contact_name=f"{c.primary_contact.first_name} {c.primary_contact.last_name}" if c.primary_contact else None,
        project_name=c.project.name if c.project else None,
        owner_name=c.owner.name if c.owner else None,
        created_at=c.created_at,
        updated_at=c.updated_at,
    )


@router.get("", response_model=List[CustomerOut])
def list_customers(
    status: Optional[str] = None,
    health: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(50, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Customer).filter(Customer.is_deleted == False)

    if status:
        q = q.filter(Customer.status == status)
    if health:
        q = q.filter(Customer.account_health == health)
    if search:
        q = q.join(Organization).filter(Organization.name.ilike(f"%{search}%"))

    customers = q.order_by(desc(Customer.updated_at)).limit(limit).all()
    return [_customer_to_out(c) for c in customers]


@router.get("/{customer_id}", response_model=CustomerOut)
def get_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    c = db.query(Customer).filter(Customer.id == customer_id, Customer.is_deleted == False).first()
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    return _customer_to_out(c)


@router.post("", response_model=CustomerOut, status_code=status.HTTP_201_CREATED)
def create_customer(
    payload: CustomerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org = db.query(Organization).filter(Organization.id == payload.organization_id, Organization.is_deleted == False).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    existing = db.query(Customer).filter(Customer.organization_id == payload.organization_id, Customer.is_deleted == False).first()
    if existing:
        raise HTTPException(status_code=400, detail="A customer record already exists for this organization")

    customer = Customer(
        organization_id=payload.organization_id,
        primary_contact_id=payload.primary_contact_id,
        opportunity_id=payload.opportunity_id,
        project_id=payload.project_id,
        owner_id=payload.owner_id or current_user.id,
        contract_value=payload.contract_value or 0.0,
        currency=payload.currency or "USD",
        status=payload.status.value if isinstance(payload.status, CustomerStatus) else (payload.status or CustomerStatus.ACTIVE.value),
        account_health=payload.account_health.value if isinstance(payload.account_health, AccountHealth) else (payload.account_health or AccountHealth.GOOD.value),
        start_date=payload.start_date or datetime.now(timezone.utc),
        renewal_date=payload.renewal_date,
        next_review_date=payload.next_review_date,
        notes=payload.notes,
        created_by=current_user.name,
    )
    db.add(customer)

    # Update organization status to Customer
    org.status = ConnectionStatus.CUSTOMER.value

    # Audit log
    log_audit_event(
        db,
        action="CREATE_CUSTOMER",
        resource_type="CUSTOMER",
        resource_id=org.id,
        user=current_user,
        metadata={"organization_name": org.name, "contract_value": customer.contract_value},
    )
    db.commit()
    db.refresh(customer)
    return _customer_to_out(customer)


@router.post("/convert", response_model=CustomerOut, status_code=status.HTTP_201_CREATED)
def convert_to_customer(
    payload: CustomerConvertRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org = db.query(Organization).filter(Organization.id == payload.organization_id, Organization.is_deleted == False).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    customer = db.query(Customer).filter(Customer.organization_id == payload.organization_id, Customer.is_deleted == False).first()
    if not customer:
        customer = Customer(
            organization_id=payload.organization_id,
            primary_contact_id=payload.primary_contact_id,
            opportunity_id=payload.opportunity_id,
            project_id=payload.project_id,
            owner_id=current_user.id,
            contract_value=payload.contract_value or 0.0,
            currency=payload.currency or "USD",
            status=CustomerStatus.ACTIVE.value,
            account_health=AccountHealth.GOOD.value,
            start_date=payload.start_date or datetime.now(timezone.utc),
            renewal_date=payload.renewal_date,
            notes=payload.notes,
            created_by=current_user.name,
        )
        db.add(customer)
    else:
        customer.status = CustomerStatus.ACTIVE.value
        if payload.contract_value:
            customer.contract_value = payload.contract_value
        if payload.notes:
            customer.notes = payload.notes

    # Update organization status
    org.status = ConnectionStatus.CUSTOMER.value

    # If linked to an opportunity, update stage to CUSTOMER
    if payload.opportunity_id:
        opp = db.query(Opportunity).filter(Opportunity.id == payload.opportunity_id, Opportunity.is_deleted == False).first()
        if opp:
            opp.stage = OpportunityStage.CUSTOMER.value

    log_audit_event(
        db,
        action="CONVERT_TO_CUSTOMER",
        resource_type="CUSTOMER",
        resource_id=org.id,
        user=current_user,
        metadata={"organization_name": org.name, "contract_value": customer.contract_value},
    )
    db.commit()
    db.refresh(customer)
    return _customer_to_out(customer)


@router.put("/{customer_id}", response_model=CustomerOut)
def update_customer(
    customer_id: int,
    payload: CustomerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    c = db.query(Customer).filter(Customer.id == customer_id, Customer.is_deleted == False).first()
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")

    update_dict = payload.model_dump(exclude_unset=True)
    for field, val in update_dict.items():
        if val is not None:
            if field in ["status", "account_health"] and hasattr(val, "value"):
                setattr(c, field, val.value)
            else:
                setattr(c, field, val)

    c.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(c)
    return _customer_to_out(c)


@router.delete("/{customer_id}")
def delete_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    c = db.query(Customer).filter(Customer.id == customer_id, Customer.is_deleted == False).first()
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    c.is_deleted = True
    db.commit()
    return {"message": "Customer record deleted successfully"}
