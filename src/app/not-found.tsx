import Container from "@/components/ui/Container";
import { LinkButton } from "@/components/ui/Button";
import { ArrowRightIcon } from "@/components/icons";

export default function NotFound() {
  return (
    <Container className="flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <p className="text-[13px] font-medium uppercase tracking-wide text-ink-400">
        404
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-[-0.025em] text-ink-900 sm:text-3xl">
        We could not find that page
      </h1>
      <p className="mt-3 max-w-md text-[15px] leading-relaxed text-ink-500">
        The school you are looking for may have been renamed or removed from the
        directory.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <LinkButton href="/" size="lg">
          Browse all schools
          <span className="size-4">
            <ArrowRightIcon />
          </span>
        </LinkButton>
        <LinkButton href="/journal" variant="secondary" size="lg">
          Parent Journal
        </LinkButton>
      </div>
    </Container>
  );
}
