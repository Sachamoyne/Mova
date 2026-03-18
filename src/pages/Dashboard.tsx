import { useEffect, useRef } from "react";
import { Activity, Moon, Wind, Scale, Percent } from "lucide-react";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { HealthChart } from "@/components/dashboard/HealthChart";
import { WeeklySummary } from "@/components/dashboard/WeeklySummary";
import { ActivityHeatmap } from "@/components/dashboard/ActivityHeatmap";
import { HrvTrendBadge } from "@/components/dashboard/HrvTrendBadge";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { syncAppleHealth } from "@/services/appleHealth";

const kpiConfig = [
  { key: "hrv", label: "HRV", unit: "ms", icon: <Activity className="h-4 w-4" />, color: "hsl(152, 60%, 48%)" },
  { key: "sleep_score", label: "Sommeil", unit: "pts", icon: <Moon className="h-4 w-4" />, color: "hsl(217, 91%, 60%)" },
  { key: "weight", label: "Poids", unit: "kg", icon: <Scale className="h-4 w-4" />, color: "hsl(262, 83%, 58%)", source: "body_metrics" as const, bodyField: "weight_kg" as const },
  { key: "body_fat", label: "Masse Grasse", unit: "%", icon: <Percent className="h-4 w-4" />, color: "hsl(25, 95%, 53%)", source: "body_metrics" as const, bodyField: "body_fat_pc" as const, invertDelta: true },
  { key: "vo2max", label: "VO2Max", unit: "ml", icon: <Wind className="h-4 w-4" />, color: "hsl(172, 66%, 50%)" },
];

export default function Dashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const hasSyncedRef = useRef(false);

  const syncMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Non authentifié");
      return syncAppleHealth(user.id);
    },
    onSuccess: () => {
      hasSyncedRef.current = true;
      queryClient.invalidateQueries();
    },
  });

  useEffect(() => {
    if (!user || hasSyncedRef.current || syncMutation.isPending) return;
    try {
      const ua = navigator.userAgent || "";
      const isIosUA = /iPhone|iPad|iPod/.test(ua);
      const isIosCap = (window as any).Capacitor?.getPlatform?.() === "ios";
      if (!isIosUA && !isIosCap) return;
      syncMutation.mutate();
    } catch {
      // ignore UA errors
    }
  }, [user, syncMutation.isPending]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-display font-bold text-foreground">Vue d'ensemble</h1>
        <HrvTrendBadge />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpiConfig.map((kpi, idx) => (
          <div
            key={kpi.key}
            className={
              kpiConfig.length % 2 !== 0 && idx === kpiConfig.length - 1
                ? "col-span-2 sm:col-span-1"
                : undefined
            }
          >
            <KpiCard
              metricType={kpi.key}
              label={kpi.label}
              unit={kpi.unit}
              color={kpi.color}
              icon={kpi.icon}
              source={kpi.source}
              bodyField={kpi.bodyField}
              invertDelta={kpi.invertDelta}
            />
          </div>
        ))}
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-3">
        <HealthChart />
        <div className="flex flex-col gap-3">
          <WeeklySummary />
          <ActivityHeatmap />
        </div>
      </div>
    </div>
  );
}
