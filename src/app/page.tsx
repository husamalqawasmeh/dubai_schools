import schoolsData from "@/data/schools.json";
import { School } from "@/types";
import Hero, { type HeroStats } from "@/components/Hero";
import SchoolExplorer from "@/components/SchoolExplorer";
import Container from "@/components/ui/Container";

const schools = schoolsData as School[];

/** Counted from the dataset at build time so the headline figures can never
 *  drift from what the directory actually contains. */
const stats: HeroStats = {
  total: schools.length,
  withFeeRange: schools.filter((s) => s.feeMinAED > 0 && s.feeMaxAED > 0).length,
  withRating: schools.filter((s) => s.khdaRating !== "Not rated").length,
  withWebsite: schools.filter((s) => s.website).length,
  areas: new Set(schools.map((s) => s.area)).size,
  curricula: new Set(schools.flatMap((s) => s.curricula)).size,
  unrated: schools.filter((s) => s.khdaRating === "Not rated").length,
};

export default function HomePage() {
  return (
    <>
      <Hero stats={stats} />

      <Container className="py-12 sm:py-16">
        <div
          id="schools"
          className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
        >
          <div>
            <h2 className="text-xl font-semibold tracking-[-0.02em] text-ink-900 sm:text-2xl">
              All schools
            </h2>
            <p className="mt-1.5 text-sm text-ink-500">
              Filter by curriculum, area, budget, and KHDA rating.
            </p>
          </div>
          <p className="max-w-sm text-xs leading-relaxed text-ink-500 sm:text-right">
            Fees and ratings are published by KHDA — confirm them with the
            school before deciding.
          </p>
        </div>

        <div className="mt-6">
          <SchoolExplorer schools={schools} />
        </div>
      </Container>
    </>
  );
}
