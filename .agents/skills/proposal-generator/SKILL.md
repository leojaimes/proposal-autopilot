---
name: proposal-generator
description: "Trigger: generar propuesta, batch proposals, cover letter, proposal generator, Google Doc proposal. Generate ranked, job-specific Upwork proposals with a 35-word cover letter, Mermaid diagram, and document link."
license: Apache-2.0
metadata:
  author: spotlight-engineering
  version: "2.0"
---

## Activation Contract

Use this skill after fit ranking when the user asks for one proposal or a batch. Read `positioning.md` and the complete job description before drafting.

## Hard Rules

- Process jobs in descending Fit Score and preserve the factor breakdown.
- Scan the full description for a contact name, signature, or company mention. Use it when found; otherwise use `Hey there,` or `Hi,`. Never use formal generic greetings.
- Keep the cover letter between 30 and 35 words, including the document link. Count words programmatically. No em dashes.
- Write in first person and name the specific project. Use a relevant proof story, never invented facts or placeholders.
- Include a 5–6 step technical approach with real methods/tools: Figma, Figma Make, Claude, Qualtrics, N8N, usability testing, and heuristic evaluation when relevant.
- Render a Mermaid `flowchart TD` with at most 6 nodes that matches the proposal steps.
- Create one clean Google Doc per job with real headings and the rendered diagram embedded. If the Docs connector is unavailable, use the public walkthrough fallback and mark the document as pending.

## Execution Steps

1. Load the job, fit score, `positioning.md`, proof stories, and profile voice rules.
2. Discover the contact name and select the closest proof story.
3. Draft the technical proposal, deliverables, and a realistic 10–15 business-day timeline.
4. Generate the Mermaid diagram and validate node/step parity.
5. Create the Google Doc or fallback walkthrough, then draft the ≤35-word cover letter with its link.
6. Return one structured proposal record per job, sorted by Fit Score.

## Output Contract

Return `contactName`, `coverLetter35Words`, `technicalProposalBody`, `mermaidDiagramCode`, `proposalDocLink`, `fitScore`, factor breakdown, validation errors, and document status.

## References

- `positioning.md`
- `references/proposal-generation-core.md`
- `assets/hex-color-proposal-brief.json`
