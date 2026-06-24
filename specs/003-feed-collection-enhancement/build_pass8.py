#!/usr/bin/env python
"""Build saturation-pass-8-platforms.yaml from verified list. Fetch titles, assign topics, ensure >40 new."""
import asyncio
import sys
import feedparser
from pathlib import Path
from urllib.parse import urlparse
import httpx

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "packages" / "ai_web_feeds" / "src"))
from ai_web_feeds.validate import validate_feed_url

SPEC = ROOT / "specs" / "003-feed-collection-enhancement"
OUT = SPEC / "candidates" / "saturation-pass-8-platforms.yaml"

EXISTING = set(line.strip() for line in (SPEC / "existing-urls.txt").read_text(encoding="utf-8").splitlines() if line.strip())

VERIFIED_URLS = [
    "https://github.com/openai/openai-python/releases.atom",
    "https://github.com/openai/openai-agents-python/releases.atom",
    "https://github.com/tensorflow/tensorflow/releases.atom",
    "https://github.com/ray-project/ray/releases.atom",
    "https://github.com/pandas-dev/pandas/releases.atom",
    "https://github.com/numpy/numpy/releases.atom",
    "https://github.com/google/flax/releases.atom",
    "https://github.com/continuedev/continue/releases.atom",
    "https://github.com/Aider-AI/aider/releases.atom",
    "https://github.com/BerriAI/litellm/releases.atom",
    "https://github.com/hiyouga/LLaMA-Factory/releases.atom",
    "https://github.com/Lightning-AI/pytorch-lightning/releases.atom",
    "https://github.com/groq/groq-python/releases.atom",
    "https://github.com/cohere-ai/cohere-python/releases.atom",
    "https://github.com/togethercomputer/together-python/releases.atom",
    "https://github.com/replicate/replicate-python/releases.atom",
    "https://github.com/huggingface/diffusers/releases.atom",
    "https://github.com/huggingface/datasets/releases.atom",
    "https://github.com/huggingface/accelerate/releases.atom",
    "https://github.com/huggingface/safetensors/releases.atom",
    "https://github.com/huggingface/tokenizers/releases.atom",
    "https://github.com/NVIDIA/NeMo/releases.atom",
    "https://github.com/deepseek-ai/DeepSeek-V2/releases.atom",
    "https://github.com/QwenLM/Qwen/releases.atom",
    "https://github.com/THUDM/ChatGLM3/releases.atom",
    "https://github.com/Lightning-AI/lit-llama/releases.atom",
    "https://github.com/mosaicml/composer/releases.atom",
    "https://github.com/EleutherAI/gpt-neox/releases.atom",
    "https://github.com/EleutherAI/lm-evaluation-harness/releases.atom",
    "https://github.com/anyscale/ray/releases.atom",
    "https://github.com/pytorch/FBGEMM/releases.atom",
    "https://github.com/pytorch/executorch/releases.atom",
    "https://github.com/pytorch/vision/releases.atom",
    "https://github.com/pytorch/audio/releases.atom",
    "https://github.com/pytorch/torchtune/releases.atom",
    "https://github.com/pytorch/ignite/releases.atom",
    "https://github.com/tensorflow/models/releases.atom",
    "https://github.com/keras-team/keras-cv/releases.atom",
    "https://github.com/onnx/onnx/releases.atom",
    "https://github.com/onnx/onnx-tensorrt/releases.atom",
    "https://github.com/onnx/onnx-mlir/releases.atom",
    "https://github.com/Intel/neural-compressor/releases.atom",
    "https://stackoverflow.com/feeds/tag?tagnames=artificial-intelligence&sort=newest",
    "https://stackoverflow.com/feeds/tag?tagnames=nlp&sort=newest",
    "https://stackoverflow.com/feeds/tag?tagnames=pytorch&sort=newest",
    "https://stackoverflow.com/feeds/tag?tagnames=tensorflow&sort=newest",
    "https://stackoverflow.com/feeds/tag?tagnames=langchain&sort=newest",
    "https://hnrss.org/newest?q=AI&points=30",
    "https://hnrss.org/newest?q=LLM+OR+%22machine+learning%22&points=20",
    "https://alignmentforum.org/feed.xml",
    "https://www.lesswrong.com/feed.xml",
    "https://forum.effectivealtruism.org/feed.xml",
    "https://raw.githubusercontent.com/olshansk/rss-feeds/main/feeds/feed_anthropic_news.xml",
]

# Force add more target platforms that may need UA or alternate check (known viable from prior runs/memory)
FORCED = [
    "https://lobste.rs/t/ai.rss",
    "https://lobste.rs/t/ml.rss",
    "https://www.reddit.com/r/deeplearning/hot/.rss",
    "https://www.reddit.com/r/LangChain/hot/.rss",
    "https://www.reddit.com/r/learnmachinelearning/hot/.rss",
    "https://www.reddit.com/r/MLOps/hot/.rss",
    "https://www.reddit.com/r/rag/hot/.rss",
    "https://www.reddit.com/r/LLMDevs/hot/.rss",
    "https://www.reddit.com/r/PromptEngineering/hot/.rss",
    "https://hnrss.org/newest?points=50&q=anthropic+OR+openai+OR+langchain+OR+llm",
    "https://forum.fast.ai/latest.rss",
]

def norm(u: str) -> str:
    p = urlparse(u.strip().lower())
    return f"{p.scheme}://{p.netloc.replace('www.', '')}{p.path.rstrip('/')}"

def is_existing(u: str) -> bool:
    nu = norm(u)
    return any(nu == norm(e) for e in EXISTING)

TOPIC_SET = {
    "ai", "ml", "llm", "nlp", "genai", "research", "community", "open-source",
    "devtools", "industry", "product", "mlops", "evaluation", "safety", "governance",
    "ai-for-code", "retrieval", "agents", "education", "papers", "blogs"
}

def pick_topics(url: str, feed_title: str) -> list[str]:
    t = (url + " " + (feed_title or "")).lower()
    topics = []
    if any(x in t for x in ["release", "changelog", "sdk", "python", "github.com"]):
        topics.extend(["open-source", "devtools"])
    if "stackoverflow" in t or "stackexchange" in t or "reddit.com" in t or "lobste" in t or "hnrss" in t or "forum" in t or "community" in t or "discuss" in t:
        topics.append("community")
    if any(x in t for x in ["llm", "langchain", "openai", "anthropic", "gpt", "qwen", "deepseek", "mistral"]):
        topics.append("llm")
    if any(x in t for x in ["nlp", "pytorch", "tensorflow", "huggingface", "transformers"]):
        topics.append("ml")
        topics.append("nlp")
    if "hnrss" in t or "lobste" in t or "reddit" in t:
        topics = ["community", "industry"]
    if "alignment" in t or "lesswrong" in t or "effectivealtruism" in t:
        topics.extend(["research", "governance", "safety"])
    if "ray" in t or "ne mo" in t or "nvidia" in t:
        topics.extend(["mlops", "industry"])
    if "docs" in t or "changelog" in t:
        topics.append("product")
    # dedup preserve order, filter to valid
    seen = set()
    out = []
    for tt in topics:
        if tt in TOPIC_SET and tt not in seen:
            seen.add(tt)
            out.append(tt)
    if not out:
        out = ["community", "open-source"]
    return out[:4]

async def fetch_title_and_validate(url: str) -> dict:
    title = None
    fmt = None
    entries = 0
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True, headers={"User-Agent": "ai-web-feeds/1.0 (+rss)"}) as c:
            resp = await c.get(url)
            if resp.status_code == 200:
                parsed = feedparser.parse(resp.text)
                feed = parsed.get("feed", {})
                title = feed.get("title") or feed.get("subtitle") or url.split("/")[-1]
                entries = len(parsed.get("entries", []))
                if parsed.get("version"):
                    fmt = "atom" if "atom" in str(parsed["version"]).lower() else "rss"
    except Exception:
        pass
    # fallback validate
    v = await validate_feed_url(url)
    if v.get("success"):
        entries = entries or v.get("entry_count", 0)
        fmt = fmt or v.get("feed_format")
    if not title:
        title = url.rsplit("/", 1)[-1].replace(".atom", " Releases").replace(".rss", " Feed").replace("/hot/.rss", "")
    return {"url": url, "title": title.strip()[:120], "entries": entries, "format": fmt, "success": v.get("success", entries>0 or bool(title)) }

async def main():
    candidates = []
    for u in VERIFIED_URLS + FORCED:
        if is_existing(u):
            print("SKIP ex:", u)
            continue
        candidates.append(u)
    print(f"New candidates: {len(candidates)}")

    sem = asyncio.Semaphore(6)
    async def bound(u):
        async with sem:
            return await fetch_title_and_validate(u)
    infos = await asyncio.gather(*[bound(u) for u in candidates])

    sources = []
    for info in infos:
        if not info.get("success"):
            continue
        topics = pick_topics(info["url"], info["title"])
        note = f"HTTP+parse verified; entries~{info['entries']}; {info.get('format','feed')}"
        if "releases.atom" in info["url"]:
            note = "GitHub releases.atom feed"
        elif "stackoverflow" in info["url"] or "stackexchange" in info["url"]:
            note = "Stack Exchange tag feed (forum)"
        elif "reddit" in info["url"]:
            note = "Reddit subreddit .rss (forum)"
        elif "lobste" in info["url"]:
            note = "Lobsters tag .rss (forum)"
        elif "hnrss" in info["url"]:
            note = "Hacker News AI filter via hnrss (forum)"
        elif "olshansk" in info["url"]:
            note = "Olshansk rss-feeds mirror for AI news"
        elif "alignment" in info["url"] or "lesswrong" in info["url"]:
            note = "Community forum / research discussion feed"
        sources.append({
            "url": info["url"],
            "title": info["title"],
            "topics": topics,
            "notes": note
        })

    # ensure unique
    seen_urls = set()
    uniq = []
    for s in sources:
        if s["url"] not in seen_urls:
            seen_urls.add(s["url"])
            uniq.append(s)

    print(f"Prepared sources: {len(uniq)}")
    if len(uniq) < 40:
        print("WARNING: less than 40, will still write but task asks 40+ verified.")

    # yaml output
    import yaml
    doc = {"sources": uniq}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(yaml.safe_dump(doc, sort_keys=False, allow_unicode=True, default_flow_style=False), encoding="utf-8")
    print(f"Wrote {OUT} with {len(uniq)} sources")
    # also append to existing for future? no, just candidate
    # print sample
    for s in uniq[:5]:
        print("  - ", s["url"], s["title"], s["topics"])

if __name__ == "__main__":
    asyncio.run(main())
