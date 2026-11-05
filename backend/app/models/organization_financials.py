from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base


class OrganizationFinancials(Base):
    __tablename__ = "organization_financials"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    organization_id = Column(
        Integer,
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    cik = Column(String(10), nullable=False)
    entity_name = Column(String(255), nullable=True)
    currency = Column(String(10), nullable=True, default="USD")

    # {"revenue": [FinancialPoint, ...], "net_income": [...], ...}
    metrics = Column(JSON, nullable=True, default=dict)

    health_label = Column(String(30), nullable=True)
    health_reasons = Column(JSON, nullable=True, default=list)
    revenue_growth = Column(Float, nullable=True)
    net_margin = Column(Float, nullable=True)
    health_period_end = Column(String(20), nullable=True)

    fetch_status = Column(String(10), nullable=True)
    fetch_error = Column(Text, nullable=True)
    fetched_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    organization = relationship("Organization", backref="financials_link")

    def __repr__(self):
        return f"<OrganizationFinancials org_id={self.organization_id} cik='{self.cik}' status='{self.fetch_status}'>"
