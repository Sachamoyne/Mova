import { useMemo } from "react";
import { RadialBarChart, RadialBar, ResponsiveContainer } from "recharts";
import { useLatestMetrics, useHrvTrend, useHealthMetrics } from "@/hooks/useHealthData";
import { Zap, BedDouble, TrendingDown } from "lucide-react";

function getAdvice(score: number, hrvRatio: number, sleepRatio: number): { text: string; icon: React.ReactNode } {
  if (score >= 80) {
    return {
      text: "Ton HRV est excellent, c'est le moment de tenter un record !",
      icon: <Zap className="h-4 w-4 text-hrv" />,
    };
  }
  if (score >= 60) {
    return {
      text: "Bonne forme générale, entraînement normal possible.",
      icon: <Zap className="h-4 w-4 text-sleep" />,
    };
  }
  if (score >= 40) {
    return {
      text: "Forme moyenne, privilégie un entraînement léger aujourd'hui.",
      icon: <TrendingDown className="h-4 w-4 text-muted-foreground" />,
    };
  }
  return {
    text: "Repos conseillé aujourd'hui, ton corps a besoin de récupérer.",
    icon: <BedDouble className="h-4 w-4 text-rhr" />,
  };
}

export function ReadinessScore() {
  const { data: metrics } = useLatestMetrics();
  const { data: allMetrics } = useHealthMetrics(7);

  const result = useMemo(() => {
    if (!metrics || !allMetrics) return null;

    const hrv = metrics.hrv;
    const sleep = metrics.sleep_score;
    if (!hrv || !sleep) return null;

    // Compute 7-day averages from allMetrics
    const hrvValues = allMetrics.filter((m) => m.metric_type === "hrv").map((m) => m.value);
    const sleepValues = allMetrics.filter((m) => m.metric_type === "sleep_score").map((m) => m.value);

    if (hrvValues.length === 0 || sleepValues.length === 0) return null;

    const hrvAvg7 = hrvValues.reduce((s, v) => s + v, 0) / hrvValues.length;
    const sleepAvg7 = sleepValues.reduce((s, v) => s + v, 0) / sleepValues.length;

    const hrvRatio = hrvAvg7 > 0 ? hrv.value / hrvAvg7 : 1;
    const sleepRatio = sleepAvg7 > 0 ? sleep.value / sleepAvg7 : 1;

    // Clamp each component to [0, 50] then sum
    const hrvComponent = Math.min(Math.max(hrvRatio * 50, 0), 60);
    const sleepComponent = Math.min(Math.max(sleepRatio * 50, 0), 60);
    const score = Math.round(Math.min(hrvComponent + sleepComponent, 100));

    return { score, hrvRatio, sleepRatio };
  }, [metrics, allMetrics]);

  if (!result) return null;

  const { score, hrvRatio, sleepRatio } = result;
  const advice = getAdvice(score, hrvRatio, sleepRatio);

  const scoreColor =
    score >= 80
      ? "hsl(var(--hrv))"
      : score >= 60
        ? "hsl(var(--sleep))"
        : score >= 40
          ? "hsl(var(--muted-foreground))"
          : "hsl(var(--rhr))";

  const chartData = [{ name: "score", value: score, fill: scoreColor }];

  return (
    <div className="glass-card p-4 flex flex-col items-center gap-3">
      <h3 className="font-display font-semibold text-sm text-foreground w-full">Readiness</h3>
      <div className="relative w-28 h-28">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="75%"
            outerRadius="100%"
            startAngle={90}
            endAngle={-270}
            data={chartData}
            barSize={10}
          >
            <RadialBar
              dataKey="value"
              cornerRadius={5}
              background={{ fill: "hsl(var(--secondary))" }}
              maxBarSize={100}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-display font-bold" style={{ color: scoreColor }}>
            {score}
          </span>
          <span className="text-[10px] text-muted-foreground">/100</span>
        </div>
      </div>
      <div className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed text-center">
        {advice.icon}
        <span>{advice.text}</span>
      </div>
    </div>
  );
}
