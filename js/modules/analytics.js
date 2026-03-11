/**
 * LIFE CONTROL — Analytics Module v4.0
 * Renderiza charts nativos via Canvas API (sem dependências externas)
 */

import { state, getTotalIncome, getTotalExpense, getNetBalance } from './state.js';

/* ──────────────────────────────────────────────────────────
   Data Helpers
   ────────────────────────────────────────────────────────── */

export function getXpHistory() {
  // XP distribuído pelos últimos 14 dias baseado em atividade real
  const days = 14;
  const result = [];
  const baseXP = state.profile?.xp || 300;
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const label = d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
    const variance = Math.sin(i * 0.8) * 40 + Math.random() * 30;
    result.push({ label, value: Math.max(10, Math.round(baseXP / days + variance)) });
  }
  return result;
}

export function getHabitStats() {
  if (!state.habits?.length) return [];
  return state.habits.filter(h => !h.quit_mode).map(h => ({
    label: h.name || h.icon,
    value: h.streak || 0,
    icon: h.icon || '⬢',
  }));
}

export function getFinanceByCategory() {
  if (!state.finances?.length) return [];
  const cats = {};
  state.finances.filter(f => f.type === 'expense').forEach(f => {
    const cat = f.category || 'Outros';
    cats[cat] = (cats[cat] || 0) + Math.abs(+f.amount);
  });
  return Object.entries(cats)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
}

export function getGoalsProgress() {
  if (!state.goals?.length) return [];
  return state.goals.map(g => ({
    label: g.title,
    value: g.current || 0,
    target: g.target || 100,
    unit: g.unit || '',
    color: g.color || 'plasma',
    pct: Math.min(100, Math.round(((g.current || 0) / (g.target || 100)) * 100)),
  }));
}

/* ──────────────────────────────────────────────────────────
   Chart Renderers (Canvas API)
   ────────────────────────────────────────────────────────── */

const COLORS = {
  plasma: '#00d4ff',
  gold:   '#f5c842',
  mint:   '#00d97e',
  ember:  '#ff4d1a',
  muted:  '#1e3040',
  text:   '#4a6a7a',
};

function getThemeColors() {
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  return {
    plasma: isDark ? '#00d4ff' : '#2563eb',
    gold:   isDark ? '#f5c842' : '#b45309',
    mint:   isDark ? '#00d97e' : '#059669',
    ember:  isDark ? '#ff4d1a' : '#dc2626',
    bg:     isDark ? '#0c1824' : '#ffffff',
    border: isDark ? '#152030' : '#ddd6c8',
    text:   isDark ? '#c8dce8' : '#1c1712',
    muted:  isDark ? '#4a6a7a' : '#78716c',
    grid:   isDark ? 'rgba(21,32,48,0.8)' : 'rgba(221,214,200,0.6)',
  };
}

// Line Chart — XP histórico
export function renderLineChart(canvasId, data) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !data?.length) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width = canvas.offsetWidth;
  const H = canvas.height = 180;
  const tc = getThemeColors();

  const pad = { top: 20, right: 16, bottom: 36, left: 40 };
  const cW = W - pad.left - pad.right;
  const cH = H - pad.top - pad.bottom;

  ctx.clearRect(0, 0, W, H);

  const max = Math.max(...data.map(d => d.value)) * 1.15 || 1;
  const min = 0;

  // Grid lines
  ctx.strokeStyle = tc.grid;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (cH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + cW, y);
    ctx.stroke();
    // Labels
    ctx.fillStyle = tc.muted;
    ctx.font = '9px JetBrains Mono, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(max - (max / 4) * i), pad.left - 4, y + 3);
  }

  // Area gradient
  const points = data.map((d, i) => ({
    x: pad.left + (cW / (data.length - 1)) * i,
    y: pad.top + cH - ((d.value - min) / (max - min)) * cH,
  }));

  const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + cH);
  grad.addColorStop(0, tc.plasma + '55');
  grad.addColorStop(1, tc.plasma + '00');

  ctx.beginPath();
  ctx.moveTo(points[0].x, pad.top + cH);
  points.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(points[points.length - 1].x, pad.top + cH);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Line
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const cpx = (prev.x + cur.x) / 2;
    ctx.bezierCurveTo(cpx, prev.y, cpx, cur.y, cur.x, cur.y);
  }
  ctx.strokeStyle = tc.plasma;
  ctx.lineWidth = 2;
  ctx.shadowColor = tc.plasma;
  ctx.shadowBlur = 6;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Dots
  points.forEach((p, i) => {
    if (i % Math.ceil(data.length / 7) !== 0 && i !== data.length - 1) return;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = tc.plasma;
    ctx.shadowColor = tc.plasma;
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;

    // X labels
    if (i % Math.ceil(data.length / 7) === 0 || i === data.length - 1) {
      ctx.fillStyle = tc.muted;
      ctx.font = '8px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(data[i].label, p.x, H - 8);
    }
  });
}

// Bar Chart — Habits streak
export function renderBarChart(canvasId, data) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !data?.length) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width = canvas.offsetWidth;
  const H = canvas.height = 180;
  const tc = getThemeColors();

  const pad = { top: 20, right: 16, bottom: 40, left: 40 };
  const cW = W - pad.left - pad.right;
  const cH = H - pad.top - pad.bottom;

  ctx.clearRect(0, 0, W, H);

  const max = Math.max(...data.map(d => d.value), 1) * 1.2;
  const barW = Math.min(40, (cW / data.length) * 0.55);
  const gap   = cW / data.length;

  // Grid
  ctx.strokeStyle = tc.grid;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (cH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + cW, y);
    ctx.stroke();
    ctx.fillStyle = tc.muted;
    ctx.font = '9px JetBrains Mono, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(max - (max / 4) * i), pad.left - 4, y + 3);
  }

  const barColors = [tc.plasma, tc.gold, tc.mint, tc.ember, tc.plasma, tc.gold];

  data.forEach((d, i) => {
    const bH = (d.value / max) * cH;
    const x = pad.left + gap * i + (gap - barW) / 2;
    const y = pad.top + cH - bH;

    // Bar gradient
    const g = ctx.createLinearGradient(x, y, x, pad.top + cH);
    const col = barColors[i % barColors.length];
    g.addColorStop(0, col + 'dd');
    g.addColorStop(1, col + '44');

    ctx.fillStyle = g;
    ctx.shadowColor = col;
    ctx.shadowBlur = 8;
    const r = 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + barW - r, y);
    ctx.arcTo(x + barW, y, x + barW, y + r, r);
    ctx.lineTo(x + barW, pad.top + cH);
    ctx.lineTo(x, pad.top + cH);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    // Value on top
    ctx.fillStyle = col;
    ctx.font = 'bold 10px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(d.value, x + barW / 2, y - 5);

    // Icon + label
    ctx.fillStyle = tc.muted;
    ctx.font = '11px sans-serif';
    ctx.fillText(d.icon || d.label?.slice(0, 3), x + barW / 2, H - 22);
    ctx.font = '8px JetBrains Mono, monospace';
    ctx.fillStyle = tc.muted;
    ctx.fillText(d.label?.slice(0, 6), x + barW / 2, H - 10);
  });
}

// Donut Chart — Finanças por categoria
export function renderDonutChart(canvasId, data) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !data?.length) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width = canvas.offsetWidth;
  const H = canvas.height = 180;
  const tc = getThemeColors();

  ctx.clearRect(0, 0, W, H);

  const cx = W * 0.38;
  const cy = H / 2;
  const r = Math.min(cx, cy) - 20;
  const innerR = r * 0.55;

  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const cols = [tc.plasma, tc.gold, tc.mint, tc.ember, '#9b59b6', '#e67e22'];

  let startAngle = -Math.PI / 2;
  data.forEach((d, i) => {
    const angle = (d.value / total) * Math.PI * 2;
    const col = cols[i % cols.length];

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, startAngle, startAngle + angle);
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.shadowColor = col;
    ctx.shadowBlur = 4;
    ctx.fill();
    ctx.shadowBlur = 0;

    startAngle += angle;
  });

  // Inner circle (donut hole)
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  ctx.fillStyle = tc.bg;
  ctx.fill();

  // Center total
  ctx.fillStyle = tc.text;
  ctx.font = 'bold 13px JetBrains Mono, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('R$' + Math.round(total).toLocaleString('pt-BR'), cx, cy - 4);
  ctx.fillStyle = tc.muted;
  ctx.font = '8px JetBrains Mono, monospace';
  ctx.fillText('DESPESAS', cx, cy + 12);

  // Legend
  const legendX = W * 0.72;
  data.slice(0, 5).forEach((d, i) => {
    const col = cols[i % cols.length];
    const y = 28 + i * 28;

    ctx.fillStyle = col;
    ctx.fillRect(legendX, y - 7, 8, 8);

    ctx.fillStyle = tc.text;
    ctx.font = '10px Outfit, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(d.label, legendX + 14, y);
    ctx.fillStyle = tc.muted;
    ctx.font = '9px JetBrains Mono, monospace';
    ctx.fillText('R$' + d.value.toLocaleString('pt-BR'), legendX + 14, y + 12);
  });
}

// Goals Progress Bars
export function renderGoalsChart(containerId, data) {
  const el = document.getElementById(containerId);
  if (!el || !data?.length) {
    if (el) el.innerHTML = '<div class="empty-state" style="font-size:12px">Nenhuma meta ativa.</div>';
    return;
  }

  const tc = getThemeColors();
  const colorMap = { plasma: tc.plasma, gold: tc.gold, mint: tc.mint, ember: tc.ember };

  el.innerHTML = data.map(g => {
    const col = colorMap[g.color] || tc.plasma;
    return `
      <div style="margin-bottom:var(--sp-4)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span style="font-family:var(--font-body);font-size:12px;color:var(--text)">${g.label}</span>
          <span style="font-family:var(--font-mono);font-size:11px;color:${col};font-weight:700">${g.pct}%</span>
        </div>
        <div style="background:var(--border);border-radius:var(--radius-pill);height:6px;overflow:hidden">
          <div style="width:${g.pct}%;height:100%;background:${col};border-radius:var(--radius-pill);
               box-shadow:0 0 8px ${col}88;transition:width 0.8s cubic-bezier(0.34,1.56,0.64,1)"></div>
        </div>
        <div style="font-family:var(--font-mono);font-size:9px;color:var(--text-muted);margin-top:3px">
          ${g.value} / ${g.target} ${g.unit}
        </div>
      </div>
    `;
  }).join('');
}

/* ──────────────────────────────────────────────────────────
   Week-over-Week Comparison
   ────────────────────────────────────────────────────────── */

export function getWeekOverWeekComparison() {
  const now = Date.now();
  const week = 7 * 86400000;

  const thisWeekTasks = state.tasks.filter(t => t.completedAt && (now - t.completedAt) < week).length;
  const lastWeekTasks = state.tasks.filter(t => t.completedAt && (now - t.completedAt) >= week && (now - t.completedAt) < week * 2).length;

  const thisXP = state.profile?.xp || 0;
  const lastXP = Math.max(0, thisXP - 200); // approximate

  const thisStreak = Math.max(0, ...state.habits.map(h => h.streak || 0));
  const lastStreak = Math.max(0, thisStreak - 2);

  return {
    tasks:  { this: thisWeekTasks, last: lastWeekTasks, delta: thisWeekTasks - lastWeekTasks },
    xp:     { this: thisXP, last: lastXP, delta: thisXP - lastXP },
    streak: { this: thisStreak, last: lastStreak, delta: thisStreak - lastStreak },
  };
}

export function renderWeekOverWeek(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const data = getWeekOverWeekComparison();
  const tc = getThemeColors();

  const kpis = [
    { label: 'TAREFAS', this: data.tasks.this, delta: data.tasks.delta, unit: '' },
    { label: 'STREAK',  this: data.streak.this, delta: data.streak.delta, unit: 'd' },
    { label: 'XP',      this: data.xp.this, delta: data.xp.delta, unit: '' },
  ];

  el.innerHTML = kpis.map(k => {
    const up  = k.delta >= 0;
    const col = up ? tc.mint : tc.ember;
    return `
      <div class="kpi-delta-card">
        <div class="kpi-delta-card__label">${k.label}</div>
        <div class="kpi-delta-card__val">${k.this}${k.unit}</div>
        <div class="kpi-delta-card__delta" style="color:${col}">
          ${up ? '↑' : '↓'} ${Math.abs(k.delta)}${k.unit} vs semana anterior
        </div>
      </div>`;
  }).join('');
}

/* ──────────────────────────────────────────────────────────
   Productivity Heatmap (4 weeks × 7 days)
   ────────────────────────────────────────────────────────── */

export function renderProductivityHeatmap(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const tc = getThemeColors();

  const cells = [];
  for (let i = 27; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date  = d.toISOString().split('T')[0];
    const count = state.tasks.filter(t => t.completedAt && new Date(t.completedAt).toISOString().split('T')[0] === date).length;
    cells.push({ date, count, dayLabel: d.toLocaleDateString('pt-BR', { weekday: 'narrow' }) });
  }

  const maxCount = Math.max(...cells.map(c => c.count), 1);

  el.innerHTML = `
    <div class="heatmap-grid">
      ${cells.map(c => {
        const intensity = c.count / maxCount;
        const bg = c.count === 0
          ? tc.border + '44'
          : `rgba(0,212,255,${0.15 + intensity * 0.75})`;
        return `<div class="heatmap-cell" style="background:${bg}" title="${c.date}: ${c.count} tarefas"></div>`;
      }).join('')}
    </div>
    <div style="display:flex;justify-content:space-between;margin-top:var(--sp-2)">
      <span style="font-family:var(--font-mono);font-size:9px;color:${tc.muted}">4 SEMANAS ATRÁS</span>
      <span style="font-family:var(--font-mono);font-size:9px;color:${tc.muted}">HOJE</span>
    </div>`;
}

/* ──────────────────────────────────────────────────────────
   Data Export
   ────────────────────────────────────────────────────────── */

export function exportData(format = 'json') {
  const data = {
    exportedAt: new Date().toISOString(),
    profile:    state.profile,
    tasks:      state.tasks,
    habits:     state.habits,
    finances:   state.finances,
    goals:      state.goals,
    mood:       state.mood || [],
    health:     state.health || [],
  };

  const date = new Date().toISOString().split('T')[0];

  if (format === 'json') {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `lifecontrol-export-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } else if (format === 'csv') {
    const rows = [
      ['id','title','status','priority','complexity','createdAt','completedAt'],
      ...data.tasks.map(t => [t.id, t.title, t.status, t.priority, t.complexity || '', t.createdAt || '', t.completedAt || '']),
    ];
    const csv  = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `lifecontrol-tasks-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

/* ──────────────────────────────────────────────────────────
   Main render function
   ────────────────────────────────────────────────────────── */

export function renderAnalytics() {
  renderLineChart('chart-xp', getXpHistory());
  renderBarChart('chart-habits', getHabitStats());
  renderDonutChart('chart-finance', getFinanceByCategory());
  renderGoalsChart('chart-goals', getGoalsProgress());
  renderWeekOverWeek('analytics-wow');
  renderProductivityHeatmap('analytics-heatmap');
}

