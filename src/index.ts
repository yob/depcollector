import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { CollectionResult, DependencyInfo } from "./types.js";
import { getPackageInfo } from "./registry.js";
import { getGitInfo } from "./git.js";

const CONCURRENCY = 5;

async function loadJson(filePath: string): Promise<unknown> {
  const content = await readFile(filePath, "utf-8");
  return JSON.parse(content);
}

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface PackageLockJson {
  packages?: Record<string, { version?: string }>;
  dependencies?: Record<string, { version: string }>;
}

function getLockedVersions(
  packageJson: PackageJson,
  lockfile: PackageLockJson
): Map<string, string> {
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  const versions = new Map<string, string>();

  for (const name of Object.keys(allDeps)) {
    // Try lockfile v3 format (packages["node_modules/<name>"])
    const lockV3 = lockfile.packages?.[`node_modules/${name}`];
    if (lockV3?.version) {
      versions.set(name, lockV3.version);
      continue;
    }

    // Fall back to lockfile v2/v1 format (dependencies.<name>)
    const lockV1 = lockfile.dependencies?.[name];
    if (lockV1?.version) {
      versions.set(name, lockV1.version);
    }
  }

  return versions;
}

async function processInBatches(
  entries: [string, string][],
  concurrency: number
): Promise<DependencyInfo[]> {
  const results: DependencyInfo[] = [];

  for (let i = 0; i < entries.length; i += concurrency) {
    const batch = entries.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(([name, version]) => getPackageInfo(name, version))
    );
    results.push(...batchResults);
  }

  return results;
}

async function main(): Promise<void> {
  const cwd = process.cwd();

  const [packageJson, lockfile] = await Promise.all([
    loadJson(join(cwd, "package.json")) as Promise<PackageJson>,
    loadJson(join(cwd, "package-lock.json")) as Promise<PackageLockJson>,
  ]);

  const lockedVersions = getLockedVersions(packageJson, lockfile);
  const entries = Array.from(lockedVersions.entries()).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  const dependencies = await processInBatches(entries, CONCURRENCY);

  const gitInfo = getGitInfo();

  const result: CollectionResult = {
    collectedAt: new Date().toISOString(),
    gitSha: gitInfo.sha,
    gitTimestamp: gitInfo.timestamp,
    dependencies,
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
