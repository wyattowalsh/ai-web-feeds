#!/usr/bin/env python
"""Batch validate candidate feed URLs for saturation-pass-8. Concurrent + dedup vs existing."""
import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "packages" / "ai_web_feeds" / "src"))

from ai_web_feeds.validate import validate_feed_url

SPEC = ROOT / "specs" / "003-feed-collection-enhancement"
EXISTING_FILE = SPEC / "existing-urls.txt"

def load_existing():
    if not EXISTING_FILE.exists():
        return set()
    lines = EXISTING_FILE.read_text(encoding="utf-8").splitlines()
    return {line.strip() for line in lines if line.strip()}

# Focus on NEW forum/docs/changelog/SDK release style feeds.
# Avoid dups from existing-urls.txt and prior candidates.
RAW_CANDIDATES = [
    # === GitHub releases.atom for AI/ML SDKs, libs, tools (NEW or variants) ===
    "https://github.com/openai/openai-python/releases.atom",
    "https://github.com/openai/openai-agents-python/releases.atom",
    "https://github.com/anthropic/anthropic-sdk-python/releases.atom",
    "https://github.com/tensorflow/tensorflow/releases.atom",
    "https://github.com/ray-project/ray/releases.atom",
    "https://github.com/scikit-learn/scikit-learn/releases.atom",
    "https://github.com/pandas-dev/pandas/releases.atom",
    "https://github.com/numpy/numpy/releases.atom",
    "https://github.com/google/flax/releases.atom",
    "https://github.com/deepmind/dm-haiku/releases.atom",
    "https://github.com/continuedev/continue/releases.atom",
    "https://github.com/Aider-AI/aider/releases.atom",
    "https://github.com/BerriAI/litellm/releases.atom",
    "https://github.com/sgl-project/sglang/releases.atom",
    "https://github.com/NVIDIA/TensorRT-LLM/releases.atom",
    "https://github.com/axolotl-ai-cloud/axolotl/releases.atom",
    "https://github.com/mistralai/mistral-common/releases.atom",
    "https://github.com/google-gemini/gemini-api-releases/releases.atom",  # may not
    "https://github.com/google-deepmind/gemma/releases.atom",
    "https://github.com/THUDM/ChatGLM3/releases.atom",
    "https://github.com/QwenLM/Qwen/releases.atom",
    "https://github.com/01-ai/Yi/releases.atom",
    "https://github.com/deepseek-ai/DeepSeek-V2/releases.atom",
    "https://github.com/microsoft/DeepSpeed/releases.atom",
    "https://github.com/microsoft/unilm/releases.atom",
    "https://github.com/NVlabs/Sana/releases.atom",
    "https://github.com/hiyouga/LLaMA-Factory/releases.atom",
    "https://github.com/unslothai/unsloth/releases.atom",
    "https://github.com/Lightning-AI/pytorch-lightning/releases.atom",
    "https://github.com/Lightning-AI/lightning/releases.atom",
    # === Stack Exchange tag specific feeds (targeted) ===
    "https://stackoverflow.com/feeds/tag?tagnames=artificial-intelligence&sort=newest",
    "https://stackoverflow.com/feeds/tag?tagnames=nlp&sort=newest",
    "https://stackoverflow.com/feeds/tag?tagnames=pytorch&sort=newest",
    "https://stackoverflow.com/feeds/tag?tagnames=tensorflow&sort=newest",
    "https://stackoverflow.com/feeds/tag?tagnames=langchain&sort=newest",
    "https://stackoverflow.com/feeds/tag?tagnames=llm&sort=newest",
    "https://ai.stackexchange.com/feeds/tag?tagnames=nlp&sort=newest",
    "https://ai.stackexchange.com/feeds/tag?tagnames=llm&sort=newest",
    "https://ai.stackexchange.com/feeds/tag?tagnames=agents&sort=newest",
    "https://datascience.stackexchange.com/feeds/tag?tagnames=langchain&sort=newest",
    "https://stats.stackexchange.com/feeds/tag?tagnames=machine-learning&sort=newest",
    "https://stats.stackexchange.com/feeds/tag?tagnames=deep-learning&sort=newest",
    "https://cs.stackexchange.com/feeds/tag?tagnames=machine-learning&sort=newest",
    # === HN RSS AI/ML filters ===
    "https://hnrss.org/newest?q=AI+LLM+OR+\"large+language\"+OR+\"machine+learning\"&points=20",
    "https://hnrss.org/newest?points=50&q=anthropic+OR+openai+OR+\"x.ai\"+OR+mistral",
    "https://hnrss.org/frontpage?q=AI",
    "https://hnrss.org/best",
    # === Lobste.rs ===
    "https://lobste.rs/t/ai.rss",
    "https://lobste.rs/t/ml.rss",
    "https://lobste.rs/t/ai+ml.rss",  # combo tag?
    # === More Reddit AI/ML forum feeds (sub + sort) ===
    "https://www.reddit.com/r/deeplearning/hot/.rss",
    "https://www.reddit.com/r/LangChain/hot/.rss",
    "https://www.reddit.com/r/learnmachinelearning/hot/.rss",
    "https://www.reddit.com/r/LanguageTechnology/hot/.rss",
    "https://www.reddit.com/r/singularity/hot/.rss",
    "https://www.reddit.com/r/MLOps/hot/.rss",
    "https://www.reddit.com/r/rag/hot/.rss",
    "https://www.reddit.com/r/AIethics/hot/.rss",
    "https://www.reddit.com/r/StableDiffusion/hot/.rss",
    "https://www.reddit.com/r/LocalLLM/hot/.rss",
    "https://www.reddit.com/r/LLMDevs/hot/.rss",
    "https://www.reddit.com/r/PromptEngineering/hot/.rss",
    # === Community / Discourse mirrors ===
    "https://forum.fast.ai/latest.rss",
    "https://discuss.llamaindex.ai/latest.rss",  # possible?
    "https://community.langchain.com/latest.rss",  # ?
    "https://forum.mistral.ai/latest.rss",  # ?
    "https://discourse.mozilla.org/latest.rss",  # not AI
    "https://users.rust-lang.org/latest.rss",  # rust for ML
    # === Olshansk / awesome mirrors and variants ===
    "https://raw.githubusercontent.com/olshansk/rss-feeds/main/feeds/feed_anthropic_news.xml",
    "https://raw.githubusercontent.com/olshansk/rss-feeds/main/feeds/feed_anthropic_research.xml",
    "https://raw.githubusercontent.com/olshansk/rss-feeds/main/feeds/feed_xainews.xml",
    # try more if exist
    "https://raw.githubusercontent.com/olshansk/rss-feeds/main/feeds/feed_openai.xml",  # guess
    # === Docs / Changelogs official ===
    "https://docs.anthropic.com/rss.xml",
    "https://docs.anthropic.com/en/changelog/rss",  # variants
    "https://docs.llamaindex.ai/en/stable/_static/rss.xml",  # may
    "https://python.langchain.com/docs/changelog.rss",  # guess
    "https://docs.vllm.ai/en/latest/_static/rss.xml",
    "https://platform.openai.com/rss/docs",  # unlikely
    "https://docs.mistral.ai/rss",
    "https://docs.cohere.com/rss",
    "https://docs.together.ai/rss",
    "https://docs.groq.com/rss",
    "https://help.openai.com/rss",
    "https://docs.pytorch.org/rss",
    "https://www.tensorflow.org/feed",
    # more changelogs from known
    "https://github.com/gradio-app/gradio/releases.atom",
    "https://github.com/keras-team/keras/releases.atom",
    # === Additional forum / Q&A / community ===
    "https://www.reddit.com/r/artificialintelligence/hot/.rss",
    "https://alignmentforum.org/rss",
    "https://www.lesswrong.com/feed.xml?view=community",
    "https://forum.effectivealtruism.org/feed.xml",
    "https://news.ycombinator.com/rss",  # general but target filter later
    # === More SDK / infra releases for count ===
    "https://github.com/groq/groq-api-cookbook/releases.atom",  # unlikely
    "https://github.com/groq/groq-python/releases.atom",
    "https://github.com/cohere-ai/cohere-python/releases.atom",
    "https://github.com/togethercomputer/together-python/releases.atom",
    "https://github.com/replicate/replicate-python/releases.atom",
    "https://github.com/fal-ai/fal/releases.atom",
    "https://github.com/fireworks-ai/fireworks/releases.atom",
    "https://github.com/anyscale/rayllm/releases.atom",
    "https://github.com/vllm-project/vllm/releases.atom",
    "https://github.com/NVIDIA/NeMo/releases.atom",
    "https://github.com/huggingface/safetensors/releases.atom",
    "https://github.com/huggingface/tokenizers/releases.atom",
    "https://github.com/huggingface/datasets/releases.atom",
    "https://github.com/huggingface/accelerate/releases.atom",
    "https://github.com/huggingface/diffusers/releases.atom",
    "https://github.com/huggingface/evaluate/releases.atom",
    "https://github.com/Lightning-AI/lit-llama/releases.atom",
]

def norm(u: str) -> str:
    from urllib.parse import urlparse
    p = urlparse(u.strip().lower())
    return f"{p.scheme}://{p.netloc.replace('www.', '')}{p.path.rstrip('/')}"

async def validate_one(url: str, sem: asyncio.Semaphore):
    async with sem:
        try:
            r = await validate_feed_url(url)
            return {
                "url": url,
                "success": r.get("success", False),
                "status_code": r.get("status_code"),
                "entries": r.get("entry_count", 0),
                "error": r.get("error_message"),
                "format": r.get("feed_format"),
            }
        except Exception as e:
            return {"url": url, "success": False, "error": str(e)}

async def main():
    existing = load_existing()
    existing_norm = {norm(u) for u in existing}
    candidates = []
    seen = set()
    for u in RAW_CANDIDATES:
        nu = norm(u)
        if nu in existing_norm:
            print(f"SKIP existing: {u}")
            continue
        if nu in seen:
            continue
        seen.add(nu)
        candidates.append(u)

    print(f"Candidates after dedup vs existing: {len(candidates)}")
    sem = asyncio.Semaphore(8)
    tasks = [validate_one(u, sem) for u in candidates]
    results = await asyncio.gather(*tasks)

    ok_results = [r for r in results if r.get("success")]
    print(f"\n=== VERIFIED OK: {len(ok_results)} ===")
    for r in ok_results:
        print(f"OK: {r['url']} | {r['status_code']} entries={r['entries']} fmt={r.get('format')}")
    print(f"\nTotal verified: {len(ok_results)}")
    # write temp results for use
    import json
    out = SPEC / "saturation-pass-8-raw-results.json"
    out.write_text(json.dumps({"verified": ok_results, "all": results}, indent=2), encoding="utf-8")
    print(f"Wrote results to {out}")

if __name__ == "__main__":
    asyncio.run(main())
