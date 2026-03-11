/**
 * LIFE CONTROL — Actions Module
 * Todas as mutações iniciadas pelo usuário.
 * Padrão: validar → update optimista → persistir → renderizar
 */

import { state, TODAY }     from './state.js';
import {
  insertTask, patchTaskStatus, removeTask,
  insertHabit, checkHabit, logRelapse,
  insertFinance, removeFinance,
  insertGoal, updateGoalProgress as dbUpdateGoalProgress,
  patchProfile,
}                           from './supabase.js';
import { awardXP, triggerJackpot, fireParticles } from './gamification.js';
import { renderKanban, renderHabits, renderQuit, renderFinances, renderGoals, updateTopBar } from './ui.js';
import { showToast }        from './toast.js';

// ─── Tasks ────────────────────────────────────────────────────────────────────

export function toggleTaskForm() {
  document.getElementById('taskFormArea').classList.toggle('task-form--open');
}

export async function addTask() {
  const titleEl = document.getElementById('newTaskTitle');
  const title   = titleEl?.value.trim();
  if (!title) { showToast('Digite um título para a tarefa.', 'error'); return; }

  const deadlineVal = document.getElementById('newTaskDeadline')?.value;
  const deadline    = deadlineVal ? new Date(deadlineVal).getTime() : null;

  try {
    await insertTask({
      title,
      status:           'backlog',
      priority:         document.getElementById('newTaskPriority')?.value || 'high',
      tags:             [document.getElementById('newTaskTag')?.value || 'work'],
      complexity:       document.getElementById('newTaskComplexity')?.value || 'low',
      estimatedMinutes: parseInt(document.getElementById('newTaskEstimate')?.value) || 30,
      createdAt:        Date.now(),
      deadline,
    });
    titleEl.value = '';
    if (document.getElementById('newTaskDeadline')) document.getElementById('newTaskDeadline').value = '';
    document.getElementById('taskFormArea').classList.remove('task-form--open');
    renderKanban();
    updateTopBar();
    showToast('Tarefa criada! +10 XP', 'success');
    await awardXP(10);

    // Persist snapshot
    const newTask = state.tasks.find(t => t.title === title);
    if (newTask) {
      import('./kanban-engine.js').then(E => E.persistTaskSnapshot(newTask));
    }
  } catch (e) {
    showToast('Erro ao criar tarefa: ' + e.message, 'error');
  }
}

export async function deleteTask(id) {
  try {
    await removeTask(id);
    renderKanban();
    updateTopBar();
  } catch (e) {
    showToast('Erro: ' + e.message, 'error');
  }
}

export async function dropTask(id, status) {
  try {
    const task = state.tasks.find(t => t.id === id);
    if (task) {
      const now = Date.now();
      const nowISO = new Date(now).toISOString();
      // Set both naming conventions so UI always works regardless of DB/demo
      if (status === 'doing' && !task.started_at && !task.startedAt) {
        task.started_at = nowISO;
        task.startedAt  = now;
      }
      if (status === 'done') {
        task.completed_at = nowISO;
        task.completedAt  = now;
      }
      if (status !== 'done') {
        task.completed_at = null;
        task.completedAt  = null;
      }
    }
    const result = await patchTaskStatus(id, status);
    renderKanban();
    updateTopBar();

    // Persist analytics snapshot
    if (task) {
      import('./kanban-engine.js').then(E => E.persistTaskSnapshot(task));
    }

    if (status === 'done') {
      const xp = result?.xp_earned ?? 50;
      triggerJackpot('MISSÃO', 'CONCLUÍDA!', `+${xp} XP`);
      if (!result?.profile) await awardXP(xp);
    }
  } catch (e) {
    showToast('Erro: ' + e.message, 'error');
  }
}

// ─── Habits ───────────────────────────────────────────────────────────────────

export async function doCheckHabit(id) {
  try {
    const result = await checkHabit(id);

    if (result?.error === 'already_checked') {
      showToast('Hábito já marcado hoje! ✓', '');
      return;
    }

    renderHabits();
    updateTopBar();

    const row = document.getElementById(`habit-${id}`);
    if (row) {
      row.classList.add('habit-row--celebrate');
      setTimeout(() => row.classList.remove('habit-row--celebrate'), 900);
    }

    fireParticles('check', window.innerWidth - 80, 80);

    const streak = result?.streak ?? 0;
    const xp     = result?.xp_earned ?? 30;

    if (result?.milestone) {
      const habitName = state.habits.find(h => h.id === id)?.name?.toUpperCase() ?? 'HÁBITO';
      triggerJackpot(`🔥 ${streak} DIAS`, habitName, `+${xp} XP BÔNUS!`);
    } else {
      showToast(`✓ Streak: ${streak} dias! +${xp} XP`, 'success');
    }
  } catch (e) {
    showToast('Erro: ' + e.message, 'error');
  }
}

export async function addHabit() {
  const name = prompt('Nome do hábito:');
  if (!name?.trim()) return;
  const ICONS = ['💪','📚','🧘','💧','🌅','🏃','🎯','✍️','🎵','🥗','😴','🧠'];
  const icon  = ICONS[Math.floor(Math.random() * ICONS.length)];
  try {
    await insertHabit({ name: name.trim(), icon, streak: 0, last_check: null, quit_mode: false });
    renderHabits();
    showToast('Hábito adicionado!', 'success');
  } catch (e) {
    showToast('Erro: ' + e.message, 'error');
  }
}

export async function addQuitHabit() {
  const name = prompt('Qual vício você está superando?');
  if (!name?.trim()) return;
  const ICONS = ['🚬','🍺','🍭','📱','🎮','☕','🍔','🍷','🍕'];
  const icon  = ICONS[Math.floor(Math.random() * ICONS.length)];
  try {
    await insertHabit({ name: name.trim(), icon, streak: 0, last_check: null,
                        quit_mode: true, quit_date: TODAY() });
    renderQuit();
    showToast('Tracker adicionado. Você consegue! 💪', 'success');
  } catch (e) {
    showToast('Erro: ' + e.message, 'error');
  }
}

export async function relapse(id) {
  const note = prompt('O que aconteceu? (opcional — pressione Cancelar para abortar):');
  if (note === null) return;
  try {
    const result = await logRelapse(id, note || null);
    renderQuit();
    showToast(
      `Não desanime — streak anterior: ${result?.previous_streak ?? 0} dias. Cada dia é um recomeço. 💪`,
      ''
    );
  } catch (e) {
    showToast('Erro: ' + e.message, 'error');
  }
}

// ─── Finances ─────────────────────────────────────────────────────────────────

export async function addTransaction() {
  const desc = prompt('Descrição:');
  if (!desc?.trim()) return;
  const amount = parseFloat(prompt('Valor (R$):'));
  if (isNaN(amount) || amount <= 0) { showToast('Valor inválido.', 'error'); return; }
  const type     = confirm('Tipo:\n\nOK = Receita\nCancelar = Despesa') ? 'income' : 'expense';
  const category = prompt('Categoria (ex: Moradia, Saúde, Lazer):') || 'Geral';

  try {
    await insertFinance({ description: desc.trim(), amount, type, category });
    renderFinances();
    showToast('Lançamento registrado!', 'success');
  } catch (e) {
    showToast('Erro: ' + e.message, 'error');
  }
}

export async function deleteTransaction(id) {
  try {
    await removeFinance(id);
    renderFinances();
  } catch (e) {
    showToast('Erro: ' + e.message, 'error');
  }
}

// ─── Goals ────────────────────────────────────────────────────────────────────

export async function addGoal() {
  const title  = prompt('Título da meta:');
  if (!title?.trim()) return;
  const target = parseFloat(prompt('Valor alvo:'));
  if (isNaN(target) || target <= 0) { showToast('Valor alvo inválido.', 'error'); return; }
  const unit     = prompt('Unidade (R$, %, km, kg, livros…):') || 'pts';
  const deadline = prompt('Prazo (AAAA-MM-DD, opcional):') || null;
  const COLORS   = ['plasma','gold','mint','ember'];
  const color    = COLORS[Math.floor(Math.random() * COLORS.length)];

  try {
    await insertGoal({ title: title.trim(), target, current: 0, unit, color,
                       deadline: deadline || null });
    renderGoals();
    showToast('Meta criada! 🎯', 'success');
  } catch (e) {
    showToast('Erro: ' + e.message, 'error');
  }
}

export async function updateGoalProgress(id) {
  const val  = parseFloat(prompt('Adicionar progresso (valor):'));
  if (isNaN(val) || val <= 0) return;
  const note = prompt('Nota (opcional):') || null;

  try {
    const result = await dbUpdateGoalProgress(id, val, note);
    renderGoals();

    if (result?.completed) {
      triggerJackpot('META 🏆', 'ALCANÇADA!', `+${result.xp_earned} XP`);
    } else {
      showToast(`Progresso: ${result?.pct ?? '?'}% — +${result?.xp_earned ?? 20} XP`, 'success');
    }
    updateTopBar();
  } catch (e) {
    showToast('Erro: ' + e.message, 'error');
  }
}

export function celebrateGoal() {
  triggerJackpot('🏆 JACKPOT', 'META 100% COMPLETA!', '+500 XP');
  awardXP(500);
}

// ─── Exporta nomes usados em app.js ──────────────────────────────────────────
export { doCheckHabit as checkHabit };
