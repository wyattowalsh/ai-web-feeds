"""Topic modeling using LDA/BERTopic (Phase 5D)."""

import re

from gensim import corpora, models
from gensim.models import CoherenceModel
from loguru import logger
from pydantic import BaseModel, Field

from ai_web_feeds.config import Settings
from ai_web_feeds.nlp.content import extract_article_text


class DiscoveredSubtopic(BaseModel):
    """A discovered subtopic from topic modeling."""

    name: str = Field(description="Generated subtopic name")
    keywords: list[str] = Field(description="Representative keywords")
    coherence_score: float = Field(ge=0.0, le=1.0, description="Topic coherence score")
    article_count: int = Field(ge=0, description="Number of articles in this subtopic")


class TopicModeler:
    """Discover subtopics and track evolution using LDA/BERTopic."""

    STOPWORDS: ClassVar[set[str]] = {
        "the",
        "a",
        "an",
        "and",
        "or",
        "but",
        "in",
        "on",
        "at",
        "to",
        "for",
        "of",
        "with",
        "by",
        "from",
        "as",
        "is",
        "was",
        "are",
        "were",
        "be",
        "been",
        "being",
        "have",
        "has",
        "had",
        "do",
        "does",
        "did",
        "will",
        "would",
        "could",
        "should",
        "may",
        "might",
        "can",
        "this",
        "that",
        "these",
        "those",
        "i",
        "you",
        "he",
        "she",
        "it",
        "we",
        "they",
    }

    def __init__(self, settings: Settings | None = None):
        """Initialize topic modeler."""
        self.settings = settings or Settings()
        self.config = self.settings.phase5
        self.topic_model_type = self.config.topic_model
        self.min_coherence = self.config.topic_coherence_min

    def extract_subtopics(
        self,
        parent_topic: str,
        articles: list[dict],
        num_topics: int = 5,
        min_articles: int = 3,
    ) -> list[DiscoveredSubtopic]:
        """Legacy wrapper for subtopic discovery with test-friendly defaults."""
        return self.discover_subtopics(
            parent_topic,
            articles,
            num_topics=num_topics,
            min_articles=min_articles,
        )

    def discover_subtopics(
        self,
        topic: str,
        articles: list[dict],
        num_topics: int = 5,
        min_articles: int = 10,
    ) -> list[DiscoveredSubtopic]:
        """Discover subtopics for a given parent topic using LDA."""
        if len(articles) < min_articles:
            logger.warning(
                f"Insufficient articles for topic modeling: {len(articles)} < {min_articles}"
            )
            return []

        try:
            logger.info(
                f"Discovering {num_topics} subtopics for '{topic}' from {len(articles)} articles"
            )

            texts = self._preprocess_articles(articles)
            if not texts:
                logger.warning("No text content after preprocessing")
                return []

            dictionary = corpora.Dictionary(texts)
            dictionary.filter_extremes(no_below=2, no_above=0.5, keep_n=1000)
            corpus = [dictionary.doc2bow(text) for text in texts]
            if not corpus:
                logger.warning("Empty corpus after preprocessing")
                return []

            # Train LDA model
            lda_model = models.LdaModel(
                corpus=corpus,
                id2word=dictionary,
                num_topics=num_topics,
                random_state=42,
                passes=10,
                alpha="auto",
                per_word_topics=True,
            )
            coherence = self._compute_coherence(lda_model, dictionary, texts)

            subtopics: list[DiscoveredSubtopic] = []
            for topic_id in range(num_topics):
                topic_words = lda_model.show_topic(topic_id, topn=10)
                keywords = [word for word, _prob in topic_words]
                subtopic_name = self._generate_subtopic_name(keywords, topic)

                coherence = self._compute_coherence(lda_model, dictionary, texts)

                if coherence >= self.min_coherence:
                    subtopics.append(
                        DiscoveredSubtopic(
                            name=subtopic_name,
                            keywords=keywords,
                            coherence_score=coherence,
                            article_count=article_count,
                        )
                    )

            logger.info(f"Discovered {len(subtopics)} subtopics for '{topic}'")
            return subtopics

        except Exception as e:
            logger.error(f"Failed to discover subtopics for '{topic}': {e}")
            return []

    def detect_evolution(
        self,
        current_topics: list[dict | DiscoveredSubtopic],
        previous_topics: list[dict | DiscoveredSubtopic] | None = None,
        threshold: float = 0.5,
    ) -> list[dict[str, Any]]:
        """Legacy evolution detector used by the unit tests."""
        previous = [self._topic_payload(topic) for topic in (previous_topics or [])]
        current = [self._topic_payload(topic) for topic in current_topics]
        events: list[dict[str, Any]] = []

        if not previous:
            for topic in current:
                events.append(
                    {
                        "type": "emergence",
                        "topic": topic["name"],
                        "keywords": topic["keywords"],
                        "article_count": topic["article_count"],
                    }
                )
            return events

        matched_previous: set[str] = set()
        for topic in current:
            previous_match = next(
                (
                    candidate
                    for candidate in previous
                    if self._topics_match(topic, candidate, threshold)
                ),
                None,
            )
            if previous_match is None:
                events.append(
                    {
                        "type": "emergence",
                        "topic": topic["name"],
                        "keywords": topic["keywords"],
                        "article_count": topic["article_count"],
                    }
                )
                continue

            matched_previous.add(previous_match["name"])
            growth_rate = self._compute_growth_rate(
                topic["article_count"],
                previous_match["article_count"],
            )
            if growth_rate <= -0.5:
                events.append(
                    {
                        "type": "decline",
                        "topic": topic["name"],
                        "growth_rate": growth_rate,
                        "article_count": topic["article_count"],
                    }
                )

        for topic in previous:
            if topic["name"] not in matched_previous and not any(
                self._topics_match(topic, current_topic, threshold) for current_topic in current
            ):
                events.append(
                    {
                        "type": "decline",
                        "topic": topic["name"],
                        "article_count": topic["article_count"],
                    }
                )

        return events

    def track_evolution(
        self,
        topic: str,
        historical_articles: dict[str, list[dict]],
        threshold: float = 0.5,
    ) -> list[dict]:
        """Track topic evolution events over time."""
        try:
            events = []
            prev_subtopics = None

            for period in sorted(historical_articles.keys()):
                articles = historical_articles[period]
                current_subtopics = self.discover_subtopics(topic, articles)

                if prev_subtopics is not None:
                    period_events = self._detect_evolution_events(
                        topic,
                        prev_subtopics,
                        current_subtopics,
                        period,
                        threshold,
                    )
                    events.extend(period_events)

                prev_subtopics = current_subtopics

            logger.info(f"Detected {len(events)} evolution events for '{topic}'")
            return events

        except Exception as e:
            logger.error(f"Failed to track evolution for '{topic}': {e}")
            return []

    def _preprocess_text(self, text: str) -> list[str]:
        """Normalize text into token lists for topic modeling."""
        if not text:
            return []

        tokens = re.findall(r"\b\w+\b", text.lower(), flags=re.UNICODE)
        return [
            token
            for token in tokens
            if token.isalpha() and len(token) >= 3 and token not in self.STOPWORDS
        ]

    def _preprocess_articles(self, articles: list[dict]) -> list[list[str]]:
        """Preprocess articles for topic modeling.

        Performs:
        - Text extraction
        - Tokenization
        - Stopword removal
        - Basic normalization

        Args:
            articles: List of article dicts

        Returns:
            List of tokenized and preprocessed text lists
        """
        # Simple stopwords list (should use nltk.corpus.stopwords in production)
        stopwords = {
            "the",
            "a",
            "an",
            "and",
            "or",
            "but",
            "in",
            "on",
            "at",
            "to",
            "for",
            "of",
            "with",
            "by",
            "from",
            "as",
            "is",
            "was",
            "are",
            "were",
            "be",
            "been",
            "being",
            "have",
            "has",
            "had",
            "do",
            "does",
            "did",
            "will",
            "would",
            "could",
            "should",
            "may",
            "might",
            "can",
            "this",
            "that",
            "these",
            "those",
            "i",
            "you",
            "he",
            "she",
            "it",
            "we",
            "they",
        }

        texts = []
        for article in articles:
            # Extract content
            content = ""
            if article.get("title"):
                content += article["title"] + " "
            if article.get("summary"):
                content += article["summary"] + " "
            if article.get("content"):
                content_data = article["content"]
                if isinstance(content_data, list):
                    content += " ".join(
                        item.get("value", "") for item in content_data if isinstance(item, dict)
                    )
                else:
                    content += str(content_data)

            if not content:
                continue

            tokens = self._preprocess_text(content, stopwords)

            if tokens:
                texts.append(tokens)

        return texts

    def _preprocess_text(self, text: str, stopwords: set[str] | None = None) -> list[str]:
        """Preprocess a single text block into topic-model tokens."""

        if not text:
            return []

        if stopwords is None:
            stopwords = {
                "the",
                "a",
                "an",
                "and",
                "or",
                "but",
                "in",
                "on",
                "at",
                "to",
                "for",
                "of",
                "with",
                "by",
                "from",
                "as",
                "is",
                "was",
                "are",
                "were",
                "be",
                "been",
                "being",
                "have",
                "has",
                "had",
                "do",
                "does",
                "did",
                "will",
                "would",
                "could",
                "should",
                "may",
                "might",
                "can",
                "this",
                "that",
                "these",
                "those",
                "i",
                "you",
                "he",
                "she",
                "it",
                "we",
                "they",
            }

        tokens = re.findall(r"\b[a-z]{3,}\b", text.lower())
        return [token for token in tokens if token not in stopwords]

    def _generate_subtopic_name(self, keywords: list[str], parent_topic: str | None = None) -> str:
        """Generate a human-readable subtopic name from keywords.

        name = " & ".join(keyword.capitalize() for keyword in keywords[:3])
        if parent_topic:
            return f"{parent_topic}: {name}"
        return name

        Returns:
            Generated subtopic name
        """
        # Take top 3 keywords and capitalize
        top_keywords = keywords[:3]
        name = " & ".join([k.capitalize() for k in top_keywords])
        if parent_topic:
            return f"{parent_topic}: {name}"
        return name

    def _generate_subtopic_description(self, parent_topic: str, keywords: list[str]) -> str:
        """Generate a short description for a discovered subtopic."""

        if not keywords:
            return f"Subtopic within {parent_topic}."
        return f"{parent_topic} coverage centered on {', '.join(keywords[:3])} and related themes."

    def _compute_coherence(
        self,
        lda_model,
        dictionary,
        texts: list[list[str]],
    ) -> float:
        """Compute topic coherence for an LDA model."""

        coherence_model = CoherenceModel(
            model=lda_model,
            texts=texts,
            dictionary=dictionary,
            coherence="c_v",
        )
        return float(coherence_model.get_coherence())

    def _detect_evolution_events(
        self,
        topic: str,
        prev_subtopics: list[DiscoveredSubtopic],
        current_subtopics: list[DiscoveredSubtopic],
        period: str,
        threshold: float,
    ) -> list[dict]:
        """Detect evolution events between two time periods."""
        events = []

        for current in current_subtopics:
            is_new = True
            for prev in prev_subtopics:
                if self._subtopics_similar(current, prev, threshold):
                    is_new = False
                    break

            if is_new:
                events.append(
                    {
                        "event_type": "emergence",
                        "source_topic": topic,
                        "target_topics": [current.name],
                        "article_count": current.article_count,
                        "detected_at": period,
                    }
                )

        for prev in prev_subtopics:
            is_gone = True
            for current in current_subtopics:
                if self._subtopics_similar(prev, current, threshold):
                    is_gone = False
                    break

            if is_gone:
                events.append(
                    {
                        "event_type": "decline",
                        "source_topic": prev.name,
                        "target_topics": None,
                        "article_count": prev.article_count,
                        "detected_at": period,
                    }
                )

        return events

    def _subtopics_similar(
        self,
        subtopic1: DiscoveredSubtopic,
        subtopic2: DiscoveredSubtopic,
        threshold: float,
    ) -> bool:
        """Check if two subtopics are similar based on keyword overlap."""
        keywords1 = set(subtopic1.keywords[:5])
        keywords2 = set(subtopic2.keywords[:5])
        if not keywords1 or not keywords2:
            return False

        intersection = len(keywords1 & keywords2)
        union = len(keywords1 | keywords2)
        similarity = intersection / union if union > 0 else 0
        return similarity >= threshold

    def extract_subtopics(
        self,
        parent_topic: str,
        articles: list[dict],
        num_topics: int = 5,
        min_articles: int = 10,
    ) -> list[DiscoveredSubtopic]:
        """Compatibility wrapper for the older extract_subtopics API."""

        return self.discover_subtopics(
            topic=parent_topic,
            articles=articles,
            num_topics=num_topics,
            min_articles=min_articles,
        )

    def detect_evolution(
        self,
        current_topics: list[dict],
        previous_topics: list[dict],
        threshold: float = 0.5,
    ) -> list[dict]:
        """Compatibility wrapper for direct topic-to-topic evolution checks."""

        previous = [
            DiscoveredSubtopic(
                name=topic["name"],
                keywords=topic.get("keywords", []),
                coherence_score=topic.get("coherence_score", 1.0),
                article_count=topic.get("article_count", 0),
            )
            for topic in previous_topics
        ]
        current = [
            DiscoveredSubtopic(
                name=topic["name"],
                keywords=topic.get("keywords", []),
                coherence_score=topic.get("coherence_score", 1.0),
                article_count=topic.get("article_count", 0),
            )
            for topic in current_topics
        ]

        events: list[dict] = []

        for topic in current:
            if not any(self._subtopics_similar(topic, prev, threshold) for prev in previous):
                events.append({"type": "emergence", "topic": topic.name})

        for topic in previous:
            match = next(
                (curr for curr in current if self._subtopics_similar(topic, curr, threshold)),
                None,
            )
            if match is None or match.article_count < topic.article_count:
                events.append({"type": "decline", "topic": topic.name})

        return events

    def _compute_growth_rate(self, current_count: int, previous_count: int) -> float:
        """Compute proportional growth between two article counts."""

        if previous_count <= 0:
            return 1.0 if current_count > 0 else 0.0
        return (current_count - previous_count) / previous_count
