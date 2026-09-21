"""
Unit tests for Deterministic Task Classifier (Phase 23 routing hardening).
"""
import pytest
from app.services.copilot.task_classifier import classify_task, TaskType


class TestTaskClassifier:
    def test_simple_crm_queries(self):
        assert classify_task("Show me meetings scheduled for today") == TaskType.SIMPLE_TOOL
        assert classify_task("What is the status of Medanta?") == TaskType.SIMPLE_TOOL
        assert classify_task("List all contacts at Apollo Hospitals") == TaskType.SIMPLE_TOOL
        assert classify_task("Reschedule my 3pm meeting to tomorrow") == TaskType.SIMPLE_TOOL
        assert classify_task("Add a new task to call Dr. Reddy") == TaskType.SIMPLE_TOOL

    def test_complex_multi_step_workflows(self):
        assert classify_task("Find my top 10 prospects and draft personalized emails using their latest company developments") == TaskType.COMPLEX_WORKFLOW
        assert classify_task("Search for fintech companies in Singapore and then draft outreach proposals") == TaskType.COMPLEX_WORKFLOW
        assert classify_task("Research the target accounts and prepare executive pitch decks") == TaskType.COMPLEX_WORKFLOW
        assert classify_task("Execute the outbound email campaign workflow for qualified leads") == TaskType.COMPLEX_WORKFLOW

    def test_deep_research_and_scraping(self):
        assert classify_task("Perform deep research on Narayana Health website") == TaskType.RESEARCH
        assert classify_task("Scrape the annual report and technology signals for Tata Steel") == TaskType.RESEARCH
        assert classify_task("Extract tech stack analysis from the company whitepaper") == TaskType.RESEARCH

    def test_structured_extraction(self):
        assert classify_task("Extract JSON data from this lead table according to schema") == TaskType.EXTRACTION
        assert classify_task("Run Apollo extraction to parse contacts and executive emails") == TaskType.EXTRACTION
        assert classify_task("Normalize and deduplicate these lead records") == TaskType.EXTRACTION

    def test_pure_chat(self):
        assert classify_task("Hello") == TaskType.CHAT
        assert classify_task("Good morning ELLY") == TaskType.CHAT
        assert classify_task("Who are you?") == TaskType.CHAT
        assert classify_task("Thank you!") == TaskType.CHAT
