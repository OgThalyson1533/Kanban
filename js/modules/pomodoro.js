/**
 * LIFE CONTROL — Pomodoro Module
 * State machine: idle → work → break → longBreak
 * Web Audio API for sounds. No external assets.
 */

import { awardXP }   from './gamification.js';
import { showToast } from './toast.js';
import { state }     from './state.js';

/* ── Config ──────────────────────────────────────────────── */
const DURATIONS = {
  work:      25 * 60,
  break:      5 * 60,
  longBreak: 15 * 60,
};

/* ── State ───────────────────────────────────────────────── */
let _phase       = 'idle'; // idle | work | break | longBreak
let _remaining   = DURATIONS.work;
let _interval    = null;
let _sessions    = 0;
let _linkedTask  = null;
let _minimized   = false;

/* ── Audio ───────────────────────────────────────────────── */
function _beep(freq = 880, dur = 0.3, type = 'sine') {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + dur);
  } catch {}
}

function _playWorkEnd()  { _beep(660, 0.2); setTimeout(() => _beep(880, 0.3), 250); setTimeout(() => _beep(1100, 0.5), 550); }
function _playBreakEnd() { _beep(440, 0.3); setTimeout(() => _beep(550, 0.3), 400); }
function _playTick()     { _beep(1200, 0.05, 'square'); }

/* ── Tick ────────────────────────────────────────────────── */
function _tick() {
  if (_remaining <= 0) {
    _onPhaseEnd();
    return;
  }
  _remaining--;
  _render();
}

async function _onPhaseEnd() {
  clearInterval(_interval);
  _interval = null;

  if (_phase === 'work') {
    _sessions++;
    _playWorkEnd();
    await awardXP(50);
    showToast('🍅 Pomodoro completo! +50 XP', 'success');
    _phase     = _sessions % 4 === 0 ? 'longBreak' : 'break';
    _remaining = DURATIONS[_phase];
  } else {
    _playBreakEnd();
    showToast('☕ Pausa encerrada! Hora de focar.', 'success');
    _phase     = 'work';
    _remaining = DURATIONS.work;
  }

  _render();
  // Auto-start next phase
  _start();
}

/* ── Controls ────────────────────────────────────────────── */
function _start() {
  if (_interval) return;
  if (_phase === 'idle') _phase = 'work';
  _interval = setInterval(_tick, 1000);
  _render();
}

function _pause() {
  clearInterval(_interval);
  _interval = null;
  _render();
}

function _reset() {
  clearInterval(_interval);
  _interval  = null;
  _phase     = 'idle';
  _remaining = DURATIONS.work;
  _sessions  = 0;
  _render();
}

function _isRunning() { return _interval !== null; }

/* ── Link Task ───────────────────────────────────────────── */
function _linkTask(taskId) {
  const task  = state.tasks.find(t => t.id === taskId);
  _linkedTask = task || null;
  _render();
}

/* ── Render ──────────────────────────────────────────────── */
function _fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function _phaseLabel() {
  return { idle: 'PRONTO', work: 'FOCO', break: 'PAUSA', longBreak: 'PAUSA LONGA' }[_phase] || '';
}

function _phaseDuration() {
  if (_phase === 'idle') return DURATIONS.work;
  return DURATIONS[_phase] || DURATIONS.work;
}

const PHASE_COLORS = {
  idle:      'var(--text-muted)',
  work:      'var(--plasma)',
  break:     'var(--mint)',
  longBreak: 'var(--gold)',
};

export function renderPomodoro() {
  const widget = document.getElementById('pomodoroWidget');
  if (!widget) return;

  const total   = _phaseDuration();
  const elapsed = total - _remaining;
  const pct     = elapsed / total;
  const r       = 26;
  const circ    = 2 * Math.PI * r;
  const dash    = pct * circ;
  const color   = PHASE_COLORS[_phase] || PHASE_COLORS.idle;
  const running = _isRunning();

  if (_minimized) {
    widget.innerHTML = `
      <div class="pomodoro-pill" onclick="window._pomodoroExpand()">
        <span style="color:${color};font-family:var(--font-mono);font-size:12px;font-weight:700">${_fmtTime(_remaining)}</span>
        <span style="width:6px;height:6px;border-radius:50%;background:${running ? color : 'var(--text-ghost)'}"></span>
      </div>`;
    return;
  }

  const doingTasks = state.tasks.filter(t => t.status === 'doing');

  widget.innerHTML = `
    <div class="pomodoro-widget__inner">
      <div class="pomodoro-header">
        <span class="pomodoro-state-badge" style="color:${color}">${_phaseLabel()}</span>
        <div style="display:flex;gap:var(--sp-2)">
          <span style="font-family:var(--font-mono);font-size:9px;color:var(--text-muted)">🍅×${_sessions}</span>
          <button class="pomodoro-btn-icon" onclick="window._pomodoroMinimize()" title="Minimizar">—</button>
        </div>
      </div>

      <div class="pomodoro-ring-wrap">
        <svg class="pomodoro-ring" width="72" height="72" viewBox="0 0 72 72">
          <circle cx="36" cy="36" r="${r}" fill="none" stroke="var(--border)" stroke-width="4"/>
          <circle cx="36" cy="36" r="${r}" fill="none" stroke="${color}" stroke-width="4"
                  stroke-linecap="round"
                  stroke-dasharray="${dash.toFixed(2)} ${circ.toFixed(2)}"
                  transform="rotate(-90 36 36)"
                  style="transition:stroke-dasharray 0.9s linear;filter:drop-shadow(0 0 4px ${color})"/>
        </svg>
        <div class="pomodoro-time">${_fmtTime(_remaining)}</div>
      </div>

      <div class="pomodoro-controls">
        ${running
          ? `<button class="btn btn--sm" onclick="window._pomodoroPause()">⏸ PAUSAR</button>`
          : `<button class="btn btn--primary btn--sm" onclick="window._pomodoroStart()">▶ ${_phase === 'idle' ? 'INICIAR' : 'RETOMAR'}</button>`}
        <button class="btn btn--sm" onclick="window._pomodoroReset()">↺</button>
      </div>

      ${doingTasks.length ? `
        <div style="margin-top:var(--sp-3)">
          <div style="font-family:var(--font-mono);font-size:9px;color:var(--text-muted);margin-bottom:4px">VINCULAR TAREFA</div>
          <select class="input select" style="font-size:10px;padding:4px 8px;height:auto"
                  onchange="window._pomodoroLink(this.value)">
            <option value="">— nenhuma —</option>
            ${doingTasks.map(t => `<option value="${t.id}" ${_linkedTask?.id === t.id ? 'selected' : ''}>${t.title.slice(0,28)}</option>`).join('')}
          </select>
          ${_linkedTask ? `<div style="font-size:9px;color:${color};margin-top:4px">🎯 ${_linkedTask.title.slice(0,25)}</div>` : ''}
        </div>` : ''}
    </div>`;
}

/* ── Init ────────────────────────────────────────────────── */
export function initPomodoro() {
  // Create widget DOM if not present
  let widget = document.getElementById('pomodoroWidget');
  if (!widget) {
    widget = document.createElement('div');
    widget.id        = 'pomodoroWidget';
    widget.className = 'pomodoro-widget';
    document.body.appendChild(widget);
  }
  renderPomodoro();
}

/* ── Global handlers ─────────────────────────────────────── */
Object.assign(window, {
  _pomodoroStart()    { _start();         renderPomodoro(); },
  _pomodoroPause()    { _pause();         renderPomodoro(); },
  _pomodoroReset()    { _reset();         renderPomodoro(); },
  _pomodoroMinimize() { _minimized=true;  renderPomodoro(); },
  _pomodoroExpand()   { _minimized=false; renderPomodoro(); },
  _pomodoroLink(id)   { _linkTask(id);    renderPomodoro(); },
});
