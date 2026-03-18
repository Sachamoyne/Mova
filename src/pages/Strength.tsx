import { useActivities } from "@/hooks/useHealthData";
import { useLatestBodyMetric, useBodyMetrics } from "@/hooks/useBodyMetrics";
import { useExerciseTrackingCards } from "@/hooks/useExerciseStats";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Dumbbell, Scale, TrendingUp, TrendingDown, Minus, Timer, Flame, Activity } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import ExerciseCard from "@/components/strength/ExerciseCard";

export default function Strength() {
  const { data: sessions = [] } = useActivities("strength");
  const { data: latestMetrics = [] } = useLatestBodyMetric();
  const { data: bodyHistory = [] } = useBodyMetrics(30);
  const exerciseCards = useExerciseTrackingCards();

  const latest = latestMetrics[0];
  const previous = latestMetrics[1];

  const weightDelta = latest && previous && latest.weight_kg && previous.weight_kg
    ? (latest.weight_kg - previous.weight_kg).toFixed(1) : null;
  const fatDelta = latest && previous && latest.body_fat_pc && previous.body_fat_pc
    ? (latest.body_fat_pc - previous.body_fat_pc).toFixed(1) : null;
  const muscleDelta = latest && previous && latest.muscle_mass_kg && previous.muscle_mass_kg
    ? (latest.muscle_mass_kg - previous.muscle_mass_kg).toFixed(1) : null;

  const chartData = bodyHistory
    .filter((m) => m.weight_kg || m.muscle_mass_kg)
    .map((m) => ({
      date: m.date, // ISO YYYY-MM-DD (formatting handled by XAxis tickFormatter)
      Poids: m.weight_kg,
      Muscle: m.muscle_mass_kg,
    }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-display font-bold text-foreground">Musculation</h1>
      </div>

      {/* Body Composition Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          label="Poids"
          value={latest?.weight_kg ? `${latest.weight_kg} kg` : "—"}
          delta={weightDelta}
          icon={<Scale className="h-5 w-5 text-strength" />}
        />
        <MetricCard
          label="Masse Grasse"
          value={latest?.body_fat_pc ? `${latest.body_fat_pc}%` : "—"}
          delta={fatDelta}
          invertDelta
          icon={<TrendingDown className="h-5 w-5 text-destructive" />}
        />
        <MetricCard
          label="Masse Musculaire"
          value={latest?.muscle_mass_kg ? `${latest.muscle_mass_kg} kg` : "—"}
          delta={muscleDelta}
          icon={<Dumbbell className="h-5 w-5 text-strength" />}
        />
      </div>

      {/* Body Composition Chart */}
      {chartData.length > 1 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-display font-semibold text-foreground mb-3">Évolution 30 jours</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="date"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => format(new Date(v), "dd/MM", { locale: fr })}
              />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} domain={["dataMin - 1", "dataMax + 1"]} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} />
              <Line type="monotone" dataKey="Poids" stroke="hsl(var(--strength))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Muscle" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Dynamic Exercise Tracking */}
      <div>
        <h2 className="text-lg font-display font-semibold text-foreground mb-3 flex items-center gap-2">
          <Activity className="h-5 w-5 text-strength" />
          Suivi de Progression
        </h2>
        {exerciseCards.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {exerciseCards.map((card) => (
              <ExerciseCard key={card.exercise_name} card={card} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center">
            <Dumbbell className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Aucun exercice enregistré pour l’instant. Les séances de musculation seront importées automatiquement depuis Apple Health dès qu’elles apparaissent dans l’app Santé.
            </p>
          </div>
        )}
      </div>

      {/* Recent Sessions */}
      <div>
        <h2 className="text-lg font-display font-semibold text-foreground mb-3">Séances récentes</h2>
        <div className="space-y-2">
          {sessions.slice(0, 10).map((s) => (
            <div key={s.id} className="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-strength/20 flex items-center justify-center">
                <Dumbbell className="h-5 w-5 text-strength" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">
                  {format(new Date(s.start_time), "EEEE d MMMM yyyy", { locale: fr })}
                </p>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Timer className="h-3.5 w-3.5" />
                  {Math.round(s.duration_sec / 60)} min
                </span>
                <span className="flex items-center gap-1">
                  <Flame className="h-3.5 w-3.5" />
                  {s.calories ?? "—"} kcal
                </span>
              </div>
            </div>
          ))}
          {sessions.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Aucune séance enregistrée</p>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, delta, invertDelta, icon }: {
  label: string; value: string; delta: string | null; invertDelta?: boolean; icon: React.ReactNode;
}) {
  const isPositive = delta ? parseFloat(delta) > 0 : null;
  const isGood = invertDelta ? !isPositive : isPositive;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-display font-bold text-foreground">{value}</p>
      {delta && (
        <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${isGood ? "text-primary" : "text-destructive"}`}>
          {isPositive ? <TrendingUp className="h-3 w-3" /> : isPositive === false ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
          {parseFloat(delta) > 0 ? "+" : ""}{delta} vs précédent
        </div>
      )}
    </div>
  );
}
