// Deterministic avatar gradient from any string seed (typically an EVM address
// or agent label). Returns CSS that can be passed straight into a div's style.

function hash32(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function hueFromChunk(input: string, salt: number): number {
  return hash32(`${salt}:${input}`) % 360;
}

export type AvatarStyle = {
  background: string;
  boxShadow?: string;
};

/// Vibrant-but-restrained gradient. Two hues blended diagonally with a
/// subtle inner highlight so it feels "lit" against a dark surface.
export function avatarStyle(seed: string): AvatarStyle {
  const cleaned = (seed || "0x0").toLowerCase();
  const h1 = hueFromChunk(cleaned, 1);
  const h2 = (h1 + 40 + (hash32(cleaned) % 90)) % 360;
  return {
    background: `linear-gradient(135deg, hsl(${h1}deg 70% 56%) 0%, hsl(${h2}deg 75% 46%) 100%)`,
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08), inset 0 1px 0 rgba(255,255,255,0.18)"
  };
}

/// Two-letter "monogram" derived from the seed (e.g. an agent label or address).
export function avatarInitials(seed: string): string {
  const s = (seed || "").trim();
  if (!s) return "··";
  const cleaned = s.startsWith("0x") ? s.slice(2) : s;
  if (s.startsWith("0x")) {
    return cleaned.slice(0, 2).toUpperCase();
  }
  const parts = cleaned.split(/[\s_\-/.]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return cleaned.slice(0, 2).toUpperCase();
}
