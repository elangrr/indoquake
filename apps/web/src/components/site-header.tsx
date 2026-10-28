import Link from "next/link";
import { DataStatus } from "./data-status";
import { DataBanner } from "./data-banner";
import { NavLinks } from "./nav-links";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader() {
  return (
    <>
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-14 max-w-screen-2xl items-center gap-4 px-4">
          <Link
            href="/"
            className="flex min-h-11 items-center gap-2 text-base font-semibold tracking-tight text-foreground"
          >
            <svg aria-hidden="true" width="28" height="16" viewBox="0 0 28 16" className="text-signal">
              <polyline
                points="0,8 7,8 9,3 11,13 13,1 15,15 17,6 19,9 21,8 28,8"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </svg>
            Indoquake
          </Link>
          <NavLinks variant="inline" />
          <div className="ml-auto flex items-center gap-2">
            <DataStatus />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <DataBanner />
      <NavLinks variant="bar" />
    </>
  );
}
