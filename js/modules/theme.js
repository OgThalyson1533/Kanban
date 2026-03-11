/**
 * LIFE CONTROL — Theme Module
 * Dark / Light mode toggle with persistence.
 * Canvas-design philosophy: "Orbital Precision"
 * Two aesthetic worlds, both meticulously crafted.
 */

const STORAGE_KEY = 'lc_theme';
const HTML = document.documentElement;

/* ── Init ────────────────────────────────────────────────── */
export function initTheme() {
  const saved = localStorage.getItem(STORAGE_KEY) || 'dark';
  _apply(saved, false); // no animation on first load
}

/* ── Toggle ──────────────────────────────────────────────── */
export function toggleTheme() {
  const current = HTML.getAttribute('data-theme') || 'dark';
  const next    = current === 'dark' ? 'light' : 'dark';
  _apply(next, true);
}

export function getTheme() {
  return HTML.getAttribute('data-theme') || 'dark';
}

/* ── Internal ────────────────────────────────────────────── */
function _apply(theme, animate) {
  if (animate) {
    // Flash overlay for cinematic transition
    _flashTransition(theme);
  }

  HTML.setAttribute('data-theme', theme);
  localStorage.setItem(STORAGE_KEY, theme);
  _updateButton(theme);
}

function _updateButton(theme) {
  const icon  = document.querySelector('.theme-toggle__icon');
  const label = document.querySelector('.theme-toggle__label');
  if (icon)  icon.textContent  = theme === 'dark' ? '☀' : '◗';
  if (label) label.textContent = theme === 'dark' ? 'LIGHT MODE' : 'DARK MODE';
}

function _flashTransition(theme) {
  // Create a momentary overlay flash for drama
  const el = document.createElement('div');
  el.style.cssText = `
    position: fixed; inset: 0; z-index: 99999;
    background: ${theme === 'light' ? 'rgba(255,255,255,0.15)' : 'rgba(0,212,255,0.06)'};
    pointer-events: none;
    animation: _themeFlash 0.45s ease forwards;
  `;

  // Inject keyframes once
  if (!document.getElementById('_themeFlashStyle')) {
    const s = document.createElement('style');
    s.id = '_themeFlashStyle';
    s.textContent = `
      @keyframes _themeFlash {
        0%   { opacity: 0; }
        30%  { opacity: 1; }
        100% { opacity: 0; }
      }
    `;
    document.head.appendChild(s);
  }

  document.body.appendChild(el);
  setTimeout(() => el.remove(), 500);
}
