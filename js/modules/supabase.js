/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  LIFE CONTROL — supabase.js                                     ║
 * ║  Camada de dados completa. Toda chamada ao Supabase passa aqui. ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║  Seções:                                                        ║
 * ║  1. Init & Conexão                                              ║
 * ║  2. Auth (signUp / signIn / signOut / session)                  ║
 * ║  3. Bootstrap (loadAll + Realtime)                              ║
 * ║  4. Profile                                                     ║
 * ║  5. Tasks                                                       ║
 * ║  6. Habits                                                      ║
 * ║  7. Finances                                                    ║
 * ║  8. Goals                                                       ║
 * ║  9. Crypto                                                      ║
 * ║  10. Schedule                                                   ║
 * ║  11. XP Log (read-only)                                         ║
 * ║  12. Dashboard RPC                                              ║
 * ║  13. Gamificação local (demo mode)                              ║
 * ║  14. Helpers privados                                           ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import { state, DEMO_DATA }        from './state.js';
import { renderAll, updateTopBar } from './ui.js';
import { showToast }               from './toast.js';
import { setConnectionStatus }     from './navigation.js';

// ─── Singleton ────────────────────────────────────────────────────────────────
/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let _sb       = null;
/** @type {string | null} UUID do usuário autenticado */
let _uid      = null;
/** @type {Array} Canais realtime ativos */
let _channels = [];

// ─── Controle de retry (evita flood em caso de erro de rede) ─────────────────
let _retryTimer = null;
const RETRY_MS  = 8000;

// =============================================================================
// 1. INIT & CONEXÃO
// =============================================================================

/**
 * Inicializa o cliente Supabase e verifica conectividade.
 * Persiste as credenciais no localStorage para auto-connect.
 * @throws {Error} se as credenciais forem inválidas ou o schema não existir
 */
export async function connectSupabase(url, key) {
  if (!window.supabase?.createClient) {
    throw new Error('SDK do Supabase não carregado. Verifique o script no <head>.');
  }

  // Valida formato básico antes de criar o cliente
  if (!url.startsWith('https://') || url.length < 20) {
    throw new Error('URL inválida. Deve ser https://<projeto>.supabase.co');
  }
  if (key.length < 30) {
    throw new Error('Anon key muito curta. Verifique nas configurações do projeto.');
  }

  _sb = window.supabase.createClient(url, key, {
    auth: {
      persistSession:    true,
      autoRefreshToken:  true,
      detectSessionInUrl: true,
    },
    realtime: {
      params: { eventsPerSecond: 10 },
    },
  });

  // Probe rápido — confirma que o schema existe e a key é válida
  const probe = await _sb.from('profiles').select('id').limit(1);
  if (probe.error) {
    _sb = null;
    throw new Error(probe.error.message);
  }

  // Salva credenciais
  localStorage.setItem('lc_sb_url', url);
  localStorage.setItem('lc_sb_key', key);

  // Verifica se já existe sessão ativa (reload de página)
  const { data: { session } } = await _sb.auth.getSession();
  if (session?.user) {
    _uid = session.user.id;
    setConnectionStatus('ok');
    await _bootstrap();
  } else {
    // Credenciais ok, mas usuário não logado
    setConnectionStatus('ok');
  }

  // Escuta mudanças de auth em tempo real
  _sb.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
      _uid = session.user.id;
      setConnectionStatus('ok');
      await _bootstrap();
    }
    if (event === 'SIGNED_OUT') {
      _uid = null;
      _unsubscribeAll();
      setConnectionStatus('offline');
    }
    if (event === 'TOKEN_REFRESHED') {
      console.debug('[LC] Token renovado');
    }
  });
}

/**
 * Tenta reconectar com credenciais salvas no localStorage.
 * @returns {boolean} true se conectou com sucesso
 */
export async function tryAutoConnect() {
  const url = localStorage.getItem('lc_sb_url');
  const key = localStorage.getItem('lc_sb_key');
  if (!url || !key) return false;

  try {
    await connectSupabase(url, key);
    return true;
  } catch (err) {
    console.warn('[LC] Auto-connect falhou:', err.message);
    return false;
  }
}

/**
 * Ativa modo demo com dados simulados — nenhuma chamada de rede.
 */
export function useDemoMode() {
  _sb  = null;
  _uid = null;
  _unsubscribeAll();

  // Cópia profunda do seed
  state.tasks    = DEMO_DATA.tasks.map(t => ({ ...t }));
  state.habits   = DEMO_DATA.habits.map(h => ({ ...h }));
  state.finances = DEMO_DATA.finances.map(f => ({ ...f }));
  state.goals    = DEMO_DATA.goals.map(g => ({ ...g }));
  state.profile  = { ...DEMO_DATA.profile };
  state.crypto   = [];
  state.schedule = [];

  setConnectionStatus('demo');
  renderAll();
  updateTopBar();
  showToast('Modo Demo ativo — dados simulados carregados.', '');
}

// =============================================================================
// 2. AUTH
// =============================================================================

/**
 * Cadastra novo usuário. Supabase envia e-mail de confirmação.
 * @returns {import('@supabase/supabase-js').AuthResponse}
 */
export async function signUp(email, password, username = 'Comandante') {
  _assertClient();
  const { data, error } = await _sb.auth.signUp({
    email,
    password,
    options: { data: { username } },
  });
  if (error) throw error;
  return data;
}

/**
 * Login com email + senha.
 * @returns {import('@supabase/supabase-js').AuthResponse}
 */
export async function signIn(email, password) {
  _assertClient();
  const { data, error } = await _sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  _uid = data.user.id;
  return data;
}

/** Logout. */
export async function signOut() {
  _assertClient();
  const { error } = await _sb.auth.signOut();
  if (error) throw error;
  _uid = null;
  _unsubscribeAll();
  setConnectionStatus('offline');
}

/** Retorna a sessão corrente ou null. */
export async function getSession() {
  if (!_sb) return null;
  const { data: { session } } = await _sb.auth.getSession();
  return session;
}

// =============================================================================
// 3. BOOTSTRAP
// =============================================================================

/**
 * Carrega todos os dados do usuário em paralelo, depois ativa o realtime.
 */
export async function loadAll() {
  if (!_sb || !_uid) return;

  const [
    rTasks, rHabits, rFinances, rGoals,
    rProfile, rCrypto, rSchedule,
  ] = await Promise.allSettled([

    _sb.from('tasks')
       .select('*')
       .eq('user_id', _uid)
       .order('sort_order', { ascending: true })
       .order('created_at',  { ascending: false }),

    _sb.from('habit_tracker')
       .select('*')
       .eq('user_id', _uid)
       .eq('archived', false)
       .order('created_at', { ascending: true }),

    _sb.from('finances')
       .select('*')
       .eq('user_id', _uid)
       .order('reference_date', { ascending: false })
       .order('created_at',     { ascending: false })
       .limit(300),

    _sb.from('goals')
       .select('*')
       .eq('user_id', _uid)
       .eq('archived', false)
       .order('created_at', { ascending: true }),

    _sb.from('profiles')
       .select('*')
       .eq('user_id', _uid)
       .single(),

    _sb.from('crypto_positions')
       .select('*')
       .eq('user_id', _uid)
       .order('symbol'),

    _sb.from('schedule_events')
       .select('*')
       .eq('user_id', _uid)
       .gte('event_date',
         new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0])
       .order('event_date')
       .order('start_time'),
  ]);

  if (rTasks.status    === 'fulfilled' && rTasks.value.data)    state.tasks    = rTasks.value.data;
  if (rHabits.status   === 'fulfilled' && rHabits.value.data)   state.habits   = rHabits.value.data;
  if (rFinances.status === 'fulfilled' && rFinances.value.data) state.finances = rFinances.value.data;
  if (rGoals.status    === 'fulfilled' && rGoals.value.data)    state.goals    = rGoals.value.data;
  if (rProfile.status  === 'fulfilled' && rProfile.value.data)  state.profile  = rProfile.value.data;
  if (rCrypto.status   === 'fulfilled' && rCrypto.value.data)   state.crypto   = rCrypto.value.data;
  if (rSchedule.status === 'fulfilled' && rSchedule.value.data) state.schedule = rSchedule.value.data;

  // Loga erros individuais (não derruba o app)
  [rTasks, rHabits, rFinances, rGoals, rProfile, rCrypto, rSchedule]
    .filter(r => r.status === 'rejected')
    .forEach(r => console.error('[LC loadAll]', r.reason));

  renderAll();
  updateTopBar();
}

// ── Realtime ──────────────────────────────────────────────────────────────────

function _subscribeRealtime() {
  if (!_sb || !_uid) return;
  _unsubscribeAll();

  const TABLES = [
    'tasks', 'habit_tracker', 'finances',
    'goals', 'profiles', 'crypto_positions', 'schedule_events',
  ];

  const ch = _sb.channel(`lc:${_uid}`);

  TABLES.forEach(table => {
    ch.on(
      'postgres_changes',
      { event: '*', schema: 'public', table, filter: `user_id=eq.${_uid}` },
      payload => _onRealtimeEvent(table, payload)
    );
  });

  ch.subscribe(status => {
    if (status === 'SUBSCRIBED') {
      console.info('[LC Realtime] Online');
    }
    if (status === 'CHANNEL_ERROR') {
      console.warn('[LC Realtime] Erro — tentando reconectar...');
      clearTimeout(_retryTimer);
      _retryTimer = setTimeout(() => _subscribeRealtime(), RETRY_MS);
    }
  });

  _channels.push(ch);
}

/** Aplica mudança remota no state local sem re-fetch completo. */
function _onRealtimeEvent(table, { eventType, new: row, old }) {
  const stateMap = {
    tasks:             'tasks',
    habit_tracker:     'habits',
    finances:          'finances',
    goals:             'goals',
    crypto_positions:  'crypto',
    schedule_events:   'schedule',
  };

  if (table === 'profiles') {
    if (eventType === 'UPDATE') Object.assign(state.profile, row);
    updateTopBar();
    return;
  }

  const key = stateMap[table];
  if (!key) return;

  if (!state[key]) state[key] = [];

  switch (eventType) {
    case 'INSERT':
      // Evita duplicata se a inserção foi originada pelo mesmo cliente
      if (!state[key].some(item => item.id === row.id)) {
        table === 'tasks' || table === 'finances'
          ? state[key].unshift(row)
          : state[key].push(row);
      }
      break;
    case 'UPDATE':
      state[key] = state[key].map(item => item.id === row.id ? row : item);
      break;
    case 'DELETE':
      state[key] = state[key].filter(item => item.id !== old.id);
      break;
  }

  renderAll();
  updateTopBar();
}

function _unsubscribeAll() {
  _channels.forEach(ch => { try { _sb?.removeChannel(ch); } catch {} });
  _channels = [];
  clearTimeout(_retryTimer);
}

async function _bootstrap() {
  await loadAll();
  _subscribeRealtime();
}

// =============================================================================
// 4. PROFILE
// =============================================================================

export async function patchProfile(patch) {
  Object.assign(state.profile, patch);
  if (!_sb || !_uid) return;

  const { error } = await _sb
    .from('profiles')
    .update(patch)
    .eq('user_id', _uid);

  if (error) console.error('[LC patchProfile]', error.message);
}

export async function patchTheme(theme) {
  return patchProfile({ theme });
}

// =============================================================================
// 5. TASKS
// =============================================================================

export async function insertTask(payload) {
  // Map camelCase frontend → snake_case DB
  const dbRow = {
    title:             payload.title,
    description:       payload.description        || null,
    status:            payload.status             || 'backlog',
    priority:          payload.priority           || 'med',
    complexity:        payload.complexity         || 'medium',
    tags:              payload.tags               || [],
    sort_order:        payload.sort_order         || 0,
    estimated_minutes: payload.estimatedMinutes   || payload.estimated_minutes || null,
    story_points:      payload.storyPoints        || payload.story_points      || null,
    sprint:            payload.sprint             || null,
    assignee:          payload.assignee           || null,
    deadline:          payload.deadline ? new Date(payload.deadline).toISOString() : null,
    started_at:        payload.startedAt          || payload.started_at        || null,
    completed_at:      payload.completedAt        || payload.completed_at      || null,
    block_reason:      payload.blockReason        || payload.block_reason      || null,
    depends_on:        payload.dependsOn          || payload.depends_on        || null,
    checklist:         payload.checklist          || [],
  };

  if (!_sb || !_uid) {
    // Demo mode — keep both naming conventions so UI works
    const row = {
      ...dbRow,
      id: _tmpId(), user_id: 'demo',
      created_at: _now(), updated_at: _now(),
      estimatedMinutes: dbRow.estimated_minutes,
      storyPoints:      dbRow.story_points,
      startedAt:        dbRow.started_at ? new Date(dbRow.started_at).getTime() : null,
      completedAt:      dbRow.completed_at ? new Date(dbRow.completed_at).getTime() : null,
      blockReason:      dbRow.block_reason,
      dependsOn:        dbRow.depends_on,
      createdAt:        Date.now(),
    };
    state.tasks.unshift(row);
    return row;
  }

  const { data, error } = await _sb
    .from('tasks')
    .insert([{ ...dbRow, user_id: _uid }])
    .select()
    .single();

  if (error) throw error;
  if (!state.tasks.some(t => t.id === data.id)) state.tasks.unshift(data);
  return data;
}

/**
 * Atualiza status via RPC patch_task_status que gerencia timestamps + XP atomicamente.
 */
export async function patchTaskStatus(id, status) {
  const now = _now();

  // Optimistic local update
  const patch = { status, updated_at: now };
  if (status === 'doing') {
    const task = state.tasks.find(t => t.id === id);
    if (task && !task.started_at && !task.startedAt) {
      patch.started_at = now;
      patch.startedAt  = Date.now();
    }
  }
  if (status === 'done')  { patch.completed_at = now; patch.completedAt = Date.now(); }
  if (status !== 'done')  { patch.completed_at = null; patch.completedAt = null; }
  _optimistic('tasks', id, patch);

  if (!_sb || !_uid) return null;

  const { data, error } = await _sb.rpc('patch_task_status', {
    p_user_id: _uid,
    p_task_id: id,
    p_status:  status,
  });

  if (error) { console.error('[LC patchTaskStatus]', error.message); return null; }

  if (data?.profile) { Object.assign(state.profile, data.profile); updateTopBar(); }

  // Refresh task from DB to get accurate server timestamps
  const { data: fresh } = await _sb.from('tasks').select('*').eq('id', id).single();
  if (fresh) state.tasks = state.tasks.map(t => t.id === id ? fresh : t);

  return data ?? null;
}

/** Full task update — maps camelCase frontend fields → snake_case DB columns */
export async function patchTask(id, payload) {
  function _ms(v) {
    if (!v) return null;
    if (typeof v === 'number') return new Date(v).toISOString();
    if (typeof v === 'string' && v.includes('T')) return v;
    const d = new Date(v);
    return isNaN(d) ? null : d.toISOString();
  }

  const dbPatch = {};
  if (payload.title       !== undefined) dbPatch.title              = payload.title;
  if (payload.description !== undefined) dbPatch.description        = payload.description;
  if (payload.status      !== undefined) dbPatch.status             = payload.status;
  if (payload.priority    !== undefined) dbPatch.priority           = payload.priority;
  if (payload.complexity  !== undefined) dbPatch.complexity         = payload.complexity;
  if (payload.tags        !== undefined) dbPatch.tags               = payload.tags;
  if (payload.assignee    !== undefined) dbPatch.assignee           = payload.assignee;
  if (payload.sprint      !== undefined) dbPatch.sprint             = payload.sprint;
  if (payload.checklist   !== undefined) dbPatch.checklist          = payload.checklist;
  if (payload.block_reason   !== undefined) dbPatch.block_reason    = payload.block_reason;
  if (payload.blockReason    !== undefined) dbPatch.block_reason    = payload.blockReason;
  if (payload.depends_on     !== undefined) dbPatch.depends_on      = payload.depends_on;
  if (payload.dependsOn      !== undefined) dbPatch.depends_on      = payload.dependsOn;
  if (payload.estimated_minutes !== undefined) dbPatch.estimated_minutes = payload.estimated_minutes;
  if (payload.estimatedMinutes  !== undefined) dbPatch.estimated_minutes = payload.estimatedMinutes;
  if (payload.story_points   !== undefined) dbPatch.story_points    = payload.story_points;
  if (payload.storyPoints    !== undefined) dbPatch.story_points    = payload.storyPoints;
  if ('startedAt'   in payload || 'started_at'   in payload) dbPatch.started_at   = _ms(payload.startedAt   ?? payload.started_at);
  if ('completedAt' in payload || 'completed_at' in payload) dbPatch.completed_at = _ms(payload.completedAt ?? payload.completed_at);
  if ('createdAt'   in payload || 'created_at'   in payload) dbPatch.created_at   = _ms(payload.createdAt   ?? payload.created_at);
  if ('deadline'    in payload) dbPatch.deadline = _ms(payload.deadline);

  // Optimistic: apply both naming conventions locally
  const localPatch = { ...dbPatch };
  if (dbPatch.estimated_minutes !== undefined) localPatch.estimatedMinutes = dbPatch.estimated_minutes;
  if (dbPatch.story_points      !== undefined) localPatch.storyPoints      = dbPatch.story_points;
  if (dbPatch.block_reason      !== undefined) localPatch.blockReason      = dbPatch.block_reason;
  if (dbPatch.depends_on        !== undefined) localPatch.dependsOn        = dbPatch.depends_on;
  if (dbPatch.started_at        !== undefined) localPatch.startedAt        = dbPatch.started_at ? new Date(dbPatch.started_at).getTime() : null;
  if (dbPatch.completed_at      !== undefined) localPatch.completedAt      = dbPatch.completed_at ? new Date(dbPatch.completed_at).getTime() : null;
  _optimistic('tasks', id, localPatch);

  if (!_sb || !_uid) return;

  const { error } = await _sb
    .from('tasks')
    .update({ ...dbPatch, updated_at: _now() })
    .eq('id', id)
    .eq('user_id', _uid);

  if (error) throw error;
}

export async function patchTaskOrder(id, sortOrder) {
  _optimistic('tasks', id, { sort_order: sortOrder });
  if (!_sb) return;
  await _sb.from('tasks').update({ sort_order: sortOrder }).eq('id', id);
}

export async function removeTask(id) {
  state.tasks = state.tasks.filter(t => t.id !== id);
  if (!_sb) return;
  const { error } = await _sb.from('tasks').delete().eq('id', id);
  if (error) throw error;
}

// =============================================================================
// 6. HABITS
// =============================================================================

export async function insertHabit(payload) {
  if (!_sb || !_uid) {
    const row = { ...payload, id: _tmpId(), user_id: 'demo',
                  created_at: _now(), updated_at: _now() };
    state.habits.push(row);
    return row;
  }

  const { data, error } = await _sb
    .from('habit_tracker')
    .insert([{ ...payload, user_id: _uid }])
    .select()
    .single();

  if (error) throw error;
  if (!state.habits.some(h => h.id === data.id)) state.habits.push(data);
  return data;
}

/**
 * Check-in atômico via RPC. Retorna { streak, milestone, xp_earned, coins_earned, profile }.
 * Em demo mode calcula localmente.
 */
export async function checkHabit(id, note = null) {
  const today = _today();
  const h = state.habits.find(h => h.id === id);
  if (!h) throw new Error('Habit não encontrado');
  if (h.last_check === today) return { error: 'already_checked', streak: h.streak };

  // Optimistic — calcula streak esperado
  const yesterday  = _yesterday();
  const newStreak  = h.last_check === yesterday ? (h.streak || 0) + 1 : 1;
  _optimistic('habits', id, { streak: newStreak, last_check: today,
                               streak_max: Math.max(h.streak_max || 0, newStreak) });

  if (!_sb || !_uid) {
    // Demo mode: XP calculado localmente
    const xpLocal   = newStreak % 7 === 0 ? 200 : 30;
    const milestone = newStreak % 7 === 0;
    state.profile.xp    = (state.profile.xp    || 0) + xpLocal;
    state.profile.coins = (state.profile.coins || 0) + Math.floor(xpLocal / 5);
    updateTopBar();
    return { streak: newStreak, milestone, xp_earned: xpLocal, coins_earned: Math.floor(xpLocal / 5) };
  }

  const { data, error } = await _sb.rpc('check_habit', {
    p_user_id:  _uid,
    p_habit_id: id,
    p_note:     note,
  });

  if (error) {
    // Rollback
    _optimistic('habits', id, { streak: h.streak, last_check: h.last_check });
    throw error;
  }

  if (data?.profile) {
    Object.assign(state.profile, data.profile);
    updateTopBar();
  }

  return data;
}

/**
 * Registra recaída no quit-tracker via RPC.
 * Retorna { relapse_count, previous_streak }.
 */
export async function logRelapse(id, note = null) {
  const h = state.habits.find(h => h.id === id);
  const prev = h?.streak ?? 0;
  _optimistic('habits', id, { quit_date: _today(), streak: 0 });

  if (!_sb || !_uid) {
    return { relapse_count: (h?.relapse_count ?? 0) + 1, previous_streak: prev };
  }

  const { data, error } = await _sb.rpc('log_relapse', {
    p_user_id:  _uid,
    p_habit_id: id,
    p_note:     note,
  });

  if (error) throw error;
  return data;
}

export async function archiveHabit(id) {
  state.habits = state.habits.filter(h => h.id !== id);
  if (!_sb) return;
  await _sb.from('habit_tracker').update({ archived: true }).eq('id', id);
}

// =============================================================================
// 7. FINANCES
// =============================================================================

export async function insertFinance(payload) {
  const base = {
    ...payload,
    reference_date: payload.reference_date || _today(),
  };

  if (!_sb || !_uid) {
    const row = { ...base, id: _tmpId(), user_id: 'demo', created_at: _now() };
    state.finances.unshift(row);
    return row;
  }

  const { data, error } = await _sb
    .from('finances')
    .insert([{ ...base, user_id: _uid }])
    .select()
    .single();

  if (error) throw error;
  if (!state.finances.some(f => f.id === data.id)) state.finances.unshift(data);
  return data;
}

export async function removeFinance(id) {
  state.finances = state.finances.filter(f => f.id !== id);
  if (!_sb) return;
  const { error } = await _sb.from('finances').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Resumo mensal via RPC.
 * @returns {{ year, month, income, expense, net, savings_rate, categories }}
 */
export async function getFinanceSummary(year, month) {
  if (!_sb || !_uid) {
    const inc = state.finances.filter(f => f.type === 'income').reduce((s, f) => s + +f.amount, 0);
    const exp = state.finances.filter(f => f.type === 'expense').reduce((s, f) => s + +f.amount, 0);
    return { income: inc, expense: exp, net: inc - exp, savings_rate: 0, categories: [] };
  }

  const now = new Date();
  const { data, error } = await _sb.rpc('get_finance_summary', {
    p_user_id: _uid,
    p_year:    year  ?? now.getFullYear(),
    p_month:   month ?? now.getMonth() + 1,
  });

  if (error) throw error;
  return data;
}

// =============================================================================
// 8. GOALS
// =============================================================================

export async function insertGoal(payload) {
  if (!_sb || !_uid) {
    const row = { ...payload, id: _tmpId(), user_id: 'demo',
                  current: 0, created_at: _now() };
    state.goals.push(row);
    return row;
  }

  const { data, error } = await _sb
    .from('goals')
    .insert([{ ...payload, user_id: _uid }])
    .select()
    .single();

  if (error) throw error;
  if (!state.goals.some(g => g.id === data.id)) state.goals.push(data);
  return data;
}

/**
 * Atualiza progresso via RPC.
 * @returns {{ current, target, pct, completed, xp_earned, profile }}
 */
export async function updateGoalProgress(id, delta, note = null) {
  const g = state.goals.find(g => g.id === id);
  if (!g) throw new Error('Goal não encontrado');

  const newCurrent = Math.min(+g.target, (+g.current) + delta);
  _optimistic('goals', id, { current: newCurrent });

  if (!_sb || !_uid) {
    const pct       = Math.round((newCurrent / +g.target) * 100);
    const completed = newCurrent >= +g.target;
    const xp        = completed ? 500 : 20;
    state.profile.xp    = (state.profile.xp    || 0) + xp;
    state.profile.coins = (state.profile.coins || 0) + Math.floor(xp / 5);
    updateTopBar();
    return { current: newCurrent, target: g.target, pct, completed, xp_earned: xp };
  }

  const { data, error } = await _sb.rpc('update_goal_progress', {
    p_user_id: _uid,
    p_goal_id: id,
    p_delta:   delta,
    p_note:    note,
  });

  if (error) throw error;
  if (data?.profile) {
    Object.assign(state.profile, data.profile);
    updateTopBar();
  }
  return data;
}

export async function archiveGoal(id) {
  state.goals = state.goals.filter(g => g.id !== id);
  if (!_sb) return;
  await _sb.from('goals').update({ archived: true }).eq('id', id);
}

// Alias para compatibilidade com actions.js anterior
export const patchGoalCurrent = updateGoalProgress;

// =============================================================================
// 9. CRYPTO
// =============================================================================

export async function upsertCrypto(symbol, name, quantity, avgCostBrl) {
  const payload = {
    user_id:      _uid ?? 'demo',
    symbol:       symbol.toUpperCase(),
    name,
    quantity,
    avg_cost_brl: avgCostBrl,
  };

  if (!state.crypto) state.crypto = [];
  const idx = state.crypto.findIndex(c => c.symbol === payload.symbol);
  if (idx >= 0) Object.assign(state.crypto[idx], payload);
  else state.crypto.push({ ...payload, id: _tmpId() });

  if (!_sb || !_uid) return;

  const { error } = await _sb
    .from('crypto_positions')
    .upsert(payload, { onConflict: 'user_id,symbol' });

  if (error) throw error;
}

export async function removeCrypto(id) {
  if (state.crypto) state.crypto = state.crypto.filter(c => c.id !== id);
  if (!_sb) return;
  await _sb.from('crypto_positions').delete().eq('id', id);
}

// =============================================================================
// 10. SCHEDULE
// =============================================================================

export async function insertScheduleEvent(payload) {
  if (!state.schedule) state.schedule = [];

  if (!_sb || !_uid) {
    const row = { ...payload, id: _tmpId(), user_id: 'demo', created_at: _now() };
    state.schedule.push(row);
    return row;
  }

  const { data, error } = await _sb
    .from('schedule_events')
    .insert([{ ...payload, user_id: _uid }])
    .select()
    .single();

  if (error) throw error;
  if (!state.schedule.some(e => e.id === data.id)) state.schedule.push(data);
  return data;
}

export async function removeScheduleEvent(id) {
  if (state.schedule) state.schedule = state.schedule.filter(e => e.id !== id);
  if (!_sb) return;
  await _sb.from('schedule_events').delete().eq('id', id);
}

// =============================================================================
// 11. XP LOG (read-only)
// =============================================================================

export async function getXpLog(limit = 50) {
  if (!_sb || !_uid) return [];
  const { data, error } = await _sb
    .from('xp_log')
    .select('*')
    .eq('user_id', _uid)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

// =============================================================================
// 12. DASHBOARD RPC
// =============================================================================

/**
 * Busca snapshot do dashboard em uma única chamada ao Postgres.
 * @returns {object} dados do dashboard ou null em demo
 */
export async function getDashboard() {
  if (!_sb || !_uid) return null;
  const { data, error } = await _sb.rpc('get_dashboard', { p_user_id: _uid });
  if (error) throw error;
  return data;
}

// =============================================================================
// 13. GAMIFICAÇÃO LOCAL (chamado por gamification.js em demo mode)
// =============================================================================
// patchProfile já declarado acima (seção 4) — sem duplicata.

// =============================================================================
// 14. HELPERS PRIVADOS
// =============================================================================

function _assertClient() {
  if (!_sb) throw new Error('Supabase não inicializado. Chame connectSupabase() primeiro.');
}

/** Atualiza um item em um array do state sem fetch. */
function _optimistic(key, id, patch) {
  if (state[key]) {
    state[key] = state[key].map(item =>
      item.id === id ? { ...item, ...patch } : item
    );
  }
}

function _now()       { return new Date().toISOString(); }
function _today()     { return new Date().toISOString().split('T')[0]; }
function _yesterday() {
  const d = new Date(); d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

let _seq = 1;
function _tmpId() { return `tmp_${Date.now()}_${_seq++}`; }
