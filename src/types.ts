export interface DependencyInfo {
  name: string;
  currentVersion: string;
  currentVersionDate: string;
  latestVersion: string;
  latestVersionDate: string;
}

export interface CollectionResult {
  collectedAt: string;
  gitSha: string;
  gitTimestamp: string;
  dependencies: DependencyInfo[];
}
