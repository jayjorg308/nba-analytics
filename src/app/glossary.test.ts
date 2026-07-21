// The punctuation guard for structural product copy (CONTEXT.md, Punctuation
// style): no rendered prose may use an em dash as punctuation — restructure
// with a colon, semicolon, comma, parentheses, or a new sentence. The
// glossary is the registry of rendered definitions, so it is the enforcement
// point (the ADR-0014/0017 pattern: copy is free, invariants are enforced).
// The "—" no-data placeholder in data cells is a glyph, not prose, and lives
// in format.ts, not here.

import { describe, expect, it } from 'vitest'
import { GLOSSARY } from './glossary'

describe('the glossary registry', () => {
  it('uses no em dashes in any definition or headword (punctuation style)', () => {
    for (const [id, entry] of Object.entries(GLOSSARY)) {
      expect(entry.term, `term of '${id}'`).not.toContain('—')
      expect(entry.definition, `definition of '${id}'`).not.toContain('—')
    }
  })
})
