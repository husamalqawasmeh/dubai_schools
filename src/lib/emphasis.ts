/**
 * Marks a few words in a sentence for bolding.
 *
 * Returns pieces rather than a string of HTML, so the pages can render it with
 * ordinary JSX and no `set:html` anywhere. That matters less for the FAQ, whose
 * text we write, than for the habit: the moment one page renders raw HTML from
 * a helper, the next one does it with text somebody else typed.
 *
 * The list is here rather than in either FAQ because both pages use it and a
 * word emphasised on one and not the other reads as an oversight.
 */
const PHRASES = [
  // The flat answer to "does paying change anything". It is the whole answer,
  // and it should look like it.
  "No.",
  // The three ways a school is asked to act. If a reader skims one line of an
  // answer, it should be the one telling them what to do.
  "Communicate",
  "send us",
  "share",
];

/* Longest first, so "send us" is matched before a shorter phrase could take
   part of it. Escaped, because "No." contains a dot that would otherwise match
   any character.

   Word-bounded, and that boundary is the difference between working and not:
   without it "share" matched inside "shared" and "shareholder", which bolded
   half a word and left the rest plain. The trailing boundary is added only
   when the phrase ends in a word character — after the dot of "No." it would
   demand a letter immediately following the full stop, which never happens. */
const bounded = (p: string) => {
  const esc = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tail = /[a-z0-9]$/i.test(p) ? "\\b" : "";
  return `\\b${esc}${tail}`;
};

const PATTERN = new RegExp(
  `(${PHRASES.slice()
    .sort((a, b) => b.length - a.length)
    .map(bounded)
    .join("|")})`,
  "g"
);
export type Piece = { t: string; b: boolean };

/**
 * Splits a paragraph into plain and bold pieces.
 *
 * Case-sensitive on purpose. "Communicate" is the name of a page and "no" is an
 * ordinary word that appears all over these answers — matching either loosely
 * would bold half the page and the emphasis would stop meaning anything.
 */
export function emphasise(text: string): Piece[] {
  return text
    .split(PATTERN)
    .filter((part) => part !== "")
    .map((part) => ({ t: part, b: PHRASES.includes(part) }));
}
