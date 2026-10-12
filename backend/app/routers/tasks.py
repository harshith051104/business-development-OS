from typing import List, Optional
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.database import get_db
from app.auth.deps import get_current_user
from app.models.user import User
from app.models.organization import Organization
from app.models.contact import Contact
from app.models.opportunity import Opportunity
from app.models.meeting import Meeting
from app.models.demo import Demo
from app.models.proposal import Proposal
from app.models.negotiation import Negotiation
from app.models.partnership import Partnership
from app.models.customer import Customer
from app.models.task import BDTask, TaskStatus, TaskPriority
from app.models.task_comment import TaskComment
from app.core.audit import log_audit_event
from app.schemas.task import TaskCreate, TaskUpdate, TaskOut, TaskCommentCreate, TaskCommentOut, TaskDashboardOut

router = APIRouter(prefix="/api/business-development/tasks", tags=["Tasks"])


def _task_to_out(t: BDTask, db: Session) -> TaskOut:
    entity_name = None
    if t.entity_id and t.entity_type:
        entity_map = {
            "organization": Organization,
            "contact": Contact,
            "opportunity": Opportunity,
            "meeting": Meeting,
            "demo": Demo,
            "proposal": Proposal,
            "negotiation": Negotiation,
            "partnership": Partnership,
            "customer": Customer,
        }
        model = entity_map.get(t.entity_type)
        if model:
            obj = db.query(model).filter(model.id == t.entity_id).first()
            if obj:
                entity_name = getattr(obj, "name", None) or getattr(obj, "title", None) or getattr(obj, "full_name", None)

    return TaskOut(
        id=t.id,
        title=t.title,
        description=t.description,
        priority=t.priority,
        status=t.status,
        due_date=t.due_date,
        completed_at=t.completed_at,
        entity_type=t.entity_type,
        entity_id=t.entity_id,
        owner_id=t.owner_id,
        owner_name=t.owner.name if t.owner else None,
        entity_name=entity_name,
        created_at=t.created_at,
        updated_at=t.updated_at,
    )


@router.get("", response_model=List[TaskOut])
def list_tasks(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    limit: int = Query(50, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(BDTask).filter(BDTask.is_deleted == False)
    if status:
        q = q.filter(BDTask.status == status)
    if priority:
        q = q.filter(BDTask.priority == priority)
    if entity_type:
        q = q.filter(BDTask.entity_type == entity_type)
    if entity_id:
        q = q.filter(BDTask.entity_id == entity_id)

    tasks = q.order_by(desc(BDTask.created_at)).limit(limit).all()
    return [_task_to_out(t, db) for t in tasks]


@router.get("/dashboard", response_model=TaskDashboardOut)
def get_task_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Per-user open/overdue/completed-this-week counts for the dashboard widget."""
    now = datetime.now(timezone.utc)
    week_start = now - timedelta(days=7)

    base = db.query(BDTask).filter(BDTask.is_deleted == False, BDTask.owner_id == current_user.id)

    open_count = base.filter(BDTask.status.in_([TaskStatus.TODO.value, TaskStatus.IN_PROGRESS.value])).count()
    overdue_count = base.filter(
        BDTask.status.in_([TaskStatus.TODO.value, TaskStatus.IN_PROGRESS.value]),
        BDTask.due_date.isnot(None),
        BDTask.due_date <= now,
    ).count()
    completed_this_week = base.filter(
        BDTask.status == TaskStatus.COMPLETED.value,
        BDTask.completed_at.isnot(None),
        BDTask.completed_at >= week_start,
    ).count()

    by_priority = {}
    for p in TaskPriority:
        by_priority[p.value] = base.filter(
            BDTask.priority == p.value,
            BDTask.status.in_([TaskStatus.TODO.value, TaskStatus.IN_PROGRESS.value]),
        ).count()

    return TaskDashboardOut(
        open_count=open_count,
        overdue_count=overdue_count,
        completed_this_week=completed_this_week,
        by_priority=by_priority,
    )


@router.get("/{task_id}", response_model=TaskOut)
def get_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    t = db.query(BDTask).filter(BDTask.id == task_id, BDTask.is_deleted == False).first()
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    return _task_to_out(t, db)


@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(
    payload: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = BDTask(
        title=payload.title,
        description=payload.description,
        priority=payload.priority.value if isinstance(payload.priority, TaskPriority) else (payload.priority or TaskPriority.MEDIUM.value),
        status=payload.status.value if isinstance(payload.status, TaskStatus) else (payload.status or TaskStatus.TODO.value),
        due_date=payload.due_date,
        entity_type=payload.entity_type,
        entity_id=payload.entity_id,
        owner_id=payload.owner_id or current_user.id,
        created_by=current_user.name,
    )
    db.add(task)

    log_audit_event(
        db,
        action="CREATE_TASK",
        resource_type="TASK",
        resource_id=task.id,
        user=current_user,
        metadata={"title": task.title, "priority": task.priority},
    )
    db.commit()
    db.refresh(task)
    return _task_to_out(task, db)


@router.put("/{task_id}", response_model=TaskOut)
def update_task(
    task_id: int,
    payload: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    t = db.query(BDTask).filter(BDTask.id == task_id, BDTask.is_deleted == False).first()
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")

    update_dict = payload.model_dump(exclude_unset=True)
    for field, val in update_dict.items():
        if val is not None:
            if field in ["status", "priority"] and hasattr(val, "value"):
                setattr(t, field, val.value)
            else:
                setattr(t, field, val)

    if t.status == TaskStatus.COMPLETED.value and not t.completed_at:
        t.completed_at = datetime.now(timezone.utc)

    t.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(t)
    return _task_to_out(t, db)


@router.delete("/{task_id}")
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    t = db.query(BDTask).filter(BDTask.id == task_id, BDTask.is_deleted == False).first()
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    t.is_deleted = True
    db.commit()
    return {"message": "Task deleted successfully"}


def _comment_to_out(c: TaskComment) -> TaskCommentOut:
    return TaskCommentOut(
        id=c.id,
        task_id=c.task_id,
        user_id=c.user_id,
        user_name=c.user.name if c.user else None,
        body=c.body,
        created_at=c.created_at,
    )


@router.get("/{task_id}/comments", response_model=List[TaskCommentOut])
def list_task_comments(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    t = db.query(BDTask).filter(BDTask.id == task_id, BDTask.is_deleted == False).first()
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    comments = (
        db.query(TaskComment)
        .filter(TaskComment.task_id == task_id)
        .order_by(TaskComment.created_at.asc())
        .all()
    )
    return [_comment_to_out(c) for c in comments]


@router.post("/{task_id}/comments", response_model=TaskCommentOut, status_code=status.HTTP_201_CREATED)
def create_task_comment(
    task_id: int,
    payload: TaskCommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    t = db.query(BDTask).filter(BDTask.id == task_id, BDTask.is_deleted == False).first()
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")

    comment = TaskComment(task_id=task_id, user_id=current_user.id, body=payload.body)
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return _comment_to_out(comment)
