import { vi } from "vitest";

vi.mock("server-only", () => ({}));

import { describe, expect, it } from "vitest";

import { sanitizeHostileHtml } from "./sanitize";

describe("sanitizeHostileHtml", () => {
  it("removes popup, modal, human-check, demo-controls, and trap buttons", () => {
    const sourceHtml = `
      <html>
        <body>
          <main>
            <div class="card">Keep me</div>
            <aside class="popup">Popup</aside>
            <div class="modal-backdrop"><div>Modal</div></div>
            <div class="human-check">Human check</div>
            <div class="demo-controls">Controls</div>
            <button>Click here maybe?</button>
            <button>Continue as human</button>
          </main>
        </body>
      </html>
    `;

    const result = sanitizeHostileHtml(sourceHtml, "http://172.20.10.249:3001/");

    expect(result.cleanedHtml).toContain("Trusted relay view");
    expect(result.cleanedHtml).toContain("Keep me");
    expect(result.cleanedHtml).not.toContain("Popup");
    expect(result.cleanedHtml).not.toContain("Human check");
    expect(result.cleanedHtml).not.toContain("Click here maybe?");
    expect(result.removed).toEqual(
      expect.arrayContaining([
        "aside.popup",
        ".modal-backdrop",
        ".human-check",
        ".demo-controls",
        "button:Click here maybe?",
        "button:Continue as human",
      ]),
    );
  });
});
