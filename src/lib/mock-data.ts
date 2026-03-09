import { supabase } from "@/integrations/supabase/client";

function randomBetween(min: number, max: number) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function randomDate(daysAgo: number) {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * daysAgo));
  return d;
}

export async function insertMockData(userId: string) {
  // Health metrics for last 90 days
  const healthMetrics: any[] = [];
  for (let i = 0; i < 90; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];

    healthMetrics.push(
      { user_id: userId, date: dateStr, metric_type: "hrv" as const, value: randomBetween(35, 85), unit: "ms" },
      { user_id: userId, date: dateStr, metric_type: "sleep_score" as const, value: randomBetween(55, 98), unit: "score" },
      { user_id: userId, date: dateStr, metric_type: "rhr" as const, value: randomBetween(48, 68), unit: "bpm" },
      { user_id: userId, date: dateStr, metric_type: "vo2max" as const, value: randomBetween(42, 56), unit: "ml/kg/min" },
      { user_id: userId, date: dateStr, metric_type: "body_battery" as const, value: randomBetween(20, 100), unit: "%" }
    );
  }

  // Insert in batches
  for (let i = 0; i < healthMetrics.length; i += 100) {
    await supabase.from("health_metrics").insert(healthMetrics.slice(i, i + 100));
  }

  // Activities over last 12 months
  const sportConfigs = [
    { type: "running" as const, freq: 3, dist: [5000, 21000], dur: [1200, 7200], hr: [140, 175], elev: [50, 500] },
    { type: "cycling" as const, freq: 1.5, dist: [20000, 80000], dur: [2400, 14400], hr: [120, 160], elev: [200, 1500] },
    { type: "swimming" as const, freq: 1, dist: [1000, 3000], dur: [1800, 4200], hr: [110, 155], elev: null },
    { type: "tennis" as const, freq: 1, dist: null, dur: [3600, 5400], hr: [125, 165], elev: null },
    { type: "padel" as const, freq: 1.5, dist: null, dur: [3600, 5400], hr: [120, 155], elev: null },
    { type: "strength" as const, freq: 2, dist: null, dur: [2400, 4800], hr: [90, 140], elev: null },
  ];

  const activities: any[] = [];
  for (const cfg of sportConfigs) {
    const count = Math.round(cfg.freq * 12 * 4 * (0.6 + Math.random() * 0.4));
    for (let j = 0; j < count; j++) {
      const date = randomDate(365);
      date.setHours(6 + Math.floor(Math.random() * 12), Math.floor(Math.random() * 60));
      activities.push({
        user_id: userId,
        sport_type: cfg.type,
        start_time: date.toISOString(),
        duration_sec: Math.round(randomBetween(cfg.dur[0], cfg.dur[1])),
        calories: Math.round(randomBetween(150, 900)),
        avg_hr: Math.round(randomBetween(cfg.hr[0], cfg.hr[1])),
        distance_meters: cfg.dist ? Math.round(randomBetween(cfg.dist[0], cfg.dist[1])) : null,
        total_elevation_gain: cfg.elev ? Math.round(randomBetween(cfg.elev[0], cfg.elev[1])) : null,
      });
    }
  }

  for (let i = 0; i < activities.length; i += 50) {
    await supabase.from("activities").insert(activities.slice(i, i + 50));
  }

  // Profile
  await supabase.from("profiles").upsert({
    user_id: userId,
    full_name: "Athlète Demo",
    weight_kg: 75,
    height_cm: 178,
    birth_date: "1992-03-15",
  });
}

export async function clearMockData(userId: string) {
  await supabase.from("health_metrics").delete().eq("user_id", userId);
  await supabase.from("activities").delete().eq("user_id", userId);
}
