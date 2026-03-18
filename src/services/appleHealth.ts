import { requestHealthPermissions, fetchHealthData } from "./health";
import type { HealthSample, SleepSample } from "./health";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";

export interface AppleHealthSyncResult {
  importedSamples: number;
  importedHrv: number;
  importedRhr: number;
  importedSleepScore: number;
  importedWeight: number;
  importedBodyFat: number;
  importedWorkouts: number;
  fetched: {
    hrv: number;
    restingHR: number;
    sleep: number;
    weight: number;
    bodyFat: number;
    workouts: number;
  };
  verified: {
    health_metrics: { hrv: number; rhr: number; sleep_score: number };
    body_metrics: { rows: number };
    activities: { rows: number };
  };
  lastSync: string;
}

/**
 * Regroupe les échantillons par jour et calcule la moyenne.
 * Garantit une seule ligne par jour (contrainte UNIQUE sur user_id, metric_type, date).
 */
function groupByDayAverage(
  samples: HealthSample[]
): HealthSample[] {
  const map = new Map<string, { sum: number; count: number; unit: string }>();
  for (const s of samples) {
    const prev = map.get(s.date);
    if (prev) {
      prev.sum += s.value;
      prev.count += 1;
    } else {
      map.set(s.date, { sum: s.value, count: 1, unit: s.unit });
    }
  }
  return Array.from(map.entries()).map(([date, { sum, count, unit }]) => ({
    date,
    value: Math.round((sum / count) * 100) / 100,
    unit,
  }));
}

/**
 * Calcule un score de sommeil journalier (0–100) à partir des échantillons de sleep.
 * Formule : min(100, totalSleepMinutes / 480 * 100)
 * Seuls les états actifs (deep, light, rem, asleep) comptent.
 */
function computeSleepScores(
  sleepSamples: SleepSample[]
): HealthSample[] {
  const ACTIVE_STATES = new Set(["deep", "light", "rem", "asleep"]);
  const byDay = new Map<string, number>();

  for (const s of sleepSamples) {
    if (!ACTIVE_STATES.has(s.state)) continue;
    byDay.set(s.date, (byDay.get(s.date) ?? 0) + s.durationMin);
  }

  return Array.from(byDay.entries()).map(([date, totalMin]) => ({
    date,
    value: Math.min(100, Math.round((totalMin / 480) * 100)),
    unit: "score",
  }));
}

/**
 * Synchronise Apple Health → Supabase (30 derniers jours).
 *
 * Données importées :
 *   health_metrics : hrv, rhr, sleep_score
 *   body_metrics   : weight_kg, body_fat_pc
 *   activities     : workouts (running, cycling, swimming, tennis, padel, strength)
 */
export async function syncAppleHealth(userId: string): Promise<AppleHealthSyncResult> {
  console.info("[appleHealth] Starting sync for user", userId);

  // On synchronise depuis le 1er janvier de l'année courante pour alimenter toutes les vues "Année".
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const daysSinceJan1 = Math.max(1, Math.ceil((now.getTime() - jan1.getTime()) / 86_400_000) + 1);

  // ── Étape 1 : Permissions ────────────────────────────────────────────────
  const permissions = await requestHealthPermissions();
  if (!permissions.ok) {
    throw new Error(permissions.reason ?? "Autorisation HealthKit refusée.");
  }
  console.info("[appleHealth] Permissions granted:", permissions.granted ?? []);
  if (permissions.deniedTypes?.length) {
    console.info("[appleHealth] Permissions denied:", permissions.deniedTypes);
  }

  // ── Étape 2 : Récupération des données ───────────────────────────────────
  const snapshot = await fetchHealthData(daysSinceJan1);
  console.info("[appleHealth] Raw samples fetched", {
    hrv:       snapshot.hrv.length,
    weight:    snapshot.weight.length,
    restingHR: snapshot.restingHR.length,
    bodyFat:   snapshot.bodyFat.length,
    sleep:     snapshot.sleep.length,
    workouts:  snapshot.workouts.length,
  });

  // ── Étape 3 : Préparation ────────────────────────────────────────────────
  const hrvByDay       = groupByDayAverage(snapshot.hrv);
  const rhrByDay       = groupByDayAverage(snapshot.restingHR);
  const sleepScoreByDay = computeSleepScores(snapshot.sleep);
  const weightByDay    = groupByDayAverage(snapshot.weight);
  const bodyFatByDay   = groupByDayAverage(snapshot.bodyFat);

  const sinceDate = jan1.toISOString().split("T")[0];

  let importedHrv        = 0;
  let importedRhr        = 0;
  let importedSleepScore = 0;
  let importedWeight     = 0;
  let importedBodyFat    = 0;
  let importedWorkouts   = 0;

  // ── Étape 4a : HRV → health_metrics ─────────────────────────────────────
  if (hrvByDay.length > 0) {
    const rows: TablesInsert<"health_metrics">[] = hrvByDay.map((s) => ({
      user_id:     userId,
      date:        s.date,
      metric_type: "hrv" as const,
      value:       s.value,
      unit:        "ms",
    }));
    // Pas de contrainte UNIQUE garantie côté DB → on purge la fenêtre puis on insère
    const { error: delErr } = await supabase
      .from("health_metrics")
      .delete()
      .eq("user_id", userId)
      .eq("metric_type", "hrv")
      .gte("date", sinceDate);
    if (delErr) console.warn("[appleHealth] HRV delete warning:", delErr.message);

    const { error } = await supabase.from("health_metrics").insert(rows);
    if (error) {
      console.error("[appleHealth] HRV insert error:", error);
      throw new Error(`HRV sync failed: ${error.message}`);
    }
    importedHrv = rows.length;
    console.log("[appleHealth] ✓ HRV :", importedHrv);
  }

  // ── Étape 4b : Resting HR → health_metrics ───────────────────────────────
  if (rhrByDay.length > 0) {
    const rows: TablesInsert<"health_metrics">[] = rhrByDay.map((s) => ({
      user_id:     userId,
      date:        s.date,
      metric_type: "rhr" as const,
      value:       s.value,
      unit:        "bpm",
    }));
    const { error: delErr } = await supabase
      .from("health_metrics")
      .delete()
      .eq("user_id", userId)
      .eq("metric_type", "rhr")
      .gte("date", sinceDate);
    if (delErr) console.warn("[appleHealth] RHR delete warning:", delErr.message);

    const { error } = await supabase.from("health_metrics").insert(rows);
    if (error) console.error("[appleHealth] RHR insert error:", error);
    else importedRhr = rows.length;
    console.log("[appleHealth] ✓ RHR :", importedRhr);
  }

  // ── Étape 4c : Sleep Score → health_metrics ──────────────────────────────
  if (sleepScoreByDay.length > 0) {
    const rows: TablesInsert<"health_metrics">[] = sleepScoreByDay.map((s) => ({
      user_id:     userId,
      date:        s.date,
      metric_type: "sleep_score" as const,
      value:       s.value,
      unit:        "score",
    }));
    const { error: delErr } = await supabase
      .from("health_metrics")
      .delete()
      .eq("user_id", userId)
      .eq("metric_type", "sleep_score")
      .gte("date", sinceDate);
    if (delErr) console.warn("[appleHealth] Sleep delete warning:", delErr.message);

    const { error } = await supabase.from("health_metrics").insert(rows);
    if (error) console.error("[appleHealth] Sleep score insert error:", error);
    else importedSleepScore = rows.length;
    console.log("[appleHealth] ✓ Sleep score :", importedSleepScore);
  }

  // ── Étape 4d : Poids + Masse grasse → body_metrics ───────────────────────
  {
    // Fusionner poids et masse grasse par date
    const bodyMap = new Map<string, { weight_kg?: number; body_fat_pc?: number }>();
    for (const s of weightByDay) {
      bodyMap.set(s.date, { ...(bodyMap.get(s.date) ?? {}), weight_kg: s.value });
    }
    for (const s of bodyFatByDay) {
      bodyMap.set(s.date, { ...(bodyMap.get(s.date) ?? {}), body_fat_pc: s.value });
    }

    if (bodyMap.size > 0) {
      const rows: TablesInsert<"body_metrics">[] = Array.from(bodyMap.entries()).map(
        ([date, metrics]) => ({
          user_id:     userId,
          date,
          source:      "apple_health",
          weight_kg:   metrics.weight_kg,
          body_fat_pc: metrics.body_fat_pc,
        })
      );

      const { error: delErr } = await supabase
        .from("body_metrics")
        .delete()
        .eq("user_id", userId)
        .gte("date", sinceDate);
      if (delErr) console.warn("[appleHealth] body_metrics delete warning:", delErr.message);

      const { error } = await supabase.from("body_metrics").insert(rows);
      if (error) {
        console.error("[appleHealth] body_metrics insert error:", error);
      } else {
        importedWeight  = weightByDay.length;
        importedBodyFat = bodyFatByDay.length;
      }
      console.log("[appleHealth] ✓ Poids :", importedWeight, "| Masse grasse :", importedBodyFat);
    }
  }

  // ── Étape 4e : Workouts → activities ─────────────────────────────────────
  if (snapshot.workouts.length > 0) {
    const startDate = jan1.toISOString();

    const makeActivityKey = (x: {
      start_time: string;
      sport_type: string;
      duration_sec: number;
      distance_meters: number | null;
      calories: number | null;
    }) => {
      const minuteKey = x.start_time ? x.start_time.slice(0, 16) : "";
      const distKey = Math.round(((x.distance_meters ?? 0) as number) / 10) * 10; // 10m
      const durKey = Math.round((x.duration_sec ?? 0) / 5) * 5; // 5s
      const calKey = x.calories == null ? "" : Math.round(x.calories / 10) * 10;
      return `${minuteKey}|${x.sport_type}|${distKey}|${durKey}|${calKey}`;
    };

    // Charger les activités existantes pour dédupliquer de manière robuste
    const { data: existing } = await supabase
      .from("activities")
      .select("id,start_time,sport_type,duration_sec,distance_meters,calories")
      .eq("user_id", userId)
      .gte("start_time", startDate);

    const existingKeys = new Set(
      (existing ?? []).map((a: any) =>
        makeActivityKey({
          start_time: a.start_time,
          sport_type: a.sport_type,
          duration_sec: a.duration_sec,
          distance_meters: a.distance_meters,
          calories: a.calories,
        })
      )
    );

    const newWorkouts = snapshot.workouts.filter((w) => {
      const key = makeActivityKey({
        start_time: w.startTime,
        sport_type: w.sportType,
        duration_sec: w.durationSec,
        distance_meters: w.distanceMeters ? Math.round(w.distanceMeters) : null,
        calories: w.calories ? Math.round(w.calories) : null,
      });
      return !existingKeys.has(key);
    });

    if (newWorkouts.length > 0) {
      const rows: TablesInsert<"activities">[] = newWorkouts.map((w) => ({
        user_id:      userId,
        start_time:   w.startTime,
        sport_type:   w.sportType as any,
        duration_sec: w.durationSec,
        calories:     w.calories ? Math.round(w.calories) : null,
        distance_meters: w.distanceMeters ? Math.round(w.distanceMeters) : null,
      }));

      const { error } = await supabase.from("activities").insert(rows);
      if (error) console.error("[appleHealth] Activities insert error:", error);
      else importedWorkouts = rows.length;
      console.log("[appleHealth] ✓ Workouts :", importedWorkouts);
    }

    // Nettoyage: supprimer les doublons déjà présents (même séance importée plusieurs fois)
    // On garde la première occurrence (chronologiquement) et on supprime les suivantes.
    const activitiesToCheck = (existing ?? []).concat(
      newWorkouts.map((w) => ({
        id: null,
        start_time: w.startTime,
        sport_type: w.sportType,
        duration_sec: w.durationSec,
        distance_meters: w.distanceMeters ? Math.round(w.distanceMeters) : null,
        calories: w.calories ? Math.round(w.calories) : null,
      }))
    );

    // Recharger depuis la DB pour avoir des IDs réels et une vision complète après insert
    const { data: allRecent } = await supabase
      .from("activities")
      .select("id,start_time,sport_type,duration_sec,distance_meters,calories")
      .eq("user_id", userId)
      .gte("start_time", startDate)
      .order("start_time", { ascending: true });

    const seen = new Map<string, string>();
    const dupIds: string[] = [];
    for (const a of allRecent ?? []) {
      const key = makeActivityKey(a as any);
      const existingId = seen.get(key);
      if (!existingId) {
        seen.set(key, a.id);
      } else {
        dupIds.push(a.id);
      }
    }

    if (dupIds.length > 0) {
      console.warn("[appleHealth] Removing duplicate activities:", dupIds.length);
      for (let i = 0; i < dupIds.length; i += 100) {
        const chunk = dupIds.slice(i, i + 100);
        // eslint-disable-next-line no-await-in-loop
        const { error: delError } = await supabase.from("activities").delete().in("id", chunk);
        if (delError) console.error("[appleHealth] Duplicate delete error:", delError);
      }
    }
  }

  // ── Mise à jour last_sync ─────────────────────────────────────────────────
  const lastSync = new Date().toISOString();
  await supabase
    .from("profiles")
    .update({ last_sync: lastSync })
    .eq("user_id", userId);

  // ── Étape 5 : Vérification post-import (RLS / visibilité) ─────────────────
  const sinceTs = jan1.toISOString();

  const [hmHrv, hmRhr, hmSleep, bm, acts] = await Promise.all([
    supabase.from("health_metrics").select("id", { count: "exact", head: true }).eq("metric_type", "hrv").gte("date", sinceDate),
    supabase.from("health_metrics").select("id", { count: "exact", head: true }).eq("metric_type", "rhr").gte("date", sinceDate),
    supabase.from("health_metrics").select("id", { count: "exact", head: true }).eq("metric_type", "sleep_score").gte("date", sinceDate),
    supabase.from("body_metrics").select("id", { count: "exact", head: true }).gte("date", sinceDate),
    supabase.from("activities").select("id", { count: "exact", head: true }).gte("start_time", sinceTs),
  ]);

  const verified = {
    health_metrics: {
      hrv: hmHrv.count ?? 0,
      rhr: hmRhr.count ?? 0,
      sleep_score: hmSleep.count ?? 0,
    },
    body_metrics: { rows: bm.count ?? 0 },
    activities: { rows: acts.count ?? 0 },
  };

  console.info("[appleHealth] Post-import visibility check", verified);

  const importedSamples = importedHrv + importedRhr + importedSleepScore + importedWeight + importedBodyFat + importedWorkouts;

  console.info("[appleHealth] Sync completed", {
    importedHrv, importedRhr, importedSleepScore,
    importedWeight, importedBodyFat, importedWorkouts, lastSync,
  });

  return {
    importedSamples,
    importedHrv, importedRhr, importedSleepScore,
    importedWeight, importedBodyFat, importedWorkouts,
    fetched: {
      hrv: snapshot.hrv.length,
      restingHR: snapshot.restingHR.length,
      sleep: snapshot.sleep.length,
      weight: snapshot.weight.length,
      bodyFat: snapshot.bodyFat.length,
      workouts: snapshot.workouts.length,
    },
    verified,
    lastSync,
  };
}
