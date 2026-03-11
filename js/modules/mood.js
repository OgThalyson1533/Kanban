/**
 * LIFE CONTROL — Mood & Energy Module
 * Daily mood (1-5) and energy (1-10) tracking.
 */

import { state, TODAY } from './state.js';
import { awardXP }      from './gamification.js';
import { showToast }    from './toast.js';
import { updateTopBar } from './ui.js';

const LS_KEY = 'lc_mood';

/* ── Load / Save ─────────────────────────────────────────── */
export function loadMood() {
  try {
    state.mood = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
  } catch { state.mood = []; }
}

function _saveMood() {
  localStorage.setItem(LS_KEY, JSON.stringify(state.mood));
}

/* ── Getters ─────────────────────────────────────────────── */
export function getTodayMood() {
  const today = TODAY();
  return state.mood.find(m => m.date === today) || null;
}

export function getMoodHistory(days = 7) {
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = d.toISOString().split('T')[0];
    const entry = state.mood.find(m => m.date === date);
    result.push({ date, label: d.toLocaleDateString('pt-BR', { weekday: 'short' }), entry });
  }
  return result;
}

export function getMoodAverage() {
  const hist = getMoodHistory(7).filter(d => d.entry);
  if (!hist.length) return null;
  const avg = hist.reduce((s, d) => s + d.entry.level, 0) / hist.length;
  return Math.round(avg * 10) / 10;
}

/* ── Save Mood ───────────────────────────────────────────── */
export async function saveMood(level, energy, note = '') {
  const today = TODAY();
  const existing = getTodayMood();

  if (existing) {
    showToast('Humor já registrado hoje! ✓', '');
    return false;
  }

  const entry = { id: 'm' + Date.now(), date: today, level, energy, note, ts: Date.now() };
  state.mood.unshift(entry);
  _saveMood();

  await awardXP(15);
  updateTopBar();
  showToast(`Humor registrado! +15 XP 💫`, 'success');
  renderMood();
  return true;
}

/* ── Render ──────────────────────────────────────────────── */
const EMOJIS = ['😞', '😐', '😊', '😄', '🤩'];
const EMOJI_LABELS = ['Péssimo', 'Regular', 'Bom', 'Ótimo', 'Incrível'];
const MOOD_COLORS = ['var(--ember)', 'var(--gold)', 'var(--plasma)', 'var(--mint)', 'var(--mint)'];

export function renderMood() {
  const container = document.getElementById('moodView');
  if (!container) return;

  const today   = getTodayMood();
  const history = getMoodHistory(7);
  const avg     = getMoodAverage();

  container.innerHTML = `
    <!-- Today's Mood -->
    <div class="mood-section">
      <div class="mood-section__label">HUMOR DE HOJE</div>
      ${today
        ? `<div class="mood-registered">
             <div class="mood-registered__emoji">${EMOJIS[today.level - 1]}</div>
             <div class="mood-registered__info">
               <div style="font-size:16px;font-weight:600">${EMOJI_LABELS[today.level - 1]}</div>
               <div style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted)">ENERGIA: ${today.energy}/10</div>
             </div>
             <div class="mood-registered__badge">✓ REGISTRADO</div>
           </div>`
        : `<div class="mood-grid" id="moodGrid">
             ${EMOJIS.map((e, i) => `
               <button class="mood-emoji-btn" data-level="${i + 1}" onclick="window._selectMood(${i + 1}, this)">
                 <span class="mood-emoji-btn__icon">${e}</span>
                 <span class="mood-emoji-btn__label">${EMOJI_LABELS[i]}</span>
               </button>`).join('')}
           </div>
           <div class="mood-energy-section" id="moodEnergySection" style="display:none">
             <div class="mood-section__label" style="margin-top:var(--sp-5)">NÍVEL DE ENERGIA</div>
             <div class="energy-slider-wrap">
               <input type="range" class="energy-slider" id="energySlider" min="1" max="10" value="7"
                      oninput="document.getElementById('energyVal').textContent=this.value">
               <span class="energy-val" id="energyVal">7</span>
             </div>
             <button class="btn btn--primary" style="margin-top:var(--sp-4)" onclick="window._saveMood()">
               ✓ SALVAR HUMOR +15 XP
             </button>
           </div>`}
    </div>

    <!-- History -->
    <div class="mood-history-card">
      <div class="mood-section__label">ÚLTIMOS 7 DIAS</div>
      <div class="mood-history">
        ${history.map(d => `
          <div class="mood-history-row">
            <div class="mood-history-row__day">${d.label.toUpperCase()}</div>
            <div class="mood-history-row__emoji">${d.entry ? EMOJIS[d.entry.level - 1] : '·'}</div>
            <div class="mood-history-row__bar">
              <div class="mood-history-row__fill" style="width:${d.entry ? d.entry.level * 20 : 0}%;background:${d.entry ? MOOD_COLORS[d.entry.level - 1] : 'var(--border)'}"></div>
            </div>
            <div class="mood-history-row__energy" style="color:var(--text-muted);font-size:10px">
              ${d.entry ? `⚡${d.entry.energy}` : ''}
            </div>
          </div>`).join('')}
      </div>
      ${avg ? `<div class="mood-avg">Média semanal: <strong style="color:var(--plasma)">${avg}/5</strong></div>` : ''}
    </div>
  `;
}

// Global handlers
let _selectedMoodLevel = null;
window._selectMood = (level, btn) => {
  _selectedMoodLevel = level;
  document.querySelectorAll('.mood-emoji-btn').forEach(b => b.classList.remove('mood-emoji-btn--active'));
  btn.classList.add('mood-emoji-btn--active');
  const section = document.getElementById('moodEnergySection');
  if (section) section.style.display = 'block';
};
window._saveMood = () => {
  if (!_selectedMoodLevel) { showToast('Selecione um emoji de humor.', 'error'); return; }
  const energy = parseInt(document.getElementById('energySlider')?.value) || 7;
  saveMood(_selectedMoodLevel, energy);
  _selectedMoodLevel = null;
};
