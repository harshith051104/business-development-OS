"""
Deterministic Task Classifier for ELLY Copilot Routing.

Ensures task routing across Groq, Gemini, and NVIDIA NIM is 100% predictable,
deterministic, and zero-token (0ms) rather than relying on LLM self-routing.

Routing Hierarchy:
  - SIMPLE_TOOL      -> Groq (openai/gpt-oss-120b) -> NVIDIA NIM -> Gemini
  - COMPLEX_WORKFLOW -> Gemini (gemini-3.8-flash) -> NVIDIA NIM -> Groq
  - RESEARCH         -> Gemini (gemini-3.8-flash) -> NVIDIA NIM -> Groq
  - EXTRACTION       -> NVIDIA NIM (nemotron-3.5) -> Gemini -> Groq
  - CHAT             -> Groq (openai/gpt-oss-120b) -> Gemini -> NVIDIA NIM
"""
from __future__ import annotations

import re
from enum import Enum
from typing import Optional, Dict, Any


class TaskType(str, Enum):
    SIMPLE_TOOL = "simple_tool"
    COMPLEX_WORKFLOW = "complex_tool"
    RESEARCH = "research"
    EXTRACTION = "extraction"
    CHAT = "chat"


# Multi-step chained action patterns (Search -> Research -> Qualify -> Showcase -> Personalize -> Draft)
_WORKFLOW_PATTERNS = [
    re.compile(r"\b(find|search|get|list|top\s+\d+)\b.*\b(and|then|to)\b.*\b(draft|reach\s*out|email|contact|personalize|pitch)\b", re.I),
    re.compile(r"\b(research|analyze|qualify)\b.*\b(and|then)\b.*\b(draft|prepare|generate|email|proposal)\b", re.I),
    re.compile(r"\b(draft|write|generate)\b.*\b(using|based on|with)\b.*\b(latest|developments?|news|research|signals?)\b", re.I),
    re.compile(r"\b(workflow|campaign|pipeline\s+cadence)\b", re.I),
    re.compile(r"\bprospects?\b.*\b(draft|personaliz|outreach\s+sequence)\b", re.I),
    re.compile(r"\b(compare|evaluate)\b.*\b(against|with)\b.*\b(proposals?|showcases?|icp)\b", re.I),
]

# Deep research, web scraping, and long-document analysis
_RESEARCH_PATTERNS = [
    re.compile(r"\b(deep\s*research|full\s*research|account\s*intelligence)\b", re.I),
    re.compile(r"\b(scrape|crawl|website\s*content|dom|web\s*inspection)\b", re.I),
    re.compile(r"\b(annual\s*report|whitepaper|financial\s*filing|investor\s*deck)\b", re.I),
    re.compile(r"\b(technology\s*signals?|tech\s*stack\s*analysis|expansion\s*news)\b", re.I),
]

# Strict JSON structuring & entity extraction
_EXTRACTION_PATTERNS = [
    re.compile(r"\b(extract\s*json|strict\s*json|json\s*schema)\b", re.I),
    re.compile(r"\b(apollo\s*extraction|apollo\s*grade|parse\s*contacts?)\b", re.I),
    re.compile(r"\b(normalize|deduplicate|dedup\s*records?)\b", re.I),
    re.compile(r"\b(structured\s*table|clean\s*records?)\b", re.I),
]

# Pure conversational queries (no tools needed)
_CHAT_PATTERNS = [
    re.compile(r"^(hi|hello|hey|greetings|good\s*(morning|afternoon|evening)|how\s*are\s*you)\b", re.I),
    re.compile(r"^(who\s*are\s*you|what\s*can\s*you\s*do|help|what\s*is\s*elly)\b", re.I),
    re.compile(r"^(thanks?|thank\s*you|great|awesome|ok|okay|cool)\b", re.I),
]


def classify_task(message: str, context: Optional[Dict[str, Any]] = None) -> TaskType:
    """
    Deterministically classifies a user message or copilot request into a TaskType.
    Executes in <1ms with zero LLM tokens.
    """
    if not message or not message.strip():
        return TaskType.CHAT

    cleaned = message.strip()

    # 1. Check for pure chat / greetings first if message is brief
    if len(cleaned.split()) <= 6:
        for pattern in _CHAT_PATTERNS:
            if pattern.search(cleaned):
                return TaskType.CHAT

    # 2. Check for multi-step complex workflows (Gemini primary)
    for pattern in _WORKFLOW_PATTERNS:
        if pattern.search(cleaned):
            return TaskType.COMPLEX_WORKFLOW

    # 3. Check for deep research / scraping / document analysis (Gemini primary)
    for pattern in _RESEARCH_PATTERNS:
        if pattern.search(cleaned):
            return TaskType.RESEARCH

    # 4. Check for structured extraction / JSON normalization (NVIDIA NIM primary)
    for pattern in _EXTRACTION_PATTERNS:
        if pattern.search(cleaned):
            return TaskType.EXTRACTION

    # 5. Default tool execution: Simple CRM / single action (Groq primary)
    return TaskType.SIMPLE_TOOL
