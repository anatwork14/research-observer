import fs from "node:fs/promises";
import path from "node:path";

const STATE_DIR = ".research-observer";
const INTEGRATIONS_FILE = "integrations.json";

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function fileAt(rootDir = process.cwd()) {
  const root = path.resolve(rootDir);
  return path.join(root, STATE_DIR, INTEGRATIONS_FILE);
}

export function integrationSettingsWritable() {
  if (process.env.OBSERVAIRE_SETTINGS_WRITES === "1") return true;
  return process.env.NODE_ENV !== "production";
}

export async function readIntegrationSettings({ rootDir = process.cwd() } = {}) {
  try {
    const raw = await fs.readFile(fileAt(rootDir), "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return {
      consensusApiKey: clean(parsed.consensusApiKey) || undefined,
    };
  } catch (error) {
    if (error?.code === "ENOENT") return {};
    throw new Error("Could not read local integration settings.");
  }
}

async function writeIntegrationSettings(settings, { rootDir = process.cwd() } = {}) {
  if (!integrationSettingsWritable()) {
    throw new Error("Integration settings are read-only in this environment.");
  }

  const root = path.resolve(rootDir);
  const directory = path.join(root, STATE_DIR);
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const target = fileAt(root);
  const temporary = target + ".tmp";
  const payload = JSON.stringify(settings, null, 2) + "\n";
  await fs.writeFile(temporary, payload, { encoding: "utf8", mode: 0o600 });
  await fs.rename(temporary, target);
  try {
    await fs.chmod(target, 0o600);
  } catch {
    // Best effort on platforms where chmod semantics differ.
  }
}

export async function saveConsensusApiKey(apiKey, options = {}) {
  const key = clean(apiKey);
  if (key.length < 8 || key.length > 1000) {
    throw new Error("Consensus API key length is invalid.");
  }
  const current = await readIntegrationSettings(options);
  await writeIntegrationSettings({ ...current, consensusApiKey: key }, options);
  return { configured: true, source: "workspace-settings" };
}

export async function clearConsensusApiKey(options = {}) {
  const current = await readIntegrationSettings(options);
  const next = { ...current };
  delete next.consensusApiKey;
  await writeIntegrationSettings(next, options);
  return { configured: Boolean(clean(process.env.CONSENSUS_API_KEY)), source: clean(process.env.CONSENSUS_API_KEY) ? "environment" : "none" };
}

export async function resolveConsensusApiKey({ rootDir = process.cwd(), explicit } = {}) {
  const direct = clean(explicit);
  if (direct) return { apiKey: direct, source: "explicit" };

  const environment = clean(process.env.CONSENSUS_API_KEY);
  if (environment) return { apiKey: environment, source: "environment" };

  const settings = await readIntegrationSettings({ rootDir });
  const stored = clean(settings.consensusApiKey);
  return stored
    ? { apiKey: stored, source: "workspace-settings" }
    : { apiKey: "", source: "none" };
}

export async function consensusIntegrationStatus(options = {}) {
  const resolved = await resolveConsensusApiKey(options);
  return {
    configured: Boolean(resolved.apiKey),
    source: resolved.source,
    writable: integrationSettingsWritable(),
  };
}
