"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getCachedUser, fetchCurrentUser, UserSessionData } from "@/lib/client-auth";

export type LandingSection = "product" | "how-it-works" | "integration";

interface NavbarProps {
  /**
   * Landing page only: currently visible section (drives the active underline).
   */
  activeSection?: LandingSection;
  /**
   * Landing page only: scroll handler for in-page section links. The landing page scrolls
   * inside its own snap container, so section links call this instead of navigating.
   */
  onSectionClick?: (id: LandingSection) => void;
}

const NAV_LINKS: Array<{ label: string; href: string; section?: LandingSection }> = [
  { label: "Product", href: "/#product", section: "product" },
  { label: "How it works", href: "/#how-it-works", section: "how-it-works" },
  { label: "Integration", href: "/#integration", section: "integration" },
  { label: "Contact", href: "/contact" },
];

/**
 * Shared top navigation used identically on "/" and "/contact" so its height,
 * padding, font, and layout never shift between pages.
 */
export default function Navbar({ activeSection, onSectionClick }: NavbarProps) {
  const pathname = usePathname();
  const isHome = pathname === "/";

  // Starts null on server + first client render (hydration-safe); filled in after mount
  const [currentUser, setCurrentUser] = useState<UserSessionData | null>(null);

  useEffect(() => {
    setCurrentUser(getCachedUser());
    fetchCurrentUser().then((user) => setCurrentUser(user));

    const onAuthChange = () => setCurrentUser(getCachedUser());
    window.addEventListener("matcha_auth_change", onAuthChange);
    return () => window.removeEventListener("matcha_auth_change", onAuthChange);
  }, []);

  const isLinkActive = (link: (typeof NAV_LINKS)[number]) => {
    if (link.section) return isHome && activeSection === link.section;
    return pathname === link.href || pathname.startsWith(`${link.href}/`);
  };

  const handleSectionClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    section?: LandingSection
  ) => {
    if (section && isHome && onSectionClick) {
      e.preventDefault();
      onSectionClick(section);
    }
  };

  return (
    <div className="fixed top-4 sm:top-6 left-0 right-0 z-40 px-4 sm:px-6 md:px-10 flex justify-center pointer-events-none">
      <header className="w-full max-w-6xl h-14 bg-[#FAFCFA]/90 backdrop-blur-md rounded-2xl border border-sage-200/80 px-5 sm:px-6 flex items-center justify-between shadow-[0_4px_20px_rgba(0,0,0,0.03)] pointer-events-auto">
        {/* Left: Logo + brand */}
        <Link
          href="/"
          onClick={(e) => handleSectionClick(e, "product")}
          className="flex items-center space-x-2.5 group shrink-0"
          aria-label="NongGuide AI home"
        >
          <div className="w-7 h-6 bg-[#6E9177] rounded flex items-center justify-center text-white text-xs shadow-sm transition-transform group-hover:scale-105">
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
            </svg>
          </div>
          <span className="font-mono font-bold text-sm tracking-tight text-charcoal">
            NongGuide AI
          </span>
        </Link>

        {/* Center: Navigation links */}
        <nav className="hidden md:flex items-center self-stretch space-x-8 font-mono text-xs tracking-wider">
          {NAV_LINKS.map((link) => {
            const active = isLinkActive(link);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={(e) => handleSectionClick(e, link.section)}
                aria-current={active ? "page" : undefined}
                className={`h-full inline-flex items-center border-b-2 transition-colors ${
                  active
                    ? "border-[#334539] text-[#334539] font-bold"
                    : "border-transparent text-charcoal/75 hover:text-[#334539]"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Right: single consistent pill action */}
        <Link
          href={currentUser ? "/dashboard" : "/register"}
          className="shrink-0 rounded-full border border-[#334539] px-5 py-1.5 text-sm font-medium text-[#334539] hover:bg-[#334539] hover:text-white transition"
        >
          {currentUser ? "Dashboard" : "Sign up"}
        </Link>
      </header>
    </div>
  );
}

