"""The game photo finder (ADR-0094 as amended 2026-11-05): list every
published game's candidate photographs, never choose one.

A game's photograph is authored by a person, by PR (ADR-0094). What this
step automates is the finding. The team's own site heads each recap with a
photograph, and its news page embeds every recent article's header image
as structured data (Next.js `__NEXT_DATA__`), its credit, copyright, and
caption fields included. That is enough to sort a frame by license tier
without opening it:

  team     no credit, or a name with no Getty, NBAE, or wire notice: the
           tier the site uses ("photograph via the Utah Jazz", or
           "photograph by <Name>, Utah Jazz" where the record names one)
  getty    a credit, copyright, or caption naming Getty or NBAE, or a Getty
           filename (GettyImages-<id>, or the bare ten-digit id the 2026-27
           CDN uses, which says nothing about Getty): the tier the site
           left on 2026-07-30
  wire     a record naming a wire service (Imagn, AP, Reuters, USA TODAY)
  graphic  a designed 1920x1080 asset (a signing card, an event poster)

and to grade how sure we are that a frame is from its game:

  verified  the filename names the game's date (103126_UTA-vs-POR_...)
  recap     the header of the game's own recap: a strong inference, not
            proof (a recap's header has been from its game every time it
            was checked, but nothing in the file says so)
  later     the header of an article published after the game and before
            the next one, most often the next game's preview: this game
            or an earlier one

The page reaches about two weeks back, so a game older than that lists no
candidates; the 06:30 session runs the finder daily, after its team session.
The finder writes one HTML contact sheet per team season under
data/season-loop/photo-candidates/: each frame through the site's grayscale
filter at the banner's two crops, its suggested credit, its evidence, and
the game:photo command that adds it. It reads the CDN's 800px previews,
never downloads a full-size image, never edits a config, never commits.
Local only, like everything that reads nba.com.

Usage:
  python ingestion/find_game_photos.py [--team UTA] [--season 2026-27]
      [--html-file saved-news-page.html] [--out-file sheet.html]
"""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
import urllib.request
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
OUT_DIR = REPO / "data" / "season-loop" / "photo-candidates"
GAME_PHOTOS_TS = REPO / "src" / "teams" / "gamePhotos.ts"
IMAGE_CREDITS_MD = REPO / "docs" / "image-credits.md"
USER_AGENT = "Mozilla/5.0 (compatible; goodshots-photo-finder)"

# The banner's two crops (src/App.css .hero-banner, .hero-banner-photo): the
# wide photo panel is 60% of a 1126x600 banner; the portrait poster is a
# phone's first viewport, about 390x760.
WIDE_PANEL = (338, 300)
PHONE = (154, 300)
PHOTO_FILTER = "grayscale(1) contrast(1.08) brightness(0.94)"

NEXT_DATA = re.compile(
    r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', re.S)
GETTY_TEXT = re.compile(r"getty|nbae", re.I)
# The wire names case-blind; AP only as a capitalized word ("slap" is not AP).
WIRE_TEXT = re.compile(r"(?i:imagn|usa today|associated press|reuters)|\bAP\b")
# GettyImages-2302465822.jpg, and the bare id spelling: 2301566278.jpg.
GETTY_NAME = re.compile(r"^(GettyImages-\d+|\d{9,11})(-\d+)?\.(jpe?g|png|webp)$", re.I)
GRAPHIC_NAME = re.compile(r"1920x1080|web-article|featur", re.I)
RECAP_TITLE = re.compile(r"key takeaways|\d{2,3},.+\d{2,3}", re.I)
DATE_TOKEN = re.compile(r"(?<!\d)(\d{6}|\d{8})(?!\d)")
GAME_PHOTO_KEY = re.compile(r"^\s*'(\d{4}-\d{2}-\d{2}-[a-z]{3})':\s*\{", re.M)

# The team site's route segment where it is not the nickname's last word.
SITE_SLUGS = {"Portland Trail Blazers": "blazers", "Philadelphia 76ers": "sixers"}

EVIDENCE_RANK = {"verified": 0, "recap": 1, "later": 2}


class FinderError(Exception):
    """The page could not be read as expected: the report says why."""


@dataclass(frozen=True)
class Frame:
    src: str
    width: int
    height: int
    credit: str = ""
    copyright: str = ""
    caption: str = ""

    @property
    def filename(self) -> str:
        return self.src.rsplit("/", 1)[-1]

    def preview(self, width: int = 800) -> str:
        return f"{self.src}?imwidth={width}"


@dataclass(frozen=True)
class Article:
    id: str
    published: datetime  # UTC
    title: str
    permalink: str
    frame: Frame | None


@dataclass(frozen=True)
class Game:
    slug: str
    game_date: date
    opponent: str  # tricode
    home: bool
    team_score: int
    opponent_score: int


@dataclass
class Candidate:
    frame: Frame
    article: Article
    evidence: str  # verified | recap | later
    tier: str
    tier_reason: str
    credit: str | None  # the house form, team tier only
    on_file: str | None = None  # where docs/image-credits.md already records it


@dataclass
class GameReport:
    game: Game
    candidates: list[Candidate] = field(default_factory=list)  # team tier
    rejected: list[Candidate] = field(default_factory=list)
    out_of_reach: bool = False

    @property
    def best(self) -> str | None:
        fresh = [c for c in self.candidates if c.on_file is None]
        return min((c.evidence for c in fresh), key=EVIDENCE_RANK.__getitem__, default=None)


# --- Reading the page ---------------------------------------------------------

def parse_articles(page: str) -> list[Article]:
    """Every article on the news page with its header frame, oldest first."""
    m = NEXT_DATA.search(page)
    if m is None:
        raise FinderError("no __NEXT_DATA__ on the news page (the page shape changed)")
    found: dict[str, Article] = {}

    def walk(o: object) -> None:
        if isinstance(o, dict):
            if ("featuredImage" in o and "permalink" in o and "date" in o
                    and "title" in o and o.get("type") != "page"):
                article = _article(o)
                found.setdefault(article.id or article.permalink, article)
            for v in o.values():
                walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)

    walk(json.loads(m.group(1)))
    if not found:
        raise FinderError("the news page lists no articles (the page shape changed)")
    return sorted(found.values(), key=lambda a: a.published)


def _article(o: dict) -> Article:
    fi = o.get("featuredImage") or {}
    attrs = fi.get("attributes") or {}
    src = fi.get("src") or attrs.get("src")
    size = fi.get("size") or attrs.get("size") or {}
    frame = None
    if src:
        frame = Frame(
            src=str(src).split("?", 1)[0], width=int(size.get("width") or 0),
            height=int(size.get("height") or 0),
            credit=str(fi.get("credit") or attrs.get("credit") or "").strip(),
            copyright=str(fi.get("copyright") or attrs.get("copyright") or "").strip(),
            caption=str(fi.get("caption") or attrs.get("caption") or "").strip())
    published = datetime.fromisoformat(str(o["date"]).replace("Z", "+00:00"))
    if published.tzinfo is None:
        published = published.replace(tzinfo=timezone.utc)
    return Article(id=str(o.get("id") or ""), published=published,
                   title=str(o["title"]).strip(), permalink=str(o["permalink"]), frame=frame)


def fetch_news_page(team: str) -> str:
    slug = SITE_SLUGS.get(team, team.split()[-1].lower())
    url = f"https://www.nba.com/{slug}/news"
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.read().decode("utf-8")
    except OSError as exc:
        raise FinderError(f"could not read {url}: {exc}") from exc


# --- Judging a frame ----------------------------------------------------------

def tier_of(frame: Frame) -> tuple[str, str]:
    """The frame's license tier and the reason, read off its record."""
    record = " ".join((frame.credit, frame.copyright, frame.caption))
    if GETTY_TEXT.search(record):
        return "getty", "the record names Getty or NBAE"
    if GETTY_NAME.match(frame.filename):
        return "getty", "a Getty filename"
    if WIRE_TEXT.search(record):
        return "wire", "the record names a wire service"
    if (frame.width, frame.height) == (1920, 1080) or GRAPHIC_NAME.search(frame.filename):
        return "graphic", "a designed 1920x1080 asset"
    if frame.credit:
        return "team", f"credited {frame.credit}, no Getty or wire notice"
    return "team", "no credit on the record"


def house_credit(frame: Frame, team: str) -> str:
    """The credit in its house form (CONTEXT.md's Hero banner entry): the
    record's name where it gives one, the team grain where it gives none."""
    return f"photograph by {frame.credit}, {team}" if frame.credit else f"photograph via the {team}"


def filename_dates(frame: Frame) -> set[date]:
    """Every date the filename spells as MMDDYY or YYYYMMDD. This century
    only: strptime reads 103126 as the year 1031 too."""
    out: set[date] = set()
    for token in DATE_TOKEN.findall(frame.filename):
        for fmt in ("%m%d%y", "%Y%m%d"):
            try:
                d = datetime.strptime(token, fmt).date()
            except ValueError:
                continue
            if 2000 <= d.year < 2100:
                out.add(d)
    return out


# --- Matching frames to games ------------------------------------------------

def nickname(tricode: str) -> str:
    from derive_payload import TEAM_ABBREV  # the ADR-0028 map, one copy

    names = [name for name, code in TEAM_ABBREV.items() if code == tricode]
    if not names:
        raise FinderError(f"unknown tricode {tricode}")
    return names[0].split()[-1]


def _utc(d: date, hour: int) -> datetime:
    return datetime(d.year, d.month, d.day, hour, tzinfo=timezone.utc)


def recap_window(game: Game) -> tuple[datetime, datetime]:
    """A recap posts the night of the game (a matinee's by early evening),
    which in UTC is the game date's afternoon through the next morning."""
    return _utc(game.game_date, 12), _utc(game.game_date + timedelta(days=1), 18)


def match(articles: list[Article], games: list[Game], team: str,
          nicknames: dict[str, str], on_file: dict[str, str]) -> list[GameReport]:
    """Each game's candidate frames, strongest evidence first. A filename
    that names a date decides the game outright, wherever the page carries
    it; otherwise an article that is some game's recap counts only for that
    game, and any other article published after a game and before the next
    one counts for it as later."""
    games = sorted(games, key=lambda g: g.game_date)
    recap_of: dict[str, str] = {}
    for g in games:
        lo, hi = recap_window(g)
        nick = nicknames[g.opponent].lower()
        for a in articles:
            if lo <= a.published < hi and RECAP_TITLE.search(a.title) and nick in a.title.lower():
                recap_of.setdefault(a.permalink, g.slug)

    earliest = min((a.published for a in articles), default=None)
    reports = []
    for i, g in enumerate(games):
        report = GameReport(g)
        next_date = games[i + 1].game_date if i + 1 < len(games) else g.game_date + timedelta(days=4)
        later_lo, later_hi = _utc(g.game_date, 18), _utc(next_date, 18)
        report.out_of_reach = earliest is None or earliest > recap_window(g)[1]
        best: dict[str, Candidate] = {}
        for a in articles:
            if a.frame is None:
                continue
            dates = filename_dates(a.frame)
            if g.game_date in dates:
                evidence = "verified"  # wherever the page carries it
            elif dates:
                continue  # the filename names another game's date
            elif recap_of.get(a.permalink) == g.slug:
                evidence = "recap"
            elif a.permalink not in recap_of and later_lo <= a.published < later_hi:
                evidence = "later"
            else:
                continue
            tier, reason = tier_of(a.frame)
            c = Candidate(a.frame, a, evidence, tier, reason,
                          house_credit(a.frame, team) if tier == "team" else None,
                          on_file.get(a.frame.filename))
            prior = best.get(a.frame.src)
            if prior is None or EVIDENCE_RANK[c.evidence] < EVIDENCE_RANK[prior.evidence]:
                best[a.frame.src] = c
        ranked = sorted(best.values(), key=lambda c: (EVIDENCE_RANK[c.evidence], c.article.published))
        report.candidates = [c for c in ranked if c.tier == "team"]
        report.rejected = [c for c in ranked if c.tier != "team"]
        reports.append(report)
    return reports


# --- The repo's side ----------------------------------------------------------

def published_games(tricode: str, season: str) -> list[Game]:
    index = REPO / "public" / "data" / "_teams" / tricode.lower() / season / "index.json"
    if not index.exists():
        raise FinderError(f"no published season index at {index.relative_to(REPO).as_posix()}")
    rows = json.loads(index.read_text(encoding="utf-8"))["games"]
    return [Game(slug=r["slug"], game_date=date.fromisoformat(r["gameDate"]),
                 opponent=r["opponent"], home=bool(r["home"]),
                 team_score=int(r["teamScore"]), opponent_score=int(r["opponentScore"]))
            for r in rows]


def photographed(config_text: str) -> set[str]:
    """The game slugs src/teams/gamePhotos.ts already gives a photograph."""
    return set(GAME_PHOTO_KEY.findall(config_text))


def recorded_sources(credits_text: str) -> dict[str, str]:
    """Source filenames docs/image-credits.md already records, mapped to the
    committed file each entry is for, so a frame already on the site (a
    game's photo, a banner) says so instead of looking new."""
    out: dict[str, str] = {}
    for entry in re.split(r"\n(?=- )", credits_text):
        committed = re.search(r"`public/(img/[^`]+)`", entry)
        if committed is None:
            continue
        for name in re.findall(r"cdn\.nba\.com/[^`\s]*/([^/`\s]+\.(?:jpe?g|png|webp))", entry, re.I):
            out.setdefault(name, committed.group(1))
    return out


# --- The contact sheet ----------------------------------------------------------

def _result(g: Game) -> str:
    wl = "W" if g.team_score > g.opponent_score else "L"
    where = "vs" if g.home else "at"
    return f"{g.game_date.isoformat()} {where} {g.opponent}, {wl} {g.team_score}-{g.opponent_score}"


def render_sheet(reports: list[GameReport], team: str, season: str, read_at: datetime,
                 error: str | None = None) -> str:
    e = html.escape
    wide_w, wide_h = WIDE_PANEL
    phone_w, phone_h = PHONE
    parts = [f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Game photo candidates</title>
<style>
:root {{ color-scheme: dark; --ink: #e8e8ea; --muted: #9a9aa2; --ground: #0a0a0c; --rule: #26262c; }}
body {{ background: var(--ground); color: var(--ink); font: 14px/1.45 system-ui, sans-serif;
  margin: 0 auto; max-width: 1100px; padding: 24px 16px 64px; }}
h1 {{ font-size: 22px; margin: 0 0 4px; }} h2 {{ font-size: 17px; margin: 36px 0 4px; }}
.muted {{ color: var(--muted); }} code {{ font-size: 12px; overflow-wrap: anywhere; }}
.frame {{ border-top: 1px solid var(--rule); display: flex; flex-wrap: wrap; gap: 16px; padding: 16px 0; }}
.crops {{ display: flex; gap: 8px; flex: none; }}
.crops img {{ object-fit: cover; filter: {PHOTO_FILTER}; background: #000; display: block; }}
.wide {{ width: {wide_w}px; height: {wide_h}px; }} .phone {{ width: {phone_w}px; height: {phone_h}px; }}
.about {{ flex: 1 1 280px; min-width: 0; }}
.tag {{ border: 1px solid var(--muted); border-radius: 3px; font-size: 11px; padding: 0 5px;
  text-transform: uppercase; letter-spacing: .04em; }}
.tag.verified {{ border-color: #7fd18b; color: #7fd18b; }} .tag.recap {{ border-color: #d9c46a; color: #d9c46a; }}
ul.rejected {{ color: var(--muted); padding-left: 18px; }}
</style></head><body>
<h1>{e(team)} {e(season)}: game photo candidates</h1>
<p class="muted">Read from the team's news page {e(read_at.strftime('%Y-%m-%d %H:%M UTC'))}.
Each frame is shown through the site's grayscale filter at the banner's wide panel and the
phone poster, both centered; set the real focal points in the browser. Only team frames are
candidates. A frame's game is proved only when its filename names the date: confirm a
recap or later frame's game (the venue, the opponent's jersey) before writing its alt text.</p>"""]
    if error:
        parts.append(f"<p><strong>The page could not be read:</strong> {e(error)}</p>")
    if not reports and not error:
        parts.append("<p>Every published game has a photograph.</p>")
    for r in reports:
        g = r.game
        parts.append(f"<h2>{e(_result(g))} <span class='muted'>({e(g.slug)})</span></h2>")
        if r.out_of_reach:
            parts.append("<p class='muted'>Older than the news page reaches: look by hand "
                         "(docs/research/jazz-2026-27-game-photos.md has the method).</p>")
        elif not r.candidates:
            parts.append("<p class='muted'>No team frame found. The game stays on the "
                         "typographic poster unless one turns up.</p>")
        for c in r.candidates:
            f = c.frame
            on_file = (f"<p><strong>Already on file</strong> as <code>{e(c.on_file)}</code>.</p>"
                       if c.on_file else "")
            parts.append(f"""<div class="frame">
<div class="crops"><img class="wide" src="{e(f.preview())}" alt="" loading="lazy">
<img class="phone" src="{e(f.preview())}" alt="" loading="lazy"></div>
<div class="about"><p><span class="tag {e(c.evidence)}">{e(c.evidence)}</span>
<code>{e(f.filename)}</code> <span class="muted">{f.width}x{f.height}</span></p>
<p>{e(c.article.published.strftime('%m-%d %H:%M UTC'))},
<a href="{e(c.article.permalink)}" style="color:inherit">{e(c.article.title)}</a></p>
<p>Credit: {e(c.credit or '')} <span class="muted">({e(c.tier_reason)})</span></p>{on_file}
<p><code>npm run game:photo -- {e(g.slug)} {e(f.src)}</code></p></div></div>""")
        if r.rejected:
            items = "".join(
                f"<li><code>{e(c.frame.filename)}</code>, {e(c.tier)}: {e(c.tier_reason)}"
                f" ({e(c.evidence)})</li>" for c in r.rejected)
            parts.append(f"<p class='muted'>Not candidates:</p><ul class='rejected'>{items}</ul>")
    parts.append("</body></html>\n")
    return "\n".join(parts)


# --- Entry points -------------------------------------------------------------

def run(team: str, tricode: str, season: str, *, page: str | None = None,
        out_file: Path | None = None) -> dict:
    """Find, write the sheet, and return the summary the loop's status file
    keeps. Raises FinderError when the page cannot be read; the loop catches
    it, since this step never halts a session."""
    out_file = out_file or OUT_DIR / f"{tricode.lower()}-{season}.html"
    games = published_games(tricode, season)
    done = photographed(GAME_PHOTOS_TS.read_text(encoding="utf-8"))
    open_games = [g for g in games if g.slug not in done]
    on_file = recorded_sources(IMAGE_CREDITS_MD.read_text(encoding="utf-8"))
    read_at = datetime.now(timezone.utc)
    error = None
    reports: list[GameReport] = []
    try:
        articles = parse_articles(page if page is not None else fetch_news_page(team))
        nicknames = {g.opponent: nickname(g.opponent) for g in games}
        reports = [r for r in match(articles, games, team, nicknames, on_file)
                   if r.game.slug not in done]
    except FinderError as exc:
        error = str(exc)
    out_file.parent.mkdir(parents=True, exist_ok=True)
    out_file.write_text(render_sheet(reports, team, season, read_at, error), encoding="utf-8")
    if error:
        raise FinderError(f"{error} (sheet written to {out_file})")
    return {
        "file": out_file.as_posix(),
        "unphotographed": len(open_games),
        "games": {r.game.slug: {"candidates": len(r.candidates), "best": r.best,
                                "outOfReach": r.out_of_reach} for r in reports},
    }


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description="List each published game's candidate photographs.")
    ap.add_argument("--team", default="UTA", help="tricode of a season.config.json liveTeams entry")
    ap.add_argument("--season", help="default: that entry's season")
    ap.add_argument("--html-file", help="read a saved news page instead of fetching it")
    ap.add_argument("--out-file", help="default: data/season-loop/photo-candidates/<team>-<season>.html")
    args = ap.parse_args()
    config = json.loads((REPO / "season.config.json").read_text(encoding="utf-8"))
    entry = next((e for e in config.get("liveTeams", [])
                  if e["tricode"].lower() == args.team.lower()), None)
    if entry is None:
        sys.exit(f"no liveTeams entry for {args.team} in season.config.json")
    season = args.season or entry["season"]
    page = Path(args.html_file).read_text(encoding="utf-8") if args.html_file else None
    try:
        summary = run(entry["team"], entry["tricode"], season, page=page,
                      out_file=Path(args.out_file) if args.out_file else None)
    except FinderError as exc:
        sys.exit(str(exc))
    for slug, g in summary["games"].items():
        state = ("older than the page reaches" if g["outOfReach"]
                 else f"{g['candidates']} team frame(s), best {g['best'] or 'none new'}")
        print(f"  {slug}: {state}")
    print(f"{summary['unphotographed']} game(s) without a photograph; sheet -> {summary['file']}")


if __name__ == "__main__":
    main()
