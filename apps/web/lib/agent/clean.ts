/**
 * Clean Firecrawl/Jina markdown before sending to the LLM.
 *
 * The raw output from a scraper typically contains:
 *   - top-of-page nav links ("Home · Products · About · Contact")
 *   - "Skip to main content" / "Open menu" accessibility blurbs
 *   - cookie / GDPR banners
 *   - footer link soup ("Privacy · Terms · Press · Careers · ...")
 *   - long contiguous link-only blocks (sidebars)
 *
 * Stripping these matters because:
 *   1) They burn tokens (Anthropic charges per token).
 *   2) They distract the model — link soup is often summarized as if it were
 *      content ("This page covers privacy, terms, press...").
 *   3) For the demo, leaner input → faster streaming → tighter on-stage feel.
 *
 * Trade-offs:
 *   - Too aggressive → strip real navigation that hints at content structure
 *     (e.g. an actual product list rendered as links).
 *   - Too lenient   → keep the noise.
 *
 * The structure you have to work with is markdown — paragraphs separated by
 * blank lines, links as `[text](url)`, headings as `#`-prefixed lines.
 */
const LINK_RE = /\[[^\]]*\]\([^)]*\)/g;

export function cleanMarkdown(raw: string): string {
  const blocks = raw.split(/\n{2,}/);
  const kept = blocks.filter((b) => {
    const t = b.trim();
    if (!t) return false;
    if (NOISE_PATTERNS.some((re) => re.test(t))) return false;
    const linkChars = (t.match(LINK_RE) ?? []).join("").length;
    return linkChars / t.length < 0.7;
  });
  return kept.join("\n\n").trim();
}

export const NOISE_PATTERNS: RegExp[] = [
  /^skip to (main )?content/i,
  /^(open|close|toggle) menu/i,
  /accept (all )?cookies/i,
  /we use cookies/i,
  /^(privacy policy|terms of service|all rights reserved)/i,
  /^©\s*\d{4}/,
  /^subscribe to (our )?newsletter/i,
  /^sign (in|up)( to)?$/i,
];
