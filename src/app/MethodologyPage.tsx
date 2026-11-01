import { useEffect } from 'react'
import { HEROES } from '../heroes/registry'
import { TEAMS } from '../teams/registry'
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

        <section className="methodology-section" aria-labelledby="methodology-team">
          <header className="section-caption">
            <h2 id="methodology-team">THE TEAM PAGE</h2>
            <p className="section-caption-desc">the same arithmetic, over a team’s shots, with no verdict</p>
          </header>
          {/* Structural copy (ADR-0081), verified against the code, not a
              description of it: the team surface (the site root, /jazz, and
              /jazz/<season>, ADR-0087) is TeamPage over teamHome.ts and
              aggregateTeam; every number is aggregateShotMetrics over a slice
              of the team shot payload (season, game); the box oracle is
              team_payload.reconcile_box (per player, per game, at derive/load
              and export); each game row's box facts are the season index's
              (the ledger file retired with ADR-0087); the per-game zone view
              is counts only (ReportCardPage's ZoneCounts).
              Each game row is priced against its own pre-game ruler since
              the report card (ADR-0089); the sentence below names no
              ruler, so it stays true. The rulers are THE REPORT CARD
              section's, below. */}
          <p>
            The team page is a tool, not an argument. It takes every shot a team’s players took,
            runs the same two-axis arithmetic the player pages run, and shows the result with no
            verdict on top. The season view is that arithmetic over the whole season. Each game
            row is the same arithmetic over that game’s shots alone, beside the box score.
          </p>
          {/* Player season pages (ADR-0095). "With a shot for the team that
              season" is load-bearing: seasonShooters lists shot rows only,
              so a player with free throws alone has no page. "Exactly as his
              line on that game's report card" is guarded over every
              published season by playerSeason.real.test.ts. */}
          <p>
            Every player with a shot for the team that season has a page of his own: the same
            arithmetic over his shots, his season against the league and each of his games
            priced exactly as his line on that game’s report card.
          </p>
          {/* A player's night (ADR-0096). "Who appears in a game" is
              load-bearing: a night exists for every subject box line,
              attempts or not (buildPlayersNight), never an opponent's. "The
              way that game's report card prices them" names no ruler on
              purpose: a game before any league game this season is priced on
              the prior season (ADR-0089). "Down to his points in the box
              score" is the game file's receipt identity, re-asserted at its
              load boundary. "Field-goal rates only" is the ruler's
              zoneBaseline, which carries no free-throw rate. */}
          <p>
            Every one of the team’s players who appears in a game has a night of his own: his
            shots in that game priced the way that game’s report card prices them, the same two
            numbers as his dot on his season page, and every attempt and free throw itemized
            down to his points in the box score. Free throws are counted, not priced, because the
            league rates a game is priced against cover field goals only.
          </p>
          {/* "Every game" is load-bearing: a game whose box score is missing
              cannot be in the payload at all (reconcile_box fails the
              derive and the export), so the frontier and the ledger agree by
              construction. "A mark" is the ledger's † under the making bar
              (TeamLedgerTable). */}
          <p>
            The team record is held to the box score before it is published. In every game,
            every shooter’s attempts in the shot record must equal his attempts in the box
            score, and a game without its box score is not published. Nothing on the page is
            hidden while a sample is small. A game with few attempts shows its count and a
            mark, and zones in a single game show counts only, because no zone reaches the
            fifteen attempts the shading needs in one night.
          </p>
        </section>

        <section className="methodology-section" aria-labelledby="methodology-report-card">
          <header className="section-caption">
            <h2 id="methodology-report-card">THE REPORT CARD</h2>
            <p className="section-caption-desc">
              one game, priced against the league as it stood entering the day
            </p>
          </header>
          {/* ReportCardPage: the two answers are the subject side's only
              (selectionAnswer and makingAnswer over card.subject), so "for
              the team"; BOTH SIDES is each team's numbers on the same ruler;
              PLAYERS lists every subject player with a field-goal or
              free-throw attempt, so "who took a shot or a free throw", not
              every box line; the quadrant stops at this game (reportCard.ts
              filters later games out). */}
          <p>
            Every published game has a report card. It answers two questions for the team,
            “Good shots?” and “Did they fall?”, sets both teams side by side on the same terms,
            lists the line of every player who took a shot or a free throw, and places the game
            among the season’s games so far.
          </p>
          {/* The pre-game ruler (ADR-0089): the LeagueAverages frame through
              the day before the game, inclusive, this season's games only;
              one ruler per date, pulled once, and a re-pull that disagrees
              halts (load_rulers.py). "On the league's opening night" is
              load-bearing: the fallback is for an EMPTY ruler only (no
              league game before the date), never a thin one; the
              measurement behind that is the ADR's. Every card's
              ruler line (REPORT_COPY.rulerPreGame / rulerPriorSeason) states
              the ruler and its game count, from the league game log. */}
          <p>
            Each game is priced against the league as it stood entering the day, its rates by
            zone over every game played this season before that day. Every game on a date shares
            that ruler, pulled once and never changed, so a card reads the same long after it is
            shared. A game on the league’s opening night has nothing before it to price against,
            so it uses the whole prior season and says so. Every card names its ruler and how
            many league games it holds.
          </p>
          {/* Two rulers coexist, and this is where the page says so (the
              CONTEXT entry's "Avoid: the baseline unqualified"). Season
              views price against the team payload's zoneBaseline, the
              frontier ruler (aggregateTeam's profile, buildPlayerSeason's
              metrics), as hero arguments price against their payload's
              season baseline. Per-game rows and dots use g.ruler.zoneBaseline
              (aggregateTeam's games, buildPlayerSeason's games), guarded
              equal to the card by reportCard.real.test.ts and
              playersNight.real.test.ts. */}
          <p>
            Season numbers use a different ruler. A team’s season and each player’s season are
            measured against the league’s rates for the season so far, the way a player’s
            argument is. Every single game, whether a dot on a chart or a row in a list, is
            priced against its own day’s ruler, so it always matches its card.
          </p>
          {/* Computed copy (ADR-0090, src/teams/computedCopy.ts): templates
              authored once and picked by band (bandOf on the displayed
              gap). Selection uses the verdict ladder's bars unchanged and
              making twice them (MAKING_BAND_SCALE), so "clear the same
              floors" holds for both: a card's word never promises less than
              the ladder's. "A formula writes them" is the contrast with THE
              VERDICTS' "No formula writes these"; keep the two in step. "Never grade the game or say why" is the
              computed-copy guard's banned grade and causal vocabulary.
              "From the season's tenth game" is SEASON_RANK_MIN_GAMES, counted
              over the season's games through this one. */}
          <p>
            The words on a report card work the other way from a verdict. A formula writes them.
            Each answer is chosen from a fixed set by where its number falls, so the same number
            gets the same words on every card. The magnitude words are the verdicts’ own, from
            “a bit” to “far”, and clear the same floors, with making held to bands twice as wide
            because one game’s shooting swings much wider than a season’s. The words describe the
            numbers and never grade the game or say why it went that way. From the season’s tenth
            game on, a card also ranks the game among the season’s games so far.
          </p>
          {/* Freshness (ADR-0091). "A run late each night and another each
              morning" is the operations schedule, not code: the two Task
              Scheduler tasks in CLAUDE.md and docs/plans/jazz-first-site.md
              (Operations), "game night" at 23:45 with --team UTA and the
              06:30 run of every session. Change this sentence when the
              schedule changes. The source list is the team session's
              (season_update.py): the pbp/box pair, the pre-game ruler, both
              teams' one-day pulls reconciled to the box FGA, and a league
              game log naming the game; a lagging source defers the game.
              "Later runs cannot change its numbers" is the export's and
              team:sync's refusal to rewrite a published game file; the
              reviewed correction is export_game_payload.py's
              --allow-rewrite, by PR. */}
          <p>
            The site does not update live. A scheduled run late each night and another each
            morning look for new games. A game is published by the first run that finds every
            source it needs. Those are its box score and play-by-play, its ruler, both teams’
            shots matching the box score, and the league’s own record of the game. A game missing
            any of them waits for a later run, and nothing is published until every check passes.
            Once a game is published, later runs cannot change its numbers. A run that would
            change them stops instead, and only a reviewed correction can.
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
            {/* A team season's banner photograph (ADR-0087, decision 7):
                credited here like a hero banner, and only once one is on
                file; a season on the typographic poster has none. */}
            {TEAMS.flatMap((team) =>
              team.seasons
                .filter((season) => team.homes[season]?.banner !== undefined)
                .map((season) => (
                  <li key={`${team.slug}-${season}`}>
                    {team.name} {season} banner:{' '}
                    {team.homes[season]!.banner!.imageCredit ?? 'photograph credit pending'}
                  </li>
                )),
            )}
          </ul>
          {/* The typeface credit is what makes the closing "entirely" true:
              the card renderer opens two webfont files beside the headshot
              and the wordmark (scripts/generate_social_cards.py), so before
              this line the totality claim excluded assets it was baking in.
              Keep the two in sync — a new face on the site belongs here.
              "Those photographs" is load-bearing too: a game card is redrawn
              with its game's photograph (ADR-0094), credited on the card
              itself (PosterBanner's credit line and the card's corner), so
              without it the closing claim would exclude an image it bakes in. */}
          <p className="methodology-credits-note">
            Player headshots are the NBA's standard player photographs, from the league's
            media CDN. Team marks are the franchises' primary marks from the same source,
            normalized to one shared canvas. The Good Shots wordmark is the site's own
            branding, and the type is set in Public Sans, IBM Plex Mono, and Big Shoulders
            Display, all open-licensed and self-hosted. A game's own photograph, when it has
            one, is credited on that game's report card and on its share card. Share cards
            are generated entirely from the assets credited here and those photographs.
          </p>
        </section>
      </main>
      {/* The shared sign-off, a sibling of main (the contentinfo rule). The
          directory's link leads; the page never links to itself. */}
      <SiteFooter methodologyLink={false} />
    </>
  )
}
