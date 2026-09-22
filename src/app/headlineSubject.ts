// Who the headline pair is about (HeadlineBanner's `subject` prop), kept out
// of the component file so fast refresh sees only components there.

/**
 * Who the headline pair is about, for the pronoun-bearing labels. Hero
 * pages take the default (the argument is about one player); the team
 * surface (ADR-0081) passes the team's. Structural copy either way — the
 * words change, the numbers and their identities do not.
 */
export interface HeadlineSubject {
    /** "his" / "their" — in "expected from his diet". */
    possessive: string
    /** Sentence-initial form of the possessive — "His" / "Their". */
    Possessive: string
    /** "he scored" / "they scored". */
    scored: string
}

export const HERO_SUBJECT: HeadlineSubject = {
    possessive: 'his',
    Possessive: 'His',
    scored: 'he scored',
}

export const TEAM_SUBJECT: HeadlineSubject = {
    possessive: 'their',
    Possessive: 'Their',
    scored: 'they scored',
}
