import "server-only";

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
export function cleanMarkdown(raw: string): string {
  // TODO(you): implement the heuristics. 5–10 lines is plenty.
  //
  // Suggested pipeline:
  //   1. Split into blocks on blank lines.
  //   2. For each block, drop it if:
  //        - it matches one of NOISE_PATTERNS (cookie banner, "skip to main",
  //          common footer-link phrases),
  //        - it is mostly markdown links (e.g. >70% of the chars sit inside
  //          [text](url) brackets — pure nav/footer rows).
  //   3. Collapse 3+ blank lines to 2.
  //   4. Trim and return.
  //
  // Ship a v1 fast. You can tune NOISE_PATTERNS once you see real output
  // from `pnpm dev` against a sample URL.
  return raw.trim();
}

export const NOISE_PATTERNS: RegExp[] = [
  // Add patterns like /skip to main content/i, /accept (all )?cookies/i, etc.
];
