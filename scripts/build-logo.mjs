/**
 * Generates the lens logo.
 *
 *   node scripts/build-logo.mjs
 *
 * WHY THIS IS GENERATED AND NOT HAND-DRAWN
 * ----------------------------------------
 * Thirteen bubbles have to sit inside a circle without overlapping each other
 * or crossing the glass edge. Hand-placing them means eyeballing 13 positions
 * and 78 pairwise distances, and being wrong somewhere. Here the packing is
 * checked: every bubble is asserted to be inside the lens and clear of its
 * neighbours before a single byte is written, so the file cannot ship with two
 * icons quietly overlapping.
 *
 * Writes:
 *   public/logo-lens.svg   the full mark, static, for sharing and print
 *   src/components/generated-lens.html   the inner markup the Astro component
 *                                        animates — generated so the drawn
 *                                        shape and the animated one cannot drift
 */
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");

/* ---------- geometry ---------- */
const CX = 110;         // lens centre
const CY = 108;
const R_OUTER = 106;    // outer edge of the ring
const RING = 11;        // ring thickness
const R_GLASS = R_OUTER - RING;   // inside face of the glass

/**
 * Bubbles are quoted at their design size and then scaled to fit.
 *
 * The first attempt did not fail because the angles were wrong — it failed
 * because the circles did not fit. Thirteen bubbles at the original radii want
 * 89% of the glass, and circle packing cannot exceed about 80% even when
 * solved perfectly. Below that ceiling it also has to look unhurried: at 50%
 * the bubbles read as floating, and above about 65% they read as a crowd.
 *
 * The bubbles are now a fifth larger than that first fit, and the glass grew
 * with them — 71 to 82 — so the fill stays near half. That headroom is not
 * only taste: these bubbles bounce, and a bubble in a full jar cannot move.
 */
const BUBBLE_SCALE = 1.13;

/* ---------- the icons ---------- */
/* Each is drawn in a 24x24 box, white stroke, no fill — a stroke reads at a
   smaller size than a filled glyph, and keeps every icon the same visual
   weight regardless of how much ink its subject wants. */
const ICONS = {
  // Filled rather than stroked. A 1.9px line has to stay 1.9px however large
  // the bubble is, so a stroked glyph gets thinner-looking as it grows and
  // never gains detail. Filled shapes carry a roof, wheels, a pediment — the
  // things that make an icon read as the object rather than as a diagram.
  // Holes (windows, ruled lines) are cut with fill-rule evenodd.
  // The pages curve away from the gutter and the outer edges fall, which is
  // what makes a book look open. Two straight-sided slabs read as a folder.
  book:
    "M11.3 6.5C8.8 4.6 5.7 3.7 2.2 3.7v12.9c3.5 0 6.6.9 9.1 2.8z" +
    "M12.7 6.5c2.5-1.9 5.6-2.8 9.1-2.8v12.9c-3.5 0-6.6.9-9.1 2.8z" +
    "M2.2 16.6c3.5 0 6.6.9 9.1 2.8v1.5c-2.5-1.9-5.6-2.8-9.1-2.8z" +
    "M21.8 16.6c-3.5 0-6.6.9-9.1 2.8v1.5c2.5-1.9 5.6-2.8 9.1-2.8z",
  school:
    "M11.4 1.2h1.2v2.4h-1.2z M12.6 1.6l3 1-3 1z" +
    "M12 3.8 22.4 8.6v1.6H1.6V8.6z" +
    "M3.4 11.4h17.2V21.8H3.4z" +
    "M10.2 15.4h3.6v6.4h-3.6z" +
    "M5.4 13.6h2.9v2.9H5.4z M15.7 13.6h2.9v2.9h-2.9z",
  government:
    "M12 1.8 22.6 7v1.6H1.4V7z" +
    "M3.6 9.8h2.5v8.6H3.6z M8.4 9.8h2.5v8.6H8.4z M13.1 9.8h2.5v8.6h-2.5z M17.9 9.8h2.5v8.6h-2.5z" +
    "M2.2 19.6h19.6v2.4H2.2z",
  pen:
    "M16.4 2.2 21.8 7.6l-2.7 2.7-5.4-5.4z" +
    "M12.6 6 18 11.4 7.9 21.5 2.5 16.1z" +
    "M1.8 17.4 6.6 22.2 1 23.4z",
  // Head under the cap rather than beside it, and a collar cut into the
  // shoulders — a plain dome over a plain arc was a chess piece.
  // Shoulders that carry arms, and a book held against one of them. A cap on a
  // head on an arc was a bust on a plinth; the arms and the book are what make
  // it a person standing there.
  student: [
    "M12 11.2a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z",
    "M12 17.8c-3.6 0-6.6 2.4-7.2 5.5l.1.5h14.2l.1-.5c-.6-3.1-3.6-5.5-7.2-5.5z" +
      "M12 17.9 10.2 20.4h3.6z",
    "M5.6 19.6 3.9 23.8h2.3l1.4-3.4z",
    "M18.4 19.6l1.7 4.2h-2.3l-1.4-3.4z",
    "M15.6 18.9h5.1v4.9h-5.1z M16.6 20.1h3.1v.8h-3.1z M16.6 21.6h2.2v.8h-2.2z",
    "M12 1.4 22.9 5.8 12 10.2 1.1 5.8z",
    "M21.2 6.5v4.6a1.1 1.1 0 1 1-1.5 0V7.1z",
  ],
  // The figure stands rather than floating: head, then a body that reaches the
  // ground, with the raised arm and the pointer drawn as strokes because an
  // arm is a line, not an area.
  // A torso that ends and legs that begin, rather than a bell reaching the
  // floor. The board gains a frame and a tray, which is what makes it a board
  // rather than a poster.
  teacher: [
    "M8.2 2.2h14.4v11.4H8.2z M9.6 3.6h11.6v8.6H9.6z" +
      "M11 5.2h8.8v1.2H11z M11 7.6h5.6v1.2H11z M11 10h7.2v1.2H11z" +
      "M8.9 13.6h13v1.2h-13z",
    "M4.9 5.2a2.9 2.9 0 1 0 0 5.8 2.9 2.9 0 0 0 0-5.8z",
    "M4.9 11.6c-2.1 0-3.8 2-3.8 4.6v1.9h7.6v-1.9c0-2.6-1.7-4.6-3.8-4.6z",
    "M2.2 18.3h2.1v5.5H2.2z M5.5 18.3h2.1v5.5H5.5z",
  ],
  // A real school bus has a bonnet, so the roof stops short of the front and
  // the windscreen rakes back from it. A plain box with three windows was a
  // van. Wheels are their own layer, or they punch holes in the body.
  bus: [
    "M1.2 8.2c0-1.7 1.4-3.1 3.1-3.1h11.2c1.1 0 2.2.5 2.9 1.4l3.4 4.1c.6.7.9 1.6.9 2.5v2.7c0 1-.8 1.8-1.8 1.8H3c-1 0-1.8-.8-1.8-1.8z" +
      "M3.6 7.4h3.2v3.9H3.6z M8.2 7.4h3.2v3.9H8.2z M12.8 7.4h2.5v3.9h-2.5z" +
      "M16.9 7.6h1.1l2.9 3.5h-4z",
    "M6.6 14.4a3.3 3.3 0 1 0 0 6.6 3.3 3.3 0 0 0 0-6.6z",
    "M17.4 14.4a3.3 3.3 0 1 0 0 6.6 3.3 3.3 0 0 0 0-6.6z",
  ],
  // Only the head is a fill; the body is in STROKES below. A football failed
  // here because a ball is recognisable by the pattern over its whole surface,
  // and that pattern is the first thing to disappear at bubble size. A runner
  // is recognisable by its pose, which survives being small.
  running: "M15.8 2.1a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z",
  certificate:
    "M3 2.4h18v12.2H3z M6.2 5.8h11.6v1.6H6.2z M6.2 9.2h7.8v1.6H6.2z" +
    "M17.2 14.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8z" +
    "M13.6 20.1 12.4 24l2.6-1.1 1.4 1.1.6-3.4z",
  // One coin, filling the box, with the dirham struck across it. The stack
  // behind it was competing for the same 24 units the symbol needed, and the
  // symbol is the part that says which currency — the discs only said "money",
  // which the bubble's company already says.
  coins: "M12 1.4a10.6 10.6 0 1 1 0 21.2 10.6 10.6 0 0 1 0-21.2z",
  rank:
    "M12 1.4l1.4 3 3.2.4-2.4 2.2.6 3.2-2.8-1.6-2.8 1.6.6-3.2L7.4 4.8l3.2-.4z" +
    "M9.2 11.4h5.6v10.8H9.2z" +
    "M2.4 14.4H8v7.8H2.4z" +
    "M16 16.4h5.6v5.8H16z",
};

/**
 * Symbols struck into a face, drawn at full strength in the bubble's colour.
 *
 * Separate from SHADE because shading is a third opacity and a struck symbol is
 * not — a dirham at 34% reads as a smudge. Separate from the icon path because
 * these subpaths overlap (the bars cross the stem), and the icons are filled
 * with evenodd, where overlapping subpaths cancel each other out instead of
 * joining.
 */
const MARK = {
  // The UAE dirham: a D-bowl on a stem with two bars through it. Worth checking
  // against the Central Bank's own artwork before this goes on anything
  // printed — it is drawn from the shape, not from the official file.
  // Thinner again. Every stroke came down together — stem, bars and the bowl's
  // wall — because thinning only the stem would have left the bowl looking
  // swollen beside it. The symbol keeps its size and its contrast; only the
  // ink came off, which is what opens the counters.
  coins:
    "M8.9 3.4h2.2v17.2H8.9z" +
    "M10.6 3.4c6 0 10 3.4 10 8.6s-4 8.6-10 8.6v-2.2c4.6 0 7.8-2.6 7.8-6.4s-3.2-6.4-7.8-6.4z" +
    "M3.4 8.9h11.2v2H3.4z" +
    "M3.4 13.1h11.2v2H3.4z",
};

/**
 * Icons drawn with lines rather than areas.
 *
 * A running figure is joints and limbs; drawn as a filled silhouette it needs
 * a dozen carefully offset quadrilaterals to say what five strokes say. The
 * widths are in the icon's own 24-unit space so they grow with the bubble.
 *
 * `far` marks the limbs on the far side of the body. They are painted over in
 * the bubble's colour afterwards, which reads as the arm and leg being behind
 * the torso rather than beside it.
 */
const STROKES = {
  teacher: [
    { d: "M6.4 13.6 10.4 10.4", w: 2.3 },   // raised arm
    { d: "M10.2 10.7 14.2 7.4", w: 1.3 },   // pointer
  ],
  // A stride, not a star jump. The knee of the leading leg drives forward and
  // up while the trailing leg extends behind, and the arms oppose them — the
  // near arm swings up as the near leg drives, which is the thing that makes a
  // figure read as running rather than as falling over.
  running: [
    { d: "M14.2 8.0 10.8 14.2",              w: 3.4 },              // torso, leaning
    { d: "M12.8 9.4 9.0 9.0 7.0 11.4",       w: 2.3, far: true },   // far arm
    { d: "M10.6 14.0 7.0 15.6 3.8 18.8",     w: 2.9, far: true },   // trailing leg
    { d: "M3.9 18.7 2.4 20.7",               w: 2.0, far: true },   // trailing foot
    { d: "M14.4 9.0 18.2 9.8 19.6 6.8",      w: 2.4 },              // near arm, up
    { d: "M11.4 13.8 15.4 16.2 14.8 20.8",   w: 2.9 },              // leading leg
    { d: "M14.8 21.0 17.4 21.4",             w: 2.0 },              // leading foot
  ],
};

/**
 * Where each icon is shaded.
 *
 * These are painted in the bubble's own colour at a third opacity, over the
 * white shape — a roof's underside, a bus's roof band, the far page of a book,
 * the patches on a ball. It is what separates one plane from another when
 * every plane is the same white.
 */
const SHADE = {
  // The ruled lines rake with the pages instead of sitting flat. The page top
  // rises from the gutter to the outer edge, so a horizontal line contradicted
  // the very curve that says the book is open — it read as a card with a fold
  // down it. Each line is a thin parallelogram on the page's own slope.
  book:        "M11.3 6.5h1.4v12.9h-1.4z" +
               "M9.8 8.8 4.2 7.1v1.1l5.6 1.7z M9.8 11.3 4.2 9.6v1.1l5.6 1.7z" +
               "M9.8 13.8 6.4 12.8v1.1l3.4 1z" +
               "M14.2 8.8 19.8 7.1v1.1l-5.6 1.7z M14.2 11.3 19.8 9.6v1.1l-5.6 1.7z" +
               "M14.2 13.8 17.6 12.8v1.1l-3.4 1z" +
               "M2.2 16.6c3.5 0 6.6.9 9.1 2.8v.5c-2.5-1.9-5.6-2.8-9.1-2.8z" +
               "M21.8 16.6c-3.5 0-6.6.9-9.1 2.8v.5c2.5-1.9 5.6-2.8 9.1-2.8z",
  school:      "M12 3.8 22.4 8.6v1.6H1.6V8.6z M3.4 11.4h17.2v1.4H3.4z",
  bus:         "M1.2 8.2c0-1.7 1.4-3.1 3.1-3.1h11.2c.5 0 1 .1 1.5.3H1.4z" +
               "M6.6 16.2a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z M17.4 16.2a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z" +
               "M1.2 12.4h20.5v1.1H1.2z",

  student:     "M12 1.4 22.9 5.8 12 10.2 1.1 5.8z M12 11.2a3.5 3.5 0 0 0-3.5 3.5h7A3.5 3.5 0 0 0 12 11.2z" +
               "M12 17.9 10.2 20.6h3.6z",
  government:  "M12 1.8 22.6 7v1.6H1.4V7z M2.2 19.6h19.6v.9H2.2z",
  teacher:     "M8.2 2.2h14.4v1.5H8.2z M4.9 5.2a2.9 2.9 0 0 0-2.9 2.9h5.8a2.9 2.9 0 0 0-2.9-2.9z" +
               "M1.1 15.6c.4-2.4 1.9-4 3.8-4s3.4 1.6 3.8 4z" +
               "M2.2 22.4h2.1v1.4H2.2z M5.5 22.4h2.1v1.4H5.5z",
  certificate: "M3 2.4h18v1.5H3z M17.2 16.2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6z",
  rank:        "M2.4 14.4H8v1.3H2.4z M16 16.4h5.6v1.3H16z",
  pen:         "M16.4 2.2 21.8 7.6l-2.7 2.7-5.4-5.4z",
};

/**
 * Icons that are not white.
 *
 * The bus is yellow on slate and the coin is gold on brown, and both are the
 * same idea: the object carries the colour, not the disc behind it. A yellow
 * disc cannot hold a white glyph anyway — at #e0a800 white is 2.15:1, under
 * the 3:1 a graphic needs — so painting the disc yellow would have forced the
 * bus itself dark, which is backwards.
 */
const FACE = {
  // The bus is the yellow thing, not the disc behind it. Painting the disc
  // yellow forced the bus itself dark, which is backwards: it is the vehicle
  // that is famously that colour.
  bus: "#efb100",
  coins: "#e0b33a",
};

/** Where the struck symbol is not the bubble's own colour. */
const MARK_COLOUR = {
  coins: "#4a3608",
};

/* Bubble colours. Distinct in hue from each other so no two read as the same
   category, and every one dark enough to hold a white stroke — the palette in
   the reference image has pale circles that lose their glyph entirely. */
const BUBBLES = [
  // Eleven hues, one per subject, spread around the wheel rather than clustered.
  // The first palette had three greens and three reds in it, which read as one
  // green blur and one red blur however different the icons inside them were —
  // colour is what tells the bubbles apart at a glance, so it has to do that
  // job before it does any other.
  { icon: "school",      fill: "#2f7d5c", r: 18   },   // green
  { icon: "student",     fill: "#6b3fa0", r: 18.5 },   // purple
  { icon: "book",        fill: "#c05a12", r: 16   },   // orange
  { icon: "teacher",     fill: "#2a5fa8", r: 17.5 },   // blue
  { icon: "government",  fill: "#3f4a9c", r: 15.5 },   // indigo
  { icon: "bus",         fill: "#3a4a52", r: 17   },   // slate, so the bus can be the yellow
  { icon: "rank",        fill: "#a8326b", r: 17   },   // pink
  { icon: "certificate", fill: "#a2372f", r: 15.5 },   // red
  { icon: "coins",       fill: "#6f5210", r: 15.5 },   // brown
  { icon: "running",     fill: "#0f8a8a", r: 15   },   // cyan
  { icon: "pen",         fill: "#5f7d1f", r: 14   },   // olive
];

/**
 * Packing by relaxation rather than by eye.
 *
 * Hand-chosen angles produced nineteen overlaps on the first run — which is the
 * point of checking, but not something to fix by nudging numbers until it
 * looks right. Instead every bubble starts on a ring and is then pushed out of
 * its neighbours and pulled back inside the glass, repeatedly, until nothing
 * overlaps. The same seed gives the same layout every time, so the logo is
 * reproducible; it is not random art.
 */
const PAD = 1.4;              // space kept between neighbours
const EDGE = 2.5;             // space kept inside the glass

// Deterministic PRNG: a fixed seed means this file regenerates identically.
let seed = 20260904;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

// Big ones first — the hard pieces need the free space, and small ones fill in.
const order = BUBBLES.map((b) => ({ ...b, r: b.r * BUBBLE_SCALE }))
  .sort((a, b) => b.r - a.r);
const placed = order.map((b, i) => {
  const a = (i / order.length) * Math.PI * 2 + rnd() * 0.6;
  const d = (R_GLASS - b.r - EDGE) * (0.28 + 0.55 * rnd());
  return { ...b, x: CX + Math.cos(a) * d, y: CY + Math.sin(a) * d };
});

for (let pass = 0; pass < 4000; pass++) {
  let worst = 0;

  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const a = placed[i], b = placed[j];
      let dx = b.x - a.x, dy = b.y - a.y;
      let dist = Math.hypot(dx, dy);
      if (dist < 1e-6) { dx = rnd() - 0.5; dy = rnd() - 0.5; dist = 1e-6; }
      const need = a.r + b.r + PAD;
      if (dist >= need) continue;
      const push = (need - dist) / 2;
      worst = Math.max(worst, need - dist);
      const ux = dx / dist, uy = dy / dist;
      a.x -= ux * push; a.y -= uy * push;
      b.x += ux * push; b.y += uy * push;
    }
  }

  // Then pull anything that was pushed out of the glass back inside it.
  for (const b of placed) {
    const dx = b.x - CX, dy = b.y - CY;
    const dist = Math.hypot(dx, dy);
    const max = R_GLASS - b.r - EDGE;
    if (dist > max) {
      const k = max / (dist || 1);
      b.x = CX + dx * k;
      b.y = CY + dy * k;
      worst = Math.max(worst, dist - max);
    }
  }

  if (worst < 0.01) { console.log(`packing settled after ${pass + 1} passes`); break; }
}

/* --- the checks that make the solver trustworthy --- */
const problems = [];
for (const b of placed) {
  const fromCentre = Math.hypot(b.x - CX, b.y - CY);
  if (fromCentre + b.r > R_GLASS - 1) {
    problems.push(`${b.icon} escapes the glass by ${(fromCentre + b.r - R_GLASS + 1).toFixed(1)}px`);
  }
}
for (let i = 0; i < placed.length; i++) {
  for (let j = i + 1; j < placed.length; j++) {
    const a = placed[i], b = placed[j];
    const gap = Math.hypot(a.x - b.x, a.y - b.y) - a.r - b.r;
    if (gap < -0.5) problems.push(`${a.icon} overlaps ${b.icon} by ${(-gap).toFixed(1)}px`);
  }
}
if (problems.length) {
  console.error("packing failed:\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log(`packed ${placed.length} bubbles, all inside the glass and clear of each other`);

/* ---------- markup ---------- */
const bubble = (b, i) => {
  const s = (b.r * 2 * 0.68) / 24;          // icon box scaled to the bubble
  const ox = b.x - (24 * s) / 2;
  const oy = b.y - (24 * s) / 2;
  const ic = ICONS[b.icon];
  const parts = Array.isArray(ic) ? ic : [ic];
  const face = FACE[b.icon] ?? "#fff";
  const st = STROKES[b.icon] ?? [];
  const line = (l, colour, op) =>
    `
        <path d="${l.d}" fill="none" stroke="${colour}" stroke-width="${l.w}"` +
    ` stroke-linecap="round" stroke-linejoin="round"${op ? ` opacity="${op}"` : ""}/>`;
  const lines = st.map((l) => line(l, face)).join("");
  const dim = st.filter((l) => l.far).map((l) => line(l, b.fill, ".3")).join("");
  const soft = SHADE[b.icon]
    ? `
        <path d="${SHADE[b.icon]}" fill="${b.fill}" fill-rule="evenodd" opacity=".34"/>`
    : "";
  // Nonzero, deliberately: the bars cross the stem, and evenodd would punch
  // the crossings back out.
  const mark = MARK[b.icon]
    ? `
        <path d="${MARK[b.icon]}" fill="${MARK_COLOUR[b.icon] ?? b.fill}"/>`
    : "";
  return `    <g class="bub" style="--i:${i}">
      <circle cx="${b.x.toFixed(1)}" cy="${b.y.toFixed(1)}" r="${b.r}" fill="${b.fill}"/>
      <circle cx="${b.x.toFixed(1)}" cy="${(b.y - b.r * 0.28).toFixed(1)}" r="${(b.r * 0.72).toFixed(1)}" fill="#fff" opacity=".08"/>
      <g transform="translate(${ox.toFixed(1)} ${oy.toFixed(1)}) scale(${s.toFixed(3)})">
        ${parts.map((d) => `<path d="${d}" fill="${face}" fill-rule="evenodd"/>`).join("\n        ")}${lines}${soft}${mark}${dim}
      </g>
    </g>`;
};

/* ---------- the handle ---------- */
/**
 * Built outwards from the ring along the 45-degree axis rather than typed as
 * fixed coordinates, so it stays attached if the lens is ever resized again —
 * which it has been, three times.
 *
 * A magnifier handle is not a rod of one thickness. There is a collar where it
 * meets the glass, a metal ferrule, and then a grip that flares slightly
 * towards the butt so it cannot slide out of the hand. Drawing it as one
 * round-capped stroke threw all of that away, which is why it read as a stick.
 */
const UX = Math.SQRT1_2, UY = Math.SQRT1_2;   // along the handle
const PX = -UY, PY = UX;                      // across it
const f = (n) => n.toFixed(1);
const pt = (t, off) => [
  CX + UX * (R_OUTER + t) + PX * off,
  CY + UY * (R_OUTER + t) + PY * off,
];

/** A tapered band: width w0 at distance t0, w1 at t1, centred `off` across. */
const band = (t0, w0, t1, w1, off = 0) => {
  const a = pt(t0, off + w0 / 2);
  const b = pt(t1, off + w1 / 2);
  const cc = pt(t1, off - w1 / 2);
  const d = pt(t0, off - w0 / 2);
  return `M${f(a[0])} ${f(a[1])} L${f(b[0])} ${f(b[1])} L${f(cc[0])} ${f(cc[1])} L${f(d[0])} ${f(d[1])} Z`;
};
/** The butt. A circle rather than an arc, because an arc here needs the sweep
 *  flag to be right and a circle cannot be wrong. */
const butt = (t, w) => {
  const [x, y] = pt(t, 0);
  return `<circle cx="${f(x)}" cy="${f(y)}" r="${f(w / 2)}"`;
};

const inner = `  <defs>
    <clipPath id="lensClip"><circle cx="${CX}" cy="${CY}" r="${R_GLASS}"/></clipPath>

    <!-- Glass is lit from the upper left, so the gradient is offset there
         rather than centred. A centred radial reads as a button. -->
    <radialGradient id="glass" cx="34%" cy="28%" r="78%">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="0.55" stop-color="#eef7f1"/>
      <stop offset="1" stop-color="#cfe2d6"/>
    </radialGradient>

    <!-- The ring is one band of metal: light where it faces the light, dark
         where it turns away. Two stops would read as flat; four give it a
         roll. -->
    <linearGradient id="ringMetal" x1="0.15" y1="0" x2="0.85" y2="1">
      <stop offset="0" stop-color="#1a8d76"/>
      <stop offset="0.35" stop-color="#0c6455"/>
      <stop offset="0.7" stop-color="#08443a"/>
      <stop offset="1" stop-color="#0f7361"/>
    </linearGradient>

    <linearGradient id="handleWood" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#5a4048"/>
      <stop offset="0.45" stop-color="#3c2a33"/>
      <stop offset="1" stop-color="#241820"/>
    </linearGradient>

    <linearGradient id="ferrule" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#e6ecea"/>
      <stop offset="0.5" stop-color="#9fb4a6"/>
      <stop offset="1" stop-color="#6f8478"/>
    </linearGradient>

    <!-- A soft shadow under the glass, so the mark sits on the page instead of
         floating above it. -->
    <radialGradient id="drop" cx="50%" cy="50%" r="50%">
      <stop offset="0.6" stop-color="#0b3b31" stop-opacity=".22"/>
      <stop offset="1" stop-color="#0b3b31" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <ellipse cx="${CX + 4}" cy="${CY + R_OUTER - 2}" rx="${R_OUTER * 0.72}" ry="${R_OUTER * 0.13}" fill="url(#drop)"/>

  <!-- Handle, from the ring outwards. Drawn before the ring so the joint needs
       no seam painted over it. -->

  <!-- collar: the same metal as the ring, so the two read as one piece -->
  <path d="${band(-12, 18, 2, 23)}" fill="url(#ringMetal)"/>

  <!-- ferrule, with two turned bands and a highlight down its lit side -->
  <path d="${band(2, 23, 24, 20.5)}" fill="url(#ferrule)"/>
  <path d="${band(7, 23, 9.4, 22.4)}" fill="#3f5148" opacity=".38"/>
  <path d="${band(17, 21.6, 19.4, 21.2)}" fill="#3f5148" opacity=".38"/>
  <path d="${band(3, 4.6, 23, 4.2, -6.4)}" fill="#ffffff" opacity=".5"/>

  <!-- grip: flared towards the butt, so it widens as a real handle does -->
  ${butt(63, 23.5)} fill="url(#handleWood)"/>
  <path d="${band(22, 20.5, 63, 23.5)}" fill="url(#handleWood)"/>
  <!-- the lit edge and the turned-away edge, which is what gives it a round
       section instead of a flat plank -->
  <path d="${band(24, 5, 61, 5.4, -6.6)}" fill="#ffffff" opacity=".17"/>
  <path d="${band(24, 6, 62, 6.6, 7.2)}" fill="#000000" opacity=".22"/>
  <!-- grain, barely there: enough to be wood, not enough to be a pattern -->
  <path d="${band(28, 1.4, 58, 1.6, -1.8)}" fill="#000000" opacity=".09"/>
  <path d="${band(31, 1.2, 55, 1.3, 2.6)}" fill="#000000" opacity=".07"/>

  <circle cx="${CX}" cy="${CY}" r="${R_GLASS}" fill="url(#glass)"/>

  <g clip-path="url(#lensClip)">
${placed.map(bubble).join("\n")}
    <!-- The sweep across the glass sits over the bubbles, which is what makes
         them read as being behind it rather than printed on it. -->
    <path d="M${CX - R_GLASS} ${CY - 18} a ${R_GLASS} ${R_GLASS} 0 0 1 ${R_GLASS * 1.5} -${R_GLASS * 0.72} L ${CX - R_GLASS * 0.2} ${CY - R_GLASS} a ${R_GLASS} ${R_GLASS} 0 0 0 -${R_GLASS * 0.82} ${R_GLASS * 0.9} z"
          fill="#ffffff" opacity=".26"/>
  </g>

  <!-- Ring last, over every bubble edge. An inner dark line and an outer light
       one give the band a thickness the flat stroke did not have. -->
  <circle cx="${CX}" cy="${CY}" r="${R_OUTER - RING / 2}" fill="none"
          stroke="url(#ringMetal)" stroke-width="${RING}"/>
  <circle cx="${CX}" cy="${CY}" r="${R_GLASS + 0.6}" fill="none" stroke="#062b24" stroke-width="1.4" opacity=".5"/>
  <circle cx="${CX}" cy="${CY}" r="${R_OUTER - 0.7}" fill="none" stroke="#ffffff" stroke-width="1.2" opacity=".3"/>

  <!-- Specular highlights: the big one where the light is, the small one
       opposite, which is what a curved surface actually does. -->
  <path d="M${CX - 58} ${CY - 42} a 72 46 0 0 1 74 -34" stroke="#ffffff" stroke-width="9"
        stroke-linecap="round" fill="none" opacity=".65"/>
  <path d="M${CX + 40} ${CY + 46} a 40 26 0 0 1 -26 14" stroke="#ffffff" stroke-width="5"
        stroke-linecap="round" fill="none" opacity=".3"/>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 250 250" width="250" height="250" role="img" aria-label="Dubai Schools">
  <!--
    Generated by scripts/build-logo.mjs — edit that, not this.

    One lens over everything a school is judged by. The magnifier is the site's
    actual verb: this is a place you look things up, and each bubble is one of
    the things you can look up.
  -->
${inner.replace(/var\(--lens-ring, #0c6455\)/, "#0c6455")}
</svg>
`;

await writeFile(join(REPO, "public", "logo-lens.svg"), svg);
await mkdir(join(REPO, "src", "components"), { recursive: true });
await writeFile(join(REPO, "src", "components", "generated-lens.html"), inner + "\n");

console.log("wrote public/logo-lens.svg and src/components/generated-lens.html");
