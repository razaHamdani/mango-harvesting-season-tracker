"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Sprout,
  Home,
  Users,
  LogOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type NavItem = {
  label: string;
  href: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", Icon: LayoutDashboard },
  { label: "Seasons", href: "/seasons", Icon: Sprout },
  { label: "Farms", href: "/farms", Icon: Home },
  { label: "Workers", href: "/workers", Icon: Users },
];

export type SidebarUser = {
  name: string;
  role: string;
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Sidebar({
  seasonCard,
  user,
}: {
  seasonCard?: React.ReactNode;
  user?: SidebarUser | null;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const displayName = user?.name?.trim() || "Account";
  const displayRole = user?.role || "Landlord";
  const initials = getInitials(displayName);

  return (
    <aside
      className="hidden h-screen w-60 flex-col border-r md:flex"
      style={{
        background: "var(--bark)",
        color: "oklch(0.92 0.02 80)",
        borderRightColor: "oklch(1 0 0 / 6%)",
      }}
    >
      {/* Brand */}
      <div
        className="flex items-center gap-[10px]"
        style={{ padding: "22px 20px 18px" }}
      >
        <div
          className="rounded-lg"
          style={{
            width: 28,
            height: 28,
            background:
              "linear-gradient(135deg, var(--mango) 0%, var(--mango-deep) 100%)",
            display: "grid",
            placeItems: "center",
            boxShadow: "inset 0 0 0 1px oklch(1 0 0 / 15%)",
          }}
          aria-hidden="true"
        />
        <div>
          <div
            style={{
              fontWeight: 600,
              fontSize: 16,
              letterSpacing: "-0.02em",
              color: "var(--cream)",
            }}
          >
            AamDaata
          </div>
          <div
            style={{
              fontSize: "10.5px",
              color: "oklch(0.72 0.04 80)",
              marginTop: -2,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            Orchard ledger
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1" style={{ padding: "6px 10px" }}>
        <div
          style={{
            fontSize: "10.5px",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "oklch(0.62 0.02 70)",
            padding: "14px 10px 6px",
          }}
        >
          Workspace
        </div>
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.Icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center transition-colors"
              style={{
                gap: 11,
                padding: "9px 10px",
                borderRadius: 8,
                fontSize: "13.5px",
                color: isActive ? "var(--cream)" : "oklch(0.78 0.02 70)",
                background: isActive ? "oklch(1 0 0 / 6%)" : "transparent",
                boxShadow: isActive
                  ? "inset 2px 0 0 var(--mango)"
                  : "none",
              }}
            >
              <span
                style={{
                  color: isActive ? "var(--mango)" : "oklch(0.72 0.06 75)",
                  display: "inline-flex",
                }}
              >
                <Icon size={16} />
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Season card slot */}
      {seasonCard}

      {/* Footer */}
      <div
        className="flex items-center"
        style={{
          padding: "12px 14px 16px",
          borderTop: "1px solid oklch(1 0 0 / 6%)",
          gap: 10,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 999,
            background:
              "linear-gradient(135deg, var(--mango) 0%, var(--rust) 100%)",
            display: "grid",
            placeItems: "center",
            color: "var(--bark)",
            fontWeight: 600,
            fontSize: 12,
            flexShrink: 0,
          }}
          aria-hidden="true"
        >
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              color: "var(--cream)",
              fontWeight: 500,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {displayName}
          </div>
          <div style={{ fontSize: "11.5px", color: "oklch(0.72 0.02 70)" }}>
            {displayRole}
          </div>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          aria-label="Sign out"
          className="inline-flex items-center justify-center rounded-md transition-colors"
          style={{
            width: 28,
            height: 28,
            color: "oklch(0.65 0.02 70)",
            background: "transparent",
          }}
        >
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  );
}
