# Claude Code Review Setup

This repository uses Claude Code for automated PR reviews. Follow these steps to enable it:

## 1. Get Your Claude Code OAuth Token

1. Go to https://github.com/settings/tokens
2. Click "Generate new token" → "Generate new token (classic)"
3. Give it a descriptive name like "Claude Code Review Token"
4. Select the following scopes:
   - `repo` (Full control of private repositories)
   - `workflow` (Update GitHub Action workflows)
5. Click "Generate token"
6. Copy the token (you won't be able to see it again!)

## 2. Add Token to Repository Secrets

1. Go to your repository on GitHub
2. Navigate to Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Name: `CLAUDE_CODE_OAUTH_TOKEN`
5. Value: Paste the token you copied
6. Click "Add secret"

## 3. How to Use

The Claude Code review will automatically run when:
- A new PR is opened
- New commits are pushed to an existing PR

The review focuses on:
- Code quality and best practices
- Potential bugs or issues
- Performance considerations
- Security concerns
- Test coverage

## 4. Customization

The workflow is configured in `.github/workflows/claude-code-review.yml`

You can customize:
- Which files trigger reviews (uncomment the `paths` section)
- The review prompt (modify `direct_prompt`)
- Which PR authors trigger reviews (uncomment the author filter)
- Model selection (defaults to Claude Sonnet 4)

## Troubleshooting

If the action fails:
1. Check that `CLAUDE_CODE_OAUTH_TOKEN` is properly set in repository secrets
2. Ensure the token has the correct permissions
3. Check the workflow logs in the Actions tab

For more information: https://github.com/anthropics/claude-code-action