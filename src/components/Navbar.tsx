"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Container from "./ui/Container";
import Button from "./ui/Button";
import { ChatIcon, CloseIcon, LogoMark, MenuIcon } from "./icons";
import { openChat } from "@/lib/chat-events";
import { cn } from "@/lib/cn";

const links = [
  { href: "/", label: "Schools" },
  { href: "/journal", label: "Parent Journal" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" || pathname.startsWith("/schools") : pathname === href;

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b bg-white/85 backdrop-blur-md",
        "transition-[border-color,box-shadow] duration-200",
        scrolled ? "border-ink-200 shadow-xs" : "border-transparent"
      )}
    >
      <Container>
        <div className="flex h-16 items-center justify-between gap-4">
          <Link
            href="/"
            className="group flex items-center gap-2.5 rounded-sm"
            aria-label="Dubai Schools Explorer — home"
          >
            <span className="flex size-8 items-center justify-center rounded-md bg-brand-700 p-1.5 text-white shadow-xs transition-transform duration-200 group-hover:scale-105">
              <LogoMark />
            </span>
            <span className="text-[15px] font-semibold tracking-[-0.01em] text-ink-900">
              Dubai Schools
              <span className="text-ink-400"> Explorer</span>
            </span>
          </Link>

          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive(link.href) ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150",
                  isActive(link.href)
                    ? "text-ink-900"
                    : "text-ink-500 hover:bg-ink-100 hover:text-ink-900"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <Button variant="secondary" size="sm" onClick={openChat}>
              <span className="size-4">
                <ChatIcon />
              </span>
              Ask the assistant
            </Button>
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className="-mr-1.5 flex size-9 items-center justify-center rounded-md p-2 text-ink-700 transition-colors hover:bg-ink-100 md:hidden"
          >
            {menuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </Container>

      {menuOpen && (
        <div
          id="mobile-nav"
          className="animate-fade-in border-t border-ink-200 bg-white md:hidden"
        >
          <Container className="flex flex-col gap-1 py-3">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                aria-current={isActive(link.href) ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-2.5 text-[15px] font-medium transition-colors",
                  isActive(link.href)
                    ? "bg-ink-100 text-ink-900"
                    : "text-ink-600 hover:bg-ink-50"
                )}
              >
                {link.label}
              </Link>
            ))}
            <Button
              variant="secondary"
              size="md"
              className="mt-2 w-full"
              onClick={() => {
                setMenuOpen(false);
                openChat();
              }}
            >
              <span className="size-4">
                <ChatIcon />
              </span>
              Ask the assistant
            </Button>
          </Container>
        </div>
      )}
    </header>
  );
}
