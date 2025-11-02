# `.github` Directory - Agent Instructions

> **Component**: GitHub Configuration & Workflows\
> **Location**: `.github/`\
> **Parent**: [Root AGENTS.md](../AGENTS.md)

## 📍 Essential Links

- **Root Instructions**: [../AGENTS.md](../AGENTS.md)
- **Contributing Guide**: [../CONTRIBUTING.md](../CONTRIBUTING.md)
- **Full Documentation**: [llms-full.txt](https://aiwebfeeds.com/llms-full.txt)

______________________________________________________________________

## 🎯 Purpose

GitHub-specific configuration:

- **Issue Templates**: Bug reports, feature requests
- **PR Templates**: Pull request structure
- **Workflows**: CI/CD automation (future)
- **Community Files**: Code of conduct, security policy

______________________________________________________________________

## 📐 Development Rules

### DO

✅ Follow existing template formats\
✅ Link to relevant documentation\
✅ Keep templates concise and clear\
✅ Test workflow changes in forks first

### DON'T

❌ Add workflows without testing\
❌ Modify templates without discussion\
❌ Remove required fields from templates\
❌ Commit secrets or tokens

______________________________________________________________________

## 📚 Reference

**GitHub docs**: [docs.github.com](https://docs.github.com)\
**Root workflow**: [../AGENTS.md](../AGENTS.md#standard-workflow)

______________________________________________________________________

## 🆕 Planned Workflows (Coming Soon)

### CI/CD Pipeline

- **Lint & Test**: Run on all PRs
- **Data Validation**: Check YAML/JSON schemas
- **Topic Graph Validation**: Ensure no cycles, valid relations
- **Coverage Check**: Enforce ≥90% threshold
- **Deploy Docs**: Auto-deploy web on main branch updates

### Scheduled Jobs

- **Feed Health Check**: Daily validation of all feeds
- **OPML Regeneration**: Weekly rebuild of OPML files
- **Topic Taxonomy Audit**: Monthly schema compliance check

______________________________________________________________________

*Updated: October 15, 2025 · Version: 0.1.0*
