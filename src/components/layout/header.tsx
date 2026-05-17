"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { MobileNav } from "@/components/layout/mobile-nav";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  seasons: "Seasons",
  farms: "Farms",
  workers: "Workers",
  new: "New",
};

function titleCase(segment: string): string {
  return segment
    .split("-")
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

function labelForSegment(segment: string, parent: string | null): string {
  if (UUID_RE.test(segment)) {
    if (parent === "seasons") return "Season detail";
    if (parent === "farms") return "Farm detail";
    if (parent === "workers") return "Worker detail";
    return "Detail";
  }
  return SEGMENT_LABELS[segment] ?? titleCase(segment);
}

type Crumb = { label: string; href: string };

function buildCrumbs(pathname: string): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: Crumb[] = [];
  let href = "";
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    href += "/" + seg;
    const parent = i > 0 ? segments[i - 1] : null;
    crumbs.push({ label: labelForSegment(seg, parent), href });
  }
  return crumbs;
}

export function Header() {
  const pathname = usePathname();
  const crumbs = buildCrumbs(pathname);

  return (
    <header
      className="flex shrink-0 items-center justify-between"
      style={{
        height: 56,
        borderBottom: "1px solid var(--border)",
        padding: "0 24px",
        background: "var(--bg)",
      }}
    >
      <nav
        aria-label="Breadcrumb"
        className="flex items-center"
        style={{ gap: 8, fontSize: 13, color: "var(--text-muted)" }}
      >
        {crumbs.map((c, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <React.Fragment key={c.href}>
              {i > 0 && (
                <ChevronRight
                  size={12}
                  style={{ color: "var(--text-faint)" }}
                  aria-hidden="true"
                />
              )}
              {isLast ? (
                <span
                  style={{ color: "var(--heading)", fontWeight: 500 }}
                  aria-current="page"
                >
                  {c.label}
                </span>
              ) : (
                <Link href={c.href}>{c.label}</Link>
              )}
            </React.Fragment>
          );
        })}
      </nav>

      <div className="flex items-center" style={{ gap: 10 }}>
        <MobileNav />
      </div>
    </header>
  );
}
