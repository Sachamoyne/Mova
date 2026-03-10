import { TrendingUp, TrendingDown } from "lucide-react";
import { useHrvTrend } from "@/hooks/useHealthData";
import { Badge } from "@/components/ui/badge";

export function HrvTrendBadge() {
  const { data: trend } = useHrvTrend();

  if (!trend) return null;

  return (
    <Badge
      variant="outline"
      className={`gap-1 text-xs font-medium ${
        trend.improving
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-destructive/40 bg-destructive/10 text-destructive"
      }`}
    >
      {trend.improving ? (
        <TrendingUp className="h-3 w-3" />
      ) : (
        <TrendingDown className="h-3 w-3" />
      )}
      {trend.improving ? "Condition en progrès" : "Condition en baisse"}
      <span className="text-muted-foreground ml-1">
        ({trend.avg7} vs {trend.avg30} ms)
      </span>
    </Badge>
  );
}
