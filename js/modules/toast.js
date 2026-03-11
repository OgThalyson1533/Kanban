/**
 * LIFE CONTROL — Toast Module
 */

const DURATION = 3200;

export function showToast(message, type = '') {
  const container = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = ['toast', type ? `toast--${type}` : ''].filter(Boolean).join(' ');
  el.textContent = message;
  el.addEventListener('click', () => _dismiss(el));
  container.appendChild(el);
  setTimeout(() => _dismiss(el), DURATION);
}

function _dismiss(el) {
  el.style.opacity = '0';
  setTimeout(() => el.remove(), 320);
}
