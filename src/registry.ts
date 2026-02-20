import { readFile, writeFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { DependencyInfo } from './types.js'

interface NpmRegistryResponse {
  'dist-tags': { latest: string }
  time: Record<string, string>
  versions: Record<string, { deprecated?: string }>
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] ?? 0
    const nb = pb[i] ?? 0
    if (na !== nb) return na - nb
  }
  return 0
}

function findLatestBefore(
  time: Record<string, string>,
  versions: Record<string, { deprecated?: string }>,
  cutoff: Date
): { version: string; date: string } | undefined {
  let best: string | undefined

  for (const [version, dateStr] of Object.entries(time)) {
    if (version === 'created' || version === 'modified') continue
    if (version.includes('-')) continue
    if (versions[version]?.deprecated) continue
    const date = new Date(dateStr)
    if (date <= cutoff && (!best || compareVersions(version, best) > 0)) {
      best = version
    }
  }

  if (!best) return undefined
  return { version: best, date: time[best] }
}

const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

function cacheFilePath(cacheDir: string, name: string): string {
  return join(cacheDir, name.replace('/', '__') + '.json')
}

async function readCacheFile(
  cacheDir: string,
  name: string
): Promise<NpmRegistryResponse | undefined> {
  const filePath = cacheFilePath(cacheDir, name)
  try {
    const info = await stat(filePath)
    if (Date.now() - info.mtimeMs >= CACHE_TTL_MS) return undefined
    const content = await readFile(filePath, 'utf-8')
    return JSON.parse(content) as NpmRegistryResponse
  } catch {
    return undefined
  }
}

async function writeCacheFile(
  cacheDir: string,
  name: string,
  data: NpmRegistryResponse
): Promise<void> {
  const filePath = cacheFilePath(cacheDir, name)
  await writeFile(filePath, JSON.stringify(data)).catch(() => {})
}

async function fetchRegistryData(
  name: string,
  cacheDir?: string
): Promise<NpmRegistryResponse> {
  if (cacheDir) {
    const cached = await readCacheFile(cacheDir, name)
    if (cached) return cached
  }

  const url = `https://registry.npmjs.org/${encodeURIComponent(name)}`
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  })

  if (!res.ok) {
    throw new Error(
      `Failed to fetch registry info for ${name}: ${res.status} ${res.statusText}`
    )
  }

  const data = (await res.json()) as NpmRegistryResponse

  if (cacheDir) {
    await writeCacheFile(cacheDir, name, data)
  }

  return data
}

export async function getPackageInfo(
  name: string,
  currentVersion: string,
  direct: boolean,
  cutoff?: Date,
  cacheDir?: string
): Promise<DependencyInfo> {
  let data: NpmRegistryResponse
  try {
    data = await fetchRegistryData(name, cacheDir)
  } catch (err) {
    console.error(
      `Warning: ${err instanceof Error ? err.message : String(err)}`
    )
    return {
      name,
      direct,
      currentVersion,
      currentVersionReleasedAt: null,
      latestVersion: null,
      latestVersionReleasedAt: null,
    }
  }

  let latestVersion: string | null
  let latestVersionReleasedAt: string | null

  if (cutoff) {
    const found = findLatestBefore(data.time, data.versions, cutoff)
    latestVersion = found?.version ?? data['dist-tags'].latest ?? null
    latestVersionReleasedAt = found?.date ?? (latestVersion ? data.time[latestVersion] ?? null : null)
  } else {
    latestVersion = data['dist-tags'].latest ?? null
    latestVersionReleasedAt = latestVersion ? data.time[latestVersion] ?? null : null
  }

  return {
    name,
    direct,
    currentVersion,
    currentVersionReleasedAt: data.time[currentVersion] ?? null,
    latestVersion,
    latestVersionReleasedAt,
  }
}
