import "server-only";

const BLOCK_PATTERNS = [
  {
    label: "aside.popup",
    regex: /<aside\b[^>]*class="[^"]*\bpopup\b[^"]*"[^>]*>[\s\S]*?<\/aside>/gi,
  },
  {
    label: ".modal-backdrop",
    regex: /<div\b[^>]*class="[^"]*\bmodal-backdrop\b[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>?/gi,
  },
  {
    label: ".human-check",
    regex: /<div\b[^>]*class="[^"]*\bhuman-check\b[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
  },
  {
    label: ".demo-controls",
    regex: /<div\b[^>]*class="[^"]*\bdemo-controls\b[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
  },
];

const BUTTON_TEXTS = [
  "Click here maybe?",
  "Continue as human",
  "Reject maybe",
  "Subscribe",
  "tiny hidden close",
];

function stripScripts(html: string): string {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
}

function absolutizeAssetUrls(html: string, sourceUrl: string): string {
  const origin = new URL(sourceUrl).origin;
  return html.replace(
    /\b(href|src)=["']\/([^"']*)["']/gi,
    (_match, attr: string, path: string) => `${attr}="${origin}/${path}"`,
  );
}

function removeButtonsByText(
  html: string,
): { html: string; removedButtons: string[] } {
  let next = html;
  const removedButtons: string[] = [];

  for (const text of BUTTON_TEXTS) {
    const pattern = new RegExp(
      `<button\\b[^>]*>[\\s\\S]*?${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?<\\/button>`,
      "gi",
    );
    if (pattern.test(next)) {
      removedButtons.push(text);
      next = next.replace(pattern, "");
    }
  }

  return { html: next, removedButtons };
}

function extractMainContent(html: string): string {
  const match = html.match(/<main\b[^>]*>[\s\S]*?<\/main>/i);
  return match?.[0] ?? html;
}

function wrapTrustedDocument(bodyHtml: string, sourceUrl: string): string {
  const origin = new URL(sourceUrl).origin;
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <base href="${origin}/" />
    <style>
      :root { color-scheme: dark; }
      body {
        margin: 0;
        padding: 24px;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #09090b;
        color: #f4f4f5;
      }
      .relay-banner {
        margin-bottom: 16px;
        border: 1px solid rgba(16, 185, 129, 0.35);
        background: rgba(6, 78, 59, 0.35);
        color: #d1fae5;
        padding: 12px 14px;
        border-radius: 14px;
        font-size: 14px;
      }
      .relay-banner strong { display: block; margin-bottom: 4px; }
      .page, .container { max-width: 1040px; margin: 0 auto; }
      .popup, .modal-backdrop, .human-check, .demo-controls { display: none !important; }
      .card {
        border: 1px solid rgba(255,255,255,0.08);
        background: rgba(24,24,27,0.92);
        border-radius: 18px;
        padding: 18px;
        margin-bottom: 16px;
      }
      .button-row, button { display: none !important; }
      a {
        color: #86efac;
        text-decoration: none;
      }
      .product-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 16px;
      }
      .muted { color: #a1a1aa; }
      pre {
        white-space: pre-wrap;
        word-break: break-word;
        border-radius: 12px;
        background: rgba(9, 9, 11, 0.95);
        padding: 14px;
        overflow: auto;
      }
    </style>
  </head>
  <body>
    <div class="relay-banner">
      <strong>Trusted relay view</strong>
      The trust bundle passed verification, so popup ads, human-check prompts, and misleading click traps were stripped before rendering.
    </div>
    ${bodyHtml}
  </body>
</html>`;
}

export function sanitizeHostileHtml(sourceHtml: string, sourceUrl: string): {
  cleanedHtml: string;
  removed: string[];
} {
  let mainHtml = extractMainContent(sourceHtml);
  const removed: string[] = [];

  for (const block of BLOCK_PATTERNS) {
    if (block.regex.test(mainHtml)) {
      removed.push(block.label);
      mainHtml = mainHtml.replace(block.regex, "");
    }
  }

  const { html: withoutTrapButtons, removedButtons } = removeButtonsByText(mainHtml);
  mainHtml = withoutTrapButtons;
  removed.push(...removedButtons.map((text) => `button:${text}`));

  mainHtml = stripScripts(mainHtml);
  mainHtml = absolutizeAssetUrls(mainHtml, sourceUrl);

  return {
    cleanedHtml: wrapTrustedDocument(mainHtml, sourceUrl),
    removed,
  };
}
