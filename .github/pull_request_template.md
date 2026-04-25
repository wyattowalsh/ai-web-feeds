## Description

<!-- Provide a brief description of the changes in this PR -->

## Type of Change

<!-- Mark the relevant option with an 'x' -->

- [ ] 🐛 Bug fix (non-breaking change which fixes an issue)
- [ ] ✨ New feature (non-breaking change which adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not
  work as expected)
- [ ] 📝 Documentation update
- [ ] 🔖 Feed addition/update
- [ ] 🎨 Code style/formatting
- [ ] ♻️ Code refactoring
- [ ] ⚡ Performance improvement
- [ ] ✅ Test update
- [ ] 🔧 Configuration change
- [ ] 📦 Dependency update

## Related Issues

<!-- Link related issues here using #issue_number -->

Fixes # Relates to #

## Changes Made

<!-- Describe the changes in detail -->

-
-
-

## Testing

<!-- Describe the testing you've done -->

- [ ] I have tested these changes locally
- [ ] I have added/updated tests for these changes
- [ ] All tests pass locally (`uv run aiwebfeeds test`)
- [ ] I have tested on multiple platforms/browsers (if applicable)

### Test Commands Run

<!-- Check all that apply and paste output if relevant -->

```bash
# Run these commands locally before submitting:

# Python linting and formatting
uv run ruff check .
uv run ruff format --check .

# Type checking
uv run mypy .

# Tests with coverage
uv run aiwebfeeds test --coverage

# Feed validation (if feeds changed)
uv run aiwebfeeds validate --all

# CLI smoke test
uv run aiwebfeeds --help
```

### Test Cases

<!-- Describe specific test cases -->

1.
1.
1.

## Documentation

<!-- Check all that apply -->

- [ ] I have updated the documentation accordingly
- [ ] I have updated code comments where necessary
- [ ] I have added/updated docstrings for new functions
- [ ] I have updated the FumaDocs site (`apps/web/content/docs/`)
- [ ] No documentation changes are needed

## Feed Validation

<!-- For feed additions/updates only - automated validation will run on PR -->

- [ ] Feed entry validates against `feeds.schema.json`
- [ ] Topics are from canonical `topics.yaml` list
- [ ] Platform configuration is correct (if applicable)
- [ ] Feed URL is accessible and working (tested with
  `uv run aiwebfeeds validate --feeds <url>`)
- [ ] Feed ID is unique and follows naming conventions
- [ ] Feed parsing succeeds (`uv run aiwebfeeds fetch --url <url>`)

### Feed Validation Output

<!-- If you added/modified feeds, paste validation output -->

```bash
# Validation command:
uv run aiwebfeeds validate --feeds "your-feed-url"

# Output:
# (paste here)
```

## Code Quality

<!-- Automated checks that will run - ensure these pass locally first -->

- [ ] Ruff linting passes (`uv run ruff check .`)
- [ ] Ruff formatting passes (`uv run ruff format --check .`)
- [ ] MyPy type checking passes (`uv run mypy .`)
- [ ] All tests pass with ≥90% coverage (`uv run aiwebfeeds test --coverage`)
- [ ] No new linting warnings introduced
- [ ] My code follows the project's style guidelines

## CLI Integration

<!-- If you modified CLI commands or added new ones -->

- [ ] CLI command works as expected
- [ ] CLI help text is clear and accurate (`uv run aiwebfeeds <command> --help`)
- [ ] CLI has proper error handling
- [ ] CLI output is well-formatted
- [ ] CLI tests added/updated

### CLI Command Demo

<!-- If applicable, show CLI usage -->

```bash
# Command:
uv run aiwebfeeds <command>

# Output:
# (paste here)
```

## Workflow Integration

<!-- If you modified GitHub Actions workflows -->

- [ ] Workflows pass locally with `act` (if possible)
- [ ] Workflow YAML is valid
- [ ] Workflow uses CLI commands (not duplicated logic)
- [ ] Workflow has proper error messages
- [ ] Workflow documentation updated in
  `apps/web/content/docs/development/workflows.mdx`

## Checklist

<!-- Ensure all requirements are met -->

- [ ] My code follows the project's code style guidelines
- [ ] I have performed a self-review of my own code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] My changes generate no new warnings or errors
- [ ] I have checked my code and corrected any misspellings
- [ ] I have read and followed the [Contributing Guidelines](../CONTRIBUTING.md)
- [ ] I have read the component-specific `AGENTS.md` file
- [ ] All local quality checks pass (see "Test Commands Run" section)

## Auto-Fix Available

<!-- The auto-fix workflow can help with formatting/linting issues -->

💡 **Tip**: Comment `/fix` on this PR to automatically fix formatting and linting issues!

## Screenshots/Demo

<!-- If applicable, add screenshots or demo links -->

## Breaking Changes

<!-- If this PR introduces breaking changes, describe them here and the migration path -->

## Performance Impact

<!-- If applicable, describe any performance implications -->

- [ ] I have benchmarked the changes
- [ ] Performance impact is acceptable
- [ ] No performance concerns

## Security Considerations

<!-- If applicable, describe security implications -->

- [ ] I have considered security implications
- [ ] No sensitive data is exposed
- [ ] Dependencies are from trusted sources
- [ ] No new security vulnerabilities introduced

## Additional Notes

<!-- Add any additional notes, context, or considerations for reviewers -->

## Reviewer Checklist

<!-- For maintainers reviewing this PR -->

- [ ] Code quality is acceptable
- [ ] Tests are adequate and passing
- [ ] Documentation is updated
- [ ] CLI integration is clean
- [ ] Workflows are enhanced
- [ ] No security concerns
- [ ] Performance is acceptable
- [ ] Breaking changes are documented

______________________________________________________________________

**Automated Checks**: This PR will automatically run:

- ✅ Quality Enforcement (linting, formatting, type checking)
- ✅ Test Coverage (≥90% required)
- ✅ Feed Validation (if `data/feeds.yaml` changed)
- ✅ Build Verification (web app)
- ✅ Security Scanning (CodeQL)

View workflow status in the **Checks** tab above.

- [ ] No security concerns
- [ ] Performance impact is acceptable
- [ ] Breaking changes are documented
