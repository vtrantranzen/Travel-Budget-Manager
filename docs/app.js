'use strict';
/* ============================================================
   TRIP BUDGET PLANNER — app.js
   Modules: Constants · Utils · Storage · TripManager ·
            BudgetManager · TransactionManager · Dashboard ·
            Charts · UI · Router · Screens · App · Init
   ============================================================ */

// ============================================================
// CONSTANTS
// ============================================================
/* ============================================================
   V1.1 — Transport type icon map (used by Itinerary)
   ============================================================ */
const TRANSPORT_ICONS = {
  'Bus':              '🚌',
  'Rail / Train':     '🚂',
  'Private Car':      '🚗',
  'Ferries / Boat':   '⛴️',
  'Shuttle / Transfer':'🚐',
  'Domestic Flight':  '🛫',
  'Other':            '🚘',
};

const CURRENCIES = [
  { code:'USD', sym:'$',    name:'US Dollar' },
  { code:'EUR', sym:'€',    name:'Euro' },
  { code:'GBP', sym:'£',    name:'British Pound' },
  { code:'CAD', sym:'CA$',  name:'Canadian Dollar' },
  { code:'AUD', sym:'A$',   name:'Australian Dollar' },
  { code:'NZD', sym:'NZ$',  name:'New Zealand Dollar' },
  { code:'JPY', sym:'¥',    name:'Japanese Yen' },
  { code:'CHF', sym:'Fr',   name:'Swiss Franc' },
  { code:'CNY', sym:'¥',    name:'Chinese Yuan' },
  { code:'INR', sym:'₹',    name:'Indian Rupee' },
  { code:'SGD', sym:'S$',   name:'Singapore Dollar' },
  { code:'HKD', sym:'HK$',  name:'Hong Kong Dollar' },
  { code:'MXN', sym:'MX$',  name:'Mexican Peso' },
  { code:'BRL', sym:'R$',   name:'Brazilian Real' },
  { code:'ZAR', sym:'R',    name:'South African Rand' },
  { code:'KES', sym:'KSh',  name:'Kenyan Shilling' },
  { code:'TZS', sym:'TSh',  name:'Tanzanian Shilling' },
  { code:'THB', sym:'฿',    name:'Thai Baht' },
  { code:'IDR', sym:'Rp',   name:'Indonesian Rupiah' },
  { code:'MYR', sym:'RM',   name:'Malaysian Ringgit' },
  { code:'PHP', sym:'₱',    name:'Philippine Peso' },
  { code:'VND', sym:'₫',    name:'Vietnamese Dong' },
  { code:'AED', sym:'د.إ',  name:'UAE Dirham' },
  { code:'SAR', sym:'﷼',    name:'Saudi Riyal' },
  { code:'SEK', sym:'kr',   name:'Swedish Krona' },
  { code:'NOK', sym:'kr',   name:'Norwegian Krone' },
  { code:'DKK', sym:'kr',   name:'Danish Krone' },
  { code:'PLN', sym:'zł',   name:'Polish Zloty' },
  { code:'CZK', sym:'Kč',   name:'Czech Koruna' },
  { code:'HUF', sym:'Ft',   name:'Hungarian Forint' },
];

const CATEGORIES = [
  { id:'flights',        label:'Flights',       icon:'✈️',  color:'#6366f1', type:'list',  desc:'Airfare & fees' },
  { id:'accommodations', label:'Hotels',         icon:'🏨',  color:'#ec4899', type:'list',  desc:'Lodging & stays' },
  { id:'transport',      label:'Transport',      icon:'🚌',  color:'#14b8a6', type:'list',  desc:'Bus, rail & transfers' },
  { id:'taxi',           label:'Taxi / Ride',    icon:'🚕',  color:'#f59e0b', type:'daily', desc:'Taxis & ride-share' },
  { id:'food',           label:'Food & Drinks',  icon:'🍽️', color:'#f97316', type:'daily', desc:'Meals & beverages' },
  { id:'entertainment',  label:'Entertainment / Misc',  icon:'🎭',  color:'#a855f7', type:'list',  desc:'Activities, events & miscellaneous (use negative values for discounts or home-cost offsets)' },
].map(c => ({
  ...c,
  // Resolved at access time, so the 29 existing c.label / c.desc call sites
  // need no change and follow the active language.
  get label() { return window.t('cat.' + this.id + '.label'); },
  get desc()  { return window.t('cat.' + this.id + '.desc');  },
}));

const SVG = {
  edit: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  del:  `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`,
};

// ============================================================
// UTILITIES
// ============================================================
const Utils = {
  uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  },
  fmt(amount, code, decimals) {
    const c = CURRENCIES.find(x => x.code === code) || { sym: '', code };
    const dp = (decimals === undefined) ? 2 : decimals;
    // Keep the sign. Negatives are meaningful here — discounts, offsets and
    // refunds are entered as negative amounts. Callers that want an unsigned
    // figure (variance readouts, which colour over/under instead) pass
    // Math.abs() themselves.
    const v = isNaN(amount) ? 0 : parseFloat(amount);
    const loc = (window.I18N ? I18N.locale() : 'en-US');
    const n = Math.abs(v).toLocaleString(loc, { minimumFractionDigits: dp, maximumFractionDigits: dp });
    const sign = v < 0 ? '-' : '';
    // French and Spanish put the symbol after the number: 1 234,56 €
    return (window.I18N && I18N.symbolAfter())
      ? `${sign}${n}\u00A0${c.sym}`
      : `${sign}${c.sym}${n}`;
  },
  sym(code) { return (CURRENCIES.find(x => x.code === code) || { sym: code }).sym; },
  fmtDate(d) {
    if (!d) return '';
    const [y, m, dd] = d.split('-');
    return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m - 1] + ' ' + +dd + ', ' + y;
  },
  daysBetween(a, b) { return Math.max(0, Math.round((new Date(b) - new Date(a)) / 86400000)); },
  daysUntil(d) {
    const today = new Date(); today.setHours(0,0,0,0);
    return Math.round((new Date(d) - today) / 86400000);
  },
  daysElapsed(start, end) {
    const today = new Date(); today.setHours(0,0,0,0);
    const s = new Date(start), e = new Date(end);
    if (today < s) return 0;
    if (today > e) return Utils.daysBetween(start, end);
    return Utils.daysBetween(start, today.toISOString().split('T')[0]);
  },
  today() { return new Date().toISOString().split('T')[0]; },
  esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); },
};

// ============================================================
// REMOTE STORE — writes data to disk via server.js API
// Falls back silently to localStorage-only when server is not running.
// ============================================================
const RemoteStore = {
  ok:       false,   // true when server API is reachable
  _loading: false,   // true during server→localStorage hydration (suppresses re-push)
  _pending: false,   // true when a push is already queued

  // Test whether the server API is reachable (fast 600 ms timeout)
  async ping() {
    try {
      const ac  = new AbortController();
      const tid = setTimeout(() => ac.abort(), 600);
      const r   = await fetch('/api/ping', { signal: ac.signal });
      clearTimeout(tid);
      this.ok = r.ok;
    } catch { this.ok = false; }
    return this.ok;
  },

  // Pull all data from server and return as an object
  async loadAll() {
    if (!this.ok) return null;
    try {
      const r = await fetch('/api/data');
      const d = await r.json();
      return (d && Object.keys(d).length) ? d : null;
    } catch { return null; }
  },

  // Queue a debounced push (runs 120 ms after the last mutation)
  schedule() {
    if (!this.ok || this._loading || this._pending) return;
    this._pending = true;
    setTimeout(() => { this._pending = false; this._push(); }, 120);
  },

  // Gather the full app state from localStorage and POST it to server
  async _push() {
    if (!this.ok) return;
    try {
      const trips = Store.trips();
      const payload = {
        trips,
        activeId: Store.activeId(),
        user:     Store.user(),
        budgets: {}, txns: {}, notes: {},
      };
      trips.forEach(t => {
        payload.budgets[t.id] = Store.budgets(t.id);
        payload.txns[t.id]    = Store.txns(t.id);
        payload.notes[t.id]   = Store.notes(t.id);
      });
      await fetch('/api/data', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
    } catch { /* silent – server may have stopped */ }
  },
};

// ============================================================
// STORAGE — localStorage with automatic server sync
// ============================================================
const Store = {
  K: { TRIPS: 'tbd_trips_v1', AID: 'tbd_active_v1' },
  bk: id => `tbd_budgets_v1_${id}`,
  tk: id => `tbd_txns_v1_${id}`,
  nk: id => `tbd_notes_v1_${id}`,
  uk: 'tbd_user_v1',

  // Safe localStorage helpers — never throw, even in sandboxed WebViews
  _get(key, fallback) {
    try { return JSON.parse(__LS.getItem(key) ?? 'null') ?? fallback; }
    catch { return fallback; }
  },
  _set(key, val) {
    try { __LS.setItem(key, JSON.stringify(val)); }
    catch(e) { console.warn('Storage write blocked:', key, e.message); }
  },
  _del(key) {
    try { __LS.removeItem(key); }
    catch(e) { console.warn('Storage delete blocked:', key, e.message); }
  },

  trips()        { return this._get(this.K.TRIPS, []); },
  saveTrips(t)   { this._set(this.K.TRIPS, t); RemoteStore.schedule(); },

  activeId()     { return this._get(this.K.AID, null); },
  setActive(id)  {
    id ? this._set(this.K.AID, id) : this._del(this.K.AID);
    RemoteStore.schedule();
  },

  budgets(id)       { return this._get(this.bk(id), null) || this._emptyBudgets(); },
  _emptyBudgets()   { return { flights:[], accommodations:[], transport:[], taxi:null, food:null, entertainment:[] }; },
  saveBudgets(id,b) { this._set(this.bk(id), b); RemoteStore.schedule(); },

  txns(id)       { return this._get(this.tk(id), []); },
  saveTxns(id,t) { this._set(this.tk(id), t); RemoteStore.schedule(); },

  notes(id)       { return this._get(this.nk(id), []); },
  saveNotes(id,n) { this._set(this.nk(id), n); RemoteStore.schedule(); },

  user()       { return this._get(this.uk, null); },
  saveUser(u)  { this._set(this.uk, u); RemoteStore.schedule(); },

  deleteTrip(id) {
    this._del(this.bk(id));
    this._del(this.tk(id));
    this._del(this.nk(id));
    RemoteStore.schedule();
  },
};


// ============================================================
// EXCHANGE RATES  (fawazahmed0/currency-api via jsDelivr — 150+ currencies, free, no key)
// ============================================================
const ExchangeRates = {
  _CACHE_KEY : 'fx_cache_v2',
  _TTL_MS    : 4 * 60 * 60 * 1000,   // 4-hour cache — rates update once/day
  // Primary: jsDelivr CDN (same CDN we already use elsewhere)
  // Fallback: Cloudflare Pages mirror
  _URLS(base) {
    const b = base.toLowerCase();
    return [
      `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${b}.min.json`,
      `https://latest.currency-api.pages.dev/v1/currencies/${b}.json`,
    ];
  },
  _cache : null,   // { base, rates:{CODE:number}, fetchedAt:ISO }

  // ── Load cache from localStorage on startup ──────────────────
  init() {
    try {
      const raw = __LS.getItem(this._CACHE_KEY);
      if (raw) this._cache = JSON.parse(raw);
    } catch(_) {}
  },

  // ── Return rate: how many foreignCurrency per 1 baseCurrency ─
  getRate(foreignCurrency, baseCurrency) {
    if (!this._cache) return null;
    if (foreignCurrency === baseCurrency) return 1;
    // Cache is keyed by base currency (lowercase in API, we store uppercase)
    if (this._cache.base !== baseCurrency) return null;
    return this._cache.rates[foreignCurrency] || null;
  },

  // ── True if cache is fresh enough ────────────────────────────
  isFresh() {
    if (!this._cache?.fetchedAt) return false;
    return (Date.now() - new Date(this._cache.fetchedAt).getTime()) < this._TTL_MS;
  },

  // ── Fetch rates for baseCurrency, try both URLs ───────────────
  async fetch(baseCurrency) {
    const urls = this._URLS(baseCurrency);
    for (const url of urls) {
      try {
        const res  = await fetch(url);
        if (!res.ok) continue;
        const json = await res.json();
        const base = baseCurrency.toLowerCase();
        const rawRates = json[base];
        if (!rawRates) continue;
        // Normalise keys to UPPERCASE for easy lookup
        const rates = {};
        Object.keys(rawRates).forEach(k => { rates[k.toUpperCase()] = rawRates[k]; });
        this._cache = { base: baseCurrency, rates, fetchedAt: new Date().toISOString() };
        __LS.setItem(this._CACHE_KEY, JSON.stringify(this._cache));
        return true;
      } catch(e) {
        console.warn('ExchangeRates: fetch failed for', url, '—', e.message);
      }
    }
    return false;
  },

  // ── Silently refresh in background if stale; never blocks UI ─
  async prefetch(baseCurrency) {
    this.init();
    if (!this.isFresh() || this._cache?.base !== baseCurrency) {
      await this.fetch(baseCurrency);
    }
  },

  // ── Human-readable last-updated string ───────────────────────
  updatedLabel() {
    if (!this._cache?.fetchedAt) return 'offline';
    const d = new Date(this._cache.fetchedAt);
    const loc = (window.I18N ? I18N.locale() : 'en-US');
    return d.toLocaleDateString(loc, { month:'short', day:'numeric' }) +
           ' ' + d.toLocaleTimeString(loc, { hour:'2-digit', minute:'2-digit' });
  },
};


// ============================================================
// TRIP MANAGER
// ============================================================
const TripMgr = {
  all()     { return Store.trips(); },
  byId(id)  { return Store.trips().find(t => t.id === id) || null; },
  active()  { const id = Store.activeId(); return id ? this.byId(id) : null; },
  setActive(id) { Store.setActive(id); },

  create(d) {
    const t = { id: Utils.uuid(), name: d.name, startDate: d.startDate, endDate: d.endDate,
      totalDays: Utils.daysBetween(d.startDate, d.endDate),
      pax: +d.pax, baseCurrency: d.baseCurrency, createdAt: new Date().toISOString() };
    const list = Store.trips(); list.unshift(t); Store.saveTrips(list);
    return t;
  },
  update(id, d) {
    const list = Store.trips(), i = list.findIndex(t => t.id === id);
    if (i < 0) return null;
    list[i] = { ...list[i], ...d, totalDays: Utils.daysBetween(d.startDate||list[i].startDate, d.endDate||list[i].endDate), pax: +d.pax };
    Store.saveTrips(list); return list[i];
  },
  delete(id) {
    let list = Store.trips().filter(t => t.id !== id);
    Store.saveTrips(list); Store.deleteTrip(id);
    if (Store.activeId() === id) Store.setActive(list.length ? list[0].id : null);
  },

  // Deep-clone a trip with all its budgets, transactions and notes.
  // The copy gets a fresh UUID and " (copy)" appended to its name.
  clone(srcId) {
    const src = this.byId(srcId);
    if (!src) return null;

    const newId = Utils.uuid();
    const copy  = {
      ...src,
      id:        newId,
      name:      src.name + ' (copy)',
      createdAt: new Date().toISOString(),
      clonedFrom: srcId,
    };

    // Save the new trip metadata
    const list = Store.trips();
    const srcIdx = list.findIndex(t => t.id === srcId);
    // Insert copy right after the original so they sit together in the list
    list.splice(srcIdx + 1, 0, copy);
    Store.saveTrips(list);

    // Deep-copy budgets, transactions, notes
    Store.saveBudgets(newId, JSON.parse(JSON.stringify(Store.budgets(srcId))));
    Store.saveTxns(newId,    JSON.parse(JSON.stringify(Store.txns(srcId))));
    Store.saveNotes(newId,   JSON.parse(JSON.stringify(Store.notes(srcId))));

    return copy;
  },
};

// ============================================================
// BUDGET MANAGER
// ============================================================
const BudgetMgr = {
  get(tripId)  { return Store.budgets(tripId); },

  itemTotal(item, catId, trip) {
    const pax = trip ? trip.pax : 1;
    if (catId === 'flights')        return (parseFloat(item.pricePerPax)         || 0) * pax;
    if (catId === 'accommodations') return (parseFloat(item.pricePerRoom)        || 0) * (parseInt(item.nights) || 0);
    if (catId === 'transport')      return (parseFloat(item.pricePerPax)         || 0) * pax;
    if (catId === 'taxi')           return (parseFloat(item.pricePerPersonPerDay)|| 0) * pax * (parseInt(item.days) || 0);
    if (catId === 'food')           return (parseFloat(item.pricePerPersonPerDay)|| 0) * pax * (parseInt(item.days) || 0);
    if (catId === 'entertainment')  return (parseFloat(item.pricePerPerson)      || 0) * pax;
    return 0;
  },

  catTotal(tripId, catId) {
    const b = Store.budgets(tripId), trip = TripMgr.byId(tripId);
    const items = b[catId];
    if (Array.isArray(items)) return items.reduce((s, i) => s + this.itemTotal(i, catId, trip), 0);
    if (items)                return this.itemTotal(items, catId, trip);
    return 0;
  },

  grandTotal(tripId) { return CATEGORIES.reduce((s, c) => s + this.catTotal(tripId, c.id), 0); },

  addItem(tripId, catId, data) {
    const b = Store.budgets(tripId);
    if (Array.isArray(b[catId])) {
      const item = { ...data, id: Utils.uuid(), createdAt: new Date().toISOString() };
      b[catId].push(item);
    } else {
      b[catId] = { ...data, id: '__daily__' };
    }
    Store.saveBudgets(tripId, b);
  },

  updateItem(tripId, catId, itemId, data) {
    const b = Store.budgets(tripId);
    if (Array.isArray(b[catId])) {
      const i = b[catId].findIndex(x => x.id === itemId);
      if (i >= 0) b[catId][i] = { ...b[catId][i], ...data };
    } else {
      b[catId] = { ...b[catId], ...data };
    }
    Store.saveBudgets(tripId, b);
  },

  deleteItem(tripId, catId, itemId) {
    const b = Store.budgets(tripId);
    if (Array.isArray(b[catId])) b[catId] = b[catId].filter(x => x.id !== itemId);
    Store.saveBudgets(tripId, b);
  },
};

// ============================================================
// TRANSACTION MANAGER
// ============================================================
const TxnMgr = {
  all(tripId)          { return Store.txns(tripId); },
  byCat(tripId, catId) { return Store.txns(tripId).filter(t => t.category === catId); },

  calcBase(amount, rate, currency, baseCurrency) {
    const a = parseFloat(amount) || 0;
    const r = parseFloat(rate) || 1;
    return currency === baseCurrency ? a : a / r;
  },

  add(tripId, data) {
    const list = Store.txns(tripId);
    const txn = { ...data, id: Utils.uuid(),
      amountInBase: this.calcBase(data.amount, data.exchangeRate, data.currency, TripMgr.byId(tripId).baseCurrency),
      createdAt: new Date().toISOString() };
    list.unshift(txn); Store.saveTxns(tripId, list);
    return txn;
  },

  update(tripId, id, data) {
    const list = Store.txns(tripId), i = list.findIndex(t => t.id === id);
    if (i >= 0) {
      list[i] = { ...list[i], ...data,
        amountInBase: this.calcBase(data.amount, data.exchangeRate, data.currency, TripMgr.byId(tripId).baseCurrency) };
      Store.saveTxns(tripId, list);
    }
  },

  delete(tripId, id) { Store.saveTxns(tripId, Store.txns(tripId).filter(t => t.id !== id)); },

  catTotals(tripId, catId) {
    const txns = this.byCat(tripId, catId);
    const committed = txns.filter(t => t.status === 'committed').reduce((s,t) => s + (parseFloat(t.amountInBase)||0), 0);
    const actual    = txns.filter(t => t.status === 'actual'   ).reduce((s,t) => s + (parseFloat(t.amountInBase)||0), 0);
    return { committed, actual };
  },

  grandTotals(tripId) {
    const txns = Store.txns(tripId);
    const committed = txns.filter(t => t.status === 'committed').reduce((s,t) => s + (parseFloat(t.amountInBase)||0), 0);
    const actual    = txns.filter(t => t.status === 'actual'   ).reduce((s,t) => s + (parseFloat(t.amountInBase)||0), 0);
    return { committed, actual };
  },
};

// ============================================================
// DASHBOARD COMPUTER
// ============================================================
const Dash = {
  summary(tripId) {
    const trip = TripMgr.byId(tripId); if (!trip) return null;
    const budget  = BudgetMgr.grandTotal(tripId);
    const { committed, actual } = TxnMgr.grandTotals(tripId);
    const daysElapsed = Utils.daysElapsed(trip.startDate, trip.endDate);
    const remaining = budget - committed - actual;
    return { trip, budget, committed, actual, remaining, daysElapsed };
  },

  breakdown(tripId) {
    const trip = TripMgr.byId(tripId); if (!trip) return [];
    return CATEGORIES.map(cat => {
      const budget  = BudgetMgr.catTotal(tripId, cat.id);
      const { committed, actual } = TxnMgr.catTotals(tripId, cat.id);
      const spent   = committed + actual;
      const remaining = budget - spent;
      const pct = budget !== 0 ? Math.min(100, Math.abs(spent / budget) * 100) : 0;
      return { ...cat, budget, committed, actual, spent, remaining, pct };
    });
  },
};

// ============================================================
// CHARTS
// ============================================================
const ChartMgr = {
  bar: null, donut: null,
  destroy() {
    if (this.bar)   { this.bar.destroy();   this.bar   = null; }
    if (this.donut) { this.donut.destroy(); this.donut = null; }
  },
  renderBar(bkdn, cur) {
    const ctx = document.getElementById('chart-bar'); if (!ctx) return;
    if (this.bar) this.bar.destroy();
    this.bar = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: bkdn.map(c => c.label),
        datasets: [
          { label:window.t('lvl.budget'),    data: bkdn.map(c => c.budget),    backgroundColor:'rgba(240,192,64,0.2)',  borderColor:'#f0c040', borderWidth:1, borderRadius:4 },
          { label:window.t('lvl.committed'), data: bkdn.map(c => c.committed), backgroundColor:'rgba(88,166,255,0.55)', borderColor:'#58a6ff', borderWidth:1, borderRadius:4 },
          { label:window.t('lvl.actual'),    data: bkdn.map(c => c.actual),    backgroundColor:'rgba(63,185,80,0.55)',  borderColor:'#3fb950', borderWidth:1, borderRadius:4 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color:'#7d8590', font:{ family:'Inter', size:11 }, boxWidth:12 } },
          tooltip: { callbacks: { label: ctx => ` ${Utils.fmt(ctx.parsed.y, cur)}` } },
        },
        scales: {
          x: { grid:{ color:'#21262d' }, ticks:{ color:'#7d8590', font:{ family:'Inter', size:10 } } },
          y: { grid:{ color:'#21262d' }, ticks:{ color:'#7d8590', font:{ family:'Inter', size:10 },
               callback: v => Utils.sym(cur) + v.toLocaleString() } },
        },
      },
    });
  },
  renderDonut(bkdn, cur) {
    const wrap = document.getElementById('donut-wrapper'); if (!wrap) return;
    const filtered = bkdn.filter(c => c.spent > 0);
    if (!filtered.length) {
      wrap.innerHTML = '<div class="no-items" style="padding:44px"><div class="no-items-icon">📊</div>No spending recorded yet</div>';
      return;
    }
    const ctx = document.getElementById('chart-donut'); if (!ctx) return;
    if (this.donut) this.donut.destroy();
    this.donut = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: filtered.map(c => c.label),
        datasets: [{ data: filtered.map(c => c.spent),
          backgroundColor: filtered.map(c => c.color + 'bb'),
          borderColor:     filtered.map(c => c.color),
          borderWidth: 2, hoverOffset: 8 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '64%',
        plugins: {
          legend: { position:'bottom', labels:{ color:'#7d8590', font:{ family:'Inter', size:11 }, boxWidth:12, padding:14 } },
          tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${Utils.fmt(ctx.parsed, cur)}` } },
        },
      },
    });
  },
};


// ============================================================
// IMPORT DIFF  -  show what an incoming file changes before applying it
// ============================================================
const ImportDiff = {

  // Sum a budgets object with the same pricing rules the live app uses.
  // BudgetMgr.itemTotal is pure, so it works on imported data too.
  _budgetTotal(budgets, trip) {
    if (!budgets || !trip) return 0;
    return CATEGORIES.reduce((sum, c) => {
      const items = budgets[c.id];
      if (Array.isArray(items)) return sum + items.reduce((s, i) => s + BudgetMgr.itemTotal(i, c.id, trip), 0);
      if (items)                return sum + BudgetMgr.itemTotal(items, c.id, trip);
      return sum;
    }, 0);
  },

  _budgetCount(budgets) {
    if (!budgets) return 0;
    return CATEGORIES.reduce((n, c) => {
      const items = budgets[c.id];
      return n + (Array.isArray(items) ? items.length : (items ? 1 : 0));
    }, 0);
  },

  _txnTotal(list) {
    return (list || []).reduce((s, t) => s + (parseFloat(t.amountInBase) || 0), 0);
  },

  _noteCount(n) {
    if (!n) return 0;
    return Array.isArray(n) ? n.length : (String(n).trim() ? 1 : 0);
  },

  // Compare incoming payload against what is on this device.
  build(d) {
    const localTrips = Store.trips();
    const incoming   = d.trips || [];
    const lById = new Map(localTrips.map(t => [t.id, t]));
    const iById = new Map(incoming.map(t => [t.id, t]));

    const added   = incoming.filter(t => !lById.has(t.id));
    const removed = localTrips.filter(t => !iById.has(t.id));
    const changed = [];

    let localTxns = 0, incomingTxns = 0;
    localTrips.forEach(t => { localTxns += (Store.txns(t.id) || []).length; });
    incoming.forEach(t => { incomingTxns += (((d.txns || {})[t.id]) || []).length; });

    for (const t of incoming) {
      const local = lById.get(t.id);
      if (!local) continue;
      const bits = [];

      if (local.name !== t.name)
        bits.push({ label: 'Name', from: local.name, to: t.name });
      if (local.startDate !== t.startDate || local.endDate !== t.endDate)
        bits.push({ label: 'Dates',
                    from: `${Utils.fmtDate(local.startDate)} – ${Utils.fmtDate(local.endDate)}`,
                    to:   `${Utils.fmtDate(t.startDate)} – ${Utils.fmtDate(t.endDate)}` });
      if (+local.pax !== +t.pax)
        bits.push({ label: 'Travellers', from: local.pax, to: t.pax });

      const cur = t.baseCurrency || local.baseCurrency;

      const lbC = this._budgetCount(Store.budgets(t.id));
      const ibC = this._budgetCount((d.budgets || {})[t.id]);
      const lbT = this._budgetTotal(Store.budgets(t.id), local);
      const ibT = this._budgetTotal((d.budgets || {})[t.id], t);
      if (lbC !== ibC || Math.round(lbT) !== Math.round(ibT))
        bits.push({ label: 'Budget',
                    from: `${lbC} line${lbC === 1 ? '' : 's'} · ${Utils.fmt(lbT, cur)}`,
                    to:   `${ibC} line${ibC === 1 ? '' : 's'} · ${Utils.fmt(ibT, cur)}` });

      const lt = Store.txns(t.id) || [];
      const it = ((d.txns || {})[t.id]) || [];
      if (lt.length !== it.length || Math.round(this._txnTotal(lt)) !== Math.round(this._txnTotal(it)))
        bits.push({ label: 'Expenses',
                    from: `${lt.length} entr${lt.length === 1 ? 'y' : 'ies'} · ${Utils.fmt(this._txnTotal(lt), cur)}`,
                    to:   `${it.length} entr${it.length === 1 ? 'y' : 'ies'} · ${Utils.fmt(this._txnTotal(it), cur)}` });

      const ln = this._noteCount(Store.notes(t.id));
      const inn = this._noteCount((d.notes || {})[t.id]);
      if (ln !== inn) bits.push({ label: 'Notes', from: `${ln}`, to: `${inn}` });

      if (bits.length) changed.push({ trip: t, bits });
    }

    return {
      added, removed, changed,
      localTripCount: localTrips.length,
      incomingTripCount: incoming.length,
      localTxns, incomingTxns,
      isEmpty: !localTrips.length,
      noChanges: !added.length && !removed.length && !changed.length,
    };
  },

  _row(icon, cls, title, sub) {
    return `<div class="idf-row ${cls}">
      <span class="idf-icon">${icon}</span>
      <div><div class="idf-name">${Utils.esc(title)}</div>
      ${sub ? `<div class="idf-sub">${sub}</div>` : ''}</div></div>`;
  },

  // Show the review sheet. onApply runs only if the user confirms.
  show(diff, fileName, exportedOn, onApply) {
    document.getElementById('import-diff-overlay')?.remove();

    const warn = [];
    if (diff.removed.length)
      warn.push(`${diff.removed.length} trip${diff.removed.length > 1 ? 's' : ''} on this device
                 ${diff.removed.length > 1 ? 'are' : 'is'} not in this file and will be removed.`);
    if (diff.incomingTxns < diff.localTxns)
      warn.push(`This file has ${diff.localTxns - diff.incomingTxns} fewer expense entries than this device.`);

    let body = '';

    if (diff.isEmpty) {
      body = `<div class="idf-note">There is no data on this device yet, so nothing will be overwritten.</div>`;
    } else if (diff.noChanges) {
      body = `<div class="idf-note">This file matches what is already on this device. Importing changes nothing.</div>`;
    }

    if (diff.added.length) {
      body += `<div class="idf-head">Will be added</div>` +
        diff.added.map(t => this._row('＋', 'idf-add', t.name,
          `${Utils.fmtDate(t.startDate)} – ${Utils.fmtDate(t.endDate)}`)).join('');
    }
    if (diff.changed.length) {
      body += `<div class="idf-head">Will change</div>` +
        diff.changed.map(c => this._row('～', 'idf-chg', c.trip.name,
          c.bits.map(b => `<div class="idf-bit"><span>${Utils.esc(b.label)}</span>
            <s>${Utils.esc(String(b.from))}</s> → <b>${Utils.esc(String(b.to))}</b></div>`).join(''))).join('');
    }
    if (diff.removed.length) {
      body += `<div class="idf-head">Will be removed</div>` +
        diff.removed.map(t => this._row('−', 'idf-del', t.name,
          `${Utils.fmtDate(t.startDate)} – ${Utils.fmtDate(t.endDate)}`)).join('');
    }

    const ov = document.createElement('div');
    ov.id = 'import-diff-overlay';
    ov.className = 'idf-overlay';
    ov.innerHTML = `
      <div class="idf-box" role="dialog" aria-modal="true" aria-label="Review import">
        <div class="idf-title">Review changes before importing</div>
        <div class="idf-src">${Utils.esc(fileName)}<br><span>Exported ${Utils.esc(exportedOn)}</span></div>
        ${warn.length ? `<div class="idf-warn">⚠️ ${warn.join('<br>')}</div>` : ''}
        <div class="idf-body">${body}</div>
        <div class="idf-actions">
          <button class="btn btn-ghost" id="idf-cancel">Cancel</button>
          <button class="btn btn-primary" id="idf-ok">Replace my data</button>
        </div>
      </div>`;
    document.body.appendChild(ov);

    const close = () => ov.remove();
    ov.querySelector('#idf-cancel').addEventListener('click', close, { once: true });
    ov.querySelector('#idf-ok').addEventListener('click', () => { close(); onApply(); }, { once: true });
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
  },
};


// ============================================================
// HELP  -  short in-app guide, reachable from the trips header
// ============================================================
const Help = {

  SECTIONS: [
    {
      icon: '📱',
      title: 'Install it on your phone',
      html: `
        <p><strong>iPhone / iPad — must be Safari.</strong> Open the app's web address in
        <strong>Safari</strong>, tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.
        Launch it from that icon from then on.</p>
        <p>Chrome, Firefox and Edge on iPhone all run Apple's browser engine underneath and
        <em>cannot</em> install a web app.</p>
        <p><strong>Opening a saved HTML file on an iPhone will not work.</strong> iOS previews
        files from Mail or the Files app without running any code — the page appears but nothing
        responds. This is an iOS restriction; no app can work around it.</p>
        <p><strong>Android:</strong> open in Chrome and choose <em>Install app</em> or
        <em>Add to Home screen</em>. Opening a saved file also works here.</p>
        <p>Once installed, the app works offline. Only live exchange rates and AI need a connection.</p>`,
    },
    {
      icon: '🤝',
      title: 'Plan with a travel partner',
      html: `
        <p>There are no accounts, so nothing syncs by itself. You pass a file back and forth.</p>
        <p><strong>Set up once:</strong> make a folder inside Google Drive or OneDrive, share it with
        your partner, then point your browser's download location at it
        (Chrome: Settings → Downloads → Location). Every export then lands somewhere you can both see.</p>
        <p><strong>The loop:</strong> tap 📤 <strong>Export</strong> → your partner taps
        📥 <strong>Import</strong> → they adjust and export again → you import theirs. Each file is
        dated, so nothing is overwritten and you can always go back.</p>
        <p><strong>Importing replaces what is on your device</strong> — but you will see exactly what
        changes first: trips added, removed and changed, with budget and expense differences, plus a
        warning if the file holds less than you already have.</p>`,
    },
    {
      icon: '💾',
      title: 'Keep your data safe',
      html: `
        <p>Everything is stored in this browser, on this device. That is what makes the app free and
        private — but it also means <strong>clearing your browser data deletes your trips</strong>,
        and losing the device loses them too.</p>
        <p><strong>So export regularly.</strong> Tap 📤 after any real work and keep the file in your
        cloud folder. It takes five seconds and it is your only backup.</p>
        <p><strong>Passing the app on a USB stick?</strong> It works on computers, but note two things:</p>
        <p>• <strong>The USB carries the app, not your trips.</strong> Your data lives in the browser
        on the computer you used, never in the folder. Copy your exported
        <code>.json</code> file onto the stick as well, and the recipient can import it.</p>
        <p>• <strong>Nothing will be saved between sessions.</strong> Browsers block storage for pages
        opened directly from a drive, so the app shows a red banner and forgets everything on close.
        Export before closing, every time. Use <code>mobile.html</code> — it is the self-contained
        file and needs no internet.</p>
        <p>For anything beyond a demo, the installed version from the web address is far safer.</p>`,
    },
    {
      icon: '✨',
      title: 'AI Budget Starter (optional)',
      html: `
        <p>Know your budget but not the destination? The app can suggest trips that fit, each with a
        starting budget. It uses Google Gemini.</p>
        <p>AI answers cost money per question, so rather than charge you the app uses
        <strong>your own free Google key</strong> — you only ever spend your own free allowance, and
        the key stays on this device.</p>
        <p><strong>Getting a key:</strong> open
        <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener">Google AI Studio</a>,
        sign in, click <strong>Create API key</strong> → <strong>in a new project</strong>, then
        <strong>copy the key using the copy icon</strong> at the right of its row. The full key is
        never shown on the page, which is where most people get stuck.</p>
        <p><strong>"Pick or create a project"?</strong> Nothing you were meant to make earlier. It is
        just a folder Google keeps your key in to count usage. Creating one is free and needs no card.</p>
        <p>Your key will show <strong>Free tier</strong> beside a "Set up billing" link.
        <strong>You never need to click it.</strong></p>
        <p>Prefer to skip all this? The ready-made budget templates work with no key.</p>`,
    },
    {
      icon: '🔧',
      title: "Something isn't working",
      html: `
        <p><strong>Buttons do nothing on my iPhone.</strong> You opened a saved file rather than the
        installed app. Install from Safari — see the first section.</p>
        <p><strong>A red banner says storage is unavailable.</strong> You are running from a file or in
        Private Browsing. The app works but saves nothing. Use the installed version.</p>
        <p><strong>I updated the app but nothing changed.</strong> Your device is serving a cached copy.
        On iPhone: Settings → Safari → Clear History and Website Data, or delete and re-add the
        home-screen icon.</p>
        <p><strong>"That key wasn't accepted."</strong> The key was copied incompletely. It starts with
        <code>AIza</code> and is about 39 characters.</p>
        <p><strong>"Google retired the model in use."</strong> Google replaced the AI model. The app
        finds a current one by itself — just try again.</p>
        <p><strong>A usage-limit message when you have not used the AI.</strong> Usually not about
        usage at all: Google returns the same error when a model is not included in your key's free
        tier. The app steps through the available models and settles on one that works, so try again.
        If it keeps happening, every model offered to your key is billed-tier only — the budget
        templates still work without AI.</p>
        <p><strong>My partner cannot see my export.</strong> It went to your ordinary Downloads folder.
        Change your browser's download location to the shared folder.</p>`,
    },
  ],

  open(index) {
    document.getElementById('help-overlay')?.remove();
    const ov = document.createElement('div');
    ov.id = 'help-overlay';
    ov.className = 'help-overlay';
    ov.innerHTML = `
      <div class="help-box" role="dialog" aria-modal="true" aria-label="Help">
        <div class="help-head">
          <div class="help-title">Help</div>
          <button class="help-close" id="help-close" aria-label="Close">✕</button>
        </div>
        <div class="help-lead">Travel Budget Manager answers one question: the destination is
          decided — what will it cost, and are you still on budget?</div>
        <div class="help-body">
          ${this.SECTIONS.map((s, i) => `
            <details class="help-sec" ${i === index ? 'open' : ''}>
              <summary><span class="help-ico">${s.icon}</span>${s.title}</summary>
              <div class="help-sec-body">${s.html}</div>
            </details>`).join('')}
        </div>
      </div>`;
    document.body.appendChild(ov);
    const close = () => ov.remove();
    ov.querySelector('#help-close').addEventListener('click', close, { once: true });
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
  },

  close() { document.getElementById('help-overlay')?.remove(); },
};

// ============================================================
// AI PRICE GUIDE MODULE
// ============================================================
const AI = {
  KEY_STORE: 'tbd_gemini_key',

  getKey()  { return __LS.getItem(this.KEY_STORE) || ''; },

  // Chosen model is cached so we don't call ListModels on every request.
  MODEL_STORE: 'tbd_gemini_model',

  // Preference order, cheapest tier first. Matched against whatever Google
  // actually reports as available, so new releases work with no code change
  // and retired models are skipped automatically.
  _PREFER: [/flash-lite/i, /flash/i, /pro/i],

  // Used only if ListModels itself is unreachable.
  _FALLBACK: ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-3.5-flash'],

  // Ask Google which models this key may use. Costs no tokens, so it doubles
  // as key validation.
  async listModels(key) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`);
    if (!res.ok) {
      const e   = await res.json().catch(() => ({}));
      const err = new Error(e?.error?.message || `HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    const data = await res.json();
    return (data.models || [])
      .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map(m => (m.name || '').replace(/^models\//, ''))
      .filter(Boolean);
  },

  // Cheapest usable model wins; among equals, the lowest generation number
  // (older = cheaper) is preferred.
  // Ranked ladder, cheapest first. Returns every usable candidate rather than
  // one pick, so generate() can step past models the free tier will not serve.
  _rank(names) {
    const usable = (names || []).filter(n =>
      !/preview|-exp|experimental|embedding|image|vision|tts|audio|live|thinking/i.test(n));
    const genOf = s => parseFloat((s.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || '99');
    const tier  = s => this._PREFER.findIndex(p => p.test(s));
    return usable
      .filter(n => tier(n) >= 0)
      .sort((a, b) => tier(a) - tier(b) || genOf(a) - genOf(b) || a.length - b.length);
  },

  async resolveCandidates(key, force) {
    let list = [];
    try {
      list = this._rank(await this.listModels(key));
    } catch (e) { /* fall through to the static list */ }
    if (!list.length) list = this._FALLBACK.slice();

    // A model already known to work goes first.
    const cached = force ? null : __LS.getItem(this.MODEL_STORE);
    if (cached) list = [cached].concat(list.filter(m => m !== cached));
    return list;
  },

  _isModelGone(msg, status) {
    return status === 404 ||
      /not found|no longer available|not supported|deprecat|has been (retired|discontinued)/i.test(msg || '');
  },

  // A 429 carrying quota_limit_value "0" means this model is not on the free
  // tier at all - nothing has been consumed. Treat it as "try the next model",
  // never as "you are out of allowance".
  _isZeroQuota(errObj, msg) {
    const details = errObj?.error?.details || [];
    for (const d of details) {
      const v = d?.metadata?.quota_limit_value ?? d?.metadata?.quotaValue;
      if (String(v) === '0') return true;
    }
    return /limit:\s*0\b|quota_limit_value["':\s]+0\b/i.test(msg || '');
  },

  // Plain-language errors. A retired model must never read as a bad key, and a
  // zero-quota model must never read as exhausted usage.
  friendlyError(msg, status, ctx) {
    const m = msg || '';
    const c = ctx || {};
    if (/API key not valid|API_KEY_INVALID|invalid api key/i.test(m) || (status === 400 && /key/i.test(m)))
      return "That key wasn't accepted. Check you copied all of it — it starts with AIza and is about 39 characters.";
    if (status === 403)
      return 'This key exists but has no access to the Gemini API. If you restricted it, allow the "Generative Language API".';
    if (status === 429 && c.zeroQuota)
      return 'None of the available AI models are included in your key\u2019s free tier right now — '
           + 'this is a Google account limit, not something you have used up. '
           + (c.tried && c.tried.length ? `Tried: ${c.tried.join(', ')}. ` : '')
           + 'Templates still work without AI.';
    if (status === 429 && /per minute|rate limit|RPM/i.test(m))
      return 'Too many requests in a short time. Wait about a minute and try again.';
    if (status === 429)
      return "You've reached a Gemini usage limit for now. If you have not used it today, it is a per-minute limit — wait a minute and retry.";
    if (/location|region|country|not available in your/i.test(m))
      return "The Gemini API isn't available in your region yet.";
    if (this._isModelGone(m, status))
      return 'Google retired the model in use. Reconnecting to a current one — please try again.';
    return m || 'Something went wrong talking to Gemini.';
  },

  // Every Gemini call goes through here. Walks the candidate ladder so a retired
  // or free-tier-excluded model is stepped over rather than reported as failure.
  async generate(key, prompt) {
    const candidates = await this.resolveCandidates(key);
    const tried = [];
    let lastMsg = '', lastStatus = 0, lastZero = false;

    for (let i = 0; i < candidates.length; i++) {
      const model = candidates[i];
      tried.push(model);

      let res;
      try {
        res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
      } catch (netErr) {
        throw new Error('Could not reach Google. Check your connection.');
      }

      if (res.ok) {
        __LS.setItem(this.MODEL_STORE, model);   // remember what actually worked
        const data = await res.json();
        return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      }

      const e   = await res.json().catch(() => ({}));
      const msg = e?.error?.message || `HTTP ${res.status}`;
      const zero = res.status === 429 && this._isZeroQuota(e, msg);
      lastMsg = msg; lastStatus = res.status; lastZero = zero;

      // Retired, or not served on this tier: step down the ladder.
      if (this._isModelGone(msg, res.status) || zero) {
        __LS.removeItem(this.MODEL_STORE);
        continue;
      }

      const err = new Error(this.friendlyError(msg, res.status, { model, tried }));
      err.status = res.status;
      throw err;
    }

    const err = new Error(this.friendlyError(lastMsg, lastStatus || 429,
                                             { tried, zeroQuota: lastZero || lastStatus === 429 }));
    err.status = lastStatus || 429;
    throw err;
  },


  // Verified on save via ListModels, so the user learns immediately whether
  // the key works instead of discovering it later through a vague failure.
  async saveKey(inputId, onOk) {
    const el = document.getElementById(inputId || 'ai-key-input');
    const k  = el?.value.trim();
    if (!k) { UI.toast(t('toast.needKey'), 'error'); return; }

    const btn = el.parentElement?.querySelector('button');
    const old = btn ? btn.textContent : '';
    if (btn) { btn.textContent = '⏳ Checking…'; btn.disabled = true; }

    try {
      const models = await this.listModels(k);
      if (!this._rank(models).length)
        throw new Error('This key works, but no usable text model is available on it.');
      __LS.setItem(this.KEY_STORE, k);
      // Deliberately cache no model here: the first real request proves which
      // one the free tier actually serves. Caching an unproven pick is what
      // produced the misleading "free usage limit" error.
      __LS.removeItem(this.MODEL_STORE);
      UI.toast(t('toast.keyOk'), 'success');
      this.toggleKeySection(false);
      if (typeof onOk === 'function') onOk();
    } catch (e) {
      UI.toast('❌ ' + this.friendlyError(e.message, e.status), 'error');
    } finally {
      if (btn) { btn.textContent = old; btn.disabled = false; }
    }
  },

  buildQuestion(catId, ctx, trip) {
    const cur   = trip?.baseCurrency || 'USD';
    const dest  = trip?.name || (window.t ? window.t('disc.r.northam') : 'your destination');
    const label = ctx.label ? ` ("${ctx.label}")` : '';
    const date  = ctx.date  ? ' ' + (window.I18N ? (I18N.lang==='fr'?'vers ':I18N.lang==='es'?'hacia ':'around ') : 'around ') + Utils.fmtDate(ctx.date) : '';
    const type  = ctx.type  || '';
    const tset  = (window.I18N && I18N.PRICE_PROMPT[I18N.lang]) || (window.I18N && I18N.PRICE_PROMPT.en) || {};
    const tmpl  = tset[catId] || tset.default || '';
    return tmpl
      .replace(/{cur}/g, cur)
      .replace(/{dest}/g, dest)
      .replace(/{label}/g, label)
      .replace(/{date}/g, date)
      .replace(/{typeOr}/g, type ? type.toLowerCase() + ' ' : '')
      .replace(/{labelOr}/g, ctx.label || (window.t ? window.t('f.description').toLowerCase() : 'this item'))
      .replace(/{type}/g, type);
  },

  showPopup(catId, ctx) {
    const trip = TripMgr.active();
    document.getElementById('ai-question').value = this.buildQuestion(catId, ctx, trip);
    document.getElementById('ai-response-wrap').style.display = 'none';
    document.getElementById('ai-response-wrap').innerHTML = '';
    document.getElementById('ai-key-section').style.display = 'none';
    const saved = this.getKey();
    if (saved) document.getElementById('ai-key-input').value = saved;
    document.getElementById('ai-popup').classList.remove('hidden');
  },

  close() { document.getElementById('ai-popup').classList.add('hidden'); },

  toggleKeySection(forceShow) {
    const sec = document.getElementById('ai-key-section');
    const show = forceShow !== undefined ? forceShow : sec.style.display === 'none';
    sec.style.display = show ? '' : 'none';
  },

  async ask() {
    const question = document.getElementById('ai-question')?.value.trim();
    if (!question) { UI.toast(t('toast.needQuestion'), 'error'); return; }
    const key   = this.getKey();
    const btn   = document.getElementById('ai-ask-btn');
    const wrap  = document.getElementById('ai-response-wrap');

    if (!key) {
      window.open('https://www.google.com/search?q=' + encodeURIComponent(question), '_blank');
      wrap.style.display = '';
      wrap.innerHTML = `<div class="ai-response-box" style="color:var(--text-secondary);font-size:13px">ℹ️ No Gemini API key set — opened Google search in a new tab.<br><br>Set a Gemini API key below for in-app answers.</div>`;
      document.getElementById('ai-key-section').style.display = '';
      return;
    }

    btn.textContent = '⏳ Thinking...';
    btn.disabled = true;
    wrap.style.display = '';
    wrap.innerHTML = `<div class="ai-loading"><div class="ai-dot"></div><div class="ai-dot"></div><div class="ai-dot"></div>&nbsp; Gemini is thinking…</div>`;

    try {
      const text = (await this.generate(key, question)) || 'No response received.';
      const html = Utils.esc(text)
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>');
      wrap.innerHTML = `<div class="ai-response-box">${html}</div>`;
    } catch (err) {
      // Only point at the key when the key is actually the problem.
      const keyIssue = /key|access|Generative Language/i.test(err.message || '');
      wrap.innerHTML = `<div class="ai-response-box" style="color:var(--red)">❌ ${Utils.esc(err.message)}<br><small style="color:var(--text-secondary)">${keyIssue ? 'Update your API key below. &nbsp;' : ''}<a href="https://www.google.com/search?q=${encodeURIComponent(document.getElementById('ai-question')?.value||'')}" target="_blank" style="color:var(--blue);text-decoration:underline">Search Google instead ↗</a></small></div>`;
      if (keyIssue) document.getElementById('ai-key-section').style.display = '';
    } finally {
      btn.textContent = '✨ Ask Gemini';
      btn.disabled = false;
    }
  },
};

// ============================================================
// ITINERARY MODULE
// ============================================================
const Itinerary = {
  build(tripId) {
    const trip = TripMgr.byId(tripId); if (!trip) return [];
    const b = BudgetMgr.get(tripId);
    const events = [];

    // Flights — depart + return
    (b.flights || []).forEach(item => {
      const lbl = item.label || 'Flight';
      // Reverse "A → B" to "B → A" for the return leg
      const returnLbl = lbl.includes('→')
        ? lbl.split('→').map(s => s.trim()).reverse().join(' → ')
        : lbl;
      if (item.departDate) events.push({
        date: item.departDate, type: 'auto', catId: 'flights',
        icon: '✈️', color: '#6366f1',
        title: `Depart: ${lbl}`,
        detail: Utils.fmt(BudgetMgr.itemTotal(item, 'flights', trip), trip.baseCurrency) + ' group total',
        itemId: item.id,
      });
      if (item.returnDate && item.returnDate > item.departDate) events.push({
        date: item.returnDate, type: 'auto', catId: 'flights',
        icon: '🛬', color: '#6366f1',
        title: `Return: ${returnLbl}`,
        detail: '', itemId: item.id,
      });
    });


    // Accommodations — check-in + check-out
    (b.accommodations || []).forEach(item => {
      if (item.dateIn) events.push({
        date: item.dateIn, type: 'auto', catId: 'accommodations',
        icon: '🏨', color: '#ec4899',
        title: `Check-in: ${item.label || 'Hotel'}`,
        detail: `${item.nights} night${item.nights !== 1 ? 's' : ''} · ${Utils.fmt(BudgetMgr.itemTotal(item, 'accommodations', trip), trip.baseCurrency)}`,
        itemId: item.id,
      });
      if (item.dateOut && item.dateOut > item.dateIn) events.push({
        date: item.dateOut, type: 'auto', catId: 'accommodations',
        icon: '🏨', color: '#ec4899',
        title: `Check-out: ${item.label || 'Hotel'}`,
        detail: '', itemId: item.id,
      });
    });

    // Transport
    (b.transport || []).forEach(item => {
      if (item.departDate) events.push({
        date: item.departDate, type: 'auto', catId: 'transport',
        icon: TRANSPORT_ICONS[item.type] || '🚌',
        color: '#14b8a6',
        title: `${item.type || 'Transport'}: ${item.label || ''}`.trim(),
        detail: Utils.fmt(BudgetMgr.itemTotal(item, 'transport', trip), trip.baseCurrency) + ' group total',
        itemId: item.id,
      });
    });

    // Entertainment
    (b.entertainment || []).forEach(item => {
      if (item.eventDate) events.push({
        date: item.eventDate, type: 'auto', catId: 'entertainment',
        icon: '🎭', color: '#a855f7',
        title: item.label || 'Event',
        detail: Utils.fmt(BudgetMgr.itemTotal(item, 'entertainment', trip), trip.baseCurrency) + ' group total',
        itemId: item.id,
      });
    });

    // Manual notes
    Store.notes(tripId).forEach(note => {
      events.push({
        date: note.date, type: 'note', catId: null,
        icon: '📝', color: '#7d8590',
        title: note.text, detail: '', noteId: note.id,
      });
    });

    return events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  },
};

// ============================================================
// UI HELPERS
// ============================================================
const UI = {
  _tt: null,
  toast(msg, type = '') {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = `toast show-toast${type ? ' t-' + type : ''}`;
    clearTimeout(this._tt);
    this._tt = setTimeout(() => { el.className = 'toast'; }, 2800);
  },
  confirm(msg, onOk, okLabel = 'Delete') {
    const ov  = document.getElementById('confirm-overlay');
    const okEl = document.getElementById('confirm-ok');
    document.getElementById('confirm-msg').textContent = msg;
    okEl.textContent = okLabel;
    ov.classList.remove('hidden');
    const close = () => ov.classList.add('hidden');
    const newOk = okEl.cloneNode(true);
    okEl.replaceWith(newOk);
    newOk.textContent = okLabel;
    newOk.addEventListener('click', () => { onOk(); close(); }, { once: true });
    document.getElementById('confirm-cancel').addEventListener('click', close, { once: true });
  },
  currOpts(sel) {
    return CURRENCIES.map(c =>
      `<option value="${c.code}" ${c.code === sel ? 'selected' : ''}>${c.code} — ${c.name}</option>`
    ).join('');
  },
  catOpts(sel) {
    return CATEGORIES.map(c =>
      `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${c.icon} ${c.label}</option>`
    ).join('');
  },

  initDatePickers(containerId) {
    if (typeof flatpickr === 'undefined') return;
    const scope = containerId ? document.getElementById(containerId) : document;
    if (!scope) return;
    scope.querySelectorAll('input[type="date"]').forEach(inp => {
      if (inp._flatpickr) inp._flatpickr.destroy();
      flatpickr(inp, {
        dateFormat: 'Y-m-d',
        disableMobile: false,
        allowInput: true,
        monthSelectorType: 'static',
      });
    });
  },
};

// ============================================================
// TRIP DISCOVERY  — "Where should I go?" AI + template engine
// ============================================================
const TripDiscovery = {

  // ── Static curated templates ─────────────────────────────────
  TEMPLATES: [
    {
      id:'beach7',     icon:'🏖️',  label:'Beach Getaway',
      desc:'7 days of sun, sea & sand',
      days:7,  pax:2,  currency:'USD',
      destinations:['Bali, Indonesia','Phuket, Thailand','Cancún, Mexico','Maldives'],
      budgets:{ flights:1200, accommodations:700, transport:200, taxi:100, food:300, entertainment:200 },
      localCurrency:'THB',
    },
    {
      id:'beach14',    icon:'🌴',  label:'Extended Beach Holiday',
      desc:'2 weeks island-hopping',
      days:14, pax:2,  currency:'USD',
      destinations:['Bali & Lombok','Koh Samui & Koh Tao','Palawan, Philippines'],
      budgets:{ flights:1400, accommodations:1200, transport:400, taxi:200, food:600, entertainment:400 },
      localCurrency:'IDR',
    },
    {
      id:'city5',      icon:'🏙️',  label:'City Explorer',
      desc:'5 days urban immersion',
      days:5,  pax:2,  currency:'EUR',
      destinations:['Paris, France','Tokyo, Japan','New York, USA','Barcelona, Spain'],
      budgets:{ flights:900, accommodations:800, transport:150, taxi:100, food:400, entertainment:250 },
      localCurrency:'EUR',
    },
    {
      id:'city10',     icon:'🗼',  label:'City Hop',
      desc:'10 days across 2–3 cities',
      days:10, pax:2,  currency:'EUR',
      destinations:['Paris → Rome → Barcelona','Tokyo → Kyoto → Osaka','NYC → Chicago → Miami'],
      budgets:{ flights:1100, accommodations:1400, transport:350, taxi:200, food:700, entertainment:400 },
      localCurrency:'EUR',
    },
    {
      id:'mountain10', icon:'🏔️',  label:'Mountain Trek',
      desc:'10 days altitude & adventure',
      days:10, pax:2,  currency:'USD',
      destinations:['Everest Base Camp, Nepal','Swiss Alps','Patagonia, Argentina','Dolomites, Italy'],
      budgets:{ flights:1500, accommodations:900, transport:300, taxi:80, food:400, entertainment:350 },
      localCurrency:'NPR',
    },
    {
      id:'sea30',      icon:'🗺️',  label:'SE Asia Loop',
      desc:'30 days Vietnam → Thailand → Cambodia',
      days:30, pax:1,  currency:'USD',
      destinations:['Hanoi → Hội An → Saigon → Phnom Penh → Bangkok → Chiang Mai'],
      budgets:{ flights:800, accommodations:900, transport:400, taxi:300, food:900, entertainment:500 },
      localCurrency:'VND',
    },
    {
      id:'europe14',   icon:'🚆',  label:'European Rail',
      desc:'14 days by train across Europe',
      days:14, pax:2,  currency:'EUR',
      destinations:['Amsterdam → Brussels → Paris → Zurich → Milan → Florence → Rome'],
      budgets:{ flights:700, accommodations:2000, transport:600, taxi:150, food:1000, entertainment:600 },
      localCurrency:'EUR',
    },
    {
      id:'safari12',   icon:'🦁',  label:'African Safari',
      desc:'12 days wildlife & wilderness',
      days:12, pax:2,  currency:'USD',
      destinations:['Masai Mara, Kenya','Serengeti, Tanzania','Kruger, South Africa','Okavango, Botswana'],
      budgets:{ flights:2000, accommodations:3600, transport:500, taxi:100, food:600, entertainment:800 },
      localCurrency:'KES',
    },
    {
      id:'japan14',    icon:'🍜',  label:'Japan Culinary & Culture',
      desc:'14 days temples, sushi & sake',
      days:14, pax:2,  currency:'JPY',
      destinations:['Tokyo → Kyoto → Osaka → Hiroshima → Nara'],
      budgets:{ flights:220000, accommodations:280000, transport:80000, taxi:30000, food:140000, entertainment:100000 },
      localCurrency:'JPY',
    },
    {
      id:'nomad60',    icon:'💻',  label:'Digital Nomad Month',
      desc:'30–60 days work & explore SE Asia',
      days:45, pax:1,  currency:'USD',
      destinations:['Chiang Mai, Thailand','Bali, Indonesia','Hội An, Vietnam','Penang, Malaysia'],
      budgets:{ flights:600, accommodations:1800, transport:300, taxi:400, food:1200, entertainment:500 },
      localCurrency:'THB',
    },
  ],

  // ── Discovery questionnaire state ─────────────────────────────
  _q: { region:null, style:[], duration:null, budget:null, month:null },

  // ── Realistic round-trip airfare table (USD, per person) ──────
  // Rows = origin region, Cols = destination zone
  _AIRFARE: {
    //              sea   europe japan africa  northam latam  aus
    northam: { sea:1200, europe:700, japan:1400, africa:1800, northam:400, latam:600,  aus:1500 },
    europe:  { sea:750,  europe:150, japan:900,  africa:650,  northam:700, latam:900,  aus:1100 },
    aus:     { sea:450,  europe:1200,japan:600,  africa:1400, northam:1500,latam:1600, aus:150  },
    asia:    { sea:200,  europe:700, japan:250,  africa:900,  northam:900, latam:1300, aus:400  },
    africa:  { sea:900,  europe:550, japan:1100, africa:250,  northam:1700,latam:1500, aus:1300 },
    latam:   { sea:1400, europe:900, japan:1500, africa:1500, northam:550, latam:250,  aus:1700 },
  },

  // ── Destination zone tags for each template ───────────────────
  _DEST_ZONE: {
    beach7:'sea', beach14:'sea', city5:'europe', city10:'europe',
    mountain10:'asia', sea30:'sea', europe14:'europe', safari12:'africa',
    japan14:'japan', nomad60:'sea',
  },

  // ── Region labels for display ─────────────────────────────────
  _REGIONS: [
    { id:'northam', flag:'🌎' }, { id:'europe', flag:'🇪🇺' }, { id:'aus', flag:'🦘' },
    { id:'asia', flag:'🌏' }, { id:'africa', flag:'🌍' }, { id:'latam', flag:'🌎' },
  ],
  _regionLabel(id) { return t('disc.r.' + id); },
  _regionHint(id)  { return t('disc.rh.' + id); },

  // ── Open the discovery overlay ────────────────────────────────
  open() {
    const saved     = __LS.getItem('home_region');
    const savedCity = __LS.getItem('home_departure_city') || '';
    this._q = { region: saved || null, departureCity: savedCity, style:[], duration:null, budget:null, month:null };
    this._renderStep(1);
  },

  // ── Render a given step inside the setup screen ───────────────
  _renderStep(step) {
    const el = document.getElementById('discovery-panel');
    if (!el) return;
    el.style.display = 'block';
    document.getElementById('setup-form-wrap').style.display = 'none';

    const steps = {
      1: {
        title: t('disc.s1.title'),
        hint:  t('disc.s1.hint'),
        html: `
          <div class="disc-chips">
            ${this._REGIONS.map(r => `
              <button class="disc-chip disc-chip-wide ${this._q.region===r.id?'disc-chip-on':''}"
                      onclick="TripDiscovery._pick('region','${r.id}',this)">
                <span style="font-size:20px">${r.flag}</span>
                <span>${t('disc.r.' + r.id)}</span>
                <span style="font-size:10px;color:var(--text-muted)">${t('disc.rh.' + r.id)}</span>
              </button>`).join('')}
          </div>
          <div class="disc-city-wrap">
            <label class="disc-city-label">${t('disc.city.label')}
              <span style="font-weight:400;color:var(--text-muted)">${t('disc.city.opt')}</span>
            </label>
            <input id="disc-city-input" class="form-input disc-city-input" type="text"
                   placeholder="${t('disc.city.ph')}"
                   value="${Utils.esc(this._q.departureCity||'')}"
                   oninput="TripDiscovery._setCityInput(this.value)"
                   style="font-size:15px;margin-top:6px" autocomplete="off" />
          </div>`,
        next: () => !!this._q.region,
        nextLabel: t('disc.next'),
      },
      2: {
        title: t('disc.s2.title'),
        hint:  t('disc.s2.hint'),
        html: `
          <div class="disc-chips">
            ${[['🏖️','beach'],['🏔️','mountains'],['🏙️','city'],
               ['🌿','nature'],['🍽️','food'],['🎭','history'],
               ['💻','nomad'],['🎿','adventure']].map(([icon,id]) => `
              <button class="disc-chip ${this._q.style.includes(id)?'disc-chip-on':''}"
                      onclick="TripDiscovery._toggleStyle('${id}',this)">
                ${icon} ${t('disc.st.' + id)}
              </button>`).join('')}
          </div>`,
        next: () => this._q.style.length > 0,
        nextLabel: t('disc.next'),
      },
      3: {
        title: t('disc.s3.title'),
        hint: t('disc.s3.hint'),
        html: `
          <div class="disc-chips">
            ${[5,7,10,14,21,30,42,60].map(days => `
              <button class="disc-chip ${this._q.duration===days?'disc-chip-on':''}"
                      onclick="TripDiscovery._pick('duration',${days},this)">${t('disc.d.' + days)}</button>`).join('')}
          </div>`,
        next: () => !!this._q.duration,
        nextLabel: t('disc.next'),
      },
      4: {
        title: t('disc.s4.title'),
        hint: t('disc.s4.hint'),
        html: `
          <div class="disc-chips">
            ${[['🎒','budget'],['🛎️','mid'],['✨','high']].map(([icon,val]) => `
              <button class="disc-chip disc-chip-wide ${this._q.budget===val?'disc-chip-on':''}"
                      onclick="TripDiscovery._pick('budget','${val}',this)">
                <span style="font-size:18px">${icon}</span>
                <span>${t('disc.b.' + val)}</span>
                <span style="font-size:11px;color:var(--text-secondary)">${t('disc.b.' + val + '.sub')}</span>
              </button>`).join('')}
          </div>`,
        next: () => !!this._q.budget,
        nextLabel: t('disc.next'),
      },
      5: {
        title: t('disc.s5.title'),
        hint: t('disc.s5.hint'),
        html: `
          <div class="disc-chips">
            ${[0,1,2,3,4,5,6,7,8,9,10,11].map(i => `
              <button class="disc-chip ${this._q.month===i?'disc-chip-on':''}"
                      onclick="TripDiscovery._pick('month',${i},this)">${t('disc.mon.' + i)}</button>`).join('')}
          </div>`,
        next: () => this._q.month !== null,
        nextLabel: t('disc.suggest'),
      },
    };

    const s = steps[step];
    el.innerHTML = `
      <div class="disc-progress">
        ${[1,2,3,4,5].map(i =>
          `<div class="disc-dot ${i===step?'disc-dot-on':i<step?'disc-dot-done':''}"></div>`
        ).join('')}
      </div>
      <div class="disc-title">${s.title}</div>
      <div class="disc-hint">${s.hint}</div>
      ${s.html}
      <div class="disc-actions">
        ${step > 1 ? `<button class="btn btn-ghost btn-sm" onclick="TripDiscovery._renderStep(${step-1})">${t('disc.back')}</button>` : ''}
        <button class="btn btn-primary disc-next" id="disc-next-btn"
                onclick="TripDiscovery._next(${step})">${s.nextLabel}</button>
      </div>
      <div class="disc-divider"><span>${t('disc.orTemplate')}</span></div>
      <div class="disc-templates">
        ${this.TEMPLATES.map(t => `
          <button class="disc-tpl-btn" onclick="TripDiscovery._useTemplate('${t.id}')">
            <span class="disc-tpl-icon">${t.icon}</span>
            <span class="disc-tpl-label">${window.t('tpl.' + t.id)}</span>
            <span class="disc-tpl-days">${t.days}d</span>
          </button>`).join('')}
      </div>
      <button class="btn btn-ghost btn-sm" style="width:100%;margin-top:12px"
              onclick="TripDiscovery.close()">${t('disc.scratch')}</button>`;
  },

  _toggleStyle(label, btn) {
    const idx = this._q.style.indexOf(label);
    if (idx >= 0) { this._q.style.splice(idx,1); btn.classList.remove('disc-chip-on'); }
    else { this._q.style.push(label); btn.classList.add('disc-chip-on'); }
  },

  _pick(key, val, btn) {
    this._q[key] = val;
    // Save home region permanently
    if (key === 'region') __LS.setItem('home_region', val);
    btn.closest('.disc-chips').querySelectorAll('.disc-chip').forEach(b => b.classList.remove('disc-chip-on'));
    btn.classList.add('disc-chip-on');
  },

  _setCityInput(val) {
    this._q.departureCity = val.trim();
    __LS.setItem('home_departure_city', val.trim());
  },

  _next(step) {
    if (step < 5) { this._renderStep(step + 1); return; }
    // Step 5 complete → call AI
    this._callAI();
  },

  // ── Look up realistic airfare (USD per person) ────────────────
  _airfare(destZone) {
    const origin = this._q.region || 'northam';
    const row    = this._AIRFARE[origin] || this._AIRFARE.northam;
    return row[destZone] || row.sea || 900;
  },

  // ── AI suggestion via Gemini ──────────────────────────────────
  async _callAI() {
    const el = document.getElementById('discovery-panel');
    if (!el) return;
    const regionLabel  = this._regionLabel(this._q.region) || t('disc.r.northam');
    const styleStr = this._q.style.map(id => window.t('disc.st.' + id)).join(', ');
    const budgetStr = window.t('disc.b.' + this._q.budget) + ' (' + window.t('disc.b.' + this._q.budget + '.sub') + ')';
    const monthStr = window.t('disc.mon.' + this._q.month);
    const key = AI.getKey();

    el.innerHTML = `<div class="disc-loading">
      <div class="disc-spinner"></div>
      <div class="disc-loading-text">${t('disc.loading')}</div>
    </div>`;

    if (!key) {
      this._showNoKey();
      return;
    }

    const tmpl = (I18N.DISCOVERY_PROMPT[I18N.lang] || I18N.DISCOVERY_PROMPT.en)
      .replace(/{region}/g, regionLabel).replace('{style}', styleStr)
      .replace('{duration}', this._q.duration).replace('{budget}', budgetStr)
      .replace('{month}', monthStr);
    const schema = `[
  {
    "destination": "City/Region, Country",
    "why": "2-sentence explanation of why it matches their profile",
    "bestFor": "one short phrase",
    "localCurrency": "3-letter code",
    "suggestedName": "Trip name e.g. Bali Beach Dec 2027",
    "roughBudgetUSD": { "flights": number, "accommodations": number, "transport": number, "taxi": number, "food": number, "entertainment": number },
    "highlights": ["activity1","activity2","activity3"]
  }
]`;
    const prompt = tmpl + schema;

    try {
      const text = await AI.generate(key, prompt);
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('No JSON in response');
      const suggestions = JSON.parse(jsonMatch[0]);
      this._showSuggestions(suggestions);
    } catch(e) {
      console.warn('Discovery AI error:', e);
      this._showNoKey(e.message);
    }
  },

  _showNoKey(errorMsg) {
    const el = document.getElementById('discovery-panel');
    if (!el) return;
    const saved = AI.getKey();
    el.innerHTML = `
      <div class="disc-title">✨ Connect AI trip ideas</div>
      ${errorMsg ? `<div class="disc-key-error">⚠️ ${Utils.esc(errorMsg)}</div>` : ''}
      <div class="disc-hint" style="margin-bottom:12px">
        AI answers cost money per question. Rather than charge you, this app uses
        <strong>your own free Google key</strong> — so you only ever spend your own free allowance.
      </div>
      <div class="disc-key-box">
        <label class="form-label" for="disc-key-input">Gemini API key
          <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener"
             class="ai-key-link">Get a free key ↗</a>
        </label>
        <input id="disc-key-input" class="form-input" type="password" placeholder="AIza..."
               autocomplete="off" spellcheck="false" value="${Utils.esc(saved)}">
        <button class="btn btn-secondary btn-full" style="margin-top:8px"
                onclick="AI.saveKey('disc-key-input', () => TripDiscovery._callAI())">💾 Save &amp; continue</button>
        <details class="disc-key-help">
          <summary>Show me how to get the key, step by step</summary>
          <div>
            <ol class="disc-key-steps">
              <li>Tap <strong>Get a free key ↗</strong> above — it opens Google AI Studio.</li>
              <li>Sign in with any Google account. On the first visit Google asks you to accept its
                  terms and confirm your country.</li>
              <li>Click <strong>Create API key</strong>, then choose
                  <strong>Create API key in a new project</strong>.</li>
              <li><strong>Copy the key.</strong> Your new key appears in the list showing only its
                  last few characters. Use the small copy icon at the right of that row — or click the
                  key text itself to open it. This is the step most people get stuck on, because the
                  key is never shown in full on the page.</li>
              <li>Come back here, paste it in the box above, and tap Save &amp; continue.</li>
            </ol>
            <p><strong>&ldquo;Pick or create a project&rdquo; — what project?</strong> Nothing you were
            supposed to have made already. A project is just a folder Google keeps your key in so it can
            count usage. Creating a new one is free, needs no credit card, and you will never open it again.</p>
            <p>Your key stays on this device only. It starts with <code>AIza</code> and is about
            39 characters long.</p>
          </div>
        </details>
      </div>
      <div class="disc-hint" style="margin:18px 0 8px">Or skip this and start from a ready-made budget template:</div>
      <div class="disc-templates">
        ${this.TEMPLATES.map(t => `
          <button class="disc-tpl-btn" onclick="TripDiscovery._useTemplate('${t.id}')">
            <span class="disc-tpl-icon">${t.icon}</span>
            <span class="disc-tpl-label">${window.t('tpl.' + t.id)}</span>
            <span class="disc-tpl-days">${t.days}d</span>
          </button>`).join('')}
      </div>
      <button class="btn btn-ghost btn-sm" style="width:100%;margin-top:12px"
              onclick="TripDiscovery.close()">✕ Plan from scratch instead</button>`;
  },

  _showSuggestions(suggestions) {
    const el = document.getElementById('discovery-panel');
    if (!el) return;

    if (!suggestions || !suggestions.length) {
      // Fallback to templates
      this._showNoKey();
      return;
    }

    el.innerHTML = `
      <div class="disc-title">${t('disc.results.title')}</div>
      <div class="disc-hint">${t('disc.results.hint')}</div>
      <div class="disc-suggestions">
        ${suggestions.map((s,i) => `
          <div class="disc-suggestion" onclick="TripDiscovery._useSuggestion(${i})">
            <div class="disc-sug-header">
              <span class="disc-sug-dest">${s.destination}</span>
              <span class="disc-sug-badge">${s.bestFor}</span>
            </div>
            <div class="disc-sug-why">${s.why}</div>
            <div class="disc-sug-highlights">
              ${(s.highlights||[]).map(h=>`<span class="disc-sug-tag">${h}</span>`).join('')}
            </div>
            <div class="disc-sug-budget">
              ${t('disc.results.est')} $${Object.values(s.roughBudgetUSD||{}).reduce((a,b)=>a+b,0).toLocaleString()} ${t('disc.results.total')} (${s.localCurrency})
            </div>
          </div>`).join('')}
      </div>
      <button class="btn btn-ghost btn-sm" style="width:100%;margin-top:12px"
              onclick="TripDiscovery._renderStep(1)">${t('disc.retry')}</button>
      <button class="btn btn-ghost btn-sm" style="width:100%;margin-top:6px"
              onclick="TripDiscovery.close()">✕ Plan from scratch instead</button>`;

    // Store suggestions for later use
    this._lastSuggestions = suggestions;
  },

  // ── Pre-fill from AI suggestion ───────────────────────────────
  _useSuggestion(idx) {
    const s = this._lastSuggestions?.[idx];
    if (!s) return;
    this.close();
    // Pre-fill trip name, currency, and note destination
    const nameEl = document.getElementById('sf-name');
    const curEl  = document.getElementById('sf-cur');
    if (nameEl) nameEl.value = s.suggestedName || s.destination;
    if (curEl) {
      // Try to set local currency, fall back to USD
      const opt = [...curEl.options].find(o => o.value === s.localCurrency);
      if (opt) curEl.value = s.localCurrency;
    }
    // Store budget suggestions and destination for meaningful labels
    this._pendingBudgets     = s.roughBudgetUSD;
    this._pendingDestination = s.destination;
    this._pendingOrigin = this._q.departureCity || this._REGIONS.find(r => r.id === this._q.region)?.label || '';
    UI.toast(window.t('disc.toast.loaded', { dest: s.destination }), 'success');
  },

  // ── Pre-fill from static template ────────────────────────────
  _useTemplate(id) {
    const t = this.TEMPLATES.find(x => x.id === id);
    if (!t) return;
    this.close();
    const nameEl = document.getElementById('sf-name');
    const curEl  = document.getElementById('sf-cur');
    const paxEl  = document.getElementById('sf-pax');
    if (nameEl) nameEl.value = `${window.t('tpl.' + t.id)} — ${t.destinations[0]}`;
    if (curEl) {
      const opt = [...curEl.options].find(o => o.value === t.currency);
      if (opt) curEl.value = t.currency;
    }
    if (paxEl) paxEl.value = t.pax;

    // Build budgets with origin-adjusted airfare
    const destZone  = this._DEST_ZONE[t.id] || 'sea';
    // Use questionnaire region if set, or fall back to saved home region
    if (!this._q.region) {
      this._q.region = __LS.getItem('home_region') || 'northam';
    }
    const airfare = this._airfare(destZone);
    const budgets = { ...t.budgets, flights: airfare };

    this._pendingBudgets     = budgets;
    this._pendingCurrency    = t.currency;
    this._pendingDestination = t.destinations[0];
    const regionLabel = this._REGIONS.find(r => r.id === this._q.region)?.label || '';
    this._pendingOrigin = this._q.departureCity || regionLabel;
    const airLabel = this._pendingOrigin ? window.t('disc.toast.airfrom', { amt: airfare, origin: this._pendingOrigin }) : '';
    UI.toast(window.t('disc.toast.tplLoaded', { icon: t.icon, name: window.t('tpl.' + t.id), air: airLabel }), 'success');
  },

  // ── Close discovery panel, show normal form ───────────────────
  close() {
    const el = document.getElementById('discovery-panel');
    if (el) el.style.display = 'none';
    const fw = document.getElementById('setup-form-wrap');
    if (fw) fw.style.display = '';
  },
};


// ============================================================
// THEME TOGGLE  (dark ↔ light, persisted in localStorage)
// ============================================================
const ThemeToggle = {
  _KEY: 'theme_pref',

  // Apply saved theme immediately — called before first render to avoid flash
  init() {
    const saved = __LS.getItem(this._KEY) || 'dark';
    this._apply(saved);
  },

  _apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    // Update PWA theme-color meta tag
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === 'light' ? '#f5f0e8' : '#0d1117';
    __LS.setItem(this._KEY, theme);
  },

  current() {
    return document.documentElement.getAttribute('data-theme') || 'dark';
  },

  toggle() {
    this._apply(this.current() === 'dark' ? 'light' : 'dark');
    // Re-render toggle buttons if visible
    document.querySelectorAll('.theme-toggle').forEach(btn => {
      const isDark = this.current() === 'dark';
      btn.querySelector('.theme-toggle-icon').textContent = isDark ? '☀️' : '🌙';
      btn.querySelector('.theme-toggle-label').textContent = isDark ? 'Light' : 'Dark';
      btn.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
    });
  },

  // Returns the HTML for a toggle pill button
  btn() {
    const isDark = this.current() === 'dark';
    return `<button class="theme-toggle" onclick="ThemeToggle.toggle()"
              title="${isDark ? 'Switch to light mode' : 'Switch to dark mode'}">
              <span class="theme-toggle-icon">${isDark ? '☀️' : '🌙'}</span>
              <span class="theme-toggle-label">${isDark ? 'Light' : 'Dark'}</span>
            </button>`;
  },
};

// Apply theme before any render (prevents dark flash on light preference)
ThemeToggle.init();


// ============================================================
// ROUTER
// ============================================================
const Router = {
  current: null,
  stack: [],
  tripId:  null,
  catId:   null,
  itemId:  null,
  txnId:   null,

  go(screenId, params = {}) {
    if (params.catId  !== undefined) this.catId  = params.catId;
    if (params.itemId !== undefined) this.itemId = params.itemId;
    if (params.txnId  !== undefined) this.txnId  = params.txnId;
    if (params.tripId !== undefined) this.tripId = params.tripId;

    // Guard: already on this screen — just re-render
    if (screenId === this.current) {
      try {
        switch (screenId) {
          case 'overview':  Renders.overview();           break;
          case 'itinerary': Renders.itinerary();          break;
          case 'dashboard': Renders.dashboard();          break;
          case 'trips':     Renders.tripList();           break;
          case 'category':  Renders.category(this.catId); break;
        }
      } catch(e) { console.error('Render error (same-screen):', e); }
      return;
    }

    const prev = document.getElementById('screen-' + this.current);
    const next = document.getElementById('screen-' + screenId);
    if (!next) return;

    // Slide outgoing screen back, hide all others
    if (prev && prev !== next) {
      prev.classList.add('slide-back');
      prev.classList.remove('active');
    }
    document.querySelectorAll('.screen').forEach(s => {
      if (s !== prev && s !== next) s.classList.remove('active', 'slide-back');
    });

    // Show new screen (CSS transition fires automatically: opacity 0→1, translateX 100%→0)
    next.classList.remove('slide-back');
    next.classList.add('active');

    if (this.current) this.stack.push(this.current);
    this.current = screenId;

    try {
      switch (screenId) {
        case 'trips':       Renders.tripList();           break;
        case 'overview':    Renders.overview();           break;
        case 'dashboard':   Renders.dashboard();          break;
        case 'category':    Renders.category(this.catId); break;
        case 'itinerary':   Renders.itinerary();          break;
      }
    } catch(e) { console.error('Render error:', e); }
  },

  back() {
    const prev   = this.stack.pop() || 'overview';
    const cur    = document.getElementById('screen-' + this.current);
    const prevEl = document.getElementById('screen-' + prev);

    if (cur)    { cur.classList.remove('active', 'slide-back'); }
    if (prevEl) { prevEl.classList.remove('slide-back'); prevEl.classList.add('active'); }

    this.current = prev;
    try {
      switch (prev) {
        case 'trips':     Renders.tripList();           break;
        case 'overview':  Renders.overview();           break;
        case 'dashboard': Renders.dashboard();          break;
        case 'category':  Renders.category(this.catId); break;
        case 'itinerary': Renders.itinerary();          break;
      }
    } catch(e) { console.error('Render error (back):', e); }
  },
};





// ============================================================
// RENDERS — Screen Content Builders
// ============================================================
const Renders = {
  // ── TRIP LIST ──────────────────────────────────────────────
  tripList() {
    const trips    = TripMgr.all();
    const activeId = Store.activeId();
    const el       = document.getElementById('trips-list');
    const user     = Store.user();

    // Personalise the trips-header greeting
    const hdr = document.getElementById('trips-greeting');
    if (hdr && user?.name) {
      hdr.innerHTML = `
        <div class="greeting-badge">Hi, ${Utils.esc(user.name)}! 👋</div>
        ${user.partnerName ? `<div class="greeting-sub">${t('greet.with', {name: Utils.esc(user.partnerName)})}</div>` : ''}`;
    }

    if (!trips.length) {
      el.innerHTML = `
        <div class="empty-state anim-in">
          <span class="empty-state-icon">🌍</span>
          <h3>${user?.name ? t('trips.ready', {name: Utils.esc(user.name)}) : t('trips.none')}</h3>
          <p>${t('trips.empty.p')}</p>
          <button class="btn btn-primary" onclick="App.goSetup()">${t('trips.create')}</button>
        </div>`;
      return;
    }

    el.innerHTML = `<p class="section-label">${window.t(trips.length === 1 ? 'trips.count' : 'trips.count.p', {n: trips.length})}</p>` +
      trips.map((trip, i) => {
        const budget = BudgetMgr.grandTotal(trip.id);
        const { committed, actual } = TxnMgr.grandTotals(trip.id);
        const spent = committed + actual;
        const pct = budget !== 0 ? Math.min(100, Math.abs(spent / budget) * 100) : 0;
        const du = Utils.daysUntil(trip.startDate);
        const dl = Utils.daysUntil(trip.endDate);
        const isAct = trip.id === activeId;
        let badge = '';
        if (du > 0)      badge = `<span class="trip-badge trip-badge-upcoming">${window.t('trip.awayBadge', {n: du})}</span>`;
        else if (dl >= 0) badge = `<span class="trip-badge trip-badge-active">In Progress</span>`;
        else              badge = `<span class="trip-badge trip-badge-completed">Completed</span>`;

        return `
          <div class="trip-card ${isAct ? 'is-active' : ''} anim-in" style="animation-delay:${i*0.05}s"
               onclick="App.openTrip('${trip.id}')">
            <div class="trip-card-header">
              <div>
                <div class="trip-card-name">${Utils.esc(trip.name)}</div>
                <div class="trip-card-meta">
                  ${Utils.fmtDate(trip.startDate)} → ${Utils.fmtDate(trip.endDate)}<br>
                  ${window.t('trip.meta', {days: trip.totalDays, pax: trip.pax, s: trip.pax !== 1 ? 's' : '', cur: trip.baseCurrency})}
                </div>
              </div>
              ${badge}
            </div>
            <div class="trip-stats">
              <div>
                <div class="trip-stat-label">${window.t('lvl.budget')}</div>
                <div class="trip-stat-value" style="color:#f0c040">${Utils.fmt(budget, trip.baseCurrency)}</div>
              </div>
              <div>
                <div class="trip-stat-label">${window.t('lvl.committed')}</div>
                <div class="trip-stat-value" style="color:#58a6ff">${Utils.fmt(committed, trip.baseCurrency)}</div>
              </div>
              <div>
                <div class="trip-stat-label">${window.t('lvl.actualPaid')}</div>
                <div class="trip-stat-value" style="color:#3fb950">${Utils.fmt(actual, trip.baseCurrency)}</div>
              </div>
            </div>
            ${budget !== 0 ? `<div class="trip-progress-track"><div class="trip-progress-bar" style="width:${pct}%"></div></div>` : ''}
            <div class="trip-card-actions">
              <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();App.openTrip('${trip.id}')">
                ${isAct ? '✓ Active' : 'Open'}
              </button>
              <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();App.goSetup('${trip.id}')">${window.t('trip.edit')}</button>
              <button class="btn btn-clone btn-sm" onclick="event.stopPropagation();App.cloneTrip('${trip.id}','${Utils.esc(trip.name)}')" title="${window.t('trip.cloneTip')}">${window.t('trip.clone')}</button>
              <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();App.deleteTrip('${trip.id}','${Utils.esc(trip.name)}')">${window.t('trip.delete')}</button>
            </div>
          </div>`;
      }).join('');
  },

  // ── OVERVIEW ───────────────────────────────────────────────
  overview() {
    const trip = TripMgr.active();
    // Guard: if no active trip and we're not already on trips screen, navigate there
    if (!trip) {
      if (Router.current !== 'trips') Router.go('trips');
      return;
    }
    const user = Store.user();
    const s = Dash.summary(trip.id);
    const bkdn = Dash.breakdown(trip.id);

    const cPct = s.budget !== 0 ? Math.min(100, Math.abs(s.committed / s.budget) * 100) : 0;
    const aPct = s.budget !== 0 ? Math.min(100, Math.abs(s.actual    / s.budget) * 100) : 0;
    const tPct = cPct + aPct;

    // ── Budget alert: find categories with spending ≥ 80% of budget ──────────
    const atRisk = bkdn.filter(cat =>
      cat.budget > 0 && (cat.spent / cat.budget) >= 0.8
    );
    const overBudget = atRisk.filter(cat => (cat.spent / cat.budget) >= 1.0);
    let alertHtml = '';
    const alertKey = 'budget-alert-dismissed-' + trip.id;
    if (atRisk.length > 0 && !sessionStorage.getItem(alertKey)) {
      const isOver   = overBudget.length > 0;
      const names    = atRisk.map(c => c.label).join(' & ');
      const icon     = isOver ? '🔴' : '⚠️';
      const msg      = isOver
        ? window.t('alert.over', { names })
        : window.t(atRisk.length === 1 ? 'alert.near1' : 'alert.nearN', { names });
      alertHtml = `
        <div class="budget-alert ${isOver ? 'budget-alert-over' : 'budget-alert-warn'}" id="budget-alert-bar">
          <span>${icon} ${msg}</span>
          <button class="budget-alert-close" onclick="sessionStorage.setItem('${alertKey}','1');document.getElementById('budget-alert-bar').remove()" title="Dismiss">×</button>
        </div>`;
    }

    const du = Utils.daysUntil(trip.startDate);
    const dl = Utils.daysUntil(trip.endDate);
    let status = '';
    if (du > 0)      status = `<strong>${du} days until departure</strong>`;
    else if (dl >= 0) status = `<strong style="color:#3fb950">Day ${s.daysElapsed} of ${trip.totalDays} — In Progress</strong>`;
    else              status = `<span>Trip Completed</span>`;

    const greeting = user?.name ? t('greet.hi', {name: Utils.esc(user.name)}) : '';
    const partnerLine = user?.partnerName
      ? `<div style="font-size:11px;color:var(--text-secondary);margin-top:2px">${t('greet.with', {name: Utils.esc(user.partnerName)})}</div>`
      : '';

    document.getElementById('overview-header').innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px">
        <span class="ov-trip-label">${greeting}${t('ov.activeTrip')}</span>
        <div style="display:flex;align-items:center;gap:6px">
          ${ThemeToggle.btn()}
          <button class="btn btn-ghost btn-sm" onclick="Router.go('trips')" style="font-size:11px;padding:3px 10px">Switch ↗</button>
        </div>
      </div>
      ${partnerLine}
      <div class="ov-trip-name anim-in">${Utils.esc(trip.name)}</div>
      <div class="ov-trip-meta">
        ${Utils.fmtDate(trip.startDate)} → ${Utils.fmtDate(trip.endDate)} &nbsp;·&nbsp;
        ${trip.pax} ${window.t(trip.pax === 1 ? 'trip.travelerOne' : 'trip.travelerMany')} &nbsp;·&nbsp; ${trip.baseCurrency}<br>${status}
      </div>
      <div class="health-bar-wrap anim-in anim-d1">
        <div class="hb-header">
          <span class="hb-label">${t('ov.budgetHealth')}</span>
          <span class="hb-pct" style="color:${tPct > 90 ? '#f85149' : tPct > 70 ? '#f97316' : '#3fb950'}">${window.t('ov.pctUsed', {pct: tPct.toFixed(0)})}</span>
        </div>
        <div class="hb-track">
          <div class="hb-bar-committed" style="width:${Math.min(100, cPct + aPct)}%"></div>
          <div class="hb-bar-actual"    style="width:${Math.min(100, aPct)}%"></div>
        </div>
        <div class="hb-legend">
          <div class="legend-item"><div class="legend-dot" style="background:#58a6ff"></div>${t('lvl.committed')}&nbsp;${Utils.fmt(s.committed, trip.baseCurrency)}</div>
          <div class="legend-item"><div class="legend-dot" style="background:#3fb950"></div>${t('lvl.actual')}&nbsp;${Utils.fmt(s.actual, trip.baseCurrency)}</div>
          <div class="legend-item"><div class="legend-dot" style="background:#30363d"></div>${t('lvl.remaining')}&nbsp;${Utils.fmt(s.remaining, trip.baseCurrency)}</div>
        </div>
      </div>`;

    document.getElementById('overview-body').innerHTML = `
      ${alertHtml}
      <div class="section-title" style="margin-top:18px">${t('ov.spendingCats')}</div>
      <div class="cat-grid">
        ${bkdn.map((cat, i) => {
          const usedPct   = cat.budget > 0 ? cat.spent / cat.budget : 0;
          const barColor  = usedPct >= 1.0  ? '#f85149'
                          : usedPct >= 0.8  ? '#f0c040'
                          : 'var(--cc)';
          return `
          <div class="cat-tile anim-in anim-d${Math.min(i+1,6)}" style="--cc:${cat.color}"
               onclick="Router.go('category',{catId:'${cat.id}'})" role="button" tabindex="0">
            <span class="tile-icon">${cat.icon}</span>
            <div class="tile-name">${cat.label}</div>
            <div class="tile-budget" style="color:${cat.budget !== 0 ? (cat.budget < 0 ? '#f97316' : 'var(--text-primary)') : 'var(--text-muted)'}">
              ${cat.budget !== 0 ? Utils.fmt(cat.budget, trip.baseCurrency) : t('tile.noBudget')}
            </div>
            <div class="tile-bar-track"><div class="tile-bar-fill" style="width:${cat.pct}%;background:${barColor}"></div></div>
            <div class="tile-spent">
              ${cat.spent > 0 ? `<b>${Utils.fmt(cat.spent, trip.baseCurrency)}</b> ${t('tile.spent')}` : t('tile.noSpend')}
            </div>
          </div>`;
        }).join('')}
      </div>
      <div class="section-title">${t('sec.totalSummary')}</div>
      <div class="grand-total-card anim-in">
        <div>
          <div class="gtc-label">${t('lvl.budget')}</div>
          <div class="gtc-value" style="color:#f0c040">${Utils.fmt(s.budget, trip.baseCurrency, 0)}</div>
        </div>
        <div style="text-align:center">
          <div class="gtc-label">${t('lvl.committed')}</div>
          <div class="gtc-value" style="color:#58a6ff">${Utils.fmt(s.committed, trip.baseCurrency, 0)}</div>
        </div>
        <div style="text-align:right">
          <div class="gtc-label">${t('lvl.left')}</div>
          <div class="gtc-value" style="color:${s.remaining >= 0 ? '#3fb950' : '#f85149'}">${Utils.fmt(s.remaining, trip.baseCurrency, 0)}</div>
        </div>
      </div>`;
  },

  // ── CATEGORY DETAIL ────────────────────────────────────────
  category(catId) {
    if (!catId) return;
    const trip = TripMgr.active(); if (!trip) return;
    const cat  = CATEGORIES.find(c => c.id === catId); if (!cat) return;
    const b    = BudgetMgr.get(trip.id);
    const items = b[catId];
    const catBudget = BudgetMgr.catTotal(trip.id, catId);
    const { committed, actual } = TxnMgr.catTotals(trip.id, catId);
    const remaining = catBudget - committed - actual;
    const txns = TxnMgr.byCat(trip.id, catId);

    document.getElementById('cat-detail-header').innerHTML = `
      <button class="btn-icon" onclick="Router.back()">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <div class="cat-detail-icon">${cat.icon}</div>
      <div>
        <div class="cat-detail-name">${cat.label}</div>
        <div class="cat-detail-desc">${cat.desc}</div>
      </div>`;

    document.getElementById('cat-summary-row').innerHTML = `
      <div class="summary-row">
        <div class="summary-cell"><div class="sc-label">${t('lvl.budget')}</div><div class="sc-value sc-budget">${Utils.fmt(catBudget, trip.baseCurrency)}</div></div>
        <div class="summary-cell"><div class="sc-label">${t('lvl.committed')}</div><div class="sc-value sc-committed">${Utils.fmt(committed, trip.baseCurrency)}</div></div>
        <div class="summary-cell"><div class="sc-label">${t('lvl.actual')}</div><div class="sc-value sc-actual">${Utils.fmt(actual, trip.baseCurrency)}</div></div>
        <div class="summary-cell"><div class="sc-label">${t('lvl.left')}</div><div class="sc-value sc-remaining ${remaining < 0 ? 'over' : ''}">${Utils.fmt(remaining, trip.baseCurrency)}</div></div>
      </div>`;

    document.getElementById('cat-body').innerHTML = `
      <!-- Budget Items -->
      <div class="section-hdr">
        <span class="section-title">${t('sec.budgetPlan')}</span>
        <button class="btn btn-outline btn-sm" onclick="App.goAddBudgetItem()">+ Add</button>
      </div>
      ${this._budgetItems(trip, catId, items, cat)}

      <!-- Transactions -->
      <div class="section-hdr" style="margin-top:20px">
        <span class="section-title">${t('sec.txns', {n: txns.length})}</span>
        <button class="btn btn-primary btn-sm" onclick="App.goAddTransaction()">+ Add</button>
      </div>
      ${this._transactions(trip, catId, txns)}
      <div style="height:20px"></div>`;
  },

  _budgetItems(trip, catId, items, cat) {
    if (cat.type === 'daily') {
      const item = items;
      if (!item) return `
        <div class="no-items"><div class="no-items-icon">💰</div>No daily budget set</div>
        <div style="padding:0 18px 8px"><button class="btn btn-outline btn-full" onclick="App.goAddBudgetItem()">${t('f.setDaily')}</button></div>`;
      const total = BudgetMgr.itemTotal(item, catId, trip);
      const detail = `${Utils.fmt(item.pricePerPersonPerDay, trip.baseCurrency)}/person/day × ${trip.pax} pax × ${item.days} days`;
      return `
        <div class="bi-card anim-in">
          <div class="bi-info">
            <div class="bi-label">${catId === 'food' ? 'Daily Food & Drinks Budget' : 'Daily Taxi Budget'}</div>
            <div class="bi-detail">${detail}</div>
          </div>
          <div class="bi-amount">${Utils.fmt(total, trip.baseCurrency)}</div>
          <div class="bi-actions">
            <button class="btn-edit" onclick="App.goEditBudgetItem('__daily__')" title="Edit">${SVG.edit}</button>
          </div>
        </div>`;
    }

    if (!items || !items.length)
      return `<div class="no-items"><div class="no-items-icon">📋</div>${t('empty.budget')}</div>`;

    return items.map((item, i) => {
      const total = BudgetMgr.itemTotal(item, catId, trip);
      let detail = '';
      if (catId === 'flights')        detail = `${Utils.fmt(item.pricePerPax, trip.baseCurrency)}/pax × ${trip.pax}${item.departDate ? ' · ' + Utils.fmtDate(item.departDate) : ''}`;
      else if (catId === 'accommodations') detail = `${Utils.fmt(item.pricePerRoom, trip.baseCurrency)}/room/night × ${item.nights} nights${item.dateIn ? ' · in ' + Utils.fmtDate(item.dateIn) : ''}`;
      else if (catId === 'transport') detail = `${item.type} · ${Utils.fmt(item.pricePerPax, trip.baseCurrency)}/pax × ${trip.pax}${item.departDate ? ' · ' + Utils.fmtDate(item.departDate) : ''}`;
      else if (catId === 'entertainment') detail = `${Utils.fmt(item.pricePerPerson, trip.baseCurrency)}/person × ${trip.pax} pax`;
      return `
        <div class="bi-card anim-in" style="animation-delay:${i*0.04}s">
          <div class="bi-info">
            <div class="bi-label">${Utils.esc(item.label || item.name || 'Item')}</div>
            <div class="bi-detail">${detail}</div>
          </div>
          <div class="bi-amount">${Utils.fmt(total, trip.baseCurrency)}</div>
          <div class="bi-actions">
            <button class="btn-edit" onclick="App.goEditBudgetItem('${item.id}')" title="Edit">${SVG.edit}</button>
            <button class="btn-del"  onclick="App.deleteBudgetItem('${item.id}')" title="Delete">${SVG.del}</button>
          </div>
        </div>`;
    }).join('');
  },

  _transactions(trip, catId, txns) {
    if (!txns.length)
      return `<div class="no-items"><div class="no-items-icon">🧾</div>${t('empty.txns')}</div>`;
    return txns.map((txn, i) => `
      <div class="txn-card anim-in" style="animation-delay:${i*0.03}s">
        <div class="txn-dot ${txn.status}"></div>
        <div class="txn-info">
          <div class="txn-desc">${Utils.esc(txn.description || 'Transaction')}</div>
          <div class="txn-meta">
            ${Utils.fmtDate(txn.date)}
            <span class="txn-badge ${txn.status}">${txn.status === 'committed' ? t('f.committed') : t('f.actual')}</span>
          </div>
        </div>
        <div class="txn-right">
          <div class="txn-amount">${Utils.fmt(txn.amount, txn.currency)}</div>
          ${txn.currency !== trip.baseCurrency
            ? `<div class="txn-amount-base">≈ ${Utils.fmt(txn.amountInBase, trip.baseCurrency)}</div>` : ''}
        </div>
        <div class="txn-actions">
          <button class="btn-edit" onclick="App.goEditTransaction('${txn.id}')" title="Edit">${SVG.edit}</button>
          <button class="btn-del"  onclick="App.deleteTransaction('${txn.id}')" title="Delete">${SVG.del}</button>
        </div>
      </div>`).join('');
  },

  // ── BUDGET ITEM FORM ───────────────────────────────────────
  budgetItemForm(catId, itemId) {
    const trip = TripMgr.active(); if (!trip) return;
    const cat  = CATEGORIES.find(c => c.id === catId);
    const b    = BudgetMgr.get(trip.id);
    const existing = (itemId && itemId !== '__daily__')
      ? (Array.isArray(b[catId]) ? b[catId].find(x => x.id === itemId) : null)
      : (itemId === '__daily__' ? b[catId] : null);

    document.getElementById('bi-title').textContent =
      window.t(existing ? 'f.editBudget' : 'f.addBudget', { cat: cat.label });

    let fields = '';
    switch (catId) {
      case 'flights': fields = `
        <div class="form-group">
          <label class="form-label" for="bi-label">${t('f.flightDesc')}</label>
          <input id="bi-label" class="form-input" type="text" placeholder="${t('ph.flightDesc')}" value="${Utils.esc(existing?.label || '')}">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="bi-depart">${t('f.departDate')}</label>
            <input id="bi-depart" class="form-input" type="date" value="${existing?.departDate || trip.startDate}">
          </div>
          <div class="form-group">
            <label class="form-label" for="bi-return">${t('f.returnDate')}</label>
            <input id="bi-return" class="form-input" type="date" value="${existing?.returnDate || trip.endDate}">
          </div>
        </div>
        <div class="form-group">
          <div class="label-with-ai">
            <label class="form-label" for="bi-price">${t('f.pricePP.cur')} (${trip.baseCurrency}) <span class="req">*</span></label>
            <button class="btn-ai" type="button" onclick="App.showAIPriceGuide('flights')">${t('ai.guideBtn')}</button>
          </div>
          <input id="bi-price" class="form-input" type="number" step="0.01" placeholder="e.g. 1200" value="${existing?.pricePerPax || ''}">
          <div class="form-hint">${window.t('hint.groupTotal', {pax: trip.pax, trav: trip.pax === 1 ? window.t('trip.travelerOne') : window.t('trip.travelerMany')})}</div>
        </div>`; break;

      case 'accommodations': fields = `
        <div class="form-group">
          <label class="form-label" for="bi-label">${t('f.hotelName')}</label>
          <input id="bi-label" class="form-input" type="text" placeholder="${t('ph.hotelName')}" value="${Utils.esc(existing?.label || '')}">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="bi-date-in">${t('f.checkIn')}</label>
            <input id="bi-date-in" class="form-input" type="date" value="${existing?.dateIn || trip.startDate}">
          </div>
          <div class="form-group">
            <label class="form-label" for="bi-date-out">${t('f.checkOut')}</label>
            <input id="bi-date-out" class="form-input" type="date" value="${existing?.dateOut || trip.endDate}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <div class="label-with-ai">
              <label class="form-label" for="bi-price">${t('f.priceRoom.cur')} (${trip.baseCurrency}) <span class="req">*</span></label>
              <button class="btn-ai" type="button" onclick="App.showAIPriceGuide('accommodations')">${t('ai.guideBtn')}</button>
            </div>
            <input id="bi-price" class="form-input" type="number" step="0.01" placeholder="e.g. 150" value="${existing?.pricePerRoom || ''}">
          </div>
          <div class="form-group">
            <label class="form-label" for="bi-nights">${t('f.nights')} <span class="req">*</span></label>
            <input id="bi-nights" class="form-input" type="number" min="1" placeholder="e.g. 5" value="${existing?.nights || ''}">
          </div>
        </div>`; break;

      case 'transport': fields = `
        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="bi-type">${t('f.type')}</label>
            <select id="bi-type" class="form-select">
              <option value="Bus"              ${existing?.type==='Bus'              ? 'selected':''}>🚌 Bus</option>
              <option value="Rail / Train"      ${existing?.type==='Rail / Train'      ? 'selected':''}>🚂 Rail / Train</option>
              <option value="Private Car"       ${existing?.type==='Private Car'       ? 'selected':''}>🚗 Private Car / Hire</option>
              <option value="Ferries / Boat"    ${existing?.type==='Ferries / Boat'    ? 'selected':''}>⛴️ Ferries / Boat</option>
              <option value="Shuttle / Transfer"${existing?.type==='Shuttle / Transfer'? 'selected':''}>🚐 Shuttle / Transfer</option>
              <option value="Domestic Flight"   ${existing?.type==='Domestic Flight'   ? 'selected':''}>🛫 Domestic Flight</option>
              <option value="Other"             ${existing?.type==='Other'             ? 'selected':''}>🚘 Other</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="bi-depart">Date</label>
            <input id="bi-depart" class="form-input" type="date" value="${existing?.departDate || ''}">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label" for="bi-label">${t('f.route')}</label>
          <input id="bi-label" class="form-input" type="text" placeholder="${t('ph.route')}" value="${Utils.esc(existing?.label || '')}">
        </div>
        <div class="form-group">
          <div class="label-with-ai">
            <label class="form-label" for="bi-price">${t('f.pricePP.cur')} (${trip.baseCurrency}) <span class="req">*</span></label>
            <button class="btn-ai" type="button" onclick="App.showAIPriceGuide('transport')">${t('ai.guideBtn')}</button>
          </div>
          <input id="bi-price" class="form-input" type="number" step="0.01" placeholder="e.g. 30" value="${existing?.pricePerPax || ''}">
          <div class="form-hint">${window.t('hint.groupTotal', {pax: trip.pax, trav: trip.pax === 1 ? window.t('trip.travelerOne') : window.t('trip.travelerMany')})}</div>
        </div>`; break;

      case 'taxi':
      case 'food': fields = `
        <div class="form-group">
          <div class="label-with-ai">
            <label class="form-label" for="bi-price">${t('f.dailyPP.cur')} (${trip.baseCurrency}) <span class="req">*</span></label>
            <button class="btn-ai" type="button" onclick="App.showAIPriceGuide('${catId}')">${t('ai.guideBtn')}</button>
          </div>
          <input id="bi-price" class="form-input" type="number" step="0.01"
            placeholder="${catId === 'food' ? 'e.g. 60' : 'e.g. 15'}" value="${existing?.pricePerPersonPerDay || ''}">
          <div class="form-hint">${window.t('hint.perDayGroup', {pax: trip.pax, trav: trip.pax === 1 ? window.t('trip.travelerOne') : window.t('trip.travelerMany')})}</div>
        </div>
        <div class="form-group">
          <label class="form-label" for="bi-days">${t('f.numDays')} <span class="req">*</span></label>
          <input id="bi-days" class="form-input" type="number" min="1" placeholder="${trip.totalDays}"
            value="${existing?.days || trip.totalDays}">
          <div class="form-hint">Trip duration is ${trip.totalDays} days</div>
        </div>`; break;

      case 'entertainment': fields = `
        <div class="form-group">
          <label class="form-label" for="bi-label">${t('f.event')}</label>
          <input id="bi-label" class="form-input" type="text" placeholder="${t('ph.event')}" value="${Utils.esc(existing?.label || '')}">
        </div>
        <div class="form-group">
          <label class="form-label" for="bi-event-date">${t('f.dateOpt')}</label>
          <input id="bi-event-date" class="form-input" type="date" value="${existing?.eventDate || ''}">
        </div>
        <div class="form-group">
          <div class="label-with-ai">
            <label class="form-label" for="bi-price">${t('f.pricePP.cur')} (${trip.baseCurrency}) <span class="req">*</span></label>
            <button class="btn-ai" type="button" onclick="App.showAIPriceGuide('entertainment')">${t('ai.guideBtn')}</button>
          </div>
          <input id="bi-price" class="form-input" type="number" step="0.01" placeholder="${t('ph.amountNeg')}" value="${existing?.pricePerPerson || ''}">
          <div class="form-hint">${window.t('hint.groupTotal', {pax: trip.pax, trav: trip.pax === 1 ? window.t('trip.travelerOne') : window.t('trip.travelerMany')})} &nbsp;·&nbsp; <em>${window.t('hint.negTip')}</em></div>
        </div>`; break;
    }

    document.getElementById('bi-form').innerHTML = `
      ${fields}
      <div class="calc-total">
        <div class="calc-total-label">${t('f.calcTotal')}</div>
        <div class="calc-total-value" id="calc-val">—</div>
      </div>
      <button class="btn btn-primary btn-full" id="bi-save-btn"
        onclick="App.saveBudgetItem('${catId}','${itemId || ''}')">
        ${existing ? t('f.saveChanges') : t('f.addToBudget')}
      </button>`;

    setTimeout(() => UI.initDatePickers('bi-form'), 50);
    this._wireBiCalc(catId, trip);
  },

  _wireBiCalc(catId, trip) {
    const upd = () => {
      let total = 0;
      const p = parseFloat(document.getElementById('bi-price')?.value) || 0;
      if (catId === 'flights' || catId === 'transport')  total = p * trip.pax;
      else if (catId === 'accommodations') total = p * (parseInt(document.getElementById('bi-nights')?.value) || 0);
      else if (catId === 'taxi' || catId === 'food')     total = p * trip.pax * (parseInt(document.getElementById('bi-days')?.value) || 0);
      else if (catId === 'entertainment')                total = p * trip.pax;
      const el = document.getElementById('calc-val');
      if (el) el.textContent = Utils.fmt(total, trip.baseCurrency);
    };
    setTimeout(() => {
      document.querySelectorAll('#bi-form .form-input, #bi-form .form-select').forEach(el => el.addEventListener('input', upd));
      upd();
    }, 30);
  },

  // ── TRANSACTION FORM ───────────────────────────────────────
  transactionForm(catId, txnId) {
    const trip = TripMgr.active(); if (!trip) return;
    const existing = txnId ? TxnMgr.all(trip.id).find(t => t.id === txnId) : null;
    const defCat   = catId || existing?.category || CATEGORIES[0].id;
    // For new transactions: use last-used currency for this trip; fall back to base currency
    const lastCur  = __LS.getItem('txn_cur_' + trip.id);
    const defCur   = existing?.currency || lastCur || trip.baseCurrency;
    const defStat  = existing?.status   || 'actual';

    document.getElementById('txn-title').textContent = window.t(existing ? 'txn.editTitle' : 'txn.newTitle');

    document.getElementById('txn-form').innerHTML = `
      <div class="form-group">
        <label class="form-label" for="tf-cat">${t('f.category')}</label>
        <select id="tf-cat" class="form-select">${UI.catOpts(defCat)}</select>
      </div>
      <div class="form-group">
        <label class="form-label" for="tf-desc">${t('f.description')} <span class="req">*</span></label>
        <input id="tf-desc" class="form-input" type="text" placeholder="${t('ph.desc')}" value="${Utils.esc(existing?.description || '')}">
      </div>
      <div class="form-group">
        <label class="form-label" for="tf-date">Date <span class="req">*</span></label>
        <input id="tf-date" class="form-input" type="date" value="${existing?.date || Utils.today()}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="tf-amt">${t('f.amount')} <span class="req">*</span></label>
          <input id="tf-amt" class="form-input" type="number" step="0.01" placeholder="0.00" value="${existing?.amount || ''}">
        </div>
        <div class="form-group">
          <label class="form-label" for="tf-cur">${t('f.currency')}</label>
          <select id="tf-cur" class="form-select">${UI.currOpts(defCur)}</select>
        </div>
      </div>
      <div class="form-group" id="rate-group" style="${defCur === trip.baseCurrency ? 'display:none' : ''}">
        <label class="form-label" for="tf-rate">${t('f.exchRate')} <span class="req">*</span>
          <span id="rate-badge" class="rate-badge">fetching…</span>
        </label>
        <input id="tf-rate" class="form-input" type="number" min="0" step="0.000001" value="${existing?.exchangeRate || 1}">
        <div class="form-hint" id="rate-hint">How many <b>${defCur}</b> = 1 <b>${trip.baseCurrency}</b></div>
      </div>
      <div class="currency-preview">
        <span class="currency-preview-label">= ${trip.baseCurrency}</span>
        <span class="currency-preview-value" id="tf-preview">—</span>
      </div>
      <div class="form-group" style="margin-top:16px">
        <label class="form-label">${t('f.status')}</label>
        <div class="status-toggle">
          <button class="status-btn ${defStat==='committed' ? 'on-committed' : ''}" id="s-committed"
            onclick="App.toggleStatus('committed')">${t('st.committedBtn')}</button>
          <button class="status-btn ${defStat==='actual' ? 'on-actual' : ''}" id="s-actual"
            onclick="App.toggleStatus('actual')">${t('st.actualBtn')}</button>
        </div>
        <div class="form-hint mt-4">${t('st.explain')}</div>
        <input type="hidden" id="tf-status" value="${defStat}">
      </div>
      <div class="form-group">
        <label class="form-label" for="tf-notes">${t('f.notesOpt')}</label>
        <textarea id="tf-notes" class="form-textarea" placeholder="${t('ph.notes')}">${Utils.esc(existing?.notes || '')}</textarea>
      </div>
      <button class="btn btn-primary btn-full" onclick="App.saveTransaction('${txnId || ''}')">
        ${existing ? t('f.saveChanges') : t('f.addTxn')}
      </button>`;

    setTimeout(() => UI.initDatePickers('txn-form'), 50);
    this._wireTxnCalc(trip);
  },

  _wireTxnCalc(trip) {
    const upd = () => {
      const amt  = parseFloat(document.getElementById('tf-amt')?.value)  || 0;
      const cur  = document.getElementById('tf-cur')?.value;
      const rate = parseFloat(document.getElementById('tf-rate')?.value) || 1;
      const conv = cur === trip.baseCurrency ? amt : amt / rate;
      const el   = document.getElementById('tf-preview');
      if (el) el.textContent = Utils.fmt(conv, trip.baseCurrency);
      const rg = document.getElementById('rate-group');
      if (rg) rg.style.display = cur === trip.baseCurrency ? 'none' : '';
      const rh = document.getElementById('rate-hint');
      if (rh) rh.innerHTML = `How many <b>${cur}</b> = 1 <b>${trip.baseCurrency}</b>`;
    };

    // Auto-fill live rate when currency dropdown changes
    const autoFillRate = (cur) => {
      if (cur === trip.baseCurrency) return;
      const liveRate = ExchangeRates.getRate(cur, trip.baseCurrency);
      const rateEl   = document.getElementById('tf-rate');
      const badge    = document.getElementById('rate-badge');
      if (liveRate && rateEl) {
        rateEl.value = liveRate.toFixed(6);
        if (badge) {
          badge.textContent = '🟢 Live · ' + ExchangeRates.updatedLabel();
          badge.style.color = '#3fb950';
        }
        upd();
      } else if (badge) {
        badge.textContent = '⚠️ Enter rate manually';
        badge.style.color = '#f0c040';
      }
    };

    // Pre-fetch rates silently in background — fill field when data arrives
    ExchangeRates.prefetch(trip.baseCurrency).then(() => {
      const curEl = document.getElementById('tf-cur');
      if (curEl && curEl.value !== trip.baseCurrency) autoFillRate(curEl.value);
    });

    setTimeout(() => {
      const curEl = document.getElementById('tf-cur');
      ['tf-amt', 'tf-rate'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', upd);
        document.getElementById(id)?.addEventListener('change', upd);
      });
      curEl?.addEventListener('input',  () => { autoFillRate(curEl.value); upd(); });
      curEl?.addEventListener('change', () => { autoFillRate(curEl.value); upd(); });
      // Try to auto-fill immediately (works if rates were already cached)
      if (curEl && curEl.value !== trip.baseCurrency) autoFillRate(curEl.value);
      upd();
    }, 30);
  },

  // ── DASHBOARD ──────────────────────────────────────────────
  dashboard() {
    const trip = TripMgr.active(); if (!trip) { Router.go('trips'); return; }
    ChartMgr.destroy();
    const s    = Dash.summary(trip.id);
    const bkdn = Dash.breakdown(trip.id);
    const rem  = s.remaining;

    document.getElementById('dashboard-body').innerHTML = `
      <div class="dash-cards">
        <div class="dash-card d-budget anim-in">
          <div class="dash-card-label">${t('lvl.total')}</div>
          <div class="dash-card-value" style="color:#f0c040">${Utils.fmt(s.budget, trip.baseCurrency, 0)}</div>
          <div class="dash-card-sub">${window.t('dash.pax', {days: trip.totalDays, pax: trip.pax})}</div>
        </div>
        <div class="dash-card d-committed anim-in anim-d1">
          <div class="dash-card-label">${t('lvl.committed')}</div>
          <div class="dash-card-value" style="color:#58a6ff">${Utils.fmt(s.committed, trip.baseCurrency, 0)}</div>
          <div class="dash-card-sub">${t('dash.booked')}</div>
        </div>
        <div class="dash-card d-actual anim-in anim-d2">
          <div class="dash-card-label">${t('lvl.actualPaid')}</div>
          <div class="dash-card-value" style="color:#3fb950">${Utils.fmt(s.actual, trip.baseCurrency, 0)}</div>
          <div class="dash-card-sub">${t('dash.cashOut')}</div>
        </div>
        <div class="dash-card d-remaining ${rem < 0 ? 'over' : ''} anim-in anim-d3">
          <div class="dash-card-label">${t('lvl.remaining')}</div>
          <div class="dash-card-value" style="color:${rem >= 0 ? '#3fb950' : '#f85149'}">${Utils.fmt(Math.abs(rem), trip.baseCurrency, 0)}</div>
          <div class="dash-card-sub">${rem >= 0 ? t('dash.under') : t('dash.over')}</div>
        </div>
      </div>

      <div class="chart-wrap anim-in anim-d2">
        <div class="chart-title">${t('chart.byCat')}</div>
        <div class="chart-canvas-wrap"><canvas id="chart-bar"></canvas></div>
      </div>

      <div class="chart-wrap anim-in anim-d3">
        <div class="chart-title">${t('chart.distribution')}</div>
        <div class="chart-canvas-wrap-s" id="donut-wrapper"><canvas id="chart-donut"></canvas></div>
      </div>

      <div class="bkdn-table anim-in anim-d4">
        <div class="bkdn-head">
          <div>${t('bkdn.category')}</div>
          <div>${t('lvl.budget')}</div>
          <div>${t('lvl.actual')}</div>
          <div>${t('lvl.remaining')}</div>
        </div>
        ${bkdn.map(c => `
          <div class="bkdn-row" onclick="Router.go('category',{catId:'${c.id}'})">
            <div class="bkdn-cat"><div class="bkdn-dot" style="background:${c.color}"></div>${c.label}</div>
            <div class="bkdn-num bkdn-budget">${Utils.fmt(c.budget, trip.baseCurrency, 0)}</div>
            <div class="bkdn-num bkdn-actual">${Utils.fmt(c.spent, trip.baseCurrency, 0)}</div>
            <div class="bkdn-num ${c.remaining >= 0 ? 'bkdn-var-pos' : 'bkdn-var-neg'}">${Utils.fmt(Math.abs(c.remaining), trip.baseCurrency, 0)}</div>
          </div>`).join('')}
        <div class="bkdn-row total-row">
          <div class="bkdn-cat"><div class="bkdn-dot" style="background:#f0c040"></div>${t('bkdn.total')}</div>
          <div class="bkdn-num bkdn-budget">${Utils.fmt(s.budget, trip.baseCurrency, 0)}</div>
          <div class="bkdn-num bkdn-actual">${Utils.fmt(s.committed + s.actual, trip.baseCurrency, 0)}</div>
          <div class="bkdn-num ${rem >= 0 ? 'bkdn-var-pos' : 'bkdn-var-neg'}">${Utils.fmt(Math.abs(rem), trip.baseCurrency, 0)}</div>
        </div>
      </div>`;

    setTimeout(() => {
      ChartMgr.renderBar(bkdn, trip.baseCurrency);
      ChartMgr.renderDonut(bkdn, trip.baseCurrency);
    }, 80);
  },

  // ── SETUP FORM ─────────────────────────────────────────────
  setupForm(tripId) {
    const trip = tripId ? TripMgr.byId(tripId) : null;
    const isEdit = !!trip;
    document.getElementById('setup-title').textContent = window.t(isEdit ? 'trip.editTitle' : 'trip.newTitle');

    document.getElementById('setup-form').innerHTML = `
      <div class="form-group">
        <label class="form-label" for="sf-name">${t('f.tripName')} <span class="req">*</span></label>
        <input id="sf-name" class="form-input" type="text" placeholder="${t('ph.tripName')}" value="${Utils.esc(trip?.name || '')}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="sf-start">${t('f.startDate')} <span class="req">*</span></label>
          <input id="sf-start" class="form-input" type="date" value="${trip?.startDate || ''}">
        </div>
        <div class="form-group">
          <label class="form-label" for="sf-end">${t('f.endDate')} <span class="req">*</span></label>
          <input id="sf-end" class="form-input" type="date" value="${trip?.endDate || ''}">
        </div>
      </div>
      <div id="days-preview" class="form-hint mb-8" style="min-height:18px;color:#3fb950">${trip ? window.t('days.count', {n: trip.totalDays}) : ''}</div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="sf-pax">${t('f.travelers')} <span class="req">*</span></label>
          <input id="sf-pax" class="form-input" type="number" min="1" max="99" placeholder="${t('ph.pax')}" value="${trip?.pax || ''}">
          <div class="form-hint">${t('f.numPeople')}</div>
        </div>
        <div class="form-group">
          <label class="form-label" for="sf-cur">${t('f.baseCurrency')} <span class="req">*</span></label>
          <select id="sf-cur" class="form-select">${UI.currOpts(trip?.baseCurrency || 'USD')}</select>
        </div>
      </div>
      <div class="form-divider"></div>
      <button class="btn btn-primary btn-full" onclick="App.saveTrip('${tripId || ''}')">
        ${isEdit ? t('f.saveChanges') : t('f.createTrip')}
      </button>
      ${isEdit ? `<button class="btn btn-ghost btn-full mt-8" onclick="Router.back()">${t('f.cancel')}</button>` : ''}`;

    setTimeout(() => UI.initDatePickers('setup-form'), 50);
    // Wire up days preview
    const upd = () => {
      const s = document.getElementById('sf-start')?.value;
      const e = document.getElementById('sf-end')?.value;
      const el = document.getElementById('days-preview');
      if (!s || !e || !el) return;
      const d = Utils.daysBetween(s, e);
      el.textContent = d > 0 ? `📅 ${d} day${d !== 1 ? 's' : ''}` : 'End date must be after start date';
      el.style.color = d > 0 ? '#3fb950' : '#f85149';
    };
    setTimeout(() => {
      document.getElementById('sf-start')?.addEventListener('change', upd);
      document.getElementById('sf-end')?.addEventListener('change', upd);
    }, 30);
  },

  // ── ITINERARY ──────────────────────────────────────────────
  itinerary() {
    const trip = TripMgr.active();
    if (!trip) { Router.go('trips'); return; }
    const events = Itinerary.build(trip.id);
    const body = document.getElementById('itinerary-body');
    if (!body) return;

    if (!events.length) {
      body.innerHTML = `
        <div class="itin-empty">
          <div class="itin-empty-icon">🗺️</div>
          <h3>No itinerary yet</h3>
          <p>Add dates to your budget items (flights, hotels, transport, activities) and they'll appear here automatically.<br><br>Tap <strong>+ Note</strong> to add free-form entries.</p>
        </div>`;
      return;
    }

    // Group events by date
    const byDate = {};
    events.forEach(e => { if (!byDate[e.date]) byDate[e.date] = []; byDate[e.date].push(e); });
    const dates = Object.keys(byDate).sort();
    const tripStart = new Date(trip.startDate + 'T00:00:00');

    body.innerHTML = dates.map((date, di) => {
      const d = new Date(date + 'T00:00:00');
      const dayNum = Math.round((d - tripStart) / 86400000) + 1;
      const inTrip = dayNum >= 1 && dayNum <= trip.totalDays;
      return `
        <div class="itin-day anim-in" style="animation-delay:${di * 0.06}s">
          <div class="itin-day-header">
            <div class="itin-day-date">${Utils.fmtDate(date)}</div>
            ${inTrip ? `<div class="itin-day-tag">Day ${dayNum}</div>` : ''}
          </div>
          <div class="itin-events">
            ${byDate[date].map(e => `
              <div class="itin-event">
                <div class="itin-event-dot" style="background:${e.color}"></div>
                <div class="itin-event-card ${e.type === 'note' ? 'is-note' : ''}">
                  <div class="itin-event-icon">${e.icon}</div>
                  <div class="itin-event-info">
                    <div class="itin-event-title">${Utils.esc(e.title)}</div>
                    ${e.detail ? `<div class="itin-event-detail">${Utils.esc(e.detail)}</div>` : ''}
                  </div>
                  ${e.type === 'note' ? `<button class="btn-del" onclick="App.deleteNote('${e.noteId}')" title="Delete note">${SVG.del}</button>` : ''}
                </div>
              </div>`).join('')}
          </div>
        </div>`;
    }).join('');
  },
};


// ============================================================
// APP — High-level actions & navigation
// ============================================================
const App = {
  // Navigation helpers
  _push(screenId) {
    const prev = Router.current;
    const prevEl = document.getElementById('screen-' + prev);
    const nextEl = document.getElementById('screen-' + screenId);
    if (prevEl && prevEl !== nextEl) { prevEl.classList.add('slide-back'); prevEl.classList.remove('active'); }
    document.querySelectorAll('.screen').forEach(s => { if (s !== prevEl && s !== nextEl) s.classList.remove('active','slide-back'); });
    if (nextEl) { nextEl.classList.remove('slide-back'); nextEl.classList.add('active'); }
    if (prev) Router.stack.push(prev);
    Router.current = screenId;
  },

  // ── DATA EXPORT / IMPORT ──────────────────────────────────
  exportData() {
    const trips = Store.trips();
    const payload = {
      exportedAt:  new Date().toISOString(),
      appVersion:  '1.1',
      exportDevice: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
      trips,
      activeId:    Store.activeId(),
      user:        Store.user(),
      budgets: {}, txns: {}, notes: {},
    };
    trips.forEach(t => {
      payload.budgets[t.id] = Store.budgets(t.id);
      payload.txns[t.id]    = Store.txns(t.id);
      payload.notes[t.id]   = Store.notes(t.id);
    });

    const json     = JSON.stringify(payload, null, 2);
    const blob     = new Blob([json], { type: 'application/json' });
    const url      = URL.createObjectURL(blob);
    const dateStr  = new Date().toISOString().slice(0, 10);
    const a        = document.createElement('a');
    a.href         = url;
    a.download     = `trip-budget-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);

    UI.toast(`✅ Exported ${trips.length} trip(s) — save to Google Drive or OneDrive`, 'success');
  },

  importData() {
    const inp    = document.createElement('input');
    inp.type     = 'file';
    inp.accept   = '.json,application/json';
    inp.style.display = 'none';
    document.body.appendChild(inp);

    inp.onchange = async () => {
      const file = inp.files[0];
      document.body.removeChild(inp);
      if (!file) return;

      try {
        const text = await file.text();
        const d    = JSON.parse(text);

        if (!d.trips || !Array.isArray(d.trips)) {
          UI.toast(t('toast.badBackup'), 'error');
          return;
        }

        const exportedOn = d.exportedAt
          ? new Date(d.exportedAt).toLocaleString()
          : 'unknown date';

        ImportDiff.show(
          ImportDiff.build(d), file.name, exportedOn,
          () => {
            // Wipe existing localStorage data
            const keysToRemove = [];
            for (let i = 0; i < __LS.length; i++) {
              const k = __LS.key(i);
              if (k && k.startsWith('tbd_')) keysToRemove.push(k);
            }
            keysToRemove.forEach(k => __LS.removeItem(k));

            // Hydrate from imported JSON
            RemoteStore._loading = true;
            Store.saveTrips(d.trips);
            if (d.activeId) Store.setActive(d.activeId);
            if (d.user)     Store.saveUser(d.user);
            Object.entries(d.budgets || {}).forEach(([id, b]) => Store.saveBudgets(id, b));
            Object.entries(d.txns    || {}).forEach(([id, t]) => Store.saveTxns(id, t));
            Object.entries(d.notes   || {}).forEach(([id, n]) => Store.saveNotes(id, n));
            RemoteStore._loading = false;
            RemoteStore.schedule();  // push to server if running

            UI.toast(`✅ ${d.trips.length} trip(s) imported!`, 'success');

            // Navigate to the right screen
            const activeId = Store.activeId();
            if (d.trips.length > 0 && activeId && TripMgr.byId(activeId)) {
              Router.go('overview');
            } else {
              Router.go('trips');
            }
          }
        );
      } catch(e) {
        UI.toast('❌ Failed to read file: ' + e.message, 'error');
      }
    };

    inp.click();
  },

  // ── WELCOME SCREEN ────────────────────────────────────────

  togglePartner() {
    const sw  = document.getElementById('partner-sw');
    const grp = document.getElementById('wf-partner-group');
    if (!sw) return;
    sw.classList.toggle('on');
    if (grp) grp.style.display = sw.classList.contains('on') ? '' : 'none';
  },

  completeWelcome() {
    const name = document.getElementById('wf-name')?.value.trim();
    if (!name) { UI.toast(t('toast.needName'), 'error'); return; }
    const cb          = document.getElementById('partner-cb');
    const sw          = document.getElementById('partner-sw');
    const hasPartner  = (cb && cb.checked) || (sw && sw.classList.contains('on')) || false;
    const partnerName = hasPartner
      ? (document.getElementById('wf-partner')?.value.trim() || '')
      : '';

    Store.saveUser({ name, partnerName, setupAt: new Date().toISOString() });

    // Slide welcome out, then show trips
    const ws = document.getElementById('screen-welcome');
    ws.classList.add('slide-back');
    ws.classList.remove('active');
    const trips = document.getElementById('screen-trips');
    trips.classList.remove('slide-back');
    trips.classList.add('active');
    Router.stack = [];
    Router.current = 'trips';
    Renders.tripList();
    UI.toast(`Welcome aboard, ${name}! ✈️`, 'success');
  },

  goSetup(tripId = '') {
    this._push('setup');
    if (!tripId) {
      // New trip: show discovery choice first
      Renders.setupForm(null);
      document.getElementById('setup-title').textContent = window.t('trip.newTitle');
      TripDiscovery.open();
    } else {
      // Editing existing trip: go straight to form
      TripDiscovery.close();
      Renders.setupForm(tripId);
    }
  },

  // ── Navigate to welcome screen as a returning user ────────────
  goWelcome() {
    const ws = document.getElementById('screen-welcome');
    const ts = document.getElementById('screen-trips');
    if (!ws) return;
    // Show "← Back" button, hide the name-entry form (user is already set up)
    const back = document.getElementById('btn-welcome-back');
    const letsGo = document.getElementById('btn-lets-go');
    const form  = document.querySelector('.welcome-form');
    if (back)   back.style.display = 'block';
    if (letsGo) letsGo.style.display = 'none';
    if (form)   form.style.display   = 'none';
    // Animate transition
    if (ts) { ts.classList.add('slide-back'); ts.classList.remove('active'); }
    ws.classList.remove('slide-back');
    ws.classList.add('active');
    Router.stack.push('trips');
    Router.current = 'welcome';
  },

  // ── Exit / close the app window ──────────────────────────────
  exitApp() {
    // Works in PWA standalone mode and windows opened by script.
    // In a regular browser tab the browser ignores window.close().
    const closed = (() => { try { window.close(); return true; } catch(_) { return false; } })();
    // Give the browser a moment; if still open, show a helpful note
    setTimeout(() => {
      if (!document.hidden) {
        UI.toast(t('toast.exitHint'), 'info');
      }
    }, 300);
  },


  goEditTrip() {
    const trip = TripMgr.active();
    if (!trip) { UI.toast(t('toast.noTrip'), 'error'); return; }
    this.goSetup(trip.id);
  },

  saveTrip(tripId) {
    const name  = document.getElementById('sf-name')?.value.trim();
    const start = document.getElementById('sf-start')?.value;
    const end   = document.getElementById('sf-end')?.value;
    const pax   = parseInt(document.getElementById('sf-pax')?.value);
    const cur   = document.getElementById('sf-cur')?.value;

    if (!name)              { UI.toast(t('toast.needTripName'), 'error');         return; }
    if (!start || !end)     { UI.toast(t('toast.needRange'), 'error');   return; }
    if (end <= start)       { UI.toast(t('toast.badDates'), 'error');return; }
    if (!pax || pax < 1)   { UI.toast(t('toast.needPax'), 'error'); return; }

    if (tripId) {
      TripMgr.update(tripId, { name, startDate: start, endDate: end, pax, baseCurrency: cur });
      UI.toast(t('toast.tripUpdated'), 'success');
    } else {
      const newTrip = TripMgr.create({ name, startDate: start, endDate: end, pax, baseCurrency: cur });
      TripMgr.setActive(newTrip.id);

      // ── Apply pending template / AI discovery budgets ────────
      if (TripDiscovery._pendingBudgets) {
        const budgetCur = TripDiscovery._pendingCurrency || cur;
        const dest    = TripDiscovery._pendingDestination || name;
        const days    = Math.max(1, Utils.daysBetween(start, end));
        const paxN    = pax || 1;
        const origin = TripDiscovery._pendingOrigin || '';
        const catLabel = {
          flights:        origin ? `${origin} → ${dest}` : dest,
          accommodations: `Hotel – ${dest}`,
          transport:      `Local transport – ${dest}`,
          taxi:           `Taxi – ${dest}`,
          food:           `Meals & drinks – ${dest}`,
          entertainment:  `Activities – ${dest}`,
        };
        Object.entries(TripDiscovery._pendingBudgets).forEach(([catId, amount]) => {
          if (!amount) return;
          // Build the right field structure that BudgetMgr.itemTotal() expects per category
          let data = { label: catLabel[catId] || dest, currency: budgetCur, exchangeRate: 1 };
          if (catId === 'flights') {
            // Airfare amount is per-person round-trip — store directly as pricePerPax
            // so itemTotal = pricePerPax × pax scales correctly for groups
            data.pricePerPax = +amount.toFixed(2);
          } else if (catId === 'accommodations') {
            data.pricePerRoom = +(amount / Math.max(1, days)).toFixed(2);
            data.nights = days;
          } else if (catId === 'transport') {
            data.pricePerPax = +(amount / paxN).toFixed(2);
          } else if (catId === 'taxi') {
            // Taxi is a shared cost — divide by days only, not pax
            data.pricePerPersonPerDay = +(amount / days).toFixed(2);
            data.days = days;
          } else if (catId === 'food') {
            data.pricePerPersonPerDay = +(amount / paxN / days).toFixed(2);
            data.days = days;
          } else if (catId === 'entertainment') {
            data.pricePerPerson = +(amount / paxN).toFixed(2);
          }
          BudgetMgr.addItem(newTrip.id, catId, data);
        });
        TripDiscovery._pendingBudgets     = null;
        TripDiscovery._pendingCurrency    = null;
        TripDiscovery._pendingDestination = null;
        TripDiscovery._pendingOrigin      = null;
        UI.toast(t('toast.templateApplied'), 'success');
      } else {
        UI.toast(t('toast.tripCreated'), 'success');
      }
    }
    Router.back();
  },

  openTrip(tripId) {
    TripMgr.setActive(tripId);
    Router.go('overview');
    // Silently pre-warm exchange rates for this trip's base currency
    const trip = TripMgr.byId(tripId);
    if (trip?.baseCurrency) ExchangeRates.prefetch(trip.baseCurrency);
  },

  // ── AI PRICE GUIDE ────────────────────────────────────────
  showAIPriceGuide(catId) {
    const ctx = {
      label: document.getElementById('bi-label')?.value.trim() || '',
      date:  document.getElementById('bi-depart')?.value
          || document.getElementById('bi-date-in')?.value
          || document.getElementById('bi-event-date')?.value || '',
      type:  document.getElementById('bi-type')?.value || '',
    };
    AI.showPopup(catId, ctx);
  },

  // ── ITINERARY NOTES ───────────────────────────────────────
  openNoteForm() {
    const trip = TripMgr.active(); if (!trip) return;
    document.getElementById('note-date').value = Utils.today();
    document.getElementById('note-text').value = '';
    document.getElementById('note-overlay').classList.remove('hidden');
    setTimeout(() => UI.initDatePickers('note-overlay'), 30);
  },
  closeNote()  { document.getElementById('note-overlay').classList.add('hidden'); },
  saveNote() {
    const trip = TripMgr.active(); if (!trip) return;
    const date = document.getElementById('note-date').value;
    const text = document.getElementById('note-text').value.trim();
    if (!date) { UI.toast(t('toast.selectDate'), 'error'); return; }
    if (!text) { UI.toast(t('toast.needNote'),  'error'); return; }
    const notes = Store.notes(trip.id);
    notes.push({ id: Utils.uuid(), date, text, createdAt: new Date().toISOString() });
    Store.saveNotes(trip.id, notes);
    this.closeNote();
    Renders.itinerary();
    UI.toast(t('toast.noteAdded'), 'success');
  },
  deleteNote(noteId) {
    const trip = TripMgr.active(); if (!trip) return;
    UI.confirm(t('ask.delNote'), () => {
      Store.saveNotes(trip.id, Store.notes(trip.id).filter(n => n.id !== noteId));
      Renders.itinerary();
      UI.toast(t('toast.noteDeleted'));
    });
  },

  cloneTrip(tripId, name) {
    const copy = TripMgr.clone(tripId);
    if (!copy) { UI.toast(t('toast.cloneFailed'), 'error'); return; }
    UI.toast(`"‌${name}" cloned — tap Edit to rename it ↗`, 'success');
    Renders.tripList();
  },

  deleteTrip(tripId, name) {
    UI.confirm(`Delete "‌${name}"? All budget data and transactions will be permanently removed.`, () => {
      TripMgr.delete(tripId);
      UI.toast(t('toast.tripDeleted'));
      Renders.tripList();
    });
  },

  goAddBudgetItem() {
    const catId = Router.catId; if (!catId) return;
    this._push('budget-item');
    Router.itemId = null;
    Renders.budgetItemForm(catId, null);
  },

  goEditBudgetItem(itemId) {
    const catId = Router.catId; if (!catId) return;
    this._push('budget-item');
    Router.itemId = itemId;
    Renders.budgetItemForm(catId, itemId);
  },

  saveBudgetItem(catId, itemId) {
    const trip = TripMgr.active(); if (!trip) return;
    let data = {};
    try {
      const p = parseFloat(document.getElementById('bi-price')?.value);
      switch (catId) {
        case 'flights':
          if (!p) { UI.toast(t('toast.needPricePP'), 'error'); return; }
          data = { label: document.getElementById('bi-label')?.value.trim() || 'Flight',
            pricePerPax: p,
            departDate: document.getElementById('bi-depart')?.value || '',
            returnDate:  document.getElementById('bi-return')?.value || '' }; break;
        case 'accommodations':
          if (!p) { UI.toast(t('toast.needPriceRoom'), 'error'); return; }
          const n = parseInt(document.getElementById('bi-nights')?.value);
          if (!n) { UI.toast(t('toast.needNights'), 'error'); return; }
          data = { label: document.getElementById('bi-label')?.value.trim() || 'Accommodation',
            pricePerRoom: p, nights: n,
            dateIn:  document.getElementById('bi-date-in')?.value || '',
            dateOut: document.getElementById('bi-date-out')?.value || '' }; break;
        case 'transport':
          if (!p) { UI.toast(t('toast.needPricePP'), 'error'); return; }
          data = { type:  document.getElementById('bi-type')?.value || 'Bus',
            label: document.getElementById('bi-label')?.value.trim() || 'Transport',
            pricePerPax: p,
            departDate: document.getElementById('bi-depart')?.value || '' }; break;
        case 'taxi': case 'food':
          if (!p) { UI.toast(t('toast.needDaily'), 'error'); return; }
          data = { pricePerPersonPerDay: p,
            days: parseInt(document.getElementById('bi-days')?.value) || trip.totalDays }; break;
        case 'entertainment':
          if (!p) { UI.toast(t('toast.needPricePP'), 'error'); return; }
          data = { label: document.getElementById('bi-label')?.value.trim() || 'Activity',
            pricePerPerson: p,
            eventDate: document.getElementById('bi-event-date')?.value || '' }; break;
      }
    } catch { UI.toast(t('toast.needFields'), 'error'); return; }

    if (itemId && itemId !== '__daily__') {
      BudgetMgr.updateItem(trip.id, catId, itemId, data);
      UI.toast(t('toast.budgetUpdated'), 'success');
    } else if (itemId === '__daily__') {
      const b = BudgetMgr.get(trip.id); b[catId] = { ...data, id: '__daily__' };
      Store.saveBudgets(trip.id, b);
      UI.toast(t('toast.budgetUpdated'), 'success');
    } else {
      BudgetMgr.addItem(trip.id, catId, data);
      UI.toast(t('toast.budgetAdded'), 'success');
    }
    Router.back();
  },

  deleteBudgetItem(itemId) {
    const trip = TripMgr.active(); if (!trip) return;
    UI.confirm(t('ask.delBudget'), () => {
      BudgetMgr.deleteItem(trip.id, Router.catId, itemId);
      UI.toast(t('toast.deleted'));
      Renders.category(Router.catId);
    });
  },

  goAddTransaction() {
    this._push('transaction');
    Router.txnId = null;
    Renders.transactionForm(Router.catId, null);
  },

  goEditTransaction(txnId) {
    this._push('transaction');
    Router.txnId = txnId;
    Renders.transactionForm(Router.catId, txnId);
  },

  toggleStatus(status) {
    document.getElementById('tf-status').value = status;
    document.getElementById('s-committed').className = `status-btn ${status === 'committed' ? 'on-committed' : ''}`;
    document.getElementById('s-actual').className    = `status-btn ${status === 'actual'    ? 'on-actual'    : ''}`;
  },

  saveTransaction(txnId) {
    const trip = TripMgr.active(); if (!trip) return;
    const cat  = document.getElementById('tf-cat')?.value;
    const desc = document.getElementById('tf-desc')?.value.trim();
    const date = document.getElementById('tf-date')?.value;
    const amt  = parseFloat(document.getElementById('tf-amt')?.value);
    const cur  = document.getElementById('tf-cur')?.value;
    const rate = parseFloat(document.getElementById('tf-rate')?.value) || 1;
    const stat = document.getElementById('tf-status')?.value;
    const notes= document.getElementById('tf-notes')?.value.trim();

    if (!desc)        { UI.toast(t('toast.needDesc'), 'error');   return; }
    if (!date)        { UI.toast(t('toast.needDate'), 'error');           return; }
    if (!amt || amt <= 0) { UI.toast(t('toast.badAmount'), 'error'); return; }

    const data = { category: cat, description: desc, date, amount: amt, currency: cur, exchangeRate: rate, status: stat, notes };
    if (txnId) {
      TxnMgr.update(trip.id, txnId, data);
      UI.toast(t('toast.txnUpdated'), 'success');
    } else {
      TxnMgr.add(trip.id, data);
      // Remember this currency for the next transaction in this trip
      __LS.setItem('txn_cur_' + trip.id, cur);
      UI.toast(t('toast.txnAdded'), 'success');
    }
    Router.back();
  },

  deleteTransaction(txnId) {
    const trip = TripMgr.active(); if (!trip) return;
    UI.confirm(t('ask.delTxn'), () => {
      TxnMgr.delete(trip.id, txnId);
      UI.toast(t('toast.deleted'));
      Renders.category(Router.catId);
    });
  },
};

// ============================================================
// INIT  — welcome screen is visible by default from HTML;
//          JS immediately switches to the right screen.
// ============================================================
document.addEventListener('DOMContentLoaded', () => {

  // ── iOS Quick Look / Mail WebView detection ───────────────────────────────
  // When mobile.html is opened from email or Files app on iPhone, it runs in
  // Apple's Quick Look or a sandboxed WebView (file:// URL, no real browser).
  // In this mode, button taps don't fire JavaScript — only native text inputs work.
  // Detect this and show a guidance banner telling the user to open in Safari.
  var isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  var isFileURL = location.protocol === 'file:';
  if (isIOS && isFileURL) {
    var banner = document.getElementById('ios-safari-banner');
    if (banner) banner.style.display = 'block';
  }

  // ── iOS Quick Look: capture name across GET form reload ───────────────────
  // Strategy A – setInterval polls input every 300ms, writes to __LS.
  // Timers are browser-internal and fire even when user-event listeners are blocked.
  var _pollTimer = null;  // removed: 300ms localStorage polling (failed workaround)

  // Strategy B – URL params: form now uses action="#screen-trips", so after
  // submission the URL is: mobile.html?wf_name=Vy#screen-trips
  // location.search = ?wf_name=Vy, location.hash = #screen-trips
  var _iosWfName = '';
  var _iosWfPartner = '';
  var _iosWfPname = '';
  try {
    var _sp = new URLSearchParams(window.location.search);
    _iosWfName    = (_sp.get('wf_name')        || '').trim();
    _iosWfPartner = (_sp.get('wf_partner')     || '');
    _iosWfPname   = (_sp.get('wf_partner_name')|| '').trim();
    if (!_iosWfName) _iosWfName  = (__LS.getItem('_ios_wf_name')  || '').trim();
    if (!_iosWfPname) _iosWfPname = (__LS.getItem('_ios_wf_pname') || '').trim();
  } catch(e) {}

  var _iosWelcomeDone = false;
  if (_iosWfName) {
    // Name found — mark welcome done FIRST, before attempting storage writes.
    // This ensures we navigate to trips even if localStorage is blocked in Quick Look.
    _iosWelcomeDone = true;
    try {
      var _hasP = _iosWfPartner === 'on';
      Store.saveUser({ name: _iosWfName, partnerName: _hasP ? _iosWfPname : '', setupAt: new Date().toISOString() });
      try { __LS.removeItem('_ios_wf_name'); } catch(e) {}
      try { __LS.removeItem('_ios_wf_pname'); } catch(e) {}
      try {
        if (window.history && window.history.replaceState)
          window.history.replaceState(null, '', window.location.pathname || '.');
      } catch(e) {}
      clearInterval(_pollTimer);
    } catch(e) { console.warn('iOS saveUser failed (continuing anyway):', e); }
  }

  // ── Welcome form: desktop wiring ─────────────────────────────────────────
  // On desktop, prevent the GET form from reloading the page at all.
  var _wfForm = document.getElementById('welcome-form');
  if (_wfForm) {
    _wfForm.addEventListener('submit', function(e) {
      e.preventDefault();
      App.completeWelcome();
    });
  }
  // Sync native checkbox with JS toggle state on desktop
  var _partnerCb = document.getElementById('partner-cb');
  if (_partnerCb) {
    _partnerCb.addEventListener('change', function() {
      var on = _partnerCb.checked;
      var sw = document.getElementById('partner-sw');
      var grp = document.getElementById('wf-partner-group');
      if (sw) sw.classList.toggle('on', on);
      if (grp) grp.style.display = on ? 'block' : 'none';
    });
  }
  // Back button (returning users)
  var _backBtn = document.getElementById('btn-welcome-back');
  if (_backBtn) {
    _backBtn.addEventListener('click', function(e) {
      e.preventDefault();
      Router.go('trips');
    });
  }

  // screen-welcome already has class="active" in the HTML, so
  // something is ALWAYS visible even before this handler fires.
  Router.current = 'welcome';

  // Detect if this page load came from a GET form submission with a name
  var _hashIsTrips = false; // no longer used (CSS :target removed)

  // ── Hash-triggered navigation (CSS :target fired, or JS found name) ───────
  // This block is in its own try/catch so a render crash here does NOT
  // fall back to the welcome screen (which would fight the CSS :target).
  if (_iosWelcomeDone || _hashIsTrips) {
    try {
      var _sw = document.getElementById('screen-welcome');
      var _st = document.getElementById('screen-trips');
      if (_sw) { _sw.classList.remove('active'); _sw.classList.remove('slide-back'); }
      if (_st) { _st.classList.add('active'); }
      Router.current = 'trips';
      Renders.tripList();
    } catch(e) {
      // tripList crashed — at least keep router consistent with what CSS shows
      Router.current = 'trips';
      console.warn('tripList render error:', e.message || e);
    }
  } else {
    // Normal desktop/Safari initialization path
    try {
      const user     = Store.user();
      const trips    = TripMgr.all();
      const activeId = Store.activeId();

      if (!user && trips.length === 0) {
        // No data — stay on welcome screen (already showing)
      } else if (trips.length > 0 && activeId && TripMgr.byId(activeId)) {
        // Returning user with active trip → go straight to overview
        document.getElementById('screen-welcome').classList.remove('active');
        document.getElementById('screen-overview').classList.add('active');
        Router.current = 'overview';
        Renders.overview();
      } else {
        // Has trips but no active trip → show trip list
        document.getElementById('screen-welcome').classList.remove('active');
        document.getElementById('screen-trips').classList.add('active');
        Router.current = 'trips';
        Renders.tripList();
      }
    } catch(e) {
      // Any error → stay on welcome screen as safe fallback
      console.warn('Init error (welcome screen shown as fallback):', e.message || e);
      Router.current = 'welcome';
    }
  }

  // ── Background server check (non-blocking) ───────────────────
  setTimeout(async () => {
    try {
      const hasServer = await RemoteStore.ping();

      const dot = document.getElementById('sync-dot');
      if (dot) {
        dot.classList.add(hasServer ? 'connected' : 'portable');
        dot.title = hasServer
          ? '🔒 Server sync active — data saved to disk'
          : '📱 Portable mode — use Export/Import for persistence';
      }

      const banner = document.getElementById('portable-banner');
      if (banner && !hasServer) banner.classList.remove('hidden');

      if (!hasServer) return;

      const d = await RemoteStore.loadAll();
      if (!d || !Object.keys(d).length) return;

      RemoteStore._loading = true;
      if (Array.isArray(d.trips))  Store.saveTrips(d.trips);
      if (d.activeId)              Store.setActive(d.activeId);
      if (d.user)                  Store.saveUser(d.user);
      Object.entries(d.budgets || {}).forEach(([id, b]) => Store.saveBudgets(id, b));
      Object.entries(d.txns    || {}).forEach(([id, t]) => Store.saveTxns(id, t));
      Object.entries(d.notes   || {}).forEach(([id, n]) => Store.saveNotes(id, n));
      RemoteStore._loading = false;

      const sTrips    = Store.trips();
      const sActiveId = Store.activeId();
      if (sTrips.length > 0 && sActiveId && TripMgr.byId(sActiveId)) {
        if (Router.current === 'welcome' || Router.current === 'trips') {
          Router.go('overview');
        } else {
          try {
            switch (Router.current) {
              case 'overview':  Renders.overview();           break;
              case 'dashboard': Renders.dashboard();          break;
              case 'itinerary': Renders.itinerary();          break;
              case 'category':  Renders.category(Router.catId); break;
            }
          } catch(e2) { /* silent */ }
        }
      }
    } catch(e) { console.warn('Background sync error:', e.message || e); }
  }, 50);
});

// Redraw JS-rendered views when the language changes.
window.addEventListener('languagechange-app', () => {
  try {
    if (typeof Renders !== 'undefined' && Router && Router.current) Router.go(Router.current);
    if (typeof Renders !== 'undefined' && Renders.header) Renders.header();
  } catch (e) { console.warn('Re-render after language change failed:', e); }
});
