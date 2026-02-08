# depcollector

A CLI tool that snapshots the state of your npm dependencies. It reads your
`package.json` and `package-lock.json`, queries the npm registry, and outputs
a JSON report containing each dependency's locked version, its release date,
and the latest available version with its release date. It also captures the
current git SHA and commit timestamp.

## Why?

Keeping dependencies up to date is important, but it's hard to track *how*
out of date they are across projects over time. depcollector produces a
structured snapshot you can store (e.g. in S3) and trend over time to answer
questions like:

- How old are my locked dependency versions?
- How far behind latest is each dependency?
- Are things getting better or worse over time?

## Requirements

- Node.js >= 20
- A `package.json` and `package-lock.json` in the target directory
- A git repository (for SHA and commit timestamp)

## Installation

```bash
npm install -g depcollector
```

Or run directly with npx:

```bash
npx depcollector
```

## Usage

Run in any directory containing a `package.json` and `package-lock.json`:

```bash
depcollector
```

This prints a JSON report to stdout:

```json
{
  "collectedAt": "2026-02-08T11:24:42.590Z",
  "gitSha": "c75e008...",
  "gitTimestamp": "2026-02-08T22:24:33+11:00",
  "dependencies": [
    {
      "name": "typescript",
      "currentVersion": "5.9.3",
      "currentVersionDate": "2025-09-30T21:19:38.784Z",
      "latestVersion": "5.9.3",
      "latestVersionDate": "2025-09-30T21:19:38.784Z"
    }
  ]
}
```

### `--at-commit`

By default, "latest version" means the latest version available right now. If
you want to know what the latest version was *at the time of the commit*
instead, use the `--at-commit` flag:

```bash
depcollector --at-commit
```

This caps the "latest version" to the most recent release that existed at the
git commit timestamp. This is useful for historical analysis -- for example,
running depcollector against older commits to understand how out of date
dependencies were at that point in time, without the answer being skewed by
versions released after the commit.

### Saving output

The output is plain JSON on stdout, so you can pipe it wherever you like:

```bash
# Save to a file
depcollector > deps-snapshot.json

# Upload to S3
depcollector | aws s3 cp - s3://my-bucket/deps/$(date +%Y-%m-%d).json

# Pretty-print with jq
depcollector | jq .
```

## Output format

| Field | Description |
|---|---|
| `collectedAt` | ISO 8601 timestamp of when the report was generated |
| `gitSha` | The current HEAD commit SHA |
| `gitTimestamp` | The commit timestamp of HEAD |
| `dependencies[]` | Array of dependency info objects |
| `dependencies[].name` | Package name |
| `dependencies[].currentVersion` | Version locked in package-lock.json |
| `dependencies[].currentVersionDate` | Release date of the locked version |
| `dependencies[].latestVersion` | Latest available version (or latest as of commit with `--at-commit`) |
| `dependencies[].latestVersionDate` | Release date of the latest version |

## License

MIT

## Author

[James Healy](https://yob.id.au)
