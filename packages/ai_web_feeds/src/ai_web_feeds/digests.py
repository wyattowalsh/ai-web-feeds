"""ai_web_feeds.digests -- Email digest generation and delivery

This module handles email digest subscriptions, content generation, and SMTP delivery.
"""

import smtplib
from datetime import datetime, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any

from croniter import croniter
from loguru import logger

from ai_web_feeds.config import Settings
from ai_web_feeds.models import EmailDigest, FeedEntry
from ai_web_feeds.storage import DatabaseManager


class DigestManager:
    """Manage email digest subscriptions and delivery."""

    def __init__(
        self,
        db: DatabaseManager,
        settings: Settings,
    ):
        """Initialize digest manager.

        Args:
            db: Database manager instance
            settings: Application settings
        """
        self.db            = db
        self.settings      = settings
        self.smtp_host     = settings.phase3b.smtp_host
        self.smtp_port     = settings.phase3b.smtp_port
        self.smtp_user     = settings.phase3b.smtp_user
        self.smtp_password = settings.phase3b.smtp_password
        self.smtp_from     = settings.phase3b.smtp_from
        self.max_articles  = settings.phase3b.digest_max_articles

    async def send_due_digests(self) -> int:
        """Send all digests due for delivery.

        Returns:
            Number of digests sent
        """
        now       = datetime.utcnow()
        due_digests = self.db.get_due_digests(now)

        sent_count = 0
        for digest in due_digests:
            try:
                await self._send_digest(digest)
                sent_count += 1

                # Update digest schedule
                digest.last_sent_at = now
                digest.next_send_at = self._calculate_next_send(
                    digest.schedule_cron, now
                )
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
        # Get user's followed feeds
        user_feeds = self.db.get_user_follows(digest.user_id)

        # Get recent articles from followed feeds
        since      = digest.last_sent_at or (datetime.utcnow() - timedelta(days=1))
        articles   = []
        for feed_id in user_feeds:
            feed_articles = self.db.get_feed_entries(
                feed_id, limit=self.max_articles
            )
            articles.extend([a for a in feed_articles if a.pub_date >= since])

        # Sort by pub_date (most recent first)
        articles.sort(key=lambda a: a.pub_date, reverse=True)
        articles = articles[: self.max_articles]

        if not articles:
            logger.debug(f"No articles for digest {digest.id}, skipping")
            return

        # Generate email HTML
        html_content = self._generate_html(digest, articles)

        # Send email
        msg                    = MIMEMultipart("alternative")
        msg["Subject"]         = f"AI Web Feeds Digest - {datetime.now().strftime('%Y-%m-%d')}"
        msg["From"]            = self.smtp_from
        msg["To"]              = digest.email
        msg.attach(MIMEText(html_content, "html"))

        with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
            if self.smtp_user and self.smtp_password:
                server.starttls()
                server.login(self.smtp_user, self.smtp_password)
            server.send_message(msg)

        # Update stats
        digest.article_count += len(articles)

        logger.info(f"Sent digest {digest.id} with {len(articles)} articles to {digest.email}")

    def _generate_html(
        self, digest: EmailDigest, articles: list[FeedEntry]
    ) -> str:
        """Generate HTML email content.

        Args:
            digest: EmailDigest instance
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
            html += f"""
            <div class="article">
                <div class="article-title">
                    <a href="{article.link}">{article.title}</a>
                </div>
                <div class="article-meta">
                    {article.pub_date.strftime('%Y-%m-%d %H:%M')} | {article.author or 'Unknown'}
                </div>
                <div class="article-summary">
                    {article.summary or ''}
                </div>
            </div>
            """

        html += """
            <p style="margin-top: 30px; color: #666; font-size: 12px;">
                <a href="https://aiwebfeeds.com/settings/digests">Manage your digest preferences</a>
            </p>
        </body>
        </html>
        """

        return html

    def _calculate_next_send(self, cron_expr: str, from_time: datetime) -> datetime:
        """Calculate next send time from cron expression.

        Args:
            cron_expr: Cron expression (e.g., "0 9 * * *")
            from_time: Reference time

        Returns:
            Next scheduled send time
        """
        cron    = croniter(cron_expr, from_time)
        next_dt = cron.get_next(datetime)
        return next_dt

