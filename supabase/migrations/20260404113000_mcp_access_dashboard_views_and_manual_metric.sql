-- Ensure metric_type supports dashboard/manual metrics used by MCP workflows
ALTER TYPE public.metric_type ADD VALUE IF NOT EXISTS 'steps';
ALTER TYPE public.metric_type ADD VALUE IF NOT EXISTS 'calories_total';
ALTER TYPE public.metric_type ADD VALUE IF NOT EXISTS 'protein';
ALTER TYPE public.metric_type ADD VALUE IF NOT EXISTS 'carbs';
ALTER TYPE public.metric_type ADD VALUE IF NOT EXISTS 'fat';
ALTER TYPE public.metric_type ADD VALUE IF NOT EXISTS 'calorie_balance';
ALTER TYPE public.metric_type ADD VALUE IF NOT EXISTS 'weight';
ALTER TYPE public.metric_type ADD VALUE IF NOT EXISTS 'body_fat';

-- Create nutrition_logs table if missing (needed for MCP dashboard aggregation)
CREATE TABLE IF NOT EXISTS public.nutrition_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  meal_type text,
  calories_kcal numeric(10,2) NOT NULL DEFAULT 0,
  protein_g numeric(10,2) NOT NULL DEFAULT 0,
  carbs_g numeric(10,2) NOT NULL DEFAULT 0,
  fat_g numeric(10,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS nutrition_logs_user_date_idx
  ON public.nutrition_logs (user_id, date DESC);

ALTER TABLE public.nutrition_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'nutrition_logs' AND policyname = 'Users can manage own nutrition logs'
  ) THEN
    CREATE POLICY "Users can manage own nutrition logs"
      ON public.nutrition_logs
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

-- Explicit service_role policies for MCP access documentation/compatibility
DO $$
BEGIN
  IF to_regclass('public.health_metrics') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'health_metrics' AND policyname = 'Service role can manage health metrics'
    )
  THEN
    CREATE POLICY "Service role can manage health metrics"
      ON public.health_metrics
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  IF to_regclass('public.nutrition_logs') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'nutrition_logs' AND policyname = 'Service role can manage nutrition logs'
    )
  THEN
    CREATE POLICY "Service role can manage nutrition logs"
      ON public.nutrition_logs
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  IF to_regclass('public.sleep_logs') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'sleep_logs' AND policyname = 'Service role can manage sleep logs'
    )
  THEN
    CREATE POLICY "Service role can manage sleep logs"
      ON public.sleep_logs
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  IF to_regclass('public.journal_entries') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'journal_entries' AND policyname = 'Service role can manage journal entries'
    )
  THEN
    CREATE POLICY "Service role can manage journal entries"
      ON public.journal_entries
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  IF to_regclass('public.user_profile') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'user_profile' AND policyname = 'Service role can manage user profile'
    )
  THEN
    CREATE POLICY "Service role can manage user profile"
      ON public.user_profile
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  -- workout_logs/exercise_logs equivalents in current schema
  IF to_regclass('public.workout_sessions') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'workout_sessions' AND policyname = 'Service role can manage workout sessions'
    )
  THEN
    CREATE POLICY "Service role can manage workout sessions"
      ON public.workout_sessions
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  IF to_regclass('public.workout_sets') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'workout_sets' AND policyname = 'Service role can manage workout sets'
    )
  THEN
    CREATE POLICY "Service role can manage workout sets"
      ON public.workout_sets
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;

-- Compatibility aliases for MCP naming (workout_logs / exercise_logs)
CREATE OR REPLACE VIEW public.workout_logs AS
SELECT
  id,
  user_id,
  activity_id,
  date,
  name,
  notes,
  created_at
FROM public.workout_sessions;

CREATE OR REPLACE VIEW public.exercise_logs AS
SELECT
  id,
  user_id,
  session_id,
  exercise_name,
  set_number,
  reps,
  weight_kg,
  notes,
  created_at
FROM public.workout_sets;

-- Dashboard summary view used by MCP read operations
CREATE OR REPLACE VIEW public.mova_dashboard_summary AS
WITH users AS (
  SELECT user_id FROM public.user_profile
  UNION
  SELECT user_id FROM public.profiles
  UNION
  SELECT user_id FROM public.health_metrics
  UNION
  SELECT user_id FROM public.sleep_logs
  UNION
  SELECT user_id FROM public.nutrition_logs
)
SELECT
  u.user_id,
  weight.latest_weight,
  hrv.latest_hrv,
  body_fat.latest_body_fat,
  nutrition.calories_today,
  nutrition.protein_today,
  sleep.last_night_sleep_hours,
  steps.steps_today,
  COALESCE(profiles.active_phase, user_profile.activity_level) AS active_training_phase
FROM users u
LEFT JOIN public.user_profile user_profile ON user_profile.user_id = u.user_id
LEFT JOIN public.profiles profiles ON profiles.user_id = u.user_id
LEFT JOIN LATERAL (
  SELECT hm.value AS latest_weight
  FROM public.health_metrics hm
  WHERE hm.user_id = u.user_id
    AND hm.metric_type = 'weight'::public.metric_type
  ORDER BY hm.date DESC, hm.created_at DESC
  LIMIT 1
) weight ON true
LEFT JOIN LATERAL (
  SELECT hm.value AS latest_hrv
  FROM public.health_metrics hm
  WHERE hm.user_id = u.user_id
    AND hm.metric_type = 'hrv'::public.metric_type
  ORDER BY hm.date DESC, hm.created_at DESC
  LIMIT 1
) hrv ON true
LEFT JOIN LATERAL (
  SELECT hm.value AS latest_body_fat
  FROM public.health_metrics hm
  WHERE hm.user_id = u.user_id
    AND hm.metric_type = 'body_fat'::public.metric_type
  ORDER BY hm.date DESC, hm.created_at DESC
  LIMIT 1
) body_fat ON true
LEFT JOIN LATERAL (
  SELECT
    COALESCE(SUM(nl.calories_kcal), 0)::numeric(10,2) AS calories_today,
    COALESCE(SUM(nl.protein_g), 0)::numeric(10,2) AS protein_today
  FROM public.nutrition_logs nl
  WHERE nl.user_id = u.user_id
    AND nl.date = CURRENT_DATE
) nutrition ON true
LEFT JOIN LATERAL (
  SELECT sl.duration_hours AS last_night_sleep_hours
  FROM public.sleep_logs sl
  WHERE sl.user_id = u.user_id
    AND sl.date <= CURRENT_DATE
  ORDER BY sl.date DESC, sl.updated_at DESC
  LIMIT 1
) sleep ON true
LEFT JOIN LATERAL (
  SELECT COALESCE(MAX(hm.value), 0) AS steps_today
  FROM public.health_metrics hm
  WHERE hm.user_id = u.user_id
    AND hm.metric_type = 'steps'::public.metric_type
    AND hm.date = CURRENT_DATE
) steps ON true;

COMMENT ON VIEW public.mova_dashboard_summary IS
'MCP-friendly per-user dashboard aggregate: weight, HRV, body fat, today nutrition, last sleep, today steps, active phase.';

-- Recent workouts view (10 latest sessions per user with embedded exercises)
CREATE OR REPLACE VIEW public.mova_recent_workouts AS
WITH ranked_sessions AS (
  SELECT
    ws.*,
    ROW_NUMBER() OVER (
      PARTITION BY ws.user_id
      ORDER BY ws.date DESC, ws.created_at DESC
    ) AS rn
  FROM public.workout_sessions ws
)
SELECT
  rs.user_id,
  rs.id AS session_id,
  rs.activity_id,
  rs.date,
  rs.name,
  rs.notes,
  rs.created_at,
  COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'set_id', wset.id,
        'exercise_name', wset.exercise_name,
        'set_number', wset.set_number,
        'reps', wset.reps,
        'weight_kg', wset.weight_kg,
        'notes', wset.notes,
        'created_at', wset.created_at
      )
      ORDER BY wset.exercise_name, wset.set_number
    ) FILTER (WHERE wset.id IS NOT NULL),
    '[]'::jsonb
  ) AS exercises
FROM ranked_sessions rs
LEFT JOIN public.workout_sets wset
  ON wset.session_id = rs.id
WHERE rs.rn <= 10
GROUP BY rs.user_id, rs.id, rs.activity_id, rs.date, rs.name, rs.notes, rs.created_at
ORDER BY rs.user_id, rs.date DESC, rs.created_at DESC;

COMMENT ON VIEW public.mova_recent_workouts IS
'MCP-friendly latest 10 workout sessions per user with exercises as JSON array.';

GRANT SELECT ON public.mova_dashboard_summary TO authenticated, service_role;
GRANT SELECT ON public.mova_recent_workouts TO authenticated, service_role;
GRANT SELECT ON public.workout_logs TO authenticated, service_role;
GRANT SELECT ON public.exercise_logs TO authenticated, service_role;

-- Ensure upsert target is valid for ON CONFLICT
WITH ranked_metrics AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, metric_type, date
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM public.health_metrics
)
DELETE FROM public.health_metrics hm
USING ranked_metrics rm
WHERE hm.id = rm.id
  AND rm.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS health_metrics_user_metric_date_uniq
  ON public.health_metrics (user_id, metric_type, date);

-- Manual metric upsert function for MCP write operations
CREATE OR REPLACE FUNCTION public.log_manual_metric(
  p_user_id UUID,
  p_metric_type TEXT,
  p_value NUMERIC,
  p_date DATE DEFAULT CURRENT_DATE
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_metric_type public.metric_type;
  v_unit text;
BEGIN
  v_metric_type := p_metric_type::public.metric_type;

  v_unit := CASE p_metric_type
    WHEN 'weight' THEN 'kg'
    WHEN 'body_fat' THEN 'percent'
    WHEN 'hrv' THEN 'ms'
    WHEN 'rhr' THEN 'bpm'
    WHEN 'steps' THEN 'count'
    WHEN 'calories_total' THEN 'kcal'
    WHEN 'protein' THEN 'g'
    WHEN 'carbs' THEN 'g'
    WHEN 'fat' THEN 'g'
    WHEN 'sleep_hours' THEN 'h'
    WHEN 'sleep_score' THEN 'score'
    WHEN 'vo2max' THEN 'ml/kg/min'
    WHEN 'body_battery' THEN 'score'
    WHEN 'calorie_balance' THEN 'kcal'
    ELSE 'unit'
  END;

  INSERT INTO public.health_metrics (user_id, metric_type, value, date, unit)
  VALUES (p_user_id, v_metric_type, p_value::double precision, p_date, v_unit)
  ON CONFLICT (user_id, metric_type, date)
  DO UPDATE SET
    value = EXCLUDED.value,
    unit = EXCLUDED.unit;
END;
$$;

COMMENT ON FUNCTION public.log_manual_metric(uuid, text, numeric, date) IS
'Insert or upsert one manual health metric for a user/date. Used by MCP write flows.';

GRANT EXECUTE ON FUNCTION public.log_manual_metric(uuid, text, numeric, date)
TO authenticated, service_role;
