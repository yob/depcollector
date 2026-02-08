import { execSync } from "node:child_process";

export function getGitInfo(): { sha: string; timestamp: string } {
  const sha = execSync("git rev-parse HEAD", { encoding: "utf-8" }).trim();
  const timestamp = execSync("git log -1 --format=%cI", {
    encoding: "utf-8",
  }).trim();
  return { sha, timestamp };
}
