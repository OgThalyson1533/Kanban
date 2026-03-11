# LIFE CONTROL — Sistema de Domínio Total

> **Design Philosophy: "Orbital Precision"**  
> Two aesthetic worlds, both meticulously crafted from the ground up.  
> Dark: SpaceX void darkness with plasma glow.  
> Light: Lunar Parchment — editorial warmth, ink precision.

## Estrutura

```
life-control/
├── index.html              ← HTML semântico (entry point)
├── README.md               ← Este arquivo
├── css/
│   ├── variables.css       ← Design tokens (dark + light themes)
│   ├── base.css            ← Reset, scanlines, noise, z-index, theme transitions
│   ├── layout.css          ← App grid, topbar, sidebar, main
│   ├── navigation.css      ← Logo, nav-items, theme toggle button
│   ├── components.css      ← Cards, buttons, inputs, tags, progress
│   └── views.css           ← Kanban, habits, finances, goals, overlays
└── js/
    ├── app.js              ← Bootstrap & global wiring
    └── modules/
        ├── state.js        ← Single source of truth + demo data
        ├── db.js           ← Supabase SDK, CRUD, Realtime subscriptions
        ├── gamification.js ← XP, coins, jackpot, particle engine
        ├── navigation.js   ← View routing, connection status
        ├── ui.js           ← Todos os renderers (sem side-effects)
        ├── actions.js      ← Mutations: validate → persist → render
        ├── toast.js        ← Sistema de notificações
        └── theme.js        ← Dark/Light toggle com flash transition
```

## Setup Supabase

1. Crie um projeto em [supabase.com](https://supabase.com)
2. Execute o SQL do modal de configuração
3. Cole a URL e Anon Key no modal ao abrir o app
4. Ou clique em **◈ MODO DEMO** para testar sem banco

## Skills Utilizadas
- **frontend-design**: Estética SpaceX dark + Lunar Parchment light, tipografia Big Shoulders + JetBrains Mono, animações CSS painstakingly crafted
- **canvas-design**: Filosofia visual "Orbital Precision" — tokens de cor, shadow system, noise texture, scanlines como linguagem visual do sistema
