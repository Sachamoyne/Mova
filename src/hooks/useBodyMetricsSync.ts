import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface BodyMetricsSyncStatus {
  lastSyncDate: string | null;
  label: string;
}

export function useBodyMetricsSyncStatus() {
  const { user } = useAuth();

  return useQuery<BodyMetricsSyncStatus>({
    queryKey: ["body_metrics_sync_status", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // Get the most recent apple_health body metric
      const { data } = await supabase
        .from("body_metrics")
        .select("date, created_at")
        .eq("source", "apple_health")
        .order("date", { ascending: false })
        .limit(1);

      if (!data || data.length === 0) {
        return { lastSyncDate: null, label: "Jamais synchronisé" };
      }

      const lastDate = new Date(data[0].date);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

      return {
        lastSyncDate: data[0].date,
        label: diffDays === 0
          ? "Pesée sync. aujourd'hui"
          : diffDays === 1
          ? "Pesée sync. hier"
          : `Dernière pesée sync. : ${lastDate.toLocaleDateString("fr-FR")}`,
      };
    },
  });
}

export function useManualBodySync() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Non authentifié");

      // Get user's API key from profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("api_key")
        .eq("user_id", user.id)
        .single();

      if (!profile?.api_key) {
        throw new Error("Clé API non configurée. Configure-la dans les Paramètres.");
      }

      // Call the edge function to trigger sync
      const { data, error } = await supabase.functions.invoke("apple-health-sync", {
        body: { body_metrics: [], workouts: [], metrics: [] },
        headers: { "x-api-key": profile.api_key },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["body_metrics"] });
      qc.invalidateQueries({ queryKey: ["body_metrics_latest"] });
      qc.invalidateQueries({ queryKey: ["body_metrics_sync_status"] });
    },
  });
}
