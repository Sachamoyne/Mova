import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type LatestNutrition = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export function getParisLocalDateString(): string {
  return new Date().toLocaleDateString("fr-CA", { timeZone: "Europe/Paris" });
}

export function useLatestNutrition(date?: string) {
  return useQuery({
    queryKey: ["latest_nutrition", date],
    queryFn: async (): Promise<LatestNutrition> => {
      const targetDate = date ?? getParisLocalDateString();
      const { data } = await supabase
        .from("health_metrics")
        .select("metric_type, value, date")
        .in("metric_type", ["calories_total", "protein", "carbs", "fat"])
        .eq("date", targetDate)
        .limit(4);

      const byMetric: Record<string, number> = {};
      for (const row of data ?? []) {
        byMetric[row.metric_type] = row.value;
      }

      return {
        calories: byMetric["calories_total"] ?? 0,
        protein: byMetric["protein"] ?? 0,
        carbs: byMetric["carbs"] ?? 0,
        fat: byMetric["fat"] ?? 0,
      };
    },
  });
}
