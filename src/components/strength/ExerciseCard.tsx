import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { TrendingUp, TrendingDown, Dumbbell, X } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, YAxis, XAxis, Tooltip, CartesianGrid } from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ExerciseTrackingCard } from "@/hooks/useExerciseStats";
import UpdatePRDrawer from "./UpdatePRDrawer";

const ACCENT = "#8B5CF6";

interface Props {
  card: ExerciseTrackingCard;
}

export default function ExerciseCard({ card }: Props) {
  const [detailOpen, setDetailOpen] = useState(false);

  return (
    <>
      <div
        className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3 cursor-pointer hover:border-strength/40 transition-colors"
        onClick={() => setDetailOpen(true)}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Dumbbell className="h-4 w-4 text-strength" />
            <span className="text-sm font-medium text-foreground">{card.exercise_name}</span>
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <UpdatePRDrawer exerciseName={card.exercise_name} />
          </div>
        </div>

        {/* Weight + progression */}
        <div className="flex items-end justify-between">
          <div>
            <span className="text-2xl font-display font-bold text-foreground">{card.latest_weight} kg</span>
            {card.progression_pct !== null && card.progression_pct !== 0 && (
              <span className={`ml-2 text-xs font-medium inline-flex items-center gap-0.5 ${card.progression_pct > 0 ? "text-primary" : "text-destructive"}`}>
                {card.progression_pct > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {card.progression_pct > 0 ? "+" : ""}{card.progression_pct}%
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {format(new Date(card.latest_date), "d MMM", { locale: fr })}
          </span>
        </div>

        {/* Sparkline */}
        {card.sparkline.length > 1 && (
          <div className="h-12 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={card.sparkline}>
                <Line
                  type="monotone"
                  dataKey="weight"
                  stroke={ACCENT}
                  strokeWidth={2}
                  dot={false}
                />
                <YAxis hide domain={["dataMin - 2", "dataMax + 2"]} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="bg-card border-border max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-foreground flex items-center gap-2">
              <Dumbbell className="h-5 w-5 text-strength" />
              {card.exercise_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-3xl font-display font-bold text-foreground">{card.latest_weight} kg</p>
                <p className="text-xs text-muted-foreground mt-1">Dernière séance — {format(new Date(card.latest_date), "d MMMM yyyy", { locale: fr })}</p>
              </div>
              {card.progression_pct !== null && card.progression_pct !== 0 && (
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${card.progression_pct > 0 ? "bg-primary/20 text-primary" : "bg-destructive/20 text-destructive"}`}>
                  {card.progression_pct > 0 ? "+" : ""}{card.progression_pct}% vs précédente
                </div>
              )}
            </div>

            {card.history.length > 1 && (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={card.history}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => format(new Date(v), "dd/MM", { locale: fr })}
                    />
                    <YAxis
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      domain={["dataMin - 5", "dataMax + 5"]}
                      unit=" kg"
                    />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        color: "hsl(var(--foreground))",
                      }}
                      labelFormatter={(v) => format(new Date(v as string), "d MMMM yyyy", { locale: fr })}
                      formatter={(value: number) => [`${value} kg`, "Poids"]}
                    />
                    <Line type="monotone" dataKey="weight" stroke={ACCENT} strokeWidth={2.5} dot={{ fill: ACCENT, r: 3 }} activeDot={{ r: 5, fill: ACCENT }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
