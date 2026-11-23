// The team sync (scripts/sync-team-payload.ts, ADR-0082/0091) run as the
// season loop runs it: a child process in a temp world laid out like the
// repo (data/derived beside public/data), so the paths it resolves from its
// working directory are the ones under test. The script is top-level code;
// spawning it is the only way to hold its exit code and what it copies.

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'

const SCRIPT = resolve('scripts', 'sync-team-payload.ts')
const root = mkdtempSync(join('tests', 'team-sync-tmp-'))
afterAll(() => rmSync(root, { recursive: true, force: true }))

let worlds = 0
function world(): string {
  const dir = join(root, `w${worlds++}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

function put(dir: string, path: string, body: unknown): void {
  const file = join(dir, path)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(body), 'utf-8')
}

function sync(dir: string) {
  // Bare `tsx` resolves upward from the world to the repo's node_modules.
  return spawnSync(process.execPath, ['--import', 'tsx', SCRIPT, 'uta', '2026-27'], {
    cwd: dir,
    encoding: 'utf-8',
  })
}

const derived = 'data/derived/_teams/uta/2026-27'
const published = 'public/data/_teams/uta/2026-27'
const SESSION = '2026-11-21T063026'
const indexOf = (...ids: string[]) => ({ games: ids.map((gameId) => ({ gameId })) })

describe('team:sync', () => {
  it('syncs an export with no new game: the index alone, no games directory', () => {
    // The 2026-11-21 and 2026-11-22 06:30 shape: every index row is already
    // published, so the export wrote index.json and no games/ directory.
    const dir = world()
    put(dir, `${published}/games/0022600049.json`, { game: 'phx' })
    put(dir, `${derived}/${SESSION}.json`, { shots: 'team' })
    put(dir, `${derived}/games/${SESSION}/index.json`, indexOf('0022600049'))

    const result = sync(dir)
    expect(result.stderr).not.toContain('ENOENT')
    expect(result.status).toBe(0)
    expect(JSON.parse(readFileSync(join(dir, 'public/data/_teams/uta/2026-27.json'), 'utf-8'))).toEqual({
      shots: 'team',
    })
    expect(JSON.parse(readFileSync(join(dir, `${published}/index.json`), 'utf-8'))).toEqual(
      indexOf('0022600049'),
    )
  }, 60_000)

  it('still copies a new game file beside the published ones', () => {
    const dir = world()
    put(dir, `${published}/games/0022600049.json`, { game: 'phx' })
    put(dir, `${derived}/${SESSION}.json`, { shots: 'team' })
    put(dir, `${derived}/games/${SESSION}/index.json`, indexOf('0022600049', '0022600284'))
    put(dir, `${derived}/games/${SESSION}/games/0022600284.json`, { game: 'dal' })

    const result = sync(dir)
    expect(result.status).toBe(0)
    expect(existsSync(join(dir, `${published}/games/0022600284.json`))).toBe(true)
  }, 60_000)

  it('still fails an index row with no game file, published or exported', () => {
    const dir = world()
    put(dir, `${derived}/${SESSION}.json`, { shots: 'team' })
    put(dir, `${derived}/games/${SESSION}/index.json`, indexOf('0022600049'))

    const result = sync(dir)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('index row 0022600049.json has no game file')
    expect(existsSync(join(dir, `${published}/index.json`))).toBe(false)
  }, 60_000)
})
