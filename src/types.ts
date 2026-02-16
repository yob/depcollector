export interface LockedDependency {
  name: string
  version: string
}

export interface DependencyInfo {
  name: string
  direct: boolean
  currentVersion: string
  currentVersionReleasedAt: string | null
  latestVersion: string | null
  latestVersionReleasedAt: string | null
}

export interface CollectionResult {
  id: string
  ecosystem: 'npm'
  projectName?: string
  manifestPath: string
  collectedAt: string
  gitSha: string
  gitTimestamp: string
  dependencies: DependencyInfo[]
}
