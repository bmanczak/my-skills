---
name: perfect-commit
description: Create and finalize a "perfect commit" that bundles a single focused implementation, tests, updated documentation, and an issue link. Use when the user asks to "create a perfect commit" (or similar), wants a perfect-commit checklist, or needs a Conventional Commits message plus git commands for an atomic change with an issue reference.
---

# Perfect Commit

## Overview

Guide the user through a strict checklist (implementation, tests, docs, issue link), fill gaps conversationally, then draft a commit message and propose git commands. Enforce the rule: if a change is testable and tests are missing, clearly state the rule break and require explicit confirmation to proceed.

## Workflow

### 1) Establish context

- Ask for a one-sentence summary of the change and where it lives in the repo.
- Check git status/diff when allowed to confirm scope and whether the change is a single focused "thing".
- If multiple concerns appear, propose splitting into multiple commits.

### 2) Checklist gating (do not proceed until satisfied or explicitly overridden)

- Implementation: Confirm the change is atomic and deployable.
- Tests: Decide if the change is testable.
  - Treat code/behavior changes as testable by default.
  - If tests are missing or failing, say this breaks the perfect-commit rule and ask whether to pause and add tests or explicitly proceed while acknowledging the rule break.
  - If a change is not testable (docs-only, comment-only, or no test harness exists), note "tests not applicable" and continue.
- Documentation: If the change affects public APIs, CLI, config, or expected behavior, require doc updates.
  - If docs are missing for such changes, state the rule break and request explicit confirmation to proceed.
  - If docs are not applicable, record that decision.
- Breaking change: Ask if the change breaks compatibility or requires migration.
  - If yes, require `!` in the header and a `BREAKING CHANGE:` footer, and require docs updates.
  - If no, do not include `!` or a `BREAKING CHANGE:` footer.
- Issue link: Require a link or issue number.
  - Accept #123, a raw number, or a full URL.
  - Use `gh issue view <number|url>` to resolve title and canonical link when available.
  - If gh is unauthenticated or the repo is unknown, ask the user for the full URL.
  - If the issue is not found or the user has not supplied one, ask whether you should create an issue.
    - In that question, include a short draft issue (title + body) for the user to approve or request changes.

### 3) Draft the commit message

- Use Conventional Commits format: `type: summary`.
- Use only these types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`.
- Keep the summary line short and imperative.
- Include the issue link in the body.
- Optionally include a "Tests:" line and "Docs:" line for clarity.

Example template:

type: summary

Issue: <link>
Tests: <command or "n/a">
Docs: <path or "n/a">

BREAKING CHANGE: <required only when the change breaks compatibility>

### 4) Propose git commands

- Suggest a safe sequence (`git add <paths>`, `git commit -m ...` or `git commit` with an editor) and ask where (and whether) to run it.
- Do not run commands without explicit user confirmation and target location.
- When creating or editing PRs with `gh pr create/edit`, **never** embed `\n` inside a single `--body` string. Use a here-doc and `--body-file` instead to preserve newlines, e.g.:
  ```
  cat <<'EOF' > /tmp/pr_body.md
  ## Summary
  - ...
  EOF
  gh pr edit <pr> --body-file /tmp/pr_body.md
  ```
- If you are creating or editing a PR body, include a GitHub auto-close keyword under the Issue section (e.g., `Fixes #123` or `Closes #123`) so the issue closes automatically when the PR is merged.

### 5) Logical micro-commits (multi-file features)

When a feature touches many files across concerns (implementation, tests, docs, CI), prefer **logical micro-commits** over a single large commit. This improves reviewability and git bisectability.

**Standard decomposition pattern:**

1. `feat(<scope>)` — core implementation (source code, config templates)
2. `test(<scope>)` — tests and fixtures for the implementation
3. `docs` — README, setup guides, integration index updates
4. `chore(ci)` — CI/workflow changes (test matrix, pipeline config)

**Rules:**
- Each micro-commit must be self-consistent (no broken imports or missing references)
- All micro-commits share the same `Issue:` link
- Follow the repo's existing commit pattern (check `git log --oneline -10` for style)
- Never include generated files (.env with secrets, __pycache__, logs, lock file drift)
- Run pre-commit hooks pass on each commit individually

**When to use:** Features adding a new package, adapter, integration, or module with its own tests and docs. If the whole change is < 5 files in one concern, a single perfect commit is fine.

### 6) Exceptions and scrappy branches

- If the user explicitly wants a non-perfect commit, suggest using a feature branch and squashing into one perfect commit later.
- Allow a "ship it" exception for trivial docs/typos, but explicitly label it as a perfect-commit exception.
