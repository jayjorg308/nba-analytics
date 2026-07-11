# nba-analytics

An interactive shot chart tool that answers one question about one NBA player: is he taking good shots?

Most shot chart sites show you a scatter of makes and misses and let you draw your own conclusions. I wanted this to go the other way. The page states its answer up front and then backs it up, so it reads question -> verdict -> proof. You get the answer in plain words first, then the two headline numbers, then a zone-shaded court and a table for anyone who wants to check the work.

**Live:** [Cody Williams](https://nba-analytics-ten.vercel.app/) on `main`. Keyonte George runs as a second deployment off the `hero/keyonte-george` branch.

## The model

Two axes, both measured in points per shot (PPS) against league average:

- **Shot selection**: where he shoots from, priced at league-average conversion. Tells you whether his shot diet is any good, no matter if the shots go in.
- **Shot making**: what he actually scored versus what his diet should yield. Tells you whether he converts.

The two decompose exactly: league diet + selection + making = his actual PPS. Cody Williams picks fine shots and misses them. Keyonte George picks worse shots and makes them. Same engine, opposite verdicts.

Small samples get flagged (†) but never hidden, dropped rows get counted and reported, and the verdict sentence itself is covered by a test that fails the build if the data stops backing the claims.

## How the data works

Everything comes from the stats.nba.com shotchartdetail endpoint, pulled locally. That endpoint blocks cloud IPs, so pulls never run in CI or production.

1. `python ingestion/pull_shots.py --player "Name"` grabs a raw snapshot (append-only, gitignored)
2. `python ingestion/derive_payload.py --player "Name" --season 2025-26` validates it and derives the typed payload
3. `npm run hero:sync` copies that to `public/data/`, which is committed and deployed

The app only ever reads the committed JSON. A data refresh is just a new commit.

## One hero per deployment

The engine is player-agnostic but each deployment focuses on a single player. `main` is Cody Williams. Other heroes live on `hero/*` branches that never merge back, and Vercel gives each branch its own URL. Swapping heroes means editing `src/heroConfig.ts` (including writing a new verdict), rewriting the verdict guard to match the new claims, and syncing the payload. Everything else stays identical.

## Running it locally

```
npm install
npm run dev
```

The gates:

```
npm test
npm run lint
npm run build
python -m pytest ingestion -q
```

The whole suite runs on a clean clone. It includes some unusual guards: one parses the actual CSS and enforces contrast and luminance rules on the court's color scale, one checks every claim in the verdict copy against the deployed data, and a golden fixture keeps the Python derive step and the TypeScript schema honest with each other.

Built with React, TypeScript, Vite, and Zod. The court is hand-rolled SVG, no chart libraries.

## Docs

- [CONTEXT.md](CONTEXT.md) is the glossary. The terms in there are the ones the code uses.
- [docs/adr/](docs/adr/) records the decisions and the reasoning behind them (19 so far).
- [docs/ROADMAP.md](docs/ROADMAP.md) is where this is headed. v2 is shot creation: catch-and-shoot vs pull-up, shot clock, contested.
