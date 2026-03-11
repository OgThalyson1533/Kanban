/**
 * LIFE CONTROL — Gamification Module
 * XP, Coins, Levels, Jackpot, Particles.
 */

import { state, getLevel, getXpPct } from './state.js';
import { patchProfile } from './supabase.js';
import { updateTopBar } from './ui.js';

/* ═══════════════════════════════════════════════════════════
   XP & Coins
   ═══════════════════════════════════════════════════════════ */
export async function awardXP(amount) {
  state.profile.xp    = (state.profile.xp    || 0) + amount;
  state.profile.coins = (state.profile.coins || 0) + Math.floor(amount / 5);
  state.profile.level = getLevel(state.profile.xp);
  updateTopBar();
  await patchProfile({ xp: state.profile.xp, coins: state.profile.coins, level: state.profile.level });
}

/* ═══════════════════════════════════════════════════════════
   Jackpot Overlay
   ═══════════════════════════════════════════════════════════ */
let _jackpotTimer = null;

export function triggerJackpot(title, sub, xpText) {
  const overlay = document.getElementById('jackpotOverlay');
  document.getElementById('jackpotTitle').textContent = title;
  document.getElementById('jackpotSub').textContent   = sub;
  document.getElementById('jackpotXP').textContent    = xpText;

  overlay.classList.add('jackpot-overlay--show');
  fireParticles('jackpot', window.innerWidth / 2, window.innerHeight / 2);

  clearTimeout(_jackpotTimer);
  _jackpotTimer = setTimeout(() => closeJackpot(), 3600);
}

export function closeJackpot() {
  document.getElementById('jackpotOverlay').classList.remove('jackpot-overlay--show');
}

/* ═══════════════════════════════════════════════════════════
   Particle Engine
   ═══════════════════════════════════════════════════════════ */
const canvas = document.getElementById('particle-canvas');
const ctx    = canvas.getContext('2d');
let _particles = [];
let _animId    = null;

export function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}

class Particle {
  constructor(x, y, type) {
    this.x = x; this.y = y; this.type = type;
    const speed = type === 'jackpot' ? (Math.random() * 14 + 4) : (Math.random() * 6 + 2);
    const angle = Math.random() * Math.PI * 2;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed - (type === 'jackpot' ? 8 : 2);
    this.maxLife = type === 'jackpot' ? 130 : 70;
    this.life    = this.maxLife;
    this.size    = type === 'jackpot' ? Math.random() * 9 + 4 : Math.random() * 4 + 2;
    const palettes = {
      jackpot: ['#f5c842', '#00d4ff', '#00ff88', '#ff4d1a', '#ffffff'],
      check:   ['#00d4ff', '#00ff88', '#f5c842'],
    };
    const pal = palettes[type] || palettes.check;
    this.color    = pal[Math.floor(Math.random() * pal.length)];
    this.shape    = (type === 'jackpot' && Math.random() > 0.5) ? 'rect' : 'circle';
    this.rotation = Math.random() * Math.PI * 2;
    this.rotSpeed = (Math.random() - 0.5) * 0.35;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.28;
    this.life--;
    this.rotation += this.rotSpeed;
  }

  draw(c) {
    c.save();
    c.globalAlpha = this.life / this.maxLife;
    c.fillStyle   = this.color;
    c.translate(this.x, this.y);
    c.rotate(this.rotation);
    if (this.shape === 'rect') {
      c.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
    } else {
      c.beginPath();
      c.arc(0, 0, this.size / 2, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  }
}

export function fireParticles(type, x, y) {
  const count = type === 'jackpot' ? 220 : 70;
  for (let i = 0; i < count; i++) {
    _particles.push(new Particle(x, y, type));
  }
  if (!_animId) _tick();
}

function _tick() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  _particles = _particles.filter(p => p.life > 0);
  _particles.forEach(p => { p.update(); p.draw(ctx); });
  if (_particles.length > 0) {
    _animId = requestAnimationFrame(_tick);
  } else {
    _animId = null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}
