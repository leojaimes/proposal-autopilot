# Proposal-generation core logic

## Contact discovery

Search the entire job description, including final paragraphs and signatures, for `thanks, Sara`, `best, John`, `I'm Mike from Acme`, a named owner, or an explicit first-person client introduction. Return the first reliable first name. If none exists, return `there` and open with `Hey there,`. Never guess from a company name or use `Dear Sir/Madam`, `Dear Hiring Manager`, or `Hiring Team`.

## Proposal shape

Use this order, with no raw Markdown left in the Google Doc after formatting:

1. **Diagnostic hook:** one line proving the specific project was considered before writing.
2. **Positioning intro:** first person, result before tools, plus the closest proof story from `positioning.md`.
3. **Technical approach:** five or six numbered steps. Adapt to the job, naming concrete methods where relevant: Claude for research synthesis and content generation, Qualtrics for structured research, information architecture and workflow mapping, Figma/Figma Make for rapid prototyping and design tokens, N8N for agentic automation, and usability testing plus heuristic evaluation for validation.
4. **Deliverables and timeline:** use a realistic 10–15 business-day plan covering discovery/architecture, core prototype or implementation, testing, and handoff.
5. **Decision note:** state assumptions or missing inputs instead of inventing them.

The diagram must be `flowchart TD`, contain no more than six nodes, and map one-to-one to the technical steps. Render it to an image before embedding it in the document.

## Cover letter validator

The cover letter is separate from the full proposal and must be 30–35 words including the link token. Count whitespace-delimited words after replacing the final URL with `[link]`. Use this shape:

```text
Hey [Name], I work with [specific project tool] daily. Having [relevant proof metric], I mapped the technical architecture for [project]. Free walkthrough and roadmap here: [link].
```

Use `Hey there,` when the contact name is unknown. Reject em dashes, generic filler, unsupported metrics, and any placeholder other than the final link.

## Google Doc contract

Create one document per job. Use real heading levels, an executive summary, numbered approach steps, deliverables, timeline, assumptions, and the rendered Mermaid image. Return the document URL and status. A local walkthrough URL is an explicit fallback, not a fabricated Google Doc URL.

## Batch record

```json
{
  "fitScore": 0,
  "factorBreakdown": { "skillMatch": 0, "aiDeliveryFeasibility": 0, "clientQuality": 0, "recency": 0 },
  "contactName": "there",
  "coverLetter35Words": "",
  "technicalProposalBody": "",
  "mermaidDiagramCode": "",
  "proposalDocLink": "",
  "documentStatus": "READY|PENDING|BLOCKED",
  "validationErrors": []
}
```

## HEX-COLOR guard

The provided HEX-COLOR line is a seed, not a complete job description. Use its Figma/Meta/25% proof only when the job text supports the connection. Require the full description before claiming a contact name, exact deliverables, or a client-specific architecture.
