/**
 * LIFE CONTROL — Health & Sleep Module
 * Daily sleep, water, and weight tracking.
 */

import { state, TODAY } from './state.js';
import { showToast }    from './toast.js';

const LS_KEY = 'lc_health';

/* ── Load / Save ─────────────────────────────────────────── */
export function loadHealth() {
  try {
    state.health = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
  } catch { state.health = []; }
}

function _save() {
  localStorage.setItem(LS_KEY, JSON.stringify(state.health));
}

/* ── Getters ─────────────────────────────────────────────── */
export function getTodayHealth() {
  const today = TODAY();
  return state.health.find(h => h.date === today) || null;
}

export function getSleepHistory(days = 7) {
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = d.toISOString().split('T')[0];
    const entry = state.health.find(h => h.date === date);
    result.push({
      date,
      label: d.toLocaleDateString('pt-BR', { weekday: 'short' }),
      sleep: entry?.sleep || 0,
      water: entry?.water || 0,
    });
  }
  return result;
}

export function getWaterToday() {
  return getTodayHealth()?.water || 0;
}

export function getSleepAvg() {
  const hist = getSleepHistory(7).filter(d => d.sleep > 0);
  if (!hist.length) return 0;
  return (hist.reduce((s, d) => s + d.sleep, 0) / hist.length).toFixed(1);
}

export function getWeightTrend(days = 7) {
  return state.health
    .filter(h => h.weight)
    .slice(-days)
    .map(h => ({ date: h.date, weight: h.weight }));
}

/* ── Mutations ───────────────────────────────────────────── */
export function logSleep(hours) {
  const today = TODAY();
  let entry = state.health.find(h => h.date === today);
  if (!entry) { entry = { id: 'hlt' + Date.now(), date: today, sleep: 0, water: 0, weight: null }; state.health.unshift(entry); }
  entry.sleep = hours;
  _save();
  showToast(`😴 ${hours}h de sono registradas!`, 'success');
  renderHealth();
}

export function logWater(delta = 1) {
  const today = TODAY();
  let entry = state.health.find(h => h.date === today);
  if (!entry) { entry = { id: 'hlt' + Date.now(), date: today, sleep: 0, water: 0, weight: null }; state.health.unshift(entry); }
  entry.water = Math.max(0, (entry.water || 0) + delta);
  _save();
  renderHealth();
}

export function logWeight(kg) {
  const today = TODAY();
  let entry = state.health.find(h => h.date === today);
  if (!entry) { entry = { id: 'hlt' + Date.now(), date: today, sleep: 0, water: 0, weight: null }; state.health.unshift(entry); }
  entry.weight = kg;
  _save();
  showToast(`⚖️ ${kg}kg registrado!`, 'success');
  renderHealth();
}

/* ── Render ──────────────────────────────────────────────── */
export function renderHealth() {
  const container = document.getElementById('healthView');
  if (!container) return;

  const today   = getTodayHealth();
  const sleepAvg = getSleepAvg();
  const water   = getWaterToday();
  const hist    = getSleepHistory(7);
  const WATER_GOAL = 8;

  container.innerHTML = `
    <!-- Quick entry cards -->
    <div class="health-cards">

      <!-- Sleep -->
      <div class="health-card">
        <div class="health-card__icon">😴</div>
        <div class="health-card__label">SONO</div>
        <div class="health-card__value">${today?.sleep || 0}<span class="health-card__unit">h</span></div>
        <div class="health-card__controls">
          ${[5,6,7,8,9,10].map(h => `
            <button class="health-hour-btn ${today?.sleep === h ? 'health-hour-btn--active' : ''}"
                    onclick="window._logSleep(${h})">${h}h</button>`).join('')}
        </div>
        <div class="health-card__meta">Média 7d: <strong style="color:var(--plasma)">${sleepAvg}h</strong></div>
      </div>

      <!-- Water -->
      <div class="health-card">
        <div class="health-card__icon">💧</div>
        <div class="health-card__label">ÁGUA</div>
        <div class="health-card__value">${water}<span class="health-card__unit">/${WATER_GOAL} copos</span></div>
        <div class="water-counter">
          ${Array.from({length: WATER_GOAL}, (_, i) =>
            `<div class="water-dot ${i < water ? 'water-dot--filled' : ''}" onclick="window._logWater(${i < water ? -1 : 1})"></div>`
          ).join('')}
        </div>
        <div class="health-card__controls" style="margin-top:var(--sp-3)">
          <button class="btn btn--sm" onclick="window._logWater(-1)">−</button>
          <button class="btn btn--primary btn--sm" onclick="window._logWater(1)">+ COPO</button>
        </div>
      </div>

      <!-- Weight -->
      <div class="health-card">
        <div class="health-card__icon">⚖️</div>
        <div class="health-card__label">PESO</div>
        <div class="health-card__value">${today?.weight || '—'}<span class="health-card__unit">kg</span></div>
        <div class="health-card__controls" style="flex-direction:column;gap:var(--sp-2)">
          <input class="input" id="weightInput" type="number" placeholder="Ex: 75.5" step="0.1"
                 value="${today?.weight || ''}" style="font-size:14px;text-align:center">
          <button class="btn btn--primary btn--sm" onclick="window._logWeight()">SALVAR PESO</button>
        </div>
      </div>

    </div>

    <!-- Sleep chart -->
    <div class="health-chart-card">
      <div class="health-chart-label">SONO — ÚLTIMOS 7 DIAS</div>
      <canvas id="sleepChart" style="width:100%;max-height:120px"></canvas>
    </div>
  `;

  // Render sleep mini-chart (simple bar chart)
  _renderSleepBars(hist);
}

function _renderSleepBars(hist) {
  const canvas = document.getElementById('sleepChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width  = canvas.offsetWidth || 400;
  const H = canvas.height = 100;

  ctx.clearRect(0, 0, W, H);

  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  const plasma = isDark ? '#00d4ff' : '#2563eb';
  const gold   = isDark ? '#f5c842' : '#b45309';
  const muted  = isDark ? '#4a6a7a' : '#78716c';
  const border = isDark ? '#152030' : '#ddd6c8';

  const pad = { top: 10, bottom: 30, left: 8, right: 8 };
  const cW  = W - pad.left - pad.right;
  const cH  = H - pad.top - pad.bottom;
  const maxH = 10;
  const barW = Math.min(30, (cW / hist.length) * 0.6);
  const gap  = cW / hist.length;

  hist.forEach((d, i) => {
    const bH  = (d.sleep / maxH) * cH;
    const x   = pad.left + gap * i + (gap - barW) / 2;
    const y   = pad.top + cH - bH;
    const col = d.sleep >= 7 ? plasma : d.sleep >= 6 ? gold : '#ff4d1a';

    // Bar
    if (d.sleep > 0) {
      ctx.fillStyle = col + 'bb';
      ctx.shadowColor = col;
      ctx.shadowBlur  = 4;
      ctx.beginPath();
      ctx.roundRect(x, y, barW, bH, [2, 2, 0, 0]);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = col;
      ctx.font = 'bold 9px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(d.sleep + 'h', x + barW / 2, y - 3);
    } else {
      ctx.fillStyle = border;
      ctx.fillRect(x, pad.top + cH - 2, barW, 2);
    }

    // Day label
    ctx.fillStyle = muted;
    ctx.font = '9px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(d.label.toUpperCase(), x + barW / 2, H - 8);
  });
}

/* ── Global handlers ─────────────────────────────────────── */
window._logSleep  = (h)       => logSleep(h);
window._logWater  = (delta)   => logWater(delta);
window._logWeight = ()        => {
  const val = parseFloat(document.getElementById('weightInput')?.value);
  if (isNaN(val) || val <= 0) { showToast('Peso inválido.', 'error'); return; }
  logWeight(val);
};
