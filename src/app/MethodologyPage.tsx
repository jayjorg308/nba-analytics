import { useEffect } from 'react'
import { HEROES } from '../heroes/registry'
import { GLOSSARY } from './glossary'
import { SiteFooter } from './SiteFooter'
import { SiteNav } from './SiteNav'

// The methodology page (ADR-0071): the site's one self-explanation surface,
// closing ROADMAP launch items 2 and 8 together — the directory's blurb
// links here, so a cold visitor learns what the site is without the marquee
// gaining a deck. Structural copy only: no per-hero claims, no per-hero
// numbers, so nothing here carries verdict-guard obligations. The
// vocabulary section re-renders the glossary registry (one source, drift
// impossible), and definitions print in place — this page IS the
// definitions surface, so it deliberately carries no Term popovers (the
// page test holds it button-free, the index's own discipline).

export function MethodologyPage() {
  useEffect(() => {
    // The second exception to the bare-wordmark tab rule (ADR-0071):
    // a reader with the directory and this page open needs to tell the
    // tabs apart, the hero pages' own rationale. A label, not a sentence.
    document.title = 'Methodology · Good Shots'
  }, [])

  return (
    <>
      <main className="methodology-page">
        <SiteNav />
        <header className="methodology-header">
          <p className="section-kicker">METHODOLOGY</p>
          <h1 className="methodology-title">What makes a good shot?</h1>
          <p className="methodology-deck">
            Good Shots asks one question of one player's season: is he taking good shots?
            Every page argues its answer, verdict first and evidence after. This page
            explains the model behind the verdicts, the rules that keep them honest, and
            where the numbers come from.
          </p>
        </header>

        <section className="methodology-section" aria-labelledby="methodology-model">
          <header className="section-caption">
            <h2 id="methodology-model">THE MODEL</h2>
            <p className="section-caption-desc">
              expected value, points per shot, and the two-axis split
            </p>
          </header>
          <p>
            A good shot is a high-value shot. Every attempt is judged by the points a shot
            from its spot is expected to produce, not by whether it went in. A made long
            two is still a bad shot, and a missed corner three is still a good one.
          </p>
          <p>
            The unit is points per shot: make rate times point value, so a modest three
            can outrank a well-made two. One unit prices every shot on the page, from a
            dunk to a corner three to a trip to the line.
          </p>
          <p>
            The benchmark is the league. A player's shot diet, where his attempts come
            from, is weighed against the league's own diet, and his conversion against the
            league's rates on the same shots. The comparison class is stated plainly on
            every page: vs league average, never adjusted for position or role.
          </p>
          <p>
            The argument then splits in two. Shot selection asks what his choices would be
            worth at league-average shooting. Shot making asks what his conversion adds or
            subtracts on top. The two add up exactly: the league's diet, plus his
            selection, plus his making, equals the points per shot he actually scored.
          </p>
        </section>

        <section className="methodology-section" aria-labelledby="methodology-honesty">
          <header className="section-caption">
            <h2 id="methodology-honesty">THE HONESTY RULES</h2>
            <p className="section-caption-desc">
              the flags and floors that keep small samples from talking big
            </p>
          </header>
          <p>
            A zone enters the argument at 15 attempts. Conversion on fewer than 50 carries
            a † flag: the number is real, but the sample is small enough to read as
            uncertain. Attempt counts stay visible wherever a rate is stated.
          </p>
          <p>
            When the NBA's record contradicts itself, a shot scored as a two but placed in
            a three-point zone, the shot is dropped and counted, never guessed into a
            zone. Backcourt heaves are set aside the same way. Every page reports its
            exclusions whenever the count is not zero.
          </p>
          <p>
            Every page's byline states the exact record it argues from: the player, the
            season, through a stated date, over a stated number of games.
          </p>
        </section>

        <section className="methodology-section" aria-labelledby="methodology-data">
          <header className="section-caption">
            <h2 id="methodology-data">THE DATA</h2>
            <p className="section-caption-desc">
              official sources, reconciled exactly, committed before they render
            </p>
          </header>
          <p>
            Every number starts in the NBA's official record: the shot chart, the league's
            tracking dashboards, play-by-play, and box scores. Before anything ships, the
            sources must agree with each other exactly. Free throws reconcile against
            every game's box score, creation totals against the official attempt count,
            assist credits against each team's official total.
          </p>
          <p>
            Where a source falls short, the gap is measured and reported, never smoothed
            over. A tracking outage is counted and disclosed. A make that cannot be
            classified stays unknown rather than becoming a guess.
          </p>
          <p>
            The site itself is static: the data behind each page is a committed file,
            refreshed only after every check passes.
          </p>
        </section>

        <section className="methodology-section" aria-labelledby="methodology-verdicts">
          <header className="section-caption">
            <h2 id="methodology-verdicts">THE VERDICTS</h2>
            <p className="section-caption-desc">authored words, held to the data by tests</p>
          </header>
          <p>
            The verdicts are written by a person, never generated. What keeps them honest
            is a battery of automated checks: every directional claim in a verdict is
            asserted against the same data the page renders, and grading words are priced
            on one shared scale, so a phrase like “well above” promises the same magnitude
            on every page.
          </p>
          <p>
            When the data moves, the words are rewritten or the site does not build. A
            claim is never loosened to keep a sentence alive.
          </p>
        </section>

        <section className="methodology-section" aria-labelledby="methodology-vocabulary">
          <header className="section-caption">
            <h2 id="methodology-vocabulary">THE VOCABULARY</h2>
            <p className="section-caption-desc">every term the pages define, in one place</p>
          </header>
          {/* The glossary registry rendered whole (ADR-0052's single source):
              a new dictionary entry appears here automatically, and this
              page can never disagree with a popover. */}
          <dl className="methodology-glossary">
            {Object.entries(GLOSSARY).map(([id, entry]) => (
              <div key={id}>
                <dt>{entry.term}</dt>
                <dd>{entry.definition}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="methodology-section" aria-labelledby="methodology-sources">
          <header className="section-caption">
            <h2 id="methodology-sources">SOURCES</h2>
            <p className="section-caption-desc">the imagery behind the pages, credited</p>
          </header>
          {/* Registry order, the directory's order. A missing credit renders
              the pending line plainly (the dropped-and-counted ethos applied
              to provenance) — never a blank, never a guess. */}
          <ul className="methodology-credits">
            {HEROES.map((hero) => (
              <li key={hero.slug}>
                {hero.playerName} banner: {hero.hero.imageCredit ?? 'photograph credit pending'}
              </li>
            ))}
          </ul>
          <p className="methodology-credits-note">
            Player headshots are the NBA's standard player photographs, from the league's
            media CDN. Team marks are the franchises' primary marks from the same source,
            normalized to one shared canvas. The Good Shots wordmark is the site's own
            branding, and share cards are generated entirely from the assets credited
            here.
          </p>
        </section>
      </main>
      {/* The shared sign-off, a sibling of main (the contentinfo rule). The
          way back leads; the page never links to itself. */}
      <SiteFooter directoryLink methodologyLink={false} />
    </>
  )
}
