"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { dashboardRegisterUrl } from "@/lib/urls";

export const SECTION_LINKS = [
  { href: "#product", label: "What It Is" },
  { href: "#validation", label: "Validation" },
  { href: "#market", label: "Market" },
  { href: "#gtm", label: "Go-to-market" },
  { href: "#competition", label: "Competition" },
] as const;

export function PresentationNav() {
  const [active, setActive] = useState("");
  const navLinksRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ids = SECTION_LINKS.map((l) => l.href.slice(1));

    const onScroll = () => {
      let current = "";
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 160) {
          current = id;
        }
      }
      setActive(current);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Scroll active pill into view on mobile
  useEffect(() => {
    if (!active || !navLinksRef.current) return;
    const pill = navLinksRef.current.querySelector<HTMLElement>(`a[href="#${active}"]`);
    pill?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [active]);

  return (
    <header className="sticky top-3 z-40">
      <div className="rounded-[1.6rem] border border-[#d7ccbb]/90 bg-[rgba(250,245,236,0.92)] px-4 py-3 shadow-card backdrop-blur md:px-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex shrink-0 items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-end leading-none"
              aria-label="RESOLVEkit"
              style={{ fontFamily: '"Mona Sans", "Avenir Next", sans-serif' }}
            >
              <span className="text-[20px] font-normal uppercase tracking-[0.2em] text-[#0d2f57]">RESOLVE</span>
              <span className="ml-[0.12em] text-[10px] font-normal tracking-[0.2em] text-black">kit</span>
            </Link>
            <span className="hidden h-4 w-px bg-[#c9baa5] sm:block" />
            <p className="hidden text-[11px] uppercase tracking-[0.24em] text-[#7b7165] sm:block">Category brief</p>
          </div>

          <div ref={navLinksRef} className="flex min-w-0 items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-2">
            {SECTION_LINKS.map((link) => {
              const isActive = active === link.href.slice(1);
              return (
                <a
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold tracking-[0.08em] transition sm:text-xs sm:tracking-[0.14em]",
                    isActive
                      ? "border-[#171412] bg-[#171412] text-white"
                      : "border-[#d5c7b4] bg-white/70 text-[#3d3630] hover:border-[#111] hover:text-[#111]",
                  )}
                >
                  {link.label}
                </a>
              );
            })}
            <a href={dashboardRegisterUrl} className="shrink-0">
              <Button className="bg-[#121212] text-white hover:bg-[#24211d] hover:text-white">Start Free</Button>
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
