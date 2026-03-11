import { requestHealthPermissions, fetchHealthData } from "./health";
import { supabase } from "@/integrations/supabase/client";
import { TablesInsert } from "@/integrations/supabase/types";

export interface AppleHealthSyncResult {
  importedSamples: number;
  lastSync: string;
}

export async function syncAppleHealth(userId: string): Promise<AppleHealthSyncResult> {
  console.info("[appleHealth] Starting sync for user", userId);

  const ok = await requestHealthPermissions();
  if (!ok) {
    console.warn("[appleHealth] HealthKit permissions were not granted");
    throw new Error("Autorisation HealthKit refusée ou indisponible (vérifie les réglages iOS et que tu es bien sur un iPhone physique).");
  }

  const snapshot = await fetchHealthData(30);
  if (!snapshot || (!snapshot.weight.length && !snapshot.bodyFat.length && !snapshot.hrv.length)) {
    console.warn("[appleHealth] No HealthKit samples returned (simulator or no data available)");
  }

  const today = new Date();
  const dateForRow = today.toISOString().split("T")[0];

  const bodyMetric: TablesInsert<"body_metrics"> = {
    user_id: userId,
    date: dateForRow,
    weight_kg: snapshot.weight.at(-1)?.value ?? null,
    body_fat_pc: snapshot.bodyFat.at(-1)?.value ?? null,
    muscle_mass_kg: null,
    source: "apple_health",
  };

  const hrvMetric: TablesInsert<"health_metrics"> | null = snapshot.hrv.length
    ? {
        user_id: userId,
        date: dateForRow,
        metric_type: "hrv",
        value: snapshot.hrv.at(-1)!.value,
        unit: "ms",
      }
    : null;

  const { error: bodyError } = await supabase.from("body_metrics").insert(bodyMetric);
  if (bodyError) throw bodyError;

  if (hrvMetric) {
    const { error: hrvError } = await supabase.from("health_metrics").insert(hrvMetric);
    if (hrvError) throw hrvError;
  }

  const lastSync = new Date().toISOString();

  await supabase
    .from("profiles")
    .update({ last_sync: lastSync })
    .eq("user_id", userId);

  console.info("[appleHealth] Sync completed", {
    importedSamples: snapshot.weight.length + snapshot.bodyFat.length + snapshot.hrv.length,
    lastSync,
  });

  return {
    importedSamples: snapshot.weight.length + snapshot.bodyFat.length + snapshot.hrv.length,
    lastSync,
  };
}

