import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "./useAuth";

type MetricType = Database["public"]["Enums"]["metric_type"];

interface UpsertHealthMetricInput {
  date: string;
  metric_type: MetricType;
  value: number;
  unit: string;
}

export function useUpsertHealthMetric() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpsertHealthMetricInput) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("health_metrics")
        .upsert(
          {
            user_id: user.id,
            date: payload.date,
            metric_type: payload.metric_type,
            value: payload.value,
            unit: payload.unit,
          },
          { onConflict: "user_id,metric_type,date" }
        );
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["kpi_metric", variables.metric_type] });
      queryClient.invalidateQueries({ queryKey: ["health_metrics"] });
      queryClient.invalidateQueries({ queryKey: ["latest_metrics"] });
    },
  });
}

