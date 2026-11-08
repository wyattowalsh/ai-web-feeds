"""ai_web_feeds.enrich_pkg.engine -- Advanced feed enrichment engine."""

from collections import Counter
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urlparse

from bs4 import BeautifulSoup
from loguru import logger
from tenacity import retry, stop_after_attempt, wait_exponential

from ai_web_feeds.enrich_pkg.result import FeedEnrichment
from ai_web_feeds.enrich_pkg.runtime import lookup
from ai_web_feeds.models import FeedFormat


class AdvancedEnricher:
    """Advanced feed enrichment engine."""

    def __init__(
        self,
        timeout: float = 30.0,
        user_agent: str | None = None,
    ):
        """Initialize enricher.

        Args:
            timeout: Request timeout in seconds
            user_agent: Custom user agent string
        """
        self.timeout = timeout
        self.user_agent = user_agent or (
            "AI-Web-Feeds-Enricher/2.0 (+https://github.com/wyattowalsh/ai-web-feeds)"
        )

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
    )
    async def enrich_from_url(self, url: str, url_type: str = "feed") -> FeedEnrichment:
        """Enrich feed data from URL.

        Args:
            url: Feed or site URL
            url_type: Type of URL ('feed' or 'site')

        Returns:
            FeedEnrichment with extracted data
        """
        enrichment = FeedEnrichment()

        # Detect platform
        platform = lookup("detect_platform")(url)
        if platform:
            enrichment.platform = platform

        if url_type == "feed":
            await self._enrich_from_feed(url, enrichment)
        else:
            await self._enrich_from_site(url, enrichment)

        # Calculate scores
        enrichment.quality_score = self._calculate_quality_score(enrichment)
        enrichment.health_score = self._calculate_health_score(enrichment)
        enrichment.completeness_score = self._calculate_completeness_score(enrichment)

        return enrichment

    async def _enrich_from_feed(self, feed_url: str, enrichment: FeedEnrichment) -> None:
        """Enrich from feed URL."""
        try:
            start_time = datetime.now(UTC)

            client_factory = lookup("httpx").AsyncClient
            async with client_factory(timeout=self.timeout, follow_redirects=True) as client:
                response = await client.get(feed_url)

                # Performance metrics
                elapsed = (datetime.now(UTC) - start_time).total_seconds()
                enrichment.response_time_ms = elapsed * 1000

                if response.status_code == 200:
                    enrichment.availability_score = 1.0
                else:
                    enrichment.availability_score = 0.0
                    return

                # Detect format
                feed_format = await lookup("detect_feed_format")(feed_url)
                if feed_format:
                    enrichment.format = FeedFormat(feed_format)

                # Parse feed
                feed = lookup("feedparser").parse(response.content)

                # Extract basic metadata
                if feed.feed:
                    feed_meta = feed.feed
                    enrichment.title = feed_meta.get("title")
                    enrichment.description = feed_meta.get("description") or feed_meta.get(
                        "subtitle"
                    )
                    enrichment.language = feed_meta.get("language")
                    enrichment.author = feed_meta.get("author")

                    # Extract images
                    if image := feed_meta.get("image"):
                        if isinstance(image, dict):
                            enrichment.image_url = image.get("href") or image.get("url")
                        else:
                            enrichment.image_url = str(image)

                    if logo := feed_meta.get("logo"):
                        enrichment.logo_url = logo

                    if icon := feed_meta.get("icon"):
                        enrichment.icon_url = icon

                # Analyze entries
                entries = feed.entries
                enrichment.entry_count = len(entries)

                if entries:
                    # Content analysis
                    content_lengths = []
                    has_full = []
                    content_types = set()

                    for entry in entries:
                        content = entry.get("content")
                        summary = entry.get("summary")

                        if content:
                            if isinstance(content, list):
                                content_text = content[0].get("value", "")
                            else:
                                content_text = str(content)
                            content_lengths.append(len(content_text))
                            has_full.append(len(content_text) > 500)
                        elif summary:
                            content_lengths.append(len(summary))
                            has_full.append(False)

                        # Check for media
                        if entry.get("media_content") or entry.get("enclosures"):
                            content_types.add("media")

                        if entry.get("links"):
                            for link in entry.get("links", []):
                                if link.get("type", "").startswith("image/"):
                                    content_types.add("image")
                                elif link.get("type", "").startswith("video/"):
                                    content_types.add("video")
                                elif link.get("type", "").startswith("audio/"):
                                    content_types.add("audio")

                    if content_lengths:
                        enrichment.avg_content_length = sum(content_lengths) / len(content_lengths)

                    if has_full:
                        enrichment.has_full_content = sum(has_full) / len(has_full) > 0.5

                    enrichment.content_types = list(content_types)

                    # Update frequency analysis
                    await self._analyze_update_frequency(entries, enrichment)

                    # TopicNode suggestion
                    await self._suggest_topics(entries, enrichment)

                # Check for extensions
                namespaces = feed.namespaces
                enrichment.has_itunes = "itunes" in namespaces
                enrichment.has_media_rss = "media" in namespaces
                enrichment.has_dublin_core = "dc" in namespaces

        except Exception as e:
            logger.error(f"Error enriching from feed {feed_url}: {e}")
            enrichment.availability_score = 0.0

    async def _enrich_from_site(self, site_url: str, enrichment: FeedEnrichment) -> None:
        """Enrich from website URL."""
        try:
            client_factory = lookup("httpx").AsyncClient
            async with client_factory(timeout=self.timeout, follow_redirects=True) as client:
                response = await client.get(site_url)

                if response.status_code != 200:
                    return

                # Parse HTML
                soup = BeautifulSoup(response.text, "html.parser")

                # Extract metadata
                enrichment.title = self._extract_site_title(soup)
                enrichment.description = self._extract_site_description(soup)
                enrichment.language = self._extract_site_language(soup)

                # Extract images
                enrichment.icon_url = self._extract_favicon(soup, site_url)
                enrichment.logo_url = self._extract_logo(soup)

        except Exception as e:
            logger.error(f"Error enriching from site {site_url}: {e}")

    def _extract_site_title(self, soup: BeautifulSoup) -> str | None:
        """Extract title from HTML."""
        og_title = soup.find("meta", property="og:title")
        if og_title and og_title.get("content"):
            return og_title.get("content")

        twitter_title = soup.find("meta", attrs={"name": "twitter:title"})
        if twitter_title and twitter_title.get("content"):
            return twitter_title.get("content")

        if title := soup.find("title"):
            return title.get_text(strip=True)

        return None

    def _extract_site_description(self, soup: BeautifulSoup) -> str | None:
        """Extract description from HTML."""
        og_desc = soup.find("meta", property="og:description")
        if og_desc and og_desc.get("content"):
            return og_desc.get("content")

        meta_desc = soup.find("meta", attrs={"name": "description"})
        if meta_desc and meta_desc.get("content"):
            return meta_desc.get("content")

        return None

    def _extract_site_language(self, soup: BeautifulSoup) -> str | None:
        """Extract language from HTML."""
        html = soup.find("html")
        if html and html.get("lang"):
            return html.get("lang")

        meta_lang = soup.find("meta", attrs={"http-equiv": "content-language"})
        if meta_lang and meta_lang.get("content"):
            return meta_lang.get("content")

        return None

    def _extract_favicon(self, soup: BeautifulSoup, base_url: str) -> str | None:
        """Extract favicon URL."""
        for rel in ["icon", "shortcut icon", "apple-touch-icon"]:
            icon = soup.find("link", rel=rel)
            if icon and icon.get("href"):
                href = icon.get("href")
                if href.startswith("http"):
                    return href
                parsed = urlparse(base_url)
                return f"{parsed.scheme}://{parsed.netloc}/{href.lstrip('/')}"

        parsed = urlparse(base_url)
        return f"{parsed.scheme}://{parsed.netloc}/favicon.ico"

    def _extract_logo(self, soup: BeautifulSoup) -> str | None:
        """Extract logo URL."""
        og_image = soup.find("meta", property="og:image")
        if og_image and og_image.get("content"):
            return og_image.get("content")

        return None

    async def _analyze_update_frequency(
        self, entries: list[Any], enrichment: FeedEnrichment
    ) -> None:
        """Analyze update frequency from entries."""
        if not entries:
            return

        dates = []
        for entry in entries:
            date_tuple = entry.get("published_parsed") or entry.get("updated_parsed")
            if date_tuple:
                from time import mktime

                timestamp = mktime(date_tuple)
                dates.append(datetime.fromtimestamp(timestamp, tz=UTC))

        if not dates:
            return

        dates.sort(reverse=True)
        enrichment.last_updated = dates[0]

        if len(dates) > 1:
            intervals = []
            for i in range(len(dates) - 1):
                interval = (dates[i] - dates[i + 1]).days
                if interval > 0:
                    intervals.append(interval)

            if intervals:
                avg_interval = sum(intervals) / len(intervals)

                if avg_interval < 1:
                    enrichment.estimated_frequency = "multiple_daily"
                elif avg_interval < 2:
                    enrichment.estimated_frequency = "daily"
                elif avg_interval < 7:
                    enrichment.estimated_frequency = "weekly"
                elif avg_interval < 14:
                    enrichment.estimated_frequency = "biweekly"
                elif avg_interval < 31:
                    enrichment.estimated_frequency = "monthly"
                else:
                    enrichment.estimated_frequency = "infrequent"

                variance = sum((i - avg_interval) ** 2 for i in intervals) / len(intervals)
                enrichment.update_regularity = max(0.0, 1.0 - (variance / (avg_interval + 1)))

    async def _suggest_topics(self, entries: list[Any], enrichment: FeedEnrichment) -> None:
        """Suggest topics based on content analysis."""
        topic_keywords = {
            "machine-learning": [
                "machine learning",
                "ml",
                "neural network",
                "deep learning",
                "model training",
            ],
            "nlp": [
                "nlp",
                "natural language",
                "language model",
                "llm",
                "gpt",
                "bert",
                "transformer",
            ],
            "computer-vision": [
                "computer vision",
                "image recognition",
                "object detection",
                "cv",
                "gan",
            ],
            "data-science": [
                "data science",
                "analytics",
                "statistics",
                "visualization",
                "pandas",
            ],
            "ai-ethics": [
                "ai ethics",
                "bias",
                "fairness",
                "responsible ai",
                "ai safety",
            ],
            "robotics": ["robotics", "robot", "autonomous", "automation"],
            "python": ["python", "pytorch", "tensorflow", "scikit"],
            "research": ["research", "paper", "arxiv", "journal", "study"],
        }

        topic_scores = Counter()

        for entry in entries[:20]:
            text = ""
            if title := entry.get("title"):
                text += title.lower() + " "
            if summary := entry.get("summary"):
                text += summary.lower() + " "

            for topic, keywords in topic_keywords.items():
                score = sum(text.count(kw.lower()) for kw in keywords)
                if score > 0:
                    topic_scores[topic] += score

        if topic_scores:
            total_score = sum(topic_scores.values())
            for topic, score in topic_scores.most_common(5):
                confidence = min(1.0, score / (total_score * 0.2))
                if confidence > 0.3:
                    enrichment.suggested_topics.append(topic)
                    enrichment.topic_confidence[topic] = confidence

    def _calculate_quality_score(self, enrichment: FeedEnrichment) -> float:
        """Calculate overall quality score."""
        score = 0.0

        if enrichment.title:
            score += 0.15
        if enrichment.description:
            score += 0.10
        if enrichment.entry_count > 0:
            score += 0.20
            if enrichment.entry_count >= 10:
                score += 0.05
        if enrichment.has_full_content:
            score += 0.15
        if enrichment.estimated_frequency:
            if enrichment.estimated_frequency in ["daily", "multiple_daily"]:
                score += 0.15
            elif enrichment.estimated_frequency in ["weekly", "biweekly"]:
                score += 0.10
            else:
                score += 0.05
        score += enrichment.update_regularity * 0.10
        if enrichment.icon_url or enrichment.logo_url:
            score += 0.05
        if enrichment.availability_score >= 1.0:
            score += 0.10
        elif enrichment.availability_score >= 0.5:
            score += 0.05

        return min(1.0, score)

    def _calculate_health_score(self, enrichment: FeedEnrichment) -> float:
        """Calculate health score based on availability and freshness."""
        score = 0.0

        score += enrichment.availability_score * 0.40

        if enrichment.last_updated:
            days_old = (datetime.now(UTC) - enrichment.last_updated).days
            if days_old <= 7:
                score += 0.40
            elif days_old <= 30:
                score += 0.30
            elif days_old <= 90:
                score += 0.20
            elif days_old <= 365:
                score += 0.10

        if enrichment.response_time_ms < 1000:
            score += 0.20
        elif enrichment.response_time_ms < 3000:
            score += 0.15
        elif enrichment.response_time_ms < 5000:
            score += 0.10
        elif enrichment.response_time_ms < 10000:
            score += 0.05

        return min(1.0, score)

    def _calculate_completeness_score(self, enrichment: FeedEnrichment) -> float:
        """Calculate metadata completeness score."""
        total_fields = 10
        filled_fields = 0

        if enrichment.title:
            filled_fields += 1
        if enrichment.description:
            filled_fields += 1
        if enrichment.language:
            filled_fields += 1
        if enrichment.author:
            filled_fields += 1
        if enrichment.format:
            filled_fields += 1
        if enrichment.icon_url or enrichment.logo_url:
            filled_fields += 1
        if enrichment.entry_count > 0:
            filled_fields += 1
        if enrichment.estimated_frequency:
            filled_fields += 1
        if enrichment.last_updated:
            filled_fields += 1
        if enrichment.content_types:
            filled_fields += 1

        return filled_fields / total_fields
