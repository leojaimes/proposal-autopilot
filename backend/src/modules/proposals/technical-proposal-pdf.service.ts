import { Injectable, Logger } from '@nestjs/common';

export interface GeneratePdfInput {
  jobTitle: string;
  clientCountry?: string;
  budget?: string;
  clientRating?: number;
  clientTotalSpend?: number;
  contactName: string;
  coverLetter35Words: string;
  technicalProposalBody: string;
  mermaidDiagramCode: string;
  proofStoryCompany?: string;
  proofStoryMetric?: string;
  profileHeadline?: string;
}

@Injectable()
export class TechnicalProposalPdfService {
  private readonly logger = new Logger(TechnicalProposalPdfService.name);
  private readonly gotenbergUrl =
    process.env.GOTENBERG_URL ||
    'https://pepper-tix-gotenberg.zh4nwb.easypanel.host/forms/chromium/convert/html';

  /**
   * Generates a high-fidelity executive PDF proposal with vector Mermaid diagrams.
   */
  async generateTechnicalProposalPdf(input: GeneratePdfInput): Promise<Buffer> {
    this.logger.log(`📄 Generating Executive PDF via Gotenberg for "${input.jobTitle}"`);

    const htmlContent = this.buildHtmlTemplate(input);

    const formData = new FormData();
    formData.append(
      'files',
      new Blob([htmlContent], { type: 'text/html' }),
      'index.html'
    );
    // Give Chromium 1.5 seconds to fetch Mermaid from CDN and render SVGs before printing to PDF
    formData.append('waitDelay', '1.5s');

    try {
      const response = await fetch(this.gotenbergUrl, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Gotenberg HTTP ${response.status}: ${errorText}`);
        throw new Error(`Gotenberg failed (${response.status}): ${errorText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const pdfBuffer = Buffer.from(arrayBuffer);
      this.logger.log(`✓ PDF successfully generated (${pdfBuffer.length} bytes)`);
      return pdfBuffer;
    } catch (error: any) {
      this.logger.error(`Failed to generate PDF via Gotenberg: ${error.message}`);
      throw error;
    }
  }

  /**
   * Builds the corporate executive HTML template tailored for Upwork attachments.
   */
  private buildHtmlTemplate(input: GeneratePdfInput): string {
    const formattedDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const bodyHtml = this.markdownToHtml(input.technicalProposalBody);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Strategic Proposal & Roadmap: ${this.escapeHtml(input.jobTitle)}</title>
  <!-- Google Fonts: Inter & JetBrains Mono -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
  <!-- Mermaid JS for Vector Architecture Diagrams -->
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <script>
    document.addEventListener("DOMContentLoaded", function() {
      mermaid.initialize({
        startOnLoad: true,
        theme: 'neutral',
        flowchart: {
          curve: 'basis',
          useMaxWidth: true,
          htmlLabels: true
        },
        themeVariables: {
          fontFamily: 'Inter, sans-serif',
          primaryColor: '#e0e7ff',
          primaryBorderColor: '#6366f1',
          primaryTextColor: '#1e1b4b',
          lineColor: '#4f46e5',
          secondaryColor: '#f1f5f9',
          tertiaryColor: '#f8fafc'
        }
      });
    });
  </script>
  <style>
    @page {
      size: letter;
      margin: 18mm 18mm 18mm 18mm;
      @bottom-right {
        content: "Page " counter(page) " of " counter(pages);
        font-family: 'Inter', sans-serif;
        font-size: 8pt;
        color: #94a3b8;
      }
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #1e293b;
      background-color: #ffffff;
      line-height: 1.55;
      font-size: 10pt;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* Header Bar */
    .header {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 14px;
      margin-bottom: 20px;
    }

    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }

    .badge-confidential {
      display: inline-block;
      font-size: 7.5pt;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      background-color: #0f172a;
      color: #ffffff;
      padding: 4px 10px;
      border-radius: 4px;
    }

    .header-meta {
      font-size: 8.5pt;
      color: #64748b;
      font-weight: 500;
    }

    .job-title {
      font-size: 17pt;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.25;
      margin-bottom: 8px;
      letter-spacing: -0.02em;
    }

    .meta-pills {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-top: 6px;
    }

    .pill {
      font-size: 8pt;
      font-weight: 600;
      background-color: #f1f5f9;
      color: #334155;
      padding: 3px 9px;
      border-radius: 4px;
      border: 1px solid #e2e8f0;
    }

    .pill-accent {
      background-color: #e0e7ff;
      color: #3730a3;
      border-color: #c7d2fe;
    }

    /* Executive Brief Callout */
    .executive-brief {
      background-color: #f8fafc;
      border-left: 4px solid #4f46e5;
      padding: 12px 16px;
      border-radius: 0 8px 8px 0;
      margin-bottom: 22px;
    }

    .executive-brief-title {
      font-size: 8pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #4f46e5;
      margin-bottom: 4px;
    }

    .executive-brief-content {
      font-size: 9.5pt;
      font-style: italic;
      color: #334155;
      line-height: 1.5;
    }

    /* Markdown Rendered Content Styles */
    .proposal-body h1, .proposal-body h2 {
      color: #0f172a;
      font-size: 12pt;
      font-weight: 700;
      margin-top: 20px;
      margin-bottom: 8px;
      padding-bottom: 4px;
      border-bottom: 1px solid #e2e8f0;
      letter-spacing: -0.01em;
      page-break-after: avoid;
    }

    .proposal-body h3 {
      color: #334155;
      font-size: 10pt;
      font-weight: 600;
      margin-top: 14px;
      margin-bottom: 6px;
      page-break-after: avoid;
    }

    .proposal-body p {
      margin-bottom: 10px;
      color: #334155;
      text-align: justify;
    }

    .proposal-body ul, .proposal-body ol {
      margin-left: 20px;
      margin-bottom: 12px;
      color: #334155;
    }

    .proposal-body li {
      margin-bottom: 5px;
    }

    .proposal-body strong {
      color: #0f172a;
    }

    /* Executive Callout Cards (Metrics & Validation) */
    .metric-card {
      margin: 14px 0;
      padding: 12px 16px;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-left: 4px solid #10b981;
      border-radius: 6px;
      page-break-inside: avoid;
    }

    .metric-card-tag {
      font-size: 7.5pt;
      font-weight: 800;
      color: #047857;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 5px;
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .metric-card-content {
      font-size: 9.5pt;
      color: #064e3b;
      font-weight: 500;
      line-height: 1.5;
    }

    .validation-card {
      margin: 14px 0;
      padding: 12px 16px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: 4px solid #6366f1;
      border-radius: 6px;
      page-break-inside: avoid;
    }

    .validation-card-tag {
      font-size: 7.5pt;
      font-weight: 800;
      color: #4f46e5;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 5px;
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .validation-card-content {
      font-size: 9pt;
      color: #334155;
      line-height: 1.5;
    }

    /* Horizontal Architecture Pipeline Chain */
    .pipeline-container {
      margin: 16px 0;
      padding: 14px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      page-break-inside: avoid;
    }

    .pipeline-label {
      font-size: 7.5pt;
      font-weight: 800;
      color: #4f46e5;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 10px;
    }

    .pipeline-flow {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }

    .pipeline-step {
      font-family: 'JetBrains Mono', monospace;
      font-size: 7.5pt;
      font-weight: 600;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      color: #0f172a;
      padding: 5px 10px;
      border-radius: 5px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.04);
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }

    .pipeline-num {
      background: #e0e7ff;
      color: #4338ca;
      font-size: 6.5pt;
      font-weight: 800;
      width: 15px;
      height: 15px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .pipeline-arrow {
      color: #6366f1;
      font-weight: bold;
      font-size: 9pt;
    }

    /* Sleek Code Blocks */
    .code-block {
      font-family: 'JetBrains Mono', monospace;
      font-size: 8pt;
      background: #0f172a;
      color: #f1f5f9;
      padding: 12px 16px;
      border-radius: 6px;
      margin: 12px 0;
      white-space: pre-wrap;
      line-height: 1.5;
      page-break-inside: avoid;
    }

    /* Diagram Roadmap Box */
    .roadmap-section {
      page-break-inside: avoid;
      margin: 22px 0;
      padding: 16px;
      background: #fafaf9;
      border: 1px solid #e7e5e4;
      border-radius: 8px;
      text-align: center;
    }

    .roadmap-header {
      font-size: 8.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #44403c;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #e7e5e4;
      padding-bottom: 6px;
    }

    .mermaid {
      display: flex;
      justify-content: center;
      margin: 8px 0;
    }

    /* Footer Note */
    .footer-note {
      margin-top: 30px;
      padding-top: 12px;
      border-top: 1px dashed #cbd5e1;
      font-size: 7.5pt;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
      page-break-inside: avoid;
    }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="header">
    <div class="header-top">
      <span class="badge-confidential">Strategic Execution Proposal</span>
      <span class="header-meta">${formattedDate} · Prepared for ${this.escapeHtml(input.contactName)}</span>
    </div>

    <h1 class="job-title">${this.escapeHtml(input.jobTitle)}</h1>

    <div class="meta-pills">
      ${input.clientCountry ? `<span class="pill">📍 Target: ${this.escapeHtml(input.clientCountry)}</span>` : ''}
      ${input.budget ? `<span class="pill">💰 ${this.escapeHtml(input.budget)}</span>` : ''}
      ${input.proofStoryCompany ? `<span class="pill pill-accent">🏆 Authority: ${this.escapeHtml(input.proofStoryCompany)} (${this.escapeHtml(input.proofStoryMetric || '')})</span>` : ''}
      <span class="pill">⏱️ 90-Day Execution Plan</span>
    </div>
  </div>

  <!-- Executive Summary (The 35-word Hook & Bridge) -->
  <div class="executive-brief">
    <div class="executive-brief-title">Executive Summary & Strategic Orientation</div>
    <div class="executive-brief-content">
      "${this.escapeHtml(input.coverLetter35Words)}"
    </div>
  </div>

  <!-- Proposal Technical Body -->
  <div class="proposal-body">
    ${bodyHtml}
  </div>

  <!-- Embedded Vector Mermaid Roadmap -->
  ${input.mermaidDiagramCode ? `
  <div class="roadmap-section">
    <div class="roadmap-header">
      <span>System Architecture & Execution Milestones</span>
      <span style="font-family: 'JetBrains Mono', monospace; font-size: 7pt; color: #78716c;">FLOWCHART TD · VECTOR</span>
    </div>
    <div class="mermaid">
${input.mermaidDiagramCode.trim()}
    </div>
  </div>
  ` : ''}

  <!-- Footer -->
  <div class="footer-note">
    <span>Proposal Autopilot Enterprise · Verified Proof of Work</span>
    <span>Confidential Client Deliverable</span>
  </div>

</body>
</html>`;
  }

  /**
   * Lightweight Markdown-to-HTML formatter with Executive Card upgrades.
   */
  private markdownToHtml(md: string): string {
    if (!md) return '';

    let html = md;

    // Remove top level title if present to avoid duplication
    html = html.replace(/^#\s+.+$/m, '');

    // 1. Process code blocks (``` ... ```)
    html = html.replace(/```(?:[\w]*)\s*([\s\S]*?)```/g, (match, codeContent) => {
      const trimmed = codeContent.trim();
      // Check if this looks like a flowchart / ASCII pipeline (has [Step] brackets and arrows or pipes)
      const bracketMatches = trimmed.match(/\[([^\]]+)\]/g);
      if (bracketMatches && bracketMatches.length >= 2 && (/[-—]>[▶>]/i.test(trimmed) || /\|/i.test(trimmed) || /▼/i.test(trimmed))) {
        // Transform into an executive horizontal pipeline!
        const steps = bracketMatches.map((b: string) => b.replace(/^\[|\]$/g, '').trim());
        const pipelineHtml = steps
          .map(
            (step: string, idx: number) =>
              `<div class="pipeline-step"><span class="pipeline-num">${idx + 1}</span> ${this.escapeHtml(step)}</div>`
          )
          .join('<span class="pipeline-arrow">➔</span>');

        return `<div class="pipeline-container"><div class="pipeline-label">⚡ System Automation Flow</div><div class="pipeline-flow">${pipelineHtml}</div></div>`;
      }

      // If it's actual code, render inside an executive code block
      return `<pre class="code-block"><code>${this.escapeHtml(trimmed)}</code></pre>`;
    });

    // Clean any orphan triple backticks
    html = html.replace(/```/g, '');

    // Headings
    html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

    // Bold & Italic
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Special Executive Callouts for Metrics & Validation
    html = html.replace(
      /^\s*(?:[-*•]\s+)?(?:<strong>)?(?:Concrete Metric|Metric|Key Result)(?:<\/strong>)?:?\s*(.+)$/gim,
      '<div class="metric-card"><div class="metric-card-tag">📊 Concrete Metric & Measurable ROI</div><div class="metric-card-content">$1</div></div>'
    );

    html = html.replace(
      /^\s*(?:[-*•]\s+)?(?:<strong>)?(?:Testing & Validation|Validation)(?:<\/strong>)?:?\s*(.+)$/gim,
      '<div class="validation-card"><div class="validation-card-tag">🛡️ Testing & Validation Benchmark</div><div class="validation-card-content">$1</div></div>'
    );

    // Standard Unordered lists
    html = html.replace(/^\s*-\s+(.+)$/gm, '<li>$1</li>');

    // Group adjacent <li> into <ul>
    html = html.replace(/(<li>.*?<\/li>(?:\s*<li>.*?<\/li>)*)/gs, '<ul>$1</ul>');

    // Paragraphs
    const blocks = html.split(/\n\s*\n/);
    html = blocks
      .map((block) => {
        const trimmed = block.trim();
        if (
          trimmed.startsWith('<h') ||
          trimmed.startsWith('<ul') ||
          trimmed.startsWith('<li') ||
          trimmed.startsWith('<div') ||
          trimmed.startsWith('<pre') ||
          trimmed === ''
        ) {
          return trimmed;
        }
        return `<p>${trimmed}</p>`;
      })
      .join('\n');

    return html;
  }

  private escapeHtml(str: string): string {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
