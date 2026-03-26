import { useEffect, useState } from "react";

const STORAGE_PREFIX = "perf_chart_period_";

interface PeriodLike {
  label: string;
}

export function usePersistedChartPeriod(
  keySuffix: string,
  periods: readonly PeriodLike[],
  defaultIdx = 0,
) {
  const storageKey = `${STORAGE_PREFIX}${keySuffix}`;

  const [periodIdx, setPeriodIdx] = useState(() => {
    if (typeof window === "undefined") return defaultIdx;
    const savedPeriod = window.localStorage.getItem(storageKey);
    if (!savedPeriod) return defaultIdx;

    const savedIdx = periods.findIndex((p) => p.label === savedPeriod);
    return savedIdx >= 0 ? savedIdx : defaultIdx;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const periodLabel = periods[periodIdx]?.label;
    if (!periodLabel) return;
    window.localStorage.setItem(storageKey, periodLabel);
  }, [periodIdx, periods, storageKey]);

  return [periodIdx, setPeriodIdx] as const;
}
