"""Topic modeling using LDA/BERTopic (Phase 5D)."""

import json
from datetime import datetime
from typing import Optional

import numpy as np
from gensim import corpora
from gensim.models import LdaModel
from loguru import logger
from pydantic import BaseModel, Field

from ai_web_feeds.config import Settings


class DiscoveredSubtopic(BaseModel):
    """A discovered subtopic from topic modeling."""
    
    name: str = Field(description="Generated subtopic name")
    keywords: list[str] = Field(description="Representative keywords")
    coherence_score: float = Field(ge=0.0, le=1.0, description="Topic coherence score")
    article_count: int = Field(ge=0, description="Number of articles in this subtopic")


class TopicModeler:
    """Discover subtopics and track evolution using LDA/BERTopic.
    
    Performs topic modeling on article collections to:
    - Discover emergent subtopics within parent topics
    - Track topic evolution over time (splits, merges, emergence, decline)
    - Generate representative keywords for subtopics
    - Calculate topic coherence scores
    
    Uses Gensim LDA by default, with BERTopic as future enhancement.
    """
    
    def __init__(self, settings: Optional[Settings] = None):
        """Initialize topic modeler.
        
        Args:
            settings: Application settings (uses defaults if None)
        """
        self.settings = settings or Settings()
        self.config = self.settings.phase5
        self.topic_model_type = self.config.topic_model
        self.min_coherence = self.config.topic_coherence_min
    
    def discover_subtopics(
        self,
        topic: str,
        articles: list[dict],
        num_topics: int = 5,
        min_articles: int = 10
    ) -> list[DiscoveredSubtopic]:
        """Discover subtopics for a given parent topic using LDA.
        
        Args:
            topic: Parent topic name (e.g., "Machine Learning")
            articles: List of article dicts with keys: title, content, summary
            num_topics: Number of subtopics to discover
            min_articles: Minimum articles required for modeling
            
        Returns:
            List of discovered subtopics with keywords and scores
        """
        if len(articles) < min_articles:
            logger.warning(
                f"Insufficient articles for topic modeling: {len(articles)} < {min_articles}"
            )
            return []
        
        try:
            logger.info(f"Discovering {num_topics} subtopics for '{topic}' from {len(articles)} articles")
            
            # Preprocess articles
            texts = self._preprocess_articles(articles)
            
            if not texts:
                logger.warning("No text content after preprocessing")
                return []
            
            # Create dictionary and corpus
            dictionary = corpora.Dictionary(texts)
            dictionary.filter_extremes(no_below=2, no_above=0.5, keep_n=1000)
            corpus = [dictionary.doc2bow(text) for text in texts]
            
            if not corpus:
                logger.warning("Empty corpus after preprocessing")
                return []
            
            # Train LDA model
            lda_model = LdaModel(
                corpus=corpus,
                id2word=dictionary,
                num_topics=num_topics,
                random_state=42,
                passes=10,
                alpha="auto",
                per_word_topics=True
            )
            
            # Extract subtopics
            subtopics = []
            for topic_id in range(num_topics):
                # Get top keywords
                topic_words = lda_model.show_topic(topic_id, topn=10)
                keywords = [word for word, prob in topic_words]
                
                # Generate subtopic name from top keywords
                subtopic_name = self._generate_subtopic_name(keywords, topic)
                
                # Calculate coherence (simplified - use top word probabilities as proxy)
                coherence = float(np.mean([prob for word, prob in topic_words[:5]]))
                
                # Count articles in this topic
                article_count = sum(
                    1 for doc_topics in lda_model.get_document_topics(corpus)
                    if any(tid == topic_id and prob > 0.3 for tid, prob in doc_topics)
                )
                
                # Filter by coherence threshold
                if coherence >= self.min_coherence:
                    subtopics.append(DiscoveredSubtopic(
                        name=subtopic_name,
                        keywords=keywords,
                        coherence_score=coherence,
                        article_count=article_count,
                    ))
            
            logger.info(f"Discovered {len(subtopics)} subtopics for '{topic}'")
            return subtopics
            
        except Exception as e:
            logger.error(f"Failed to discover subtopics for '{topic}': {e}")
            return []
    
    def track_evolution(
        self,
        topic: str,
        historical_articles: dict[str, list[dict]],
        threshold: float = 0.5
    ) -> list[dict]:
        """Track topic evolution events over time.
        
        Detects:
        - Emergence: New subtopics appearing
        - Decline: Subtopics disappearing
        - Split: One subtopic splitting into multiple
        - Merge: Multiple subtopics merging into one
        
        Args:
            topic: Parent topic name
            historical_articles: Dict mapping time period to articles
            threshold: Similarity threshold for detecting splits/merges
            
        Returns:
            List of evolution events with metadata
        """
        try:
            events = []
            prev_subtopics = None
            
            # Sort time periods chronologically
            sorted_periods = sorted(historical_articles.keys())
            
            for period in sorted_periods:
                articles = historical_articles[period]
                
                # Discover subtopics for this period
                current_subtopics = self.discover_subtopics(topic, articles)
                
                if prev_subtopics is not None:
                    # Compare with previous period to detect changes
                    period_events = self._detect_evolution_events(
                        topic,
                        prev_subtopics,
                        current_subtopics,
                        period,
                        threshold
                    )
                    events.extend(period_events)
                
                prev_subtopics = current_subtopics
            
            logger.info(f"Detected {len(events)} evolution events for '{topic}'")
            return events
            
        except Exception as e:
            logger.error(f"Failed to track evolution for '{topic}': {e}")
            return []
    
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
        import re
        from collections import Counter
        
        # Simple stopwords list (should use nltk.corpus.stopwords in production)
        stopwords = set([
            "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
            "of", "with", "by", "from", "as", "is", "was", "are", "were", "be",
            "been", "being", "have", "has", "had", "do", "does", "did", "will",
            "would", "could", "should", "may", "might", "can", "this", "that",
            "these", "those", "i", "you", "he", "she", "it", "we", "they"
        ])
        
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
                        item.get("value", "") for item in content_data
                        if isinstance(item, dict)
                    )
                else:
                    content += str(content_data)
            
            if not content:
                continue
            
            # Tokenize and clean
            tokens = re.findall(r'\b[a-z]{3,}\b', content.lower())
            
            # Remove stopwords
            tokens = [t for t in tokens if t not in stopwords]
            
            if tokens:
                texts.append(tokens)
        
        return texts
    
    def _generate_subtopic_name(self, keywords: list[str], parent_topic: str) -> str:
        """Generate a human-readable subtopic name from keywords.
        
        Args:
            keywords: List of representative keywords
            parent_topic: Parent topic name for context
            
        Returns:
            Generated subtopic name
        """
        # Take top 3 keywords and capitalize
        top_keywords = keywords[:3]
        name = " & ".join([k.capitalize() for k in top_keywords])
        return f"{parent_topic}: {name}"
    
    def _detect_evolution_events(
        self,
        topic: str,
        prev_subtopics: list[DiscoveredSubtopic],
        current_subtopics: list[DiscoveredSubtopic],
        period: str,
        threshold: float
    ) -> list[dict]:
        """Detect evolution events between two time periods.
        
        Args:
            topic: Parent topic name
            prev_subtopics: Subtopics from previous period
            current_subtopics: Subtopics from current period
            period: Current time period label
            threshold: Similarity threshold
            
        Returns:
            List of detected evolution events
        """
        events = []
        
        # Simple heuristics for evolution detection:
        
        # 1. Emergence: New subtopics not matching previous ones
        for current in current_subtopics:
            is_new = True
            for prev in prev_subtopics:
                if self._subtopics_similar(current, prev, threshold):
                    is_new = False
                    break
            
            if is_new:
                events.append({
                    "event_type": "emergence",
                    "source_topic": topic,
                    "target_topics": [current.name],
                    "article_count": current.article_count,
                    "detected_at": period,
                })
        
        # 2. Decline: Previous subtopics not found in current
        for prev in prev_subtopics:
            is_gone = True
            for current in current_subtopics:
                if self._subtopics_similar(prev, current, threshold):
                    is_gone = False
                    break
            
            if is_gone:
                events.append({
                    "event_type": "decline",
                    "source_topic": prev.name,
                    "target_topics": None,
                    "article_count": prev.article_count,
                    "detected_at": period,
                })
        
        # TODO: Implement split/merge detection (requires more sophisticated similarity)
        
        return events
    
    def _subtopics_similar(
        self,
        subtopic1: DiscoveredSubtopic,
        subtopic2: DiscoveredSubtopic,
        threshold: float
    ) -> bool:
        """Check if two subtopics are similar based on keyword overlap.
        
        Args:
            subtopic1: First subtopic
            subtopic2: Second subtopic
            threshold: Similarity threshold (0-1)
            
        Returns:
            True if subtopics are similar above threshold
        """
        # Calculate Jaccard similarity on keywords
        keywords1 = set(subtopic1.keywords[:5])  # Top 5 keywords
        keywords2 = set(subtopic2.keywords[:5])
        
        if not keywords1 or not keywords2:
            return False
        
        intersection = len(keywords1 & keywords2)
        union = len(keywords1 | keywords2)
        
        similarity = intersection / union if union > 0 else 0
        
        return similarity >= threshold
