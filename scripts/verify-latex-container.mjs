import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const image = process.env.OBSERVAIRE_LATEX_VERIFY_IMAGE
  || "ghcr.io/xu-cheng/texlive-full:20260701@sha256:d9bfb267e3e3f5e0820ca86e867ee59ebb133fc29561bb28677d9b5a1a9e84ff";
const platform = process.env.OBSERVAIRE_LATEX_VERIFY_PLATFORM || "linux/amd64";

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.once("error", reject);
    child.once("close", (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });
}

console.log(`[verify:latex:container] image: ${image}`);
console.log(`[verify:latex:container] platform: ${platform}`);
console.log("[verify:latex:container] repository is mounted read-only; verification uses an internal temporary directory.");

const code = await run("docker", [
  "run",
  "--rm",
  "--platform", platform,
  "--mount", `type=bind,src=${path.resolve(root)},dst=/workspace,readonly`,
  "--workdir", "/workspace",
  image,
  "bash",
  "scripts/verify-latex-toolchain.sh",
]);

if (code !== 0) {
  console.error(`[verify:latex:container] failed with exit code ${code}`);
  process.exitCode = code;
} else {
  console.log("[verify:latex:container] PASS");
}
