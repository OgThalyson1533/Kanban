/**
 * LIFE CONTROL — db.js  (shim de compatibilidade)
 * Todo o código real está em supabase.js.
 * Este arquivo apenas re-exporta para não quebrar imports existentes.
 */
export {
  connectSupabase,
  tryAutoConnect,
  useDemoMode,
  loadAll,
  patchProfile,
  // auth
  signUp,
  signIn,
  signOut,
  getSession,
  // tasks
  insertTask,
  patchTaskStatus,
  patchTaskOrder,
  removeTask,
  // habits
  insertHabit,
  checkHabit,
  logRelapse,
  logRelapse as patchHabitRelapse,
  archiveHabit,
  // finances
  insertFinance,
  removeFinance,
  getFinanceSummary,
  // goals
  insertGoal,
  updateGoalProgress,
  updateGoalProgress as patchGoalCurrent,
  archiveGoal,
  // crypto
  upsertCrypto,
  removeCrypto,
  // schedule
  insertScheduleEvent,
  removeScheduleEvent,
  // read-only
  getXpLog,
  getDashboard,
} from './supabase.js';
