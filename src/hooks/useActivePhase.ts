import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type TrainingPhaseKey =
  | "lean_bulk"
  | "bulk_total"
  | "maintenance"
  | "cut"
  | "race_prep";

export type TrainingPhaseConfig = {
  key: TrainingPhaseKey;
  label: string;
  accentClass: string;
  weightMonthlyMinKg: number;
  weightMonthlyMaxKg: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

const STORAGE_KEY = "perf_active_phase";
const DEFAULT_PHASE_KEY: TrainingPhaseKey = "lean_bulk";

export const TRAINING_PHASES: Record<TrainingPhaseKey, TrainingPhaseConfig> = {
  lean_bulk: {
    key: "lean_bulk",
    label: "Lean Bulk",
    accentClass: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
    weightMonthlyMinKg: 0.5,
    weightMonthlyMaxKg: 1,
    calories: 3400,
    protein: 220,
    carbs: 521,
    fat: 103,
  },
  bulk_total: {
    key: "bulk_total",
    label: "Bulk total",
    accentClass: "bg-orange-500/15 text-orange-500 border-orange-500/30",
    weightMonthlyMinKg: 1,
    weightMonthlyMaxKg: 2,
    calories: 3800,
    protein: 220,
    carbs: 600,
    fat: 120,
  },
  maintenance: {
    key: "maintenance",
    label: "Maintenance",
    accentClass: "bg-blue-500/15 text-blue-500 border-blue-500/30",
    weightMonthlyMinKg: 0,
    weightMonthlyMaxKg: 0,
    calories: 2800,
    protein: 180,
    carbs: 400,
    fat: 90,
  },
  cut: {
    key: "cut",
    label: "Sèche",
    accentClass: "bg-rose-500/15 text-rose-500 border-rose-500/30",
    weightMonthlyMinKg: -1,
    weightMonthlyMaxKg: -0.5,
    calories: 2200,
    protein: 220,
    carbs: 220,
    fat: 70,
  },
  race_prep: {
    key: "race_prep",
    label: "Préparation course",
    accentClass: "bg-cyan-500/15 text-cyan-500 border-cyan-500/30",
    weightMonthlyMinKg: 0,
    weightMonthlyMaxKg: 0,
    calories: 3200,
    protein: 180,
    carbs: 520,
    fat: 80,
  },
};

type StoredPhase = {
  activePhase: TrainingPhaseKey;
  phaseStartedAt: string;
};

function parseStoredPhase(raw: string | null): StoredPhase | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredPhase>;
    if (!parsed.activePhase || !(parsed.activePhase in TRAINING_PHASES)) return null;
    if (!parsed.phaseStartedAt) return null;
    return {
      activePhase: parsed.activePhase,
      phaseStartedAt: parsed.phaseStartedAt,
    } as StoredPhase;
  } catch {
    return null;
  }
}

function getLocalFallback(): StoredPhase {
  const stored = parseStoredPhase(localStorage.getItem(STORAGE_KEY));
  if (stored) return stored;
  const created = {
    activePhase: DEFAULT_PHASE_KEY,
    phaseStartedAt: new Date().toISOString(),
  } satisfies StoredPhase;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(created));
  return created;
}

export function useActivePhase() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const phaseQuery = useQuery({
    queryKey: ["active_phase", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<StoredPhase> => {
      if (!user) return getLocalFallback();

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("active_phase, phase_started_at")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) throw error;

        const dbPhase = data?.active_phase as TrainingPhaseKey | null;
        const dbStarted = data?.phase_started_at ?? null;
        if (dbPhase && dbPhase in TRAINING_PHASES && dbStarted) {
          const normalized = { activePhase: dbPhase, phaseStartedAt: dbStarted };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
          return normalized;
        }

        return getLocalFallback();
      } catch {
        return getLocalFallback();
      }
    },
  });

  const setPhaseMutation = useMutation({
    mutationFn: async (nextPhase: TrainingPhaseKey) => {
      const nowIso = new Date().toISOString();
      const payload = { activePhase: nextPhase, phaseStartedAt: nowIso } satisfies StoredPhase;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));

      if (!user) return payload;

      try {
        const { error } = await supabase
          .from("profiles")
          .upsert(
            {
              user_id: user.id,
              active_phase: nextPhase,
              phase_started_at: nowIso,
            },
            { onConflict: "user_id" }
          );

        if (error) throw error;
      } catch {
        // Fallback localStorage only
      }

      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active_phase"] });
    },
  });

  const activePhaseKey = (phaseQuery.data?.activePhase ?? DEFAULT_PHASE_KEY) as TrainingPhaseKey;
  const phaseStartedAt = phaseQuery.data?.phaseStartedAt ?? new Date().toISOString();
  const phase = useMemo(
    () => TRAINING_PHASES[activePhaseKey] ?? TRAINING_PHASES[DEFAULT_PHASE_KEY],
    [activePhaseKey]
  );

  return {
    activePhaseKey,
    phase,
    phaseStartedAt,
    isLoading: phaseQuery.isLoading,
    setActivePhase: setPhaseMutation.mutateAsync,
    isSaving: setPhaseMutation.isPending,
  };
}
