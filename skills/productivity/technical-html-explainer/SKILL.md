---
name: technical-html-explainer
description: Create self-contained, source-grounded technical HTML explainers for architecture, research plans, system walkthroughs, demos, business cases, or engineering briefs. Use when Codex is asked to turn repo/docs/Slack/Notion/GitHub evidence into an interactive HTML artifact with diagrams, tabs, controls, source links, and verification.
---

# Technical HTML Explainer

## Overview

Use this workflow to produce one inspectable HTML artifact that explains a technical system or plan from evidence. The artifact should be useful as the first screen, not a marketing page or a decorative shell.

The core output is a self-contained `.html` file with grounded claims, navigable structure, meaningful visuals, and local verification.

## Workflow

1. Lock the audience and question.
   - Identify whether the artifact is for research, onboarding, architecture review, sales engineering, customer proof, or execution planning.
   - State the main questions the artifact must answer, such as system design, scaling behavior, tradeoffs, local run steps, model-extension paths, or risk claims.

2. Gather source evidence before writing HTML.
   - Use the strongest available source systems first: repo files, docs, tests, generated artifacts, GitHub PRs/issues, Slack threads, Notion pages, and user-supplied plans.
   - For current external facts or official product/API behavior, verify against primary sources.
   - Record source links or local file paths that the artifact should cite.
   - Separate confirmed facts from reasoned interpretation.

3. Design the artifact around work, not explanation of the UI.
   - Start directly with the usable explainer.
   - Use tabs, diagrams, flows, comparison tables, callouts, or simple controls only when they help the audience inspect the subject.
   - Keep headings and labels dense enough for repeated scanning.
   - Include visual structure that reveals the actual system, plan, architecture, or tradeoff. Do not rely on generic gradients or decorative cards.

4. Write self-contained HTML.
   - Put CSS and JavaScript inline unless the user requests a framework.
   - Prefer semantic HTML, accessible controls, keyboard-friendly tabs, and stable responsive layout.
   - Keep source links in a visible Sources or Evidence section.
   - Use SVG or CSS diagrams for system-specific flows when real screenshots/assets are not necessary.
   - Avoid claims that are not supported by the gathered evidence.

5. Include the expected technical substance.
   - Architecture explainers: components, control/data flow, runtime path, storage/state, failure modes, scaling up/down, extension points, and tradeoffs.
   - Research plans: hypothesis, baseline, experiment sequence, metrics, stop/go criteria, artifacts, and open questions.
   - Business cases: model assumptions, sensitivity, defensible bounds, buyer objections, and unsupported claims removed or caveated.
   - Local walkthroughs: exact reproduced commands, prerequisites, expected outputs, cleanup, and known failure modes.

6. Verify before handoff.
   - Run static checks for a single HTML shell, required anchors/sections, expected source links, and inline JavaScript syntax.
   - If a browser target is allowed, open it and verify the first viewport, tab/control behavior, desktop/mobile layout, and absence of overlapping text.
   - If browser policy blocks local file access, do not route around the policy. Report the limitation and complete static verification.
   - Confirm the artifact is self-contained unless the user explicitly wanted external assets.

## Verification Commands

Adapt these checks to the actual artifact path:

```bash
ruby -e 's=STDIN.read; abort "missing doctype" unless s.include?("<!doctype html>"); abort "bad html tags" unless s.scan(/<html/).size==1 && s.scan(%r{</html>}).size==1; puts "html shell ok"' < artifact.html
perl -0777 -ne 'print $1 if /<script>(.*)<\/script>/s' artifact.html | node --check /dev/stdin
LC_ALL=C grep -n '[^ -~]' artifact.html || true
```

## Handoff

Return the artifact path, what it covers, the evidence sources used, and verification performed. Call out unsupported or inferred claims plainly.
