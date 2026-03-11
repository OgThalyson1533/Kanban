-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║         LIFE CONTROL — Supabase Schema v2.0                            ║
-- ║  Execute completo no SQL Editor do Supabase (uma única vez)            ║
-- ║  Compatível com migrations incrementais — usa IF NOT EXISTS / DO $$    ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ============================================================================
-- 0. EXTENSÕES
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================================
-- 1. TIPOS CUSTOMIZADOS
-- ============================================================================
DO $$ BEGIN
  CREATE TYPE task_status AS ENUM (
    'backlog','next','doing','blocked','review','done'
  );
EXCEPTION WHEN duplicate_object THEN
  -- Adiciona valores novos se já existia como ENUM menor
  BEGIN
    ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'next';
    ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'blocked';
    ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'review';
  EXCEPTION WHEN others THEN NULL;
  END;
END $$;

DO $$ BEGIN
  CREATE TYPE task_priority AS ENUM ('low','med','high');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE finance_type AS ENUM ('income','expense');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE goal_color AS ENUM ('plasma','gold','mint','ember');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE xp_source AS ENUM (
    'task_done','habit_check','habit_milestone',
    'goal_progress','goal_complete','manual','relapse_penalty'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- 2. TABELAS
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 2.1  profiles
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID          UNIQUE NOT NULL
                                  REFERENCES auth.users(id) ON DELETE CASCADE,
  username        TEXT          NOT NULL DEFAULT 'Comandante',
  avatar_url      TEXT,

  xp              INTEGER       NOT NULL DEFAULT 0   CHECK (xp >= 0),
  coins           INTEGER       NOT NULL DEFAULT 0   CHECK (coins >= 0),
  level           INTEGER       NOT NULL DEFAULT 1   CHECK (level >= 1),
  xp_to_next      INTEGER       NOT NULL DEFAULT 500,

  theme           TEXT          NOT NULL DEFAULT 'dark'
                                  CHECK (theme IN ('dark','light')),
  timezone        TEXT          NOT NULL DEFAULT 'America/Sao_Paulo',

  tasks_done      INTEGER       NOT NULL DEFAULT 0,
  habits_checked  INTEGER       NOT NULL DEFAULT 0,
  streak_max      INTEGER       NOT NULL DEFAULT 0,

  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2.2  tasks  — schema completo com todos os campos do frontend
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tasks (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Conteúdo principal
  title               TEXT          NOT NULL CHECK (char_length(title) BETWEEN 1 AND 500),
  description         TEXT,
  status              task_status   NOT NULL DEFAULT 'backlog',
  priority            task_priority NOT NULL DEFAULT 'med',
  complexity          TEXT          NOT NULL DEFAULT 'medium'
                                      CHECK (complexity IN ('low','medium','high')),
  tags                TEXT[]        NOT NULL DEFAULT '{}',
  sort_order          INTEGER       NOT NULL DEFAULT 0,

  -- Tempo e planejamento
  estimated_minutes   INTEGER       CHECK (estimated_minutes > 0),
  story_points        INTEGER       CHECK (story_points > 0),
  sprint              TEXT,
  assignee            TEXT,

  -- Timestamps de fluxo (todos TIMESTAMPTZ para precisão de fuso)
  deadline            TIMESTAMPTZ,
  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,

  -- Metadados extras
  block_reason        TEXT,
  depends_on          TEXT,
  checklist           JSONB         NOT NULL DEFAULT '[]'::jsonb,

  -- Audit
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Adiciona colunas faltantes em banco existente (idempotente)
DO $$ BEGIN
  ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS complexity          TEXT NOT NULL DEFAULT 'medium';
  ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS estimated_minutes   INTEGER;
  ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS story_points        INTEGER;
  ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS sprint              TEXT;
  ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS assignee            TEXT;
  ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS deadline            TIMESTAMPTZ;
  ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS started_at          TIMESTAMPTZ;
  ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS block_reason        TEXT;
  ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS depends_on          TEXT;
  ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS checklist           JSONB NOT NULL DEFAULT '[]'::jsonb;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Migra coluna due_date → deadline se ainda não foi migrada
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'due_date'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'deadline'
  ) THEN
    ALTER TABLE public.tasks RENAME COLUMN due_date TO deadline;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2.3  time_logs — registro granular de tempo por tarefa
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.time_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id     UUID        NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  minutes     INTEGER     NOT NULL CHECK (minutes > 0),
  note        TEXT,
  logged_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2.4  habit_tracker
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.habit_tracker (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT          NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  icon            TEXT          NOT NULL DEFAULT '⬡',
  description     TEXT,
  streak          INTEGER       NOT NULL DEFAULT 0 CHECK (streak >= 0),
  streak_max      INTEGER       NOT NULL DEFAULT 0 CHECK (streak_max >= 0),
  last_check      DATE,
  quit_mode       BOOLEAN       NOT NULL DEFAULT FALSE,
  quit_date       DATE,
  relapse_count   INTEGER       NOT NULL DEFAULT 0 CHECK (relapse_count >= 0),
  archived        BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2.5  habit_logs
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.habit_logs (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_id        UUID          NOT NULL
                                  REFERENCES public.habit_tracker(id) ON DELETE CASCADE,
  event_type      TEXT          NOT NULL
                                  CHECK (event_type IN ('check','relapse','create','archive')),
  streak_at       INTEGER       NOT NULL DEFAULT 0,
  note            TEXT,
  logged_at       TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2.6  finances
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.finances (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description     TEXT          NOT NULL CHECK (char_length(description) BETWEEN 1 AND 300),
  amount          NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  type            finance_type  NOT NULL,
  category        TEXT          NOT NULL DEFAULT 'Geral',
  tags            TEXT[]        NOT NULL DEFAULT '{}',
  account         TEXT,
  cost_center     TEXT,
  recurrence      TEXT          DEFAULT 'Única',
  is_recurring    BOOLEAN       NOT NULL DEFAULT FALSE,
  recur_interval  TEXT          CHECK (recur_interval IN ('daily','weekly','monthly','yearly')),
  reference_date  DATE          NOT NULL DEFAULT CURRENT_DATE,
  note            TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Adiciona colunas faltantes (idempotente)
DO $$ BEGIN
  ALTER TABLE public.finances ADD COLUMN IF NOT EXISTS account     TEXT;
  ALTER TABLE public.finances ADD COLUMN IF NOT EXISTS cost_center TEXT;
  ALTER TABLE public.finances ADD COLUMN IF NOT EXISTS recurrence  TEXT DEFAULT 'Única';
EXCEPTION WHEN others THEN NULL;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2.7  goals
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.goals (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           TEXT          NOT NULL CHECK (char_length(title) BETWEEN 1 AND 300),
  description     TEXT,
  target          NUMERIC(14,2) NOT NULL CHECK (target > 0),
  current         NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (current >= 0),
  unit            TEXT          NOT NULL DEFAULT 'pts',
  color           goal_color    NOT NULL DEFAULT 'plasma',
  deadline        DATE,
  completed_at    TIMESTAMPTZ,
  archived        BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT current_not_exceed_target CHECK (current <= target * 1.001)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2.8  goal_logs
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.goal_logs (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id     UUID          NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  delta       NUMERIC(14,2) NOT NULL,
  value_at    NUMERIC(14,2) NOT NULL,
  note        TEXT,
  logged_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2.9  crypto_positions
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.crypto_positions (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol          TEXT          NOT NULL CHECK (char_length(symbol) BETWEEN 1 AND 10),
  name            TEXT          NOT NULL DEFAULT '',
  quantity        NUMERIC(28,8) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  avg_cost_brl    NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (avg_cost_brl >= 0),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (user_id, symbol)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2.10  schedule_events
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.schedule_events (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           TEXT          NOT NULL CHECK (char_length(title) BETWEEN 1 AND 300),
  description     TEXT,
  color_type      TEXT          NOT NULL DEFAULT 'plasma'
                                  CHECK (color_type IN ('plasma','gold','mint','ember')),
  event_date      DATE          NOT NULL,
  start_time      TIME,
  end_time        TIME,
  all_day         BOOLEAN       NOT NULL DEFAULT FALSE,
  is_recurring    BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2.11  xp_log
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.xp_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source      xp_source   NOT NULL,
  xp_delta    INTEGER     NOT NULL,
  coin_delta  INTEGER     NOT NULL DEFAULT 0,
  xp_after    INTEGER     NOT NULL,
  ref_id      UUID,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 3. ÍNDICES
-- ============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_user_id      ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_status            ON public.tasks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_user_deadline          ON public.tasks(user_id, deadline) WHERE deadline IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_started                ON public.tasks(user_id, started_at) WHERE started_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_completed              ON public.tasks(user_id, completed_at) WHERE completed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_title_trgm             ON public.tasks USING gin(title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_habits_user_active           ON public.habit_tracker(user_id, archived) WHERE archived = FALSE;
CREATE INDEX IF NOT EXISTS idx_habits_user_quit             ON public.habit_tracker(user_id, quit_mode);
CREATE INDEX IF NOT EXISTS idx_habit_logs_habit             ON public.habit_logs(habit_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_habit_logs_user              ON public.habit_logs(user_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_finances_user_type           ON public.finances(user_id, type);
CREATE INDEX IF NOT EXISTS idx_finances_period              ON public.finances(user_id, reference_date DESC);
CREATE INDEX IF NOT EXISTS idx_finances_category            ON public.finances(user_id, category);
CREATE INDEX IF NOT EXISTS idx_goals_user_active            ON public.goals(user_id, archived, deadline) WHERE archived = FALSE;
CREATE INDEX IF NOT EXISTS idx_goal_logs_goal               ON public.goal_logs(goal_id, logged_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_crypto_user_symbol    ON public.crypto_positions(user_id, symbol);
CREATE INDEX IF NOT EXISTS idx_schedule_user_date           ON public.schedule_events(user_id, event_date);
CREATE INDEX IF NOT EXISTS idx_xp_log_user                  ON public.xp_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_time_logs_task               ON public.time_logs(task_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_time_logs_user               ON public.time_logs(user_id, logged_at DESC);

-- ============================================================================
-- 4. FUNÇÕES
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 4.1  set_updated_at
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4.2  handle_new_user — cria profile no signup automaticamente
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      split_part(NEW.email, '@', 1),
      'Comandante'
    )
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4.3  award_xp
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.award_xp(
  p_user_id  UUID,
  p_xp       INTEGER,
  p_coins    INTEGER   DEFAULT 0,
  p_source   xp_source DEFAULT 'manual',
  p_ref_id   UUID      DEFAULT NULL,
  p_note     TEXT      DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v            public.profiles%ROWTYPE;
  new_xp       INTEGER;
  new_coins    INTEGER;
  new_level    INTEGER;
  new_xp_next  INTEGER;
  leveled_up   BOOLEAN := FALSE;
BEGIN
  SELECT * INTO v FROM public.profiles
  WHERE user_id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found: %', p_user_id;
  END IF;

  new_xp    := v.xp    + p_xp;
  new_coins := v.coins + p_coins;
  new_level := FLOOR(new_xp::FLOAT / 500)::INTEGER + 1;
  new_xp_next := (new_level * 500) - new_xp;

  IF new_level > v.level THEN leveled_up := TRUE; END IF;

  UPDATE public.profiles SET
    xp         = new_xp,
    coins      = new_coins,
    level      = new_level,
    xp_to_next = new_xp_next,
    updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO public.xp_log
    (user_id, source, xp_delta, coin_delta, xp_after, ref_id, note)
  VALUES
    (p_user_id, p_source, p_xp, p_coins, new_xp, p_ref_id, p_note);

  RETURN jsonb_build_object(
    'xp',         new_xp,
    'coins',      new_coins,
    'level',      new_level,
    'leveled_up', leveled_up,
    'xp_to_next', new_xp_next
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4.4  check_habit
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_habit(
  p_user_id  UUID,
  p_habit_id UUID,
  p_note     TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  h             public.habit_tracker%ROWTYPE;
  today         DATE    := CURRENT_DATE;
  new_streak    INTEGER;
  xp_amt        INTEGER := 30;
  coin_amt      INTEGER := 5;
  is_milestone  BOOLEAN := FALSE;
  xp_result     JSONB;
  src           xp_source;
BEGIN
  SELECT * INTO h FROM public.habit_tracker
  WHERE id = p_habit_id AND user_id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'habit_not_found: %', p_habit_id;
  END IF;

  IF h.last_check = today THEN
    RETURN jsonb_build_object('error','already_checked','streak', h.streak);
  END IF;

  IF h.last_check = today - INTERVAL '1 day' THEN
    new_streak := h.streak + 1;
  ELSE
    new_streak := 1;
  END IF;

  src := 'habit_check';
  IF new_streak % 100 = 0 THEN
    xp_amt := 800; coin_amt := 80; is_milestone := TRUE; src := 'habit_milestone';
  ELSIF new_streak % 30 = 0 THEN
    xp_amt := 400; coin_amt := 40; is_milestone := TRUE; src := 'habit_milestone';
  ELSIF new_streak % 7 = 0 THEN
    xp_amt := 200; coin_amt := 20; is_milestone := TRUE; src := 'habit_milestone';
  END IF;

  UPDATE public.habit_tracker SET
    streak     = new_streak,
    streak_max = GREATEST(streak_max, new_streak),
    last_check = today,
    updated_at = now()
  WHERE id = p_habit_id;

  UPDATE public.profiles SET
    streak_max     = GREATEST(streak_max, new_streak),
    habits_checked = habits_checked + 1,
    updated_at     = now()
  WHERE user_id = p_user_id;

  INSERT INTO public.habit_logs (user_id, habit_id, event_type, streak_at, note)
  VALUES (p_user_id, p_habit_id, 'check', new_streak, p_note);

  SELECT public.award_xp(p_user_id, xp_amt, coin_amt, src, p_habit_id, p_note)
  INTO xp_result;

  RETURN jsonb_build_object(
    'streak',       new_streak,
    'milestone',    is_milestone,
    'xp_earned',    xp_amt,
    'coins_earned', coin_amt,
    'profile',      xp_result
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4.5  log_relapse
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_relapse(
  p_user_id  UUID,
  p_habit_id UUID,
  p_note     TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  h public.habit_tracker%ROWTYPE;
BEGIN
  SELECT * INTO h FROM public.habit_tracker
  WHERE id = p_habit_id AND user_id = p_user_id AND quit_mode = TRUE FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'quit_habit_not_found: %', p_habit_id;
  END IF;

  UPDATE public.habit_tracker SET
    quit_date     = CURRENT_DATE,
    streak        = 0,
    relapse_count = relapse_count + 1,
    updated_at    = now()
  WHERE id = p_habit_id;

  INSERT INTO public.habit_logs (user_id, habit_id, event_type, streak_at, note)
  VALUES (p_user_id, p_habit_id, 'relapse', h.streak, p_note);

  RETURN jsonb_build_object(
    'relapse_count',   h.relapse_count + 1,
    'previous_streak', h.streak
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4.6  complete_task — marca done + timestamps + XP
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.complete_task(
  p_user_id UUID,
  p_task_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t        public.tasks%ROWTYPE;
  xp_amt   INTEGER;
  coin_amt INTEGER;
  result   JSONB;
BEGIN
  SELECT * INTO t FROM public.tasks
  WHERE id = p_task_id AND user_id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'task_not_found: %', p_task_id;
  END IF;

  xp_amt   := CASE t.priority WHEN 'high' THEN 100 WHEN 'med' THEN 50 ELSE 25 END;
  coin_amt := CASE t.priority WHEN 'high' THEN 15  WHEN 'med' THEN 8  ELSE 3  END;

  -- Bônus por complexidade
  xp_amt := xp_amt + CASE t.complexity
    WHEN 'high'   THEN 50
    WHEN 'medium' THEN 20
    ELSE 5
  END;

  UPDATE public.tasks SET
    status       = 'done',
    completed_at = now(),
    updated_at   = now()
  WHERE id = p_task_id;

  UPDATE public.profiles SET
    tasks_done = tasks_done + 1,
    updated_at = now()
  WHERE user_id = p_user_id;

  SELECT public.award_xp(p_user_id, xp_amt, coin_amt, 'task_done', p_task_id, NULL)
  INTO result;

  RETURN jsonb_build_object(
    'xp_earned',    xp_amt,
    'coins_earned', coin_amt,
    'profile',      result
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4.7  patch_task_status — atualiza status + timestamps automáticos
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.patch_task_status(
  p_user_id UUID,
  p_task_id UUID,
  p_status  task_status
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t      public.tasks%ROWTYPE;
  result JSONB := '{}'::jsonb;
BEGIN
  SELECT * INTO t FROM public.tasks
  WHERE id = p_task_id AND user_id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'task_not_found: %', p_task_id;
  END IF;

  -- Se chegando em 'done' → usa complete_task para XP
  IF p_status = 'done' AND t.status != 'done' THEN
    SELECT public.complete_task(p_user_id, p_task_id) INTO result;
    RETURN result;
  END IF;

  UPDATE public.tasks SET
    status     = p_status,
    -- Marca started_at na primeira entrada em 'doing'
    started_at = CASE
      WHEN p_status = 'doing' AND started_at IS NULL THEN now()
      ELSE started_at
    END,
    -- Limpa completed_at se reaberto
    completed_at = CASE
      WHEN p_status != 'done' THEN NULL
      ELSE completed_at
    END,
    updated_at = now()
  WHERE id = p_task_id;

  RETURN jsonb_build_object('status', p_status);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4.8  update_goal_progress
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_goal_progress(
  p_user_id UUID,
  p_goal_id UUID,
  p_delta   NUMERIC,
  p_note    TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  g          public.goals%ROWTYPE;
  new_val    NUMERIC;
  pct        INTEGER;
  completed  BOOLEAN := FALSE;
  xp_amt     INTEGER := 20;
  coin_amt   INTEGER := 4;
  src        xp_source := 'goal_progress';
  result     JSONB;
BEGIN
  SELECT * INTO g FROM public.goals
  WHERE id = p_goal_id AND user_id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'goal_not_found: %', p_goal_id;
  END IF;

  new_val := LEAST(g.target, g.current + p_delta);
  pct     := ROUND((new_val / g.target) * 100)::INTEGER;

  IF new_val >= g.target AND g.completed_at IS NULL THEN
    completed := TRUE;
    xp_amt    := 500;
    coin_amt  := 50;
    src       := 'goal_complete';
  END IF;

  UPDATE public.goals SET
    current      = new_val,
    completed_at = CASE WHEN completed THEN now() ELSE completed_at END,
    updated_at   = now()
  WHERE id = p_goal_id;

  INSERT INTO public.goal_logs (user_id, goal_id, delta, value_at, note)
  VALUES (p_user_id, p_goal_id, p_delta, new_val, p_note);

  SELECT public.award_xp(p_user_id, xp_amt, coin_amt, src, p_goal_id, p_note)
  INTO result;

  RETURN jsonb_build_object(
    'current',   new_val,
    'target',    g.target,
    'pct',       pct,
    'completed', completed,
    'xp_earned', xp_amt,
    'profile',   result
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4.9  get_finance_summary
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_finance_summary(
  p_user_id UUID,
  p_year    INTEGER DEFAULT EXTRACT(YEAR  FROM CURRENT_DATE)::INTEGER,
  p_month   INTEGER DEFAULT EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_income   NUMERIC := 0;
  v_expense  NUMERIC := 0;
  v_cats     JSONB;
BEGIN
  SELECT
    COALESCE(SUM(CASE WHEN type = 'income'  THEN amount END), 0),
    COALESCE(SUM(CASE WHEN type = 'expense' THEN amount END), 0)
  INTO v_income, v_expense
  FROM public.finances
  WHERE user_id = p_user_id
    AND EXTRACT(YEAR  FROM reference_date) = p_year
    AND EXTRACT(MONTH FROM reference_date) = p_month;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('category', category, 'type', type, 'total', total)
      ORDER BY total DESC
    ), '[]'::JSONB
  ) INTO v_cats
  FROM (
    SELECT category, type, SUM(amount) AS total
    FROM public.finances
    WHERE user_id = p_user_id
      AND EXTRACT(YEAR  FROM reference_date) = p_year
      AND EXTRACT(MONTH FROM reference_date) = p_month
    GROUP BY category, type
  ) sub;

  RETURN jsonb_build_object(
    'year',         p_year,
    'month',        p_month,
    'income',       v_income,
    'expense',      v_expense,
    'net',          v_income - v_expense,
    'savings_rate', CASE WHEN v_income > 0
                    THEN ROUND(((v_income - v_expense) / v_income) * 100, 1)
                    ELSE 0 END,
    'categories',   v_cats
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4.10  get_dashboard
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_dashboard(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile      public.profiles%ROWTYPE;
  v_active_tasks INTEGER;
  v_habits_today INTEGER;
  v_habits_total INTEGER;
  v_net_month    NUMERIC;
  v_active_goals INTEGER;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE user_id = p_user_id;

  SELECT COUNT(*) INTO v_active_tasks
  FROM public.tasks WHERE user_id = p_user_id AND status != 'done';

  SELECT
    COUNT(*) FILTER (WHERE last_check = CURRENT_DATE),
    COUNT(*)
  INTO v_habits_today, v_habits_total
  FROM public.habit_tracker
  WHERE user_id = p_user_id AND quit_mode = FALSE AND archived = FALSE;

  SELECT COALESCE(
    SUM(CASE WHEN type='income' THEN amount ELSE -amount END), 0
  ) INTO v_net_month
  FROM public.finances
  WHERE user_id = p_user_id
    AND EXTRACT(YEAR  FROM reference_date) = EXTRACT(YEAR  FROM CURRENT_DATE)
    AND EXTRACT(MONTH FROM reference_date) = EXTRACT(MONTH FROM CURRENT_DATE);

  SELECT COUNT(*) INTO v_active_goals
  FROM public.goals
  WHERE user_id = p_user_id AND archived = FALSE AND completed_at IS NULL;

  RETURN jsonb_build_object(
    'xp',             v_profile.xp,
    'coins',          v_profile.coins,
    'level',          v_profile.level,
    'xp_to_next',     v_profile.xp_to_next,
    'streak_max',     v_profile.streak_max,
    'tasks_done',     v_profile.tasks_done,
    'habits_checked', v_profile.habits_checked,
    'active_tasks',   v_active_tasks,
    'habits_today',   v_habits_today,
    'habits_total',   v_habits_total,
    'net_balance',    v_net_month,
    'active_goals',   v_active_goals
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4.11  log_time  — registra tempo em tarefa + retorna total
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_time(
  p_user_id UUID,
  p_task_id UUID,
  p_minutes INTEGER,
  p_note    TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total INTEGER;
BEGIN
  -- Verifica que a tarefa pertence ao usuário
  IF NOT EXISTS (
    SELECT 1 FROM public.tasks WHERE id = p_task_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'task_not_found: %', p_task_id;
  END IF;

  INSERT INTO public.time_logs (user_id, task_id, minutes, note)
  VALUES (p_user_id, p_task_id, p_minutes, p_note);

  SELECT COALESCE(SUM(minutes), 0) INTO v_total
  FROM public.time_logs
  WHERE task_id = p_task_id;

  RETURN jsonb_build_object(
    'task_id',       p_task_id,
    'minutes_added', p_minutes,
    'total_minutes', v_total
  );
END;
$$;

-- ============================================================================
-- 5. TRIGGERS
-- ============================================================================

-- Auto-create profile no signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto updated_at
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles','tasks','habit_tracker','finances',
    'goals','crypto_positions','schedule_events'
  ]
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS trg_%1$s_updated_at ON public.%1$I;
      CREATE TRIGGER trg_%1$s_updated_at
        BEFORE UPDATE ON public.%1$I
        FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    ', t);
  END LOOP;
END $$;

-- ============================================================================
-- 6. ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_tracker    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finances         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_logs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crypto_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xp_log           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_logs        ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles','tasks','habit_tracker','habit_logs',
    'finances','goals','goal_logs','crypto_positions',
    'schedule_events','time_logs'
  ]
  LOOP
    EXECUTE format('
      DROP POLICY IF EXISTS "%1$s_own" ON public.%1$I;
      CREATE POLICY "%1$s_own" ON public.%1$I
        FOR ALL
        USING   (user_id = auth.uid())
        WITH CHECK (user_id = auth.uid());
    ', t);
  END LOOP;
END $$;

-- xp_log: só leitura pelo cliente
DROP POLICY IF EXISTS "xp_log_read" ON public.xp_log;
CREATE POLICY "xp_log_read" ON public.xp_log
  FOR SELECT USING (user_id = auth.uid());

-- ============================================================================
-- 7. REALTIME
-- ============================================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles','tasks','habit_tracker','finances',
    'goals','crypto_positions','schedule_events'
  ]
  LOOP
    EXECUTE format('
      ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;
    ', t);
  END LOOP;
EXCEPTION WHEN others THEN NULL;
END $$;

-- ============================================================================
-- 8. STORAGE
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars','avatars', TRUE, 2097152,
  ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "avatars_insert" ON storage.objects;
CREATE POLICY "avatars_insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "avatars_select" ON storage.objects;
CREATE POLICY "avatars_select" ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_update" ON storage.objects;
CREATE POLICY "avatars_update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================================================
-- 9. MIGRATION HELPER — normaliza tasks existentes
-- ============================================================================
UPDATE public.tasks
SET
  complexity        = COALESCE(complexity, 'medium'),
  estimated_minutes = CASE WHEN estimated_minutes IS NULL OR estimated_minutes < 1 THEN 30 ELSE estimated_minutes END,
  checklist         = COALESCE(checklist, '[]'::jsonb)
WHERE
  complexity IS NULL
  OR estimated_minutes IS NULL
  OR checklist IS NULL;
