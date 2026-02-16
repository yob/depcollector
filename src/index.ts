import { readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { program } from 'commander'
import type {
  CollectionResult,
  DependencyInfo,
  LockedDependency,
} from './types.js'
import { getPackageInfo } from './registry.js'
import { v7 as uuidv7 } from 'uuid'
import { getGitInfo } from './git.js'

const CONCURRENCY = 5

async function loadJson(filePath: string): Promise<unknown> {
  const content = await readFile(filePath, 'utf-8')
  return JSON.parse(content)
}

interface PackageJson {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

interface PackageLockJson {
  lockfileVersion?: number
  packages?: Record<string, { version?: string }>
}

function getLockedVersions(
  packageJson: PackageJson,
  lockfile: PackageLockJson,
  transitive: boolean
): LockedDependency[] {
  if (!lockfile.lockfileVersion || lockfile.lockfileVersion < 2) {
    throw new Error(
      `package-lock.json lockfileVersion ${lockfile.lockfileVersion ?? 1} is not supported. ` +
        'Please regenerate your lockfile with npm 7+ (lockfileVersion 2 or 3).'
    )
  }

  if (!lockfile.packages) {
    throw new Error("package-lock.json has no 'packages' field.")
  }

  if (transitive) {
    return getAllLockedVersions(lockfile.packages)
  }

  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  }

  const result: LockedDependency[] = []

  for (const name of Object.keys(allDeps)) {
    const entry = lockfile.packages[`node_modules/${name}`]
    if (entry?.version) {
      result.push({ name, version: entry.version })
    }
  }

  return result
}

function getAllLockedVersions(
  packages: Record<string, { version?: string }>
): LockedDependency[] {
  const seen = new Set<string>()
  const result: LockedDependency[] = []

  for (const [path, entry] of Object.entries(packages)) {
    if (!path.startsWith('node_modules/') || !entry.version) continue
    // Extract package name from the last node_modules/ segment
    // e.g. "node_modules/a/node_modules/@scope/b" -> "@scope/b"
    const name = path.substring(path.lastIndexOf('node_modules/') + 13)
    // Deduplicate by name+version to avoid redundant registry calls
    const key = `${name}@${entry.version}`
    if (!seen.has(key)) {
      seen.add(key)
      result.push({ name, version: entry.version })
    }
  }

  return result
}

async function processInBatches(
  locked: LockedDependency[],
  directDeps: Set<string>,
  concurrency: number,
  cutoff?: Date
): Promise<DependencyInfo[]> {
  const results: DependencyInfo[] = []

  for (let i = 0; i < locked.length; i += concurrency) {
    const batch = locked.slice(i, i + concurrency)
    const batchResults = await Promise.all(
      batch.map((dep) =>
        getPackageInfo(dep.name, dep.version, directDeps.has(`${dep.name}@${dep.version}`), cutoff)
      )
    )
    results.push(...batchResults)
  }

  return results
}

program
  .name('depcollector')
  .description(
    'Collect dependency version and age information from package.json and package-lock.json'
  )
  .option(
    '--at-commit',
    'Cap latest version to what was available at the time of the commit'
  )
  .option('--transitive', 'Include transitive dependencies')
  .option('--project-name <name>', 'Include a project name in the output')
  .argument('[directory]', 'Path to directory containing package-lock.json', '.')
  .parse()

async function main(): Promise<void> {
  const opts = program.opts<{
    atCommit?: boolean
    transitive?: boolean
    projectName?: string
  }>()
  const directory = program.args[0] ?? '.'
  const lockfilePath = join(directory, 'package-lock.json')

  const [packageJson, lockfile] = await Promise.all([
    loadJson(join(directory, 'package.json')) as Promise<PackageJson>,
    loadJson(lockfilePath) as Promise<PackageLockJson>,
  ])

  const locked = getLockedVersions(
    packageJson,
    lockfile,
    opts.transitive ?? false
  )
  locked.sort(
    (a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version)
  )

  const directDeps = new Set<string>()
  for (const name of Object.keys({
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  })) {
    const entry = lockfile.packages?.[`node_modules/${name}`]
    if (entry?.version) {
      directDeps.add(`${name}@${entry.version}`)
    }
  }

  const gitInfo = getGitInfo()
  const cutoff = opts.atCommit ? new Date(gitInfo.timestamp) : undefined

  const dependencies = await processInBatches(
    locked,
    directDeps,
    CONCURRENCY,
    cutoff
  )

  const result: CollectionResult = {
    id: uuidv7(),
    ecosystem: 'npm',
    ...(opts.projectName && { projectName: opts.projectName }),
    manifestPath: relative(process.cwd(), lockfilePath),
    collectedAt: new Date().toISOString(),
    gitSha: gitInfo.sha,
    gitTimestamp: gitInfo.timestamp,
    dependencies,
  }

  console.log(JSON.stringify(result, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
