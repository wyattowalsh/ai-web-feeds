# Visual Audit Brief — 2026-06-22

**Mode:** Report-only. No code changes.\
**Base URL:** `https://aiwebfeeds.vercel.app`\
**Tool:** `B=~/.agents/skills/gstack/browse/dist/browse`\
**Artifacts:** `specs/visual-audit-2026-06-22/`

## Severity (map to P0–P3 in agent JSON)

| P   | Meaning                                                               |
| --- | --------------------------------------------------------------------- |
| P0  | Broken layout, unreadable contrast, overlap, missing critical content |
| P1  | Clear visual bug or chrome inconsistency across routes                |
| P2  | Spacing, alignment, hierarchy, token drift                            |
| P3  | Nit: micro-spacing, icon size                                         |

## Viewports

`390x844`, `768x1024`, `1280x800`, `1440x900`

## Theme toggle

```bash
$B snapshot -i | rg -i "light|dark|system"
# Click light/dark buttons from snapshot refs; fallback:
$B js "document.documentElement.classList.toggle('dark', true)"
```

## Screenshot naming

`{route-slug}__{viewport}__{theme}__{state}.png`

## Output JSON (per task)

Write to `findings/{task_id}.json` using contract in `brief.md` + mission schema.

## Deep links (seed — scout may override)

- Article: `/reader/article/openai-models-weekly-briefing-513f843668` (**404 on prod** —
  capture error state)
- Search handoff: `/reader?q=agent`
- Source type: `/reader?source_type=blog`
