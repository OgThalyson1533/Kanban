/**
 * LIFE CONTROL — Notifications Module v4.0
 * Service Worker registration + Push + Scheduled reminders
 */

export async function initServiceWorker() {
  if (!('serviceWorker' in navigator)) return false;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    console.log('[LC] Service Worker registrado:', reg.scope);
    return reg;
  } catch (e) {
    console.warn('[LC] SW não registrado (esperado em dev local):', e.message);
    return false;
  }
}

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const perm = await Notification.requestPermission();
  return perm === 'granted';
}

export function scheduleHabitReminders(habits) {
  if (!habits?.length) return;
  // Usar setTimeout para lembrar hábitos não checados após 20h
  const now = new Date();
  const target = new Date(now);
  target.setHours(20, 0, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  const delay = target - now;

  setTimeout(() => {
    const unchecked = habits.filter(h => {
      const today = new Date().toISOString().split('T')[0];
      return !h.quit_mode && h.last_check !== today;
    });
    if (unchecked.length && Notification.permission === 'granted') {
      new Notification('🔥 Life Control — Lembrete', {
        body: `${unchecked.length} hábito(s) para checar hoje: ${unchecked.map(h => h.name).join(', ')}`,
        icon: '/icon.png',
        tag: 'habit-reminder',
      });
    }
  }, delay);
}

export function showLocalNotification(title, body, tag = 'lc') {
  if (Notification.permission !== 'granted') return;
  new Notification(title, { body, tag, icon: '/icon.png' });
}
