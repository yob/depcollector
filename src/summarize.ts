import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { program } from "commander";
import type { CollectionResult } from "./types.js";

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

function calculateLibyears(result: CollectionResult): number {
  let total = 0;

  for (const dep of result.dependencies) {
    if (dep.currentVersionDate === "unknown" || dep.latestVersionDate === "unknown") continue;
    const current = new Date(dep.currentVersionDate).getTime();
    const latest = new Date(dep.latestVersionDate).getTime();
    const diff = latest - current;
    if (diff > 0) {
      total += diff / MS_PER_YEAR;
    }
  }

  return total;
}

program
  .name("depcollector-summarize")
  .description("Summarize multiple depcollector JSON reports into a CSV")
  .argument("<directory>", "Directory containing depcollector JSON files")
  .parse();

async function main(): Promise<void> {
  const dir = program.args[0];
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();

  const rows: { gitSha: string; gitTimestamp: string; libyears: string }[] = [];

  for (const file of files) {
    const content = await readFile(join(dir, file), "utf-8");
    const result = JSON.parse(content) as CollectionResult;
    const libyears = calculateLibyears(result);
    rows.push({
      gitSha: result.gitSha,
      gitTimestamp: result.gitTimestamp,
      libyears: libyears.toFixed(2),
    });
  }

  rows.sort((a, b) => a.gitTimestamp.localeCompare(b.gitTimestamp));

  console.log("commit_sha,commit_timestamp,libyears");
  for (const row of rows) {
    console.log(`${row.gitSha},${row.gitTimestamp},${row.libyears}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
