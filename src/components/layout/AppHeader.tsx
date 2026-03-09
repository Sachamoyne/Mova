import { RefreshCw, User } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { insertMockData, clearMockData } from "@/lib/mock-data";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function AppHeader() {
  const [syncing, setSyncing] = useState(false);
  const [mocking, setMocking] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const handleSync = async () => {
    setSyncing(true);
    await new Promise((r) => setTimeout(r, 2000));
    setSyncing(false);
    toast.success("Synchronisation Garmin terminée");
  };

  const handleMockData = async () => {
    if (!user) {
      toast.error("Connectez-vous d'abord");
      return;
    }
    setMocking(true);
    try {
      await clearMockData(user.id);
      await insertMockData(user.id);
      queryClient.invalidateQueries();
      toast.success("Données de test ajoutées !");
    } catch (e) {
      toast.error("Erreur lors de l'ajout des données");
    }
    setMocking(false);
  };

  return (
    <header className="h-14 flex items-center justify-between border-b border-border px-4">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
      </div>
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={handleMockData}
          disabled={mocking}
          className="text-xs"
        >
          {mocking ? "Chargement..." : "📊 Add Mock Data"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={syncing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Synchro..." : "Sync Garmin"}
        </Button>
        <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center">
          <User className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    </header>
  );
}
