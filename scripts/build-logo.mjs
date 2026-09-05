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
const CX = 96;          // lens centre
const CY = 94;
const R_OUTER = 92;     // outer edge of the ring
const RING = 10;        // ring thickness
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
const BUBBLE_SCALE = 1.02;

/* ---------- the icons ---------- */
/* Each is drawn in a 24x24 box, white stroke, no fill — a stroke reads at a
   smaller size than a filled glyph, and keeps every icon the same visual
   weight regardless of how much ink its subject wants. */
const ICONS = {
  school:    "M12 3.5 21 9.5V21H3V9.5z M9.5 21v-6.5h5V21",
  book:      "M12 7.5c-2.4-2-5.4-2-7.8 0v11c2.4-2 5.4-2 7.8 0 2.4-2 5.4-2 7.8 0v-11c-2.4-2-5.4-2-7.8 0z M12 7.5v11",
  pen:       "M4.5 19.5 5.6 15 16 4.6l3.4 3.4L9 18.4z M13.6 7 17 10.4",
  student:   "M4 7.5 12 4l8 3.5-8 3.5z M12 11v3.2 M6.5 18.5a5.5 5.5 0 0 1 11 0",
  government:"M12 3.5 21 8.5H3z M4.5 8.5v9 M9 8.5v9 M15 8.5v9 M19.5 8.5v9 M2.5 20.5h19",
  bus:       "M4 6.5h16v9H4z M4 15.5h16 M7.5 9.5h4v3.5h-4z M13.5 9.5h4v3.5h-4z M7 19a1.6 1.6 0 1 1 0-3.2 1.6 1.6 0 0 1 0 3.2z M17 19a1.6 1.6 0 1 1 0-3.2 1.6 1.6 0 0 1 0 3.2z",
  books:     "M3.5 16.5h17v3.5h-17z M4.5 12.5h16v3.5h-16z M3.5 8.5h17V12h-17z",
  sport:     "M8 4h8v5.5a4 4 0 0 1-8 0z M8 5.5H5.2A3 3 0 0 0 8 9.2 M16 5.5h2.8A3 3 0 0 1 16 9.2 M12 13.5v4 M9 20h6",
  ranking:   "M4 20v-6.5h4V20z M10 20V5h4v15z M16 20v-4.5h4V20z",
  certificate:"M5 4h14v11H5z M8 8h8 M8 11.5h5 M9.5 15v5.5l2.5-1.8 2.5 1.8V15",
  badge:     "M12 3.5 20 6.5v5.4c0 4.6-3.7 7.3-8 8.6-4.3-1.3-8-4-8-8.6V6.5z M8.8 12l2.3 2.3 4.1-4.4",
  coins:     "M5 7a7 3 0 1 0 14 0A7 3 0 0 0 5 7z M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7 M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5",
  chat:      "M4 5.5h16v10h-9.5L4.5 20v-4.5H4z",
};

/* Bubble colours. Distinct in hue from each other so no two read as the same
   category, and every one dark enough to hold a white stroke — the palette in
   the reference image has pale circles that lose their glyph entirely. */
const BUBBLES = [
  { icon: "school",      fill: "#2f7d5c", r: 17.5, a: 198, d: 40 },
  { icon: "book",        fill: "#c2542a", r: 15.5, a: 250, d: 42 },
  { icon: "student",     fill: "#7a4b9c", r: 18.5, a: 300, d: 36 },
  { icon: "government",  fill: "#1f6f8b", r: 15,   a: 348, d: 44 },
  { icon: "bus",         fill: "#b8892b", r: 17,   a: 40,  d: 41 },
  { icon: "books",       fill: "#3a7d3a", r: 14.5, a: 88,  d: 45 },
  { icon: "ranking",     fill: "#0c6455", r: 18,   a: 132, d: 37 },
  { icon: "certificate", fill: "#a2372f", r: 15,   a: 172, d: 45 },
  { icon: "badge",       fill: "#2a5fa8", r: 16,   a: 222, d: 12 },
  { icon: "coins",       fill: "#8a6a1c", r: 15.5, a: 330, d: 14 },
  { icon: "chat",        fill: "#6b3f7d", r: 14,   a: 96,  d: 12 },
  { icon: "sport",       fill: "#1f7f74", r: 14.5, a: 12,  d: 13 },
  { icon: "pen",         fill: "#b5471f", r: 13.5, a: 262, d: 13 },
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
  const s = (b.r * 2 * 0.62) / 24;          // icon box scaled to the bubble
  const ox = b.x - (24 * s) / 2;
  const oy = b.y - (24 * s) / 2;
  return `    <g class="bub" style="--i:${i}">
      <circle cx="${b.x.toFixed(1)}" cy="${b.y.toFixed(1)}" r="${b.r}" fill="${b.fill}"/>
      <g transform="translate(${ox.toFixed(1)} ${oy.toFixed(1)}) scale(${s.toFixed(3)})"
         fill="none" stroke="#fff" stroke-width="${(1.9 / s).toFixed(2)}"
         stroke-linecap="round" stroke-linejoin="round">
        <path d="${ICONS[b.icon]}"/>
      </g>
    </g>`;
};

const inner = `  <defs>
    <clipPath id="lensClip"><circle cx="${CX}" cy="${CY}" r="${R_GLASS}"/></clipPath>
    <linearGradient id="glass" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f2f9f4"/>
      <stop offset="1" stop-color="#dbeade"/>
    </linearGradient>
  </defs>

  <!-- the handle, behind the ring so the joint needs no seam -->
  <path d="M168 166 L200 198" stroke="#3c2a33" stroke-width="19" stroke-linecap="round" fill="none"/>
  <path d="M155 153 L172 170" stroke="#9fb4a6" stroke-width="17" stroke-linecap="round" fill="none"/>

  <circle cx="${CX}" cy="${CY}" r="${R_GLASS}" fill="url(#glass)"/>

  <g clip-path="url(#lensClip)">
${placed.map(bubble).join("\n")}
  </g>

  <!-- the ring last, so it covers every bubble edge cleanly -->
  <circle cx="${CX}" cy="${CY}" r="${R_OUTER - RING / 2}" fill="none"
          stroke="var(--lens-ring, #0c6455)" stroke-width="${RING}"/>
  <!-- the glint: what makes it read as glass rather than a coloured disc -->
  <path d="M44 66a60 39 0 0 1 60-31" stroke="#ffffff" stroke-width="7"
        stroke-linecap="round" fill="none" opacity=".55"/>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 220" width="220" height="220" role="img" aria-label="Dubai Schools">
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
