import Container from "./ui/Container";
import { LinkButton } from "./ui/Button";
import { ArrowRightIcon } from "./icons";

/** Every figure here is counted from src/data/schools.json — nothing invented. */
export default function Hero({
  schoolCount,
  curriculumCount,
  areaCount,
}: {
  schoolCount: number;
  curriculumCount: number;
  areaCount: number;
}) {
  const stats = [
    { value: schoolCount, label: "schools listed" },
    { value: curriculumCount, label: "curricula" },
    { value: areaCount, label: "areas of Dubai" },
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

        <dl
          className="animate-fade-up mx-auto mt-14 flex max-w-lg items-center justify-center divide-x divide-ink-200"
          style={{ animationDelay: "240ms" }}
        >
          {stats.map((stat) => (
            <div key={stat.label} className="flex-1 px-4 sm:px-6">
              <dt className="sr-only">{stat.label}</dt>
              <dd>
                <span className="tabular block text-2xl font-semibold text-ink-900">
                  {stat.value}
                </span>
                <span className="mt-1 block text-[13px] text-ink-500">
                  {stat.label}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </Container>
    </section>
  );
}
