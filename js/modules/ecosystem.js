/**
 * LIFE CONTROL — Ecosystem Integration Module
 * Conecta Tarefas, Hábitos, Metas e Financeiro de forma integrada
 */

import { state, TODAY } from './state.js';

/**
 * Calcula XP para uma tarefa concluída
 * Baseado em: prioridade + complexidade + tempo estimado
 */
export function calculateTaskXP(task) {
  let xp = 50; // Base
  
  // Prioridade
  if (task.priority === 'high') xp += 30;
  else if (task.priority === 'med') xp += 15;
  else if (task.priority === 'low') xp += 5;
  
  // Complexidade
  if (task.complexity === 'high') xp += 25;
  else if (task.complexity === 'medium') xp += 12;
  
  // Tempo (bônus por eficiência)
  if (task.estimatedMinutes) {
    const cycle = task.completedAt && task.startedAt 
      ? (task.completedAt - task.startedAt) / 60000 
      : 0;
    if (cycle > 0 && cycle <= task.estimatedMinutes * 1.2) {
      xp += 10; // Bônus eficiência
    }
  }
  
  return xp;
}

/**
 * Conecta uma tarefa a uma meta
 * Retorna qual meta a tarefa ajuda e quanto contribui
 */
export function linkTaskToGoal(task) {
  // Busca por tags
  const goal = state.goals?.find(g => {
    const taskTags = (task.tags || []);
    return g.title.toLowerCase().includes(taskTags[0]?.toLowerCase() || '');
  });
  
  if (goal && task.status === 'done') {
    // Calcula contribuição
    const contribution = Math.max(1, Math.floor(calculateTaskXP(task) / 10));
    return {
      goalId: goal.id,
      goalTitle: goal.title,
      contribution: contribution,
      message: `Tarefa contribuiu com ${contribution} para meta "${goal.title}"`
    };
  }
  
  return null;
}

/**
 * Calcula ganhos financeiros de uma meta concluída
 */
export function calculateGoalReward(goal) {
  const progress = (goal.current / goal.target) * 100;
  
  if (progress === 100) {
    // Bônus por conclusão
    let reward = 1000; // Base
    
    // Bônus por valor da meta
    if (goal.target > 50000) reward += 500;
    else if (goal.target > 10000) reward += 200;
    
    return {
      coins: Math.round(reward / 10),
      xp: reward,
      message: `Meta "${goal.title}" concluída! +${Math.round(reward / 10)} moedas`,
    };
  }
  
  return null;
}

/**
 * Calcula XP e rewards de hábitos completados
 */
export function calculateHabitReward(habit) {
  let xp = 25; // Base por dia
  
  // Bônus por streak
  if (habit.streak >= 7) xp += 10;
  if (habit.streak >= 30) xp += 20;
  if (habit.streak >= 100) xp += 50;
  
  return {
    xp: xp,
    coins: Math.floor(xp / 5),
    streak: habit.streak,
    message: `Hábito conquistado! 🔥 ${habit.streak} dias | +${xp} XP`,
  };
}

/**
 * Conecta saúde/humor com gamification
 * Fornece bônus quando dados de saúde são registrados
 */
export function calculateHealthReward(data) {
  // data: { sleep, water, weight, mood_level, energy }
  
  // Bônus se dormiu bem (7-9 horas)
  const sleepXp = data.sleep >= 7 && data.sleep <= 9 ? 15 : 5;
  
  // Bônus se bebeu água adequada (2L+)
  const waterXp = data.water >= 8 ? 10 : 0;
  
  // Bônus se humor é positivo (4-5)
  const moodXp = data.mood_level >= 4 ? 15 : 0;
  
  const totalXp = sleepXp + waterXp + moodXp;
  
  return {
    xp: totalXp,
    breakdown: { sleep: sleepXp, water: waterXp, mood: moodXp },
    message: totalXp > 0 ? `Dia saudável! +${totalXp} XP` : null,
  };
}

/**
 * Dashboard integrado - retorna visão holística do progresso
 */
export function getEcosystemDashboard() {
  const today = TODAY();
  
  // Tasks
  const activeTasks = state.tasks?.filter(t => t.status !== 'done') || [];
  const todayTasks = activeTasks.filter(t => {
    const created = new Date(t.createdAt);
    const createdDate = created.toISOString().split('T')[0];
    return createdDate === today;
  });
  
  // Habits
  const habits = state.habits || [];
  const completedHabitsToday = habits.filter(h => h.last_check === today && !h.quit_mode);
  
  // Goals progress
  const goals = state.goals || [];
  const goalsNearCompletion = goals.filter(g => (g.current / g.target) >= 0.8);
  
  // Finance
  const finances = state.finances || [];
  const thisMonthIncome = finances
    .filter(f => f.type === 'income' && _isThisMonth(f.created_at))
    .reduce((sum, f) => sum + Number(f.amount), 0);
  const thisMonthExpense = finances
    .filter(f => f.type === 'expense' && _isThisMonth(f.created_at))
    .reduce((sum, f) => sum + Number(f.amount), 0);
  
  return {
    today,
    tasks: {
      active: activeTasks.length,
      today: todayTasks.length,
      blocked: activeTasks.filter(t => t.status === 'blocked').length,
    },
    habits: {
      total: habits.filter(h => !h.quit_mode).length,
      completedToday: completedHabitsToday.length,
      streakAvg: Math.round(habits.reduce((s, h) => s + (h.streak || 0), 0) / Math.max(1, habits.length)),
    },
    goals: {
      total: goals.length,
      nearCompletion: goalsNearCompletion.length,
      avgProgress: Math.round(goals.reduce((s, g) => s + (g.current / g.target), 0) / Math.max(1, goals.length) * 100),
    },
    finance: {
      thisMonthIncome,
      thisMonthExpense,
      balance: thisMonthIncome - thisMonthExpense,
      savingsRate: thisMonthIncome > 0 ? ((thisMonthIncome - thisMonthExpense) / thisMonthIncome * 100) : 0,
    },
    health: {
      hasMoodEntry: state.mood?.some(m => m.date === today),
      hasHealthEntry: state.health?.some(h => h.date === today),
    },
  };
}

/**
 * Recomendações inteligentes baseadas no ecosistema
 */
export function getSmartRecommendations() {
  const dashboard = getEcosystemDashboard();
  const recommendations = [];
  
  // Tarefas
  if (dashboard.tasks.active > 10) {
    recommendations.push({
      type: 'task',
      priority: 'high',
      message: 'Você tem muitas tarefas ativas. Considere focar em poucas e terminar bem.',
      action: 'Ver kanban com filtro de prioridade alta',
    });
  }
  
  if (dashboard.tasks.blocked > 0) {
    recommendations.push({
      type: 'task',
      priority: 'high',
      message: `${dashboard.tasks.blocked} tarefa(s) bloqueada(s). Resolva os bloqueadores!`,
      action: 'Ver tarefas bloqueadas',
    });
  }
  
  // Hábitos
  if (dashboard.habits.completedToday === 0 && dashboard.habits.total > 0) {
    recommendations.push({
      type: 'habit',
      priority: 'medium',
      message: 'Nenhum hábito completado hoje. Comece pelo mais fácil!',
      action: 'Ver hábitos',
    });
  }
  
  // Goals
  if (dashboard.goals.nearCompletion > 0) {
    recommendations.push({
      type: 'goal',
      priority: 'medium',
      message: `${dashboard.goals.nearCompletion} meta(s) perta de conclusão! Você consegue!`,
      action: 'Ver metas',
    });
  }
  
  // Financeiro
  if (dashboard.finance.balance < 0) {
    recommendations.push({
      type: 'finance',
      priority: 'high',
      message: 'Você está no vermelho este mês. Revise seus gastos.',
      action: 'Ver financeiro',
    });
  }
  
  if (dashboard.finance.savingsRate < 10) {
    recommendations.push({
      type: 'finance',
      priority: 'medium',
      message: 'Sua taxa de economia é baixa. Busque reduzir despesas.',
      action: 'Ver financeiro',
    });
  }
  
  return recommendations;
}

function _isThisMonth(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

// Export para debug
window._getEcosystemDashboard = getEcosystemDashboard;
window._getSmartRecommendations = getSmartRecommendations;
