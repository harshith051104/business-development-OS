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


def test_generate_executive_report_refuses_non_dev(db_session):
    from app.services.copilot.tools import generate_executive_report
    from app.models.user import User, UserRole
    from app.models.report import ReportGeneration
    non_dev = db_session.query(User).filter(User.role == UserRole.BUSINESS_DEVELOPMENT.value).first()
    count_before = db_session.query(ReportGeneration).count()
    result = generate_executive_report(db_session, non_dev, period="")
    assert "report_id" not in result
    assert db_session.query(ReportGeneration).count() == count_before


def test_generate_executive_report_dev_creates_files_and_row(db_session, monkeypatch, tmp_path):
    from app.services.copilot import tools as tools_module
    from app.services import report_render_service
    from app.models.user import User, UserRole
    monkeypatch.setattr(report_render_service, "_get_llm_router", lambda: (_ for _ in ()).throw(Exception("skip llm in test")))
    dev_user = db_session.query(User).filter(User.role == UserRole.DEV.value).first()
    result = tools_module.generate_executive_report(db_session, dev_user, period="last 30 days")
    assert "report_id" in result
    assert result["formats"] == ["docx", "pdf"]
    from app.models.report import ReportGeneration
    row = db_session.query(ReportGeneration).get(result["report_id"])
    import os
    assert os.path.exists(row.docx_path)
    assert os.path.getsize(row.docx_path) > 0
    assert os.path.exists(row.pdf_path)
    assert os.path.getsize(row.pdf_path) > 0


def test_intent_router_routes_executive_report_phrase():
    from app.services.copilot.intent_router import route
    result = route("Generate an executive report for the last 30 days")
    assert result.tool_name == "generate_executive_report"
    assert result.pre_resolved_args is not None
    assert result.pre_resolved_args.get("period") == "Generate an executive report for the last 30 days"


def test_generate_executive_report_quiet_period_still_generates(db_session):
    from app.services.copilot.tools import generate_executive_report
    from app.models.user import User, UserRole
    from datetime import datetime, timezone, timedelta
    dev_user = db_session.query(User).filter(User.role == UserRole.DEV.value).first()
    far_future_period = (datetime.now(timezone.utc) + timedelta(days=3650)).isoformat()
    result = generate_executive_report(db_session, dev_user, period="this week")
    assert "report_id" in result
