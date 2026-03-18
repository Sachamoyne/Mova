/**
 * HealthKit Bridge — @capgo/capacitor-health v8
 *
 * Valid HealthDataType values (from plugin definitions):
 *   'steps' | 'distance' | 'calories' | 'heartRate' | 'weight' | 'sleep' |
 *   'respiratoryRate' | 'oxygenSaturation' | 'restingHeartRate' |
 *   'heartRateVariability' | 'bloodPressure' | 'bloodGlucose' |
 *   'bodyTemperature' | 'height' | 'flightsClimbed' | 'exerciseTime' |
 *   'distanceCycling' | 'bodyFat' | 'basalCalories' | 'totalCalories' |
 *   'mindfulness'
 *
 * NOTE: "workout", "activeEnergyBurned", "bodyFatPercentage", "leanBodyMass",
 *       "bmi", "vo2max", "dietaryEnergy" are NOT valid types → they crash the
 *       native bridge and land in catch → "Impossible de demander l'autorisation".
 *       Workouts are fetched via Health.queryWorkouts() separately.
 */

import { Health } from "@capgo/capacitor-health";
import type { Workout } from "@capgo/capacitor-health/dist/esm/definitions";

// ─── Diagnostic au chargement ────────────────────────────────────────────────
if (!Health) {
  console.error(
    "[health] PLUGIN_NOT_FOUND — Health est falsy au chargement du module.\n" +
    "→ Vérifier que @capgo/capacitor-health est listé dans package.json et installé.\n" +
    "→ Relancer : npm install && npx cap sync && Clean Build Folder dans Xcode."
  );
} else {
  console.log("[health] ✓ Health plugin chargé");
  console.log("[health] Plugin Object Keys     :", Object.keys(Health));
  console.log("[health] window.Capacitor.Plugins.Health :", (window as any).Capacitor?.Plugins?.Health ?? "(non encore injecté)");
}

// ─── Types locaux ─────────────────────────────────────────────────────────────

export interface HealthSample {
  date: string;   // YYYY-MM-DD
  value: number;
  unit: string;
}

export interface SleepSample {
  date: string;        // YYYY-MM-DD de la nuit (date de fin ou date de début si < midi)
  state: string;       // deep | light | rem | asleep | awake | inBed
  durationMin: number; // durée en minutes
}

export interface WorkoutData {
  startTime: string;      // ISO 8601
  date: string;           // YYYY-MM-DD
  sportType: string;      // valeur mappée vers sport_type enum
  durationSec: number;
  calories?: number;
  distanceMeters?: number;
  source?: string;
}

export interface HealthSnapshot {
  hrv:       HealthSample[];
  weight:    HealthSample[];
  restingHR: HealthSample[];
  bodyFat:   HealthSample[];
  sleep:     SleepSample[];
  workouts:  WorkoutData[];
}

export interface HealthPermissionResult {
  ok: boolean;
  denied?: boolean; // true si l'utilisateur a explicitement refusé dans iOS
  reason?: string;
  granted?: string[];
  deniedTypes?: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getPlatform(): "ios" | "android" | "web" {
  try {
    return (window as any).Capacitor?.getPlatform?.() ?? "web";
  } catch {
    return "web";
  }
}

function isoRange(days: number): { startDate: string; endDate: string } {
  return {
    startDate: new Date(Date.now() - days * 86_400_000).toISOString(),
    endDate:   new Date().toISOString(),
  };
}

/** Retourne YYYY-MM-DD en attribuant les données de nuit à la date de fin si < 14h */
function sleepNightDate(isoDate: string): string {
  const d = new Date(isoDate);
  // Si l'heure de fin est avant 14h, on attribue à cette date (nuit précédente)
  // Sinon à la date courante
  if (d.getHours() < 14) {
    return d.toISOString().split("T")[0];
  }
  return d.toISOString().split("T")[0];
}

/**
 * Mappe un WorkoutType HealthKit vers le sport_type de la base de données.
 * Retourne null si le type n'est pas supporté.
 */
function mapWorkoutType(workoutType: string): "running" | "cycling" | "swimming" | "tennis" | "padel" | "strength" | null {
  const raw = workoutType ?? "";
  const normalized = raw
    .replace("HKWorkoutActivityType", "")
    .replace(/[^A-Za-z]/g, "")
    .trim();
  const key = normalized
    ? normalized.charAt(0).toLowerCase() + normalized.slice(1)
    : raw;

  switch (key) {
    case "running":
    case "runningTreadmill":
    case "trackAndField":
      return "running";
    case "cycling":
    case "bikingStationary":
    case "distanceCycling":
      return "cycling";
    case "swimming":
    case "swimmingPool":
    case "swimmingOpenWater":
    case "waterFitness":
      return "swimming";
    case "tennis":
    case "tableTennis":
      return "tennis";
    case "squash":
    case "racquetball":
    case "paddleSports":
      return "padel";
    case "strengthTraining":
    case "traditionalStrengthTraining":
    case "functionalStrengthTraining":
    case "weightlifting":
    case "crossTraining":
    case "highIntensityIntervalTraining":
      return "strength";
    default:
      // Fallback heuristics: different plugins/versions can return variants
      // like "outdoorRun", "run", "functionalStrengthTraining", etc.
      {
        const k = key.toLowerCase();
        if (k.includes("run")) return "running";
        if (k.includes("cycle") || k.includes("bike")) return "cycling";
        if (k.includes("swim")) return "swimming";
        if (k.includes("tennis")) return "tennis";
        if (k.includes("paddle") || k.includes("padel") || k.includes("racquet")) return "padel";
        if (k.includes("strength") || k.includes("weight") || k.includes("cross") || k.includes("hiit")) return "strength";
      }
      return null;
  }
}

// ─── ÉTAPE 1 : Permissions ───────────────────────────────────────────────────

export async function requestHealthPermissions(): Promise<HealthPermissionResult> {
  console.group("[health] ── ÉTAPE 1 : Permissions ──");

  if (getPlatform() !== "ios") {
    console.info("[health] Plateforme non-iOS → skip (données démo actives)");
    console.groupEnd();
    return { ok: true };
  }

  if (!Health) {
    console.error("[health] PLUGIN_NOT_FOUND");
    console.groupEnd();
    return {
      ok: false,
      reason: "Le plugin Apple Health n'est pas chargé. Relance npx cap sync ios puis rebuild dans Xcode.",
    };
  }

  try {
    console.log("[health] → Health.isAvailable()...");
    const availability = await Health.isAvailable();
    console.log("[health] ← isAvailable :", JSON.stringify(availability));

    if (!availability.available) {
      const ua = (typeof navigator !== "undefined" ? navigator.userAgent : "").toLowerCase();
      const reason = ua.includes("simulator")
        ? "Apple Santé n'est pas disponible sur le simulateur iOS. Lance l'app sur un iPhone physique."
        : "Apple Santé n'est pas disponible sur cet appareil.";
      console.error("[health] HealthKit indisponible :", availability.reason ?? availability.platform);
      console.groupEnd();
      return { ok: false, reason };
    }

    // IMPORTANT : seuls les types valides de HealthDataType sont listés ici.
    // "workout" n'est PAS un HealthDataType — les workouts passent par queryWorkouts().
    // Les types invalides (vo2max, bmi, leanBodyMass...) provoquent une exception native.
    // Certains builds du plugin demandent une autorisation explicite pour les workouts.
    // On tente d'inclure "workout(s)" dans la liste, et on fallback si le plugin rejette le type.
    const baseRead = [
      "steps",
      "calories",
      "heartRate",
      "weight",
      "sleep",
      "restingHeartRate",
      "heartRateVariability",
      "bodyFat",
      "exerciseTime",
    ];

    const tryReadLists: string[][] = [
      [...baseRead, "workouts"],
      [...baseRead, "workout"],
      baseRead,
    ];

    let status: any | null = null;
    let lastErr: any = null;

    for (const read of tryReadLists) {
      try {
        console.log("[health] → Health.requestAuthorization(read:", read.join(", "), ")");
        // eslint-disable-next-line no-await-in-loop
        status = await Health.requestAuthorization({ read: read as any, write: [] });
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        console.warn("[health] requestAuthorization failed for read list, retrying:", read, e);
      }
    }

    if (!status) {
      throw lastErr ?? new Error("requestAuthorization failed");
    }
    console.log("[health] ← requestAuthorization :", JSON.stringify(status));

    const granted = status.readAuthorized ?? [];
    const denied  = status.readDenied    ?? [];

    if (granted.length === 0) {
      const isDenied = denied.length > 0;
      console.warn("[health] Aucun type autorisé. Refus explicite :", isDenied);
      console.groupEnd();
      return {
        ok: false,
        denied: isDenied,
        granted,
        deniedTypes: denied,
        reason: isDenied
          ? "Merci d'activer l'accès dans Réglages > Santé > Accès aux données > Athletes Ascent."
          : "Aucun type de données Apple Santé autorisé.",
      };
    }

    console.log("[health] ✓ Types autorisés :", granted.join(", "));
    console.groupEnd();
    return { ok: true, granted, deniedTypes: denied };

  } catch (err) {
    console.error("[health] Exception requestHealthPermissions :", err);
    console.groupEnd();
    return {
      ok: false,
      reason: "Impossible de demander l'autorisation Apple Santé. Vérifie la config iOS (Info.plist, entitlement HealthKit) et relance sur iPhone physique.",
    };
  }
}

// ─── ÉTAPE 2 : Fetch individuels ─────────────────────────────────────────────

async function fetchSamples(dataType: string, days: number): Promise<HealthSample[]> {
  const { startDate, endDate } = isoRange(days);
  try {
    const result = await Health.readSamples({
      dataType: dataType as any,
      startDate,
      endDate,
      limit: 5000,
      ascending: true,
    });
    return (result.samples ?? [])
      .map((s) => {
        const date = new Date(s.startDate).toISOString().split("T")[0];
        let value = Number(s.value);
        let unit = s.unit ?? "";

        // HealthKit body fat is often returned as a fraction (0.18) instead of percent (18)
        if (dataType === "bodyFat" && Number.isFinite(value) && value > 0 && value <= 1.5) {
          value = Math.round(value * 10000) / 100; // 0.1834 → 18.34
          unit = "%";
        }

        return { date, value, unit };
      })
      .filter((s) => Number.isFinite(s.value) && s.value > 0);
  } catch (err) {
    console.error(`[health] ÉCHEC readSamples(${dataType}) :`, err);
    return [];
  }
}

async function fetchNativeSleep(days: number): Promise<SleepSample[]> {
  const { startDate, endDate } = isoRange(days);
  try {
    const result = await Health.readSamples({
      dataType: "sleep",
      startDate,
      endDate,
      limit: 5000,
      ascending: true,
    });
    return (result.samples ?? [])
      .filter((s) => s.sleepState && s.sleepState !== "inBed")
      .map((s) => {
        const start = new Date(s.startDate).getTime();
        const end   = new Date(s.endDate).getTime();
        const durationMin = Math.round((end - start) / 60_000);
        return {
          date:        sleepNightDate(s.endDate),
          state:       s.sleepState ?? "asleep",
          durationMin: durationMin > 0 ? durationMin : 0,
        };
      })
      .filter((s) => s.durationMin > 0);
  } catch (err) {
    console.error("[health] ÉCHEC readSamples(sleep) :", err);
    return [];
  }
}

async function fetchNativeWorkouts(days: number): Promise<WorkoutData[]> {
  const { startDate, endDate } = isoRange(days);
  try {
    const result = await Health.queryWorkouts({
      startDate,
      endDate,
      limit: 1000,
      ascending: true,
    });
    const types = Array.from(new Set((result.workouts ?? []).map((w) => w.workoutType))).slice(0, 20);
    console.log("[health] queryWorkouts types (sample):", types);
    const workouts = result.workouts ?? [];
    let mapped = 0;
    let unmapped = 0;
    const out: WorkoutData[] = [];

    for (const w of workouts) {
      const sportType = mapWorkoutType(w.workoutType);
      if (!sportType) {
        unmapped++;
        continue;
      }
      mapped++;
      out.push({
        startTime: w.startDate,
        date: new Date(w.startDate).toISOString().split("T")[0],
        sportType,
        durationSec: Math.round(w.duration),
        calories: w.totalEnergyBurned,
        distanceMeters: w.totalDistance,
        source: w.sourceName,
      });
    }

    if (unmapped > 0) {
      console.warn("[health] queryWorkouts unmapped workouts:", { unmapped, mapped, total: workouts.length });
    } else {
      console.log("[health] queryWorkouts mapped workouts:", { mapped, total: workouts.length });
    }

    return out;
  } catch (err) {
    console.error("[health] ÉCHEC queryWorkouts :", err);
    return [];
  }
}

async function fetchNativeHealthData(days: number): Promise<HealthSnapshot> {
  console.group("[health] ── ÉTAPE 2 : Fetch données natives ──");

  const [hrv, weight, restingHR, bodyFat, sleep, workouts] = await Promise.allSettled([
    fetchSamples("heartRateVariability", days),
    fetchSamples("weight", days),
    fetchSamples("restingHeartRate", days),
    fetchSamples("bodyFat", days),
    fetchNativeSleep(days),
    fetchNativeWorkouts(days),
  ]);

  const snapshot: HealthSnapshot = {
    hrv:       hrv.status       === "fulfilled" ? hrv.value       : [],
    weight:    weight.status    === "fulfilled" ? weight.value    : [],
    restingHR: restingHR.status === "fulfilled" ? restingHR.value : [],
    bodyFat:   bodyFat.status   === "fulfilled" ? bodyFat.value   : [],
    sleep:     sleep.status     === "fulfilled" ? sleep.value     : [],
    workouts:  workouts.status  === "fulfilled" ? workouts.value  : [],
  };

  console.log("[health] ✓ Snapshot :", {
    hrv:       snapshot.hrv.length,
    weight:    snapshot.weight.length,
    restingHR: snapshot.restingHR.length,
    bodyFat:   snapshot.bodyFat.length,
    sleep:     snapshot.sleep.length,
    workouts:  snapshot.workouts.length,
  });
  console.groupEnd();
  return snapshot;
}

// ─── Données démo (browser uniquement) ────────────────────────────────────────

function generateDemoData(days: number): HealthSnapshot {
  const samples = (base: number, variance: number, unit: string): HealthSample[] =>
    Array.from({ length: days }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (days - 1 - i));
      return {
        date:  d.toISOString().split("T")[0],
        value: Math.round((base + (Math.random() - 0.5) * variance) * 10) / 10,
        unit,
      };
    });

  const sleepDemo: SleepSample[] = Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    return {
      date:        d.toISOString().split("T")[0],
      state:       "asleep",
      durationMin: Math.round(360 + Math.random() * 120),
    };
  });

  return {
    hrv:       samples(55, 12, "millisecond"),
    weight:    samples(75, 2,  "kilogram"),
    restingHR: samples(52, 8,  "bpm"),
    bodyFat:   samples(18, 3,  "percent"),
    sleep:     sleepDemo,
    workouts:  [],
  };
}

// ─── API publique ─────────────────────────────────────────────────────────────

export async function fetchHealthData(days = 30): Promise<HealthSnapshot> {
  if (getPlatform() === "ios") {
    return fetchNativeHealthData(days);
  }
  console.info("[health] Browser → données démo (", days, "j)");
  return generateDemoData(days);
}
