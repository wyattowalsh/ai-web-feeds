---
mode: agent
---

# Current Versions
`````````
## feeds.yaml
``````

``````

---

## feeds.schema.json
``````

``````

---

## topics.yaml
``````

``````
`````````

---

# AI Web Feeds Extension Prompt

## Overview
This prompt guides AI agents in discovering, curating, and adding high-quality RSS/Atom feeds to the `feeds.yaml` file following the AIWebFeeds schema v2.1.0.

---

## 📋 Pre-Execution Checklist

Before starting, ensure you have read and understood:
- ✅ Current `data/feeds.yaml` (complete list of existing feeds)
- ✅ `data/feeds.schema.json` (validation rules and structure)
- ✅ `data/topics.yaml` (complete topic taxonomy with 150+ topics)
- ✅ Project `AGENTS.md` files (quality standards and conventions)

---

## 🎯 Research Objectives

### Primary Goals
1. **Coverage Expansion**: Find feeds in underrepresented topic areas
2. **Quality Over Quantity**: Prioritize authoritative, frequently-updated sources
3. **Platform Diversity**: Include various formats (RSS, Atom, YouTube, Reddit, GitHub, etc.)
4. **Global Perspective**: Include non-English sources where valuable

### Target Categories (Priority Order)
1. **Research & Academia**: ArXiv feeds, university labs, research groups
2. **Industry Leaders**: Company blogs (AI labs, MLOps platforms, cloud providers)
3. **Open Source**: GitHub repos, foundation blogs, community projects
4. **Technical Blogs**: Individual researchers, engineers, practitioners
5. **News & Analysis**: Trade publications, industry newsletters
6. **Educational Content**: Tutorials, courses, documentation sites
7. **Community Forums**: Subreddits, Discourse forums, Stack Exchange
8. **Podcasts & Media**: Video channels, podcast feeds, webinar series

---

## 🔍 Research Methodology

### Phase 1: Gap Analysis (15 min)
1. **Analyze existing feeds** by topic distribution
2. **Identify underrepresented topics** from `topics.yaml`
3. **Note missing perspectives** (geographic, organizational, skill-level)
4. **List specific search targets** (e.g., "NLP researcher blogs", "MLOps company feeds")

### Phase 2: Deep Web Research (30-45 min)
Use these search strategies:

#### Strategy A: Authoritative Source Discovery
- Search for "best [topic] RSS feeds 2025"
- Check "awesome-[topic]" GitHub lists
- Review conference/workshop organizer lists
- Explore university department directories
- Check professional association member directories

#### Strategy B: Platform-Specific Hunting
- **ArXiv**: Search by topic code, author, or institution
- **GitHub**: Find popular repos in topic areas (releases.atom)
- **YouTube**: Search for educational channels by topic
- **Medium**: Find publications by topic tag
- **Substack**: Discover newsletters via category browsing
- **Reddit**: Identify active subreddits for topics
- **Dev.to**: Explore topic tags
- **Twitter/X**: Find influential researchers/practitioners

#### Strategy C: Cross-Reference Validation
- Check if sources cite each other
- Verify author credentials (H-index, affiliations, GitHub stars)
- Review posting frequency (prefer weekly+ updates)
- Assess content quality via sample posts
- Confirm feed functionality (test URLs)

### Phase 3: Deduplication & Validation (10 min)
1. **Cross-check against existing feeds** (exact URL matching)
2. **Verify feed accessibility** (HTTP 200, valid XML/JSON)
3. **Confirm platform compatibility** (can system auto-discover feed?)
4. **Test topic assignments** (1-6 topics, all from `topics.yaml`)

---

## 📝 Output Format Specifications

### Required YAML Structure
Each feed entry MUST follow this format:

```yaml
  - url: "https://example.com/feed.xml"
    topics: ["topic-id-1", "topic-id-2", "topic-id-3"]
    title: "Optional Custom Title"  # Only if better than auto-extracted
    notes: "Optional context about source quality, update frequency, or special considerations"
```

### Validation Rules
- ✅ **URL**: Valid HTTP/HTTPS URI (direct feed or platform URL)
- ✅ **Topics**: 1-6 topic IDs from `topics.yaml`, hyphenated lowercase
- ✅ **Title**: Optional, max 160 chars (only if custom needed)
- ✅ **Notes**: Optional, max 500 chars (contributor insights)

### Platform-Specific URL Patterns
The system auto-detects these patterns:

| Platform | Input URL Example | Auto-Generated Feed |
|----------|-------------------|---------------------|
| **ArXiv** | `https://arxiv.org/search/?searchtype=author&query=Smith` | Atom feed |
| **GitHub** | `https://github.com/owner/repo` | `releases.atom` |
| **YouTube** | `https://www.youtube.com/channel/UCxxxxx` | Channel RSS |
| **Reddit** | `https://www.reddit.com/r/MachineLearning` | `.rss` suffix |
| **Medium** | `https://towardsdatascience.com` | `/feed` suffix |
| **Twitter/X** | `https://x.com/username` | RSSHub fallback |
| **Substack** | `https://newsletter.substack.com` | `/feed` suffix |
| **Dev.to** | `https://dev.to/t/machinelearning` | Feed URL |

---

## 🎨 Quality Guidelines

### High-Quality Feed Characteristics
- ✅ **Active**: Posted within last 30 days
- ✅ **Consistent**: Regular update cadence (weekly, biweekly, monthly)
- ✅ **Authoritative**: Recognized experts, institutions, or companies
- ✅ **Original**: Primary sources, not aggregators
- ✅ **Relevant**: Strong topical alignment with AI/ML ecosystem
- ✅ **Accessible**: Public, no paywall for feed content
- ✅ **Technical Depth**: Substantive content (not just headlines)

### Red Flags (Avoid These)
- ❌ Inactive (>6 months since last post)
- ❌ Low signal-to-noise (excessive marketing/SEO spam)
- ❌ Duplicate content (cross-posts only)
- ❌ Paywalled content (feed previews only)
- ❌ AI-generated SEO farms
- ❌ Broken feeds (404s, malformed XML)

---

## 🏷️ Topic Assignment Best Practices

### Topic Selection Strategy
1. **Use topic hierarchy**: Check `parents` and `relations` in `topics.yaml`
2. **Primary topic first**: Most specific, relevant topic ID
3. **Breadth over depth**: Cover multiple facets (e.g., `[llm, evaluation, open-source]`)
4. **Facet diversity**: Mix domain, task, methodology, format topics
5. **Respect limits**: 1-6 topics (optimal: 2-4)

### Common Topic Combinations
- **Research papers**: `[research, papers, <specific-domain>]`
- **Company blogs**: `[industry, product, <technology-area>]`
- **Open source**: `[open-source, <domain>, <task>]`
- **Education**: `[education, <medium>, <topic>]`
- **Community**: `[community, <platform>, <domain>]`

### Topic ID Reference (Commonly Used)
**Domains**: `ai`, `ml`, `genai`, `nlp`, `cv`, `rl`, `robotics`  
**Tasks**: `llm`, `agents`, `retrieval`, `rag`, `multimodal`, `vlm`  
**Methods**: `training`, `inference`, `evaluation`, `optimization`  
**Formats**: `research`, `papers`, `blogs`, `podcasts`, `videos`, `newsletters`  
**Focus**: `industry`, `product`, `open-source`, `education`, `safety`, `governance`  
**Tech**: `mlops`, `data`, `cloud`, `accelerators`, `compilers`, `frameworks`

---

## 📤 Output Instructions

### 1. Summary Report
Before outputting YAML, provide:
- Total feeds discovered: `X`
- Feeds after deduplication: `Y`
- Top 3 topic areas covered
- Notable high-value additions
- Any validation issues encountered

### 2. YAML Code Block
Output valid YAML entries ready to append to `feeds.yaml`:

```yaml
# New feeds discovered: [Date]
# Research focus: [Topic areas]

  - url: "https://..."
    topics: ["topic1", "topic2"]
    notes: "Context about this source"
    
  - url: "https://..."
    topics: ["topic1", "topic2", "topic3"]
    title: "Custom Title If Needed"
    notes: "Why this source is valuable"
```

### 3. Rationale (Optional)
For significant additions, briefly explain:
- Why this source is valuable
- How it fills a gap in current coverage
- Estimated posting frequency
- Notable authors or unique perspective

---

## 🚀 Execution Steps

1. **Load Context**  
   ```bash
   # Read required files
   - data/feeds.yaml (current feeds)
   - data/feeds.schema.json (validation rules)
   - data/topics.yaml (topic taxonomy)
   ```

2. **Gap Analysis**  
   Identify underrepresented topics and missing source types

3. **Web Research**  
   Execute deep, targeted searches across multiple platforms

4. **Validation**  
   Cross-check URLs, verify feeds, test topic assignments

5. **Output Generation**  
   Format as valid YAML with proper structure and metadata

6. **Quality Review**  
   Self-check against quality guidelines and schema validation

---

## 📊 Success Metrics

- **Minimum**: 10 new high-quality feeds
- **Target**: 20-30 feeds across diverse topics
- **Stretch**: 50+ feeds with comprehensive topic coverage
- **Quality Bar**: >80% of feeds active in last 30 days
- **Diversity**: Feeds from at least 5 different platforms
- **Coverage**: Touches at least 10 different topic IDs from `topics.yaml`

---

## ⚠️ Common Pitfalls to Avoid

1. ❌ **Adding feeds already in `feeds.yaml`** → Always check current list
2. ❌ **Using invalid topic IDs** → Cross-reference `topics.yaml`
3. ❌ **Exceeding 6 topics per feed** → Schema violation
4. ❌ **Malformed URLs** → Must be valid HTTP(S)
5. ❌ **Generic/vague notes** → Be specific about value
6. ❌ **Ignoring platform auto-discovery** → Use homepage URLs when possible
7. ❌ **Adding inactive feeds** → Check recent post dates
8. ❌ **Missing required fields** → URL and topics are mandatory

---

## 🔧 Advanced Features

### Custom Titles
Only add custom `title` when:
- Auto-extracted title is misleading
- Feed title is too generic (e.g., "Blog")
- Disambiguation needed (e.g., "John Smith - AI Research" vs "John Smith - Photography")

### Notes Field Usage
Excellent notes examples:
- ✅ "Weekly summaries of ML papers by Google Brain researcher"
- ✅ "Updates 2-3x monthly; focuses on production ML systems"
- ✅ "Official blog; announces new model releases"
- ✅ "ArXiv author feed for Yoshua Bengio"

Poor notes examples:
- ❌ "Good blog"
- ❌ "ML content"
- ❌ "Check this out"

---

## 📚 Reference Materials

- **Schema Docs**: `data/feeds.schema.json`
- **Topic Taxonomy**: `data/topics.yaml` (1146 lines, 150+ topics)
- **Current Feeds**: `data/feeds.yaml` (check for duplicates)
- **Contributing Guide**: `CONTRIBUTING.md`
- **Project Docs**: `https://aiwebfeeds.com/docs`
- **LLM-Optimized Docs**: `https://aiwebfeeds.com/llms-full.txt`

---

## 🤖 AI Agent Self-Check

Before submitting output, verify:
- [ ] Read all three required files (feeds.yaml, schema, topics)
- [ ] Conducted research across multiple platforms
- [ ] Validated all URLs are accessible
- [ ] Confirmed no duplicates vs existing feeds
- [ ] All topic IDs exist in topics.yaml
- [ ] YAML syntax is valid (proper indentation, quotes)
- [ ] Each feed has 1-6 topics
- [ ] Notes are informative and concise
- [ ] Output is ready to append directly to feeds.yaml

---

**Version**: 2.1.0 | **Updated**: October 2025 | **Schema**: feeds-2.1.0