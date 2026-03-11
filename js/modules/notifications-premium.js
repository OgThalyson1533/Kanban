/**
 * LIFE CONTROL — Notifications Module (v2 - Premium)
 * Sistema profissional de notificações com suporte a:
 * - Múltiplas prioridades
 * - Ícones automáticos
 * - Animações elegantes
 * - Auto-dismiss com progresso
 * - Desmissel manual
 */

const DURATION = {
  info:    3200,
  success: 3200,
  warning: 4000,
  error:   5000,
};

const ICONS = {
  success: '✓',
  error:   '✕',
  warning: '⚠',
  info:    'ⓘ',
};

export function showNotification(message, type = 'info', options = {}) {
  const container = _getContainer();
  const el = document.createElement('div');
  
  const notifId = `notif-${Date.now()}-${Math.random()}`;
  el.id = notifId;
  
  const icon = options.icon || ICONS[type] || '●';
  const duration = options.duration || DURATION[type] || 3200;
  
  el.className = ['notification', `notification--${type}`].join(' ');
  el.innerHTML = `
    <div class="notification__content">
      <div class="notification__icon">${icon}</div>
      <div class="notification__message">
        <div class="notification__text">${_esc(message)}</div>
        ${options.subtitle ? `<div class="notification__subtitle">${_esc(options.subtitle)}</div>` : ''}
      </div>
      ${!options.persist ? `<button class="notification__close" onclick="window._dismissNotification('${notifId}')">✕</button>` : ''}
    </div>
    <div class="notification__progress"></div>
  `;
  
  container.appendChild(el);
  
  // Trigger animation entry
  setTimeout(() => el.classList.add('notification--visible'), 10);
  
  if (!options.persist) {
    const timer = setTimeout(() => _dismissNotification(notifId), duration);
    el.addEventListener('mouseenter', () => clearTimeout(timer));
  }
  
  return notifId;
}

// Aliases para compatibilidade
export function showToast(message, type = '') {
  const typeMap = {
    success: 'success',
    error: 'error',
    gold: 'warning',
    '': 'info',
  };
  return showNotification(message, typeMap[type] || 'info');
}

export function showSuccess(message, options = {}) {
  return showNotification(message, 'success', options);
}

export function showError(message, options = {}) {
  return showNotification(message, 'error', options);
}

export function showWarning(message, options = {}) {
  return showNotification(message, 'warning', options);
}

export function showInfo(message, options = {}) {
  return showNotification(message, 'info', options);
}

window._dismissNotification = (id) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('notification--visible');
  setTimeout(() => el.remove(), 320);
};

function _getContainer() {
  let container = document.getElementById('notificationContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'notificationContainer';
    container.className = 'notification-container';
    document.body.appendChild(container);
  }
  return container;
}

function _esc(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
