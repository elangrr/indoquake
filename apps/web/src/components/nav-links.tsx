"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/site";

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** inline: desktop header row (640 px and up). bar: fixed bottom bar on phones. */
export function NavLinks({ variant }: { variant: "inline" | "bar" }) {
  const pathname = usePathname() ?? "/";
  if (variant === "inline") {
    return (
      <nav aria-label="Navigasi utama" className="hidden sm:block">
        <ul className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-11 items-center border-b-2 px-3 text-sm transition-colors duration-150 ${
                    active
                      ? "border-signal font-medium text-foreground"
                      : "border-transparent text-muted hover:text-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }
  return (
    <nav
      aria-label="Navigasi utama"
      className="no-print fixed inset-x-0 bottom-0 z-[900] border-t border-border bg-surface sm:hidden"
    >
      <ul className="grid grid-cols-5">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-14 items-center justify-center border-t-2 text-xs transition-colors duration-150 ${
                  active ? "border-signal font-semibold text-foreground" : "border-transparent text-muted"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
