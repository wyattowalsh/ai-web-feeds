#!/usr/bin/env python
"""Prefilter with UA + validate new forum/docs/SDK feeds. Concurrency limited."""
import asyncio
import json
import sys
from pathlib import Path
from urllib.parse import urlparse

import httpx

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "packages" / "ai_web_feeds" / "src"))
from ai_web_feeds.validate import validate_feed_url

SPEC = ROOT / "specs" / "003-feed-collection-enhancement"
EXISTING = SPEC / "existing-urls.txt"

def load_existing_norms():
    urls = set()
    if EXISTING.exists():
        for line in EXISTING.read_text(encoding="utf-8").splitlines():
            if line.strip():
                urls.add(norm(line.strip()))
    return urls

def norm(u: str) -> str:
    p = urlparse(u.strip().lower())
    return f"{p.scheme}://{p.netloc.replace('www.', '')}{p.path.rstrip('/')}"

CANDIDATES = [
    # GitHub SDKs/releases focused
    "https://github.com/openai/openai-python/releases.atom",
    "https://github.com/openai/openai-agents-python/releases.atom",
    "https://github.com/tensorflow/tensorflow/releases.atom",
    "https://github.com/ray-project/ray/releases.atom",
    "https://github.com/scikit-learn/scikit-learn/releases.atom",
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
    # StackExchange targeted tags
    "https://stackoverflow.com/feeds/tag?tagnames=artificial-intelligence&sort=newest",
    "https://stackoverflow.com/feeds/tag?tagnames=nlp&sort=newest",
    "https://stackoverflow.com/feeds/tag?tagnames=pytorch&sort=newest",
    "https://stackoverflow.com/feeds/tag?tagnames=tensorflow&sort=newest",
    "https://stackoverflow.com/feeds/tag?tagnames=langchain&sort=newest",
    "https://ai.stackexchange.com/feeds/tag?tagnames=llm&sort=newest",
    "https://stats.stackexchange.com/feeds/tag?tagnames=deep-learning&sort=newest",
    # HN, Lobsters, Reddit forums (note: some need UA or are dynamic)
    "https://hnrss.org/newest?q=AI&points=30",
    "https://hnrss.org/newest?q=LLM+OR+\"machine+learning\"&points=20",
    "https://lobste.rs/t/ai.rss",
    "https://lobste.rs/t/ml.rss",
    "https://www.reddit.com/r/deeplearning/hot/.rss",
    "https://www.reddit.com/r/LangChain/hot/.rss",
    "https://www.reddit.com/r/learnmachinelearning/hot/.rss",
    "https://www.reddit.com/r/LanguageTechnology/hot/.rss",
    "https://www.reddit.com/r/MLOps/hot/.rss",
    "https://www.reddit.com/r/rag/hot/.rss",
    "https://www.reddit.com/r/LLMDevs/hot/.rss",
    "https://www.reddit.com/r/PromptEngineering/hot/.rss",
    "https://www.reddit.com/r/singularity/hot/.rss",
    "https://www.reddit.com/r/AIethics/hot/.rss",
    "https://www.reddit.com/r/StableDiffusion/hot/.rss",
    # docs/changelogs + community forums
    "https://docs.anthropic.com/rss.xml",
    "https://forum.fast.ai/latest.rss",
    "https://alignmentforum.org/feed.xml",
    "https://www.lesswrong.com/feed.xml",
    "https://forum.effectivealtruism.org/feed.xml",
    "https://raw.githubusercontent.com/olshansk/rss-feeds/main/feeds/feed_anthropic_news.xml",
    # extra platform SDK releases
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
    "https://github.com/Intel/openvino/releases.atom",
]

async def http_prefilter(url: str, client: httpx.AsyncClient) -> bool:
    try:
        # try HEAD first
        resp = await client.head(url)
        if resp.status_code == 200:
            return True
        if resp.status_code in (301, 302, 307, 308):
            # follow for get
            pass
        # fallback get head range or first bytes
        resp = await client.get(url, headers={"Range": "bytes=0-4096"})
        return resp.status_code == 200 or (resp.status_code == 206)
    except Exception:
        return False

async def validate_one(url: str, sem: asyncio.Semaphore, pre_ok: bool) -> dict:
    async with sem:
        res = await validate_feed_url(url)
        res["prefilter"] = pre_ok
        res["url"] = url
        return res

async def main():
    existing_norms = load_existing_norms()
    to_check = []
    for u in CANDIDATES:
        if norm(u) in existing_norms:
            print(f"SKIP existing: {u}")
            continue
        to_check.append(u)
    print(f"To check (post existing dedup): {len(to_check)}")

    sem_http = asyncio.Semaphore(12)
    async with httpx.AsyncClient(timeout=12.0, follow_redirects=True, headers={"User-Agent": "Mozilla/5.0 (compatible; ai-web-feeds/1.0; +https://github.com/ww/ai-web-feeds)"}) as client:
        async def pre(u):
            async with sem_http:
                ok = await http_prefilter(u, client)
            print(f"PRE:{'OK' if ok else 'no'}: {u}")
            return u, ok
        pre_results = await asyncio.gather(*[pre(u) for u in to_check])

    goods_for_validate = [u for u, ok in pre_results if ok]
    print(f"Pre-OK for validate: {len(goods_for_validate)}")

    sem_val = asyncio.Semaphore(6)
    val_results = await asyncio.gather(*[validate_one(u, sem_val, True) for u in goods_for_validate])

    verified = []
    for r in val_results:
        if r.get("success"):
            verified.append(r)
            print(f"VERIFIED: {r['url']} status={r.get('status_code')} entries={r.get('entry_count')} fmt={r.get('feed_format')}")
        else:
            print(f"val-fail: {r['url']} {r.get('error_message')}")

    print(f"\n=== TOTAL VERIFIED NEW: {len(verified)} ===")
    outf = SPEC / "saturation-pass-8-verified.json"
    outf.write_text(json.dumps(verified, indent=2, default=str), encoding="utf-8")
    print(f"Saved to {outf}")

    # also prepare yaml ready list
    yaml_ready = []
    for r in verified:
        yaml_ready.append({
            "url": r["url"],
            "title": "",  # fill later by parsing if needed
            "topics": [],
            "notes": "HTTP verified via prefilter + validate_feed_url"
        })
    (SPEC / "saturation-pass-8-verified-raw.yaml").write_text(json.dumps(yaml_ready), encoding="utf-8")

if __name__ == "__main__":
    asyncio.run(main())
