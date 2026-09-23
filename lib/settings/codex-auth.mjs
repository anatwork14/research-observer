import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile, spawn } from "node:child_process";

const STORE_KEY = "__observaireCodexAuthStore";
const store = globalThis[STORE_KEY] ?? { session: null };
globalThis[STORE_KEY] = store;

function cleanOutput(value) {
  return String(value ?? "")
    .replace(/\u001b\[[0-9;]*m/g, "")
    .replace(/\r/g, "")
    .trim();
}

function authUiAllowed() {
  if (process.env.OBSERVAIRE_CODEX_AUTH_UI === "1") return true;
  return process.env.NODE_ENV !== "production";
}

async function resolveCodexCommand() {
  const binary = process.platform === "win32" ? "codex.cmd" : "codex";
  const local = path.join(process.cwd(), "node_modules", ".bin", binary);
  try {
    await fs.access(local);
    return local;
  } catch {
    return "codex";
  }
}

function runCommand(command, args, { timeout = 12000 } = {}) {
  return new Promise((resolve) => {
    execFile(
      command,
      args,
      {
        cwd: process.cwd(),
        env: { ...process.env, NO_COLOR: "1", TERM: "dumb" },
        timeout,
        maxBuffer: 1024 * 1024,
        shell: process.platform === "win32",
      },
      (error, stdout, stderr) => {
        resolve({
          ok: !error,
          code: typeof error?.code === "number" ? error.code : error ? 1 : 0,
          missing: error?.code === "ENOENT",
          output: cleanOutput(`${stdout ?? ""}\n${stderr ?? ""}`),
        });
      },
    );
  });
}

function authModeFromOutput(output) {
  const value = cleanOutput(output);
  if (/Logged in using ChatGPT/i.test(value)) return "chatgpt";
  if (/Logged in using an API key/i.test(value)) return "api-key";
  if (/Logged in using access token/i.test(value)) return "access-token";
  if (/Logged in using workload identity/i.test(value)) return "workload-identity";
  if (/Logged in using Amazon Bedrock/i.test(value)) return "bedrock";
  return undefined;
}

export async function codexLoginStatus() {
  if (!authUiAllowed()) {
    return {
      available: false,
      authenticated: false,
      reason: "Codex authorization from Settings is disabled in this environment.",
    };
  }

  const codexHome = process.env.CODEX_HOME;
  if (codexHome) {
    try {
      await fs.mkdir(codexHome, { recursive: true, mode: 0o700 });
    } catch {
      return {
        available: false,
        authenticated: false,
        reason: "Could not prepare the Codex CLI home directory.",
      };
    }
  }

  const command = await resolveCodexCommand();
  const result = await runCommand(command, ["login", "status"]);
  if (result.missing) {
    return {
      available: false,
      authenticated: false,
      reason: "Codex CLI is not installed or cannot be resolved from this application.",
    };
  }

  if (result.ok) {
    return {
      available: true,
      authenticated: true,
      mode: authModeFromOutput(result.output),
      reason: result.output || "Codex is authenticated.",
    };
  }

  if (/Not logged in/i.test(result.output)) {
    return {
      available: true,
      authenticated: false,
      reason: "Codex is installed but not authenticated.",
    };
  }

  return {
    available: true,
    authenticated: false,
    reason: result.output ? result.output.slice(0, 500) : "Could not determine Codex login status.",
  };
}

function publicSession(session) {
  if (!session) return null;
  return {
    id: session.id,
    status: session.status,
    verificationUrl: session.verificationUrl,
    userCode: session.userCode,
    error: session.error,
    startedAt: session.startedAt,
  };
}

function parseDevicePrompt(session) {
  const plain = cleanOutput(session.output);
  const url = plain.match(/https?:\/\/[^\s]+\/codex\/device[^\s]*/i)?.[0];
  const code = plain.match(/Enter this one-time code[\s\S]{0,240}?\n\s*([A-Z0-9-]{4,40})/i)?.[1];
  if (url) session.verificationUrl = url;
  if (code) session.userCode = code;
  if (session.verificationUrl && session.userCode && session.status === "starting") {
    session.status = "waiting";
  }
}

export function currentCodexAuthSession() {
  return publicSession(store.session);
}

export async function startCodexDeviceAuth() {
  if (!authUiAllowed()) throw new Error("Codex authorization is disabled in this environment.");
  const existing = store.session;
  if (existing?.child && !existing.child.killed && ["starting", "waiting"].includes(existing.status)) {
    return publicSession(existing);
  }

  const command = await resolveCodexCommand();
  const status = await codexLoginStatus();
  if (!status.available) throw new Error(status.reason || "Codex CLI is unavailable.");
  if (status.authenticated) {
    store.session = {
      id: crypto.randomUUID(),
      status: "authenticated",
      startedAt: Date.now(),
    };
    return publicSession(store.session);
  }

  const session = {
    id: crypto.randomUUID(),
    status: "starting",
    startedAt: Date.now(),
    verificationUrl: undefined,
    userCode: undefined,
    error: undefined,
    output: "",
    child: null,
  };
  store.session = session;

  const child = spawn(command, ["login", "--device-auth"], {
    cwd: process.cwd(),
    env: { ...process.env, NO_COLOR: "1", TERM: "dumb" },
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
  });
  session.child = child;

  const append = (chunk) => {
    session.output = (session.output + String(chunk ?? "")).slice(-20000);
    parseDevicePrompt(session);
  };
  child.stdout?.on("data", append);
  child.stderr?.on("data", append);
  child.on("error", (error) => {
    session.status = "error";
    session.error = error?.code === "ENOENT"
      ? "Codex CLI is not installed or cannot be resolved."
      : String(error?.message || "Could not start Codex login.").slice(0, 500);
  });
  child.on("close", (code) => {
    if (session.status === "cancelled") return;
    if (code === 0) {
      session.status = "authenticated";
      session.error = undefined;
    } else {
      session.status = "error";
      const plain = cleanOutput(session.output);
      session.error = plain ? plain.slice(-800) : "Codex device authorization did not complete.";
    }
    session.child = null;
  });

  return publicSession(session);
}

export function cancelCodexDeviceAuth() {
  const session = store.session;
  if (!session) return null;
  session.status = "cancelled";
  session.error = undefined;
  if (session.child && !session.child.killed) session.child.kill("SIGTERM");
  session.child = null;
  return publicSession(session);
}

export async function logoutCodex() {
  if (!authUiAllowed()) throw new Error("Codex authorization is disabled in this environment.");
  cancelCodexDeviceAuth();
  const command = await resolveCodexCommand();
  const result = await runCommand(command, ["logout"]);
  if (result.missing) throw new Error("Codex CLI is unavailable.");
  if (!result.ok && !/not logged in/i.test(result.output)) {
    throw new Error(result.output ? result.output.slice(0, 500) : "Could not sign out of Codex.");
  }
  store.session = null;
  return { authenticated: false };
}
