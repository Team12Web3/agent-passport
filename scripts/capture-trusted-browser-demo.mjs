import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { spawn } from "node:child_process";

const EDGE_PATH =
  process.env.EDGE_PATH ??
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

const TARGET_URL =
  process.env.TRUSTED_BROWSER_URL ?? "http://127.0.0.1:3002/trusted-browser";

const OUTPUT_DIR = resolve(
  process.env.TRUSTED_BROWSER_CAPTURE_DIR ?? "apps/web/public/demo-captures",
);

const VIEWPORT = { width: 1600, height: 1000 };

const SCENES = [
  {
    name: "frame-00-original",
    action: async () => {
      await delay(1200);
    },
  },
  {
    name: "frame-01-valid",
    action: async (cdp) => {
      await clickScenario(cdp, "All Trust Layers");
      await waitForIdle();
    },
  },
  {
    name: "frame-02-no-passport",
    action: async (cdp) => {
      await clickScenario(cdp, "No Passport");
      await waitForIdle();
    },
  },
  {
    name: "frame-03-tamper-action",
    action: async (cdp) => {
      await clickScenario(cdp, "Tamper Action");
      await waitForIdle();
    },
  },
  {
    name: "frame-04-recovered",
    action: async (cdp) => {
      await clickScenario(cdp, "All Trust Layers");
      await waitForIdle();
    },
  },
];

class CdpClient {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();

    ws.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (payload.id && this.pending.has(payload.id)) {
        const { resolve, reject } = this.pending.get(payload.id);
        this.pending.delete(payload.id);
        if (payload.error) {
          reject(new Error(payload.error.message));
        } else {
          resolve(payload.result);
        }
      }
    };
  }

  send(method, params = {}) {
    const id = this.nextId++;
    const message = JSON.stringify({ id, method, params });
    this.ws.send(message);
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  async close() {
    this.ws.close();
    await delay(200);
  }
}

async function waitForDebuggerUrl(port) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (response.ok) {
        const payload = await response.json();
        const pageTarget =
          payload.find((target) => target.url?.startsWith(TARGET_URL)) ??
          payload.find((target) => target.type === "page");
        if (pageTarget?.webSocketDebuggerUrl) {
          return pageTarget.webSocketDebuggerUrl;
        }
      }
    } catch {
      // Browser not ready yet.
    }
    await delay(200);
  }

  throw new Error("Timed out waiting for Edge remote debugger.");
}

async function waitForIdle() {
  await delay(2200);
}

async function clickScenario(cdp, label) {
  const expression = `
    (() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const match = buttons.find((button) => button.textContent?.trim() === ${JSON.stringify(label)});
      if (!match) {
        return { ok: false, reason: "button_not_found" };
      }
      match.click();
      return { ok: true };
    })()
  `;
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (!result?.result?.value?.ok) {
    throw new Error(`Could not click scenario button: ${label}`);
  }
}

async function captureFrame(cdp, filePath) {
  const result = await cdp.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
    fromSurface: true,
  });
  await writeFile(filePath, Buffer.from(result.data, "base64"));
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const userDataDir = await mkdtemp(join(tmpdir(), "trusted-browser-gif-"));
  const remoteDebuggingPort = 9222;

  const edge = spawn(
    EDGE_PATH,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      `--remote-debugging-port=${remoteDebuggingPort}`,
      `--window-size=${VIEWPORT.width},${VIEWPORT.height}`,
      `--user-data-dir=${userDataDir}`,
      TARGET_URL,
    ],
    {
      stdio: "ignore",
      windowsHide: true,
    },
  );

  let cdp;

  try {
    const debuggerUrl = await waitForDebuggerUrl(remoteDebuggingPort);
    const ws = new WebSocket(debuggerUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    cdp = new CdpClient(ws);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: VIEWPORT.width,
      height: VIEWPORT.height,
      deviceScaleFactor: 1,
      mobile: false,
      screenWidth: VIEWPORT.width,
      screenHeight: VIEWPORT.height,
    });

    for (const scene of SCENES) {
      await scene.action(cdp);
      await captureFrame(cdp, join(OUTPUT_DIR, `${scene.name}.png`));
    }
  } finally {
    if (cdp) {
      await cdp.close();
    }
    edge.kill();
    await delay(500);
    try {
      await rm(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch {
      // Ignore cleanup failures from a lingering Edge lockfile.
    }
  }

  console.log(`Captured ${SCENES.length} frames into ${OUTPUT_DIR}`);
}

await main();
