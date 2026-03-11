-- Migration: optimize_rls_initplan
-- Description: Wrap auth.uid() in (select ...) to trigger Postgres InitPlan
--              optimization. This evaluates auth.uid() once per query instead
--              of once per row, significantly improving RLS performance.
-- Also adds WITH CHECK (was missing on the original FOR ALL policies).

BEGIN;

-- tasks: drop and recreate with (select auth.uid()) for InitPlan optimization
DROP POLICY IF EXISTS own_tasks ON tasks;
CREATE POLICY own_tasks ON tasks
  AS PERMISSIVE FOR ALL TO public
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- push_subscriptions: drop and recreate with (select auth.uid()) for InitPlan optimization
DROP POLICY IF EXISTS own_push ON push_subscriptions;
CREATE POLICY own_push ON push_subscriptions
  AS PERMISSIVE FOR ALL TO public
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- user_preferences: drop and recreate with (select auth.uid()) for InitPlan optimization
DROP POLICY IF EXISTS own_prefs ON user_preferences;
CREATE POLICY own_prefs ON user_preferences
  AS PERMISSIVE FOR ALL TO public
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- notifications_log: drop and recreate with (select auth.uid()) for InitPlan optimization
DROP POLICY IF EXISTS own_notif_log ON notifications_log;
CREATE POLICY own_notif_log ON notifications_log
  AS PERMISSIVE FOR ALL TO public
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

COMMIT;
