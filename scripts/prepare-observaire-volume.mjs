import { spawnSync } from "node:child_process";

const volume = (process.env.OBSERVAIRE_STATE_VOLUME || "observaire-profile").trim();
if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(volume)) {
  throw new Error("OBSERVAIRE_STATE_VOLUME must be a valid Docker volume name.");
}

function docker(args) {
  return spawnSync("docker", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

const inspect = docker(["volume", "inspect", volume]);
if (inspect.error) {
  throw new Error(`Docker is unavailable: ${inspect.error.message}`);
}
if (inspect.status === 0) {
  console.log(`[observaire] state volume: ${volume}`);
  process.exit(0);
}

const created = docker(["volume", "create", volume]);
if (created.error || created.status !== 0) {
  const detail = created.error?.message || created.stderr.trim() || created.stdout.trim() || "unknown Docker error";
  throw new Error(`Could not create Observaire state volume ${volume}: ${detail}`);
}
console.log(`[observaire] created state volume: ${volume}`);
