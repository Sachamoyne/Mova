import { SidebarTrigger } from "@/components/ui/sidebar";
import { useSyncStatus } from "@/hooks/useSyncStatus";

export function AppHeader() {
  const { data: syncStatus } = useSyncStatus();

  return (
    <>
      <header
        className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/90 backdrop-blur-md px-4 pb-2"
        style={{ paddingTop: "var(--sat, 20px)" }}
      >
        <div className="flex items-center gap-2">
          <SidebarTrigger />
        </div>
        <div className="flex items-center gap-3">
          {syncStatus && (
            <div className="flex items-center gap-1.5">
              <div
                className={`h-2 w-2 rounded-full ${
                  syncStatus.isRecent
                    ? "bg-primary animate-pulse-glow"
                    : syncStatus.isStale
                    ? "bg-destructive"
                    : "bg-running"
                }`}
              />
              <span className="text-xs text-muted-foreground hidden sm:inline">
                {syncStatus.label}
              </span>
            </div>
          )}
        </div>
      </header>
    </>
  );
}
