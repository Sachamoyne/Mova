import type { QueryClient, QueryKey } from "@tanstack/react-query";

const DASHBOARD_SYNC_KEYS: QueryKey[] = [
  ["health_metrics"],
  ["latest_metrics"],
  ["activities"],
  ["weekly_summary"],
  ["body_metrics"],
  ["body_metrics_latest"],
  ["sync_status"],
  ["latest_nutrition"],
  ["today_workouts"],
  ["calorie_balance"],
  ["kpi_metric"],
  ["kpi_body_metric"],
  ["sleep_history"],
  ["sleep_logs"],
  ["latest_sleep"],
  ["activity_heatmap"],
  ["monthly_heatmap"],
];

export async function refreshDashboardAfterSync(queryClient: QueryClient) {
  await Promise.all(
    DASHBOARD_SYNC_KEYS.map((queryKey) =>
      queryClient.invalidateQueries({ queryKey, refetchType: "active" }),
    ),
  );

  await Promise.all(
    DASHBOARD_SYNC_KEYS.map((queryKey) =>
      queryClient.refetchQueries({ queryKey, type: "active" }),
    ),
  );
}
