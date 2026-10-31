import os
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.auth.deps import require_role
from app.models.report import ReportGeneration

router = APIRouter(prefix="/api/reports", tags=["Reports"])

MEDIA_TYPES = {
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "pdf": "application/pdf",
}


@router.get("/{report_id}/download")
def download_report(report_id: int, format: str, db: Session = Depends(get_db), current_user=Depends(require_role("DEV"))):
    if format not in MEDIA_TYPES:
        raise HTTPException(status_code=404, detail="Unknown format")
    row = db.query(ReportGeneration).get(report_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Report not found")
    path = row.docx_path if format == "docx" else row.pdf_path
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Report file not found")
    filename = f"executive_report_{report_id}.{format}"
    return FileResponse(path, media_type=MEDIA_TYPES[format], filename=filename)
