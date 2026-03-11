import { useState, useEffect } from "react";
import { Loader2, Smartphone } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useSyncStatus } from "@/hooks/useSyncStatus";
import { syncAppleHealth } from "@/services/appleHealth";
import { Button } from "@/components/ui/button";

function useApplePlatform() {
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    try {
      const ua = navigator.userAgent || "";
      const isAppleDevice = /iPhone|iPad|iPod/.test(ua);
      const hasCapacitor = typeof window !== "undefined" && !!(window as any).Capacitor;
      setIsIos(isAppleDevice || hasCapacitor);
    } catch {
      setIsIos(false);
    }
  }, []);

  return { isIos };
}

export function SyncStatusCard() {
  const { user } = useAuth();
  const { data: syncStatus } = useSyncStatus();
  const { isIos } = useApplePlatform();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Non authentifié");
      return syncAppleHealth(user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["health_metrics"] });
      queryClient.invalidateQueries({ queryKey: ["latest_metrics"] });
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      queryClient.invalidateQueries({ queryKey: ["weekly_summary"] });
      queryClient.invalidateQueries({ queryKey: ["body_metrics"] });
      queryClient.invalidateQueries({ queryKey: ["body_metrics_latest"] });
      queryClient.invalidateQueries({ queryKey: ["sync_status"] });
    },
  });

  const isSyncing = mutation.isPending;

  const lastSyncLabel = syncStatus?.lastSync
    ? syncStatus.label
    : "Aucune synchronisation Apple Health pour l'instant";

  const connectionLabel = isIos ? "Apple Health disponible" : "Apple Health non disponible sur cet appareil";

  return (
    <div className="glass-card p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border border-glass-border/60 bg-background/70">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center shadow-[0_0_20px_rgba(34,197,94,0.3)]">
          <Smartphone className="h-5 w-5 text-primary" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Sync Apple Health</p>
          <p className="text-xs text-muted-foreground">{lastSyncLabel}</p>
          <p className="text-xs text-muted-foreground">{connectionLabel}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {mutation.isSuccess && !isSyncing && (
          <span className="text-xs text-primary/80">
            Synchronisation terminée ({mutation.data?.importedSamples ?? 0} échantillons)
          </span>
        )}
        {mutation.isError && !isSyncing && (
          <span className="text-xs text-destructive/80">
            {(mutation.error as Error).message || "Erreur de synchronisation"}
          </span>
        )}
        <Button
          size="sm"
          className="relative overflow-hidden bg-primary/90 hover:bg-primary text-primary-foreground shadow-[0_12px_30px_rgba(34,197,94,0.45)]"
          onClick={() => mutation.mutate()}
          disabled={isSyncing || !user}
        >
          <span className="flex items-center gap-2">
            <Loader2
              className={`h-4 w-4 ${isSyncing ? "animate-spin" : "opacity-40 group-hover:opacity-100 transition-opacity"}`}
            />
            {isSyncing ? "Sync en cours..." : "Sync Now"}
          </span>
        </Button>
      </div>
    </div>
  );
}

