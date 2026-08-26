import schoolsData from "@/data/schools.json";
import { School } from "@/types";
import Hero from "@/components/Hero";
import SchoolExplorer from "@/components/SchoolExplorer";
import Container from "@/components/ui/Container";

const schools = schoolsData as School[];

export default function HomePage() {
  const curriculumCount = new Set(schools.flatMap((s) => s.curricula)).size;
  const areaCount = new Set(schools.map((s) => s.area)).size;

  return (
    <>
      <Hero
        schoolCount={schools.length}
        curriculumCount={curriculumCount}
        areaCount={areaCount}
      />

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
            Fees and ratings are indicative demo data — confirm them with the
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
