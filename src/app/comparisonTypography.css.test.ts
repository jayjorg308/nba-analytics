// Committed design guard for the comparison tool's branded split: setup
// stays in the Public Sans reading register; resolved identity headings use
// the shipped Big Shoulders Display 900 cut.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const appCss = readFileSync(path.resolve(process.cwd(), 'src/App.css'), 'utf-8')
const indexCss = readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf-8')

function declarations(css: string, selector: RegExp): string | undefined {
  return css.match(new RegExp(`${selector.source}\\s*\\{([^}]*)\\}`))?.[1]
}

describe('comparison typography contract', () => {
  it('keeps setup on Public Sans and gives resolved results the display treatment', () => {
    const tokens = declarations(indexCss, /:root/)
    const setup = declarations(appCss, /\.comparison-title/)
    const result = declarations(appCss, /\.comparison-page-results \.comparison-title/)

    expect(tokens).toContain("--heading: 'Public Sans'")
    expect(tokens).toContain("--display: 'Big Shoulders Display'")
    expect(setup).toContain('font-family: var(--heading)')
    expect(setup).toContain('font-weight: 500')
    expect(result).toContain('font-family: var(--display)')
    expect(result).toContain('font-weight: 900')
    expect(result).toContain('text-transform: uppercase')
  })
})
