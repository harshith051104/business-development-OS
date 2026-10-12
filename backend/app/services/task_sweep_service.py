"""Daily sweep: notify task owners about due/overdue BDTasks.

Runs via APScheduler. Dedupes by checking whether this task already got
a TASK_DUE notification in the last 20 hours, so re-running the sweep
(or a short scheduler restart) doesn't spam the same reminder.
"""
import logging
from datetime import datetime, timedelta, timezone

from app.core.database import SessionLocal
from app.models.task import BDTask, TaskStatus
from app.models.notification import Notification
from app.services import notification_service

logger = logging.getLogger("elly.task_sweep")

OPEN_STATUSES = {TaskStatus.TODO.value, TaskStatus.IN_PROGRESS.value}


def sweep_due_tasks():
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        dedupe_cutoff = now - timedelta(hours=20)

        due_tasks = (
            db.query(BDTask)
            .filter(
                BDTask.is_deleted == False,  # noqa: E712
                BDTask.status.in_(OPEN_STATUSES),
                BDTask.due_date.isnot(None),
                BDTask.due_date <= now,
                BDTask.owner_id.isnot(None),
            )
            .all()
        )

        notified = 0
        for task in due_tasks:
            marker = f"[task:{task.id}]"
            recent = (
                db.query(Notification)
                .filter(
                    Notification.user_id == task.owner_id,
                    Notification.type == "TASK_DUE",
                    Notification.body.like(f"%{marker}%"),
                    Notification.created_at >= dedupe_cutoff,
                )
                .first()
            )
            if recent:
                continue

            overdue_days = (now.date() - task.due_date.date()).days
            status_word = "overdue" if overdue_days > 0 else "due today"
            notification_service.notify(
                db,
                user_id=task.owner_id,
                type="TASK_DUE",
                title=f"Task {status_word}: {task.title}",
                body=f"'{task.title}' is {status_word}. {marker}",
                link="/business-development/tasks",
            )
            notified += 1

        if notified:
            logger.info("Task sweep: %d due/overdue notification(s) sent", notified)
    finally:
        db.close()
