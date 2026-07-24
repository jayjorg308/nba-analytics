// The scaffold planner (ADR-0063): pure decision layer between the emit
// core and the CLI shell. Given the identity and the current state of the
// three touchable files, it returns the exact file actions — or throws a
// descriptive error. Never-overwrite is enforced here: a scaffold creates
// files that don't exist and appends entries that don't exist; anything
// already present is a hard fail (re-scaffolding is git-checkout territory,
// so there is no force flag).

import { appendSeasonEntry, emitGuardFile, emitHeroModule, registerHero } from './emit'
import type { ScaffoldIdentity } from './emit'

/** The slug is a URL segment and a public/data/ key: lowercase kebab. */
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/
/** The season string, as the payload schema spells it (e.g. 2026-27). */
export const SEASON_PATTERN = /^\d{4}-\d{2}$/

export interface PlannedFile {
  /** Repo-relative path, forward slashes. */
  path: string
  /** 'create' targets must not exist; 'rewrite' targets must. */
  action: 'create' | 'rewrite'
  content: string
}

export interface ScaffoldPlan {
  mode: 'new-hero' | 'append-season'
  files: PlannedFile[]
}

/** What already exists on disk, read by the CLI shell. */
export interface ScaffoldState {
  /** src/heroes/<slug>.ts source, or null when the hero module is absent. */
  moduleSource: string | null
  /** src/heroes/registry.ts source. */
  registrySource: string
  /** Whether src/heroes/<slug>.<season>.guard.test.ts exists. */
  guardFileExists: boolean
}

export function planScaffold(id: ScaffoldIdentity, state: ScaffoldState): ScaffoldPlan {
  if (!SLUG_PATTERN.test(id.slug)) {
    throw new Error(`invalid slug '${id.slug}' — lowercase kebab-case (e.g. cody-williams)`)
  }
  if (!SEASON_PATTERN.test(id.season)) {
    throw new Error(`invalid season '${id.season}' — the payload form (e.g. 2026-27)`)
  }
  const guardPath = `src/heroes/${id.slug}.${id.season}.guard.test.ts`
  if (state.guardFileExists) {
    throw new Error(
      `${guardPath} already exists — a scaffold never overwrites (ADR-0063); ` +
        'delete the file first if you truly mean to re-scaffold',
    )
  }
  const guard: PlannedFile = { path: guardPath, action: 'create', content: emitGuardFile(id) }

  // Registering is part of the scaffold in both modes (ADR-0063): a module
  // the registry cannot see is a silently dead, fully green add.
  const registered = state.registrySource.includes(`from './${id.slug}'`)
  const registryRewrite: PlannedFile[] = registered
    ? []
    : [
        {
          path: 'src/heroes/registry.ts',
          action: 'rewrite',
          content: registerHero(state.registrySource, id),
        },
      ]

  if (state.moduleSource === null) {
    return {
      mode: 'new-hero',
      files: [
        { path: `src/heroes/${id.slug}.ts`, action: 'create', content: emitHeroModule(id) },
        guard,
        ...registryRewrite,
      ],
    }
  }

  return {
    mode: 'append-season',
    files: [
      {
        path: `src/heroes/${id.slug}.ts`,
        action: 'rewrite',
        content: appendSeasonEntry(state.moduleSource, id),
      },
      guard,
      ...registryRewrite,
    ],
  }
}
