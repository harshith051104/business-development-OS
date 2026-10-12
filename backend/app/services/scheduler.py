"""In-process background job scheduler (APScheduler).

Lean alternative to Celery/Redis for a 3-4 person deployment: no extra
infra to run or monitor. All jobs are wrapped so a single failing job
logs and never kills the scheduler loop.
"""
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler

logger = logging.getLogger("elly.scheduler")

scheduler = AsyncIOScheduler()


def _safe(name, func):
    def wrapper():
        try:
            func()
        except Exception:
            logger.exception("Scheduled job '%s' failed", name)
    return wrapper


def register_job(name, func, trigger, **trigger_args):
    """Register (or replace) a job by name with an APScheduler trigger."""
    scheduler.add_job(
        _safe(name, func),
        trigger,
        id=name,
        replace_existing=True,
        **trigger_args,
    )


def start():
    if not scheduler.running:
        scheduler.start()
        logger.info("Scheduler started with %d job(s)", len(scheduler.get_jobs()))


def shutdown():
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped")
