"""Shared semantic relevance helpers for feed discovery and pruning."""

from __future__ import annotations

import re

AI_SIGNAL_RE = re.compile(
    r"(artificial[- ]?intelligence|(?<![a-z])ai(?![a-z])|machine[- ]?learning|"
    r"deep[- ]?learning|generative|(?<![a-z])llm(?![a-z])|mlops|llmops|neural|"
    r"transformer|diffusion|embedding|vector\s*db|rag\b|alignment|"
    r"reinforcement[- ]?learning|computer[- ]?vision|nlp\b|speech[- ]?recognition|"
    r"openai|anthropic|deepmind|huggingface|pytorch|tensorflow|arxiv\.org/rss|"
    r"alignmentforum|lesswrong|langchain|llamaindex|ollama|vllm|"
    r"inference|fine[- ]?tun|rlhf|agent|robotics|autonomous|"
    r"dev\.to/feed/tag/(ai|llm|mlops|rag|generativeai|deeplearning|machinelearning)|"
    r"stackoverflow\.com/feeds/tag\?tagnames=(machine-learning|rag|pytorch|nlp|llm|"
    r"large-language-model|transformer-model|langchain)|"
    r"discuss\.pytorch\.org|lemmy\.world/feeds/c/machinelearning|"
    r"github\.com/.+/releases\.atom|"
    r"research\.google|bair\.berkeley|crfm\.stanford|mila\.quebec|vectorinstitute|"
    r"allenai\.org|neurips|icml|iclr|jmlr|distill\.pub|"
    r"karpathy|lilianweng|colah\.github|jalammar|fast\.ai|gwern|"
    r"cerebras|sambanova|tenstorrent|groq|modal\.com|wandb|weaviate|qdrant|chroma|"
    r"milvus|pinecone|stability\.ai|midjourney|runway|assemblyai|deepgram|elevenlabs|"
    r"mistral|cohere|perplexity|fireworks|baseten|anyscale|determined|neptune|comet|"
    r"arize|fiddler|trulens|evidently|deepeval|confident-ai|"
    r"safety|evals?|interpretability|foundation[- ]?model)",
    re.I,
)

KNOWN_AI_ORGS_RE = re.compile(
    r"(openai|anthropic|google\s*(deepmind|research|ai)|meta\s*ai|microsoft\s*research|"
    r"nvidia|hugging\s*face|stanford\s*(hai|crfm)|berkeley\s*bair|mila|vector\s*institute|"
    r"allen\s*institute|deepmind|mistral|cohere|perplexity|together\s*ai|"
    r"langchain|llamaindex|weights\s*&\s*biases|wandb|modal|groq|cerebras|"
    r"alignment\s*forum|lesswrong|redwood\s*research|epoch\s*ai|ai\s*impacts)",
    re.I,
)


# Hard reject: generic vertical / dev tooling with no AI angle
REJECT_URL_FRAGMENTS = (
    "restaurantdive.com",
    "retaildive.com",
    "freightwaves.com",
    "gamesindustry.biz",
    "kubernetes.io/feed",
    "blog.unity.com",
    "bleepingcomputer.com",
    "stratechery.com",
    "flowingdata.com",
    "platformer.news",
    "astral-sh/uv/releases",
    "astral-sh/ruff/releases",
    "pandas-dev/pandas/releases",
    "numpy/numpy/releases",
    "benn.substack.com",
    "addyo.substack.com",
)


def is_ai_relevant(*, url: str, title: str, topics: list[str], notes: str = "") -> bool:
    url_l = url.lower()
    if any(frag in url_l for frag in REJECT_URL_FRAGMENTS):
        return False

    blob = f"{url} {title} {notes}"
    if AI_SIGNAL_RE.search(blob) or KNOWN_AI_ORGS_RE.search(blob):
        return True
    core = set(topics) & {
        "ai", "llm", "ml", "research", "papers", "safety", "alignment", "agents",
        "mlops", "llmops", "evaluation", "governance", "robotics", "nlp", "genai",
        "retrieval", "training", "inference", "ai-for-code", "ai-for-science",
        "interpretability", "diffusion", "embeddings", "tool-use", "rag",
        "healthcare-ai", "finance-ai", "edtech-ai", "synthetic-data", "synthetic-agents",
        "audio-speech", "cv", "on-device", "compilers", "accelerators", "serving",
    }
    if core and (KNOWN_AI_ORGS_RE.search(blob) or AI_SIGNAL_RE.search(blob)):
        return True
    # Topic-only tags are not enough (pass-9 mislabeled generic blogs)
    return False