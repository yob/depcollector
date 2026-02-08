import type { DependencyInfo } from "./types.js";

interface NpmRegistryResponse {
  "dist-tags": { latest: string };
  time: Record<string, string>;
}

export async function getPackageInfo(
  name: string,
  currentVersion: string
): Promise<DependencyInfo> {
  const url = `https://registry.npmjs.org/${encodeURIComponent(name)}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(
      `Failed to fetch registry info for ${name}: ${res.status} ${res.statusText}`
    );
  }

  const data = (await res.json()) as NpmRegistryResponse;
  const latestVersion = data["dist-tags"].latest;

  return {
    name,
    currentVersion,
    currentVersionDate: data.time[currentVersion] ?? "unknown",
    latestVersion,
    latestVersionDate: data.time[latestVersion] ?? "unknown",
  };
}
