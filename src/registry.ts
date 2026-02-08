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

const registryCache = new Map<string, NpmRegistryResponse>()

async function fetchRegistryData(name: string): Promise<NpmRegistryResponse> {
  const cached = registryCache.get(name)
  if (cached) return cached

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
  registryCache.set(name, data)
  return data
}

export async function getPackageInfo(
  name: string,
  currentVersion: string,
  direct: boolean,
  cutoff?: Date
): Promise<DependencyInfo> {
  let data: NpmRegistryResponse
  try {
    data = await fetchRegistryData(name)
  } catch (err) {
    console.error(
      `Warning: ${err instanceof Error ? err.message : String(err)}`
    )
    return {
      name,
      direct,
      currentVersion,
      currentVersionDate: '',
      latestVersion: '',
      latestVersionDate: '',
    }
  }

  let latestVersion: string
  let latestVersionDate: string

  if (cutoff) {
    const found = findLatestBefore(data.time, data.versions, cutoff)
    latestVersion = found?.version ?? data['dist-tags'].latest
    latestVersionDate = found?.date ?? data.time[latestVersion] ?? 'unknown'
  } else {
    latestVersion = data['dist-tags'].latest
    latestVersionDate = data.time[latestVersion] ?? 'unknown'
  }

  return {
    name,
    direct,
    currentVersion,
    currentVersionDate: data.time[currentVersion] ?? 'unknown',
    latestVersion,
    latestVersionDate,
  }
}
