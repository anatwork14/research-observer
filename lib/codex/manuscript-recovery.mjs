import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const MANIFEST = "manifest.json";
const MAX_FILES = 128;

function safeProposalId(value) {
  const id = String(value ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Invalid manuscript recovery proposal ID.");
  return id;
}

function safeRepoFile(value) {
  const normalized = path.posix.normalize(String(value ?? "").replace(/\\/g, "/").replace(/^\.\//, ""));
  if (
    !normalized || normalized === "." || normalized === ".." || normalized.startsWith("../") ||
    path.posix.isAbsolute(normalized) || normalized.endsWith("/")
  ) throw new Error("Recovery file path must stay inside the repository.");
  return normalized;
}

function recoveryRoot(root) {
  return path.join(path.resolve(root), ".research-observer", "codex-recovery");
}

function recoveryDir(root, proposalId) {
  return path.join(recoveryRoot(root), safeProposalId(proposalId));
}

async function checkedTarget(root, repoFile, { allowMissingParents = false } = {}) {
  const rootPath = path.resolve(root);
  const rootStat = await fs.lstat(rootPath);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) throw new Error("Repository root is unsafe for manuscript recovery.");

  const normalized = safeRepoFile(repoFile);
  const segments = normalized.split("/");
  let parent = rootPath;
  for (const segment of segments.slice(0, -1)) {
    parent = path.join(parent, segment);
    let stat;
    try {
      stat = await fs.lstat(parent);
    } catch (error) {
      if (error?.code === "ENOENT" && allowMissingParents) continue;
      if (error?.code === "ENOENT") return { normalized, absolute: path.join(rootPath, ...segments), exists: false };
      throw error;
    }
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`Unsafe parent path while recovering ${normalized}.`);
  }
  return { normalized, absolute: path.join(rootPath, ...segments), exists: true };
}

async function atomicWrite(filePath, bytes, mode) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(temporary, bytes, { mode });
  await fs.rename(temporary, filePath);
}

export async function createManuscriptRecoverySnapshot({ root = process.cwd(), proposalId, files = [] } = {}) {
  const uniqueFiles = [...new Set(files.map(safeRepoFile))];
  if (!uniqueFiles.length || uniqueFiles.length > MAX_FILES) throw new Error("Recovery snapshot requires a bounded manuscript file list.");

  const directory = recoveryDir(root, proposalId);
  const temporary = `${directory}.tmp-${crypto.randomUUID()}`;
  await fs.rm(directory, { recursive: true, force: true });
  await fs.mkdir(temporary, { recursive: true });

  try {
    const records = [];
    for (let index = 0; index < uniqueFiles.length; index += 1) {
      const repoFile = uniqueFiles[index];
      const target = await checkedTarget(root, repoFile);
      let stat;
      try {
        stat = await fs.lstat(target.absolute);
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
        records.push({ file: repoFile, existed: false, backup: null, mode: null });
        continue;
      }
      if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`Recovery snapshot can only capture regular files: ${repoFile}.`);
      const backup = `${String(index).padStart(4, "0")}.bin`;
      await fs.writeFile(path.join(temporary, backup), await fs.readFile(target.absolute));
      records.push({ file: repoFile, existed: true, backup, mode: stat.mode & 0o777 });
    }

    const manifest = {
      schemaVersion: 1,
      proposalId: safeProposalId(proposalId),
      createdAt: new Date().toISOString(),
      files: records,
    };
    await fs.writeFile(path.join(temporary, MANIFEST), JSON.stringify(manifest, null, 2) + "\n", "utf8");
    await fs.mkdir(path.dirname(directory), { recursive: true });
    await fs.rename(temporary, directory);
    return manifest;
  } catch (error) {
    await fs.rm(temporary, { recursive: true, force: true }).catch(() => null);
    throw error;
  }
}

export async function restoreManuscriptRecoverySnapshot({ root = process.cwd(), proposalId } = {}) {
  const directory = recoveryDir(root, proposalId);
  const manifest = JSON.parse(await fs.readFile(path.join(directory, MANIFEST), "utf8"));
  if (manifest?.schemaVersion !== 1 || manifest?.proposalId !== safeProposalId(proposalId) || !Array.isArray(manifest.files)) {
    throw new Error("Manuscript recovery snapshot is invalid.");
  }

  const restored = [];
  for (const record of manifest.files) {
    const repoFile = safeRepoFile(record?.file);
    const target = await checkedTarget(root, repoFile, { allowMissingParents: true });
    if (record.existed) {
      const backupName = String(record.backup ?? "");
      if (!/^\d{4}\.bin$/.test(backupName)) throw new Error("Manuscript recovery backup reference is invalid.");
      const bytes = await fs.readFile(path.join(directory, backupName));
      await atomicWrite(target.absolute, bytes, Number.isInteger(record.mode) ? record.mode : 0o644);
    } else {
      let current;
      try {
        current = await fs.lstat(target.absolute);
      } catch (error) {
        if (error?.code === "ENOENT") {
          restored.push(repoFile);
          continue;
        }
        throw error;
      }
      if (current.isDirectory() && !current.isSymbolicLink()) throw new Error(`Refusing to remove a directory during manuscript recovery: ${repoFile}.`);
      await fs.rm(target.absolute, { force: true });
    }
    restored.push(repoFile);
  }
  return { restored };
}

export async function deleteManuscriptRecoverySnapshot({ root = process.cwd(), proposalId } = {}) {
  await fs.rm(recoveryDir(root, proposalId), { recursive: true, force: true });
}
