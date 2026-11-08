"""Unit tests for the pure email digest builder."""

from datetime import UTC, datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from ai_web_feeds.digests import DigestBody, build_digest


def _article(
    *,
    title: str,
    summary: str | None,
    author: str | None,
    pub_date: datetime,
    link: str | None,
) -> SimpleNamespace:
    """Build an in-memory article-like object."""
    return SimpleNamespace(
        title=title,
        summary=summary,
        author=author,
        pub_date=pub_date,
        link=link,
    )


@pytest.mark.unit
class TestBuildDigest:
    """build_digest renders subject, text, and HTML and does not send mail."""

    def test_builds_subject_text_and_html(self) -> None:
        """Rendered content includes article fields and a dated subject."""
        now = datetime(2026, 3, 4, 15, 30, tzinfo=UTC)
        articles = [
            _article(
                title="First",
                summary="A summary",
                author="Ada",
                pub_date=now - timedelta(hours=1),
                link="https://example.com/first",
            ),
            _article(
                title="Second",
                summary=None,
                author=None,
                pub_date=now - timedelta(hours=2),
                link="https://example.com/second",
            ),
        ]

        body = build_digest(articles, now=now)

        assert isinstance(body, DigestBody)
        assert body.subject == "AI Web Feeds Digest - 2026-03-04"
        assert "Here are the latest 2 articles from your followed sources:" in body.text
        assert "2026-03-04 14:30 | Ada" in body.text
        assert "A summary" in body.text
        assert "https://example.com/first" in body.text
        assert "2026-03-04 13:30 | Unknown" in body.text
        assert "Second" in body.text
        assert "None" not in body.text
        assert "<!DOCTYPE html>" in body.html
        assert "Your AI Web Feeds Digest" in body.html
        assert "latest 2 articles" in body.html
        assert "2026-03-04 14:30" in body.html
        assert 'href="https://example.com/first"' in body.html
        assert "None" not in body.html
        assert "Update or pause digest delivery" in body.text
        assert "Update or pause digest delivery" in body.html

    def test_escapes_html_and_keeps_plain_text(self) -> None:
        """HTML is escaped. Plain text keeps the original characters."""
        now = datetime(2026, 1, 2, 9, 0, tzinfo=UTC)
        article = _article(
            title='Article with <special> & "characters"',
            summary="Summary with 'quotes' and & symbols",
            author="Ann <admin>",
            pub_date=now,
            link="http://example.com/article?id=1&ref=2",
        )

        body = build_digest([article], now=now)

        assert "Article with &lt;special&gt; &amp; &quot;characters&quot;" in body.html
        assert "Summary with &#x27;quotes&#x27; and &amp; symbols" in body.html
        assert "Ann &lt;admin&gt;" in body.html
        assert 'href="http://example.com/article?id=1&amp;ref=2"' in body.html
        assert "<special>" not in body.html
        assert 'Article with <special> & "characters"' in body.text
        assert "Summary with 'quotes' and & symbols" in body.text
        assert "http://example.com/article?id=1&ref=2" in body.text

    @pytest.mark.parametrize(
        "link",
        [
            "javascript:alert(1)",
            "file:///etc/passwd",
            "data:text/html,hi",
        ],
    )
    def test_drops_unsafe_links(self, link: str) -> None:
        """Non-http(s) links are left out of both bodies."""
        now = datetime(2026, 2, 2, tzinfo=UTC)
        article = _article(
            title="Unsafe Link",
            summary="Summary",
            author="Ada",
            pub_date=now,
            link=link,
        )

        body = build_digest([article], now=now)

        assert link not in body.html
        assert link not in body.text
        assert "Unsafe Link" in body.html
        assert "Unsafe Link" in body.text
        assert "href=" not in body.html

    def test_preserves_order_and_honors_cap(self) -> None:
        """The cap keeps the caller's order instead of sorting by date."""
        now = datetime(2026, 5, 1, 12, 0, tzinfo=UTC)
        articles = [
            _article(
                title="Older",
                summary="First in",
                author="Ada",
                pub_date=now - timedelta(days=2),
                link="https://example.com/older",
            ),
            _article(
                title="Newer",
                summary="Second in",
                author="Bea",
                pub_date=now,
                link="https://example.com/newer",
            ),
        ]

        full = build_digest(articles, now=now)
        capped = build_digest(articles, now=now, max_articles=1)

        assert full.text.index("Older") < full.text.index("Newer")
        assert "Older" in capped.text
        assert "Newer" not in capped.text
        assert "Newer" not in capped.html
        assert "latest 1 articles" in capped.html
        assert "https://example.com/older" in capped.text

    def test_does_not_mutate_input_when_capped(self) -> None:
        """Capping copies the selection and leaves the caller's list alone."""
        now = datetime(2026, 4, 1, tzinfo=UTC)
        articles = [
            _article(
                title="A",
                summary="one",
                author="Ada",
                pub_date=now,
                link="https://example.com/a",
            ),
            _article(
                title="B",
                summary="two",
                author="Bea",
                pub_date=now,
                link="https://example.com/b",
            ),
        ]
        snapshot = list(articles)

        build_digest(articles, now=now, max_articles=1)

        assert articles == snapshot
        assert len(articles) == 2

    def test_empty_articles_still_render(self) -> None:
        """An empty selection still produces a subject and both bodies."""
        body = build_digest([], now=datetime(2026, 6, 7, 1, 2, tzinfo=UTC))

        assert body.subject == "AI Web Feeds Digest - 2026-06-07"
        assert "latest 0 articles" in body.html
        assert "latest 0 articles" in body.text

    def test_accepts_mapping_articles(self) -> None:
        """Mappings are article-like input, not only attribute objects."""
        now = datetime(2026, 8, 9, 8, 15, tzinfo=UTC)
        article = {
            "title": "Mapped",
            "summary": "From a dict",
            "author": "Bea",
            "pub_date": now,
            "link": "http://example.com/mapped",
        }

        body = build_digest([article], now=now)

        assert "Mapped" in body.html
        assert "From a dict" in body.text
        assert "2026-08-09 08:15 | Bea" in body.text
        assert "http://example.com/mapped" in body.html

    def test_naive_now_is_treated_as_utc(self) -> None:
        """Naive subject timestamps are labeled UTC rather than converted."""
        body = build_digest([], now=datetime(2026, 11, 8, 23, 0))

        assert body.subject == "AI Web Feeds Digest - 2026-11-08"

    def test_non_utc_now_is_converted_for_the_subject(self) -> None:
        """Aware timestamps are shifted to UTC before the subject date is chosen."""
        local = datetime(2026, 11, 8, 20, 0, tzinfo=timezone(timedelta(hours=-5)))

        body = build_digest([], now=local)

        assert body.subject == "AI Web Feeds Digest - 2026-11-09"

    def test_rejects_negative_max_articles(self) -> None:
        """A negative cap is a caller error, not an empty digest."""
        with pytest.raises(ValueError, match="non-negative"):
            build_digest([], max_articles=-1)

    def test_max_articles_zero_includes_nothing(self) -> None:
        """A zero cap renders the shell and no articles."""
        now = datetime(2026, 1, 1, tzinfo=UTC)
        article = _article(
            title="Skipped",
            summary="nope",
            author="Ada",
            pub_date=now,
            link="https://example.com/skipped",
        )

        body = build_digest([article], now=now, max_articles=0)

        assert "Skipped" not in body.text
        assert "Skipped" not in body.html
        assert "latest 0 articles" in body.text
