"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Sidebar, type SidebarUser } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

const PUBLIC_ROUTES = ["/login"];

export function AppShellClient({
  children,
  seasonCard,
  user,
}: {
  children: React.ReactNode;
  seasonCard: React.ReactNode;
  user: SidebarUser | null;
}) {
  const pathname = usePathname();
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

  if (isPublicRoute) {
    return <>{children}</>;
  }

  return (
    <div
      className="md:grid md:grid-cols-[240px_1fr]"
      style={{ height: "100vh" }}
    >
      <div data-print="hide">
        <Sidebar seasonCard={seasonCard} user={user} />
      </div>
      <div className="flex flex-col overflow-hidden" style={{ height: "100vh" }}>
        <div data-print="hide">
          <Header />
        </div>
        <div
          className="flex-1 overflow-y-auto"
          style={{ padding: "32px 32px 64px", scrollBehavior: "smooth" }}
        >
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>{children}</div>
        </div>
      </div>
    </div>
  );
}
