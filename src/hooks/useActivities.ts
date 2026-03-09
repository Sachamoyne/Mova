import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type SportType = Database["public"]["Enums"]["sport_type"];

export function useActivities(sportType?: SportType | SportType[], limit?: number) {
  return useQuery({
    queryKey: ["activities", sportType, limit],
    queryFn: async () => {
      let query = supabase.from("activities").select("*").order("start_time", { ascending: false });

      if (sportType) {
        if (Array.isArray(sportType)) {
          query = query.in("sport_type", sportType);
        } else {
          query = query.eq("sport_type", sportType);
        }
      }
      if (limit) query = query.limit(limit);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useActivityHeatmap() {
  return useQuery({
    queryKey: ["activity_heatmap"],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 365);
      const { data, error } = await supabase
        .from("activities")
        .select("start_time")
        .gte("start_time", since.toISOString());
      if (error) throw error;

      const counts: Record<string, number> = {};
      data?.forEach((a) => {
        const day = a.start_time.split("T")[0];
        counts[day] = (counts[day] || 0) + 1;
      });
      return counts;
    },
  });
}
