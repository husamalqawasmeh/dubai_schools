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
const BUBBLE_SCALE = 0.9153;  // 1.13, less a tenth twice over

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
  // Flag, roof, then the things a school building actually has: a gabled
  // porch over the door, a clock in the gable, sills under the windows and a
  // step at the foot. A box with three holes in it is any building at all.
  school:
    "M11.4 1h1.1v3.1h-1.1z M12.5 1.3l3.1 1-3.1 1z" +
    "M12 3.7 22.5 8.5v1.6H1.5V8.5z" +
    "M3.4 11.2h17.2V21.6H3.4z" +
    "M12 12.1 16.1 15h-8.2z M10.2 15h3.6v6.6h-3.6z" +
    "M11.45 12.85a1.05 1.05 0 1 0 0 2.1 1.05 1.05 0 0 0 0-2.1z" +
    "M5.3 13.4h3v3h-3z M5 16.6h3.6v.8H5z" +
    "M15.7 13.4h3v3h-3z M15.4 16.6h3.6v.8h-3.6z" +
    "M2.6 21.6h18.8v1.3H2.6z",
  // A portico: pediment, then capitals and bases on the columns, then two
  // steps. Four bare rectangles under a wedge read as a fence — the flare at
  // each end of a column is what says it is holding something up.
  government:
    "M12 1.6 22.8 7v1.5H1.2V7z M12 3.4 18.6 6.7H5.4z" +
    "M2.6 8.9h18.8v1.1H2.6z" +
    "M3.6 10.2h2.5v7.6H3.6z M8.4 10.2h2.5v7.6H8.4z M13.1 10.2h2.5v7.6h-2.5z M17.9 10.2h2.5v7.6h-2.5z" +
    "M3.1 17.9h3.5v1.1H3.1z M7.9 17.9h3.5v1.1H7.9z M12.6 17.9h3.5v1.1h-3.5z M17.4 17.9h3.5v1.1h-3.5z" +
    "M2.2 19.2h19.6v1.4H2.2z M1.2 20.8h21.6v1.6H1.2z",
  // A pencil has five parts and reads as one the moment they are all there:
  // eraser, ferrule, body, the wood cone, and the graphite. Three slabs read
  // as a wedge.
  pen: [
    "M18.1 1.3a2.1 2.1 0 0 1 3 0l1.6 1.6a2.1 2.1 0 0 1 0 3l-1.3 1.3-4.6-4.6z",
    "M16.3 3.1l4.6 4.6-1.7 1.7-4.6-4.6z",
    "M14.3 5.1l4.6 4.6-9.9 9.9-4.6-4.6z",
    "M4.2 15.2l4.6 4.6-6 1.4z",
    "M2.4 21.4l.4-2 1.6.4z",
  ],
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
  // The bus Dubai actually runs: a Coaster-type minibus, not an American
  // Type C. They are different vehicles and the difference is the whole
  // silhouette — no bonnet to speak of, a windscreen raked steeply from the
  // roof down to the bumper, and a long band of tall windows above a low
  // waist, where a Type C has a long nose and a short window line.
  //
  // Drawn from the photograph rather than traced from it. A photograph cannot
  // go in here: this file generates the favicon and the 28px header mark from
  // the same shapes, and a raster would be unreadable at both.
  //
  // Everything below is the paint. The parts that are not painted are in MARK.
  // Within one array entry the subpaths are evenodd, so the glass cuts itself
  // out of the body; between entries they simply overlap.
  bus: [
    // Body. The closing edge runs from the bottom of the front up to the roof,
    // which is the rake — it is the one line that says which bus this is.
    "M3.4 5.0H21.2a1.6 1.6 0 0 1 1.6 1.6V16.2H1.2V9.8z" +
      // windscreen, deep and slanted, then the door, then five side windows
      "M2.0 9.9 3.9 5.9H5.4v5.0H2.0z" +
      "M5.9 6.3h1.1v8.3H5.9z" +
      "M7.5 6.3h2.7v4.6H7.5z M10.6 6.3h2.7v4.6h-2.7z M13.7 6.3h2.7v4.6h-2.7z" +
      "M16.8 6.3h2.7v4.6h-2.7z M19.9 6.3h2.4v4.6h-2.4z" +
      // Wheel arches. These cross the bottom edge on purpose: evenodd cuts
      // the overlap, so each leaves an arch rather than a circle, and the
      // tyre below sits in it instead of against a flat sill.
      "M6.4 13.7a3.1 3.1 0 1 0 0 6.2 3.1 3.1 0 0 0 0-6.2z" +
      "M18.4 13.7a3.1 3.1 0 1 0 0 6.2 3.1 3.1 0 0 0 0-6.2z",
    // Mirror on its stalk, out ahead of the windscreen.
    "M0.2 7.2h1.0v3.4H0.2z M0.0 6.9h1.6v1.0H0.0z",
  ],
  // Only the head is a fill; the body is in STROKES below. A football failed
  // here because a ball is recognisable by the pattern over its whole surface,
  // and that pattern is the first thing to disappear at bubble size. A runner
  // is recognisable by its pose, which survives being small.
  running: "M15.8 2.1a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z",
  // A ruled sheet inside a printed border, a seal over its lower corner and
  // two ribbon tails below. The border is what makes it a certificate rather
  // than a page of writing, and the second tail is what makes the ribbon
  // hang rather than point.
  certificate:
    "M2.4 2h19.2v13H2.4z M3.8 3.4h16.4v10.2H3.8z" +
    "M6 5.6h12v1.5H6z M6 8.4h8.6v1.3H6z M6 10.9h6.2v1.3H6z" +
    "M17 14.4a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z" +
    "M13.4 19.9 12.1 24l2.7-1.2 1.5 1.2.5-3.3z" +
    "M20.6 19.9 21.9 24l-2.7-1.2-1.5 1.2-.5-3.3z",
  // Nothing: the bubble itself is the white disc and the ring is drawn at
  // bubble scale. The D is in MARK, because its bars cross its own stem and
  // evenodd would punch those crossings back out.
  coins: [],
  // A podium, not three loose blocks: they stand on a floor, the tallest is
  // in the middle, and each has a lip along its top — the edge you see on a
  // real one, and the thing that stops three rectangles reading as a bar
  // chart.
  rank:
    "M12 1.2l1.5 3.1 3.4.5-2.5 2.4.6 3.4-3-1.6-3 1.6.6-3.4-2.5-2.4 3.4-.5z" +
    "M9.2 11.2h5.6v10.2H9.2z M9.2 11.2h5.6v1H9.2z" +
    "M2.6 14.2h5.6v7.2H2.6z M2.6 14.2h5.6v.9H2.6z" +
    "M15.8 16.2h5.6v5.2h-5.6z M15.8 16.2h5.6v.9h-5.6z" +
    "M1.4 21.4h21.2v1.4H1.4z",
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
  // Third attempt, and the reference finally settled it. The bars do not stop
  // at the stem — they cross the entire glyph, through the stem, through the
  // counter and out past the bowl on the right. I had them protruding only to
  // the left, which is why it read as a D with two ticks rather than as one
  // mark.
  //
  // The counter still shows above, between and below them, which is what keeps
  // the D legible while the bars run right through it.
  coins:
    // Redrawn against the clearer reference. Three things were off: the D
    // was too light, the bars sat too far apart, and their left ends were
    // square. The bars belong close together in the middle third — spread
    // to the top and bottom of the bowl they read as a strikethrough — and
    // their left ends are cut on a slant, the bottom edge reaching further
    // left than the top.
    "M6.6 4h3.6v16H6.6z" +
    "M9.6 4c5.6 0 9 3.2 9 8s-3.4 8-9 8v-3.4c3.4 0 5.4-2 5.4-4.6s-2-4.6-5.4-4.6z" +
    "M4.6 9.7H20.4v1.9H3.2z" +
    "M4.6 12.7H20.4v1.9H3.2z",

  // The parts of the bus that are not painted, drawn in the bubble's own slate
  // over the top of the yellow: the two tyres, the black waistline under the
  // windows, the front bumper, and the STOP sign on the flank. MARK fills
  // nonzero, so these overlap each other and the body freely instead of
  // cancelling out the way an evenodd subpath would.
  //
  // The sign is an octagon, not a disc. It is the one thing on the side of a
  // Dubai school bus that no other yellow vehicle carries, and eight sides
  // still read as eight at this size where lettering would not.
  bus:
    "M6.4 14.4a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z" +
    "M18.4 14.4a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z" +
    "M1.2 11.5H22.8v0.8H1.2z" +
    "M1.0 14.5h2.8v1.7H1.0z" +
    "M12.6 13.6 11.8 14.4 10.6 14.4 9.8 13.6 9.8 12.4 10.6 11.6 11.8 11.6 12.6 12.4z" +
    // The filler flap, and the headlight in the nose below the windscreen.
    "M14.6 12.9h1.1v1.4h-1.1z" +
    "M1.4 12.9h1.6v1.2H1.4z",
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
  // Two planes, redrawn with the body: the roof turning away above the glass,
  // and the skirt below the waistline. The old shading followed a shape that
  // is not there any more.
  bus:         "M3.4 5.0H21.2a1.6 1.6 0 0 1 1.6 1.6v.3H2.6z" +
               "M1.2 12.6h21.6v3.6H1.2z",

  student:     "M12 1.4 22.9 5.8 12 10.2 1.1 5.8z M12 11.2a3.5 3.5 0 0 0-3.5 3.5h7A3.5 3.5 0 0 0 12 11.2z" +
               "M12 17.9 10.2 20.6h3.6z",
  government:  "M12 1.8 22.6 7v1.6H1.4V7z M2.2 19.6h19.6v.9H2.2z",
  teacher:     "M8.2 2.2h14.4v1.5H8.2z M4.9 5.2a2.9 2.9 0 0 0-2.9 2.9h5.8a2.9 2.9 0 0 0-2.9-2.9z" +
               "M1.1 15.6c.4-2.4 1.9-4 3.8-4s3.4 1.6 3.8 4z" +
               "M2.2 22.4h2.1v1.4H2.2z M5.5 22.4h2.1v1.4H5.5z",
  certificate: "M3 2.4h18v1.5H3z M17.2 16.2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6z",
  rank:        "M2.4 14.4H8v1.3H2.4z M16 16.4h5.6v1.3H16z",
  pen:         "M16.3 3.1l4.6 4.6-.6.6-4.6-4.6z M19.4 6.2l.6.6-1.7 1.7-.6-.6z" +
               "M14.3 5.1l1.4 1.4-9.9 9.9-1.4-1.4z" +
               "M4.2 15.2l4.6 4.6-2.4.6-2.8-2.8z",
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
};

/** Where the struck symbol is not the bubble's own colour. */
const MARK_COLOUR = {
  coins: "url(#dhGrad)",
};

/**
 * Bubbles that carry a ring inside their edge.
 *
 * Drawn at bubble scale rather than inside the 24-unit icon box, because it is
 * the disc's own edge — the box is only 68% of the diameter, so a ring drawn
 * there would float well inside the bubble instead of sitting on it.
 */
/**
 * Icons that do not take the common size.
 *
 * The shared factor is set by the busiest drawings, and a long vehicle seen
 * side-on is the odd one out: it fills its box across and leaves it empty top
 * and bottom, so at the size that suits a square subject it reads smaller than
 * everything around it. Multiplies the common factor rather than replacing it,
 * so a change to that still reaches these.
 */
const ICON_SCALE = {
  bus: 1.15,
};

const DISC_RING = {
  coins: "url(#dhGrad)",
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
  { icon: "rank",        fill: "#5f7d1f", r: 17   },   // olive
  { icon: "certificate", fill: "#262626", r: 15.5 },   // near-black
  { icon: "coins",       fill: "#ffffff", r: 15.5 },   // white disc, gradient ring
  { icon: "running",     fill: "#0f8a8a", r: 15   },   // cyan
  { icon: "pen",         fill: "#c0468a", r: 14   },   // pink
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
  // 0.5508 = 0.68 less a tenth, twice over. The icons carry more detail than they did, and
  // detail reads as clutter at the size the old factor gave them — a tenth
  // off buys back the white ring between the drawing and the bubble edge.
  const s = (b.r * 2 * 0.5508 * (ICON_SCALE[b.icon] ?? 1)) / 24;  // icon box scaled to the bubble
  const ox = b.x - (24 * s) / 2;
  const oy = b.y - (24 * s) / 2;
  const ic = ICONS[b.icon];
  const parts = Array.isArray(ic) ? ic : [ic];
  const face = FACE[b.icon] ?? "#fff";
  const rw = b.r * 0.13;
  const ring = DISC_RING[b.icon]
    ? `
      <circle cx="${b.x.toFixed(1)}" cy="${b.y.toFixed(1)}" r="${(b.r - rw / 2).toFixed(1)}"` +
      ` fill="none" stroke="${DISC_RING[b.icon]}" stroke-width="${rw.toFixed(1)}"/>`
    : "";
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
  return `    <g class="bub" data-icon="${b.icon}" style="--i:${i}">
      <circle cx="${b.x.toFixed(1)}" cy="${b.y.toFixed(1)}" r="${b.r}" fill="${b.fill}"/>
      <circle cx="${b.x.toFixed(1)}" cy="${b.y.toFixed(1)}" r="${b.r}" fill="url(#bubBounce)"/>
      <circle cx="${b.x.toFixed(1)}" cy="${b.y.toFixed(1)}" r="${b.r}" fill="url(#bubBall)"/>${ring}
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

const render = (list) => `  <defs>
    <clipPath id="lensClip"><circle cx="${CX}" cy="${CY}" r="${R_GLASS}"/></clipPath>

    <!-- Glass is lit from the upper left, so the gradient is offset there
         rather than centred. A centred radial reads as a button. -->
    <radialGradient id="glass" cx="34%" cy="28%" r="78%">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="0.55" stop-color="#eef7f1"/>
      <stop offset="1" stop-color="#cfe2d6"/>
    </radialGradient>

    <!-- What turns a disc into a sphere. One gradient does both halves of it:
         white where the light lands at the upper left, black where the surface
         rolls away at the lower right. Object-bounding-box units, so the same
         def fits all eleven whatever their size or colour — the bubbles are
         eleven different hues and a coloured gradient would need eleven defs.

         The dark stops start at 82% of the radius. The icon reaches 61%, so it
         stays in the lit part and does not get muddied by its own bubble. -->
    <radialGradient id="bubBall" cx="33%" cy="29%" r="80%">
      <!-- The highlight is a stop in the falloff, not a shape laid over it.
           Drawn as its own ellipse it sat on the surface instead of being
           part of it, and at bubble size it smeared across the icon. As the
           first two stops it does the same job and cannot detach. -->
      <stop offset="0" stop-color="#ffffff" stop-opacity=".52"/>
      <stop offset="0.16" stop-color="#ffffff" stop-opacity=".34"/>
      <stop offset="0.40" stop-color="#ffffff" stop-opacity=".08"/>
      <!-- The terminator: the darkest band sits inside the edge, not on it,
           which is what a sphere does and a disc with a dark outline does
           not. -->
      <stop offset="0.86" stop-color="#000000" stop-opacity=".16"/>
      <stop offset="0.97" stop-color="#000000" stop-opacity=".30"/>
      <stop offset="1" stop-color="#000000" stop-opacity=".20"/>
    </radialGradient>

    <!-- Light bouncing back up off the glass below. A real sphere is never
         fully dark on its shaded side, and this is the stop that says so.
         With the specular highlight gone this and the shading gradient are
         the whole of the modelling, which is the point: the roundness comes
         from the falloff, not from a shape drawn on top of it. -->
    <radialGradient id="bubBounce" cx="70%" cy="84%" r="38%">
      <stop offset="0" stop-color="#ffffff" stop-opacity=".26"/>
      <stop offset="0.6" stop-color="#ffffff" stop-opacity=".10"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
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

    <!-- The dirham mark's own colours: red through black to green, on the
         diagonal, as the official logo has them. Per-element bounding box
         rather than one gradient across the whole bubble, so the ring and the
         D each carry the full sweep instead of each taking a slice of it. -->
    <linearGradient id="dhGrad" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="#e2001a"/>
      <stop offset="0.5" stop-color="#111111"/>
      <stop offset="1" stop-color="#00843d"/>
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

  <!-- Dubai under the glass.

       Drawn, not a map tile. A screenshot of a map service is its owner's
       copyright and cannot go on a public site; a raster could be neither
       clipped to this circle nor read at favicon size. Our own coordinates
       were the other way to do it, but every lat/lng in the schools table is
       still null.

       What makes it Dubai rather than any coastline is four things, and they
       are the four that are drawn most carefully: the Palm with its trunk,
       sixteen fronds and the crescent broken where the channel runs; the
       World scattered offshore; the Creek cutting inland from the north-east;
       and Jebel Ali's palm at the south-west edge. Take those away and the
       rest is a diagonal.

       Absolute coordinates, not offsets from CX/CY. This is a hand-placed
       drawing rather than a construction, and writing 150 - CX for every
       point would obscure the shape without making it move correctly if the
       lens ever changed size. -->
  <g clip-path="url(#lensClip)" opacity=".5">
    <circle cx="${CX}" cy="${CY}" r="${R_GLASS}" fill="#efe7d6"/>

    <!-- The Gulf, north-west of a coast running south-west to north-east. -->
    <path d="M13 11 H207 V16 C186 34 168 52 150 70 C132 88 116 104 100 119
             C82 136 60 156 40 176 C30 186 22 195 16 203 H13 z" fill="#9fd6e8"/>

    <!-- Dubai Creek, in from the coast and bending south. -->
    <path d="M152 66 C160 78 168 90 173 102 C177 111 178 120 175 129"
          fill="none" stroke="#9fd6e8" stroke-width="4.6" stroke-linecap="round"/>

    <!-- The World: an oval scatter, offshore of Jumeirah. -->
    <g fill="#efe7d6">
      <circle cx="104" cy="50" r="2.1"/><circle cx="112" cy="46" r="1.7"/>
      <circle cx="120" cy="49" r="2.3"/><circle cx="99" cy="57" r="1.8"/>
      <circle cx="108" cy="56" r="2.4"/><circle cx="117" cy="55" r="1.9"/>
      <circle cx="125" cy="57" r="2.0"/><circle cx="103" cy="64" r="2.2"/>
      <circle cx="112" cy="63" r="1.8"/><circle cx="121" cy="64" r="2.1"/>
      <circle cx="129" cy="50" r="1.6"/><circle cx="96" cy="49" r="1.6"/>
    </g>

    <!-- Palm Jumeirah: trunk out from the shore, a crown of sixteen fronds,
         and the crescent around it left open where the channel runs. -->
    <g stroke="#efe7d6" fill="none" stroke-linecap="round">
      <path d="M74 141 L64 127" stroke-width="3.4"/>
      <g stroke-width="1.5">
        <path d="M64 127 L52 121 M64 127 L54 115 M64 127 L57 109 M64 127 L62 103"
              />
        <path d="M64 127 L68 102 M64 127 L74 105 M64 127 L79 110 M64 127 L82 117"/>
        <path d="M64 127 L50 128 M64 127 L51 134 M64 127 L55 140 M64 127 L61 144"/>
        <path d="M64 127 L70 143 M64 127 L76 139 M64 127 L80 133 M64 127 L83 126"/>
      </g>
      <path d="M64 105 A23 23 0 1 1 46 138" stroke-width="2.6"/>
    </g>

    <!-- Palm Jebel Ali, smaller, down at the south-west edge. -->
    <g stroke="#efe7d6" fill="none" stroke-linecap="round">
      <path d="M34 178 L26 168" stroke-width="2.4"/>
      <g stroke-width="1.1">
        <path d="M26 168 L18 163 M26 168 L20 158 M26 168 L25 153 M26 168 L31 156"/>
        <path d="M26 168 L36 160 M26 168 L16 172 M26 168 L19 178 M26 168 L26 182"/>
      </g>
      <path d="M26 151 A17 17 0 1 1 12 176" stroke-width="1.9"/>
    </g>

    <!-- The roads the city is navigated by: Sheikh Zayed and Emirates Road
         running its length, with three crossing them inland. -->
    <g stroke="#c9a86a" fill="none" stroke-linecap="round">
      <path d="M22 203 C62 163 104 124 148 84 C168 66 186 50 202 38" stroke-width="2.8"/>
      <path d="M50 205 C88 168 128 130 168 94 C184 79 196 68 206 60" stroke-width="2.2"/>
      <path d="M92 205 C102 172 114 144 130 118" stroke-width="1.5"/>
      <path d="M148 203 C158 172 168 146 180 124" stroke-width="1.5"/>
      <path d="M40 190 C66 176 96 158 126 136" stroke-width="1.2"/>
    </g>
  </g>
  </g>

  <!-- Everything that belongs to the glass surface is painted before the
       bubbles now, so the icons sit on top of it rather than under it. The
       sweep and the two speculars used to come after, which is precisely what
       put them behind the glass. -->
  <g clip-path="url(#lensClip)">
    <path d="M${CX - R_GLASS} ${CY - 18} a ${R_GLASS} ${R_GLASS} 0 0 1 ${R_GLASS * 1.5} -${R_GLASS * 0.72} L ${CX - R_GLASS * 0.2} ${CY - R_GLASS} a ${R_GLASS} ${R_GLASS} 0 0 0 -${R_GLASS * 0.82} ${R_GLASS * 0.9} z"
          fill="#ffffff" opacity=".26"/>
  </g>
  <path d="M${CX - 58} ${CY - 42} a 72 46 0 0 1 74 -34" stroke="#ffffff" stroke-width="9"
        stroke-linecap="round" fill="none" opacity=".65"/>
  <path d="M${CX + 40} ${CY + 46} a 40 26 0 0 1 -26 14" stroke="#ffffff" stroke-width="5"
        stroke-linecap="round" fill="none" opacity=".3"/>

  <g clip-path="url(#lensClip)">
${list.map(bubble).join("\n")}
  </g>

  <!-- Ring last, over every bubble edge. An inner dark line and an outer light
       one give the band a thickness the flat stroke did not have. -->
  <circle cx="${CX}" cy="${CY}" r="${R_OUTER - RING / 2}" fill="none"
          stroke="url(#ringMetal)" stroke-width="${RING}"/>
  <circle cx="${CX}" cy="${CY}" r="${R_GLASS + 0.6}" fill="none" stroke="#062b24" stroke-width="1.4" opacity=".5"/>
  <circle cx="${CX}" cy="${CY}" r="${R_OUTER - 0.7}" fill="none" stroke="#ffffff" stroke-width="1.2" opacity=".3"/>`;

/**
 * A second arrangement, for the test page.
 *
 * Three subjects in the middle — student, school, teacher, the people and the
 * place — with the other eight evenly spaced on one ring around them. It is
 * symmetric by construction rather than by solver: the trio sits on a small
 * equilateral triangle and the eight sit at 45-degree intervals, so nothing
 * about it depends on where a relaxation happened to settle.
 *
 * The radii are derived from the bubbles themselves. The trio's circumradius
 * is the largest pair-sum over root three, which is the smallest triangle they
 * fit on without touching; the ring is far enough out to clear the trio and
 * close enough in to clear the glass, and the check below proves both.
 */
const byName = (n) => order.find((b) => b.icon === n);
/* The row across the middle, left to right. Student in the centre, because it
   is who the site is for; school and teacher either side of it; sport and
   rank on the outside. */
const MIDDLE_ROW = ["running", "teacher", "student", "school", "rank"];

/* The other six, three above and three below. They keep the row company
   rather than ringing it: a ring puts something directly above and below the
   centre, and this layout wants the middle line clear across. */
/* Above, the certificate stands over school — the same column the pencil
   stands in below it. Named offsets rather than even thirds, because a column
   alignment is not something even spacing can express. */
const ABOVE = ["book", "government", "certificate"];
/* Below, the pencil sits under school rather than out at the edge. Named
   offsets rather than even thirds, because it is now aligned to a column of
   the middle row and even spacing cannot express that. */
const BELOW = ["bus", "coins", "pen"];

/**
 * One radius for all eleven, and it is the smallest of them.
 *
 * Equal circles were already the rule here; taking the smallest as the size
 * is what changed. The palette has radii from 14 to 18.5 because some subjects
 * want more room than others, but on this layout a bubble that is larger than
 * its neighbour reads as more important than it, and none of them is.
 *
 * The icons scale off the radius, so equal circles mean equal icons too.
 */
const EQUAL_R = Math.min(...BUBBLES.map((b) => b.r)) * BUBBLE_SCALE;
const sized = (n) => ({ ...byName(n), r: EQUAL_R });

/* Spread across the widest line there is — the one through the centre. The
   outermost pair sit a bubble clear of the glass, and the rest divide what is
   left evenly, so the spacing is a consequence of the width rather than a
   number someone picked. */
const ROW_HALF = R_GLASS - EQUAL_R - 4;
const ROW_STEP = (2 * ROW_HALF) / (MIDDLE_ROW.length - 1);

/* Far enough out that the rows clear each other. Both outer rows now key off
   ROW_STEP rather than a width of their own — every bubble stands in one of
   the middle row's columns, so there is only one horizontal measure on this
   layout and the chord calculation that used to set a second one has gone. */
const ROW_DY = 40;

const centred = [
  ...MIDDLE_ROW.map(sized).map((b, i) => ({
    ...b,
    x: CX - ROW_HALF + i * ROW_STEP,
    y: CY,
  })),
  ...ABOVE.map(sized).map((b) => ({
    ...b,
    // The certificate stands over school, in the same column the pencil
    // stands under it. Government takes the centre it vacates rather than
    // staying out at the far side, where it would have been left three
    // pixels off the certificate.
    x: CX + { book: -ROW_STEP, government: 0, certificate: ROW_STEP }[b.icon],
    y: CY - ROW_DY,
  })),
  ...BELOW.map(sized).map((b) => ({
    ...b,
    // bus keeps the far side, the dirham the centre, the pencil the column
    // school stands in one row up.
    x: CX + { bus: -ROW_STEP, coins: 0, pen: ROW_STEP }[b.icon],
    y: CY + ROW_DY,
  })),
];

const bad = [];
for (const b of centred) {
  if (Math.hypot(b.x - CX, b.y - CY) + b.r > R_GLASS - 1) bad.push(`${b.icon} escapes the glass`);
}
for (let i = 0; i < centred.length; i++) {
  for (let j = i + 1; j < centred.length; j++) {
    const a = centred[i], b = centred[j];
    const gap = Math.hypot(a.x - b.x, a.y - b.y) - a.r - b.r;
    if (gap < -0.5) bad.push(`${a.icon} overlaps ${b.icon} by ${(-gap).toFixed(1)}px`);
  }
}
if (bad.length) {
  console.error("centred layout failed:\n  " + bad.join("\n  "));
  process.exit(1);
}
console.log(
  `centred layout: r=${EQUAL_R.toFixed(2)}, row of ${MIDDLE_ROW.length} across the middle ` +
    `at step ${ROW_STEP.toFixed(1)}, ${ABOVE.length} above and ${BELOW.length} below at dy=${ROW_DY}`
);

const inner = render(placed);

/** One wrapper, two arrangements. The favicon being generated from the same
 *  source as the logo is the point: a hand-drawn tab icon drifts the moment
 *  the mark changes, and the last one still carried colours the palette had
 *  dropped two passes earlier. */
const wrap = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 250 250" width="250" height="250" role="img" aria-label="Dubai Schools">
  <!--
    Generated by scripts/build-logo.mjs — edit that, not this.

    One lens over everything a school is judged by. The magnifier is the site's
    actual verb: this is a place you look things up, and each bubble is one of
    the things you can look up.
  -->
${body.replace(/var\(--lens-ring, #0c6455\)/, "#0c6455")}
</svg>
`;

await writeFile(join(REPO, "public", "logo-lens.svg"), wrap(inner));
// The tab icon is the centred arrangement: at 16px a symmetric mark holds
// its shape where a packed one reads as a smudge, and it is the arrangement
// the site now uses everywhere else.
await writeFile(join(REPO, "public", "favicon.svg"), wrap(render(centred)));
await mkdir(join(REPO, "src", "components"), { recursive: true });
await writeFile(join(REPO, "src", "components", "generated-lens.html"), inner + "\n");
await writeFile(
  join(REPO, "src", "components", "generated-lens-centred.html"),
  render(centred) + "\n"
);

console.log("wrote logo-lens.svg, favicon.svg and both generated-lens files");
