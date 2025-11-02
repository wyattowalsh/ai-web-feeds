# GitHub Infrastructure

All documentation for GitHub workflows, issue templates, and automation has been
integrated into the main documentation site.

📖
**[View Full Documentation](https://ai-web-feeds.vercel.app/docs/guides/github-infrastructure)**

## Quick Links

- [Feed Submission Guide](https://ai-web-feeds.vercel.app/docs/guides/github-infrastructure#issue-templates)
- [Feed Schema Reference](https://ai-web-feeds.vercel.app/docs/guides/feed-schema)
- [Contributing Guide](https://ai-web-feeds.vercel.app/docs/development/contributing)
- [Testing Guide](https://ai-web-feeds.vercel.app/docs/guides/testing)

## Local Testing

Test feed submissions locally before creating an issue:

```bash
python scripts/test-feed-submission.py \
  --id "example-blog" \
  --feed "https://example.com/feed.xml" \
  --title "Example Blog" \
  --topics "ml" "nlp" \
  --source-type "blog"
```

See the
[full documentation](https://ai-web-feeds.vercel.app/docs/guides/github-infrastructure#helper-scripts)
for more details.
