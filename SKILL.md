---
name: devops-vault-publish
description: Publish reviewed Daily, Weekly, Review, or Wiki knowledge to the private devops-vault Git repository through a dry-run, branch, validation, and Draft PR workflow. Use for team-shareable DevOps knowledge, not for the personal Obsidian archive vault.
---

# DevOps Vault Publish

Use this skill when the user explicitly wants team-shareable DevOps knowledge published to `devops-vault`. Keep the existing `obsidian-daily-archive` workflow separate: it writes the personal Obsidian Vault and must not be repointed here.

## Scope and routing

- **Daily**: manual only. Do not generate it merely because a calendar day has passed.
- **Review, incident review, and Wiki**: manual only; require source and conclusion review.
- **Weekly**: manual generation is supported. A separate local scheduler may create a Draft PR for the previous complete ISO week, but it never merges.
- Do not use this workflow for private notes, credentials, unredacted production logs, customer data, or full configuration exports.

## Preflight

Before generating content:

1. Confirm the target is team-shareable and identify its document type.
2. Require a source reference and a concise conclusion. For Daily and Review, collect relevant tags when available.
3. Redact secrets, tokens, private keys, customer data, and unnecessary production identifiers. If safe redaction would materially change the conclusion, stop and ask for a sanitized source instead.
4. Work in `/Users/liuzelin/github/devops-vault`. Confirm it is on a clean `main` branch before execution.
5. Create the body in a temporary file outside the repository. Do not write generated prose directly into `main`.

## Human-triggered publishing

First run the corresponding command in dry-run mode and report the planned branch and path. Obtain explicit user confirmation before adding `--execute`.

```bash
# Daily
node scripts/generate-daily.mjs --date YYYY-MM-DD --body-file /absolute/path/body.md

# Weekly
node scripts/generate-weekly.mjs --week YYYY-Www --body-file /absolute/path/body.md

# Review or incident review
node scripts/generate-review.mjs --title 'Title' --slug stable-slug --date YYYY-MM-DD --source 'sanitized source reference' --body-file /absolute/path/body.md
```

After confirmation, use `--execute`. Use `--push --create-pr` only when GitHub CLI authentication is available. The resulting PR must remain a Draft until a human verifies the source, redaction, and conclusions.

## Required safeguards

- Never push directly to `main`, bypass validation, or automatically merge.
- Always preserve any unrelated working-tree changes; stop instead of stashing or resetting them.
- If `npm run validate` fails, leave the generated branch for review and report the precise failure. Do not retry by weakening validation.
- Pass `--source` for every Review so its frontmatter records a safe repository-relative path, stable external link, or sanitized incident reference.
- For Wiki changes, use the same guarded Review path unless a dedicated Wiki generator is added and validated.

## Scheduled Weekly boundary

The scheduler is only for a Weekly Draft PR. Its adapter receives an output path and ISO week, then writes only sanitized Markdown body content. It must not modify Git, create branches, push, create PRs, or expose credentials. The repository script owns Git operations.

`scripts/openclaw-weekly-adapter.mjs` is the approved adapter implementation. It only summarizes existing merged `daily/YYYY/MM/YYYY-MM-DD.md` and `reviews/YYYY/YYYY-MM-DD-*.md` files for the requested ISO week; no source files means a non-zero exit and no empty Weekly PR. The adapter invokes OpenClaw in direct mode, supplies those repository documents in the prompt, writes only the resulting Markdown body to the caller-provided temporary path, and never writes to the vault repository.

Read `/Users/liuzelin/github/devops-vault/docs/launchd-weekly-adapter.md` when creating or changing that adapter.
