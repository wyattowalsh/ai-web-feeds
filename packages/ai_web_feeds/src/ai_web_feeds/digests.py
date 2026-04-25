"""ai_web_feeds.digests -- Email digest generation and delivery

This module handles email digest subscriptions, content generation, and SMTP delivery.
"""

import smtplib
from datetime import UTC, datetime, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from html import escape
from urllib.parse import urlparse

from croniter import croniter  # type: ignore[import-untyped]
from loguru import logger

from ai_web_feeds.config import Settings
from ai_web_feeds.digest_schedule import calculate_next_send_at, ensure_utc
from ai_web_feeds.models import EmailDigest, FeedEntry
from ai_web_feeds.storage import DatabaseManager


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
        now = ensure_utc(datetime.now(UTC))
        due_digests = self.db.get_due_digests(now)

        sent_count = 0
        for digest in due_digests:
            original_next_send_at = digest.next_send_at
            try:
                digest.next_send_at = self._calculate_next_send(digest, now)
                self.db.update_email_digest(digest)
            except Exception as e:
                logger.error(f"Failed to reserve digest {digest.id} for delivery: {e}")
                continue

            try:
                article_count = await self._send_digest(digest)
            except Exception as e:
                try:
                    digest.next_send_at = original_next_send_at
                    self.db.update_email_digest(digest)
                except Exception as rollback_error:  # pragma: no cover - defensive branch
                    logger.critical(
                        "Failed to restore digest {} after delivery error: {}",
                        digest.id,
                        rollback_error,
                    )
                logger.error(f"Failed to send digest {digest.id}: {e}")
                continue

            if article_count == 0:
                logger.info(
                    "Advanced digest {} without sending because no new articles were available",
                    digest.id,
                )
                continue

            digest.last_sent_at = now
            digest.article_count += article_count
            try:
                self.db.update_email_digest(digest)
            except Exception as persist_error:
                logger.critical(
                    "Digest {} was emailed but final delivery state could not be persisted: {}",
                    digest.id,
                    persist_error,
                )
                sent_count += 1
                continue

            sent_count += 1

        logger.info(f"Sent {sent_count}/{len(due_digests)} email digests")
        return sent_count

    async def _send_digest(self, digest: EmailDigest) -> int:
        """Send individual email digest.

        Args:
            digest: EmailDigest instance

        Returns:
            Number of delivered articles.
        """
        # Get user's followed feeds
        user_feeds = self.db.get_user_follows(digest.user_id)

        # Get recent articles from followed feeds
        since = (
            ensure_utc(digest.last_sent_at)
            if digest.last_sent_at
            else ensure_utc(datetime.now(UTC) - timedelta(days=1))
        )
        articles = []
        for feed_id in user_feeds:
            feed_articles = self.db.get_feed_entries(feed_id, limit=self.max_articles)
            articles.extend([a for a in feed_articles if self._ensure_utc(a.pub_date) >= since])

        # Sort by pub_date (most recent first)
        articles.sort(key=lambda a: a.pub_date, reverse=True)
        articles = articles[: self.max_articles]

        if not articles:
            logger.debug(f"No articles for digest {digest.id}, skipping")
            return 0

        # Generate email HTML
        html_content = self._generate_html(digest, articles)

        # Send email
        msg = MIMEMultipart("alternative")
        msg["Subject"] = (
            f"AI Web Feeds Digest - {ensure_utc(datetime.now(UTC)).strftime('%Y-%m-%d')}"
        )
        msg["From"] = self.smtp_from
        msg["To"] = digest.email
        msg.attach(MIMEText(html_content, "html"))

        with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
            if self.smtp_user and self.smtp_password:
                server.starttls()
                server.login(self.smtp_user, self.smtp_password)
            server.send_message(msg)

        logger.info(f"Sent digest {digest.id} with {len(articles)} articles to {digest.email}")
        return len(articles)

    def _generate_html(self, _digest: EmailDigest, articles: list[FeedEntry]) -> str:
        """Generate HTML email content.

        Args:
            _digest: EmailDigest instance
            articles: List of FeedEntry objects

        Returns:
            HTML email string
        """
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
            <p>Here are the latest {len(articles)} articles from your followed feeds:</p>
        """

        for article in articles:
            safe_title = escape(article.title)
            safe_summary = escape(article.summary or "")
            safe_author = escape(article.author or "Unknown")
            safe_pub_date = ensure_utc(article.pub_date).strftime("%Y-%m-%d %H:%M")
            safe_link = self._sanitize_link(article.link)
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

    def _calculate_next_send(self, digest: EmailDigest, from_time: datetime) -> datetime:
        """Calculate next send time from cron expression.

        Args:
            digest: Digest subscription
            from_time: Reference time

        Returns:
            Next scheduled send time
        """
        reference_time = self._ensure_utc(from_time)
        cron = croniter(cron_expr, reference_time)
        next_dt = cron.get_next(datetime)
        next_send = self._ensure_utc(next_dt)
        if from_time.tzinfo is None:
            return next_send.replace(tzinfo=None)
        return next_send
