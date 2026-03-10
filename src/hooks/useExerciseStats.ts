import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface ExerciseStatRow {
  id: string;
  user_id: string;
  exercise_name: string;
  weight_kg: number;
  reps: number;
  sets: number;
  session_id: string | null;
  created_at: string;
}

export interface ExerciseTrackingCard {
  exercise_name: string;
  latest_weight: number;
  previous_weight: number | null;
  progression_pct: number | null;
  latest_date: string;
  sparkline: { date: string; weight: number }[];
  history: { date: string; weight: number }[];
}

export function useExerciseStats() {
  return useQuery({
    queryKey: ["exercise_stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercise_stats")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ExerciseStatRow[];
    },
  });
}

export function useExerciseTrackingCards(): ExerciseTrackingCard[] {
  const { data: stats = [] } = useExerciseStats();

  const byName = new Map<string, ExerciseStatRow[]>();
  for (const s of stats) {
    const list = byName.get(s.exercise_name) || [];
    list.push(s);
    byName.set(s.exercise_name, list);
  }

  const cards: ExerciseTrackingCard[] = [];

  for (const [name, entries] of byName) {
    // entries are desc by created_at
    const latest = entries[0];
    const previous = entries[1] || null;
    const progressionPct = previous && previous.weight_kg > 0
      ? Math.round(((latest.weight_kg - previous.weight_kg) / previous.weight_kg) * 100)
      : null;

    // Sparkline: last 10 entries, reversed to asc
    const sparklineEntries = entries.slice(0, 10).reverse();
    const sparkline = sparklineEntries.map((e) => ({
      date: e.created_at.split("T")[0],
      weight: e.weight_kg,
    }));

    // Full history (asc)
    const history = [...entries].reverse().map((e) => ({
      date: e.created_at.split("T")[0],
      weight: e.weight_kg,
    }));

    cards.push({
      exercise_name: name,
      latest_weight: latest.weight_kg,
      previous_weight: previous?.weight_kg ?? null,
      progression_pct: progressionPct,
      latest_date: latest.created_at,
      sparkline,
      history,
    });
  }

  // Sort by most recently updated
  cards.sort((a, b) => b.latest_date.localeCompare(a.latest_date));

  return cards;
}

export function useUniqueExerciseNames(): string[] {
  const { data: stats = [] } = useExerciseStats();
  return [...new Set(stats.map((s) => s.exercise_name))];
}

export function useInsertExerciseStat() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (values: { exercise_name: string; weight_kg: number; reps?: number; sets?: number; session_id?: string }) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("exercise_stats").insert({
        user_id: user.id,
        ...values,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exercise_stats"] });
    },
  });
}
