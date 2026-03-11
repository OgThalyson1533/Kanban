/**
 * LIFE CONTROL — Kanban Metrics (updated for Intelligence Engine)
 */

import { state, getCycleTime } from './state.js';

const WIP_LIMIT = 2;

export function getWipStatus() {
  const doing = state.tasks.filter(t => t.status === 'doing');
  return { count: doing.length, exceeded: doing.length > WIP_LIMIT, limit: WIP_LIMIT };
}

export function getBottleneckColumn() {
  const cols   = ['backlog','next','doing','blocked','review'];
  const counts = cols.map(c => ({ col: c, count: state.tasks.filter(t => t.status === c).length }));
  return counts.sort((a, b) => b.count - a.count)[0];
}

export function updateKanbanMetricsBar() {
  const wip        = getWipStatus();
  const bottleneck = getBottleneckColumn();

  // WIP badge
  const wipEl = document.getElementById('kanban-wip-badge');
  if (wipEl) {
    wipEl.textContent = `${wip.count}/${wip.limit}`;
    const kpi = document.getElementById('kpi-wip');
    if (kpi) {
      kpi.dataset.state = wip.exceeded ? 'danger' : wip.count === wip.limit ? 'warn' : 'ok';
    }
  }

  // Bottleneck
  const bnEl = document.getElementById('kanban-bottleneck-badge');
  const LABELS = { backlog:'BACKLOG', next:'PRÓXIMAS', doing:'EXECUÇÃO', blocked:'BLOQUEADO', review:'REVISÃO' };
  if (bnEl) {
    bnEl.textContent = bottleneck?.count > 2 ? `⚠ ${LABELS[bottleneck.col]||bottleneck.col}` : '✓ OK';
    const kpi = document.getElementById('kpi-flow');
    if (kpi) kpi.dataset.state = bottleneck?.count > 2 ? 'warn' : 'ok';
  }

  // Avg score + on-time rate (using engine)
  import('./kanban-engine.js').then(E => {
    const done    = state.tasks.filter(t => t.status === 'done' && t.completedAt);
    const scores  = done.map(t => E.calcPerformanceScore(t)).filter(s => s !== null);
    const avg     = scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : null;
    const medals  = done.filter(t => E.getEfficiencyMedal(t)).length;
    const withDL  = done.filter(t => t.deadline);
    const onTime  = withDL.filter(t => t.completedAt <= t.deadline).length;
    const pct     = withDL.length ? Math.round(onTime/withDL.length*100) : null;

    const avgEl = document.getElementById('kanban-avg-score');
    if (avgEl) {
      avgEl.textContent = avg !== null ? avg : '—';
      avgEl.style.color = avg !== null ? (avg >= 75 ? 'var(--mint)' : avg >= 50 ? 'var(--gold)' : 'var(--ember)') : '';
      const kpi = document.getElementById('kpi-score');
      if (kpi) kpi.dataset.state = avg >= 75 ? 'ok' : avg >= 50 ? 'warn' : 'danger';
    }

    const otEl = document.getElementById('kanban-ontime');
    if (otEl) {
      otEl.textContent = pct !== null ? pct + '%' : '—';
      otEl.style.color = pct !== null ? (pct >= 80 ? 'var(--mint)' : pct >= 50 ? 'var(--gold)' : 'var(--ember)') : '';
    }

    const mdEl = document.getElementById('kanban-medals');
    if (mdEl) mdEl.textContent = `🏅 ${medals}`;

    const tdEl = document.getElementById('kanban-total-done');
    if (tdEl) {
      tdEl.textContent = done.length;
      tdEl.style.color = 'var(--mint)';
    }

    // Redraw weekly chart
  });
}
