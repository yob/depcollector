export interface LockedDependency {
  name: string
  version: string
}

export interface DependencyInfo {
  name: string
  direct: boolean
  currentVersion: string
  currentVersionDate: string
  latestVersion: string
  latestVersionDate: string
}

export interface CollectionResult {
  ecosystem: 'npm'
  projectName?: string
  manifestPath: string
  collectedAt: string
  gitSha: string
  gitTimestamp: string
  dependencies: DependencyInfo[]
}
