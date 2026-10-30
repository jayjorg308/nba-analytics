// The team registry (ADR-0081/0082): the single source of team-surface
// truth, the hero registry's shape at team grain. A team surface is a
// TOOL, never an argument — no verdict, no thesis lives here; what a team
// config carries is identity, the seasons with deployed team payloads,
// which of them the bare /<slug> renders, and each season's home config
// (ADR-0087): the players its home features and its banner photograph.
//
// Node-safe on purpose (no import.meta), so scripts can import it; URL
// derivation lives in ./urls.ts.

/** A player the season's home features with a headshot card. */
export interface FeaturedPlayer {
  /** His player slug (playerSlug, ADR-0095): the card links his season
   * page, and his headshot is img/<slug>-headshot.png. */
  slug: string
  /** His name as season.config.json lists it, so a featured player with
   * no shot yet still has a named card. */
  playerName: string
}

/** A season banner photograph (decision 7): a hero banner's shape, authored
 * per season and credited on the methodology page's SOURCES. */
export interface SeasonBanner {
  /** Path under public/, no leading slash. */
  imagePath: string
  /** The house form (VOICE.md's banner rules): the frame only. */
  imageAlt: string
  /** Absent renders "photograph credit pending" in SOURCES. */
  imageCredit?: string
  /** Focal point for the narrow full-bleed poster. */
  imagePosition: string
  /** Focal point for the wide right-anchored panel. */
  imagePositionWide: string
}

/** One registered season's home (ADR-0087). */
export interface TeamSeasonHome {
  /** The season's arguments, living and frozen, in display order: guarded
   * equal as a set to the hero seasons season.config.json lists for this
   * season plus the registered season arguments that name this team page
   * (src/teams/featured.test.ts), so featuring and the arguments never
   * disagree. */
  featured: readonly FeaturedPlayer[]
  /** The season's banner photograph; absent renders the typographic
   * poster (2025-26, and 2026-27 until its photo lands). */
  banner?: SeasonBanner
}

export interface TeamConfig {
  /** The route segment (`/jazz`) — reserved beside methodology and compare. */
  slug: string
  /** The ADR-0028 static-map abbreviation; lower-cased it is the deployment
   * key under public/data/_teams/. */
  tricode: string
  /** stats.nba.com's TEAM_NAME form. */
  name: string
  teamId: number
  /** The normalized team mark (ADR-0021's watermark treatment), path under
   * public/, no leading slash. */
  teamLogoPath?: string
  /** Seasons with deployed team payloads (shot payload + season index),
   * oldest first. */
  seasons: readonly string[]
  /** The season the bare /<slug> renders — moved by a config change when a
   * new season's payloads deploy (the team surface's flip), never by the
   * season loop. */
  canonicalSeason: string
  /** Each registered season's home config, keyed by season (every season
   * in `seasons`, nothing else). */
  homes: Readonly<Record<string, TeamSeasonHome>>
}

export const utahJazz: TeamConfig = {
  slug: 'jazz',
  tricode: 'UTA',
  name: 'Utah Jazz',
  teamId: 1610612762,
  teamLogoPath: 'img/utah-logo.png',
  // 2026-27 joined and became canonical 2026-10-29, the morning after its
  // first data commit (five games through 10-28); never before one, since a
  // registered season without a published index fails the loop's gate.
  // 2025-26 stays at its season permalink, /jazz/2025-26.
  seasons: ['2025-26', '2026-27'],
  canonicalSeason: '2026-27',
  homes: {
    // The three frozen 2025-26 Jazz arguments.
    '2025-26': {
      featured: [
        { slug: 'cody-williams', playerName: 'Cody Williams' },
        { slug: 'keyonte-george', playerName: 'Keyonte George' },
        { slug: 'ace-bailey', playerName: 'Ace Bailey' },
      ],
    },
    // The three living arguments (season.config.json's 2026-27 hero
    // seasons). The banner photograph is the user's to supply.
    '2026-27': {
      featured: [
        { slug: 'keyonte-george', playerName: 'Keyonte George' },
        { slug: 'ace-bailey', playerName: 'Ace Bailey' },
        { slug: 'darryn-peterson', playerName: 'Darryn Peterson' },
      ],
    },
  },
}

/** Ordered; today one team. */
export const TEAMS: readonly TeamConfig[] = [utahJazz]

/** The team whose canonical season the site root renders (ADR-0087). */
export const HOME_TEAM: TeamConfig = utahJazz

/** A registered season's home config; throws on a season not on file. */
export function seasonHomeOf(team: TeamConfig, season: string): TeamSeasonHome {
  const home = team.homes[season]
  if (home === undefined) throw new Error(`${team.slug} has no home config for ${season}`)
  return home
}

export function teamBySlug(slug: string): TeamConfig | undefined {
  return TEAMS.find((t) => t.slug === slug)
}

/** An NBA game id: ten digits. Distinguishes /jazz/<gameId> from
 * /jazz/<season> in the route's second segment. */
export const GAME_ID = /^\d{10}$/
export const SEASON = /^\d{4}-\d{2}$/
