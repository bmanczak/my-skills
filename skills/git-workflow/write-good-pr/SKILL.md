---
name: write-good-pr
description: Draft or rewrite adaptive, reviewer-first PR descriptions. Use when asked to prepare a PR body from issues, specs, conversation notes, code diffs, existing PR text, or review feedback. The goal is the shortest clear description that lets reviewers understand the change, review the right surface first, and verify the outcome.
---

# Write Good PR Descriptions

## Purpose

Write PR bodies that help a human review quickly and correctly.

The output should be as long as needed and as short as possible. Prefer a clear reviewer guide over a rigid template. A section earns its place only if it helps the reviewer understand the change, inspect the right code, or verify behavior.

## Gather Sources First

Use the strongest available sources before writing:

1. Current PR title/body, linked issues, and review comments.
2. User-provided notes and explicit decisions from the conversation.
3. The actual diff, changed-file list, and test output.
4. Specs, design docs, README changes, or generated artifacts referenced by the PR.
5. Prior PRs in a stack only when they define the handoff or dependency.

Do not invent rationale. If a claim is unsupported, omit it or ask the user. Do not write placeholder phrases like "not documented in sources."

## Adaptive Algorithm

1. Identify the review story in one sentence: what changed, why it matters, and what proves it works.
2. Classify the PR shape:
   - Tiny fix/refactor: concise bullets, behavior change, tests, footer.
   - Medium feature: TL;DR, problem, implementation choice, tests, footer.
   - Large/system PR: TL;DR, problem, whole flow, what to review first, contracts or golden path, important changes, non-goals, tests, footer.
   - Generated-heavy PR: add explicit guidance on what reviewers should inspect and how to treat generated files.
3. If rewriting an existing PR that is closed, abandoned, superseded, or not meant to merge, state that near the top.
4. Choose sections from the library below. Omit, merge, rename, shorten, or expand sections based on the PR.
5. Put the highest-value review context near the top. Avoid making reviewers search for the design boundary.
6. End with tests and issue-closing footer.

## Section Library

Use these sections when they earn their place.

### `## TL;DR`

Use for most PRs. Keep to 3-6 concrete bullets. State outcomes, not vague activity.

Good:

- Implements `agentwarden-guardrails compile`: deterministic lowering from `draft_spec.json` into runtime YAML plus review artifacts.
- Runtime YAML stays canonical-event based; target-specific support facts live in JSON review artifacts.

Avoid:

- Refactors code and updates docs.
- Improves the system.

### `## Problem this PR fixes`

Use when the why is not obvious from the title. Numbered lists work well for multi-part problems. Make every item understandable to someone who did not author the PR.

### Flow or Design Explanation

Use for feature, architecture, pipeline, or contract changes. Name the real boundaries:

- what decides
- what transforms
- what validates
- what is explicitly not re-decided

Prefer compact data/control flow over file inventory.

Example pattern:

```text
agentwarden-guardrails draft
  -> draft_spec.json
  -> agentwarden-guardrails compile
  -> shared target compatibility resolver
  -> signals_and_policies.yaml
  -> lineage + compatibility + replay + summary artifacts
```

Example contract language:

```text
Draft decides both:

- when a row fires: ActivationPredicateSpec
- what happens when it fires: downstream

Compile only lowers that contract:

- non-model rows: activation predicate -> flag -> policy effect
- model-based rows: activation predicate + guardrail verdict -> flag -> policy effect
- removed tools: tool alias match -> deny policy
```

### `## What To Review First`

Use for large PRs, generated-heavy PRs, or PRs with broad file churn. Keep this section practical:

- Point reviewers to the core design/logic surface first.
- Explain which generated files are acceptance artifacts.
- Tell reviewers how to inspect generated outputs without line-reviewing all of them.

Example pattern:

```text
Review the design surface first, not the generated artifacts:

1. `compiler.py` - requirement lowering, bindings, effect mapping, lineage, compatibility diagnostics.
2. `flow.py` - orchestration, target parsing, removed-tool denies, replay, artifact writing.
3. `test_compiler.py` - regression proof for target compile and artifact shape.

Generated `e2e/generated/*` files are acceptance artifacts. Review summaries and representative lineage rows; do not line-review the full generated YAML unless a summary points to a specific row.
```

### Contracts, Examples, or Golden Path

Use when a reviewer needs one concrete case to understand the general behavior.

Good examples:

- a CLI command
- a minimal YAML/JSON snippet
- one before/after behavior
- a golden fixture path and how it proves the PR

Omit examples when they are redundant.

### `## Most Important Changes`

Use when it helps map behavior to code areas. Group by subsystem or behavior. Do not list every changed file. Prefer code areas over path dumps.

### `## What This PR Does Not Do`

Use when non-goals prevent misreview or scope confusion. Keep it short. Do not add obvious non-goals.

### `## Tests`

Use exact commands and outcomes when available. For docs-only PRs, say no code tests were needed and list the validation performed. For generated deployment/config PRs, point to the source build and deployment checks instead of inventing local tests.

Do not include transient review state such as who approved the PR unless the user explicitly asks for a retrospective body. CI status is useful only when it is the verification source for the change or the user asks for current status.

### Issue Footer

Use closing syntax when appropriate:

```text
Fixes #123.
Closes ABC-456.
Depends on #789.
Parent: #100.
```

Only mention dependency/parent PRs when they affect review or merge order.

## Style Rules

- Clear, concrete, and direct. No filler.
- Prefer precise nouns and verbs over broad claims like "improves", "enhances", or "cleans up".
- Do not force Q&A, examples, before/after blocks, or section headings.
- Do not mention internal stage names or PR numbers unless they are useful for review or merge context.
- Avoid file-by-file narration unless the PR is small enough that file names are the clearest explanation.
- Explain surprising behavior changes, compatibility boundaries, generated artifacts, and deployment risks explicitly.
- If generated files dominate the diff, say which files are generated and what reviewers should inspect instead.
- Do not leak sensitive internal details unless the user explicitly asks and the PR needs them.

## Final Checklist

Before posting or updating the PR body, verify:

- The TL;DR tells a reviewer what changed and why it matters.
- The core design boundary is explicit for any non-trivial PR.
- The review path is clear for large or generated-heavy diffs.
- Claims match the issue, code diff, tests, and conversation decisions.
- Sections that do not help the reviewer were omitted.
- Closed, superseded, or abandoned PRs say so if the body is being rewritten after the fact.
- Tests and issue footer are current.
