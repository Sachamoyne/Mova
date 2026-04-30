import { createClient } from "@supabase/supabase-js";
import { Health } from "@capgo/capacitor-health";
import type { Workout } from "@capgo/capacitor-health/dist/esm/definitions";
import type { Database, TablesInsert } from "@/integrations/supabase/types";
import { toLocalDateStr } from "@/services/health";
import { isIphoneSourceDevice } from "@/lib/platform";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

type SyncResult = {
  recordsImported: number;
  activitiesInserted: number;
  sessionsInserted: number;
  activitiesSkippedWindowDuplicate: number;
  nutritionImported: number;
};

const WORKOUT_READ_TYPES = ["exerciseTime", "calories", "distance", "steps", "workouts"] as const;
const WORKOUT_READ_TYPES_FALLBACK = ["exerciseTime", "calories", "distance", "steps"] as const;
const NUTRITION_READ_TYPES = ["dietaryEnergyConsumed", "dietaryProtein", "dietaryCarbohydrates", "dietaryFat"] as const;
const HEALTHKIT_READ_TYPES = [...WORKOUT_READ_TYPES, ...NUTRITION_READ_TYPES] as const;
const HEALTHKIT_READ_TYPES_FALLBACK = [...WORKOUT_READ_TYPES_FALLBACK, ...NUTRITION_READ_TYPES] as const;

type NutritionHealthType = typeof NUTRITION_READ_TYPES[number];
type NutritionMetricType = Extract<Database["public"]["Enums"]["metric_type"], "calories_total" | "protein" | "carbs" | "fat">;
type NutritionUnit = "kcal" | "g";
type NutritionMetricSummary = {
  raw_samples: number;
  days: number;
  rows_upserted: number;
  error?: string;
};
type NutritionSyncSummary = Partial<Record<NutritionMetricType, NutritionMetricSummary>>;

const NUTRITION_SYNC_CONFIG: ReadonlyArray<{
  healthType: NutritionHealthType;
  metricType: NutritionMetricType;
  unit: NutritionUnit;
}> = [
  { healthType: "dietaryEnergyConsumed", metricType: "calories_total", unit: "kcal" },
  { healthType: "dietaryProtein", metricType: "protein", unit: "g" },
  { healthType: "dietaryCarbohydrates", metricType: "carbs", unit: "g" },
  { healthType: "dietaryFat", metricType: "fat", unit: "g" },
];

function mapWorkoutTypeToName(workoutType: string): string {
  const normalized = (workoutType ?? "")
    .replace("HKWorkoutActivityType", "")
    .replace(/[^A-Za-z]/g, "")
    .toLowerCase();

  if (normalized.includes("run") || normalized.includes("jog") || normalized.includes("track")) return "running";
  if (normalized.includes("cycle") || normalized.includes("bike")) return "cycling";
  if (normalized.includes("swim")) return "swimming";
  if (normalized.includes("strength") || normalized.includes("weight") || normalized.includes("cross") || normalized.includes("hiit")) return "strength";
  if (normalized.includes("tennis")) return "tennis";
  if (normalized.includes("padel") || normalized.includes("paddle") || normalized.includes("racquet") || normalized.includes("squash")) return "padel";

  return normalized || "workout";
}

function mapWorkoutTypeToSportType(workoutType: string): Database["public"]["Enums"]["sport_type"] | null {
  const name = mapWorkoutTypeToName(workoutType);
  if (name === "running") return "running";
  if (name === "cycling") return "cycling";
  if (name === "swimming") return "swimming";
  if (name === "strength") return "strength";
  if (name === "tennis") return "tennis";
  if (name === "padel") return "padel";
  return null;
}

function buildSessionNotes(workout: Workout): string {
  const durationSec = Math.max(0, Math.round(Number(workout.duration ?? 0)));
  const durationMin = Math.round(durationSec / 60);
  const workoutWithActive = workout as Workout & { activeEnergyBurned?: number };
  const caloriesRaw = typeof workoutWithActive.activeEnergyBurned === "number"
    ? Number(workoutWithActive.activeEnergyBurned)
    : typeof workout.totalEnergyBurned === "number"
      ? Number(workout.totalEnergyBurned)
      : null;

  if (caloriesRaw == null) {
    return `Durée: ${durationMin} min`;
  }

  return `Durée: ${durationMin} min • Calories: ${Math.round(caloriesRaw)} kcal`;
}

async function getAuthedClient() {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("Supabase env vars manquantes");
  }

  const baseClient = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storage: localStorage },
  });

  const { data: { session }, error } = await baseClient.auth.getSession();
  if (error) throw error;

  const token = session?.access_token;
  const userId = session?.user?.id;
  if (!token || !userId) throw new Error("Session utilisateur introuvable");

  const authedClient = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return { client: authedClient, userId };
}

async function queryHealthKitWorkoutsLast30Days(): Promise<Workout[]> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 30);

  const result = await Health.queryWorkouts({
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    limit: 1000,
    ascending: true,
  });

  return result.workouts ?? [];
}

function getNutritionDateRange() {
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);

  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - 30);
  startDate.setHours(0, 0, 0, 0);

  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  };
}

function aggregateNutritionSamplesByDay(
  samples: Array<{ startDate?: string; value?: number | string | null }>,
  userId: string,
  metricType: NutritionMetricType,
  unit: NutritionUnit
): TablesInsert<"health_metrics">[] {
  const byDay = new Map<string, number>();

  for (const sample of samples) {
    if (!sample.startDate) continue;
    const value = Number(sample.value);
    if (!Number.isFinite(value) || value <= 0) continue;

    const date = toLocalDateStr(sample.startDate);
    byDay.set(date, (byDay.get(date) ?? 0) + value);
  }

  return Array.from(byDay.entries()).map(([date, value]) => ({
    user_id: userId,
    date,
    metric_type: metricType,
    value: Math.round(value * 10) / 10,
    unit,
  }));
}

async function syncNutritionMetric(
  client: Awaited<ReturnType<typeof getAuthedClient>>["client"],
  userId: string,
  healthType: NutritionHealthType,
  metricType: NutritionMetricType,
  unit: NutritionUnit,
  startDate: string,
  endDate: string
): Promise<NutritionMetricSummary> {
  try {
    const result = await Health.readSamples({
      dataType: healthType as any,
      type: healthType,
      startDate,
      endDate,
      ascending: true,
      limit: 10000,
    } as any);

    const rawSamples = result.samples ?? [];
    const rows = aggregateNutritionSamplesByDay(rawSamples, userId, metricType, unit);

    if (rows.length === 0) {
      return { raw_samples: rawSamples.length, days: 0, rows_upserted: 0 };
    }

    const { error } = await client
      .from("health_metrics")
      .upsert(rows, { onConflict: "user_id,metric_type,date" });

    if (error) {
      console.error(`[healthKitSync] ${healthType} -> ${metricType} upsert error:`, {
        error,
        rawSamples: rawSamples.length,
        rows: rows.length,
      });
      return { raw_samples: rawSamples.length, days: rows.length, rows_upserted: 0, error: error.message };
    }

    return { raw_samples: rawSamples.length, days: rows.length, rows_upserted: rows.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[healthKitSync] ${healthType} -> ${metricType} read error:`, error);
    return { raw_samples: 0, days: 0, rows_upserted: 0, error: message };
  }
}

async function syncNutritionMetrics(
  client: Awaited<ReturnType<typeof getAuthedClient>>["client"],
  userId: string
): Promise<{ nutritionImported: number; nutritionSummary: NutritionSyncSummary; nutritionErrors: string[] }> {
  const { startDate, endDate } = getNutritionDateRange();
  const nutritionSummary: NutritionSyncSummary = {};
  const nutritionErrors: string[] = [];
  let nutritionImported = 0;

  for (const config of NUTRITION_SYNC_CONFIG) {
    // eslint-disable-next-line no-await-in-loop
    const summary = await syncNutritionMetric(
      client,
      userId,
      config.healthType,
      config.metricType,
      config.unit,
      startDate,
      endDate
    );

    nutritionSummary[config.metricType] = summary;
    nutritionImported += summary.rows_upserted;
    if (summary.error) nutritionErrors.push(`${config.metricType}: ${summary.error}`);
  }

  return { nutritionImported, nutritionSummary, nutritionErrors };
}

async function ensureHealthKitAuthorization() {
  try {
    await Health.requestAuthorization({
      read: [...HEALTHKIT_READ_TYPES] as unknown as Parameters<typeof Health.requestAuthorization>[0]["read"],
      write: [],
    });
  } catch {
    // Some plugin versions may reject unknown "workouts" key.
    await Health.requestAuthorization({
      read: [...HEALTHKIT_READ_TYPES_FALLBACK] as unknown as Parameters<typeof Health.requestAuthorization>[0]["read"],
      write: [],
    });
  }

  const check = await Health.checkAuthorization({
    read: [...HEALTHKIT_READ_TYPES_FALLBACK] as unknown as Parameters<typeof Health.checkAuthorization>[0]["read"],
  });

  const readAuthorized: string[] = check?.readAuthorized ?? [];
  const hasWorkoutsEquivalent =
    readAuthorized.includes("workouts") ||
    readAuthorized.includes("exerciseTime");
  const hasNutritionEquivalent = NUTRITION_READ_TYPES.some((type) => readAuthorized.includes(type));

  if (!hasWorkoutsEquivalent && !hasNutritionEquivalent) {
    throw new Error(`Authorization not determined: ${readAuthorized.join(",") || "none"}`);
  }

  return { hasWorkoutsEquivalent, hasNutritionEquivalent, readAuthorized };
}

export async function syncHealthKitToSupabase(): Promise<SyncResult> {
  if (!isIphoneSourceDevice()) {
    return { recordsImported: 0, activitiesInserted: 0, sessionsInserted: 0, activitiesSkippedWindowDuplicate: 0, nutritionImported: 0 };
  }

  const { client, userId } = await getAuthedClient();
  let activitiesInserted = 0;
  let sessionsInserted = 0;
  let activitiesSkippedWindowDuplicate = 0;
  let nutritionImported = 0;
  let nutritionSummary: NutritionSyncSummary = {};
  let nutritionErrors: string[] = [];

  try {
    const authorization = await ensureHealthKitAuthorization();
    const workouts = authorization.hasWorkoutsEquivalent ? await queryHealthKitWorkoutsLast30Days() : [];

    const since = new Date();
    since.setDate(since.getDate() - 30);
    const sinceDate = toLocalDateStr(since.toISOString());

    const { data: existingSessions, error: existingErr } = await client
      .from("workout_sessions")
      .select("date,name")
      .eq("user_id", userId)
      .gte("date", sinceDate);

    if (existingErr) throw existingErr;

    const existingKeys = new Set(
      (existingSessions ?? []).map((session) => `${session.date}|${(session.name ?? "").toLowerCase()}`)
    );

    const sessionsToInsert: TablesInsert<"workout_sessions">[] = [];

    for (const workout of workouts) {
      const mappedSportType = mapWorkoutTypeToSportType(workout.workoutType);
      if (mappedSportType) {
        const workoutDate = new Date(workout.startDate)
          .toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });

        const { data: existingSameDay, error: existingSameDayErr } = await client
          .from("activities")
          .select("id")
          .eq("user_id", userId)
          .eq("sport_type", mappedSportType)
          .gte("start_time", `${workoutDate}T00:00:00+02:00`)
          .lte("start_time", `${workoutDate}T23:59:59+02:00`)
          .limit(1);

        if (existingSameDayErr) throw existingSameDayErr;

        if ((existingSameDay ?? []).length > 0) {
          activitiesSkippedWindowDuplicate++;
        } else {
          const workoutWithActive = workout as Workout & { activeEnergyBurned?: number };
          const caloriesRaw = typeof workoutWithActive.activeEnergyBurned === "number"
            ? Number(workoutWithActive.activeEnergyBurned)
            : typeof workout.totalEnergyBurned === "number"
              ? Number(workout.totalEnergyBurned)
              : null;

          const activityPayload: TablesInsert<"activities"> = {
            user_id: userId,
            sport_type: mappedSportType,
            start_time: workout.startDate,
            duration_sec: Math.max(0, Math.round(Number(workout.duration ?? 0))),
            calories: caloriesRaw != null ? Math.round(caloriesRaw) : null,
            distance_meters: typeof workout.totalDistance === "number" ? Number(workout.totalDistance) : null,
          };

          const { error: insertActivityErr } = await client
            .from("activities")
            .insert(activityPayload);

          if (insertActivityErr) throw insertActivityErr;
          activitiesInserted++;
        }
      }

      const date = toLocalDateStr(workout.startDate);
      const name = mapWorkoutTypeToName(workout.workoutType);
      const key = `${date}|${name.toLowerCase()}`;

      if (existingKeys.has(key)) continue;

      sessionsToInsert.push({
        user_id: userId,
        date,
        name,
        notes: buildSessionNotes(workout),
      });
      existingKeys.add(key);
    }

    if (sessionsToInsert.length > 0) {
      const { data: inserted, error: insertErr } = await client
        .from("workout_sessions")
        .insert(sessionsToInsert)
        .select("id");
      if (insertErr) throw insertErr;
      sessionsInserted = inserted?.length ?? 0;
    }

    const nutritionResult = await syncNutritionMetrics(client, userId);
    nutritionImported = nutritionResult.nutritionImported;
    nutritionSummary = nutritionResult.nutritionSummary;
    nutritionErrors = nutritionResult.nutritionErrors;

    const recordsImported = activitiesInserted + sessionsInserted + nutritionImported;

    await client.from("sync_logs").insert({
      user_id: userId,
      source: "healthkit",
      status: nutritionErrors.length > 0 ? "partial" : "success",
      records_imported: recordsImported,
      error_message: nutritionErrors.length > 0 ? nutritionErrors.join("; ") : null,
      payload: {
        workouts_read: workouts.length,
        activities_inserted: activitiesInserted,
        activities_skipped_window_duplicate: activitiesSkippedWindowDuplicate,
        sessions_inserted: sessionsInserted,
        nutrition_imported: nutritionImported,
        nutrition: nutritionSummary,
      },
    });

    return { recordsImported, activitiesInserted, sessionsInserted, activitiesSkippedWindowDuplicate, nutritionImported };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown healthkit sync error";

    await client.from("sync_logs").insert({
      user_id: userId,
      source: "healthkit",
      status: "error",
      records_imported: activitiesInserted + sessionsInserted + nutritionImported,
      error_message: message,
      payload: {
        activities_inserted: activitiesInserted,
        activities_skipped_window_duplicate: activitiesSkippedWindowDuplicate,
        sessions_inserted: sessionsInserted,
        nutrition_imported: nutritionImported,
        nutrition: nutritionSummary,
      },
    });

    throw error;
  }
}
