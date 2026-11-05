"""Tests for the game photo finder (ADR-0094 as amended 2026-11-05).

The page is synthetic but shaped like the Jazz news page's embedded data as
read 2026-11-05 (the frames are that page's real filenames and records), so
what must never regress silently is the judging: a Getty frame never reads
as a candidate however it is spelled, a recap header counts only for its
own game, a filename that names a date decides the game, and the loop's
step never halts a session.
"""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path

import pytest

import find_game_photos as fgp
import season_update as su

TEAM = "Utah Jazz"
CDN = "https://cdn.nba.com/teams/uploads/sites/1610612762/2026"


def art(id_, when, title, src, w=5000, h=3333, credit="", copyright="", caption=""):
    return {"id": id_, "type": "article", "date": when, "title": title,
            "permalink": f"https://www.nba.com/jazz/news/{id_}",
            "featuredImage": {"type": "image", "src": src, "size": {"width": w, "height": h},
                              "credit": credit, "copyright": copyright, "caption": caption,
                              "attributes": {"src": src}}}


ARTICLES = [
    art("por-recap", "2026-10-31T22:19:42Z",
        "Offensive Struggles Sink Utah Jazz in Loss to Trail Blazers: Key Takeaways",
        f"{CDN}/10/103126_UTA-vs-POR_ED_Edits-22.jpg"),
    art("sas-preview", "2026-11-01T22:47:12Z",
        "Preview: Utah Jazz Begin Road Trip Against San Antonio Spurs",
        f"{CDN}/11/103126_UTA-vs-POR_ED_Edits-7.jpg"),
    art("winter", "2026-11-02T20:00:00Z", "Post Malone to Headline New Year's Eve",
        f"{CDN}/10/JAZ2627_WinterWeekendArticle_FeaturnedImage_1920x1080.jpg", 1920, 1080),
    art("sas-recap", "2026-11-03T04:59:00Z",
        "Utah Jazz Fall to San Antonio Spurs to Begin Road Trip: Key Takeaways",
        f"{CDN}/11/DSC00608.jpg", 6471, 4512, credit="Emma Decasa"),
    art("roundup", "2026-11-03T18:00:00Z", "Roundball Roundup: Road Trip",
        f"{CDN}/10/2302573743.jpg", credit="Alex Goodlett", copyright="2026 NBAE"),
    art("injuries", "2026-11-03T19:00:00Z", "Utah Jazz Injury Updates",
        f"{CDN}/10/GettyImages-2301208100.jpg"),
    art("nop-preview", "2026-11-03T22:18:07Z",
        "Preview: Utah Jazz Look to Bounce Back Against Pelicans", f"{CDN}/11/DSC00504.jpg"),
    art("nop-recap", "2026-11-05T04:51:18Z",
        "Utah Jazz Fall Short in Overtime Against Pelicans: Key Takeaways",
        f"{CDN}/11/DSC01661.jpg", 5243, 3647),
]

GAMES = [
    fgp.Game("2026-10-31-por", date(2026, 10, 31), "POR", True, 90, 112),
    fgp.Game("2026-11-02-sas", date(2026, 11, 2), "SAS", False, 104, 118),
    fgp.Game("2026-11-04-nop", date(2026, 11, 4), "NOP", False, 113, 120),
]
NICKNAMES = {"POR": "Blazers", "SAS": "Spurs", "NOP": "Pelicans"}


def page(articles=ARTICLES) -> str:
    data = {"props": {"pageProps": {
        "pageObject": {"type": "page", "title": "News", "date": "2022-05-10T16:00:37Z",
                       "permalink": "https://www.nba.com/jazz/news", "featuredImage": {}},
        "content": {"grid": [{"items": articles}]}}}}
    # Next.js escapes "<" in the embedded JSON, so a title can never close
    # the script element early.
    payload = json.dumps(data).replace("<", "\\u003c")
    return ('<html><body><script id="__NEXT_DATA__" type="application/json">'
            f"{payload}</script></body></html>")


def reports(articles=ARTICLES, on_file=None) -> dict[str, fgp.GameReport]:
    found = fgp.match(fgp.parse_articles(page(articles)), GAMES, TEAM, NICKNAMES, on_file or {})
    return {r.game.slug: r for r in found}


def names(cs) -> list[tuple[str, str]]:
    return [(c.evidence, c.frame.filename) for c in cs]


def test_parse_reads_every_article_and_skips_the_page_itself():
    articles = fgp.parse_articles(page())
    assert [a.id for a in articles] == [a["id"] for a in ARTICLES]  # oldest first
    recap = articles[3]
    assert recap.frame == fgp.Frame(f"{CDN}/11/DSC00608.jpg", 6471, 4512, credit="Emma Decasa")


def test_parse_fails_loudly_when_the_page_shape_changes():
    with pytest.raises(fgp.FinderError, match="__NEXT_DATA__"):
        fgp.parse_articles("<html>no data</html>")
    with pytest.raises(fgp.FinderError, match="no articles"):
        fgp.parse_articles(page([]))


@pytest.mark.parametrize("frame, tier", [
    (fgp.Frame("x/DSC01661.jpg", 5243, 3647), "team"),
    (fgp.Frame("x/DSC00608.jpg", 6471, 4512, credit="Emma Decasa"), "team"),
    # Getty, every way the 2026-27 CDN spells it.
    (fgp.Frame("x/GettyImages-2302465822.jpg", 5530, 3687), "getty"),
    (fgp.Frame("x/2301566278.jpg", 4981, 3984), "getty"),  # the bare id, no record
    (fgp.Frame("x/DSC1.jpg", 5000, 3333, caption="Photo by Alex Goodlett/Getty Images"), "getty"),
    (fgp.Frame("x/DSC2.jpg", 5000, 3333, copyright="2026 NBAE"), "getty"),
    (fgp.Frame("x/DSC3.jpg", 5000, 3333, caption="Petre Thomas-Imagn Images"), "wire"),
    (fgp.Frame("x/DSC4.jpg", 5000, 3333, caption="(AP Photo/Rob Gray)"), "wire"),
    (fgp.Frame("x/DSC5.jpg", 5000, 3333, caption="a slap of hands"), "team"),
    (fgp.Frame("x/2526-JAZ-Welcome_Web-Article-1920x1080-1.png", 1920, 1080), "graphic"),
])
def test_tier_reads_the_record_and_the_filename(frame, tier):
    assert fgp.tier_of(frame)[0] == tier


def test_house_credit_takes_the_two_forms():
    assert fgp.house_credit(fgp.Frame("x/a.jpg", 1, 1, credit="Emma Decasa"), TEAM) == \
        "photograph by Emma Decasa, Utah Jazz"
    assert fgp.house_credit(fgp.Frame("x/a.jpg", 1, 1), TEAM) == "photograph via the Utah Jazz"


@pytest.mark.parametrize("name, dates", [
    ("103126_UTA-vs-POR_ED_Edits-22.jpg", {date(2026, 10, 31)}),
    ("20261028_SAS_RT_UTA_110.jpg", {date(2026, 10, 28)}),
    ("DSC01661.jpg", set()),
    ("ZMR03509-1.jpg", set()),
    ("2301566278.jpg", set()),  # a ten-digit Getty id is not a date
])
def test_filename_dates(name, dates):
    assert fgp.filename_dates(fgp.Frame(f"x/{name}", 1, 1)) == dates


def test_each_game_gets_its_recap_and_the_frames_that_follow_it():
    r = reports()
    assert names(r["2026-10-31-por"].candidates) == [
        ("verified", "103126_UTA-vs-POR_ED_Edits-22.jpg"),
        # The next preview's header, verified by its filename's date.
        ("verified", "103126_UTA-vs-POR_ED_Edits-7.jpg"),
    ]
    sas = r["2026-11-02-sas"]
    assert names(sas.candidates) == [("recap", "DSC00608.jpg"), ("later", "DSC00504.jpg")]
    assert sas.candidates[0].credit == "photograph by Emma Decasa, Utah Jazz"
    assert sas.best == "recap"
    assert {(c.frame.filename, c.tier) for c in sas.rejected} == {
        ("JAZ2627_WinterWeekendArticle_FeaturnedImage_1920x1080.jpg", "graphic"),
        ("2302573743.jpg", "getty"), ("GettyImages-2301208100.jpg", "getty")}
    nop = r["2026-11-04-nop"]
    assert names(nop.candidates) == [("recap", "DSC01661.jpg")]
    assert not any(r[s].out_of_reach for s in r)


def test_a_recap_counts_only_for_its_own_game():
    # An afternoon game's recap lands inside the previous game's later
    # window. It is the Spurs game's recap, so it never counts for Portland.
    early = art("sas-recap", "2026-11-02T17:30:00Z",
                "Utah Jazz Fall to San Antonio Spurs to Begin Road Trip: Key Takeaways",
                f"{CDN}/11/DSC00608.jpg", 6471, 4512, credit="Emma Decasa")
    r = reports([*ARTICLES[:3], early, *ARTICLES[4:]])
    por = r["2026-10-31-por"]
    assert "DSC00608.jpg" not in {c.frame.filename for c in por.candidates + por.rejected}
    assert names(r["2026-11-02-sas"].candidates)[0] == ("recap", "DSC00608.jpg")


def test_a_same_opponent_recap_outside_the_window_is_not_the_recap():
    # 10-28's Spurs recap (a game this test does not list) is no 11-02 recap.
    early = art("old-sas", "2026-10-29T04:32:54Z",
                "Utah Jazz Fall Short in Overtime Against San Antonio Spurs: Key Takeaways",
                f"{CDN}/10/DSC07954.jpg")
    sas = reports([early, *ARTICLES])["2026-11-02-sas"]
    assert "DSC07954.jpg" not in {c.frame.filename for c in sas.candidates}


def test_a_filename_that_names_a_date_decides_the_game():
    # A Portland frame heading the Spurs recap is a Portland frame.
    misplaced = art("sas-recap", "2026-11-03T04:59:00Z",
                    "Utah Jazz Fall to San Antonio Spurs: Key Takeaways",
                    f"{CDN}/11/103126_UTA-vs-POR_ED_Edits-30.jpg")
    r = reports([*ARTICLES[:3], misplaced, *ARTICLES[4:]])
    assert "103126_UTA-vs-POR_ED_Edits-30.jpg" not in {
        c.frame.filename for c in r["2026-11-02-sas"].candidates}
    assert ("verified", "103126_UTA-vs-POR_ED_Edits-30.jpg") in names(r["2026-10-31-por"].candidates)


def test_a_frame_on_file_says_so_and_is_not_new():
    nop = reports(on_file={"DSC01661.jpg": "img/games/2026-11-04-nop.jpg"})["2026-11-04-nop"]
    assert nop.candidates[0].on_file == "img/games/2026-11-04-nop.jpg"
    assert nop.best is None


def test_a_game_older_than_the_page_is_out_of_reach():
    late = [a for a in ARTICLES if a["date"] >= "2026-11-03"]
    assert reports(late)["2026-10-31-por"].out_of_reach


def test_photographed_reads_the_config_keys():
    text = "export const GAME_PHOTOS = {\n  '2026-10-23-nop': {\n    imagePath: 'x',\n  },\n}\n"
    assert fgp.photographed(text) == {"2026-10-23-nop"}
    real = fgp.photographed(fgp.GAME_PHOTOS_TS.read_text(encoding="utf-8"))
    assert {"2026-10-23-nop", "2026-10-25-lal", "2026-10-31-por"} <= real


def test_recorded_sources_maps_each_source_to_its_committed_file():
    text = ("- `public/img/games/2026-10-25-lal.jpg`, Jackson driving: the recap header,\n"
            "  `cdn.nba.com/teams/uploads/sites/1610612762/2026/10/DSC05370.jpg`\n"
            "  (5000x2985).\n- `public/img/utah-logo.png`, the mark.\n")
    assert fgp.recorded_sources(text) == {"DSC05370.jpg": "img/games/2026-10-25-lal.jpg"}
    real = fgp.recorded_sources(fgp.IMAGE_CREDITS_MD.read_text(encoding="utf-8"))
    assert real["DSC06907.jpg"] == "img/jazz-2026-27-banner.jpg"


def test_the_sheet_escapes_the_page_and_names_the_command(tmp_path: Path):
    hostile = art("x", "2026-11-05T04:51:18Z", "<script>alert(1)</script> Pelicans: Key Takeaways",
                  f"{CDN}/11/DSC01661.jpg")
    r = fgp.match(fgp.parse_articles(page([hostile])), GAMES[2:], TEAM, NICKNAMES, {})
    sheet = fgp.render_sheet(r, TEAM, "2026-27", fgp.datetime.now(fgp.timezone.utc))
    assert "<script>alert" not in sheet
    assert f"npm run game:photo -- 2026-11-04-nop {CDN}/11/DSC01661.jpg" in sheet


def test_the_loop_step_reports_a_failure_and_never_raises(monkeypatch):
    def broken(*_a, **_k):
        raise fgp.FinderError("could not read https://www.nba.com/jazz/news: timed out")
    monkeypatch.setattr(su.find_game_photos, "run", broken)
    entry = {"team": TEAM, "tricode": "UTA", "season": "2026-27"}
    assert su.photo_candidates_step(entry) == {
        "error": "could not read https://www.nba.com/jazz/news: timed out"}

    def unexpected(*_a, **_k):
        raise KeyError("games")  # a bug, not a page problem: still never a halt
    monkeypatch.setattr(su.find_game_photos, "run", unexpected)
    assert "error" in su.photo_candidates_step(entry)


def test_the_loop_step_passes_the_summary_through(monkeypatch):
    summary = {"file": "sheet.html", "unphotographed": 2,
               "games": {"a": {"candidates": 1, "best": "recap", "outOfReach": False},
                         "b": {"candidates": 0, "best": None, "outOfReach": True}}}
    monkeypatch.setattr(su.find_game_photos, "run", lambda *a, **k: summary)
    assert su.photo_candidates_step({"team": TEAM, "tricode": "UTA", "season": "2026-27"}) == summary
