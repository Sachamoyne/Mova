ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS active_phase text DEFAULT 'lean_bulk';

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS phase_started_at timestamptz DEFAULT now();
