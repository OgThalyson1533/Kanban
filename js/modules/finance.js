/**
 * LIFE CONTROL — Finance Module v3
 * Nível contabilidade: DRE, Fluxo de Caixa, Balancete, Contas a Pagar/Receber,
 * Centros de Custo, Conciliação, Projeção e Relatórios Profissionais.
 */

import { state, TODAY } from './state.js';
import { insertFinance, removeFinance } from './supabase.js';
import { showToast } from './toast.js';

/* ══════════════════════════════════════════════════════════
   STORAGE KEYS
   ══════════════════════════════════════════════════════════ */
const LS = {
  accounts:   'lc_accounts_v3',
  budgets:    'lc_budgets_v3',
  savings:    'lc_savings_v3',
  costcenter: 'lc_costcenter_v3',
  recurring:  'lc_recurring_v3',
  payables:   'lc_payables_v3',
};

function _load(key, def = []) {
  try { return JSON.parse(localStorage.getItem(LS[key]) || 'null') ?? def; } catch { return def; }
}
function _save(key, val) { localStorage.setItem(LS[key], JSON.stringify(val)); }

/* ══════════════════════════════════════════════════════════
   BOOT / SEED
   ══════════════════════════════════════════════════════════ */
export function loadFinanceExtras() {
  state.accounts   = _load('accounts');
  state.budgets    = _load('budgets');
  state.savings    = _load('savings');
  state.costcenters = _load('costcenter');
  state.recurring  = _load('recurring');
  state.payables   = _load('payables');

  if (!state.accounts.length)    _seedAccounts();
  if (!state.budgets.length)     _seedBudgets();
  if (!state.savings.length)     _seedSavings();
  if (!state.costcenters.length) _seedCostCenters();
  if (!state.payables.length)    _seedPayables();
}

function _seedAccounts() {
  state.accounts = [
    { id:'acc1', name:'Conta Corrente', type:'checking', bank:'Nubank',   balance:4200,   color:'plasma', icon:'💳', agency:'0001', account:'12345-6' },
    { id:'acc2', name:'Poupança',       type:'savings',  bank:'Caixa',    balance:12500,  color:'mint',   icon:'🏦', agency:'0021', account:'98765-0' },
    { id:'acc3', name:'Investimentos',  type:'invest',   bank:'XP',       balance:35000,  color:'gold',   icon:'📈' },
    { id:'acc4', name:'Cartão Crédito', type:'credit',   bank:'Nubank',   balance:-1200,  color:'ember',  icon:'💳', limit:10000 },
  ];
  _save('accounts', state.accounts);
}

function _seedBudgets() {
  state.budgets = [
    { id:'b1', category:'Moradia',      limit:2000, color:'plasma' },
    { id:'b2', category:'Alimentação',  limit:800,  color:'gold'   },
    { id:'b3', category:'Transporte',   limit:400,  color:'mint'   },
    { id:'b4', category:'Saúde',        limit:300,  color:'ember'  },
    { id:'b5', category:'Lazer',        limit:500,  color:'plasma' },
    { id:'b6', category:'Educação',     limit:600,  color:'gold'   },
    { id:'b7', category:'Assinaturas',  limit:200,  color:'mint'   },
  ];
  _save('budgets', state.budgets);
}

function _seedSavings() {
  state.savings = [
    { id:'sv1', name:'Fundo Emergência', target:30000,  current:18000, color:'mint',   icon:'🛡️', deadline:'2025-12-31' },
    { id:'sv2', name:'Viagem Europa',    target:15000,  current:4200,  color:'plasma', icon:'✈️', deadline:'2026-06-30' },
    { id:'sv3', name:'Aposentadoria',    target:500000, current:35000, color:'gold',   icon:'🌅', deadline:'2045-12-31' },
  ];
  _save('savings', state.savings);
}

function _seedCostCenters() {
  state.costcenters = [
    { id:'cc1', name:'Pessoal',    code:'100', color:'plasma' },
    { id:'cc2', name:'Operacional',code:'200', color:'gold'   },
    { id:'cc3', name:'Marketing',  code:'300', color:'mint'   },
    { id:'cc4', name:'TI',         code:'400', color:'ember'  },
  ];
  _save('costcenter', state.costcenters);
}

function _seedPayables() {
  const today = TODAY();
  state.payables = [
    { id:'p1', description:'Aluguel',      amount:1800, type:'payable',   dueDate: _addDays(today, 5),   category:'Moradia',     status:'pending',  recurrence:'Mensal' },
    { id:'p2', description:'Energia',      amount:180,  type:'payable',   dueDate: _addDays(today, 12),  category:'Moradia',     status:'pending',  recurrence:'Mensal' },
    { id:'p3', description:'Salário',      amount:8500, type:'receivable',dueDate: _addDays(today, 3),   category:'Salário',     status:'pending',  recurrence:'Mensal' },
    { id:'p4', description:'Freelance',    amount:2000, type:'receivable',dueDate: _addDays(today, 20),  category:'Freelance',   status:'pending',  recurrence:'Única'  },
    { id:'p5', description:'Internet',     amount:120,  type:'payable',   dueDate: _addDays(today, -2),  category:'Assinaturas', status:'overdue',  recurrence:'Mensal' },
  ];
  _save('payables', state.payables);
}

function _addDays(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

/* ══════════════════════════════════════════════════════════
   CATEGORIES
   ══════════════════════════════════════════════════════════ */
export const INCOME_CATS  = ['Salário','Freelance','Dividendos','Aluguel Recebido','Investimentos','Décimo Terceiro','Férias','Outros'];
export const EXPENSE_CATS = ['Moradia','Alimentação','Transporte','Saúde','Educação','Lazer','Vestuário','Assinaturas','Serviços','Impostos','Outros'];
export const RECURRENCE   = ['Única','Diária','Semanal','Quinzenal','Mensal','Trimestral','Semestral','Anual'];
export const PAY_STATUS   = { pending:'PENDENTE', paid:'PAGO', overdue:'VENCIDO', cancelled:'CANCELADO' };

/* ══════════════════════════════════════════════════════════
   COMPUTED — MONTH / YEAR
   ══════════════════════════════════════════════════════════ */
export function getCurrent() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth()+1 };
}

export function getTxMonth(year, month) {
  return state.finances.filter(f => {
    const d = new Date((f.reference_date || f.created_at || '').split('T')[0]+'T12:00:00');
    return d.getFullYear()===year && d.getMonth()+1===month;
  });
}

export function getMonthSummary(year, month) {
  const txs     = getTxMonth(year, month);
  const income  = txs.filter(f=>f.type==='income').reduce((s,f)=>s+ +f.amount,0);
  const expense = txs.filter(f=>f.type==='expense').reduce((s,f)=>s+ +f.amount,0);
  const net     = income - expense;
  const savingsRate = income > 0 ? net/income*100 : 0;
  return { income, expense, net, savingsRate };
}

export function getExpByCat(year, month) {
  const txs = getTxMonth(year, month).filter(f=>f.type==='expense');
  const map = {};
  txs.forEach(f => { map[f.category||'Outros'] = (map[f.category||'Outros']||0) + +f.amount; });
  return Object.entries(map).map(([k,v])=>({category:k,amount:v})).sort((a,b)=>b.amount-a.amount);
}

export function getIncByCat(year, month) {
  const txs = getTxMonth(year, month).filter(f=>f.type==='income');
  const map = {};
  txs.forEach(f => { map[f.category||'Outros'] = (map[f.category||'Outros']||0) + +f.amount; });
  return Object.entries(map).map(([k,v])=>({category:k,amount:v})).sort((a,b)=>b.amount-a.amount);
}

export function getBudgetStatus(year, month) {
  const byCat = getExpByCat(year, month);
  return state.budgets.map(b => {
    const spent = byCat.find(c=>c.category===b.category)?.amount || 0;
    const pct   = b.limit > 0 ? Math.min(120, spent/b.limit*100) : 0;
    return { ...b, spent, pct, over: spent > b.limit };
  });
}

export function getTrend(months = 6) {
  const res = [];
  for (let i = months-1; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth()-i);
    const y = d.getFullYear(), m = d.getMonth()+1;
    const s = getMonthSummary(y, m);
    res.push({ label: d.toLocaleDateString('pt-BR',{month:'short'}).toUpperCase().replace('.',''), ...s, y, m });
  }
  return res;
}

export function getPatrimony() {
  return (state.accounts||[]).reduce((s,a) => s + (+a.balance||0), 0);
}

export function getDRE(year, month) {
  const txs    = getTxMonth(year, month);
  const income = getIncByCat(year, month);
  const costs  = getExpByCat(year, month);
  const totInc = income.reduce((s,c)=>s+c.amount,0);
  const totExp = costs.reduce((s,c)=>s+c.amount,0);

  // Gross margin (income - direct costs)
  const directCats = ['Serviços','Transporte'];
  const direct = costs.filter(c=>directCats.includes(c.category)).reduce((s,c)=>s+c.amount,0);
  const lucroB = totInc - direct;
  const lucroBruto = totInc > 0 ? lucroB/totInc*100 : 0;

  // Fixed vs variable
  const fixedCats = ['Moradia','Assinaturas','Educação','Saúde'];
  const fixed    = costs.filter(c=>fixedCats.includes(c.category)).reduce((s,c)=>s+c.amount,0);
  const variable = totExp - fixed;

  return { income, costs, totInc, totExp, net: totInc-totExp, lucroBruto, fixed, variable };
}

export function getPayables() {
  const today = TODAY();
  return (state.payables||[]).map(p => {
    const overdue = p.dueDate < today && p.status === 'pending';
    return { ...p, status: overdue ? 'overdue' : p.status };
  }).sort((a,b) => a.dueDate.localeCompare(b.dueDate));
}

export function getProjection(months = 3) {
  const trend = getTrend(6);
  const avgInc = trend.reduce((s,t)=>s+t.income,0) / (trend.length||1);
  const avgExp = trend.reduce((s,t)=>s+t.expense,0) / (trend.length||1);
  const res = [];
  for (let i = 1; i <= months; i++) {
    const d = new Date(); d.setMonth(d.getMonth()+i);
    const label = d.toLocaleDateString('pt-BR',{month:'short',year:'2-digit'}).toUpperCase();
    res.push({ label, income: avgInc, expense: avgExp, net: avgInc-avgExp });
  }
  return res;
}

/* ══════════════════════════════════════════════════════════
   MUTATIONS
   ══════════════════════════════════════════════════════════ */
export async function addFinanceEntry(payload) {
  await insertFinance(payload);
  renderFinances();
  showToast('✓ Lançamento salvo!', 'success');
}

export async function removeFinanceEntry(id) {
  await removeFinance(id);
  renderFinances();
}

export function saveAccount(a) {
  const idx = (state.accounts||[]).findIndex(x=>x.id===a.id);
  if (idx >= 0) state.accounts[idx] = a; else state.accounts.push({ ...a, id:'acc'+Date.now() });
  _save('accounts', state.accounts); renderFinances();
}

export function updateAccountBalance(id, balance) {
  const acc = (state.accounts||[]).find(a=>a.id===id);
  if (acc) { acc.balance = balance; _save('accounts', state.accounts); renderFinances(); }
}

export function saveBudget(b) {
  const idx = (state.budgets||[]).findIndex(x=>x.id===b.id);
  if (idx >= 0) state.budgets[idx] = b; else state.budgets.push({ ...b, id:'b'+Date.now() });
  _save('budgets', state.budgets); renderFinances();
}

export function saveSavings(sg) {
  const idx = (state.savings||[]).findIndex(x=>x.id===sg.id);
  if (idx >= 0) state.savings[idx] = sg; else state.savings.push({ ...sg, id:'sv'+Date.now() });
  _save('savings', state.savings); renderFinances();
}

export function addToSavings(id, amount) {
  const sv = (state.savings||[]).find(s=>s.id===id);
  if (!sv) return;
  sv.current = Math.min(sv.target, sv.current + amount);
  _save('savings', state.savings); renderFinances();
  showToast(`💰 +R$${amount.toLocaleString('pt-BR')} em ${sv.name}!`, 'success');
}

export function savePayable(p) {
  const idx = (state.payables||[]).findIndex(x=>x.id===p.id);
  if (idx >= 0) state.payables[idx] = p; else state.payables.push({ ...p, id:'p'+Date.now() });
  _save('payables', state.payables); renderFinances();
}

export function markPayable(id, status) {
  const p = (state.payables||[]).find(x=>x.id===id);
  if (!p) return;
  p.status = status;

  // If marking as paid, auto-create a finance transaction
  if (status === 'paid') {
    const payload = {
      description:    p.description,
      amount:         p.amount,
      type:           p.type === 'payable' ? 'expense' : 'income',
      category:       p.category || 'Geral',
      reference_date: TODAY(),
      recurrence:     p.recurrence || 'Única',
      note:           `Auto de conta a ${p.type==='payable'?'pagar':'receber'}`,
    };
    insertFinance(payload).then(() => renderFinances());
    showToast(`✓ ${p.type==='payable'?'Pagamento':'Recebimento'} registrado!`, 'success');
  }

  _save('payables', state.payables); renderFinances();
}

export function deletePayable(id) {
  state.payables = (state.payables||[]).filter(x=>x.id!==id);
  _save('payables', state.payables); renderFinances();
}

/* ══════════════════════════════════════════════════════════
   RENDER STATE
   ══════════════════════════════════════════════════════════ */
let _activeTab = 'overview';

export function renderFinances() {
  const root = document.getElementById('financasRoot');
  if (!root) return;
  const { year, month } = getCurrent();
  const summary  = getMonthSummary(year, month);
  const patrimony = getPatrimony();
  const payables  = getPayables();
  const overduePay = payables.filter(p=>p.status==='overdue').length;
  const pendingPay = payables.filter(p=>p.status==='pending' && p.type==='payable').reduce((s,p)=>s+ +p.amount,0);
  const pendingRec = payables.filter(p=>p.status==='pending' && p.type==='receivable').reduce((s,p)=>s+ +p.amount,0);

  const MNAMES = ['','Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  root.innerHTML = `
    <!-- KPIs row -->
    <div class="fin-kpis">
      <div class="fin-kpi fin-kpi--mint">
        <div class="fin-kpi__icon">↑</div>
        <div>
          <div class="fin-kpi__label">RECEITAS · ${MNAMES[month]}</div>
          <div class="fin-kpi__val">R$${_fmt(summary.income)}</div>
          <div class="fin-kpi__sub">${getIncByCat(year,month)[0]?.category||'—'} é maior fonte</div>
        </div>
      </div>
      <div class="fin-kpi fin-kpi--ember">
        <div class="fin-kpi__icon">↓</div>
        <div>
          <div class="fin-kpi__label">DESPESAS · ${MNAMES[month]}</div>
          <div class="fin-kpi__val">R$${_fmt(summary.expense)}</div>
          <div class="fin-kpi__sub">${getExpByCat(year,month)[0]?.category||'—'} maior gasto</div>
        </div>
      </div>
      <div class="fin-kpi fin-kpi--plasma">
        <div class="fin-kpi__icon">${summary.net>=0?'◈':'▽'}</div>
        <div>
          <div class="fin-kpi__label">RESULTADO LÍQUIDO</div>
          <div class="fin-kpi__val" style="color:${summary.net>=0?'var(--mint)':'var(--ember)'}">
            ${summary.net>=0?'+':''}R$${_fmt(summary.net)}
          </div>
          <div class="fin-kpi__sub">Taxa poupança: ${summary.savingsRate.toFixed(1)}%</div>
        </div>
      </div>
      <div class="fin-kpi fin-kpi--gold">
        <div class="fin-kpi__icon">★</div>
        <div>
          <div class="fin-kpi__label">PATRIMÔNIO TOTAL</div>
          <div class="fin-kpi__val">R$${_fmt(patrimony)}</div>
          <div class="fin-kpi__sub">${(state.accounts||[]).length} contas</div>
        </div>
      </div>
      <div class="fin-kpi fin-kpi--ember" style="${overduePay?'border-color:var(--ember)':''}">
        <div class="fin-kpi__icon">📋</div>
        <div>
          <div class="fin-kpi__label">A PAGAR</div>
          <div class="fin-kpi__val" style="${overduePay?'color:var(--ember)':''}">R$${_fmt(pendingPay)}</div>
          <div class="fin-kpi__sub">${overduePay?`⚠ ${overduePay} vencida(s)`:'tudo em dia'}</div>
        </div>
      </div>
      <div class="fin-kpi fin-kpi--mint">
        <div class="fin-kpi__icon">💸</div>
        <div>
          <div class="fin-kpi__label">A RECEBER</div>
          <div class="fin-kpi__val">R$${_fmt(pendingRec)}</div>
          <div class="fin-kpi__sub">Previsto para entrar</div>
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="fin-tabs">
      ${[
        ['overview',      '◈ VISÃO GERAL'],
        ['dre',           '📊 DRE'],
        ['cashflow',      '💸 FLUXO DE CAIXA'],
        ['transactions',  '↕ LANÇAMENTOS'],
        ['payables',      `📋 CONTAS${overduePay?` <span class="fin-alert-dot">${overduePay}</span>`:''}`],
        ['accounts',      '🏦 CONTAS'],
        ['budget',        '📉 ORÇAMENTO'],
        ['savings',       '💰 ECONOMIA'],
      ].map(([id, label]) => `
        <button class="fin-tab ${_activeTab===id?'fin-tab--active':''}"
                onclick="window._finTab('${id}')">${label}</button>
      `).join('')}
      <div style="flex:1"></div>
      <button class="fin-tab fin-tab--action" onclick="window._openFinModal()">+ LANÇAMENTO</button>
      <button class="fin-tab fin-tab--export" onclick="window._exportFinanceReport()">⬇ RELATÓRIO</button>
    </div>

    <div id="finTabContent">${_renderTab(_activeTab, year, month)}</div>
  `;

  requestAnimationFrame(() => _drawCharts(year, month));
}

/* ══════════════════════════════════════════════════════════
   TABS
   ══════════════════════════════════════════════════════════ */
function _renderTab(tab, year, month) {
  switch(tab) {
    case 'overview':     return _tabOverview(year, month);
    case 'dre':          return _tabDRE(year, month);
    case 'cashflow':     return _tabCashFlow(year, month);
    case 'transactions': return _tabTransactions();
    case 'payables':     return _tabPayables();
    case 'accounts':     return _tabAccounts();
    case 'budget':       return _tabBudget(year, month);
    case 'savings':      return _tabSavings();
    default: return '';
  }
}

/* ── OVERVIEW ──────────────────────────────────────────── */
function _tabOverview(year, month) {
  const byCat   = getExpByCat(year, month);
  const maxExp  = Math.max(...byCat.map(c=>c.amount), 1);
  const summary = getMonthSummary(year, month);
  const srColor = summary.savingsRate >= 20 ? 'var(--mint)' : summary.savingsRate >= 10 ? 'var(--gold)' : 'var(--ember)';

  return `
    <div class="fin-overview-grid">
      <div class="fin-card fin-card--wide">
        <div class="fin-card__title">EVOLUÇÃO 6 MESES — RECEITAS vs DESPESAS vs SALDO</div>
        <canvas id="finTrendChart" style="width:100%;height:160px;margin-top:12px;display:block"></canvas>
        <div style="display:flex;gap:20px;margin-top:8px">
          <span class="fin-legend-dot" style="--c:var(--mint)">RECEITAS</span>
          <span class="fin-legend-dot" style="--c:var(--ember)">DESPESAS</span>
          <span class="fin-legend-dot" style="--c:var(--plasma)">SALDO</span>
        </div>
      </div>

      <div class="fin-card">
        <div class="fin-card__title">TAXA DE POUPANÇA</div>
        <div class="fin-savings-rate" style="color:${srColor}">${summary.savingsRate.toFixed(1)}%</div>
        <div style="font-family:var(--font-mono);font-size:9px;color:${srColor};margin-top:4px">
          ${summary.savingsRate>=20?'🏆 EXCELENTE — >20%':summary.savingsRate>=10?'👍 BOM — 10-20%':'⚠ MELHORAR — <10%'}
        </div>
        <div class="progress" style="margin-top:10px;height:6px">
          <div class="progress__fill" style="width:${Math.min(100,summary.savingsRate)}%;background:${srColor}"></div>
        </div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:8px">
          R$${_fmt(summary.net)} economizados este mês
        </div>
      </div>

      <div class="fin-card">
        <div class="fin-card__title">DESPESAS POR CATEGORIA</div>
        <div style="margin-top:12px;display:flex;flex-direction:column;gap:8px">
          ${byCat.slice(0,7).map((c,i)=>{
            const COLS=['var(--ember)','var(--gold)','var(--plasma)','var(--mint)','#9b59b6','#e67e22','#1abc9c'];
            const col=COLS[i%COLS.length], pct=(c.amount/maxExp*100).toFixed(0);
            return `<div>
              <div style="display:flex;justify-content:space-between;margin-bottom:3px">
                <span style="font-size:11px">${c.category}</span>
                <span style="font-family:var(--font-mono);font-size:10px;color:${col}">R$${_fmt(c.amount)}</span>
              </div>
              <div class="progress" style="height:4px"><div class="progress__fill" style="width:${pct}%;background:${col}"></div></div>
            </div>`;
          }).join('')||'<div class="empty-state">Sem despesas.</div>'}
        </div>
      </div>

      <div class="fin-card">
        <div class="fin-card__title">PROJEÇÃO PRÓXIMOS 3 MESES</div>
        <canvas id="finProjChart" style="width:100%;height:120px;margin-top:12px;display:block"></canvas>
        <div style="font-family:var(--font-mono);font-size:9px;color:var(--text-muted);margin-top:8px">
          Baseado na média dos últimos 6 meses
        </div>
      </div>
    </div>`;
}

/* ── DRE ───────────────────────────────────────────────── */
function _tabDRE(year, month) {
  const dre = getDRE(year, month);
  const MNAMES=['','Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  const row = (label, val, indent=0, color='', bold=false) => `
    <div class="dre-row ${bold?'dre-row--bold':''}">
      <div class="dre-row__label" style="padding-left:${indent*16}px">${label}</div>
      <div class="dre-row__val" style="color:${color||'var(--text)'}">R$${_fmt(Math.abs(val))}</div>
      <div class="dre-row__val" style="color:${color||'var(--text-muted)'}">
        ${dre.totInc > 0 ? (Math.abs(val)/dre.totInc*100).toFixed(1)+'%' : '—'}
      </div>
    </div>`;

  return `
    <div class="dre-container">
      <div class="dre-header">
        <div class="dre-header__title">DEMONSTRATIVO DE RESULTADO (DRE)</div>
        <div class="dre-header__period">${MNAMES[month]} ${year}</div>
      </div>

      <div class="dre-table">
        <div class="dre-table-header">
          <div>CONTA</div><div>VALOR</div><div>% RECEITA</div>
        </div>

        <div class="dre-section">RECEITAS BRUTAS</div>
        ${dre.income.map(c => row(c.category, c.amount, 1, 'var(--mint)')).join('')}
        ${row('(=) TOTAL RECEITAS', dre.totInc, 0, 'var(--mint)', true)}

        <div class="dre-spacer"></div>
        <div class="dre-section">CUSTOS E DESPESAS</div>
        ${dre.costs.map(c => row(c.category, c.amount, 1, 'var(--ember)')).join('')}
        ${row('(=) TOTAL DESPESAS', dre.totExp, 0, 'var(--ember)', true)}

        <div class="dre-spacer"></div>
        <div class="dre-section">RESULTADO</div>
        ${row('Despesas Fixas', dre.fixed, 1, 'var(--gold)')}
        ${row('Despesas Variáveis', dre.variable, 1, 'var(--gold)')}

        <div class="dre-result ${dre.net>=0?'dre-result--profit':'dre-result--loss'}">
          <div class="dre-result__label">${dre.net>=0?'(=) LUCRO LÍQUIDO':'(=) PREJUÍZO'}</div>
          <div class="dre-result__val">R$${_fmt(Math.abs(dre.net))}</div>
          <div class="dre-result__pct">${dre.totInc>0?Math.abs(dre.net/dre.totInc*100).toFixed(1)+'%':'—'}</div>
        </div>
      </div>

      <!-- KPIs DRE -->
      <div class="dre-kpis">
        <div class="dre-kpi">
          <div class="dre-kpi__label">MARGEM BRUTA</div>
          <div class="dre-kpi__val" style="color:var(--mint)">${dre.lucroBruto.toFixed(1)}%</div>
        </div>
        <div class="dre-kpi">
          <div class="dre-kpi__label">CUSTOS FIXOS</div>
          <div class="dre-kpi__val" style="color:var(--gold)">R$${_fmt(dre.fixed)}</div>
        </div>
        <div class="dre-kpi">
          <div class="dre-kpi__label">CUSTOS VARIÁVEIS</div>
          <div class="dre-kpi__val" style="color:var(--ember)">R$${_fmt(dre.variable)}</div>
        </div>
        <div class="dre-kpi">
          <div class="dre-kpi__label">COEFICIENTE</div>
          <div class="dre-kpi__val" style="color:var(--plasma)">
            ${dre.totInc>0?(dre.totExp/dre.totInc*100).toFixed(0)+'%':'—'}
          </div>
        </div>
      </div>
    </div>`;
}

/* ── CASH FLOW ─────────────────────────────────────────── */
function _tabCashFlow(year, month) {
  const trend = getTrend(6);
  const proj  = getProjection(3);
  const allData = [...trend, ...proj.map(p=>({...p, projected:true}))];

  return `
    <div class="fin-card fin-card--wide" style="margin-bottom:var(--sp-4)">
      <div class="fin-card__title">FLUXO DE CAIXA — HISTÓRICO + PROJEÇÃO</div>
      <canvas id="finCashChart" style="width:100%;height:200px;margin-top:12px;display:block"></canvas>
      <div style="display:flex;gap:20px;margin-top:8px">
        <span class="fin-legend-dot" style="--c:var(--mint)">RECEITAS</span>
        <span class="fin-legend-dot" style="--c:var(--ember)">DESPESAS</span>
        <span class="fin-legend-dot" style="--c:var(--plasma)">SALDO</span>
        <span class="fin-legend-dot" style="--c:#888;opacity:.6">PROJEÇÃO</span>
      </div>
    </div>

    <div class="fin-cashflow-table">
      <div class="fin-cashflow-table__header">
        <span>MÊS</span><span>RECEITAS</span><span>DESPESAS</span><span>SALDO</span><span>ACUM.</span>
      </div>
      ${(() => {
        let acum = 0;
        return allData.map((d,i) => {
          acum += d.net;
          const isProj = d.projected;
          return `
            <div class="fin-cashflow-row ${isProj?'fin-cashflow-row--proj':''}">
              <span style="font-family:var(--font-mono);font-size:11px">${d.label}${isProj?' ⟳':''}</span>
              <span style="color:var(--mint)">R$${_fmt(d.income)}</span>
              <span style="color:var(--ember)">R$${_fmt(d.expense)}</span>
              <span style="color:${d.net>=0?'var(--mint)':'var(--ember)'}">${d.net>=0?'+':''}R$${_fmt(d.net)}</span>
              <span style="color:${acum>=0?'var(--plasma)':'var(--ember)'}">R$${_fmt(acum)}</span>
            </div>`;
        }).join('');
      })()}
    </div>`;
}

/* ── TRANSACTIONS ──────────────────────────────────────── */
function _tabTransactions() {
  const all = [...state.finances].sort((a,b) => {
    const da = a.reference_date || (a.created_at||'').split('T')[0] || '';
    const db = b.reference_date || (b.created_at||'').split('T')[0] || '';
    return db.localeCompare(da);
  });

  const groups = {};
  all.forEach(f => {
    const key = f.reference_date || (f.created_at||'').split('T')[0] || 'Sem data';
    (groups[key] = groups[key]||[]).push(f);
  });

  return `
    <div class="fin-tx-toolbar">
      <select class="input select fin-tx-filter" id="ftType" onchange="window._filterFin()" style="width:auto">
        <option value="">Todos os tipos</option>
        <option value="income">Receitas</option>
        <option value="expense">Despesas</option>
      </select>
      <select class="input select fin-tx-filter" id="ftCat" onchange="window._filterFin()" style="width:auto">
        <option value="">Todas categorias</option>
        ${[...INCOME_CATS,...EXPENSE_CATS].map(c=>`<option value="${c}">${c}</option>`).join('')}
      </select>
      <input class="input" id="ftSearch" type="text" placeholder="🔍 Buscar…" style="min-width:160px" oninput="window._filterFin()">
      <span style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);margin-left:auto">${all.length} lançamentos</span>
    </div>
    <div id="finTxList">
      ${Object.entries(groups).map(([date, items]) => {
        const dayTotal = items.reduce((s,f)=>f.type==='income'?s+ +f.amount:s- +f.amount, 0);
        const dtLabel  = date !== 'Sem data'
          ? new Date(date+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'short',day:'numeric',month:'short'}).toUpperCase()
          : 'Sem data';
        return `
          <div class="fin-tx-group">
            <div class="fin-tx-group__header">
              <span>${dtLabel}</span>
              <span style="color:${dayTotal>=0?'var(--mint)':'var(--ember)'};font-family:var(--font-mono);font-size:10px">
                ${dayTotal>=0?'+':''}R$${_fmt(Math.abs(dayTotal))}
              </span>
            </div>
            ${items.map(f => `
              <div class="fin-tx-row" data-type="${f.type}" data-cat="${f.category||''}">
                <div class="fin-tx-row__type fin-tx-row__type--${f.type}">${f.type==='income'?'↑':'↓'}</div>
                <div class="fin-tx-row__body">
                  <div class="fin-tx-row__desc">${_esc(f.description||'—')}</div>
                  <div class="fin-tx-row__meta">
                    <span class="fin-tag fin-tag--${f.type}">${f.category||'Geral'}</span>
                    ${f.recurrence&&f.recurrence!=='Única'?`<span class="fin-tag">↻ ${f.recurrence}</span>`:''}
                    ${f.account?`<span class="fin-tag">🏦 ${f.account}</span>`:''}
                    ${f.cost_center?`<span class="fin-tag">📂 ${f.cost_center}</span>`:''}
                    ${f.note?`<span class="fin-tag" title="${_esc(f.note)}">📝</span>`:''}
                  </div>
                </div>
                <div class="fin-tx-row__amount fin-tx-row__amount--${f.type}">
                  ${f.type==='income'?'+':'-'}R$${_fmt(+f.amount)}
                </div>
                <button class="fin-tx-row__del" onclick="window._delFinance('${f.id}')" title="Remover">✕</button>
              </div>`).join('')}
          </div>`;
      }).join('')||'<div class="empty-state">Nenhum lançamento.</div>'}
    </div>`;
}

/* ── PAYABLES ──────────────────────────────────────────── */
function _tabPayables() {
  const pays = getPayables();
  const todoPay = pays.filter(p=>p.type==='payable'&&p.status!=='paid'&&p.status!=='cancelled');
  const todoRec = pays.filter(p=>p.type==='receivable'&&p.status!=='paid'&&p.status!=='cancelled');
  const totalPay = todoPay.reduce((s,p)=>s+ +p.amount,0);
  const totalRec = todoRec.reduce((s,p)=>s+ +p.amount,0);

  const payRow = (p) => {
    const STATUS_COL = { pending:'var(--gold)', paid:'var(--mint)', overdue:'var(--ember)', cancelled:'var(--text-ghost)' };
    const daysLabel = (() => {
      const diff = Math.round((new Date(p.dueDate+'T12:00:00') - Date.now()) / 86400000);
      if (p.status==='paid') return '✓ Pago';
      if (diff < 0)  return `${Math.abs(diff)}d vencido`;
      if (diff === 0) return 'Vence hoje';
      return `${diff}d restantes`;
    })();
    return `
      <div class="payable-row payable-row--${p.status}">
        <div class="payable-row__type payable-row__type--${p.type}">${p.type==='payable'?'↓':'↑'}</div>
        <div class="payable-row__body">
          <div class="payable-row__desc">${_esc(p.description)}</div>
          <div class="payable-row__meta">
            <span class="fin-tag">${p.category||'—'}</span>
            <span class="fin-tag" style="color:${STATUS_COL[p.status]||'var(--text-muted)'}">
              ${PAY_STATUS[p.status]||p.status}
            </span>
            <span class="fin-tag">${p.recurrence||'Única'}</span>
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div class="payable-row__amount payable-row__amount--${p.type}">R$${_fmt(+p.amount)}</div>
          <div style="font-family:var(--font-mono);font-size:9px;color:${p.status==='overdue'?'var(--ember)':'var(--text-muted)'}">
            📅 ${p.dueDate} · ${daysLabel}
          </div>
        </div>
        <div class="payable-row__actions">
          ${p.status!=='paid'&&p.status!=='cancelled' ? `
            <button class="btn btn--sm btn--primary" onclick="window._markPayable('${p.id}','paid')">✓ ${p.type==='payable'?'PAGAR':'RECEBER'}</button>` : ''}
          <button class="btn btn--sm" onclick="window._editPayable('${p.id}')">✎</button>
          <button class="fin-tx-row__del" onclick="window._deletePayable('${p.id}')">✕</button>
        </div>
      </div>`;
  };

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:16px">
      <div style="display:flex;gap:16px">
        <span style="font-family:var(--font-mono);font-size:11px;color:var(--ember)">
          A PAGAR: R$${_fmt(totalPay)}
        </span>
        <span style="font-family:var(--font-mono);font-size:11px;color:var(--mint)">
          A RECEBER: R$${_fmt(totalRec)}
        </span>
      </div>
      <button class="btn btn--sm btn--primary" onclick="window._newPayable()">+ ADICIONAR</button>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div>
        <div class="fin-section-title" style="color:var(--ember)">↓ CONTAS A PAGAR (${todoPay.length})</div>
        <div style="display:flex;flex-direction:column;gap:4px;margin-top:8px">
          ${todoPay.length ? todoPay.map(payRow).join('') : '<div class="empty-state">Nenhuma conta a pagar.</div>'}
        </div>
      </div>
      <div>
        <div class="fin-section-title" style="color:var(--mint)">↑ CONTAS A RECEBER (${todoRec.length})</div>
        <div style="display:flex;flex-direction:column;gap:4px;margin-top:8px">
          ${todoRec.length ? todoRec.map(payRow).join('') : '<div class="empty-state">Nenhuma conta a receber.</div>'}
        </div>
      </div>
    </div>

    ${pays.filter(p=>p.status==='paid'||p.status==='cancelled').length ? `
    <div style="margin-top:16px">
      <div class="fin-section-title" style="color:var(--text-muted)">HISTÓRICO PAGO / CANCELADO</div>
      <div style="display:flex;flex-direction:column;gap:4px;margin-top:8px">
        ${pays.filter(p=>p.status==='paid'||p.status==='cancelled').map(payRow).join('')}
      </div>
    </div>` : ''}`;
}

/* ── ACCOUNTS ──────────────────────────────────────────── */
function _tabAccounts() {
  const accounts  = state.accounts||[];
  const totalAsset = accounts.filter(a=>a.type!=='credit').reduce((s,a)=>s+ +a.balance,0);
  const totalDebt  = accounts.filter(a=>a.type==='credit').reduce((s,a)=>s+Math.abs(+a.balance),0);
  const netWorth   = totalAsset - totalDebt;
  const TYPE_LABEL = { checking:'CONTA CORRENTE', savings:'POUPANÇA', invest:'INVESTIMENTOS', wallet:'CARTEIRA', credit:'CRÉDITO' };

  return `
    <div class="fin-accounts-grid">
      ${accounts.map(a => `
        <div class="fin-account-card" style="--acc-color:var(--${a.color||'plasma'})">
          <div class="fin-account-card__header">
            <span class="fin-account-card__icon">${a.icon||'💳'}</span>
            <div style="flex:1;min-width:0">
              <div class="fin-account-card__name">${_esc(a.name)}</div>
              <div class="fin-account-card__type">${TYPE_LABEL[a.type]||a.type||''} · ${_esc(a.bank||'')}</div>
              ${a.agency ? `<div style="font-family:var(--font-mono);font-size:8px;color:var(--text-ghost)">Ag ${a.agency} · Cc ${a.account||'—'}</div>` : ''}
            </div>
          </div>
          <div class="fin-account-card__balance">R$<span>${_fmt(+a.balance)}</span></div>
          ${a.type==='credit'&&a.limit ? `
            <div style="margin-top:4px">
              <div class="progress" style="height:5px">
                <div class="progress__fill" style="width:${Math.min(100,Math.abs(+a.balance)/+a.limit*100)}%;background:${Math.abs(+a.balance)/+a.limit>0.7?'var(--ember)':'var(--plasma)'}"></div>
              </div>
              <div style="font-family:var(--font-mono);font-size:9px;color:var(--text-muted);margin-top:3px">
                R$${_fmt(Math.abs(+a.balance))} / limite R$${_fmt(+a.limit)}
              </div>
            </div>` : ''}
          <div class="fin-account-card__actions">
            <button class="btn btn--sm" onclick="window._editAccount('${a.id}')">✎ EDITAR</button>
            <button class="btn btn--sm" onclick="window._adjustBalance('${a.id}')">± SALDO</button>
          </div>
        </div>`).join('')}
      <button class="fin-account-card fin-account-card--add" onclick="window._newAccount()">
        <span style="font-size:28px">+</span>
        <span style="font-family:var(--font-mono);font-size:9px;letter-spacing:2px">NOVA CONTA</span>
      </button>
    </div>

    <!-- Patrimônio líquido -->
    <div class="fin-networth-bar">
      <div class="fin-networth-item">
        <span class="fin-networth-label">ATIVOS TOTAIS</span>
        <span class="fin-networth-val" style="color:var(--mint)">R$${_fmt(totalAsset)}</span>
      </div>
      <div class="fin-networth-item">
        <span class="fin-networth-label">PASSIVOS</span>
        <span class="fin-networth-val" style="color:var(--ember)">R$${_fmt(totalDebt)}</span>
      </div>
      <div class="fin-networth-item">
        <span class="fin-networth-label">PATRIMÔNIO LÍQUIDO</span>
        <span class="fin-networth-val" style="color:var(--gold);font-size:22px">R$${_fmt(netWorth)}</span>
      </div>
    </div>`;
}

/* ── BUDGET ────────────────────────────────────────────── */
function _tabBudget(year, month) {
  const budgets   = getBudgetStatus(year, month);
  const totLimit  = budgets.reduce((s,b)=>s+b.limit,0);
  const totSpent  = budgets.reduce((s,b)=>s+b.spent,0);
  const MNAMES    = ['','Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:16px">
      <div>
        <div style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted)">${MNAMES[month]}/${year}</div>
        <div style="font-family:var(--font-mono);font-size:12px">
          Gasto: <span style="color:var(--ember)">R$${_fmt(totSpent)}</span>
          / Limite: <span style="color:var(--plasma)">R$${_fmt(totLimit)}</span>
          · Restante: <span style="color:${totLimit-totSpent>=0?'var(--mint)':'var(--ember)'}">R$${_fmt(Math.abs(totLimit-totSpent))}</span>
        </div>
      </div>
      <button class="btn btn--sm btn--primary" onclick="window._newBudget()">+ CATEGORIA</button>
    </div>

    <!-- Budget utilization bar -->
    <div class="fin-budget-overview" style="margin-bottom:16px">
      <canvas id="finBudgetChart" style="width:100%;height:24px;display:block"></canvas>
    </div>

    <div class="fin-budget-grid">
      ${budgets.map(b => {
        const COLS={plasma:'var(--plasma)',gold:'var(--gold)',mint:'var(--mint)',ember:'var(--ember)'};
        const col = b.over ? 'var(--ember)' : (COLS[b.color]||'var(--plasma)');
        return `
          <div class="fin-budget-card ${b.over?'fin-budget-card--over':''}">
            <div class="fin-budget-card__header">
              <span class="fin-budget-card__cat">${b.category}</span>
              ${b.over ? '<span class="fin-budget-over-badge">EXCEDIDO</span>' : ''}
              <button class="fin-tx-row__del" onclick="window._editBudget('${b.id}')">✎</button>
            </div>
            <div class="fin-budget-card__vals">
              <span style="font-family:var(--font-mono);font-size:16px;font-weight:700;color:${col}">R$${_fmt(b.spent)}</span>
              <span style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted)">/ R$${_fmt(b.limit)}</span>
            </div>
            <div class="progress" style="margin:8px 0;height:8px">
              <div class="progress__fill" style="width:${b.pct}%;background:${col};transition:width 0.6s var(--t-spring)"></div>
            </div>
            <div style="font-family:var(--font-mono);font-size:9px;color:${b.over?'var(--ember)':'var(--text-muted)'}">
              ${b.pct.toFixed(0)}% · ${b.over
                ? 'Excedido R$'+_fmt(b.spent-b.limit)
                : 'Disponível R$'+_fmt(b.limit-b.spent)}
            </div>
          </div>`;
      }).join('')}
    </div>`;
}

/* ── SAVINGS ───────────────────────────────────────────── */
function _tabSavings() {
  const sgs  = (state.savings||[]).map(s=>({
    ...s,
    pct:       Math.min(100, Math.round(s.current/s.target*100)),
    remaining: s.target - s.current,
  }));
  const totalSaved  = sgs.reduce((s,g)=>s+ +g.current,0);
  const totalTarget = sgs.reduce((s,g)=>s+ +g.target,0);
  const COLS        = { mint:'var(--mint)', plasma:'var(--plasma)', gold:'var(--gold)', ember:'var(--ember)' };

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:16px">
      <div>
        <div style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted)">TOTAL ECONOMIZADO</div>
        <div style="font-family:var(--font-display);font-size:24px;color:var(--gold)">
          R$${_fmt(totalSaved)} <span style="font-size:14px;color:var(--text-muted)">/ R$${_fmt(totalTarget)}</span>
        </div>
      </div>
      <button class="btn btn--sm btn--primary" onclick="window._newSavings()">+ META</button>
    </div>

    <div class="fin-savings-grid">
      ${sgs.map(s => {
        const col = COLS[s.color]||'var(--plasma)';
        const daysLeft = s.deadline ? Math.max(0, Math.round((new Date(s.deadline+'T12:00:00') - Date.now()) / 86400000)) : null;
        const mthNeeded = daysLeft&&daysLeft>0 ? (s.remaining/(daysLeft/30)) : null;
        return `
          <div class="fin-savings-card">
            <div class="fin-savings-card__header">
              <span class="fin-savings-card__icon">${s.icon||'💰'}</span>
              <div style="flex:1;min-width:0">
                <div class="fin-savings-card__name">${_esc(s.name)}</div>
                ${s.deadline ? `<div style="font-family:var(--font-mono);font-size:9px;color:var(--text-muted)">${s.deadline}${daysLeft!==null?` · ${daysLeft}d restantes`:''}</div>` : ''}
              </div>
              <div class="fin-savings-card__pct" style="color:${col}">${s.pct}%</div>
            </div>
            <div class="progress" style="height:10px;margin:10px 0">
              <div class="progress__fill" style="width:${s.pct}%;background:${col};box-shadow:0 0 8px ${col}88;transition:width 0.8s var(--t-spring)"></div>
            </div>
            <div style="display:flex;justify-content:space-between;font-family:var(--font-mono);font-size:10px">
              <span style="color:${col}">R$${_fmt(+s.current)}</span>
              <span style="color:var(--text-muted)">R$${_fmt(+s.target)}</span>
            </div>
            ${mthNeeded ? `
              <div style="font-family:var(--font-mono);font-size:9px;color:var(--text-muted);margin-top:6px">
                ≈ R$${_fmt(mthNeeded)}/mês para atingir a meta
              </div>` : ''}
            ${s.pct >= 100 ? `<div style="font-family:var(--font-mono);font-size:10px;color:var(--mint);margin-top:6px">🏆 META ATINGIDA!</div>` : ''}
            <div class="fin-savings-card__actions">
              <button class="btn btn--sm btn--primary" onclick="window._addToSavings('${s.id}')">+ APORTAR</button>
              <button class="btn btn--sm" onclick="window._editSavings('${s.id}')">✎ EDITAR</button>
            </div>
          </div>`;
      }).join('')}
    </div>`;
}

/* ══════════════════════════════════════════════════════════
   CHARTS
   ══════════════════════════════════════════════════════════ */
function _drawCharts(year, month) {
  _drawTrend();
  _drawProj();
  _drawCash();
  _drawBudgetBar(year, month);
}

function _getTheme() {
  const dark = document.documentElement.getAttribute('data-theme') !== 'light';
  return {
    mint:   dark ? '#00d97e' : '#059669',
    ember:  dark ? '#ff4d1a' : '#dc2626',
    plasma: dark ? '#00d4ff' : '#2563eb',
    gold:   dark ? '#f5c842' : '#b45309',
    muted:  dark ? '#4a6a7a' : '#78716c',
    border: dark ? '#152030' : '#ddd6c8',
  };
}

function _drawTrend() {
  const c = document.getElementById('finTrendChart');
  if (!c) return;
  const ctx = c.getContext('2d');
  const W = c.width = c.offsetWidth||600, H = c.height=160;
  const T = _getTheme();
  const data = getTrend(6);
  _drawLineChart(ctx, W, H, T, data, [
    { key:'income',  color:T.mint,   fill:true },
    { key:'expense', color:T.ember,  fill:false },
    { key:'net',     color:T.plasma, fill:false },
  ]);
}

function _drawProj() {
  const c = document.getElementById('finProjChart');
  if (!c) return;
  const ctx = c.getContext('2d');
  const W = c.width = c.offsetWidth||300, H = c.height=120;
  const T = _getTheme();
  const data = getProjection(3);
  _drawBarChart(ctx, W, H, T, data);
}

function _drawCash() {
  const c = document.getElementById('finCashChart');
  if (!c) return;
  const ctx = c.getContext('2d');
  const W = c.width = c.offsetWidth||600, H = c.height=200;
  const T = _getTheme();
  const hist = getTrend(6);
  const proj = getProjection(3).map(p=>({...p,projected:true}));
  const data = [...hist, ...proj];
  _drawLineChart(ctx, W, H, T, data, [
    { key:'income',  color:T.mint,   fill:true },
    { key:'expense', color:T.ember,  fill:false },
    { key:'net',     color:T.plasma, fill:false },
  ]);
}

function _drawBudgetBar(year, month) {
  const c = document.getElementById('finBudgetChart');
  if (!c) return;
  const ctx = c.getContext('2d');
  const W = c.width = c.offsetWidth||600, H = c.height=24;
  const budgets = getBudgetStatus(year, month);
  const totLimit = budgets.reduce((s,b)=>s+b.limit,1);
  const T = _getTheme();
  const COLS = { plasma:T.plasma, gold:T.gold, mint:T.mint, ember:T.ember };

  ctx.clearRect(0,0,W,H);
  let x = 0;
  budgets.forEach(b => {
    const bw = (b.limit/totLimit)*W;
    const col = b.over ? T.ember : (COLS[b.color]||T.plasma);
    ctx.fillStyle = col+'33';
    ctx.fillRect(x, 0, bw-2, H);
    const spentW = Math.min(bw-2, (b.spent/b.limit)*(bw-2));
    ctx.fillStyle = col;
    ctx.fillRect(x, 0, spentW, H);
    if (bw > 40) {
      ctx.fillStyle = '#fff'; ctx.font = '8px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(b.category.slice(0,6), x+bw/2, 15);
    }
    x += bw;
  });
}

function _drawLineChart(ctx, W, H, T, data, series) {
  ctx.clearRect(0,0,W,H);
  if (!data.length) return;
  const pad = { top:16, right:16, bottom:28, left:52 };
  const cW = W-pad.left-pad.right, cH = H-pad.top-pad.bottom;

  const allVals = data.flatMap(d => series.map(s => Math.abs(d[s.key]||0)));
  const maxVal  = Math.max(...allVals, 1) * 1.1;

  // Grid
  ctx.strokeStyle = T.border+'66'; ctx.lineWidth=1;
  for (let i=0;i<=3;i++) {
    const y = pad.top+(cH/3)*i;
    ctx.beginPath(); ctx.moveTo(pad.left,y); ctx.lineTo(pad.left+cW,y); ctx.stroke();
    ctx.fillStyle=T.muted; ctx.font='8px JetBrains Mono,monospace'; ctx.textAlign='right';
    ctx.fillText('R$'+Math.round(maxVal*(1-i/3)).toLocaleString('pt-BR'), pad.left-4, y+3);
  }

  const xs = data.map((_,i) => pad.left+(cW/(Math.max(data.length-1,1)))*i);

  series.forEach(s => {
    const pts = data.map((d,i) => ({
      x: xs[i],
      y: pad.top+cH-(Math.abs(d[s.key]||0)/maxVal)*cH,
    }));

    if (s.fill) {
      const grad = ctx.createLinearGradient(0,pad.top,0,pad.top+cH);
      grad.addColorStop(0, s.color+'33'); grad.addColorStop(1, s.color+'00');
      ctx.beginPath(); ctx.moveTo(pts[0].x, pad.top+cH);
      pts.forEach(p=>ctx.lineTo(p.x,p.y));
      ctx.lineTo(pts.at(-1).x, pad.top+cH); ctx.closePath();
      ctx.fillStyle=grad; ctx.fill();
    }

    ctx.beginPath(); pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
    ctx.strokeStyle=s.color; ctx.lineWidth=2; ctx.shadowColor=s.color; ctx.shadowBlur=4; ctx.stroke();
    ctx.shadowBlur=0;
    pts.forEach(p=>{ ctx.beginPath(); ctx.arc(p.x,p.y,3,0,Math.PI*2); ctx.fillStyle=s.color; ctx.shadowColor=s.color; ctx.shadowBlur=6; ctx.fill(); ctx.shadowBlur=0; });
  });

  data.forEach((d,i)=>{
    ctx.fillStyle=T.muted; ctx.font='8px JetBrains Mono,monospace'; ctx.textAlign='center';
    ctx.fillText(d.label+(d.projected?'*':''), xs[i], H-6);
  });
}

function _drawBarChart(ctx, W, H, T, data) {
  ctx.clearRect(0,0,W,H);
  if (!data.length) return;
  const pad = { top:8, right:8, bottom:28, left:52 };
  const cW = W-pad.left-pad.right, cH = H-pad.top-pad.bottom;
  const maxVal = Math.max(...data.flatMap(d=>[d.income,d.expense]),1)*1.1;
  const bw     = cW/data.length*0.35;

  data.forEach((d,i) => {
    const x = pad.left + (cW/data.length)*i + cW/data.length*0.15;
    const hInc  = (d.income/maxVal)*cH;
    const hExp  = (d.expense/maxVal)*cH;
    ctx.fillStyle = T.mint+'88'; ctx.fillRect(x, pad.top+cH-hInc, bw, hInc);
    ctx.fillStyle = T.ember+'88'; ctx.fillRect(x+bw+2, pad.top+cH-hExp, bw, hExp);
    ctx.fillStyle=T.muted; ctx.font='8px JetBrains Mono,monospace'; ctx.textAlign='center';
    ctx.fillText(d.label, x+bw, H-6);
  });
}

/* ══════════════════════════════════════════════════════════
   MODALS
   ══════════════════════════════════════════════════════════ */
let _finType = 'expense';

export function openFinModal(pre={}) {
  const m = document.getElementById('finModal');
  if (!m) return;
  const accOpts = (state.accounts||[]).map(a=>`<option value="${a.name}" ${pre.account===a.name?'selected':''}>${a.icon||''} ${a.name}</option>`).join('');
  const ccOpts  = (state.costcenters||[]).map(c=>`<option value="${c.name}" ${pre.cost_center===c.name?'selected':''}>[${c.code}] ${c.name}</option>`).join('');

  m.innerHTML = `
    <div class="modal-box">
      <div class="modal-header">
        <h2 class="modal-title">NOVO LANÇAMENTO</h2>
        <button class="modal-close" onclick="window._closeFinModal()">✕</button>
      </div>

      <div class="fin-modal-type-toggle">
        <button id="fmtIncome"  class="fin-type-btn fin-type-btn--income  ${pre.type!=='expense'?'active':''}"  onclick="window._setFinType('income')">↑ RECEITA</button>
        <button id="fmtExpense" class="fin-type-btn fin-type-btn--expense ${pre.type==='expense'?'active':''}" onclick="window._setFinType('expense')">↓ DESPESA</button>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-3);margin-top:var(--sp-4)">
        <div class="form-group" style="grid-column:1/-1">
          <label class="field-label">Descrição *</label>
          <input class="input" id="fm-desc" type="text" placeholder="Ex: Salário, Supermercado…" value="${pre.description||''}">
        </div>
        <div class="form-group">
          <label class="field-label">Valor (R$) *</label>
          <input class="input" id="fm-amount" type="number" step="0.01" min="0" placeholder="0,00" value="${pre.amount||''}">
        </div>
        <div class="form-group">
          <label class="field-label">Data</label>
          <input class="input" id="fm-date" type="date" value="${pre.reference_date||TODAY()}">
        </div>
        <div class="form-group">
          <label class="field-label">Categoria</label>
          <select class="input select" id="fm-cat">
            <option value="">Selecionar…</option>
            <optgroup label="Receitas">${INCOME_CATS.map(c=>`<option value="${c}" ${pre.category===c?'selected':''}>${c}</option>`).join('')}</optgroup>
            <optgroup label="Despesas">${EXPENSE_CATS.map(c=>`<option value="${c}" ${pre.category===c?'selected':''}>${c}</option>`).join('')}</optgroup>
          </select>
        </div>
        <div class="form-group">
          <label class="field-label">Conta</label>
          <select class="input select" id="fm-account">
            <option value="">Nenhuma</option>${accOpts}
          </select>
        </div>
        <div class="form-group">
          <label class="field-label">Centro de Custo</label>
          <select class="input select" id="fm-cc">
            <option value="">Nenhum</option>${ccOpts}
          </select>
        </div>
        <div class="form-group">
          <label class="field-label">Recorrência</label>
          <select class="input select" id="fm-rec">
            ${RECURRENCE.map(r=>`<option value="${r}" ${pre.recurrence===r?'selected':''}>${r}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label class="field-label">Observação</label>
          <input class="input" id="fm-note" type="text" placeholder="Opcional…" value="${pre.note||''}">
        </div>
      </div>

      <div style="display:flex;gap:var(--sp-3);margin-top:var(--sp-5)">
        <button class="btn btn--primary" style="flex:1" onclick="window._saveFinEntry()">✓ SALVAR</button>
        <button class="btn" onclick="window._closeFinModal()">CANCELAR</button>
      </div>
    </div>`;
  m.style.display = 'flex';
  _finType = pre.type||'expense';
  document.getElementById('fm-desc')?.focus();
}

window._setFinType = t => {
  _finType = t;
  document.getElementById('fmtIncome')?.classList.toggle('active',  t==='income');
  document.getElementById('fmtExpense')?.classList.toggle('active', t==='expense');
};
window._openFinModal   = ()  => { _finType='expense'; openFinModal(); };
window._closeFinModal  = ()  => { const m=document.getElementById('finModal'); if(m) m.style.display='none'; };
window._saveFinEntry   = async () => {
  const desc   = document.getElementById('fm-desc')?.value.trim();
  const amount = parseFloat(document.getElementById('fm-amount')?.value);
  if (!desc)                    { showToast('Preencha a descrição.','error');  return; }
  if (isNaN(amount)||amount<=0) { showToast('Valor inválido.','error');        return; }
  await addFinanceEntry({
    description:    desc,
    amount,
    type:           _finType,
    category:       document.getElementById('fm-cat')?.value     || 'Geral',
    reference_date: document.getElementById('fm-date')?.value    || TODAY(),
    account:        document.getElementById('fm-account')?.value || null,
    cost_center:    document.getElementById('fm-cc')?.value      || null,
    recurrence:     document.getElementById('fm-rec')?.value     || 'Única',
    note:           document.getElementById('fm-note')?.value.trim() || null,
  });
  window._closeFinModal();
};
window._delFinance  = async id => { if (confirm('Remover?')) await removeFinanceEntry(id); };
window._finTab      = tab => { _activeTab=tab; renderFinances(); };
window._filterFin   = () => {
  const type   = document.getElementById('ftType')?.value||'';
  const cat    = document.getElementById('ftCat')?.value||'';
  const search = (document.getElementById('ftSearch')?.value||'').toLowerCase();
  document.querySelectorAll('#finTxList .fin-tx-row').forEach(row => {
    const show = (!type||row.dataset.type===type) && (!cat||row.dataset.cat===cat) && (!search||row.textContent.toLowerCase().includes(search));
    row.style.display = show?'':'none';
  });
};

/* Account modal */
window._editAccount    = id => _openAccModal(state.accounts.find(a=>a.id===id));
window._newAccount     = ()  => _openAccModal(null);
window._adjustBalance  = id => {
  const acc = state.accounts.find(a=>a.id===id);
  if (!acc) return;
  const val = parseFloat(prompt(`Novo saldo para "${acc.name}" (R$):`, acc.balance));
  if (!isNaN(val)) { updateAccountBalance(id, val); showToast('Saldo atualizado!','success'); }
};
function _openAccModal(a) {
  const m = document.getElementById('finModal'); if (!m) return;
  m.innerHTML=`
    <div class="modal-box">
      <div class="modal-header"><h2 class="modal-title">${a?'EDITAR':'NOVA'} CONTA</h2><button class="modal-close" onclick="window._closeFinModal()">✕</button></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-3);margin-top:var(--sp-4)">
        <div class="form-group"><label class="field-label">Nome *</label><input class="input" id="acc-name" value="${_esc(a?.name||'')}"></div>
        <div class="form-group"><label class="field-label">Banco</label><input class="input" id="acc-bank" value="${_esc(a?.bank||'')}"></div>
        <div class="form-group"><label class="field-label">Tipo</label>
          <select class="input select" id="acc-type">
            ${['checking','savings','invest','wallet','credit'].map(t=>`<option value="${t}" ${a?.type===t?'selected':''}>${t.toUpperCase()}</option>`).join('')}
          </select></div>
        <div class="form-group"><label class="field-label">Saldo (R$)</label><input class="input" id="acc-balance" type="number" step="0.01" value="${a?.balance||0}"></div>
        <div class="form-group"><label class="field-label">Agência</label><input class="input" id="acc-agency" value="${_esc(a?.agency||'')}"></div>
        <div class="form-group"><label class="field-label">Conta</label><input class="input" id="acc-account" value="${_esc(a?.account||'')}"></div>
        <div class="form-group"><label class="field-label">Limite (crédito)</label><input class="input" id="acc-limit" type="number" value="${a?.limit||''}"></div>
        <div class="form-group"><label class="field-label">Ícone + Cor</label>
          <div style="display:flex;gap:8px">
            <input class="input" id="acc-icon" value="${a?.icon||'💳'}" style="width:60px">
            <select class="input select" id="acc-color">${['plasma','gold','mint','ember'].map(c=>`<option value="${c}" ${a?.color===c?'selected':''}>${c.toUpperCase()}</option>`).join('')}</select>
          </div></div>
      </div>
      <div style="display:flex;gap:var(--sp-3);margin-top:var(--sp-5)">
        <button class="btn btn--primary" style="flex:1" onclick="window._saveAccount('${a?.id||''}')">✓ SALVAR</button>
        <button class="btn" onclick="window._closeFinModal()">CANCELAR</button>
      </div>
    </div>`;
  m.style.display='flex';
}
window._saveAccount = id => {
  const acc = { id:id||null, name:document.getElementById('acc-name')?.value.trim(), bank:document.getElementById('acc-bank')?.value.trim(), type:document.getElementById('acc-type')?.value, balance:parseFloat(document.getElementById('acc-balance')?.value)||0, agency:document.getElementById('acc-agency')?.value.trim(), account:document.getElementById('acc-account')?.value.trim(), limit:parseFloat(document.getElementById('acc-limit')?.value)||null, icon:document.getElementById('acc-icon')?.value||'💳', color:document.getElementById('acc-color')?.value||'plasma' };
  if (!acc.name) { showToast('Nome obrigatório.','error'); return; }
  saveAccount(acc); window._closeFinModal(); showToast('Conta salva!','success');
};

/* Budget modal */
window._newBudget  = () => _openBudgetModal(null);
window._editBudget = id => _openBudgetModal(state.budgets.find(b=>b.id===id));
function _openBudgetModal(b) {
  const m = document.getElementById('finModal'); if (!m) return;
  m.innerHTML=`
    <div class="modal-box">
      <div class="modal-header"><h2 class="modal-title">${b?'EDITAR':'NOVO'} ORÇAMENTO</h2><button class="modal-close" onclick="window._closeFinModal()">✕</button></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-3);margin-top:var(--sp-4)">
        <div class="form-group"><label class="field-label">Categoria *</label>
          <select class="input select" id="bgt-cat">${EXPENSE_CATS.map(c=>`<option value="${c}" ${b?.category===c?'selected':''}>${c}</option>`).join('')}</select></div>
        <div class="form-group"><label class="field-label">Limite Mensal (R$) *</label><input class="input" id="bgt-limit" type="number" step="0.01" value="${b?.limit||''}"></div>
        <div class="form-group"><label class="field-label">Cor</label>
          <select class="input select" id="bgt-color">${['plasma','gold','mint','ember'].map(c=>`<option value="${c}" ${b?.color===c?'selected':''}>${c.toUpperCase()}</option>`).join('')}</select></div>
      </div>
      <div style="display:flex;gap:var(--sp-3);margin-top:var(--sp-5)">
        <button class="btn btn--primary" style="flex:1" onclick="window._saveBudgetEntry('${b?.id||''}')">✓ SALVAR</button>
        <button class="btn" onclick="window._closeFinModal()">CANCELAR</button>
      </div>
    </div>`;
  m.style.display='flex';
}
window._saveBudgetEntry = id => {
  const b = { id:id||null, category:document.getElementById('bgt-cat')?.value, limit:parseFloat(document.getElementById('bgt-limit')?.value)||0, color:document.getElementById('bgt-color')?.value||'plasma' };
  if (!b.category||b.limit<=0) { showToast('Categoria e limite obrigatórios.','error'); return; }
  saveBudget(b); window._closeFinModal(); showToast('Orçamento salvo!','success');
};

/* Savings modal */
window._newSavings  = () => _openSavingsModal(null);
window._editSavings = id => _openSavingsModal((state.savings||[]).find(s=>s.id===id));
window._addToSavings = id => { const v=parseFloat(prompt('Valor a aportar (R$):')); if (!isNaN(v)&&v>0) addToSavings(id,v); };
function _openSavingsModal(s) {
  const m = document.getElementById('finModal'); if (!m) return;
  m.innerHTML=`
    <div class="modal-box">
      <div class="modal-header"><h2 class="modal-title">${s?'EDITAR':'NOVA'} META</h2><button class="modal-close" onclick="window._closeFinModal()">✕</button></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-3);margin-top:var(--sp-4)">
        <div class="form-group" style="grid-column:1/-1"><label class="field-label">Nome *</label><input class="input" id="sv-name" value="${_esc(s?.name||'')}"></div>
        <div class="form-group"><label class="field-label">Meta (R$) *</label><input class="input" id="sv-target" type="number" step="0.01" value="${s?.target||''}"></div>
        <div class="form-group"><label class="field-label">Atual (R$)</label><input class="input" id="sv-current" type="number" step="0.01" value="${s?.current||0}"></div>
        <div class="form-group"><label class="field-label">Prazo</label><input class="input" id="sv-deadline" type="date" value="${s?.deadline||''}"></div>
        <div class="form-group"><label class="field-label">Ícone + Cor</label>
          <div style="display:flex;gap:8px">
            <input class="input" id="sv-icon" value="${s?.icon||'💰'}" style="width:60px">
            <select class="input select" id="sv-color">${['mint','plasma','gold','ember'].map(c=>`<option value="${c}" ${s?.color===c?'selected':''}>${c.toUpperCase()}</option>`).join('')}</select>
          </div></div>
      </div>
      <div style="display:flex;gap:var(--sp-3);margin-top:var(--sp-5)">
        <button class="btn btn--primary" style="flex:1" onclick="window._saveSavingsEntry('${s?.id||''}')">✓ SALVAR</button>
        <button class="btn" onclick="window._closeFinModal()">CANCELAR</button>
      </div>
    </div>`;
  m.style.display='flex';
}
window._saveSavingsEntry = id => {
  const sg = { id:id||null, name:document.getElementById('sv-name')?.value.trim(), target:parseFloat(document.getElementById('sv-target')?.value)||0, current:parseFloat(document.getElementById('sv-current')?.value)||0, deadline:document.getElementById('sv-deadline')?.value||null, icon:document.getElementById('sv-icon')?.value||'💰', color:document.getElementById('sv-color')?.value||'mint' };
  if (!sg.name||sg.target<=0) { showToast('Nome e meta obrigatórios.','error'); return; }
  saveSavings(sg); window._closeFinModal(); showToast('Meta salva!','success');
};

/* Payables modal */
window._newPayable  = () => _openPayModal(null);
window._editPayable = id => _openPayModal((state.payables||[]).find(p=>p.id===id));
window._markPayable = (id,status) => markPayable(id,status);
window._deletePayable = id => { if (confirm('Remover?')) deletePayable(id); };
function _openPayModal(p) {
  const m = document.getElementById('finModal'); if (!m) return;
  m.innerHTML=`
    <div class="modal-box">
      <div class="modal-header"><h2 class="modal-title">${p?'EDITAR':'NOVA'} CONTA</h2><button class="modal-close" onclick="window._closeFinModal()">✕</button></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-3);margin-top:var(--sp-4)">
        <div class="form-group" style="grid-column:1/-1"><label class="field-label">Descrição *</label><input class="input" id="pay-desc" value="${_esc(p?.description||'')}"></div>
        <div class="form-group"><label class="field-label">Tipo</label>
          <select class="input select" id="pay-type">
            <option value="payable"   ${p?.type==='payable'  ?'selected':''}>↓ A PAGAR</option>
            <option value="receivable"${p?.type==='receivable'?'selected':''}>↑ A RECEBER</option>
          </select></div>
        <div class="form-group"><label class="field-label">Valor (R$) *</label><input class="input" id="pay-amount" type="number" step="0.01" value="${p?.amount||''}"></div>
        <div class="form-group"><label class="field-label">Vencimento *</label><input class="input" id="pay-due" type="date" value="${p?.dueDate||TODAY()}"></div>
        <div class="form-group"><label class="field-label">Categoria</label>
          <select class="input select" id="pay-cat">
            ${[...INCOME_CATS,...EXPENSE_CATS].map(c=>`<option value="${c}" ${p?.category===c?'selected':''}>${c}</option>`).join('')}
          </select></div>
        <div class="form-group"><label class="field-label">Recorrência</label>
          <select class="input select" id="pay-rec">${RECURRENCE.map(r=>`<option value="${r}" ${p?.recurrence===r?'selected':''}>${r}</option>`).join('')}</select></div>
      </div>
      <div style="display:flex;gap:var(--sp-3);margin-top:var(--sp-5)">
        <button class="btn btn--primary" style="flex:1" onclick="window._savePayable('${p?.id||''}')">✓ SALVAR</button>
        <button class="btn" onclick="window._closeFinModal()">CANCELAR</button>
      </div>
    </div>`;
  m.style.display='flex';
}
window._savePayable = id => {
  const p = { id:id||null, description:document.getElementById('pay-desc')?.value.trim(), type:document.getElementById('pay-type')?.value, amount:parseFloat(document.getElementById('pay-amount')?.value)||0, dueDate:document.getElementById('pay-due')?.value||TODAY(), category:document.getElementById('pay-cat')?.value||'Outros', recurrence:document.getElementById('pay-rec')?.value||'Única', status:'pending' };
  if (!p.description||p.amount<=0) { showToast('Preencha os campos obrigatórios.','error'); return; }
  savePayable(p); window._closeFinModal(); showToast('Conta salva!','success');
};

/* ══════════════════════════════════════════════════════════
   EXPORT REPORT
   ══════════════════════════════════════════════════════════ */
window._exportFinanceReport = () => {
  const { year, month } = getCurrent();
  const MNAMES=['','Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const sum   = getMonthSummary(year, month);
  const dre   = getDRE(year, month);
  const pays  = getPayables();
  const trend = getTrend(6);
  const txs   = getTxMonth(year, month);
  const byCat = getExpByCat(year, month);

  const lines = [
    `╔══════════════════════════════════════════════════════════╗`,
    `║   LIFE CONTROL — RELATÓRIO FINANCEIRO COMPLETO          ║`,
    `╚══════════════════════════════════════════════════════════╝`,
    `Emitido em: ${new Date().toLocaleString('pt-BR')}`,
    `Período:    ${MNAMES[month]}/${year}`,
    ``,
    `┌─ RESUMO EXECUTIVO ──────────────────────────────────────`,
    `│  Receitas:           R$${_fmt(sum.income).padStart(12)}`,
    `│  Despesas:           R$${_fmt(sum.expense).padStart(12)}`,
    `│  Resultado:          R$${_fmt(sum.net).padStart(12)}`,
    `│  Taxa de Poupança:   ${sum.savingsRate.toFixed(1)}%`,
    `│  Patrimônio Total:   R$${_fmt(getPatrimony()).padStart(12)}`,
    ``,
    `┌─ DRE — RECEITAS POR CATEGORIA ──────────────────────────`,
    ...dre.income.map(c=>`│  ${c.category.padEnd(24)} R$${_fmt(c.amount).padStart(12)}`),
    `│  ${'TOTAL RECEITAS'.padEnd(24)} R$${_fmt(dre.totInc).padStart(12)}`,
    ``,
    `┌─ DRE — DESPESAS POR CATEGORIA ──────────────────────────`,
    ...dre.costs.map(c=>`│  ${c.category.padEnd(24)} R$${_fmt(c.amount).padStart(12)}`),
    `│  ${'TOTAL DESPESAS'.padEnd(24)} R$${_fmt(dre.totExp).padStart(12)}`,
    `│  ${'RESULTADO'.padEnd(24)} R$${_fmt(dre.net).padStart(12)}`,
    ``,
    `┌─ FLUXO DE CAIXA — 6 MESES ──────────────────────────────`,
    `│  ${'MÊS'.padEnd(8)} ${'RECEITAS'.padStart(12)} ${'DESPESAS'.padStart(12)} ${'SALDO'.padStart(12)}`,
    `│  ${'─'.repeat(48)}`,
    ...trend.map(t=>`│  ${t.label.padEnd(8)} R$${_fmt(t.income).padStart(10)} R$${_fmt(t.expense).padStart(10)} R$${_fmt(t.net).padStart(10)}`),
    ``,
    `┌─ CONTAS A PAGAR/RECEBER ─────────────────────────────────`,
    ...pays.filter(p=>p.status!=='paid'&&p.status!=='cancelled').map(p=>`│  [${p.type==='payable'?'PAGAR  ':'RECEBER'}] ${p.description.padEnd(20)} R$${_fmt(+p.amount).padStart(10)} Vto:${p.dueDate}`),
    ``,
    `┌─ CONTAS ────────────────────────────────────────────────`,
    ...(state.accounts||[]).map(a=>`│  ${a.icon||'  '} ${a.name.padEnd(22)} R$${_fmt(+a.balance).padStart(12)} ${a.bank||''}`),
    ``,
    `┌─ LANÇAMENTOS DO MÊS (${txs.length} itens) ───────────────────────────`,
    `│  ${'DATA'.padEnd(12)} ${'TIPO'.padEnd(8)} ${'CATEGORIA'.padEnd(20)} ${'VALOR'.padStart(12)}  DESCRIÇÃO`,
    `│  ${'─'.repeat(70)}`,
    ...txs.map(f=>`│  ${(f.reference_date||'').slice(0,10).padEnd(12)} ${(f.type.toUpperCase()).padEnd(8)} ${(f.category||'—').padEnd(20)} ${((f.type==='income'?'+':'-')+'R$'+_fmt(+f.amount)).padStart(12)}  ${f.description||''}`),
  ];

  const blob = new Blob([lines.join('\n')], { type:'text/plain;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `relatorio-${year}-${String(month).padStart(2,'0')}.txt`;
  a.click(); URL.revokeObjectURL(url);
  showToast('✓ Relatório exportado!', 'success');
};

/* ── Also expose trend chart for external use ─────────── */
export function renderFinanceTrend() { _drawTrend(); }

/* ══════════════════════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════════════════════ */
function _fmt(n)  { return (+n||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function _esc(s)  { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
