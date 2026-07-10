// Guards the committed deployment copy (public/data/) against drift: it must
// strict-parse, fit entirely on the rendered half court, and match the latest
// derived payload when the gitignored data/ layer is present (dev machines).
// Skips cleanly on clones without the synced file.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseDerivedPayload } from '../domain/payload'
import { isOnCourt } from './geometry'

const publicPayloadPath = path.resolve(process.cwd(), 'public/data/cody-williams/2025-26.json')

describe.skipIf(!existsSync(publicPayloadPath))('deployed payload (launch hero)', () => {
  it('strict-parses and renders every shot on the half court', () => {
    const payload = parseDerivedPayload(
      JSON.parse(readFileSync(publicPayloadPath, 'utf-8')),
    )
    expect(payload.shots).toHaveLength(509)
    expect(payload.shots.every(isOnCourt)).toBe(true) // 509 dots, 0 skipped
  })

  it('matches the latest derived payload when data/ is present', () => {
    const derivedDir = path.resolve(process.cwd(), 'data/derived/cody-williams/2025-26')
    if (!existsSync(derivedDir)) return
    const latest = readdirSync(derivedDir).filter((f) => f.endsWith('.json')).sort().at(-1)
    if (!latest) return
    const derived: unknown = JSON.parse(readFileSync(path.join(derivedDir, latest), 'utf-8'))
    const deployed: unknown = JSON.parse(readFileSync(publicPayloadPath, 'utf-8'))
    // out of sync -> run `npm run hero:sync`
    expect(deployed).toEqual(derived)
  })
})
