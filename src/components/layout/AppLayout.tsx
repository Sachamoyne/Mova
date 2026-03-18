import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { AppleHealthOnboarding } from "@/components/health/AppleHealthOnboarding";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider className="flex h-screen w-full overflow-hidden">
      <AppSidebar />
      <div className="flex-1 flex flex-col overflow-hidden" style={{ paddingBottom: "var(--sab, 0px)" }}>
        <AppHeader />
        <main className="flex-1 overflow-y-auto p-6 bg-background">{children}</main>
      </div>
      <AppleHealthOnboarding />
    </SidebarProvider>
  );
}
