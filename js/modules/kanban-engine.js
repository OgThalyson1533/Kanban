/**
 * LIFE CONTROL — Kanban Intelligence Engine v1
 * Performance Score · Countdown · Timestamps · Analytics · Produtividade Geral
 */

import { state, getCycleTime, TODAY } from './state.js';

// Normalize a task object — handles both snake_case (DB) and camelCase (demo/legacy)
function _norm(t) {
  if (!t) return t;
  function _ms(v) {
    if (!v) return null;
    if (typeof v === 'number') return v;
    const d = new Date(v);
    return isNaN(d) ? null : d.getTime();
  }
  return {
    ...t,
    startedAt:        _ms(t.started_at   ?? t.startedAt),
    completedAt:      _ms(t.completed_at ?? t.completedAt),
    createdAt:        _ms(t.created_at   ?? t.createdAt),
    deadline:         _ms(t.deadline),
    estimatedMinutes: t.estimated_minutes ?? t.estimatedMinutes ?? null,
    storyPoints:      t.story_points      ?? t.storyPoints      ?? null,
    blockReason:      t.block_reason      ?? t.blockReason      ?? null,
  };
}

/* ══════════════════════════════════════════════════════════
   STORAGE
   ══════════════════════════════════════════════════════════ */
const LS_KEY = 'lc_kanban_analytics_v1';

function _loadAnalytics() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; }
}
function _saveAnalytics(data) {
  localStorage.setItem(LS_KEY, JSON.stringify(data));
}

/** Persist task snapshot for analytics (call on every status change) */
export function persistTaskSnapshot(task) {
  task = _norm(task);
  const analytics = _loadAnalytics();
  analytics[task.id] = {
    id:               task.id,
    title:            task.title.slice(0, 60),
    status:           task.status,
    priority:         task.priority,
    complexity:       task.complexity,
    estimatedMinutes: task.estimatedMinutes || 0,
    storyPoints:      task.storyPoints || 0,
    createdAt:        task.createdAt || Date.now(),
    startedAt:        task.startedAt || null,
    completedAt:      task.completedAt || null,
    deadline:         task.deadline || null,
    tags:             task.tags || [],
    loggedMinutes:    _getTotalLogged(task.id),
    savedAt:          Date.now(),
  };
  _saveAnalytics(analytics);
}

function _getTotalLogged(taskId) {
  try {
    const logs = JSON.parse(localStorage.getItem('lc_timelogs') || '{}');
    return (logs[taskId] || []).reduce((s, l) => s + l.minutes, 0);
  } catch { return 0; }
}

/* ══════════════════════════════════════════════════════════
   1. PERFORMANCE SCORE
   ══════════════════════════════════════════════════════════ */

/**
 * Score 0–100 baseado em:
 * - 50pts: cycle time vs estimado
 * - 20pts: entrega no prazo
 * - 20pts: complexidade × story points
 * - 10pts: sem bloqueios
 */
export function calcPerformanceScore(task) {
  task = _norm(task);
  if (!task.completedAt || !task.startedAt) return null;

  let score = 0;

  // Tempo: 50 pts
  if (task.estimatedMinutes) {
    const cycleMin = getCycleTime(task) / 60000;
    const ratio    = cycleMin / task.estimatedMinutes;
    if (ratio <= 0.8)      score += 50;
    else if (ratio <= 1.0) score += 45;
    else if (ratio <= 1.2) score += 35;
    else if (ratio <= 1.5) score += 20;
    else                   score += 5;
  } else {
    score += 25; // no estimate → neutral
  }

  // Prazo: 20 pts
  if (task.deadline) {
    if (task.completedAt <= task.deadline) score += 20;
    else {
      const late = (task.completedAt - task.deadline) / 86400000;
      score += late < 1 ? 10 : late < 3 ? 5 : 0;
    }
  } else {
    score += 10;
  }

  // Complexidade × SP: 20 pts
  const cxMap   = { low: 1, medium: 2, high: 3 };
  const cxScore = cxMap[task.complexity || 'medium'];
  if (cxScore === 3)      score += 20;
  else if (cxScore === 2) score += 13;
  else                    score += 6;

  // Sem bloqueio: 10 pts
  if (task.status !== 'blocked') score += 10;

  return Math.min(100, Math.max(0, score));
}

export function getEfficiencyMedal(task) {
  const score = calcPerformanceScore(task);
  if (score === null) return null;
  if (score >= 90) return { label: '🏆 ELITE',   color: '#f5c842', glow: 'rgba(245,200,66,0.5)',  tier: 'elite'   };
  if (score >= 75) return { label: '🥇 OURO',    color: '#f5c842', glow: 'rgba(245,200,66,0.35)', tier: 'gold'    };
  if (score >= 60) return { label: '🥈 PRATA',   color: '#00d4ff', glow: 'rgba(0,212,255,0.3)',   tier: 'silver'  };
  if (score >= 45) return { label: '🥉 BRONZE',  color: '#cd7f32', glow: 'rgba(205,127,50,0.3)',  tier: 'bronze'  };
  return null; // sem medalha abaixo de 45
}

/* ══════════════════════════════════════════════════════════
   2. COUNTDOWN SYSTEM
   ══════════════════════════════════════════════════════════ */

export function getDeadlineState(task) {
  task = _norm(task);
  if (!task.deadline || task.completedAt) return null;

  const now        = Date.now();
  const totalMs    = task.deadline - (task.createdAt || task.deadline - 86400000 * 7);
  const remainMs   = task.deadline - now;
  const elapsedPct = totalMs > 0 ? (1 - remainMs / totalMs) * 100 : 100;

  const absRemain  = Math.abs(remainMs);
  const days       = Math.floor(absRemain / 86400000);
  const hours      = Math.floor((absRemain % 86400000) / 3600000);
  const mins       = Math.floor((absRemain % 3600000) / 60000);
  const secs       = Math.floor((absRemain % 60000) / 1000);

  const isOverdue  = remainMs < 0;
  const pctLeft    = totalMs > 0 ? Math.max(0, remainMs / totalMs * 100) : 0;
  const isCritical = !isOverdue && pctLeft < 20; // < 20% do tempo restante → neon alert

  let label, urgency;
  if (isOverdue) {
    label   = days > 0 ? `-${days}d ${hours}h` : `-${hours}h${mins}m`;
    urgency = 'overdue';
  } else if (isCritical) {
    label   = days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${mins}m` : `${mins}m ${secs}s`;
    urgency = 'critical';
  } else if (days > 0) {
    label   = `${days}d ${hours}h`;
    urgency = days > 3 ? 'safe' : 'warn';
  } else {
    label   = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    urgency = 'warn';
  }

  return { label, urgency, isOverdue, isCritical, pctLeft, elapsedPct };
}

/* Countdown manager — ticks every second, updates only deadline elements */
let _countdownInterval = null;

export function startCountdownTicker() {
  if (_countdownInterval) clearInterval(_countdownInterval);
  _countdownInterval = setInterval(_tickCountdowns, 1000);
}

export function stopCountdownTicker() {
  if (_countdownInterval) clearInterval(_countdownInterval);
  _countdownInterval = null;
}

function _tickCountdowns() {
  document.querySelectorAll('[data-deadline-task]').forEach(el => {
    const taskId = el.dataset.deadlineTask;
    const task   = state.tasks.find(t => t.id === taskId);
    if (!task) return;
    const ds = getDeadlineState(task);
    if (!ds) { el.style.display = 'none'; return; }

    el.style.display       = '';
    el.dataset.urgency     = ds.urgency;
    el.querySelector('.cd-label').textContent = ds.label;

    // Update card border/glow
    const card = el.closest('.task-card');
    if (card) {
      card.dataset.deadline = ds.urgency;
    }
  });
}

/* ══════════════════════════════════════════════════════════
   3. WEEKLY PRODUCTIVITY CHART DATA
   ══════════════════════════════════════════════════════════ */

export function getWeeklyProductivityData() {
  const now    = new Date();
  const days   = [];

  for (let i = 6; i >= 0; i--) {
    const d     = new Date(now);
    d.setDate(d.getDate() - i);
    const ymd   = d.toISOString().split('T')[0];
    const label = d.toLocaleDateString('pt-BR', { weekday: 'short' }).slice(0,3).toUpperCase();

    const completed = state.tasks.filter(t => {
      if (!t.completedAt) return false;
      return new Date(t.completedAt).toISOString().split('T')[0] === ymd;
    });

    const started = state.tasks.filter(t => {
      if (!t.startedAt) return false;
      return new Date(t.startedAt).toISOString().split('T')[0] === ymd;
    });

    const onTime = completed.filter(t => {
      if (!t.deadline || !t.completedAt) return true;
      return t.completedAt <= t.deadline;
    });

    const avgScore = completed.length
      ? completed.reduce((s, t) => s + (calcPerformanceScore(t) || 50), 0) / completed.length
      : 0;

    days.push({ label, ymd, completed: completed.length, started: started.length, onTime: onTime.length, avgScore });
  }

  return days;
}

/* ══════════════════════════════════════════════════════════
   5. CALCULAR PRODUTIVIDADE GERAL
   ══════════════════════════════════════════════════════════ */

/**
 * Retorna objeto completo com métricas de produtividade.
 * Pode ser chamado de qualquer lugar via window.calcularProdutividadeGeral()
 */
export function calcularProdutividadeGeral() {
  const allTasks     = state.tasks;
  const done         = allTasks.filter(t => t.status === 'done' && t.completedAt);
  const withDeadline = done.filter(t => t.deadline);
  const onTime       = withDeadline.filter(t => t.completedAt <= t.deadline);
  const withEst      = done.filter(t => t.estimatedMinutes && t.startedAt);
  const efficient    = withEst.filter(t => getCycleTime(t) / 60000 <= t.estimatedMinutes * 1.1);

  // Scores
  const scores        = done.map(t => calcPerformanceScore(t)).filter(s => s !== null);
  const avgScore      = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const medals        = done.filter(t => getEfficiencyMedal(t)).length;

  // Cycle times
  const cycleTimes    = done.filter(t => t.startedAt).map(t => getCycleTime(t) / 60000);
  const avgCycleMin   = cycleTimes.length ? cycleTimes.reduce((a,b)=>a+b,0) / cycleTimes.length : 0;

  // This week
  const weekAgo       = Date.now() - 7 * 86400000;
  const thisWeek      = done.filter(t => t.completedAt > weekAgo);
  const weekOnTime    = thisWeek.filter(t => !t.deadline || t.completedAt <= t.deadline);

  const result = {
    // Taxas
    taxaEntregaTotal:     allTasks.length ? (done.length / allTasks.length * 100).toFixed(1) + '%' : '0%',
    taxaPrazo:            withDeadline.length ? (onTime.length / withDeadline.length * 100).toFixed(1) + '%' : 'N/A',
    taxaEficiencia:       withEst.length ? (efficient.length / withEst.length * 100).toFixed(1) + '%' : 'N/A',

    // Volumes
    totalConcluidas:      done.length,
    concluídasNoPrazo:    onTime.length,
    concluídasAtrasadas:  withDeadline.length - onTime.length,
    medalhasGanhas:       medals,

    // Performance
    scoreMedio:           avgScore.toFixed(1),
    tempoMedioCiclo:      avgCycleMin > 60 ? (avgCycleMin/60).toFixed(1) + 'h' : Math.round(avgCycleMin) + 'min',

    // Semana
    concluídasEstaSemana: thisWeek.length,
    taxaPrazoSemana:      thisWeek.length ? (weekOnTime.length / thisWeek.length * 100).toFixed(1) + '%' : 'N/A',

    // Status atual
    emAndamento:          allTasks.filter(t=>t.status==='doing').length,
    bloqueadas:           allTasks.filter(t=>t.status==='blocked').length,
    backlog:              allTasks.filter(t=>t.status==='backlog').length,

    // Avaliação qualitativa
    rating: (() => {
      if (!done.length)           return '⏳ Sem dados suficientes';
      const n = parseFloat(avgScore.toFixed(0));
      if (n >= 85) return '🏆 EXCEPCIONAL';
      if (n >= 70) return '⭐ ÓTIMO';
      if (n >= 55) return '👍 BOM';
      if (n >= 40) return '📈 EM DESENVOLVIMENTO';
      return '⚠ PRECISA MELHORAR';
    })(),
  };

  // Expose globally
  console.table(result);
  return result;
}

// Expose globally for console access
window.calcularProdutividadeGeral = calcularProdutividadeGeral;

/* ══════════════════════════════════════════════════════════
   DRAW WEEKLY CHART
   ══════════════════════════════════════════════════════════ */

export function drawWeeklyProductivityChart(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const ctx  = canvas.getContext('2d');
  const W    = canvas.width  = canvas.offsetWidth || 560;
  const H    = canvas.height = 140;
  const data = getWeeklyProductivityData();
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

  const PLASMA = isDark ? '#00d4ff' : '#2563eb';
  const MINT   = isDark ? '#00d97e' : '#059669';
  const GOLD   = isDark ? '#f5c842' : '#b45309';
  const EMBER  = isDark ? '#ff4d1a' : '#dc2626';
  const MUTED  = isDark ? '#4a6a7a' : '#78716c';
  const BORDER = isDark ? '#152030' : '#ddd6c8';

  ctx.clearRect(0, 0, W, H);

  const pad  = { top: 16, right: 12, bottom: 28, left: 28 };
  const cW   = W - pad.left - pad.right;
  const cH   = H - pad.top  - pad.bottom;
  const maxC = Math.max(...data.map(d => Math.max(d.completed, d.started)), 1);
  const bw   = (cW / data.length) * 0.28;
  const gap  = cW / data.length;

  // Grid lines
  for (let i = 0; i <= 3; i++) {
    const y = pad.top + (cH / 3) * i;
    ctx.strokeStyle = BORDER + '88';
    ctx.lineWidth   = 1;
    ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + cW, y); ctx.stroke();
    ctx.setLineDash([]);
    const val = Math.round(maxC * (1 - i / 3));
    if (val > 0) {
      ctx.fillStyle  = MUTED;
      ctx.font       = '8px JetBrains Mono, monospace';
      ctx.textAlign  = 'right';
      ctx.fillText(val, pad.left - 3, y + 3);
    }
  }

  // Score line (secondary axis)
  const scorePts = data.map((d, i) => ({
    x: pad.left + gap * i + gap / 2,
    y: pad.top + cH - (d.avgScore / 100) * cH,
  }));

  if (data.some(d => d.avgScore > 0)) {
    // Area fill
    const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + cH);
    grad.addColorStop(0, GOLD + '33');
    grad.addColorStop(1, GOLD + '00');
    ctx.beginPath();
    ctx.moveTo(scorePts[0].x, pad.top + cH);
    scorePts.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(scorePts.at(-1).x, pad.top + cH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    scorePts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.strokeStyle = GOLD;
    ctx.lineWidth   = 1.5;
    ctx.shadowColor = GOLD;
    ctx.shadowBlur  = 4;
    ctx.stroke();
    ctx.shadowBlur  = 0;
  }

  // Bars
  data.forEach((d, i) => {
    const cx = pad.left + gap * i + gap * 0.18;

    // Started bar
    if (d.started > 0) {
      const bh = (d.started / maxC) * cH;
      ctx.fillStyle = PLASMA + '44';
      ctx.fillRect(cx, pad.top + cH - bh, bw, bh);
    }

    // Completed bar
    if (d.completed > 0) {
      const bh = (d.completed / maxC) * cH;
      ctx.fillStyle = MINT;
      ctx.shadowColor = MINT;
      ctx.shadowBlur  = 6;
      ctx.fillRect(cx + bw + 2, pad.top + cH - bh, bw, bh);
      ctx.shadowBlur = 0;

      // On-time highlight
      if (d.onTime > 0 && d.onTime < d.completed) {
        const obh = (d.onTime / maxC) * cH;
        ctx.fillStyle = GOLD + 'CC';
        ctx.fillRect(cx + bw + 2, pad.top + cH - obh, bw, obh);
      }
    }

    // Day label
    ctx.fillStyle  = MUTED;
    ctx.font       = '8px JetBrains Mono, monospace';
    ctx.textAlign  = 'center';
    ctx.fillText(d.label, cx + bw + 2, H - 6);

    // Count on top
    if (d.completed > 0) {
      ctx.fillStyle = MINT;
      ctx.font      = '8px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      const bh = (d.completed / maxC) * cH;
      ctx.fillText(d.completed, cx + bw + 2 + bw/2, pad.top + cH - bh - 3);
    }
  });

  // Score dots
  scorePts.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fillStyle  = GOLD;
    ctx.shadowColor = GOLD;
    ctx.shadowBlur  = 6;
    ctx.fill();
    ctx.shadowBlur  = 0;
  });

  // Legend
  const legends = [
    { color: PLASMA + '88', label: 'INICIADAS' },
    { color: MINT,          label: 'CONCLUÍDAS' },
    { color: GOLD,          label: 'SCORE MÉDIO' },
  ];
  let lx = pad.left;
  legends.forEach(l => {
    ctx.fillStyle = l.color;
    ctx.fillRect(lx, H - 10, 8, 4);
    ctx.fillStyle = MUTED;
    ctx.font      = '7px JetBrains Mono, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(l.label, lx + 11, H - 6);
    lx += ctx.measureText(l.label).width + 26;
  });
}
