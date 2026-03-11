/**
 * LIFE CONTROL — Navigation Module
 * View routing and sidebar state.
 */

import { renderView } from './ui.js';

let _current = 'dashboard';

/* ── Public API ──────────────────────────────────────────── */
export function navigate(viewId, triggerEl) {
  _current = viewId;

  // Update views
  document.querySelectorAll('.view').forEach(v => v.classList.remove('view--active'));
  const el = document.getElementById(`view-${viewId}`);
  if (el) el.classList.add('view--active');

  // Update nav items
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('nav-item--active'));
  if (triggerEl) triggerEl.classList.add('nav-item--active');

  // Close sidebar on mobile
  const sb = document.querySelector('.sidebar');
  const ov = document.getElementById('sidebarOverlay');
  if (sb?.classList.contains('open')) {
    sb.classList.remove('open');
    if (ov) { ov.classList.remove('active'); setTimeout(() => { ov.style.display = 'none'; }, 300); }
  }

  renderView(viewId);
}

export function getCurrent() { return _current; }

/* ── Connection Status Indicator ─────────────────────────── */
export function setConnectionStatus(state) {
  const dot = document.getElementById('statusDot');
  const lbl = document.getElementById('statusLabel');

  dot.className = 'conn-status__dot';
  switch (state) {
    case 'ok':
      dot.classList.add('conn-status__dot--ok');
      lbl.textContent = 'CONNECTED';
      break;
    case 'demo':
      dot.classList.add('conn-status__dot--demo');
      lbl.textContent = 'DEMO';
      break;
    case 'error':
      dot.classList.add('conn-status__dot--error');
      lbl.textContent = 'ERROR';
      break;
    default:
      lbl.textContent = 'OFFLINE';
  }
}
