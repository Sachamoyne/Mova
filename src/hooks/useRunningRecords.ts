import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "./useAuth";

type RunningRecordRow = Tables<"running_records">;

export function useRunningRecords() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["running_records", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [] as RunningRecordRow[];
      const { data, error } = await supabase
        .from("running_records")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as RunningRecordRow[];
    },
  });
}

interface RunningRecordUpsertInput {
  distance_label: string;
  value: string;
  date?: string | null;
  notes?: string | null;
}

export function useUpsertRunningRecord() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (values: RunningRecordUpsertInput) => {
      if (!user) throw new Error("Not authenticated");
      const payload = {
        user_id: user.id,
        distance_label: values.distance_label,
        value: values.value,
        date: values.date ?? null,
        notes: values.notes ?? null,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from("running_records")
        .upsert(payload, { onConflict: "user_id,distance_label" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["running_records"] });
    },
  });
}
