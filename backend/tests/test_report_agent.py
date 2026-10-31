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


def test_render_narrative_success(monkeypatch):
    from app.services import report_render_service
    from app.services.report_agent_service import ReportData
    from app.services.copilot.llm_router import LLMResponse

    class StubRouter:
        def chat(self, *args, **kwargs):
            return LLMResponse(content="Overview: things are fine.")

    monkeypatch.setattr(report_render_service, "_get_llm_router", lambda: StubRouter())
    data = ReportData(period_start=None, period_end=None, team=[], task_stats={}, company_totals={})
    result = report_render_service.render_narrative(data)
    assert "Overview" in result


def test_render_narrative_falls_back_on_llm_failure(monkeypatch):
    from app.services import report_render_service
    from app.services.report_agent_service import ReportData
    from app.services.copilot.llm_router import AllProvidersExhausted, LLMProviderError

    class StubRouter:
        def chat(self, *args, **kwargs):
            raise AllProvidersExhausted([LLMProviderError("groq", 500, "boom")])

    monkeypatch.setattr(report_render_service, "_get_llm_router", lambda: StubRouter())
    data = ReportData(period_start=None, period_end=None, team=[], task_stats={}, company_totals={})
    result = report_render_service.render_narrative(data)
    assert isinstance(result, str) and len(result) > 0


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
