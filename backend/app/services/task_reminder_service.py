"""Reminder sweep: notify task owners when a task's reminder_at passes.

Runs via APScheduler. Fires once per task — dedupes by checking whether this
task already got a TASK_REMINDER notification in the last 20 hours, same
pattern as task_sweep_service.sweep_due_tasks (TASK_DUE).
"""
import logging
from datetime import datetime, timedelta, timezone

from app.core.database import SessionLocal
from app.models.task import BDTask, TaskStatus
from app.models.notification import Notification
from app.models.setting import SystemSetting
from app.services import notification_service

logger = logging.getLogger("elly.task_reminder")

OPEN_STATUSES = {TaskStatus.TODO.value, TaskStatus.IN_PROGRESS.value}


def sweep_task_reminders():
    db = SessionLocal()
    try:
        setting = db.query(SystemSetting).filter(SystemSetting.key == "task_reminders_enabled").first()
        if setting is not None and setting.value_json is False:
            return

        now = datetime.now(timezone.utc)
        dedupe_cutoff = now - timedelta(hours=20)

        due_reminders = (
            db.query(BDTask)
            .filter(
                BDTask.is_deleted == False,  # noqa: E712
                BDTask.status.in_(OPEN_STATUSES),
                BDTask.reminder_at.isnot(None),
                BDTask.reminder_at <= now,
                BDTask.owner_id.isnot(None),
            )
            .all()
        )

        notified = 0
        for task in due_reminders:
            marker = f"[task:{task.id}]"
            recent = (
                db.query(Notification)
                .filter(
                    Notification.user_id == task.owner_id,
                    Notification.type == "TASK_REMINDER",
                    Notification.body.like(f"%{marker}%"),
                    Notification.created_at >= dedupe_cutoff,
                )
                .first()
            )
            if recent:
                continue

            notification_service.notify(
                db,
                user_id=task.owner_id,
                type="TASK_REMINDER",
                title=f"Reminder: {task.title}",
                body=f"Reminder for '{task.title}'. {marker}",
                link="/business-development/tasks",
            )
            notified += 1

        if notified:
            logger.info("Task reminder sweep: %d reminder notification(s) sent", notified)
    finally:
        db.close()
