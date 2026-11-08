"""ai_web_feeds.digests -- Email digest generation and delivery

This module handles email digest subscriptions, content generation, and SMTP delivery.
"""

import smtplib
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from html import escape
from urllib.parse import urlparse

from croniter import croniter  # type: ignore[import-untyped]
from loguru import logger

from ai_web_feeds.config import Settings
from ai_web_feeds.models import ArticleEntry, EmailDigest
from ai_web_feeds.storage import DatabaseManager

_DIGEST_PAUSE_NOTE = (
    "Update or pause digest delivery from the AI Web Feeds application where this "
    "digest was configured."
)


@dataclass(frozen=True, slots=True)
class DigestBody:
    """Rendered digest content. Building this object does not send mail."""

    subject: str
    text: str
    html: str


@dataclass(frozen=True, slots=True)
class _ArticleView:
    """Fields the digest renderer reads from an article-like object."""

    title: str
    summary: str
    author: str
    pub_date: datetime | None
    link: str | None


def _article_value(article: object, name: str) -> object:
    """Read one field from a mapping or an attribute object."""
    if isinstance(article, Mapping):
        return article.get(name)
    return getattr(article, name, None)


def _text_field(value: object) -> str:
    """Coerce a field to text. Missing values stay empty instead of becoming ``None``."""
    if isinstance(value, str):
        return value
    if value is None:
        return ""
    return str(value)


def _article_view(article: object) -> _ArticleView:
    """Normalize one article-like object or mapping."""
    pub_date = _article_value(article, "pub_date")
    link = _article_value(article, "link")
    return _ArticleView(
        title=_text_field(_article_value(article, "title")),
        summary=_text_field(_article_value(article, "summary")),
        author=_text_field(_article_value(article, "author")),
        pub_date=pub_date if isinstance(pub_date, datetime) else None,
        link=link if isinstance(link, str) else None,
    )


def _select_articles(articles: Sequence[object], max_articles: int | None) -> Sequence[object]:
    """Return articles in input order, optionally capped."""
    if max_articles is None:
        return articles
    if max_articles < 0:
        msg = "max_articles must be non-negative"
        raise ValueError(msg)
    return list(articles)[:max_articles]


def _digest_subject(now: datetime | None, ensure_utc: Callable[[datetime], datetime]) -> str:
    """Build the dated digest subject."""
    moment = ensure_utc(now if now is not None else datetime.now(UTC))
    return f"AI Web Feeds Digest - {moment.strftime('%Y-%m-%d')}"


def _format_pub_date(pub_date: datetime | None, ensure_utc: Callable[[datetime], datetime]) -> str:
    """Format a publication time as UTC ``YYYY-MM-DD HH:MM``."""
    if pub_date is None:
        return ""
    return ensure_utc(pub_date).strftime("%Y-%m-%d %H:%M")


def _render_digest_html(
    articles: Sequence[object],
    *,
    ensure_utc: Callable[[datetime], datetime],
    sanitize_link: Callable[[str | None], str | None],
) -> str:
    """Render the digest HTML body. Unsafe links are omitted, not escaped into hrefs."""
    html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body {{ font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; }}
                h1 {{ color: #333; }}
                .article {{ border-bottom: 1px solid #eee; padding: 15px 0; }}
                .article-title {{ font-size: 18px; font-weight: bold; margin-bottom: 5px; }}
                .article-meta {{ color: #666; font-size: 14px; margin-bottom: 10px; }}
                .article-summary {{ color: #444; line-height: 1.6; }}
                a {{ color: #0066cc; text-decoration: none; }}
            </style>
        </head>
        <body>
            <h1>Your AI Web Feeds Digest</h1>
            <p>Here are the latest {len(articles)} articles from your followed sources:</p>
        """

    for article in articles:
        view = _article_view(article)
        safe_title = escape(view.title)
        safe_summary = escape(view.summary or "")
        safe_author = escape(view.author or "Unknown")
        safe_pub_date = _format_pub_date(view.pub_date, ensure_utc)
        safe_link = sanitize_link(view.link)
        title_html = (
            f'<a href="{escape(safe_link, quote=True)}">{safe_title}</a>'
            if safe_link
            else safe_title
        )
        html += f"""
            <div class="article">
                <div class="article-title">
                    {title_html}
                </div>
                <div class="article-meta">
                    {safe_pub_date} | {safe_author}
                </div>
                <div class="article-summary">
                    {safe_summary}
                </div>
            </div>
            """

    html += """
            <p style="margin-top: 30px; color: #666; font-size: 12px;">
                Update or pause digest delivery from the AI Web Feeds application where this
                digest was configured.
            </p>
        </body>
        </html>
        """

    return html


def _article_text_lines(
    article: object,
    *,
    ensure_utc: Callable[[datetime], datetime],
    sanitize_link: Callable[[str | None], str | None],
) -> list[str]:
    """Render one article as plain-text lines."""
    view = _article_view(article)
    published = _format_pub_date(view.pub_date, ensure_utc)
    author = view.author or "Unknown"
    lines = [view.title or "Untitled"]
    if published:
        lines.append(f"{published} | {author}")
    else:
        lines.append(author)
    if view.summary:
        lines.append(view.summary)
    safe_link = sanitize_link(view.link)
    if safe_link is not None:
        lines.append(safe_link)
    return lines


def _render_digest_text(
    articles: Sequence[object],
    *,
    ensure_utc: Callable[[datetime], datetime],
    sanitize_link: Callable[[str | None], str | None],
) -> str:
    """Render the plain-text digest body."""
    lines = [
        "Your AI Web Feeds Digest",
        f"Here are the latest {len(articles)} articles from your followed sources:",
        "",
    ]
    for article in articles:
        lines.extend(
            _article_text_lines(article, ensure_utc=ensure_utc, sanitize_link=sanitize_link)
        )
        lines.append("")
    lines.append(_DIGEST_PAUSE_NOTE)
    return "\n".join(lines)


def build_digest(
    articles: Sequence[object],
    *,
    now: datetime | None = None,
    max_articles: int | None = None,
) -> DigestBody:
    """Turn article-like objects into a digest subject and body without sending mail.

    Objects may be mappings or attribute objects. Recognized fields are ``title``,
    ``summary``, ``author``, ``pub_date``, and ``link``. Input order is preserved.
    Only ``http`` and ``https`` links are included.

    Args:
        articles: Article-like objects to include.
        now: Timestamp used in the subject. Naive values are treated as UTC.
        max_articles: Optional cap applied in input order.

    Returns:
        Subject, plain text, and HTML. No SMTP client is constructed.
    """
    selected = _select_articles(articles, max_articles)
    ensure_utc = DigestManager._ensure_utc
    sanitize_link = DigestManager._sanitize_link
    return DigestBody(
        subject=_digest_subject(now, ensure_utc),
        text=_render_digest_text(selected, ensure_utc=ensure_utc, sanitize_link=sanitize_link),
        html=_render_digest_html(selected, ensure_utc=ensure_utc, sanitize_link=sanitize_link),
    )


class DigestManager:
    """Manage email digest subscriptions and delivery."""

    def __init__(
        self,
        db: DatabaseManager,
        settings: Settings,
    ) -> None:
        """Initialize digest manager.

        Args:
            db: Database manager instance
            settings: Application settings
        """
        self.db = db
        self.settings = settings
        self.smtp_host = settings.phase3b.smtp_host
        self.smtp_port = settings.phase3b.smtp_port
        self.smtp_user = settings.phase3b.smtp_user
        self.smtp_password = settings.phase3b.smtp_password
        self.smtp_from = settings.phase3b.smtp_from
        self.max_articles = settings.phase3b.digest_max_articles

    @staticmethod
    def _ensure_utc(value: datetime) -> datetime:
        """Normalize datetime values to UTC."""
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)

    @staticmethod
    def _sanitize_link(link: str | None) -> str | None:
        """Return a safe http(s) link or None when the URL is not safe to render."""
        if not link:
            return None

        parsed = urlparse(link)
        if parsed.scheme in {"http", "https"} and parsed.netloc:
            return link
        return None

    async def send_due_digests(self) -> int:
        """Send all digests due for delivery.

        Returns:
            Number of digests sent
        """
        now = self._ensure_utc(datetime.now(UTC))
        due_digests = self.db.get_due_digests(now)

        sent_count = 0
        for digest in due_digests:
            try:
                await self._send_digest(digest)
                sent_count += 1

                # Update digest schedule
                digest.last_sent_at = now
                digest.next_send_at = self._calculate_next_send(digest.schedule_cron, now)
                self.db.update_email_digest(digest)

            except Exception as e:
                logger.error(f"Failed to send digest {digest.id}: {e}")

        logger.info(f"Sent {sent_count}/{len(due_digests)} email digests")
        return sent_count

    async def _send_digest(self, digest: EmailDigest) -> None:
        """Send individual email digest.

        Args:
            digest: EmailDigest instance
        """
        # Get user's followed sources.
        user_feeds = self.db.get_user_followed_sources(digest.user_id)

        # Get recent articles from followed sources.
        since = (
            self._ensure_utc(digest.last_sent_at)
            if digest.last_sent_at
            else self._ensure_utc(datetime.now(UTC) - timedelta(days=1))
        )
        articles = []
        for feed_id in user_feeds:
            feed_articles = self.db.get_articles(feed_id, limit=self.max_articles)
            articles.extend([a for a in feed_articles if self._ensure_utc(a.pub_date) >= since])

        # Sort by pub_date (most recent first)
        articles.sort(key=lambda a: a.pub_date, reverse=True)
        articles = articles[: self.max_articles]

        if not articles:
            logger.debug(f"No articles for digest {digest.id}, skipping")
            return

        # Generate email HTML
        html_content = self._generate_html(digest, articles)

        # Send email
        msg = MIMEMultipart("alternative")
        msg["Subject"] = (
            f"AI Web Feeds Digest - {self._ensure_utc(datetime.now(UTC)).strftime('%Y-%m-%d')}"
        )
        msg["From"] = self.smtp_from
        msg["To"] = digest.email
        msg.attach(MIMEText(html_content, "html"))

        with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
            if self.smtp_user and self.smtp_password:
                server.starttls()
                server.login(self.smtp_user, self.smtp_password)
            server.send_message(msg)

        # Update stats
        digest.article_count += len(articles)

        logger.info(f"Sent digest {digest.id} with {len(articles)} articles to {digest.email}")

    def _generate_html(self, _digest: EmailDigest, articles: list[ArticleEntry]) -> str:
        """Generate HTML email content.

        Args:
            _digest: EmailDigest instance
            articles: List of ArticleEntry objects

        Returns:
            HTML email string
        """
        return _render_digest_html(
            articles,
            ensure_utc=self._ensure_utc,
            sanitize_link=self._sanitize_link,
        )

    def _calculate_next_send(self, cron_expr: str, from_time: datetime) -> datetime:
        """Calculate next send time from cron expression.

        Args:
            cron_expr: Cron expression (e.g., "0 9 * * *")
            from_time: Reference time

        Returns:
            Next scheduled send time
        """
        reference_time = self._ensure_utc(from_time)
        cron = croniter(cron_expr, reference_time)
        next_dt = cron.get_next(datetime)
        return self._ensure_utc(next_dt)
