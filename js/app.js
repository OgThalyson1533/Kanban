/**
 * LIFE CONTROL v4.0 — Main Entry Point
 * Auth Flow + All Modules
 */

import { resizeCanvas, closeJackpot }    from './modules/gamification.js';
import { navigate }                       from './modules/navigation.js';
import { renderAll, updateTopBar }        from './modules/ui.js';
import { connectSupabase, useDemoMode, tryAutoConnect, signUp, signIn, signOut, getSession } from './modules/db.js';
import { showToast }                      from './modules/toast.js';
import { initTheme, toggleTheme }         from './modules/theme.js';
import { renderAnalytics, exportData }    from './modules/analytics.js';
import { initServiceWorker, requestNotificationPermission, scheduleHabitReminders } from './modules/notifications.js';
import {
  toggleTaskForm, addTask, deleteTask, dropTask,
  checkHabit, addHabit, addQuitHabit, relapse,
  addTransaction,
  addGoal, updateGoalProgress, celebrateGoal,
} from './modules/actions.js';
import { state, getMaxStreak, getNetBalance, migrateTasks } from './modules/state.js';
import { initPomodoro }       from './modules/pomodoro.js';
import { loadMood }           from './modules/mood.js';
import { loadHealth }         from './modules/health.js';
import { loadFinanceExtras, renderFinances, openFinModal, renderFinanceTrend } from './modules/finance.js';
import { openTaskDetail, exportKanbanReport } from './modules/kanban-detail.js';

/* ─── Learning Hub ───────────────────────────────────────── */
let _videos = JSON.parse(localStorage.getItem('lc_videos') || '[]');
let _videoCatFilter = 'all';
if (!_videos.length) {
  _videos = [
    { id:'v1', title:'Como criar sistemas de produtividade que funcionam', url:'https://www.youtube.com/embed/dQw4w9WgXcQ', cat:'produtividade', watched:false },
    { id:'v2', title:'Investimentos para iniciantes — Renda Fixa vs Variável', url:'https://www.youtube.com/embed/dQw4w9WgXcQ', cat:'financas', watched:false },
    { id:'v3', title:'Meditação mindfulness em 10 minutos por dia', url:'https://www.youtube.com/embed/dQw4w9WgXcQ', cat:'saude', watched:true },
    { id:'v4', title:'JavaScript assíncrono — Promises e Async/Await', url:'https://www.youtube.com/embed/dQw4w9WgXcQ', cat:'tech', watched:false },
    { id:'v5', title:'Mentalidade de crescimento — Carol Dweck', url:'https://www.youtube.com/embed/dQw4w9WgXcQ', cat:'mindset', watched:false },
    { id:'v6', title:'Treino HIIT completo sem equipamento', url:'https://www.youtube.com/embed/dQw4w9WgXcQ', cat:'saude', watched:false },
  ];
  localStorage.setItem('lc_videos', JSON.stringify(_videos));
}
function _saveVideos() { localStorage.setItem('lc_videos', JSON.stringify(_videos)); }
function _youtubeEmbed(url) {
  if (!url) return '';
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : url;
}
function _youtubeThumb(url) {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/);
  return m ? `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg` : '';
}
function renderLearning() {
  const grid = document.getElementById('learningGrid');
  if (!grid) return;
  const filtered = _videoCatFilter === 'all' ? _videos : _videos.filter(v => v.cat === _videoCatFilter);
  if (!filtered.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;padding:var(--sp-10)"><div style="font-size:32px;margin-bottom:var(--sp-3)">▶</div><div>Nenhum vídeo nesta categoria.</div><div style="margin-top:var(--sp-3)"><button class="btn btn--primary" onclick="window._addVideo()">+ Adicionar vídeo</button></div></div>`;
    return;
  }
  const catLabels = { produtividade:'PRODUTIVIDADE', financas:'FINANÇAS', saude:'SAÚDE', tech:'TECH', mindset:'MINDSET' };
  grid.innerHTML = filtered.map(v => {
    const thumb = _youtubeThumb(v.url);
    return `<div class="video-card">
      <div class="video-card__thumb">
        ${thumb ? `<img src="${thumb}" style="width:100%;height:100%;object-fit:cover" alt="${v.title}" loading="lazy">` : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:var(--deep);color:var(--text-muted);font-size:32px">▶</div>`}
        <div class="video-card__play-overlay" onclick="window._watchVideo('${v.id}')"><div class="video-card__play-btn"></div></div>
        ${v.watched ? '<span class="video-card__watched">✓ ASSISTIDO</span>' : ''}
      </div>
      <div class="video-card__body">
        <div class="video-card__title">${v.title}</div>
        <div class="video-card__meta"><span class="video-card__tag">${catLabels[v.cat]||v.cat}</span><span class="video-card__xp">+25 XP</span></div>
        <div style="display:flex;gap:var(--sp-2);margin-top:var(--sp-3)">
          ${!v.watched?`<button class="btn" style="flex:1;font-size:10px" onclick="window._markWatched('${v.id}')">✓ Assistido</button>`:''}
          <button class="btn" style="flex:1;font-size:10px;color:var(--ember)" onclick="window._deleteVideo('${v.id}')">✕</button>
        </div>
      </div></div>`;
  }).join('');
}

/* ─── Auth helpers ───────────────────────────────────────── */
function _authShowError(elId, msg) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
}
function _authClearErrors() {
  ['auth-config-error','auth-login-error','auth-register-error'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.style.display = 'none'; el.textContent = ''; }
  });
}
function _authSetLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  if (loading) { btn.classList.add('loading'); btn.disabled = true; }
  else { btn.classList.remove('loading'); btn.disabled = false; }
}
function _showAuthStep(step) {
  ['config','login','register'].forEach(s => {
    const el = document.getElementById(`auth-step-${s}`);
    if (el) el.style.display = s === step ? 'block' : 'none';
  });
}
function _authAnimateIn() {
  // Animate glow orbs on the auth canvas
  const c = document.getElementById('auth-canvas');
  if (!c) return;
  const ctx = c.getContext('2d');
  c.width = window.innerWidth;
  c.height = window.innerHeight;
  const dots = Array.from({length:40}, () => ({
    x: Math.random() * c.width,
    y: Math.random() * c.height,
    r: Math.random() * 1.5 + 0.3,
    vx: (Math.random()-0.5) * 0.3,
    vy: (Math.random()-0.5) * 0.3,
    a: Math.random(),
  }));
  function frame() {
    if (!document.getElementById('authScreen') || document.getElementById('authScreen').style.display === 'none') return;
    ctx.clearRect(0, 0, c.width, c.height);
    dots.forEach(d => {
      d.x += d.vx; d.y += d.vy; d.a += 0.005;
      if (d.x < 0 || d.x > c.width) d.vx *= -1;
      if (d.y < 0 || d.y > c.height) d.vy *= -1;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI*2);
      ctx.fillStyle = `rgba(0,212,255,${0.3 + 0.2*Math.sin(d.a)})`;
      ctx.fill();
    });
    // Grid lines
    ctx.strokeStyle = 'rgba(0,212,255,0.03)';
    ctx.lineWidth = 1;
    for (let x = 0; x < c.width; x += 60) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,c.height); ctx.stroke(); }
    for (let y = 0; y < c.height; y += 60) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(c.width,y); ctx.stroke(); }
    requestAnimationFrame(frame);
  }
  frame();
}

function _showApp() {
  const authEl = document.getElementById('authScreen');
  if (authEl) authEl.style.display = 'none';
  document.querySelector('.app-shell').style.display = '';
}

function _showAuthScreen(step = 'config') {
  const authEl = document.getElementById('authScreen');
  if (authEl) authEl.style.display = 'flex';
  document.querySelector('.app-shell').style.display = 'none';
  _showAuthStep(step);
  _authAnimateIn();
}

/* ─── Analytics ─────────────────────────────────────────── */
function updateAnalyticsSummary() {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('a-xp', state.profile?.xp || 0);
  set('a-streak', getMaxStreak());
  set('a-tasks', state.tasks?.filter(t => t.status === 'done').length || 0);
  set('a-balance', 'R$' + Math.abs(getNetBalance()).toLocaleString('pt-BR'));
}

/* ─── Global Handlers ────────────────────────────────────── */
Object.assign(window, {

  /* ── Navigation ─────────────────────────────────────── */
  _nav(viewId, el) {
    navigate(viewId, el);
    if (viewId === 'analytics') { updateAnalyticsSummary(); requestAnimationFrame(() => renderAnalytics()); }
    if (viewId === 'learning')  { renderLearning(); }
    if (viewId === 'financas')  { renderFinances(); requestAnimationFrame(() => renderFinanceTrend()); }
    document.querySelectorAll('.mobile-nav__item').forEach(i => i.classList.remove('mobile-nav__item--active'));
    const mItem = document.getElementById(`mn-${viewId}`);
    if (mItem) mItem.classList.add('mobile-nav__item--active');
  },
  _setMobileActive(id) {
    document.querySelectorAll('.mobile-nav__item').forEach(i => i.classList.remove('mobile-nav__item--active'));
    const el = document.getElementById(`mn-${id}`); if (el) el.classList.add('mobile-nav__item--active');
  },
  _toggleSidebar() {
    const sb = document.querySelector('.sidebar');
    const ov = document.getElementById('sidebarOverlay');
    if (!sb) return;
    const isOpen = sb.classList.toggle('open');
    if (ov) { ov.style.display = isOpen ? 'block' : 'none'; requestAnimationFrame(() => ov.classList.toggle('active', isOpen)); }
  },
  _toggleTheme: () => toggleTheme(),

  /* ── Auth ────────────────────────────────────────────── */
  async _authConnect() {
    _authClearErrors();
    const url = document.getElementById('sbUrl')?.value.trim();
    const key = document.getElementById('sbKey')?.value.trim();
    if (!url || !key) { _authShowError('auth-config-error', 'Preencha a URL e a Anon Key do projeto.'); return; }
    _authSetLoading('btnConnect', true);
    try {
      await connectSupabase(url, key);
      localStorage.setItem('lc_sb_url', url);
      localStorage.setItem('lc_sb_key', key);
      // Verificar se já tem sessão
      const session = await getSession();
      if (session) {
        _showApp();
        updateTopBar();
        showToast('Conectado! ⚡', 'success');
      } else {
        _showAuthStep('login');
      }
    } catch(e) {
      _authShowError('auth-config-error', 'Erro ao conectar: ' + e.message);
    } finally {
      _authSetLoading('btnConnect', false);
    }
  },

  async _authLogin() {
    _authClearErrors();
    const email = document.getElementById('loginEmail')?.value.trim();
    const pass  = document.getElementById('loginPass')?.value;
    if (!email || !pass) { _authShowError('auth-login-error', 'Preencha e-mail e senha.'); return; }
    _authSetLoading('btnLogin', true);
    try {
      await signIn(email, pass);
      _showApp();
      updateTopBar();
      showToast('Bem-vindo de volta! ⚡', 'success');
    } catch(e) {
      _authShowError('auth-login-error', 'E-mail ou senha inválidos.');
    } finally {
      _authSetLoading('btnLogin', false);
    }
  },

  async _authRegister() {
    _authClearErrors();
    const name  = document.getElementById('regName')?.value.trim() || 'Comandante';
    const email = document.getElementById('regEmail')?.value.trim();
    const pass  = document.getElementById('regPass')?.value;
    const pass2 = document.getElementById('regPassConfirm')?.value;
    if (!email || !pass) { _authShowError('auth-register-error', 'Preencha e-mail e senha.'); return; }
    if (pass.length < 6)  { _authShowError('auth-register-error', 'Senha deve ter mínimo 6 caracteres.'); return; }
    if (pass !== pass2)   { _authShowError('auth-register-error', 'As senhas não coincidem.'); return; }
    _authSetLoading('btnRegister', true);
    try {
      await signUp(email, pass, name);
      _showApp();
      updateTopBar();
      showToast('Conta criada! Bem-vindo ao Life Control ★', 'success');
    } catch(e) {
      _authShowError('auth-register-error', e.message || 'Erro ao criar conta.');
    } finally {
      _authSetLoading('btnRegister', false);
    }
  },

  _authDemo() {
    useDemoMode();
    _showApp();
    updateTopBar();
    showToast('Modo Demo ativado — seus dados são locais ◈', 'success');
  },

  _authShowLogin()    { _authClearErrors(); _showAuthStep('login'); },
  _authShowRegister() { _authClearErrors(); _showAuthStep('register'); },
  _authBackToConfig() { _authClearErrors(); _showAuthStep('config'); },

  async _authLogout() {
    try { await signOut(); } catch(e) {}
    localStorage.removeItem('lc_sb_url');
    localStorage.removeItem('lc_sb_key');
    _showAuthScreen('config');
    _closeConfigModal();
    showToast('Sessão encerrada.', 'success');
  },

  _authToggleSQL(e) {
    e.preventDefault();
    const b = document.getElementById('authSqlBlock');
    if (b) b.style.display = b.style.display === 'none' ? 'block' : 'none';
  },

  /* ── Tasks ───────────────────────────────────────────── */
  _toggleTaskForm: () => toggleTaskForm(),
  _addTask:        () => addTask(),
  _deleteTask: (id)   => deleteTask(id),
  _dragStart: (e, id) => { state.dragTaskId = id; e.currentTarget.classList.add('task-card--dragging'); e.dataTransfer.effectAllowed = 'move'; },
  _dragEnd:   (e)     => e.currentTarget.classList.remove('task-card--dragging'),
  _dragOver:  (e)     => { e.preventDefault(); e.currentTarget.classList.add('kanban-col__body--dragover'); },
  _dragLeave: (e)     => e.currentTarget.classList.remove('kanban-col__body--dragover'),
  _drop: (e, status)  => {
    e.preventDefault(); e.currentTarget.classList.remove('kanban-col__body--dragover');
    if (state.dragTaskId) { dropTask(state.dragTaskId, status); state.dragTaskId = null; }
  },

  /* ── Icon selectors: Priority & Complexity ──────────── */
  _setPri: (val, btn) => {
    document.getElementById('newTaskPriority').value = val;
    document.querySelectorAll('#priSelector .icon-sel-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  },
  _setCx: (val, btn) => {
    document.getElementById('newTaskComplexity').value = val;
    document.querySelectorAll('#cxSelector .icon-sel-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  },

  /* ── Habits ──────────────────────────────────────────── */
  _checkHabit:   (id) => checkHabit(id),
  _addHabit:     ()   => addHabit(),
  _addQuitHabit: ()   => addQuitHabit(),
  _relapse:      (id) => relapse(id),

  /* ── Finances ────────────────────────────────────────── */
  _addTransaction: () => addTransaction(),

  /* ── Goals ───────────────────────────────────────────── */
  _addGoal:            ()   => addGoal(),
  _updateGoalProgress: (id) => updateGoalProgress(id),
  _celebrateGoal:      ()   => celebrateGoal(),

  /* ── Analytics ───────────────────────────────────────── */
  _refreshAnalytics() { updateAnalyticsSummary(); renderAnalytics(); showToast('Analytics atualizado! ◈', 'success'); },
  _exportJSON()  { exportData('json'); showToast('Exportando JSON…', 'success'); },
  _exportCSV()   { exportData('csv');  showToast('Exportando CSV…', 'success'); },

  /* ── Learning Hub ────────────────────────────────────── */
  _filterVideos(cat, el) {
    _videoCatFilter = cat;
    document.querySelectorAll('.learning-cat').forEach(c => c.classList.remove('learning-cat--active'));
    if (el) el.classList.add('learning-cat--active');
    renderLearning();
  },
  _addVideo() { document.getElementById('addVideoModal').style.display = 'flex'; },
  _closeVideoModal() {
    document.getElementById('addVideoModal').style.display = 'none';
    ['vidUrl','vidTitle'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  },
  _saveVideo() {
    const url   = document.getElementById('vidUrl')?.value.trim();
    const title = document.getElementById('vidTitle')?.value.trim();
    const cat   = document.getElementById('vidCat')?.value || 'produtividade';
    if (!url || !title) { showToast('Preencha URL e Título', 'error'); return; }
    _videos.unshift({ id:'v'+Date.now(), title, url:_youtubeEmbed(url), cat, watched:false });
    _saveVideos(); window._closeVideoModal(); renderLearning();
    showToast('Vídeo adicionado! ▶', 'success');
  },
  _watchVideo(id) {
    const v = _videos.find(v => v.id === id);
    if (!v) return;
    window.open(v.url.replace('/embed/','/watch?v='), '_blank');
  },
  _markWatched(id) {
    const v = _videos.find(v => v.id === id);
    if (!v || v.watched) return;
    v.watched = true; _saveVideos();
    state.profile.xp = (state.profile.xp || 0) + 25;
    updateTopBar(); renderLearning();
    showToast('+25 XP — Vídeo assistido! 🎓', 'success');
  },
  _deleteVideo(id) { _videos = _videos.filter(v => v.id !== id); _saveVideos(); renderLearning(); },

  /* ── Notifications ───────────────────────────────────── */
  async _requestNotifications() {
    const ok = await requestNotificationPermission();
    showToast(ok ? '🔔 Notificações ativadas!' : '🔕 Permissão negada', ok ? 'success' : 'error');
    if (ok) scheduleHabitReminders(state.habits);
  },

  /* ── Supabase Config Modal (in-app) ──────────────────── */
  async _reconnectSupabase() {
    const url = document.getElementById('sbUrlModal')?.value.trim();
    const key = document.getElementById('sbKeyModal')?.value.trim();
    if (!url || !key) { showToast('Preencha URL e Key', 'error'); return; }
    try {
      await connectSupabase(url, key);
      localStorage.setItem('lc_sb_url', url);
      localStorage.setItem('lc_sb_key', key);
      _closeConfigModal();
      showToast('Reconectado! ⚡', 'success');
    } catch(e) { showToast('Erro: ' + e.message, 'error'); }
  },

  _showConfigModal() {
    const modal = document.getElementById('configModal');
    if (!modal) return;
    // Pre-fill with saved values
    const urlEl = document.getElementById('sbUrlModal');
    const keyEl = document.getElementById('sbKeyModal');
    if (urlEl) urlEl.value = localStorage.getItem('lc_sb_url') || '';
    if (keyEl) keyEl.value = localStorage.getItem('lc_sb_key') || '';
    modal.style.display = 'flex';
  },
  _closeConfigModal: () => _closeConfigModal(),

  /* ── Kanban Detail ───────────────────────────────────── */
  _openTaskDetail: (id) => openTaskDetail(id),
  _exportKanbanTXT: ()  => exportKanbanReport('txt'),
  _exportKanbanCSV: ()  => exportKanbanReport('csv'),

  /* ── Finance v2 ──────────────────────────────────────── */
  _openFinanceModal: ()  => openFinModal(),

  /* ── Jackpot / misc ──────────────────────────────────── */
  _closeJackpot: () => closeJackpot(),
  _showSQLSetup: (e) => { e.preventDefault(); const b = document.getElementById('sqlSetupBlock'); if (b) b.style.display = b.style.display === 'none' ? 'block' : 'none'; },
  _jackpotDemo: () => { import('./modules/gamification.js').then(m => m.triggerJackpot('DEMO','JACKPOT!','+100 XP')); },
});

function _closeConfigModal() { document.getElementById('configModal').style.display = 'none'; }

/* ─── Bootstrap ─────────────────────────────────────────── */
async function init() {
  initTheme();
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  initServiceWorker();

  // Load persisted data for new modules
  loadMood();
  loadHealth();
  loadFinanceExtras();
  migrateTasks();

  // Dashboard date
  const dashDate = document.getElementById('dashDate');
  if (dashDate) dashDate.textContent = new Date().toLocaleDateString('pt-BR', { weekday:'long', day:'numeric', month:'long' }).toUpperCase();

  // Try auto-connect with saved credentials
  const savedUrl = localStorage.getItem('lc_sb_url');
  const savedKey = localStorage.getItem('lc_sb_key');

  // Always show auth screen first
  _showAuthScreen(savedUrl && savedKey ? 'login' : 'config');

  if (savedUrl && savedKey) {
    // Pre-fill config fields
    const urlEl = document.getElementById('sbUrl');
    const keyEl = document.getElementById('sbKey');
    if (urlEl) urlEl.value = savedUrl;
    if (keyEl) keyEl.value = savedKey;

    // Try silent auto-connect
    try {
      const connected = await tryAutoConnect();
      if (connected) {
        _showApp();
        updateTopBar();
        return;
      }
    } catch(e) {}
    // Connected but no session → go to login
    _showAuthStep('login');
  }

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay').forEach(m => { m.style.display = 'none'; });
    }
    // Enter to submit auth forms
    if (e.key === 'Enter') {
      const step = document.getElementById('auth-step-login');
      if (step && step.style.display !== 'none') window._authLogin();
    }
  });

  if ('Notification' in window && Notification.permission === 'granted') {
    scheduleHabitReminders(state.habits);
  }

  // Init Pomodoro widget
  initPomodoro();

  // Mobile swipe sidebar
  _initMobileSwipe();
}

function _initMobileSwipe() {
  let _touchStartX = 0;
  document.addEventListener('touchstart', e => { _touchStartX = e.touches[0].clientX; }, { passive: true });
  document.addEventListener('touchend', e => {
    const delta = e.changedTouches[0].clientX - _touchStartX;
    if (delta > 60 && _touchStartX < 30) {
      // Swipe right from edge → open sidebar
      const sb = document.querySelector('.sidebar');
      const ov = document.getElementById('sidebarOverlay');
      if (sb && !sb.classList.contains('open')) {
        sb.classList.add('open');
        if (ov) { ov.style.display = 'block'; requestAnimationFrame(() => ov.classList.add('active')); }
      }
    }
  }, { passive: true });
}

document.addEventListener('DOMContentLoaded', init);
