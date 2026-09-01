from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from app.models.task import TaskPriority, TaskStatus


class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    priority: Optional[TaskPriority] = TaskPriority.MEDIUM
    status: Optional[TaskStatus] = TaskStatus.TODO
    due_date: Optional[datetime] = None
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    owner_id: Optional[int] = None


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[TaskPriority] = None
    status: Optional[TaskStatus] = None
    due_date: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    owner_id: Optional[int] = None


class TaskOut(TaskBase):
    id: int
    completed_at: Optional[datetime] = None
    owner_name: Optional[str] = None
    entity_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
