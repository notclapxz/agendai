-- =============================================================================
-- MIGRATION: 20260211000001_initial_schema.sql
-- Proyecto: agenda-legal (dtqpygaovkknsyvgfvie)
-- Región: sa-east-1 (São Paulo)
-- Fecha inicial: 2026-02-11
-- Nota: consolidada con ALTER TYPE task_type ADD VALUE 'Escrito' (2026-03-08)
-- Este archivo es documentación del schema aplicado en producción.
-- =============================================================================

-- =====================================================
-- ENUMS
-- =====================================================

CREATE TYPE task_type AS ENUM (
  'Tarea',
  'Audiencia',
  'Reunion',
  'Llamada',
  'Plazo',
  'Escrito',
  'Otro'
);

-- =====================================================
-- TABLA: tasks
-- =====================================================

CREATE TABLE tasks (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date          DATE        NOT NULL,
  title         TEXT        NOT NULL,
  type          task_type   NOT NULL DEFAULT 'Tarea',
  time          TIME        NULL,
  completed     BOOLEAN     NOT NULL DEFAULT false,
  completed_at  TIMESTAMPTZ NULL,
  carried_from  DATE        NULL,
  position      INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX tasks_user_date_idx
  ON tasks(user_id, date);

CREATE INDEX tasks_user_date_time_idx
  ON tasks(user_id, date, time)
  WHERE time IS NOT NULL;

-- =====================================================
-- TABLA: push_subscriptions
-- =====================================================

CREATE TABLE push_subscriptions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint      TEXT        NOT NULL,
  p256dh        TEXT        NOT NULL,
  auth_key      TEXT        NOT NULL,
  device_label  TEXT        NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

-- =====================================================
-- TABLA: user_preferences
-- =====================================================

CREATE TABLE user_preferences (
  user_id              UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  timezone             TEXT        NOT NULL DEFAULT 'America/Lima',
  summary_time         TIME        NOT NULL DEFAULT '07:20',
  notify_days_before   INTEGER[]   NOT NULL DEFAULT '{3,1}',
  notify_hour_before   BOOLEAN     NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- TABLA: notifications_log
-- =====================================================

CREATE TABLE notifications_log (
  id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id   UUID        NULL REFERENCES tasks(id) ON DELETE CASCADE,
  type      TEXT        NOT NULL,
  ref_date  DATE        NOT NULL,
  sent_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, task_id, type, ref_date)
);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE tasks               ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences    ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications_log   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_tasks"
  ON tasks FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "own_push"
  ON push_subscriptions FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "own_prefs"
  ON user_preferences FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "own_notif_log"
  ON notifications_log FOR ALL
  USING (auth.uid() = user_id);
