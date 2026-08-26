import type { Metadata } from "next";
import JournalBoard from "@/components/JournalBoard";
import Container from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "Parent Journal",
  description:
    "A shared board where parents and residents post reviews, questions, and quotation requests about Dubai schools.",
};

export default function JournalPage() {
  return (
    <>
      <div className="border-b border-ink-200 bg-white">
        <Container className="py-10 sm:py-12">
          <h1 className="text-2xl font-semibold tracking-[-0.025em] text-ink-900 sm:text-4xl">
            Parent Journal
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-600">
            A shared board where parents and residents post reviews, questions,
            and quotation requests about Dubai schools. Search what has already
            been asked before you add a new post.
          </p>
        </Container>
      </div>

      <Container className="py-10 sm:py-12">
        <JournalBoard />
      </Container>
    </>
  );
}
