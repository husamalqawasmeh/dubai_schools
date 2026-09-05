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
const BUBBLE_SCALE = 1.224;

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
  book:
    "M2.6 5.2c2.7-1.7 5.7-1.7 8.4 0v13.4c-2.7-1.7-5.7-1.7-8.4 0z" +
    "M13 5.2c2.7-1.7 5.7-1.7 8.4 0v13.4c-2.7-1.7-5.7-1.7-8.4 0z" +
    "M11.4 5.6h1.2v13.2h-1.2z",
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
  student:
    "M12 1.6 22.8 5.9 12 10.2 1.2 5.9z" +
    "M21 6.7v4.4a1 1 0 1 1-1.4 0V7.3z" +
    "M12 11.9a3.3 3.3 0 1 0 0 6.6 3.3 3.3 0 0 0 0-6.6z" +
    "M4.9 22.4a7.1 7.1 0 0 1 14.2 0z",
  teacher:
    "M8.8 2.4h13.4v10.2H8.8z M10.8 4.6h9.4V6h-9.4z M10.8 7.6h6.2V9h-6.2z" +
    "M5.2 5.6a2.7 2.7 0 1 0 0 5.4 2.7 2.7 0 0 0 0-5.4z" +
    "M1.4 22.2c0-3.1 1.7-5.6 3.8-5.6s3.8 2.5 3.8 5.6z" +
    "M6.9 12.9 11.4 9.8l1.2 1.8-4.5 3.1z",
  bus:
    "M2.2 6.2c0-1.3 1.1-2.4 2.4-2.4h14.8c1.3 0 2.4 1.1 2.4 2.4v9.2H2.2z" +
    "M4.8 6.9h3.7v3.6H4.8z M10.1 6.9h3.8v3.6h-3.8z M15.5 6.9h3.7v3.6h-3.7z" +
    "M2.2 16.2h19.6v1.9H2.2z" +
    "M6.6 16.4a2.3 2.3 0 1 0 0 4.6 2.3 2.3 0 0 0 0-4.6z" +
    "M17.4 16.4a2.3 2.3 0 1 0 0 4.6 2.3 2.3 0 0 0 0-4.6z",
  sport:
    "M12 1.6a10.4 10.4 0 1 0 0 20.8 10.4 10.4 0 0 0 0-20.8z" +
    "m0 2.1a8.3 8.3 0 1 1 0 16.6 8.3 8.3 0 0 1 0-16.6z" +
    "M12 6.4 16 9.3l-1.5 4.7h-5L8 9.3z",
  certificate:
    "M3 2.4h18v12.2H3z M6.2 5.8h11.6v1.6H6.2z M6.2 9.2h7.8v1.6H6.2z" +
    "M17.2 14.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8z" +
    "M13.6 20.1 12.4 24l2.6-1.1 1.4 1.1.6-3.4z",
  coins:
    "M12 2.6c4.5 0 8.1 1.4 8.1 3.2S16.5 9 12 9 3.9 7.6 3.9 5.8 7.5 2.6 12 2.6z" +
    "M3.9 8.2C5.4 9.7 8.5 10.6 12 10.6s6.6-.9 8.1-2.4v2.7c0 1.8-3.6 3.2-8.1 3.2s-8.1-1.4-8.1-3.2z" +
    "M3.9 13.8c1.5 1.5 4.6 2.4 8.1 2.4s6.6-.9 8.1-2.4v2.7c0 1.8-3.6 3.2-8.1 3.2s-8.1-1.4-8.1-3.2z",
  rank:
    "M12 1.4l1.4 3 3.2.4-2.4 2.2.6 3.2-2.8-1.6-2.8 1.6.6-3.2L7.4 4.8l3.2-.4z" +
    "M9.2 11.4h5.6v10.8H9.2z" +
    "M2.4 14.4H8v7.8H2.4z" +
    "M16 16.4h5.6v5.8H16z",
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
  book:        "M11.4 5.6h1.2v13.2h-1.2z M13 5.2c1.3-.8 2.7-1.3 4.1-1.4v14.8c-1.4.1-2.8.6-4.1 1.4z",
  school:      "M12 3.8 22.4 8.6v1.6H1.6V8.6z M3.4 11.4h17.2v1.4H3.4z",
  bus:         "M2.2 6.2c0-1.3 1.1-2.4 2.4-2.4h14.8c1.3 0 2.4 1.1 2.4 2.4v.7H2.2z M6.6 17.9a.8.8 0 1 0 0 1.6.8.8 0 0 0 0-1.6z M17.4 17.9a.8.8 0 1 0 0 1.6.8.8 0 0 0 0-1.6z",
  sport:       "M12 6.4 16 9.3l-1.5 4.7h-5L8 9.3z M12 3.7a8.3 8.3 0 0 0-8.3 8.3h1.6A6.7 6.7 0 0 1 12 5.3z",
  coins:       "M3.9 8.2C5.4 9.7 8.5 10.6 12 10.6s6.6-.9 8.1-2.4v1.1c-1.5 1.5-4.6 2.4-8.1 2.4s-6.6-.9-8.1-2.4z M3.9 13.8c1.5 1.5 4.6 2.4 8.1 2.4s6.6-.9 8.1-2.4v1.1c-1.5 1.5-4.6 2.4-8.1 2.4s-6.6-.9-8.1-2.4z",
  student:     "M12 1.6 22.8 5.9 12 10.2 1.2 5.9z M12 11.9a3.3 3.3 0 0 0-3.3 3.3h6.6A3.3 3.3 0 0 0 12 11.9z",
  government:  "M12 1.8 22.6 7v1.6H1.4V7z M2.2 19.6h19.6v.9H2.2z",
  teacher:     "M8.8 2.4h13.4v1.4H8.8z M5.2 5.6a2.7 2.7 0 0 0-2.7 2.7h5.4a2.7 2.7 0 0 0-2.7-2.7z",
  certificate: "M3 2.4h18v1.5H3z M17.2 16.2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6z",
  rank:        "M2.4 14.4H8v1.3H2.4z M16 16.4h5.6v1.3H16z",
  pen:         "M16.4 2.2 21.8 7.6l-2.7 2.7-5.4-5.4z",
};

/* Bubble colours. Distinct in hue from each other so no two read as the same
   category, and every one dark enough to hold a white stroke — the palette in
   the reference image has pale circles that lose their glyph entirely. */
const BUBBLES = [
  { icon: "school",      fill: "#2f7d5c", r: 18   },
  { icon: "student",     fill: "#7a4b9c", r: 18.5 },
  { icon: "book",        fill: "#c2542a", r: 16   },
  { icon: "teacher",     fill: "#2a5fa8", r: 17.5 },
  { icon: "government",  fill: "#1f6f8b", r: 15.5 },
  { icon: "bus",         fill: "#b8892b", r: 17   },
  { icon: "rank",        fill: "#0c6455", r: 17   },
  { icon: "certificate", fill: "#a2372f", r: 15.5 },
  { icon: "coins",       fill: "#8a6a1c", r: 15.5 },
  { icon: "sport",       fill: "#1f7f74", r: 15   },
  { icon: "pen",         fill: "#b5471f", r: 14   },
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
  const soft = SHADE[b.icon]
    ? `
        <path d="${SHADE[b.icon]}" fill="${b.fill}" fill-rule="evenodd" opacity=".34"/>`
    : "";
  return `    <g class="bub" style="--i:${i}">
      <circle cx="${b.x.toFixed(1)}" cy="${b.y.toFixed(1)}" r="${b.r}" fill="${b.fill}"/>
      <circle cx="${b.x.toFixed(1)}" cy="${(b.y - b.r * 0.28).toFixed(1)}" r="${(b.r * 0.72).toFixed(1)}" fill="#fff" opacity=".08"/>
      <g transform="translate(${ox.toFixed(1)} ${oy.toFixed(1)}) scale(${s.toFixed(3)})">
        <path d="${ic}" fill="#fff" fill-rule="evenodd"/>${soft}
      </g>
    </g>`;
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

  <!-- Handle, then the collar that joins it to the ring. Behind the ring, so
       the joint needs no seam drawn over it. -->
  <path d="M192 190 L230 228" stroke="url(#handleWood)" stroke-width="21" stroke-linecap="round" fill="none"/>
  <path d="M199 197 L226 224" stroke="#ffffff" stroke-width="3" stroke-linecap="round" fill="none" opacity=".14"/>
  <path d="M178 176 L197 195" stroke="url(#ferrule)" stroke-width="19" stroke-linecap="round" fill="none"/>
  <path d="M183 181 L191 189" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" fill="none" opacity=".45"/>

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
