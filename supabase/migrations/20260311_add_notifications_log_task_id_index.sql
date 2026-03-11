-- Index on notifications_log.task_id FK
-- Fixes: unindexed foreign key detected by Supabase advisor.
-- Without this index, JOINs and ON DELETE CASCADE on task_id
-- require a full table scan on notifications_log.
CREATE INDEX IF NOT EXISTS notifications_log_task_id_idx
  ON public.notifications_log (task_id);
