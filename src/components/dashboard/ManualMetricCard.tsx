import { useEffect, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart,
  CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Plus, TrendingDown, TrendingUp } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Drawer, DrawerClose, DrawerContent,
  DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ManualMetricType = "hrv" | "vo2max";
type MetricType = Database["public"]["Enums"]["metric_type"];

const PERIODS = [
  { label: "7j",  days: 7   },
  { label: "1m",  days: 30  },
  { label: "3m",  days: 90  },
  { label: "1a",  days: 365 },
] as const;

interface ManualMetricCardProps {
  metricType: ManualMetricType;
  label: string;
  unit: string;
  color: string;
  icon: React.ReactNode;
  targetValue?: number;
}

function toLocalDateStr(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function aggregateByMonth(
  data: { value: number; date: string }[]
): { label: string; v: number; date: string }[] {
  const byMonth: Record<string, number[]> = {};
  for (const e of data) {
    const key = e.date.slice(0, 7);
    if (!byMonth[key]) byMonth[key] = [];
    byMonth[key].push(e.value);
  }
  return Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, vals]) => {
      const v = Math.round((vals.reduce((s, x) => s + x, 0) / vals.length) * 10) / 10;
      const [y, m] = key.split("-");
      const lbl = new Date(Number(y), Number(m)-1, 1)
        .toLocaleDateString("fr-FR", { month: "short" });
      return { label: lbl, v, date: key + "-01" };
    });
}

function useMetricHistory(metricType: ManualMetricType, days: number) {
  return useQuery({
    queryKey: ["kpi_metric", metricType, days],
    staleTime: 0,
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - days);
      const sinceStr = `${since.getFullYear()}-${String(since.getMonth()+1).padStart(2,"0")}-${String(since.getDate()).padStart(2,"0")}`;
      const { data, error } = await supabase
        .from("health_metrics")
        .select("value, date, unit")
        .eq("metric_type", metricType as MetricType)
        .gte("date", sinceStr)
        .order("date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function ManualMetricCard({
  metricType, label, unit, color, icon, targetValue,
}: ManualMetricCardProps) {
  const [periodIdx, setPeriodIdx] = useState(0);
  const [open, setOpen] = useState(false);
  const [dateValue, setDateValue] = useState(todayLocal);
  const [value, setValue] = useState("");

  const { user } = useAuth();
  const queryClient = useQueryClient();
  const period = PERIODS[periodIdx];
  const isMonthly = period.days >= 90;

  const { data: history = [] } = useMetricHistory(metricType, period.days);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed <= 0) throw new Error("Valeur invalide");
      const { error } = await supabase
        .from("health_metrics")
        .upsert(
          { user_id: user.id, date: dateValue, metric_type: metricType, value: parsed, unit },
          { onConflict: "user_id,metric_type,date" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kpi_metric", metricType] });
      toast.success(`${label} enregistré ✓`);
      setValue("");
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Données pour l'affichage
  const latest = history.length > 0 ? history[history.length - 1] : null;
  const displayValue = latest ? Math.round(latest.value * 10) / 10 : "—";

  let delta: number | null = null;
  let deltaLabel = "";
  if (history.length >= 2) {
    const cur = history[history.length - 1].value;
    const prev = history[history.length - 2].value;
    delta = Math.round((cur - prev) * 10) / 10;
    deltaLabel = delta > 0 ? `+${delta}` : `${delta}`;
  }

  const dailyData = history.map((e) => ({
    v: e.value,
    date: e.date,
    label: history.length <= 14
      ? format(new Date(e.date + "T12:00:00"), "d MMM", { locale: fr })
      : format(new Date(e.date + "T12:00:00"), "d/MM", { locale: fr }),
  }));

  const monthlyData = aggregateByMonth(history);
  const chartData = isMonthly ? monthlyData : dailyData;

  // Bornes Y adaptatives
  const vals = chartData.map(d => d.v);
  const minV = vals.length > 0 ? Math.min(...vals) : 0;
  const maxV = vals.length > 0 ? Math.max(...vals, targetValue ?? 0) : (targetValue ?? 10);
  const pad = Math.max((maxV - minV) * 0.15, 1);
  const yMin = Math.floor(minV - pad);
  const yMax = Math.ceil(maxV + pad);
  const maxDigits = String(Math.round(yMax)).length;
  const yWidth = Math.max(28, maxDigits * 7 + 8);

  const tooltipStyle = {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
    fontSize: "11px",
    padding: "6px 10px",
  };
  const axisStyle = { fontSize: 9, fill: "hsl(var(--muted-foreground))" };
  const gradientId = `grad-manual-${metricType}`;

  return (
    <div className="glass-card p-3 flex flex-col gap-2" style={{ minHeight: "220px" }}>
      {/* Header */}
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5 text-muted-foreground text-xs min-w-0">
          <span className="shrink-0">{icon}</span>
          <span className="truncate">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          {delta !== null && delta !== 0 && (
            <div className={`flex items-center gap-0.5 text-[10px] font-medium ${delta > 0 ? "text-primary" : "text-destructive"}`}>
              {delta > 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
              {deltaLabel}
            </div>
          )}
          <Drawer open={open} onOpenChange={setOpen}>
            <DrawerTrigger asChild>
              <button className="h-5 w-5 flex items-center justify-center rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>Ajouter {label}</DrawerTitle>
              </DrawerHeader>
              <div className="px-4 space-y-4">
                <div className="space-y-1">
                  <Label>Date</Label>
                  <Input type="date" value={dateValue} onChange={e => setDateValue(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>{label} ({unit})</Label>
                  <Input
                    type="number"
                    placeholder={`ex: ${metricType === "hrv" ? "65" : "52"}`}
                    value={value}
                    onChange={e => setValue(e.target.value)}
                  />
                </div>
              </div>
              <DrawerFooter>
                <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
                  {mutation.isPending ? "Enregistrement..." : "Enregistrer"}
                </Button>
                <DrawerClose asChild>
                  <Button variant="outline">Annuler</Button>
                </DrawerClose>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        </div>
      </div>

      {/* Valeur */}
      <div>
        <span className="text-2xl font-display font-bold leading-none" style={{ color }}>
          {displayValue}
        </span>
        {displayValue !== "—" && (
          <span className="text-[11px] text-muted-foreground ml-1">{unit}</span>
        )}
      </div>

      {/* Graphique */}
      <div className="flex-1" style={{ minHeight: "110px" }}>
        {chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[11px] text-muted-foreground">
            Aucune donnée
          </div>
        ) : isMonthly ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" tick={false} axisLine={false} tickLine={false} height={0} />
              <YAxis domain={[yMin, yMax]} tick={axisStyle} tickLine={false} axisLine={false} tickCount={4} width={yWidth} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: number) => [`${Math.round(v * 10) / 10} ${unit}`, "Moyenne"]}
                cursor={{ fill: color, fillOpacity: 0.1 }}
              />
              <Bar dataKey="v" fill={color} radius={[4, 4, 0, 0]} maxBarSize={40} fillOpacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" tick={false} axisLine={false} tickLine={false} height={0} />
              <YAxis domain={[yMin, yMax]} tick={axisStyle} tickLine={false} axisLine={false} tickCount={4} width={yWidth} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: number) => [`${Math.round(v * 10) / 10} ${unit}`, label]}
                labelFormatter={(_, payload) => {
                  const d = payload?.[0]?.payload?.date;
                  return d ? format(new Date(d + "T12:00:00"), "d MMMM yyyy", { locale: fr }) : "";
                }}
                cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: "3 3" }}
              />
              <Area
                type="monotone"
                dataKey="v"
                stroke={color}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                dot={history.length <= 30 ? { fill: color, r: history.length <= 7 ? 3 : 2, strokeWidth: 0 } : false}
                activeDot={{ r: 4, fill: color, strokeWidth: 0 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Sélecteur période */}
      <div className="flex gap-0.5">
        {PERIODS.map((p, idx) => (
          <button
            key={p.label}
            onClick={() => setPeriodIdx(idx)}
            className={`text-[9px] px-1.5 py-0.5 rounded-sm font-medium transition-colors ${
              idx === periodIdx ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
