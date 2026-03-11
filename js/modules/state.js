/**
 * LIFE CONTROL — State Module
 * Single source of truth for all application data.
 */

export const state = {
  profile: { xp: 300, coins: 0, level: 1 },
  tasks:    [],
  habits:   [],
  finances: [],
  goals:    [],
  mood:     [],   // { id, date, level(1-5), energy(1-10), note, ts }
  health:   [],   // { id, date, sleep, water, weight, ts }

  dragTaskId: null,
};

/* ── Demo Seed Data ──────────────────────────────────────── */
export const DEMO_DATA = {
  profile: { xp: 1250, coins: 340, level: 4 },

  tasks: [
    { id: 't1', title: 'Estudar TypeScript avançado',           status: 'doing',   priority: 'high', tags: ['work'],     complexity: 'high',   estimatedMinutes: 90, estimated_minutes: 90,  createdAt: Date.now() - 86400000*2, created_at: new Date(Date.now() - 86400000*2).toISOString(), startedAt: Date.now() - 3600000*5, started_at: new Date(Date.now() - 3600000*5).toISOString() },
    { id: 't2', title: 'Implementar autenticação Supabase',      status: 'next',    priority: 'high', tags: ['work'],     complexity: 'high',   estimatedMinutes: 120, estimated_minutes: 120, createdAt: Date.now() - 86400000*3, created_at: new Date(Date.now() - 86400000*3).toISOString() },
    { id: 't3', title: 'Treino HIIT 30 min',                    status: 'done',    priority: 'med',  tags: ['health'],   complexity: 'low',    estimatedMinutes: 30, estimated_minutes: 30,  createdAt: Date.now() - 86400000*4, created_at: new Date(Date.now() - 86400000*4).toISOString(), startedAt: Date.now() - 86400000*1, started_at: new Date(Date.now() - 86400000*1).toISOString(), completedAt: Date.now() - 3600000*2, completed_at: new Date(Date.now() - 3600000*2).toISOString() },
    { id: 't4', title: 'Revisar portfólio de investimentos',     status: 'review',  priority: 'med',  tags: ['finance'],  complexity: 'medium', estimatedMinutes: 45, estimated_minutes: 45,  createdAt: Date.now() - 86400000*1, created_at: new Date(Date.now() - 86400000*1).toISOString(), startedAt: Date.now() - 3600000*3, started_at: new Date(Date.now() - 3600000*3).toISOString() },
    { id: 't5', title: 'Meditação matinal',                     status: 'done',    priority: 'low',  tags: ['personal'], complexity: 'low',    estimatedMinutes: 15, estimated_minutes: 15,  createdAt: Date.now() - 86400000*5, created_at: new Date(Date.now() - 86400000*5).toISOString(), startedAt: Date.now() - 86400000*1, started_at: new Date(Date.now() - 86400000*1).toISOString(), completedAt: Date.now() - 3600000*8, completed_at: new Date(Date.now() - 3600000*8).toISOString() },
    { id: 't6', title: 'Ler livro técnico 30 min',              status: 'backlog',  priority: 'med',  tags: ['personal'], complexity: 'low',    estimatedMinutes: 30, estimated_minutes: 30,  createdAt: Date.now() - 86400000*1, created_at: new Date(Date.now() - 86400000*1).toISOString() },
    { id: 't7', title: 'Bug crítico no checkout',               status: 'blocked',  priority: 'high', tags: ['work'],     complexity: 'high',   estimatedMinutes: 60, estimated_minutes: 60,  createdAt: Date.now() - 86400000*2, created_at: new Date(Date.now() - 86400000*2).toISOString(), startedAt: Date.now() - 3600000*2, started_at: new Date(Date.now() - 3600000*2).toISOString() },
  ],

  habits: [
    { id: 'h1', name: 'Meditação',  icon: '🧘', streak: 12, last_check: new Date().toISOString().split('T')[0], quit_mode: false },
    { id: 'h2', name: 'Exercício',  icon: '💪', streak: 7,  last_check: null, quit_mode: false },
    { id: 'h3', name: 'Leitura',    icon: '📚', streak: 21, last_check: new Date().toISOString().split('T')[0], quit_mode: false },
    { id: 'h4', name: 'Água 2L',    icon: '💧', streak: 4,  last_check: null, quit_mode: false },
  ],

  finances: [
    { id: 'f1', description: 'Salário',      amount: 8500, type: 'income',  category: 'Trabalho'     },
    { id: 'f2', description: 'Aluguel',      amount: 1800, type: 'expense', category: 'Moradia'      },
    { id: 'f3', description: 'Supermercado', amount:  450, type: 'expense', category: 'Alimentação'  },
    { id: 'f4', description: 'Freelance',    amount: 2000, type: 'income',  category: 'Extra'        },
    { id: 'f5', description: 'Academia',     amount:  120, type: 'expense', category: 'Saúde'        },
  ],

  goals: [
    { id: 'g1', title: 'Fundo de Emergência', target: 30000, current: 18000, unit: 'R$', color: 'mint',   deadline: '2025-12-31' },
    { id: 'g2', title: 'Aprender Rust',        target: 100,  current: 35,    unit: '%',  color: 'plasma', deadline: '2025-06-30' },
    { id: 'g3', title: 'Correr 5km sem parar', target: 5,    current: 3.2,   unit: 'km', color: 'gold',   deadline: '2025-04-30' },
  ],
};

/* ── Computed helpers ────────────────────────────────────── */
export const getActiveTasks  = () => state.tasks.filter(t => t.status !== 'done');
export const getMaxStreak    = () => Math.max(0, ...state.habits.map(h => h.streak || 0));
export const getTotalIncome  = () => state.finances.filter(f => f.type === 'income').reduce((s, f) => s + +f.amount, 0);
export const getTotalExpense = () => state.finances.filter(f => f.type === 'expense').reduce((s, f) => s + +f.amount, 0);
export const getNetBalance   = () => getTotalIncome() - getTotalExpense();

export const getLevel = (xp) => Math.floor((xp || 0) / 500) + 1;
export const getXpPct = (xp)  => ((xp || 0) % 500) / 500 * 100;

export const TODAY = () => new Date().toISOString().split('T')[0];

/* ── Task time helpers ────────────────────────────────────── */
export const getCycleTime = (task) => {
  if (!task.startedAt) return null;
  const end = task.completedAt || Date.now();
  return end - task.startedAt; // ms
};

export const getLeadTime = (task) => {
  if (!task.createdAt) return null;
  const end = task.completedAt || Date.now();
  return end - task.createdAt; // ms
};

export const formatDuration = (ms) => {
  if (!ms || ms < 0) return '--:--';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
};

/* ── Migrate old tasks ────────────────────────────────────── */
export function migrateTasks() {
  state.tasks.forEach(t => {
    if (!t.createdAt)  t.createdAt  = Date.now();
    if (!t.complexity) t.complexity = 'medium';
    if (!t.estimatedMinutes) t.estimatedMinutes = 30;
  });
}
