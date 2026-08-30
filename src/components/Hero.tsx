import Container from "./ui/Container";
import { LinkButton } from "./ui/Button";
import { ArrowRightIcon } from "./icons";

export interface HeroStats {
  total: number;
  withFeeRange: number;
  withRating: number;
  withWebsite: number;
  areas: number;
  curricula: number;
  unrated: number;
}

/** Every figure here is counted from src/data/schools.json — nothing invented. */
export default function Hero({ stats }: { stats: HeroStats }) {
  // Three of these are a share of the total, so they carry a "/ 232" denominator —
  // "206" on its own says nothing about coverage.
  const tiles: { value: number; of?: number; label: string }[] = [
    { value: stats.total, label: "Schools listed" },
    { value: stats.withFeeRange, of: stats.total, label: "With a fee range" },
    { value: stats.withRating, of: stats.total, label: "With a KHDA rating" },
    { value: stats.withWebsite, of: stats.total, label: "With a website" },
    { value: stats.areas, label: "Areas of Dubai" },
    { value: stats.curricula, label: "Curricula" },
  ];

  return (
    <section className="relative isolate overflow-hidden border-b border-ink-200 bg-white">
      <div aria-hidden className="bg-grid absolute inset-0 -z-10" />
      <div
        aria-hidden
        className="absolute inset-x-0 -top-40 -z-10 h-80 bg-[radial-gradient(ellipse_50%_100%_at_50%_100%,var(--color-brand-100),transparent_70%)] opacity-70"
      />

      <Container className="py-16 text-center sm:py-20 lg:py-24">
        <p
          className="animate-fade-up inline-flex items-center gap-2 rounded-sm border border-ink-200 bg-white/80 px-3 py-1 text-xs font-medium text-ink-600 shadow-xs"
          style={{ animationDelay: "40ms" }}
        >
          <span aria-hidden className="size-1.5 rounded-full bg-brand-600" />
          KHDA-regulated private schools
        </p>

        <h1
          className="animate-fade-up mx-auto mt-6 max-w-3xl text-[2rem] font-semibold leading-[1.1] tracking-[-0.03em] text-ink-900 sm:text-5xl lg:text-[3.5rem]"
          style={{ animationDelay: "90ms" }}
        >
          Choosing a school in Dubai,
          <span className="block text-ink-400">without the guesswork.</span>
        </h1>

        <p
          className="animate-fade-up mx-auto mt-6 max-w-xl text-base leading-relaxed text-ink-600 sm:text-lg"
          style={{ animationDelay: "140ms" }}
        >
          Compare curriculum, annual fees, and KHDA inspection ratings side by
          side — then read what other parents have to say before you book a
          tour.
        </p>

        <div
          className="animate-fade-up mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
          style={{ animationDelay: "190ms" }}
        >
          <LinkButton href="#schools" size="lg" className="w-full sm:w-auto">
            Browse schools
            <span className="size-4">
              <ArrowRightIcon />
            </span>
          </LinkButton>
          <LinkButton
            href="/journal"
            variant="secondary"
            size="lg"
            className="w-full sm:w-auto"
          >
            Read the Parent Journal
          </LinkButton>
        </div>

        {/* Stat tiles. Values use the font's proportional figures — tabular-nums
            is for columns that align vertically, and makes display numbers
            look loose. */}
        <dl
          className="animate-fade-up mt-14 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
          style={{ animationDelay: "240ms" }}
        >
          {tiles.map((tile) => (
            <div
              key={tile.label}
              className="flex flex-col-reverse rounded-lg border border-ink-200 bg-white/70 p-4 text-left shadow-xs"
            >
              <dt className="mt-1 text-xs leading-snug text-ink-500">
                {tile.label}
              </dt>
              <dd className="text-[26px] font-semibold leading-none tracking-[-0.02em] text-ink-900">
                {tile.value}
                {tile.of !== undefined && (
                  <span className="text-sm font-medium text-ink-400">
                    {" / "}
                    {tile.of}
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>

        {stats.unrated > 0 && (
          <p
            className="animate-fade-up mt-4 text-xs text-ink-500"
            style={{ animationDelay: "280ms" }}
          >
            {stats.unrated} unrated — usually newly opened schools that have not
            yet had a first KHDA inspection.
          </p>
        )}
      </Container>
    </section>
  );
}
