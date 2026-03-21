import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useHealthMetrics(days = 30) {
  return useQuery({
    queryKey: ["health_metrics", days],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - days);
      const sinceStr = `${since.getFullYear()}-${String(since.getMonth() + 1).padStart(2, "0")}-${String(since.getDate()).padStart(2, "0")}`;
      const { data, error } = await supabase
        .from("health_metrics")
        .select("*")
        .gte("date", sinceStr)
        .order("date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useLatestMetrics() {
  return useQuery({
    queryKey: ["latest_metrics"],
    queryFn: async () => {
      const types = ["hrv", "sleep_score", "rhr", "vo2max"] as const;
      const results: Record<string, { value: number; unit: string; trend: number[] }> = {};

      for (const type of types) {
        const { data } = await supabase
          .from("health_metrics")
          .select("value, date, unit")
          .eq("metric_type", type)
          .order("date", { ascending: false })
          .limit(7);

        if (data && data.length > 0) {
          results[type] = {
            value: data[0].value,
            unit: data[0].unit,
            trend: data.map((d) => d.value).reverse(),
          };
        }
      }
      return results;
    },
  });
}
