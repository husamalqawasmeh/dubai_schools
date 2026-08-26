import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import schoolsData from "@/data/schools.json";
import { School } from "@/types";
import ReviewsSection from "@/components/ReviewsSection";
import Container from "@/components/ui/Container";
import Card from "@/components/ui/Card";
import Badge, { khdaTone } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import {
  ArrowLeftIcon,
  ExternalLinkIcon,
  MapPinIcon,
} from "@/components/icons";
import { formatFeeRange } from "@/lib/format";

const schools = schoolsData as School[];

// The dataset is a fixed JSON file, so every valid slug is known at build
// time; anything else is a 404 rather than an on-demand render.
export const dynamicParams = false;

export function generateStaticParams() {
  return schools.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const school = schools.find((s) => s.slug === slug);
  if (!school) return { title: "School not found" };
  return {
    title: school.name,
    description: school.description,
  };
}

export default async function SchoolDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const school = schools.find((s) => s.slug === slug);
  if (!school) notFound();

  const mapQuery = `${school.name}, ${school.address}, Dubai`;
  const mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(
    mapQuery
  )}&output=embed`;

  const facts = [
    {
      label: school.curricula.length > 1 ? "Curricula" : "Curriculum",
      value: school.curricula.join(", "),
    },
    { label: "Grades", value: school.gradeRange || "Not published" },
    { label: "KHDA rating", value: school.khdaRating },
  ];

  return (
    <>
      <div className="border-b border-ink-200 bg-white">
        <Container className="py-8 sm:py-10">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-sm text-[13px] font-medium text-ink-500 transition-colors hover:text-ink-900"
          >
            <span className="size-3.5">
              <ArrowLeftIcon />
            </span>
            All schools
          </Link>

          <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <h1 className="text-2xl font-semibold leading-tight tracking-[-0.025em] text-ink-900 sm:text-4xl">
                {school.name}
              </h1>
              <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-4 text-ink-400">
                    <MapPinIcon />
                  </span>
                  {school.area}
                </span>
                <span aria-hidden className="text-ink-300">
                  ·
                </span>
                <span>{school.curricula.join(" / ")}</span>
                {school.gradeRange && (
                  <>
                    <span aria-hidden className="text-ink-300">
                      ·
                    </span>
                    <span>{school.gradeRange}</span>
                  </>
                )}
              </p>
            </div>

            <Badge
              tone={khdaTone[school.khdaRating] ?? "neutral"}
              className="shrink-0 self-start px-3 py-1.5 text-[13px]"
            >
              KHDA: {school.khdaRating}
            </Badge>
          </div>

          <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-ink-700">
            {school.description}
          </p>
        </Container>
      </div>

      <Container className="py-10 sm:py-12">
        <div className="grid gap-8 lg:grid-cols-3 lg:gap-10">
          <aside className="lg:order-2 lg:sticky lg:top-24 lg:self-start">
            <Card className="p-5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-ink-400">
                Annual fees
              </p>
              <p className="tabular mt-1 text-2xl font-semibold tracking-[-0.02em] text-ink-900">
                {formatFeeRange(school.feeMinAED, school.feeMaxAED)}
              </p>
              <p className="mt-1.5 text-xs text-ink-500">{school.feeNote}</p>

              <dl className="mt-5 space-y-3 border-t border-ink-200 pt-5">
                {facts.map((fact) => (
                  <div
                    key={fact.label}
                    className="flex items-baseline justify-between gap-4"
                  >
                    <dt className="text-[13px] text-ink-500">{fact.label}</dt>
                    <dd className="text-right text-[13px] font-medium text-ink-900">
                      {fact.value}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="mt-5 flex flex-col gap-2.5 border-t border-ink-200 pt-5">
                {school.website && (
                  <a
                    href={school.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonClass("primary", "md", "w-full")}
                  >
                    Visit school website
                    <span className="size-4">
                      <ExternalLinkIcon />
                    </span>
                  </a>
                )}
                <Link
                  href="/journal"
                  className={buttonClass("secondary", "md", "w-full")}
                >
                  Request a quotation
                </Link>
              </div>

              <p className="mt-4 text-xs leading-relaxed text-ink-500">
                Indicative figures. Confirm current fees and availability with
                the school directly.
              </p>
            </Card>
          </aside>

          <div className="space-y-12 lg:order-1 lg:col-span-2">
            <section aria-labelledby="location-heading">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2
                    id="location-heading"
                    className="text-xl font-semibold tracking-[-0.02em] text-ink-900 sm:text-2xl"
                  >
                    Location
                  </h2>
                  <p className="mt-1.5 text-sm text-ink-500">
                    {school.address}
                  </p>
                </div>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    mapQuery
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-sm text-[13px] font-medium text-brand-700 transition-colors hover:text-brand-800"
                >
                  Open in Google Maps
                  <span className="size-3.5">
                    <ExternalLinkIcon />
                  </span>
                </a>
              </div>

              <div className="mt-4 overflow-hidden rounded-lg border border-ink-200 bg-ink-100 shadow-xs">
                <iframe
                  title={`Map of ${school.name}`}
                  src={mapSrc}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="block h-72 w-full sm:h-80"
                  style={{ border: 0 }}
                />
              </div>
            </section>

            <ReviewsSection schoolSlug={school.slug} />
          </div>
        </div>
      </Container>
    </>
  );
}
