"use client";

import { usePathname } from "next/navigation";
import { MobileNav } from "@/components/layout/mobile-nav";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/seasons": "Seasons",
  "/farms": "Farms",
  "/workers": "Workers",
};

function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];

  for (const [path, title] of Object.entries(pageTitles)) {
    if (pathname.startsWith(path + "/")) return title;
  }

  return "AamDaata";
}

export function Header() {
  const pathname = usePathname();
  const title = getPageTitle(pathname);

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4 md:px-6">
      <MobileNav />
      <h1 className="text-lg font-semibold">{title}</h1>
    </header>
  );
}
