def test_report_generation_table_exists(db_session):
    from app.models.report import ReportGeneration
    from datetime import datetime, timezone
    row = ReportGeneration(
        requested_by_id=None,
        period_start=datetime.now(timezone.utc),
        period_end=datetime.now(timezone.utc),
        docx_path="x.docx",
        pdf_path="x.pdf",
    )
    db_session.add(row)
    db_session.commit()
    assert row.id is not None


def test_resolve_period_defaults_to_30_days_on_unknown_phrase():
    from app.services.report_agent_service import resolve_period
    start, end = resolve_period("last fortnight")
    assert (end - start).days == 30


def test_resolve_period_empty_string_defaults_to_30_days():
    from app.services.report_agent_service import resolve_period
    start, end = resolve_period("")
    assert (end - start).days == 30


def test_get_team_performance_filters_by_period(db_session):
    from app.services.report_agent_service import get_team_performance
    from datetime import datetime, timezone, timedelta
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=30)
    result = get_team_performance(db_session, start, end)
    assert isinstance(result, list)


def test_gather_report_data_shape(db_session):
    from app.services.report_agent_service import gather_report_data
    from datetime import datetime, timezone, timedelta
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=30)
    data = gather_report_data(db_session, start, end)
    assert data.period_start == start
    assert data.period_end == end
    assert isinstance(data.team, list)
    assert isinstance(data.task_stats, dict)
    assert isinstance(data.company_totals, dict)
