/**
 * LIFE CONTROL — Kanban Detail v2
 * Modal de tarefa completo: rich form, subtarefas, histórico, timelog, anexos
 */

import { state, TODAY, getCycleTime, getLeadTime, formatDuration } from './state.js';
import { patchTaskStatus, patchTask, removeTask } from './supabase.js';
import { showToast } from './toast.js';
import { renderKanban, updateTopBar } from './ui.js';

const LS_TIMELOGS = 'lc_timelogs';

/* ── Time Logs ─────────────────────────────────────────── */
function _loadLogs()     { try { return JSON.parse(localStorage.getItem(LS_TIMELOGS)||'{}'); } catch { return {}; } }
function _saveLogs(logs) { localStorage.setItem(LS_TIMELOGS, JSON.stringify(logs)); }

export function addTimeLog(taskId, minutes, note = '') {
  const logs = _loadLogs();
  if (!logs[taskId]) logs[taskId] = [];
  logs[taskId].push({ ts: Date.now(), minutes: +minutes, note });
  _saveLogs(logs);
}

export function getTimeLogs(taskId) {
  const logs = _loadLogs();
  return logs[taskId] || [];
}

export function getTotalLogged(taskId) {
  return getTimeLogs(taskId).reduce((s, l) => s + l.minutes, 0);
}

/* ══════════════════════════════════════════════════════════
   OPEN MODAL
   ══════════════════════════════════════════════════════════ */

export function openTaskDetail(taskId) {
  const rawTask = state.tasks.find(t => t.id === taskId);
  if (!rawTask) return;
  const task = _normalizeTs(rawTask);
  const m = document.getElementById('taskDetailModal');
  if (!m) return;
  m.innerHTML = _buildModal(task);
  m.style.display = 'flex';
  setTimeout(() => document.getElementById('td-title')?.select(), 60);
}

function _fmt(ts) {
  if (!ts) return '';
  const d = typeof ts === 'number' ? new Date(ts) : new Date(ts);
  if (isNaN(d)) return '';
  return d.toISOString().slice(0, 16);
}

function _fmtFull(ts) {
  if (!ts) return '—';
  const d = typeof ts === 'number' ? new Date(ts) : new Date(ts);
  if (isNaN(d)) return '—';
  return d.toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

function _normalizeTs(t) {
  // Returns task with timestamps normalized to ms integers (for getCycleTime etc.)
  function _ms(v) {
    if (!v) return null;
    if (typeof v === 'number') return v;
    const d = new Date(v);
    return isNaN(d) ? null : d.getTime();
  }
  return {
    ...t,
    startedAt:   _ms(t.started_at   ?? t.startedAt),
    completedAt: _ms(t.completed_at ?? t.completedAt),
    createdAt:   _ms(t.created_at   ?? t.createdAt),
    deadline:    _ms(t.deadline),
    estimatedMinutes: t.estimated_minutes ?? t.estimatedMinutes ?? null,
    storyPoints:      t.story_points      ?? t.storyPoints      ?? null,
    blockReason:      t.block_reason      ?? t.blockReason      ?? null,
    dependsOn:        t.depends_on        ?? t.dependsOn        ?? null,
  };
}

function _buildModal(t) {
  const statusFlow = ['backlog','next','doing','blocked','review','done'];
  const SLABELS    = { backlog:'Backlog', next:'Próximas', doing:'Execução', blocked:'Bloqueado', review:'Revisão', done:'Concluído' };
  const currentIdx = statusFlow.indexOf(t.status);

  const cycleMs  = getCycleTime(t);
  const leadMs   = getLeadTime(t);
  const logged   = getTotalLogged(t.id);
  const logs     = getTimeLogs(t.id);
  const effPct   = t.estimatedMinutes && cycleMs
    ? Math.round((cycleMs / 60000) / t.estimatedMinutes * 100) : null;
  const loggedPct = t.estimatedMinutes && logged
    ? Math.min(200, Math.round(logged / t.estimatedMinutes * 100)) : null;

  const chkTotal = (t.checklist||[]).length;
  const chkDone  = (t.checklist||[]).filter(c=>c.done).length;
  const chkPct   = chkTotal ? Math.round(chkDone/chkTotal*100) : 0;

  const isOverdue = t.deadline && !t.completedAt && Date.now() > t.deadline;

  return `
  <div class="modal-box modal-box--wide td-modal">

    <!-- ─── Header ─────────────────────────────────────── -->
    <div class="td-modal-header">
      <div class="td-modal-header__left">
        <span class="td-badge td-badge--${t.complexity||'medium'}">${(t.complexity||'medium').toUpperCase()}</span>
        <span class="td-badge td-badge--priority-${t.priority||'med'}">${_priorityIcon(t.priority)} ${(t.priority||'med').toUpperCase()}</span>
        ${t.status === 'blocked' ? '<span class="td-badge td-badge--blocked">🚫 BLOQUEADO</span>' : ''}
        ${isOverdue ? '<span class="td-badge td-badge--overdue">⚠ ATRASADO</span>' : ''}
      </div>
      <div class="td-modal-header__right">
        <span class="td-id-badge">#${String(t.id).slice(-6).toUpperCase()}</span>
        <button class="modal-close" onclick="window._closeTaskDetail()">✕</button>
      </div>
    </div>

    <!-- ─── Status Pipeline ─────────────────────────────── -->
    <div class="td-pipeline">
      ${statusFlow.map((s, i) => {
        const active = s === t.status;
        const past   = i < currentIdx;
        return `
          <div class="td-pipeline__node ${active?'td-pipeline__node--active':''} ${past?'td-pipeline__node--past':''}"
               onclick="window._setTaskStatus('${t.id}','${s}')">
            <div class="td-pipeline__dot">${active?'●':past?'✓':'○'}</div>
            <div class="td-pipeline__label">${SLABELS[s]}</div>
          </div>
          ${i < statusFlow.length-1 ? '<div class="td-pipeline__line"></div>' : ''}`;
      }).join('')}
    </div>

    <!-- ─── Title ───────────────────────────────────────── -->
    <div class="form-group" style="margin-bottom:var(--sp-3)">
      <input class="input td-title-input" id="td-title" type="text"
             value="${_esc(t.title)}" placeholder="Título da tarefa…">
    </div>

    <!-- ─── Tabs ────────────────────────────────────────── -->
    <div class="td-tabs" id="tdTabBar">
      ${[['details','📋 DETALHES'],['time','⏱ TEMPO'],['checklist','☑ CHECKLIST'],['history','🕐 HISTÓRICO']].map(([id,label],i) => `
        <button class="td-tab ${i===0?'td-tab--active':''}" onclick="window._tdTab('${id}',this)">${label}${id==='checklist'&&chkTotal?` <span class="td-check-badge">${chkDone}/${chkTotal}</span>`:''}</button>
      `).join('')}
    </div>

    <!-- ─── Tab: Details ────────────────────────────────── -->
    <div class="td-panel" id="tdPanel-details">
      <div class="td-grid">

        <div class="form-group" style="grid-column:1/-1">
          <label class="field-label">DESCRIÇÃO / CONTEXTO</label>
          <textarea class="input" id="td-desc" rows="3" placeholder="Contexto, links, critérios de aceite…" style="resize:vertical">${_esc(t.description||'')}</textarea>
        </div>

        <div class="form-group">
          <label class="field-label">PRIORIDADE</label>
          <select class="input select" id="td-priority">
            <option value="high" ${t.priority==='high'?'selected':''}>🔴 Alta</option>
            <option value="med"  ${t.priority==='med' ?'selected':''}>🟡 Média</option>
            <option value="low"  ${t.priority==='low' ?'selected':''}>🟢 Baixa</option>
          </select>
        </div>

        <div class="form-group">
          <label class="field-label">COMPLEXIDADE</label>
          <select class="input select" id="td-complexity">
            <option value="low"    ${t.complexity==='low'   ?'selected':''}>🟢 Baixa</option>
            <option value="medium" ${t.complexity==='medium'?'selected':''}>🟡 Média</option>
            <option value="high"   ${t.complexity==='high'  ?'selected':''}>🔴 Alta</option>
          </select>
        </div>

        <div class="form-group">
          <label class="field-label">STATUS</label>
          <select class="input select" id="td-status">
            ${statusFlow.map(s => `<option value="${s}" ${t.status===s?'selected':''}>${SLABELS[s]}</option>`).join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="field-label">TAG PRINCIPAL</label>
          <select class="input select" id="td-tag">
            ${['work','personal','health','finance','education','design','devops','bug','feature','other'].map(tg =>
              `<option value="${tg}" ${(t.tags||[])[0]===tg?'selected':''}>${tg}</option>`
            ).join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="field-label">RESPONSÁVEL</label>
          <input class="input" id="td-assignee" type="text" value="${_esc(t.assignee||'')}" placeholder="@nome">
        </div>

        <div class="form-group">
          <label class="field-label">SPRINT / PROJETO</label>
          <input class="input" id="td-sprint" type="text" value="${_esc(t.sprint||'')}" placeholder="Ex: Sprint 3 · Q1">
        </div>

        <div class="form-group">
          <label class="field-label">STORY POINTS</label>
          <select class="input select" id="td-points">
            ${[1,2,3,5,8,13,21].map(p => `<option value="${p}" ${t.storyPoints==p?'selected':''}>${p} pt${p>1?'s':''}</option>`).join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="field-label">MOTIVO DO BLOQUEIO</label>
          <input class="input" id="td-blockreason" type="text" value="${_esc(t.blockReason||'')}"
                 placeholder="O que está bloqueando?">
        </div>

        <div class="form-group">
          <label class="field-label">DEPENDÊNCIA DE</label>
          <input class="input" id="td-depends" type="text" value="${_esc(t.dependsOn||'')}"
                 placeholder="ID ou título da tarefa…">
        </div>

        <!-- Timestamps row -->
        <div class="td-section-header" style="grid-column:1/-1">DATAS & PRAZOS</div>

        <div class="form-group">
          <label class="field-label">CRIADO EM</label>
          <input class="input" id="td-createdAt" type="datetime-local" value="${_fmt(t.createdAt||t.created_at)}">
        </div>

        <div class="form-group">
          <label class="field-label">INÍCIO (startedAt) <button class="td-now-btn" onclick="window._setTsNow('td-startedAt')">⏱ Agora</button></label>
          <input class="input" id="td-startedAt" type="datetime-local" value="${_fmt(t.startedAt)}">
        </div>

        <div class="form-group">
          <label class="field-label">PRAZO (deadline) ${isOverdue ? '<span style="color:var(--ember)">⚠ VENCIDO</span>' : ''}</label>
          <input class="input ${isOverdue?'td-input--danger':''}" id="td-deadline" type="datetime-local" value="${_fmt(t.deadline)}">
        </div>

        <div class="form-group">
          <label class="field-label">CONCLUÍDO EM <button class="td-now-btn" onclick="window._setTsNow('td-completedAt')">⏱ Agora</button></label>
          <input class="input" id="td-completedAt" type="datetime-local" value="${_fmt(t.completedAt)}">
        </div>

      </div>

      <!-- KPI Strip -->
      <div class="td-kpi-strip">
        <div class="td-kpi">
          <div class="td-kpi__label">CYCLE TIME</div>
          <div class="td-kpi__val" style="color:var(--plasma)">${cycleMs ? _fmtMs(cycleMs) : '—'}</div>
          <div class="td-kpi__sub">início → fim</div>
        </div>
        <div class="td-kpi">
          <div class="td-kpi__label">LEAD TIME</div>
          <div class="td-kpi__val" style="color:var(--gold)">${leadMs ? Math.round(leadMs/86400000)+'d' : '—'}</div>
          <div class="td-kpi__sub">criação → fim</div>
        </div>
        <div class="td-kpi">
          <div class="td-kpi__label">ESTIMADO</div>
          <div class="td-kpi__val" style="color:var(--mint)">${t.estimatedMinutes||'—'}m</div>
          <div class="td-kpi__sub">story points: ${t.storyPoints||'—'}</div>
        </div>
        <div class="td-kpi">
          <div class="td-kpi__label">REGISTRADO</div>
          <div class="td-kpi__val" style="color:${logged>0?'var(--plasma)':'var(--text-muted)'}">${logged||0}m</div>
          <div class="td-kpi__sub">${loggedPct !== null ? loggedPct+'% do est.' : '—'}</div>
        </div>
        <div class="td-kpi">
          <div class="td-kpi__label">EFICIÊNCIA</div>
          <div class="td-kpi__val" style="color:${effPct===null?'var(--text-muted)':effPct<=110?'var(--mint)':effPct<=150?'var(--gold)':'var(--ember)'}">
            ${effPct !== null ? effPct+'%' : '—'}
          </div>
          <div class="td-kpi__sub">${effPct!==null ? (effPct<=110?'✓ dentro':'↑ excedeu') : '—'}</div>
        </div>
        <div class="td-kpi">
          <div class="td-kpi__label">CHECKLIST</div>
          <div class="td-kpi__val" style="color:${chkPct===100?'var(--mint)':chkPct>0?'var(--gold)':'var(--text-muted)'}">${chkTotal ? chkPct+'%' : '—'}</div>
          <div class="td-kpi__sub">${chkTotal ? chkDone+'/'+chkTotal+' itens' : '—'}</div>
        </div>
      </div>
    </div>

    <!-- ─── Tab: Time ────────────────────────────────────── -->
    <div class="td-panel td-panel--hidden" id="tdPanel-time">
      <div class="td-time-header">
        <div>
          <div class="td-time-total">${logged}m registrados</div>
          <div style="font-family:var(--font-mono);font-size:9px;color:var(--text-muted)">
            ${t.estimatedMinutes ? `Meta: ${t.estimatedMinutes}m · ${loggedPct||0}% usado` : 'Sem estimativa'}
          </div>
        </div>
        ${t.estimatedMinutes ? `
        <div class="td-time-progress-wrap">
          <div class="progress" style="height:8px;min-width:160px">
            <div class="progress__fill" style="width:${Math.min(100,(logged/t.estimatedMinutes*100))}%;
              background:${(logged/t.estimatedMinutes)>1.1?'var(--ember)':'var(--plasma)'}"></div>
          </div>
        </div>` : ''}
      </div>

      <div class="td-log-form">
        <input class="input" id="td-log-min" type="number" min="1" max="480" placeholder="minutos" style="width:90px">
        <input class="input" id="td-log-note" type="text" placeholder="Descrição do trabalho…" style="flex:1">
        <button class="btn btn--primary btn--sm" onclick="window._addTimeLog('${t.id}')">+ REGISTRAR</button>
      </div>

      <div class="td-log-list">
        ${logs.length ? logs.slice().reverse().map(l => `
          <div class="td-log-row">
            <span class="td-log-min">${l.minutes}m</span>
            <span class="td-log-note">${_esc(l.note||'—')}</span>
            <span class="td-log-date">${new Date(l.ts).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</span>
          </div>`).join('')
        : '<div class="empty-state">Nenhum registro de tempo.</div>'}
      </div>
    </div>

    <!-- ─── Tab: Checklist ───────────────────────────────── -->
    <div class="td-panel td-panel--hidden" id="tdPanel-checklist">
      ${chkTotal ? `
      <div class="td-check-progress">
        <div class="td-check-progress__bar">
          <div style="width:${chkPct}%;background:${chkPct===100?'var(--mint)':'var(--plasma)'};height:100%;border-radius:2px;transition:width 0.5s var(--t-spring)"></div>
        </div>
        <span style="font-family:var(--font-mono);font-size:10px;color:${chkPct===100?'var(--mint)':'var(--text-muted)'}">
          ${chkPct}% — ${chkDone}/${chkTotal}
        </span>
      </div>` : ''}

      <div id="td-checklist-items" class="td-check-list">
        ${(t.checklist||[]).length
          ? (t.checklist).map((item, i) => `
              <div class="td-check-row" id="chk-${i}">
                <input type="checkbox" class="td-check-input" ${item.done?'checked':''}
                       onchange="window._toggleCheck('${t.id}',${i})">
                <span class="td-check-label ${item.done ? 'td-check-label--done' : ''}">${_esc(item.text)}</span>
                ${item.assignee ? `<span class="td-check-meta">👤 ${item.assignee}</span>` : ''}
                <button class="fin-tx-row__del" onclick="window._removeCheck('${t.id}',${i})">✕</button>
              </div>`)
            .join('')
          : '<div class="empty-state">Nenhum item.</div>'}
      </div>

      <div class="td-check-add">
        <input class="input" id="td-newcheck" type="text" placeholder="Novo item…"
               onkeydown="if(event.key==='Enter') window._addCheck('${t.id}')">
        <input class="input" id="td-check-assignee" type="text" placeholder="@responsável" style="width:140px">
        <button class="btn btn--sm btn--primary" onclick="window._addCheck('${t.id}')">+ ADD</button>
      </div>
    </div>

    <!-- ─── Tab: History ────────────────────────────────── -->
    <div class="td-panel td-panel--hidden" id="tdPanel-history">
      <div class="td-history">
        ${_buildHistory(t)}
      </div>
    </div>

    <!-- ─── Footer ──────────────────────────────────────── -->
    <div class="td-footer">
      <button class="btn btn--primary" onclick="window._saveTaskDetail('${t.id}')">✓ SALVAR</button>
      <button class="btn" onclick="window._closeTaskDetail()">CANCELAR</button>
      <div style="flex:1"></div>
      <button class="btn btn--sm" style="color:var(--ember);border-color:var(--ember-mid)"
              onclick="window._deleteTaskFromModal('${t.id}')">🗑 EXCLUIR</button>
    </div>
  </div>`;
}

function _buildHistory(t) {
  const events = [];
  if (t.createdAt || t.created_at)  events.push({ ts: t.createdAt||new Date(t.created_at).getTime(),  icon:'✦', label:'Tarefa criada',               col:'var(--text-muted)' });
  if (t.startedAt)                  events.push({ ts: t.startedAt,                icon:'▶', label:'Movida para EM EXECUÇÃO',   col:'var(--plasma)' });
  if (t.completedAt)                events.push({ ts: t.completedAt,              icon:'✓', label:'Marcada como CONCLUÍDA',    col:'var(--mint)' });
  if (t.deadline && Date.now() > t.deadline && !t.completedAt)
                                    events.push({ ts: t.deadline,                 icon:'⚠', label:'Prazo vencido',             col:'var(--ember)' });
  const logs = getTimeLogs(t.id);
  logs.forEach(l => events.push({ ts: l.ts, icon:'⏱', label:`+${l.minutes}m registrado${l.note?' — '+l.note:''}`, col:'var(--gold)' }));

  if (!events.length) return '<div class="empty-state">Nenhum evento registrado.</div>';

  events.sort((a, b) => b.ts - a.ts);

  return `<div class="td-history-list">
    ${events.map(e => `
      <div class="td-history-row">
        <div class="td-history-row__dot" style="color:${e.col}">${e.icon}</div>
        <div class="td-history-row__body">
          <div class="td-history-row__label" style="color:${e.col}">${e.label}</div>
          <div class="td-history-row__date">${_fmtFull(e.ts)}</div>
        </div>
      </div>`).join('')}
  </div>`;
}

function _fmtMs(ms) {
  const h = Math.floor(ms/3600000);
  const m = Math.floor((ms%3600000)/60000);
  return h > 0 ? `${h}h${m}m` : `${m}m`;
}

function _priorityIcon(p) {
  return p==='high' ? '🔴' : p==='med' ? '🟡' : '🟢';
}

/* ══════════════════════════════════════════════════════════
   HANDLERS
   ══════════════════════════════════════════════════════════ */

window._closeTaskDetail = () => {
  const m = document.getElementById('taskDetailModal');
  if (m) m.style.display = 'none';
};

window._tdTab = (tabId, btn) => {
  document.querySelectorAll('.td-panel').forEach(p => p.classList.add('td-panel--hidden'));
  document.querySelectorAll('.td-tab').forEach(b => b.classList.remove('td-tab--active'));
  document.getElementById('tdPanel-'+tabId)?.classList.remove('td-panel--hidden');
  btn?.classList.add('td-tab--active');
};

window._setTsNow = (fieldId) => {
  const el = document.getElementById(fieldId);
  if (el) el.value = new Date().toISOString().slice(0,16);
};

window._setTaskStatus = (id, status) => {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  const now = Date.now();
  const nowISO = new Date(now).toISOString();
  if (status === 'doing' && !task.started_at && !task.startedAt) {
    task.started_at = nowISO; task.startedAt = now;
  }
  if (status === 'done' && !task.completed_at && !task.completedAt) {
    task.completed_at = nowISO; task.completedAt = now;
  }
  task.status = status;
  patchTaskStatus(id, status);
  openTaskDetail(id);
  renderKanban();
};

window._toggleCheck = (taskId, i) => {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task?.checklist) return;
  task.checklist[i].done = !task.checklist[i].done;
  openTaskDetail(taskId);
  renderKanban();
};

window._removeCheck = (taskId, i) => {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task?.checklist) return;
  task.checklist.splice(i, 1);
  openTaskDetail(taskId);
};

window._addCheck = (taskId) => {
  const text     = document.getElementById('td-newcheck')?.value.trim();
  const assignee = document.getElementById('td-check-assignee')?.value.trim();
  if (!text) return;
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;
  if (!task.checklist) task.checklist = [];
  task.checklist.push({ text, done: false, assignee: assignee||null });
  openTaskDetail(taskId);
  setTimeout(() => { window._tdTab('checklist', document.querySelector('.td-tab:nth-child(3)')); }, 30);
};

window._addTimeLog = (taskId) => {
  const min  = parseInt(document.getElementById('td-log-min')?.value);
  const note = document.getElementById('td-log-note')?.value.trim();
  if (!min || min <= 0) { showToast('Informe os minutos.', 'error'); return; }
  addTimeLog(taskId, min, note);
  openTaskDetail(taskId);
  setTimeout(() => { window._tdTab('time', document.querySelector('.td-tab:nth-child(2)')); }, 30);
  showToast(`⏱ +${min}m registrado!`, 'success');
};

window._saveTaskDetail = async (id) => {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;

  const _ts = (fid) => {
    const v = document.getElementById(fid)?.value;
    return v ? new Date(v).getTime() : null;
  };

  const newStatus = document.getElementById('td-status')?.value || task.status;
  const oldStatus = task.status;

  const updates = {
    title:            document.getElementById('td-title')?.value.trim()      || task.title,
    description:      document.getElementById('td-desc')?.value.trim()       || '',
    priority:         document.getElementById('td-priority')?.value          || task.priority,
    complexity:       document.getElementById('td-complexity')?.value        || task.complexity,
    tags:             [document.getElementById('td-tag')?.value              || 'work'],
    assignee:         document.getElementById('td-assignee')?.value.trim()   || '',
    sprint:           document.getElementById('td-sprint')?.value.trim()     || '',
    storyPoints:      parseInt(document.getElementById('td-points')?.value)  || null,
    blockReason:      document.getElementById('td-blockreason')?.value.trim()|| '',
    dependsOn:        document.getElementById('td-depends')?.value.trim()    || '',
    status:           newStatus,
    createdAt:        _ts('td-createdAt')   || task.createdAt   || task.created_at,
    startedAt:        _ts('td-startedAt')   || task.startedAt   || task.started_at  || null,
    completedAt:      _ts('td-completedAt') || task.completedAt || task.completed_at || null,
    deadline:         _ts('td-deadline')    || null,
  };

  Object.assign(task, updates);

  // Persist to DB (snake_case mapping handled inside patchTask)
  try {
    await patchTask(id, updates);
    if (newStatus !== oldStatus) await patchTaskStatus(id, newStatus);
  } catch(e) {
    console.error('[LC saveTask]', e.message);
  }

  renderKanban();
  updateTopBar();
  window._closeTaskDetail();
  showToast('✓ Tarefa salva!', 'success');
};

window._deleteTaskFromModal = async (id) => {
  if (!confirm('Excluir esta tarefa permanentemente?')) return;
  await removeTask(id);
  renderKanban();
  updateTopBar();
  window._closeTaskDetail();
  showToast('Tarefa excluída.', '');
};

/* ══════════════════════════════════════════════════════════
   KANBAN REPORT
   ══════════════════════════════════════════════════════════ */

export function exportKanbanReport(format = 'txt') {
  const COLS   = ['backlog','next','doing','blocked','review','done'];
  const LABELS = { backlog:'BACKLOG', next:'PRÓXIMAS', doing:'EM EXECUÇÃO', blocked:'BLOQUEADO', review:'REVISÃO', done:'CONCLUÍDO' };

  const done     = state.tasks.filter(t => t.status==='done' && t.completedAt);
  const avgCycle = done.length ? done.reduce((s,t)=>s+(getCycleTime(t)||0),0)/done.length/60000 : 0;
  const avgLead  = done.length ? done.reduce((s,t)=>s+(getLeadTime(t)||0),0)/done.length/86400000 : 0;
  const onTime   = done.filter(t=>t.estimatedMinutes&&(getCycleTime(t)||0)/60000<=t.estimatedMinutes*1.2).length;
  const effRate  = done.length > 0 ? (onTime/done.length*100).toFixed(0) : 0;

  if (format === 'csv') {
    const rows = [
      ['ID','Título','Status','Prioridade','Complexidade','Estimado(min)','Registrado(min)','CycleTime(min)','LeadTime(dias)','Tag','Sprint','StoryPoints','Responsável','Criado','Iniciado','Prazo','Concluído','Checklist','BloqueioMotivo'],
      ...state.tasks.map(t => {
        const logged = getTotalLogged(t.id);
        return [
          t.id, t.title, t.status, t.priority, t.complexity||'', t.estimatedMinutes||'',
          logged||'',
          t.startedAt ? Math.round(getCycleTime(t)/60000) : '',
          t.createdAt ? Math.round(getLeadTime(t)/86400000) : '',
          (t.tags||[]).join(';'), t.sprint||'', t.storyPoints||'',
          t.assignee||'',
          _fmtDate(t.createdAt||t.created_at), _fmtDate(t.startedAt),
          _fmtDate(t.deadline), _fmtDate(t.completedAt),
          `${(t.checklist||[]).filter(c=>c.done).length}/${(t.checklist||[]).length}`,
          t.blockReason||'',
        ];
      }),
    ];
    const csv = rows.map(r => r.map(v=>`"${String(v||'').replace(/"/g,'""')}"`).join(',')).join('\n');
    _download(csv, `kanban-${_today()}.csv`, 'text/csv');
    showToast('CSV exportado!', 'success');
    return;
  }

  const now = new Date();
  const lines = [
    `╔═══════════════════════════════════════════════════════╗`,
    `║   LIFE CONTROL — RELATÓRIO KANBAN                    ║`,
    `╚═══════════════════════════════════════════════════════╝`,
    `Gerado: ${now.toLocaleString('pt-BR')}`,
    ``,
    `┌─ MÉTRICAS GERAIS ─────────────────────────────────────`,
    `│  Total de tarefas:      ${state.tasks.length}`,
    `│  Concluídas:            ${done.length} (${state.tasks.length?Math.round(done.length/state.tasks.length*100):0}%)`,
    `│  Em execução:           ${state.tasks.filter(t=>t.status==='doing').length}`,
    `│  Bloqueadas:            ${state.tasks.filter(t=>t.status==='blocked').length}`,
    `│  Cycle time médio:      ${avgCycle.toFixed(0)} min`,
    `│  Lead time médio:       ${avgLead.toFixed(1)} dias`,
    `│  Taxa de eficiência:    ${effRate}%`,
    `│  Story Points totais:   ${state.tasks.reduce((s,t)=>s+(t.storyPoints||0),0)}`,
    ``,
    ...COLS.flatMap(col => {
      const tasks = state.tasks.filter(t => t.status === col);
      return [
        `┌─ ${LABELS[col]} (${tasks.length}) `,
        ...(!tasks.length ? ['│  (vazio)'] : tasks.flatMap(t => {
          const logged = getTotalLogged(t.id);
          const lines2 = [`│  ● [${(t.priority||'med').toUpperCase()}] ${t.title}`];
          if (t.description)  lines2.push(`│    Desc: ${t.description.slice(0,80)}`);
          if (t.assignee)     lines2.push(`│    Resp: ${t.assignee}   Sprint: ${t.sprint||'—'}   SP: ${t.storyPoints||'—'}`);
          if (t.estimatedMinutes) lines2.push(`│    Est: ${t.estimatedMinutes}m   Reg: ${logged}m   Cycle: ${t.startedAt?Math.round(getCycleTime(t)/60000)+'m':'—'}`);
          if (t.deadline)     lines2.push(`│    Prazo: ${_fmtDate(t.deadline)}`);
          if (t.blockReason)  lines2.push(`│    🚫 Bloqueio: ${t.blockReason}`);
          if (t.checklist?.length) {
            const cd = t.checklist.filter(c=>c.done).length;
            lines2.push(`│    ☑ Checklist: ${cd}/${t.checklist.length}`);
          }
          lines2.push(`│`);
          return lines2;
        })),
        ``,
      ];
    }),
  ];

  _download(lines.join('\n'), `kanban-${_today()}.txt`, 'text/plain');
  showToast('Relatório exportado!', 'success');
}

function _fmtDate(ts) { return ts ? new Date(ts).toLocaleDateString('pt-BR') : ''; }
function _today()     { return new Date().toISOString().split('T')[0]; }
function _download(c, n, t) {
  const blob = new Blob([c], { type: t });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = n; a.click();
  URL.revokeObjectURL(url);
}
function _esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
