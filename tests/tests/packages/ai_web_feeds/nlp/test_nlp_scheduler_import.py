"""Import contract for the NLP scheduler.

Importing the scheduler must not start a thread, download model weights, or
import the optional ML extra. A missing extra is a logged skip, not a crash.
"""

from __future__ import annotations

import http.client
import importlib
import socket
import sys
import threading
import urllib.request
from collections.abc import Callable
from typing import Any

import pytest
from loguru import logger

_MODULE = "ai_web_feeds.nlp.scheduler"
_JOB_IDS = frozenset(
    {
        "quality_scoring",
        "entity_extraction",
        "sentiment_analysis",
        "topic_modeling",
    }
)
_WEIGHT_ROOTS = frozenset(
    {
        "bertopic",
        "gensim",
        "huggingface_hub",
        "nltk",
        "sentence_transformers",
        "spacy",
        "tokenizers",
        "torch",
        "transformers",
    }
)
_SKIP_LABELS = (
    "quality scoring job",
    "entity extraction job",
    "sentiment analysis job",
    "topic modeling job",
)


def _alive_idents() -> set[int]:
    """Return idents of threads that are still alive."""
    return {
        thread.ident
        for thread in threading.enumerate()
        if thread.is_alive() and thread.ident is not None
    }


def _thread_names() -> set[str]:
    """Return names of threads that are still alive."""
    return {thread.name for thread in threading.enumerate() if thread.is_alive()}


def _drop_cached_module(name: str) -> None:
    """Drop a module so the next import executes it again."""
    sys.modules.pop(name, None)
    parent_name, _, child = name.rpartition(".")
    parent = sys.modules.get(parent_name)
    if parent is not None and child in parent.__dict__:
        del parent.__dict__[child]


def _refuse(channel: str) -> Callable[..., None]:
    """Build a stand-in that fails if a network API is used."""

    def _blocked(*_args: object, **_kwargs: object) -> None:
        message = f"nlp scheduler opened {channel}"
        raise AssertionError(message)

    return _blocked


def _block_network(monkeypatch: pytest.MonkeyPatch) -> None:
    """Refuse socket and HTTP entry points for the duration of the test."""
    monkeypatch.setattr(socket, "create_connection", _refuse("socket.create_connection"))
    monkeypatch.setattr(socket, "getaddrinfo", _refuse("socket.getaddrinfo"))
    monkeypatch.setattr(urllib.request, "urlopen", _refuse("urllib.request.urlopen"))
    monkeypatch.setattr(
        http.client.HTTPConnection,
        "request",
        _refuse("http.client.HTTPConnection.request"),
    )
    monkeypatch.setattr(
        http.client.HTTPSConnection,
        "connect",
        _refuse("http.client.HTTPSConnection.connect"),
    )


def _offline(monkeypatch: pytest.MonkeyPatch) -> None:
    """Keep hub and tokenizer clients from reaching the network."""
    monkeypatch.setenv("HF_HUB_OFFLINE", "1")
    monkeypatch.setenv("HF_HUB_DISABLE_TELEMETRY", "1")
    monkeypatch.setenv("TRANSFORMERS_OFFLINE", "1")
    monkeypatch.setenv("HF_DATASETS_OFFLINE", "1")
    monkeypatch.setenv("TOKENIZERS_PARALLELISM", "false")


def _weight_imports(imported: set[str]) -> list[str]:
    """Return weight-package names introduced by one import."""
    found = [name for name in imported if name.split(".", 1)[0] in _WEIGHT_ROOTS]
    return sorted(found)


def _capture_warnings() -> tuple[int, list[str]]:
    """Record loguru warnings until the caller removes the sink."""
    found: list[str] = []

    def _sink(message: object) -> None:
        found.append(str(message))

    return logger.add(_sink, level="WARNING"), found


@pytest.mark.unit
def test_import_registers_jobs_without_thread_or_weights(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Importing scheduler.py must not start APScheduler or load ML weights."""
    import ai_web_feeds

    assert ai_web_feeds.__name__ == "ai_web_feeds"
    _offline(monkeypatch)
    _block_network(monkeypatch)
    _drop_cached_module(_MODULE)

    before_threads = _alive_idents()
    before_modules = set(sys.modules)
    module = importlib.import_module(_MODULE)
    imported = set(sys.modules) - before_modules
    scheduler = module.NLPScheduler()
    try:
        assert _weight_imports(imported) == []
        assert scheduler._jobs_registered is False
        assert scheduler.scheduler.running is False
        assert scheduler.scheduler.get_jobs() == []
        assert _alive_idents() == before_threads
        assert not any("APScheduler" in name for name in _thread_names())

        scheduler.register_jobs()
        job_ids = {job.id for job in scheduler.scheduler.get_jobs()}
        assert job_ids == _JOB_IDS
        assert scheduler._jobs_registered is True
        assert scheduler.scheduler.running is False
        assert _alive_idents() == before_threads
        assert not any("APScheduler" in name for name in _thread_names())
    finally:
        if scheduler.scheduler.running:
            scheduler.scheduler.shutdown(wait=False)


@pytest.mark.unit
def test_missing_ml_extra_skips_and_logs(monkeypatch: pytest.MonkeyPatch) -> None:
    """Registered jobs log a skip when the optional ML extra cannot be imported."""
    module = importlib.import_module(_MODULE)
    real_import = importlib.import_module

    def _missing(name: str, package: str | None = None) -> Any:
        if name.startswith("ai_web_feeds.nlp.jobs."):
            message = f"optional ml extra is missing: {name}"
            raise ImportError(message)
        return real_import(name, package)

    monkeypatch.setattr(module.importlib, "import_module", _missing)
    sink_id, warnings = _capture_warnings()
    scheduler = module.NLPScheduler()
    try:
        scheduler.register_jobs()
        for job in scheduler.scheduler.get_jobs():
            job.func()
        assert scheduler.scheduler.running is False
        assert not any("APScheduler" in name for name in _thread_names())
    finally:
        logger.remove(sink_id)
        if scheduler.scheduler.running:
            scheduler.scheduler.shutdown(wait=False)

    text = "\n".join(warnings)
    for label in _SKIP_LABELS:
        assert f"Skipping {label}; optional ml extra is missing" in text
