import { spawn } from "node:child_process";
import process from "node:process";

const image = process.env.OBSERVAIRE_LATEX_PROJECT_IMAGE || "observaire-latex-project-app:verify";
const platform = process.env.OBSERVAIRE_LATEX_PROJECT_PLATFORM?.trim() || "";

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.once("error", reject);
    child.once("close", (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });
}

function withPlatform(args) {
  return platform ? ["--platform", platform, ...args] : args;
}

console.log(`[verify:latex:project-app] image: ${image}`);
if (platform) console.log(`[verify:latex:project-app] platform: ${platform}`);
console.log("[verify:latex:project-app] building the Observaire app target without Compose mounts or user data volumes.");

const buildCode = await run("docker", [
  "build",
  ...withPlatform([]),
  "--target", "app",
  "-t", image,
  ".",
]);

if (buildCode !== 0) {
  console.error(`[verify:latex:project-app] image build failed with exit code ${buildCode}`);
  process.exitCode = buildCode;
} else {
  console.log("[verify:latex:project-app] running the service-level LaTeX verifier in a read-only, network-isolated container.");
  const runArgs = [
    "run",
    "--rm",
    ...(platform ? ["--platform", platform] : []),
    "--read-only",
    "--network", "none",
    "--cap-drop", "ALL",
    "--security-opt", "no-new-privileges",
    "--tmpfs", "/tmp:rw,exec,nosuid,size=2g",
    "--entrypoint", "npm",
    image,
    "run", "verify:latex",
  ];
  const verifyCode = await run("docker", runArgs);
  if (verifyCode !== 0) {
    console.error(`[verify:latex:project-app] service verification failed with exit code ${verifyCode}`);
    process.exitCode = verifyCode;
  } else {
    console.log("[verify:latex:project-app] PASS");
  }
}
