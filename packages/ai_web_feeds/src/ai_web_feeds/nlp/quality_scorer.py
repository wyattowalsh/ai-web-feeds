"""Quality scoring for articles using heuristic-based metrics (Phase 5A)."""

import re

from loguru import logger
from pydantic import BaseModel, Field

from ai_web_feeds.config import Settings


class QualityScoreComponents(BaseModel):
    """Individual quality score components."""

    depth_score: int = Field(ge=0, le=100, description="Content depth score")
    reference_score: int = Field(ge=0, le=100, description="External references score")
    author_score: int = Field(ge=0, le=100, description="Author authority score")
    domain_score: int = Field(ge=0, le=100, description="Domain reputation score")
    engagement_score: int = Field(ge=0, le=100, description="Engagement metrics score")
    overall_score: int = Field(ge=0, le=100, description="Weighted overall score")


class QualityScorer:
    """Compute heuristic-based quality scores for articles.

    Evaluates article quality across multiple dimensions:
    - Content depth (word count, structure, complexity)
    - References (external links, citations)
    - Author authority (credentials, bio)
    - Domain reputation (feed quality score)
    - Engagement (estimated read time, sharing)

    All scores are normalized to 0-100 scale.
    """

    # Scoring weights for overall score calculation
    WEIGHTS = {
        "depth": 0.35,  # Content depth is most important
        "reference": 0.20,  # Citations matter
        "author": 0.15,  # Author credentials
        "domain": 0.20,  # Feed reputation
        "engagement": 0.10,  # User engagement
    }

    def __init__(self, settings: Settings | None = None):
        """Initialize quality scorer with configuration."""
        self.settings = settings or Settings()
        self.config = self.settings.phase5
        self.min_words = self.config.quality_min_words

    def score_article(
        self, article: dict, feed: dict | None = None
    ) -> QualityScoreComponents | None:
        """Compute quality scores for an article.

        Args:
            article: Article dict with keys: content, summary, author, url, title
            feed: Optional feed dict with reputation metrics

        Returns:
            QualityScoreComponents with all scores, or None if article too short
        """
        try:
            # Extract text content
            content = self._get_content(article)
            word_count = len(content.split())

            # Skip if article is too short
            if word_count < self.min_words:
                logger.debug(
                    f"Article too short ({word_count} words < {self.min_words}), skipping quality scoring"
                )
                return None

            # Compute component scores
            depth_score = self._score_depth(content, word_count)
            reference_score = self._score_references(content, article.get("url", ""))
            author_score = self._score_author(article.get("author"), article.get("author_detail"))
            domain_score = self._score_domain(feed)
            engagement_score = self._score_engagement(word_count, article)

            # Calculate weighted overall score
            overall_score = int(
                self.WEIGHTS["depth"] * depth_score
                + self.WEIGHTS["reference"] * reference_score
                + self.WEIGHTS["author"] * author_score
                + self.WEIGHTS["domain"] * domain_score
                + self.WEIGHTS["engagement"] * engagement_score
            )

            return QualityScoreComponents(
                depth_score=depth_score,
                reference_score=reference_score,
                author_score=author_score,
                domain_score=domain_score,
                engagement_score=engagement_score,
                overall_score=overall_score,
            )

        except Exception as e:
            logger.error(f"Failed to score article: {e}")
            return None

    def _get_content(self, article: dict) -> str:
        """Extract text content from article."""
        content = article.get("content", "") or article.get("summary", "") or ""
        if isinstance(content, list):
            content = " ".join(item.get("value", "") for item in content if isinstance(item, dict))
        return content

    def _score_depth(self, content: str, word_count: int) -> int:
        """Score content depth based on length, structure, and complexity.

        Metrics:
        - Word count (50 pts): 0-500 words linear scale
        - Paragraph structure (25 pts): Multiple paragraphs indicate depth
        - Link density (25 pts): Code snippets, formulas, technical content
        """
        # Word count score (0-50)
        word_score = min(50, int((word_count / 500) * 50))

        # Paragraph structure (0-25)
        paragraphs = content.split("\n\n")
        para_score = min(25, len(paragraphs) * 5)

        # Technical content indicators (0-25)
        tech_indicators = [
            r"```",  # Code blocks
            r"\$.*\$",  # LaTeX math
            r"http[s]?://",  # URLs
            r"\b[A-Z]{2,}\b",  # Acronyms
        ]
        tech_score = 0
        for pattern in tech_indicators:
            if re.search(pattern, content):
                tech_score += 6
        tech_score = min(25, tech_score)

        return min(100, word_score + para_score + tech_score)

    def _score_references(self, content: str, article_url: str) -> int:
        """Score external references and citations.

        Metrics:
        - External link count (70 pts): More links = better research
        - Citation quality (30 pts): Academic/GitHub/ArXiv links valued higher
        """
        # Extract all URLs from content
        urls = re.findall(
            r"http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+",
            content,
        )

        # Filter out self-references
        domain = article_url.split("/")[2] if "/" in article_url else ""
        external_urls = [url for url in urls if domain not in url]

        # Link count score (0-70)
        link_score = min(70, len(external_urls) * 10)

        # Citation quality score (0-30)
        quality_domains = [
            "arxiv.org",
            "github.com",
            "scholar.google",
            "doi.org",
            "papers.nips.cc",
            "openreview.net",
        ]
        quality_count = sum(
            1 for url in external_urls if any(domain in url for domain in quality_domains)
        )
        quality_score = min(30, quality_count * 10)

        return min(100, link_score + quality_score)

    def _score_author(self, author: str | None, author_detail: dict | None) -> int:
        """Score author authority and credentials.

        Metrics:
        - Author identified (40 pts): Author name present
        - Credentials/Bio (30 pts): Bio or affiliation present
        - Contact info (30 pts): Email, website, social media
        """
        if not author:
            return 0

        score = 40  # Author name present

        if author_detail:
            if author_detail.get("bio"):
                score += 30
            if author_detail.get("email") or author_detail.get("href"):
                score += 30

        return min(100, score)

    def _score_domain(self, feed: dict | None) -> int:
        """Score feed/domain reputation.

        Metrics:
        - Feed has quality score (from Phase 2 analytics)
        - Defaults to 50 if no feed data available
        """
        if not feed:
            return 50  # Neutral default

        # Use existing feed quality metrics if available
        return feed.get("quality_score", 50)

    def _score_engagement(self, word_count: int, article: dict) -> int:
        """Score engagement potential based on read time and sharing.

        Metrics:
        - Estimated read time (50 pts): 5-15 min ideal (not too short, not too long)
        - Sharing metadata (50 pts): Social share counts, comments
        """
        # Read time score (0-50)
        # Assume 200 words per minute reading speed
        read_minutes = word_count / 200
        if 5 <= read_minutes <= 15:
            read_score = 50  # Ideal range
        elif read_minutes < 5:
            read_score = int((read_minutes / 5) * 50)
        else:
            read_score = int(50 * (1 - min(1, (read_minutes - 15) / 30)))  # Decay after 15 min

        # Sharing score (0-50)
        # This would come from social APIs or feed metadata
        share_count = article.get("share_count", 0)
        share_score = min(50, share_count)

        return min(100, read_score + share_score)
