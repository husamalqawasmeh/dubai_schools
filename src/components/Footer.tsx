import Link from "next/link";
import Container from "./ui/Container";
import { LogoMark } from "./icons";

const columns = [
  {
    title: "Explore",
    links: [
      { href: "/", label: "All schools" },
      { href: "/journal", label: "Parent Journal" },
    ],
  },
  {
    title: "Official sources",
    links: [
      { href: "https://www.khda.gov.ae", label: "KHDA", external: true },
      {
        href: "https://www.khda.gov.ae/en/inspection",
        label: "School inspections",
        external: true,
      },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="mt-24 border-t border-ink-200 bg-white">
      <Container className="py-12">
        <div className="flex flex-col gap-10 md:flex-row md:justify-between">
          <div className="max-w-sm">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-md bg-brand-700 p-1.5 text-white">
                <LogoMark />
              </span>
              <span className="text-[15px] font-semibold tracking-[-0.01em] text-ink-900">
                Dubai Schools
                <span className="text-ink-400"> Explorer</span>
              </span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-ink-500">
              A directory of KHDA-regulated private schools in Dubai, with a
              community board where parents compare notes before they decide.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:gap-16">
            {columns.map((col) => (
              <div key={col.title}>
                <h2 className="text-[13px] font-semibold text-ink-900">
                  {col.title}
                </h2>
                <ul className="mt-3 space-y-2.5">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      {"external" in link && link.external ? (
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-xs text-sm text-ink-500 transition-colors hover:text-ink-900"
                        >
                          {link.label}
                        </a>
                      ) : (
                        <Link
                          href={link.href}
                          className="rounded-xs text-sm text-ink-500 transition-colors hover:text-ink-900"
                        >
                          {link.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 border-t border-ink-200 pt-6">
          <p className="text-xs leading-relaxed text-ink-500">
            Demonstration project. School details are indicative and compiled
            from public sources — confirm fees, ratings, and admissions directly
            with the school or at{" "}
            <a
              href="https://www.khda.gov.ae"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xs font-medium text-ink-700 underline decoration-ink-300 underline-offset-2 transition-colors hover:text-brand-700 hover:decoration-brand-400"
            >
              khda.gov.ae
            </a>
            . Reviews and journal posts are stored in your browser only.
          </p>
        </div>
      </Container>
    </footer>
  );
}
