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
          {/* The deck answers the h1 in its first clause — the page applying
              the site's own answer-before-evidence rule (ADR-0018) to
              itself. It deliberately does NOT restate what the site is: the
              directory blurb that links here already said it, and this
              page's reader most often arrives from that very sentence. */}
          <p className="methodology-deck">
            Not whether it went in. Good Shots judges every attempt by what a shot from
            that spot is worth, then asks what the player's conversion added or cost. This
            page explains the model behind the verdicts, the rules that keep them honest,
            and where the numbers come from.
          </p>
        </header>

        <section className="methodology-section" aria-labelledby="methodology-model">
          <header className="section-caption">
            <h2 id="methodology-model">THE MODEL</h2>
            <p className="section-caption-desc">
              expected value, points per shot, and the two-axis split
            </p>
          </header>
          {/* Opens on the case, not the definition: the deck above already
              states what a good shot is, so this paragraph proves it and
              then gives the reason the definition exists (ADR-0001's own
              argument, which appears nowhere else on the page). */}
          <p>
            A made long two is still a bad shot, and a missed corner three is still a good
            one. Grading by outcome rewards the luck in a single make. Grading by value
            reads the choice behind the shot.
          </p>
          {/* The mechanism alone: the three-versus-two example lives in the
              vocabulary section below, with the arithmetic. */}
          <p>
            The unit is points per shot: make rate times point value. One unit prices
            every shot on the page, from a dunk to a corner three to a trip to the line.
          </p>
          <p>
            The benchmark is the league. A player's shot diet, where his attempts come
            from, is weighed against the league's own diet, and his conversion against the
            league's rates on the same shots. The comparison class is stated plainly on
            every page: vs league average, never adjusted for position or role.
          </p>
          {/* The identity as an anchor plus two moves (ADR-0016), which is
              what the headline pair draws. Deliberately never "the two add
              up": the decomposition has three terms because the league's
              diet is the starting point, not a third axis, and saying
              "two" of a three-term sum is the small lie this page exists
              to avoid. The section description already frames the split,
              so the paragraph does not announce it again.

              Both scoping phrases in the closing sentence are load-bearing
              and must not be trimmed as clutter. "From the field" keeps a
              general reader from folding free throws into the figure (they
              are trips, not shots — THE LINE's whole point). "Over every
              attempt the model counts" is what keeps "exactly" earned:
              backcourt heaves are excluded from evaluation (ADR-0016) and
              zone-conflict rows are dropped outright (ADR-0019), so the
              arithmetic closes over the evaluated set, not over every shot
              a box score would list. No current hero has a heave and only
              two carry a dropped row, which is exactly why the overclaim
              would be invisible until the hero who breaks it. */}
          <p>
            Shot selection asks what his choices would be worth at league-average
            shooting. Shot making asks what his conversion adds or costs on top. Both move
            from one starting point: the value of the league's own diet. Together they
            land exactly on the points per shot he scored from the field, over every
            attempt the model counts.
          </p>
        </section>

        <section className="methodology-section" aria-labelledby="methodology-honesty">
          <header className="section-caption">
            <h2 id="methodology-honesty">THE HONESTY RULES</h2>
            <p className="section-caption-desc">
              the flags and floors that keep small samples from talking big
            </p>
          </header>
          {/* Completeness leads, and it is load-bearing rather than a boast:
              it is what turns the † flag from an apology into a fact about
              the player. The claim is checkable — the shot derive hard-fails
              unless the record's FGA equals the league's own season total
              (the ADR-0069 oracle). */}
          <p>
            The counts are the whole season, not a sample. Every field-goal attempt
            through the stated date is in the numbers, checked against the league's own
            season total before the page renders.
          </p>
          {/* The 15-attempt bar is a DISPLAY concern, never an argument gate:
              aggregate.ts weights the diet over all six zones regardless of
              `included`, because dropping a thin zone's attempts would
              misstate where he shoots from. An earlier draft said a zone
              "enters the argument at 15 attempts", which contradicted the
              aggregation and was falsifiable on two live pages (SGA's
              corners at 13 and 5, Raynaud's at 14 and 11 — muted rows still
              carrying real numbers). Do not restore that shorthand. */}
          <p>
            So when a rate carries the † flag, it is because the player took fewer than 50
            shots from there, not because we looked at fewer. A zone under 15 attempts is
            muted rather than dropped: its rate is too thin to lean on, but its attempts
            still count in the diet, since removing them would misstate where he shoots
            from. Attempt counts stay visible wherever a rate is stated.
          </p>
          {/* Two different mechanisms, deliberately not collapsed into one:
              a zone-conflict row is dropped at derive and never reaches the
              payload (ADR-0019), while a backcourt heave stays in the record
              and sits outside evaluation (ADR-0016). An earlier draft said
              heaves were "set aside the same way", which described the
              handling of bad data inaccurately on the page that exists to
              describe it. */}
          <p>
            Two kinds of attempt sit outside the evaluation, and both are counted and
            reported rather than quietly removed. When the NBA's record contradicts
            itself, a shot scored as a two but placed in a three-point zone, the row is
            dropped instead of guessed into a zone. Backcourt heaves stay in the record
            but are set aside, since a desperation launch says nothing about shot
            selection.
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
          {/* "The checks are exact ones", never "the sources must agree
              exactly" — the earlier draft's blanket claim was false and
              contradicted the paragraph below it. The league's tracking
              universe runs ~0.37% under official league FGA by design
              (ADR-0058: compare like universes only), and a hero's tracked
              attempts can land under his official count when cameras miss
              minutes (ADR-0030 as amended: exact-or-reported). What IS
              exact is the identity battery that hard-fails at derive, so
              only those are named here. The league season totals earn
              their place in the list because THE HONESTY RULES above
              cites that check. */}
          <p>
            Every number starts in the NBA's official record: the shot chart, the league's
            tracking dashboards, play-by-play, box scores, and the league's own season
            totals. The checks between those sources are exact ones, never approximate.
            Free throws reconcile against every game's box score and against an
            independent season total. Assist credits reconcile against each team's
            official total.
          </p>
          {/* The creation reconciliation lives HERE rather than in the exact
              list above: it is exact-or-reported, and the tracking
              shortfall is its reported case (pinned per game in
              season.config.json, which only a human PR can move). */}
          <p>
            Where a source genuinely falls short, the gap is measured rather than smoothed
            over. The league's tracking cameras occasionally miss minutes, so a player's
            tracked attempts can land below his official count. That gap is counted,
            characterized game by game, and shown on the page instead of quietly closed. A
            make whose evidence is ambiguous stays unknown rather than becoming a guess.
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
          {/* Author-chosen disclosure (2026-07-30). An earlier draft said the
              verdicts were "written by a person, never generated", which was
              not true and which the repo's own record contradicted: ADR-0070
              documents AI-drafted copy under the voice guide, and the sample
              corpus is Before = the voice-guided draft, After = the author's
              red-pen. ADR-0017's real claim was never about who typed the
              words, it was that the verdict is not a COMPUTED TEMPLATE
              ("selection is {band}, making is {direction}"), which stands
              whatever the drafting process. So the claim moves from
              provenance to accountability, which is the part the guards can
              actually prove. Do not restore the authorship boast. */}
          <p>
            No formula writes these. A verdict is a judgment about a season, drafted with
            the tools any writer now has, then edited and signed off by a person who
            stands behind it.
          </p>
          {/* "At least" is load-bearing: the ladder is a FLOOR system
              (ADR-0068, "Floors, not exact prices"), and a guard may declare
              a documented stricter local bar — Cody's FAR_BELOW_PPS = 0.25
              against the ladder's FAR_PPS = 0.15. So a grading word promises
              at least its rung, never exactly it. */}
          <p>
            What keeps it honest is none of that. Every directional claim in a verdict is
            asserted against the same data the page renders, and grading words are priced
            on one shared scale, so a phrase like “well above” promises at least the same
            magnitude on every page.
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
            {/* "Assets", not "imagery": the section credits the typefaces
                too, and they are card inputs, not pictures. */}
            <p className="section-caption-desc">the assets behind the pages, credited</p>
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
          {/* The typeface credit is what makes the closing "entirely" true:
              the card renderer opens two webfont files beside the headshot
              and the wordmark (scripts/generate_social_cards.py), so before
              this line the totality claim excluded assets it was baking in.
              Keep the two in sync — a new face on the site belongs here. */}
          <p className="methodology-credits-note">
            Player headshots are the NBA's standard player photographs, from the league's
            media CDN. Team marks are the franchises' primary marks from the same source,
            normalized to one shared canvas. The Good Shots wordmark is the site's own
            branding, and the type is set in Public Sans, IBM Plex Mono, and Big Shoulders
            Display, all open-licensed and self-hosted. Share cards are generated entirely
            from the assets credited here.
          </p>
        </section>
      </main>
      {/* The shared sign-off, a sibling of main (the contentinfo rule). The
          way back leads; the page never links to itself. */}
      <SiteFooter directoryLink methodologyLink={false} />
    </>
  )
}
