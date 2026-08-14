// The comparison page's compact identity (comparison plan §2): the dynamic
// h1, the season and its league ruler stated directly below (ADR-0074), and
// each side's label, games, shots, and window boundary — the unequal
// precision disclosure the detailed rows rely on (ADR-0077). Deliberately
// NOT a hero banner: no action photo, no thesis question, no verdict cue,
// no team mark or team-color identity — the page is a tool, not an argument.

import type { ComparisonMetrics, ComparisonSide } from '../domain/aggregateComparison'
import { formatGameDate, formatMonthDay } from '../format'
import { heroBySlug } from '../heroes/registry'
import { headshotUrl } from '../heroes/urls'

export function ComparisonHeader({ metrics }: { metrics: ComparisonMetrics }) {
  const m = metrics
  // Split mode carries ONE identity: a single headshot beside the heading;
  // player mode gives each side its own small face instead.
  const splitHero = m.mode === 'split' ? heroBySlug(m.left.playerSlug) : undefined
  return (
    <header className="comparison-header">
      <div className={`comparison-heading comparison-heading-${m.mode}`}>
        {splitHero !== undefined && (
          // Decorative: the h1 beside it carries the name.
          <img className="comparison-headshot" src={headshotUrl(splitHero)} alt="" />
        )}
        <div>
          <h1 className="comparison-title">
            {m.mode === 'players'
              ? `${m.left.playerName} vs ${m.right.playerName}`
              : `${m.left.playerName}, before & since ${formatMonthDay(m.splitDate!)}`}
          </h1>
          <p className="comparison-baseline">
            {m.baselineSeason} · vs {m.baselineSeason} league average
          </p>
          {/* The completeness disclosure (ADR-0077, made visible): the side
              cards' date ranges can show a gap where no games were played
              near the split, and page 2 alone must prove nothing was
              dropped. States the invariant the aggregation asserts. */}
          {m.mode === 'split' && (
            <p className="comparison-baseline">
              Complete windows: every game through {formatGameDate(m.right.endDate)} falls on
              one side of the split.
            </p>
          )}
        </div>
      </div>
      <div className="comparison-sides">
        <SideCard side={m.left} withHeadshot={m.mode === 'players'} />
        <SideCard side={m.right} withHeadshot={m.mode === 'players'} />
      </div>
    </header>
  )
}

function SideCard({ side, withHeadshot }: { side: ComparisonSide; withHeadshot: boolean }) {
  const hero = heroBySlug(side.playerSlug)
  return (
    <div className="comparison-side">
      {withHeadshot && hero !== undefined && (
        // Decorative: the side label carries the name.
        <img className="comparison-headshot" src={headshotUrl(hero)} alt="" />
      )}
      <div className="comparison-side-text">
        <span className="comparison-side-label">{side.label}</span>
        <span className="comparison-side-facts">
          {side.games} games · {side.shots} shots
        </span>
        {/* The window as observed: first game through the data-through
            boundary (the reconciled frontier when unconstrained). */}
        <span className="comparison-side-facts">
          {formatGameDate(side.startDate)} through {formatGameDate(side.endDate)}
        </span>
      </div>
    </div>
  )
}
