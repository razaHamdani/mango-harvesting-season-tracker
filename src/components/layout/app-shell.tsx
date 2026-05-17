import { AppShellClient } from "@/components/layout/app-shell-client";
import { SidebarSeasonCard } from "@/components/layout/sidebar-season-card";
import { getCurrentProfile } from "@/lib/queries/profile-queries";
import type { SidebarUser } from "@/components/layout/sidebar";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();

  const user: SidebarUser | null = profile
    ? {
        name: profile.full_name || "Account",
        role:
          profile.role === "landlord"
            ? "Landlord"
            : profile.role === "contractor"
              ? "Contractor"
              : profile.role === "admin"
                ? "Admin"
                : "Member",
      }
    : null;

  return (
    <AppShellClient seasonCard={<SidebarSeasonCard />} user={user}>
      {children}
    </AppShellClient>
  );
}
