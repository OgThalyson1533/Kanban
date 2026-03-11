/**
 * LIFE CONTROL — UI Module
 * All DOM rendering functions. Pure render logic, no side-effects.
 */

import {
  state, TODAY,
  getActiveTasks, getMaxStreak,
  getTotalIncome, getTotalExpense, getNetBalance,
  getLevel, getXpPct,
} from './state.js';

/* ══════════════════════════════════════════════════════════
   Top Bar
   ══════════════════════════════════════════════════════════ */
export function updateTopBar() {
  const { xp, coins, level } = state.profile;
  document.getElementById('topLevel').textContent  = level || 1;
  document.getElementById('topXP').textContent     = xp    || 0;
  document.getElementById('topCoins').textContent  = coins || 0;
  document.getElementById('topStreak').textContent = getMaxStreak();
  document.getElementById('xpBarFill').style.width = getXpPct(xp) + '%';
  document.getElementById('rewardCoins').textContent = coins || 0;
  document.getElementById('rewardXP').textContent    = xp    || 0;
  document.getElementById('taskBadge').textContent   = getActiveTasks().length;
}

/* ══════════════════════════════════════════════════════════
   Router
   ══════════════════════════════════════════════════════════ */
export function renderView(id) {
  switch (id) {
    case 'dashboard':  renderDashboard();  break;
    case 'kanban':     renderKanban();     break;
    case 'habitos':    renderHabits();     break;
    case 'quit':       renderQuit();       break;
    case 'financas':   renderFinances();   break;
    case 'metas':      renderGoals();      break;
    case 'agenda':     renderAgenda();     break;
    case 'recompensas':renderRewards();    break;
    case 'cripto':     renderCrypto();     break;
    // New views — rendered by their own modules
    case 'humor':   import('./mood.js').then(m => m.renderMood());     break;
    case 'saude':   import('./health.js').then(m => m.renderHealth()); break;
    // v4.0 new views — handled by app.js
    case 'analytics':  break;
    case 'learning':   break;
  }
}

export function renderAll() {
  updateTopBar();
  renderDashboard();
  renderKanban();
  renderHabits();
  renderQuit();
  renderFinances();
  renderGoals();
  renderRewards();
}

/* ══════════════════════════════════════════════════════════
   Dashboard
   ══════════════════════════════════════════════════════════ */
function renderDashboard() {
  const d = new Date();
  const dateStr = d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();
  const el = document.getElementById('dashDate');
  if (el) el.textContent = dateStr;

  // Metrics
  _set('dash-tasks',   getActiveTasks().length);
  _set('dash-streak',  getMaxStreak());

  const net = getNetBalance();
  _set('dash-balance', `R$${net.toLocaleString('pt-BR')}`);

  const balDelta = document.getElementById('dash-balance-delta');
  if (balDelta) {
    balDelta.textContent = net >= 0 ? '↑ saldo positivo' : '↓ saldo negativo';
    balDelta.className = 'metric-card__delta metric-card__delta--' + (net >= 0 ? 'up' : 'down');
  }

  _set('dash-goals', state.goals.length);

  // Task preview
  const tl = document.getElementById('dash-task-list');
  if (tl) {
    tl.innerHTML = state.tasks.length
      ? state.tasks.slice(0, 4).map(t => `
          <div class="preview-row" onclick="window._nav('kanban',null)">
            <div class="preview-row__icon">${t.status === 'done' ? '✓' : '○'}</div>
            <div style="flex:1;min-width:0">
              <div class="preview-row__title" style="${t.status === 'done' ? 'text-decoration:line-through;color:var(--text-muted)' : ''}">${_esc(t.title)}</div>
              <div class="preview-row__meta">${t.status.toUpperCase()} · ${(t.tags || []).join(', ')}</div>
            </div>
            <span class="tag tag--${t.priority}">${t.priority}</span>
          </div>`).join('')
      : '<div class="empty-state">Nenhuma tarefa.</div>';
  }

  // Habit preview
  const hl = document.getElementById('dash-habit-list');
  if (hl) {
    const today = TODAY();
    hl.innerHTML = state.habits.filter(h => !h.quit_mode).length
      ? state.habits.filter(h => !h.quit_mode).slice(0, 4).map(h => {
          const done = h.last_check === today;
          return `
            <div class="preview-row">
              <div class="preview-row__icon">${h.icon || '⬡'}</div>
              <div style="flex:1;min-width:0">
                <div class="preview-row__title">${_esc(h.name)}</div>
                <div class="preview-row__meta">🔥 ${h.streak || 0} dias</div>
              </div>
              <div style="color:${done ? 'var(--mint)' : 'var(--text-ghost)'}; font-size:18px">${done ? '✓' : '○'}</div>
            </div>`;
        }).join('')
      : '<div class="empty-state">Nenhum hábito configurado.</div>';
  }

  _renderWeeklyChart();
}

function _renderWeeklyChart() {
  const chart = document.getElementById('weeklyChart');
  if (!chart) return;
  const vals   = [3, 7, 5, 9, 4, 8, 6];
  const max    = Math.max(...vals);
  const colors = ['var(--plasma)', 'var(--mint)', 'var(--plasma)', 'var(--gold)', 'var(--plasma)', 'var(--mint)', 'var(--gold)'];
  chart.innerHTML = vals.map((v, i) => {
    const h = Math.round((v / max) * 100);
    return `<div class="mini-chart__bar" style="height:${h}%; background:${colors[i]}; opacity:0.7; box-shadow:0 0 8px ${colors[i]}; transition:height 0.6s ${i * 0.07}s ease"></div>`;
  }).join('');
}

/* ══════════════════════════════════════════════════════════
   Kanban
   ══════════════════════════════════════════════════════════ */
export function renderKanban() {
  const COLS = [
    { id: 'backlog', label: 'BACKLOG',   num: '01', color: 'var(--text-muted)', wip: 0 },
    { id: 'next',    label: 'PRÓXIMAS',  num: '02', color: 'var(--plasma)',     wip: 0 },
    { id: 'doing',   label: 'EXECUÇÃO',  num: '03', color: 'var(--plasma)',     wip: 2 },
    { id: 'blocked', label: 'BLOQUEADO', num: '04', color: 'var(--ember)',      wip: 0 },
    { id: 'review',  label: 'REVISÃO',   num: '05', color: 'var(--gold)',       wip: 0 },
    { id: 'done',    label: 'CONCLUÍDO', num: '06', color: 'var(--mint)',       wip: 0 },
  ];

  const CX_LABELS = { low: 'LOW', medium: 'MED', high: 'HIGH' };
  const PRI_ICONS = { high: '🔴', med: '🟡', low: '🟢' };
  const CX_ICONS  = { low: '◎', medium: '◉', high: '⬢' };
  const CX_COLS   = { low: 'var(--mint)', medium: 'var(--gold)', high: 'var(--ember)' };
  const PRI_COLS  = { high: 'var(--ember)', med: 'var(--gold)', low: 'var(--mint)' };

  // Helper: read field supporting both snake_case (DB) and camelCase (demo/legacy)
  function _f(t, snake, camel) {
    return t[snake] !== undefined ? t[snake] : (t[camel] !== undefined ? t[camel] : null);
  }

  function _ts(t, snake, camel) {
    const v = _f(t, snake, camel);
    if (!v) return null;
    // Could be ISO string, epoch ms, or number
    const d = typeof v === 'number' ? new Date(v) : new Date(v);
    return isNaN(d) ? null : d;
  }

  function _cycleLabel(t) {
    const started   = _ts(t, 'started_at',   'startedAt');
    const completed = _ts(t, 'completed_at', 'completedAt');
    if (!started) return '';
    const ms = (completed || new Date()) - started;
    const h  = Math.floor(ms / 3600000);
    const m  = Math.floor((ms % 3600000) / 60000);
    return `${String(h).padStart(2,'0')}h${String(m).padStart(2,'0')}m`;
  }

  function _scoreBar(score) {
    if (score === null) return '';
    const col = score >= 75 ? 'var(--mint)' : score >= 50 ? 'var(--gold)' : 'var(--ember)';
    return `<div class="tc-score-bar">
      <div class="tc-score-bar__fill" style="width:${score}%;background:${col}"></div>
      <span class="tc-score-val" style="color:${col}">${score}</span>
    </div>`;
  }

  COLS.forEach(col => {
    const body  = document.getElementById(`col-${col.id}`);
    const count = document.getElementById(`count-${col.id}`);
    if (!body) return;

    const tasks = state.tasks.filter(t => t.status === col.id);
    if (count) count.textContent = tasks.length;

    const colEl = body.closest('.kanban-col');
    if (colEl) {
      colEl.classList.toggle('kanban-col--wip-exceeded', col.wip ? tasks.length > col.wip : false);
      colEl.classList.toggle('kanban-col--blocked', col.id === 'blocked');
      colEl.classList.toggle('kanban-col--done',    col.id === 'done');
    }

    if (!tasks.length) {
      body.innerHTML = `<div class="empty-state" style="padding:24px 0;font-size:10px">Vazio</div>`;
      return;
    }

    body.innerHTML = tasks.map(t => {
      const cx       = t.complexity || 'medium';
      const pri      = t.priority   || 'med';
      const estMin   = _f(t, 'estimated_minutes', 'estimatedMinutes');
      const sp       = _f(t, 'story_points',      'storyPoints');
      const blockR   = _f(t, 'block_reason',      'blockReason');

      const startedDate    = _ts(t, 'started_at',   'startedAt');
      const completedDate  = _ts(t, 'completed_at', 'completedAt');
      const createdDate    = _ts(t, 'created_at',   'createdAt');
      const deadlineDate   = _ts(t, 'deadline',     'deadline');

      const cycle    = _cycleLabel(t);
      const chkTotal = (t.checklist||[]).length;
      const chkDone  = (t.checklist||[]).filter(c=>c.done).length;
      const chkPct   = chkTotal ? Math.round(chkDone / chkTotal * 100) : 0;

      // Performance score (done tasks only)
      let scoreHtml = '', medalHtml = '';
      if (t.status === 'done' && completedDate && startedDate) {
        try {
          const E = window.__kanbanEngine;
          if (E) {
            // Normalize task for engine (needs ms timestamps)
            const nt = { ...t,
              startedAt:   startedDate.getTime(),
              completedAt: completedDate.getTime(),
              createdAt:   createdDate ? createdDate.getTime() : null,
              deadline:    deadlineDate ? deadlineDate.getTime() : null,
              estimatedMinutes: estMin,
            };
            const score = E.calcPerformanceScore(nt);
            const medal = E.getEfficiencyMedal(nt);
            if (score !== null) scoreHtml = _scoreBar(score);
            if (medal) medalHtml = `<span class="tc-medal" style="color:${medal.color};text-shadow:0 0 8px ${medal.glow}">${medal.label}</span>`;
          }
        } catch(e) {}
      }

      // Deadline countdown
      const hasDeadline = !!deadlineDate && !completedDate;
      let deadlineHtml = '';
      if (hasDeadline) {
        try {
          const E = window.__kanbanEngine;
          const nt = { ...t, deadline: deadlineDate.getTime(),
            createdAt: createdDate ? createdDate.getTime() : null,
            completedAt: completedDate ? completedDate.getTime() : null };
          const ds = E ? E.getDeadlineState(nt) : null;
          if (ds) {
            deadlineHtml = `
              <div class="tc-countdown tc-cd--${ds.urgency}" data-deadline-task="${t.id}">
                <span class="cd-icon">${ds.isOverdue ? '⚠' : '⏰'}</span>
                <span class="cd-label">${ds.label}</span>
                ${ds.isCritical ? '<span class="cd-critical-dot"></span>' : ''}
              </div>`;
          }
        } catch(e) {
          deadlineHtml = `<div class="tc-countdown tc-cd--warn" data-deadline-task="${t.id}"><span class="cd-icon">⏰</span><span class="cd-label">—</span></div>`;
        }
      }

      // ── Timestamps with full date + time ──────────────────
      function _dtLabel(d, icon, col) {
        if (!d) return '';
        const date = d.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'2-digit' });
        const time = d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
        return `<span class="tc-ts-item" style="color:${col}" title="${d.toLocaleString('pt-BR')}">${icon} ${date} ${time}</span>`;
      }

      const tsHtml = `<div class="tc-ts-strip">
        ${_dtLabel(createdDate,   '✦', 'var(--text-ghost)')}
        ${_dtLabel(startedDate,   '▶', 'var(--plasma)')}
        ${_dtLabel(completedDate, '✓', 'var(--mint)')}
      </div>`;

      // Deadline display (line below timestamps if set)
      const dlHtml = deadlineDate && !completedDate ? '' : deadlineDate ? `<div class="tc-deadline-done">🏁 ${deadlineDate.toLocaleDateString('pt-BR', {day:'2-digit',month:'2-digit',year:'2-digit'})} ${deadlineDate.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</div>` : '';

      const deadlineUrgency = hasDeadline && window.__kanbanEngine
        ? (() => { try { const nt={...t,deadline:deadlineDate.getTime(),createdAt:createdDate?createdDate.getTime():null,completedAt:null}; return window.__kanbanEngine.getDeadlineState(nt)?.urgency||''; } catch{return '';} })()
        : '';

      return `
        <div class="task-card tc-v2" draggable="true" data-id="${t.id}" data-deadline="${deadlineUrgency}"
             ondragstart="window._dragStart(event,'${t.id}')"
             ondragend="window._dragEnd(event)">

          <div class="tc-header">
            <span class="tc-cx tc-cx--${cx}" style="color:${CX_COLS[cx]}">
              <span class="tc-cx__icon">${CX_ICONS[cx]}</span>
              <span class="tc-cx__label">${CX_LABELS[cx]}</span>
            </span>
            <span class="tc-pri" style="color:${PRI_COLS[pri]}">${PRI_ICONS[pri]}</span>
            ${sp ? `<span class="tc-sp">${sp}pt</span>` : ''}
            <div style="flex:1"></div>
            ${t.status === 'blocked' ? `<span class="tc-blocked-icon" title="${_esc(blockR||'Bloqueado')}">🚫</span>` : ''}
            ${medalHtml}
          </div>

          <div class="tc-title" onclick="window._openTaskDetail('${t.id}')">${_esc(t.title)}</div>

          ${t.description ? `<div class="tc-desc">${_esc(t.description.slice(0,70))}${t.description.length>70?'…':''}</div>` : ''}

          ${deadlineHtml}

          ${chkTotal ? `
            <div class="tc-check-row">
              <div class="tc-check-bar"><div class="tc-check-bar__fill" style="width:${chkPct}%;background:${chkPct===100?'var(--mint)':'var(--plasma)'}"></div></div>
              <span class="tc-check-count" style="color:${chkDone===chkTotal?'var(--mint)':'var(--text-muted)'}">☑ ${chkDone}/${chkTotal}</span>
            </div>` : ''}

          ${scoreHtml}

          ${cycle ? `<div class="tc-time">⏱ ${cycle}${estMin ? ' / '+estMin+'m est.' : ''}</div>` : ''}

          ${tsHtml}
          ${dlHtml}

          <div class="tc-footer">
            ${(t.tags||[]).slice(0,2).map(tag=>`<span class="tag tag--${tag}">${tag}</span>`).join('')}
            ${t.assignee ? `<span class="tc-assignee">👤 ${_esc(t.assignee)}</span>` : ''}
            <div style="flex:1"></div>
            <button class="tc-btn-edit"   onclick="window._openTaskDetail('${t.id}')" title="Editar">✎</button>
            <button class="tc-btn-delete" onclick="window._deleteTask('${t.id}')"    title="Remover">✕</button>
          </div>
        </div>`;
    }).join('');
  });

  // Load engine (no chart call)
  import('./kanban-engine.js').then(m => {
    window.__kanbanEngine = m;
    m.startCountdownTicker();
    import('./kanban-metrics.js').then(km => km.updateKanbanMetricsBar());
  });
}


/* ══════════════════════════════════════════════════════════
   Habits
   ══════════════════════════════════════════════════════════ */
export function renderHabits() {
  const container = document.getElementById('habitList');
  if (!container) return;

  const habits = state.habits.filter(h => !h.quit_mode);
  const today  = TODAY();

  container.innerHTML = habits.length
    ? habits.map(h => {
        const done  = h.last_check === today;
        const trail = Array.from({ length: 7 }, (_, i) => {
          const filled = i < (h.streak % 7);
          const isLast = i === 6;
          const cls = isLast && done ? 'today' : filled ? 'done' : '';
          return `<div class="streak-trail__dot ${cls ? `streak-trail__dot--${cls}` : ''}"></div>`;
        }).join('');

        return `
          <div class="habit-row${done ? '' : ''}" id="habit-${h.id}">
            <div class="habit-row__icon">${h.icon || '⬡'}</div>
            <div class="habit-row__info">
              <div class="habit-row__name">${_esc(h.name)}</div>
              <div class="habit-row__streak">Streak: <span class="habit-row__streak-val">${h.streak || 0} dias</span></div>
              <div class="streak-trail" style="margin-top:8px">${trail}</div>
            </div>
            <button class="habit-check-btn ${done ? 'habit-check-btn--done' : ''}"
                    onclick="window._checkHabit('${h.id}')">
              ${done ? '✓' : '○'}
            </button>
          </div>`;
      }).join('')
    : '<div class="empty-state">Nenhum hábito. Clique em + HÁBITO.</div>';
}

/* ══════════════════════════════════════════════════════════
   Quit Tracker
   ══════════════════════════════════════════════════════════ */
export function renderQuit() {
  const container = document.getElementById('quitList');
  if (!container) return;

  const quits = state.habits.filter(h => h.quit_mode);
  if (!quits.length) {
    container.innerHTML = '<div class="empty-state" style="grid-column:1/-1">Nenhum vício rastreado. Clique em + ADICIONAR VÍCIO.</div>';
    return;
  }

  const MILESTONES = [1, 7, 30, 90, 180, 365];

  container.innerHTML = quits.map(q => {
    const start  = q.quit_date ? new Date(q.quit_date) : new Date();
    const diffMs = Date.now() - start.getTime();
    const days   = Math.max(0, Math.floor(diffMs / 86400000));
    const hours  = Math.floor((diffMs % 86400000) / 3600000);

    const milestoneHTML = MILESTONES.map(m => `
      <div class="milestone ${days >= m ? 'milestone--reached' : ''}">
        <span class="milestone__val">${m}</span>DIA${m > 1 ? 'S' : ''}
      </div>`).join('');

    return `
      <div class="quit-card">
        <div class="quit-card__header">
          <div>
            <div style="font-size:28px">${q.icon || '🚫'}</div>
            <div class="quit-card__name">${_esc(q.name)}</div>
          </div>
          <button class="btn btn--danger btn--sm" onclick="window._relapse('${q.id}')">RECAÍDA</button>
        </div>
        <div class="quit-card__label">DIAS LIMPO</div>
        <div class="quit-days">${days}</div>
        <div class="quit-unit">${hours}H NESTE DIA</div>
        <div class="milestones">${milestoneHTML}</div>
      </div>`;
  }).join('');
}

/* ══════════════════════════════════════════════════════════
   Finances
   ══════════════════════════════════════════════════════════ */
export function renderFinances() {
  const root = document.getElementById('financasRoot');
  if (root) {
    import('./finance.js').then(m => {
      m.renderFinances();
      requestAnimationFrame(() => m.renderFinanceTrend());
    });
  }
}


export function renderGoals() {
  const container = document.getElementById('goalsList');
  if (!container) return;

  container.innerHTML = state.goals.length
    ? state.goals.map(g => {
        const pct  = Math.min(100, Math.round((+g.current / +g.target) * 100));
        const done = pct >= 100;
        return `
          <div class="goal-item ${done ? 'goal-item--completed' : ''}">
            <div class="goal-item__header">
              <div>
                <div class="goal-item__title">${_esc(g.title)}</div>
                <div class="goal-item__meta">
                  ${g.unit === 'R$' ? 'R$' : ''}${(+g.current).toLocaleString('pt-BR')}${g.unit !== 'R$' ? ' ' + g.unit : ''}
                  &nbsp;/&nbsp;
                  ${g.unit === 'R$' ? 'R$' : ''}${(+g.target).toLocaleString('pt-BR')}${g.unit !== 'R$' ? ' ' + g.unit : ''}
                  ${g.deadline ? `<span>· ⏱ ${g.deadline}</span>` : ''}
                </div>
              </div>
              <div class="goal-item__pct ${done ? 'goal-item__pct--done' : ''}">${pct}%</div>
            </div>
            <div class="progress">
              <div class="progress__fill progress__fill--${g.color || 'plasma'}" style="width:${pct}%"></div>
            </div>
            <div class="goal-item__actions">
              <button class="btn btn--sm" onclick="window._updateGoalProgress('${g.id}')">+ PROGRESSO</button>
              ${done ? `<button class="btn btn--gold btn--sm" onclick="window._celebrateGoal()">🏆 CELEBRAR</button>` : ''}
            </div>
          </div>`;
      }).join('')
    : '<div class="empty-state">Nenhuma meta. Clique em + META.</div>';
}

/* ══════════════════════════════════════════════════════════
   Agenda
   ══════════════════════════════════════════════════════════ */
export function renderAgenda() {
  const grid = document.getElementById('timeGrid');
  if (!grid) return;

  const HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
  const now   = new Date().getHours();

  const EVENTS = [
    { hour: 7,  title: 'Meditação matinal',           type: 'mint' },
    { hour: 9,  title: 'Deep Work — Projeto Principal', type: ''    },
    { hour: 12, title: 'Almoço',                       type: 'gold' },
    { hour: 18, title: 'Treino',                       type: 'mint' },
    { hour: 21, title: 'Leitura',                      type: ''    },
  ];

  grid.innerHTML = HOURS.map(h => {
    const isNow  = h === now;
    const event  = EVENTS.find(e => e.hour === h);
    const hLabel = `${h.toString().padStart(2, '0')}:00`;
    return `
      <div class="time-row">
        <div class="time-label ${isNow ? 'time-label--now' : ''}">${hLabel}</div>
        <div style="flex:1; padding-top:2px">
          ${event
            ? `<div class="event-block ${event.type ? `event-block--${event.type}` : ''}">
                <div class="event-block__time">${hLabel}</div>
                ${_esc(event.title)}
               </div>`
            : isNow
              ? '<div class="time-now-line"></div>'
              : ''}
        </div>
      </div>`;
  }).join('');
}

/* ══════════════════════════════════════════════════════════
   Rewards
   ══════════════════════════════════════════════════════════ */
export function renderRewards() {
  updateTopBar();
  const ACHIEVEMENTS = [
    { icon: '🔥', name: 'Primeiro Streak',  desc: '7 dias seguidos',         earned: true  },
    { icon: '⚡', name: 'Produtivo',         desc: '10 tarefas completas',    earned: true  },
    { icon: '💎', name: 'Mestre',            desc: 'Nível 5 atingido',        earned: false },
    { icon: '🚀', name: 'SpaceX',            desc: '30 dias consistência',    earned: false },
    { icon: '🏆', name: 'Campeão',           desc: 'Meta 100% completa',      earned: false },
    { icon: '💰', name: 'Investidor',        desc: 'Fundo emergência 50%',    earned: true  },
    { icon: '🧘', name: 'Zen',              desc: '21 dias meditação',        earned: false },
    { icon: '📚', name: 'Leitor',            desc: '30 sessões leitura',      earned: true  },
  ];

  const grid = document.getElementById('achievementsList');
  if (grid) {
    grid.innerHTML = ACHIEVEMENTS.map(a => `
      <div class="achievement-card ${a.earned ? 'achievement-card--earned' : ''}">
        <div class="achievement-card__icon">${a.icon}</div>
        <div class="achievement-card__name">${a.name}</div>
        <div class="achievement-card__desc">${a.desc}</div>
        ${a.earned ? '<div class="achievement-card__badge">✓ CONQUISTADO</div>' : ''}
      </div>`).join('');
  }
}

/* ══════════════════════════════════════════════════════════
   Crypto (placeholder)
   ══════════════════════════════════════════════════════════ */
export function renderCrypto() {
  const portfolio = document.getElementById('cryptoPortfolio');
  const SEED = [
    { symbol: 'BTC', name: 'Bitcoin',  price: 'R$342.000', change: '+2.4%', up: true },
    { symbol: 'ETH', name: 'Ethereum', price: 'R$18.500',  change: '+1.1%', up: true },
    { symbol: 'SOL', name: 'Solana',   price: 'R$760',     change: '-0.8%', up: false },
  ];
  if (portfolio) {
    portfolio.innerHTML = SEED.map(c => `
      <div class="crypto-row">
        <div>
          <div class="crypto-symbol">${c.symbol}</div>
          <div class="crypto-name">${c.name}</div>
        </div>
        <div style="text-align:right">
          <div class="crypto-price">${c.price}</div>
          <div class="crypto-change ${c.up ? 'crypto-change--up' : 'crypto-change--down'}">${c.change}</div>
        </div>
      </div>`).join('');
  }
}

/* ══════════════════════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════════════════════ */
function _set(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function _esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _priorityLabel(p) {
  return p === 'high' ? '🔴 alta' : p === 'med' ? '🟡 média' : '🟢 baixa';
}
