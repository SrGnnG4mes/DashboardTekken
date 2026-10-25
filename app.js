// Dashboard de Tekken 8 — lê data/battles.json e data/profile.json
// (gerados pelo GitHub Action) e desenha tudo no navegador.

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const state = { account: null, type: '', sort: 'games', q: '', char: '', res: '', shown: 30 };
let ALL = [];
let PROFILES = [];

const fmtDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const fmtDay = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });
const fmtNum = new Intl.NumberFormat('pt-BR');
const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });

function ago(iso) {
  if (!iso) return '—';
  const s = (new Date(iso) - Date.now()) / 1000;
  const units = [['year', 31536e3], ['month', 2592e3], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [u, sec] of units) if (Math.abs(s) >= sec) return rtf.format(Math.round(s / sec), u);
  return 'agora há pouco';
}
const signedFmt = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + fmtNum.format(Math.abs(n));
const pct = (w, n) => (n ? Math.round((w / n) * 100) : 0);

async function load() {
  const [b, p] = await Promise.all([
    fetch('data/battles.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : { battles: [] })),
    fetch('data/profile.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : { accounts: [] })).catch(() => ({ accounts: [] })),
  ]);
  ALL = (b.battles ?? []).filter((x) => x.date).sort((a, c) => a.date.localeCompare(c.date)); // mais antiga → mais recente
  PROFILES = p.accounts ?? [];
  const prevTp = new Map();
  for (const x of ALL) {
    const tp = x.me.tekkenPower;
    const prev = prevTp.get(x.account);
    x.me.tpDelta = tp != null && prev != null ? tp - prev : null;
    if (tp != null) prevTp.set(x.account, tp);
  }
  $('#sample').hidden = !b.sample;
  $('#updated').textContent = ago(b.updatedAt);
  $('#updated').title = b.updatedAt ? fmtDate.format(new Date(b.updatedAt)) : '';

  // Ordem das contas = ordem do profile.json (a primeira de TEKKEN_IDS é a principal).
  const order = PROFILES.map((x) => x.account);
  const rank = (a) => (order.includes(a) ? order.indexOf(a) : order.length);
  const accounts = [...new Set(ALL.map((x) => x.account))].sort((a, c) => rank(a) - rank(c) || a.localeCompare(c));
  state.account = accounts[0] ?? 'all';
  buildAccounts(accounts);
  buildTypes();
  buildCharFilter();
  render();
}

// ---------- seleção ----------

const scoped = () => ALL.filter((b) => (state.account === 'all' || b.account === state.account) && (!state.type || b.type === state.type));
const profileFor = (acc) => PROFILES.find((p) => p.account === acc) ?? PROFILES[0];

// "PAC | BushinFRV" → { prefix: 'PAC', tag: 'BushinFRV' }
function splitName(name) {
  const m = String(name ?? '').match(/^(.+?)\s*\|\s*(.+)$/);
  return m ? { prefix: m[1], tag: m[2] } : { prefix: '', tag: String(name ?? '') };
}

function accountLabel(acc, i) {
  const last = [...ALL].reverse().find((b) => b.account === acc);
  const p = profileFor(acc);
  const name = last?.me.name ?? (p?.account === acc ? p.name : undefined);
  return name ? splitName(name).tag : `Conta ${i + 1}`;
}
function mode(arr) {
  const m = new Map();
  for (const x of arr) m.set(x, (m.get(x) ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1])[0]?.[0];
}

function buildAccounts(accounts) {
  const nav = $('#accounts');
  if (accounts.length < 2) { nav.hidden = true; return; }
  const opts = [...accounts.map((a, i) => [a, accountLabel(a, i)]), ['all', 'Todas']];
  nav.innerHTML = opts.map(([v, l]) => `<button type="button" data-acc="${esc(v)}" aria-pressed="${v === state.account}">${esc(l)}</button>`).join('');
  nav.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    state.account = btn.dataset.acc;
    state.shown = 30;
    nav.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b === btn));
    buildCharFilter();
    render();
  });
}

function buildTypes() {
  const nav = $('#types');
  const types = [...new Set(ALL.map((b) => b.type))].sort((a, c) => (a === 'Ranqueada' ? -1 : c === 'Ranqueada' ? 1 : a.localeCompare(c)));
  if (types.length < 2) { nav.hidden = true; return; }
  const short = { 'Ranqueada': 'Ranqueadas', 'Partida de sala': 'Sala', 'Partida rápida': 'Rápidas', 'Partida em grupo': 'Grupo' };
  const opts = [['', 'Todas'], ...types.map((t) => [t, short[t] ?? t])];
  nav.innerHTML = opts.map(([v, l]) => `<button type="button" data-type="${esc(v)}" aria-pressed="${v === state.type}">${esc(l)}</button>`).join('');
  nav.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    state.type = btn.dataset.type;
    state.shown = 30;
    nav.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b === btn));
    buildCharFilter();
    render();
  });
}

function buildCharFilter() {
  const sel = $('#filters select[name=char]');
  const chars = [...new Set(scoped().map((b) => b.opp.char))].sort((a, b) => a.localeCompare(b));
  if (!chars.includes(state.char)) state.char = '';
  sel.innerHTML = '<option value="">Todos os personagens</option>' +
    chars.map((c) => `<option ${c === state.char ? 'selected' : ''}>${esc(c)}</option>`).join('');
}

// ---------- render ----------

function render() {
  const list = scoped();
  renderHero(list);
  renderStrip(list);
  renderStats(list);
  renderChart(list);
  renderMatchups(list);
  renderHistory(list);
}

function renderHero(list) {
  const acc = state.account === 'all' ? (PROFILES[0]?.account ?? list.at(-1)?.account) : state.account;
  const p = profileFor(acc);
  const last = [...list].reverse().find((b) => b.account === acc) ?? list[list.length - 1];
  const { prefix, tag } = splitName(last?.me.name ?? p?.name ?? 'BushinFRV');
  $('#gamertag').textContent = tag;
  $('#prefix').textContent = prefix;
  $('#prefix').hidden = !prefix;
  $('#rank').textContent = last?.me.dan ?? p?.dan ?? '—';
  $('#main').textContent = last?.me.char ?? p?.main ?? '—';
  document.title = `${$('#gamertag').textContent} no Tekken 8`;
}

function renderStrip(list) {
  const recent = list.slice(-80);
  const strip = $('#strip');
  $('#form-n').textContent = recent.length;
  strip.classList.remove('ready');
  strip.innerHTML = recent.map((b, i) => {
    const margin = b.me.rounds != null && b.opp.rounds != null ? Math.abs(b.me.rounds - b.opp.rounds) : null;
    const h = margin == null ? 60 : 34 + (Math.min(margin, 3) / 3) * 66;
    return `<div class="bar ${b.win ? 'w' : 'l'}" data-i="${list.length - recent.length + i}" style="--i:${i}"><i style="height:${(h / 2).toFixed(1)}%"></i></div>`;
  }).join('');
  const w = recent.filter((b) => b.win).length;
  strip.setAttribute('aria-label', `Últimas ${recent.length} partidas: ${w} vitórias e ${recent.length - w} derrotas.`);
  requestAnimationFrame(() => strip.classList.add('ready'));
  strip.onmousemove = (e) => {
    const bar = e.target.closest('.bar');
    if (!bar) return hideTip();
    const b = list[+bar.dataset.i];
    showTip(e, `<b>${b.win ? 'Vitória' : 'Derrota'}</b> contra ${esc(b.opp.name)}<br>${esc(b.opp.char)}, ${esc(b.opp.dan ?? '')}<br>${roundsText(b)}<br>${fmtDate.format(new Date(b.date))}`);
  };
  strip.onmouseleave = hideTip;
}

function renderStats(list) {
  const n = list.length;
  const w = list.filter((b) => b.win).length;
  // sequência atual
  let streak = 0;
  const lastWin = list[n - 1]?.win;
  for (let i = n - 1; i >= 0 && list[i].win === lastWin; i--) streak++;
  // melhor sequência de vitórias
  let best = 0, run = 0;
  for (const b of list) { run = b.win ? run + 1 : 0; best = Math.max(best, run); }
  const last = list[n - 1];
  const tp = state.account !== 'all' ? last?.me.tekkenPower : null;

  const items = [
    ['Partidas', n],
    ['Aproveitamento', `${pct(w, n)}%<small>${w}V ${n - w}D</small>`],
    ['Sequência atual', n ? `${streak}<small>${lastWin ? (streak === 1 ? 'vitória' : 'vitórias') : (streak === 1 ? 'derrota' : 'derrotas')}</small>` : '—'],
    ['Melhor sequência', `${best}<small>vitórias</small>`],
  ];
  if (tp != null) items.splice(1, 0, ['Tekken Power', fmtNum.format(tp)]);
  $('#stats').innerHTML = items.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
}

function roundsText(b) {
  return b.me.rounds != null && b.opp.rounds != null ? `${b.me.rounds}–${b.opp.rounds} em rounds` : '';
}

// ---------- gráfico de Tekken Power ----------

let chartObserver;
function renderChart(list) {
  const box = $('#chart');
  const pts = list
    .filter((b) => b.me.tekkenPower != null)
    .map((b) => ({ b, y: b.me.tekkenPower, t: new Date(b.date).getTime() }));

  if (state.account === 'all' || pts.length < 2) {
    box.innerHTML = `<p class="chart-empty">${state.account === 'all' ? 'Escolha uma conta acima para ver a evolução do Tekken Power.' : 'Ainda não há partidas suficientes para o gráfico.'}</p>`;
    return;
  }

  const draw = () => {
    const W = Math.max(300, box.clientWidth);
    const H = Math.round(Math.min(320, Math.max(220, W * 0.42)));
    const m = { t: 22, r: 12, b: 28, l: 62 };
    const ys = pts.map((p) => p.y);
    let lo = Math.min(...ys), hi = Math.max(...ys);
    const step = niceStep((hi - lo) / 4 || 10);
    lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
    if (lo === hi) hi = lo + step;
    const x = (i) => m.l + (i / (pts.length - 1)) * (W - m.l - m.r);
    const y = (v) => m.t + (1 - (v - lo) / (hi - lo)) * (H - m.t - m.b);

    const ticks = [];
    for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(v);
    const xt = [0, Math.floor((pts.length - 1) / 3), Math.floor((2 * (pts.length - 1)) / 3), pts.length - 1];
    const peakI = ys.indexOf(Math.max(...ys));
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join('');

    box.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Tekken Power de ${fmtNum.format(ys[0])} para ${fmtNum.format(ys.at(-1))} em ${pts.length} partidas; pico de ${fmtNum.format(ys[peakI])}.">
        <g class="grid">${ticks.map((v) => `<line x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/>`).join('')}</g>
        <g class="axis">
          ${ticks.map((v) => `<text x="${m.l - 8}" y="${y(v) + 4}" text-anchor="end">${fmtNum.format(v)}</text>`).join('')}
          ${xt.map((i, k) => {
            const label = fmtDay.format(pts[i].t);
            if (k > 0 && label === fmtDay.format(pts[xt[k - 1]].t)) return '';
            return `<text x="${x(i)}" y="${H - 6}" text-anchor="${k === 0 ? 'start' : k === xt.length - 1 ? 'end' : 'middle'}">${label}</text>`;
          }).join('')}
        </g>
        <path class="line" d="${d}"/>
        <text class="peak" x="${x(peakI)}" y="${y(ys[peakI]) - 9}" text-anchor="${peakI > pts.length * 0.85 ? 'end' : peakI < pts.length * 0.15 ? 'start' : 'middle'}">pico ${fmtNum.format(ys[peakI])}</text>
        <line class="cross" y1="${m.t}" y2="${H - m.b}" visibility="hidden"/>
        <circle class="dot" r="5" visibility="hidden"/>
        <rect x="${m.l}" y="0" width="${W - m.l - m.r}" height="${H}" fill="transparent"/>
      </svg>
      <dl class="chart-sum">
        <div><dt>Primeira registrada</dt><dd>${fmtNum.format(ys[0])}</dd></div>
        <div><dt>Pico</dt><dd>${fmtNum.format(ys[peakI])}</dd></div>
        <div><dt>Variação no período</dt><dd>${signedFmt(ys.at(-1) - ys[0])}</dd></div>
      </dl>`;

    const svg = $('svg', box), cross = $('.cross', box), dot = $('.dot', box);
    svg.onmousemove = (e) => {
      const r = svg.getBoundingClientRect();
      const px = ((e.clientX - r.left) / r.width) * W;
      const i = Math.max(0, Math.min(pts.length - 1, Math.round(((px - m.l) / (W - m.l - m.r)) * (pts.length - 1))));
      const p = pts[i];
      cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.setAttribute('visibility', 'visible');
      dot.setAttribute('cx', x(i)); dot.setAttribute('cy', y(p.y)); dot.setAttribute('visibility', 'visible');
      showTip(e, `<b>${fmtNum.format(p.y)}</b>${p.b.me.tpDelta != null ? ` (${signedFmt(p.b.me.tpDelta)})` : ''}<br>${p.b.win ? 'Vitória' : 'Derrota'} contra ${esc(p.b.opp.name)}, ${esc(p.b.opp.char)}<br>${fmtDate.format(p.t)}`);
    };
    svg.onmouseleave = () => { cross.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); hideTip(); };
  };

  draw();
  chartObserver?.disconnect();
  chartObserver = new ResizeObserver(() => draw());
  chartObserver.observe(box);
}

function niceStep(raw) {
  const p = 10 ** Math.floor(Math.log10(raw));
  const f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}

// ---------- matchups ----------

function renderMatchups(list) {
  const map = new Map();
  for (const b of list) {
    const m = map.get(b.opp.char) ?? { char: b.opp.char, n: 0, w: 0 };
    m.n++; if (b.win) m.w++;
    map.set(b.opp.char, m);
  }
  let rows = [...map.values()];
  if (state.sort === 'worst') {
    rows = rows.filter((r) => r.n >= 3).sort((a, b) => a.w / a.n - b.w / b.n || b.n - a.n);
  } else {
    rows.sort((a, b) => b.n - a.n || b.w / b.n - a.w / a.n);
  }
  const ol = $('#mu-list');
  if (!rows.length) {
    ol.innerHTML = `<li><span class="mu-name">${state.sort === 'worst' ? 'Precisa de pelo menos 3 partidas contra o mesmo personagem.' : 'Sem partidas ainda.'}</span></li>`;
    return;
  }
  ol.innerHTML = rows.map((r) => `
    <li>
      <span class="mu-name">${esc(r.char)}<small>${r.w}V ${r.n - r.w}D</small></span>
      <span class="mu-bar" role="img" aria-label="${pct(r.w, r.n)}% de vitórias"><i style="width:${pct(r.w, r.n)}%"></i></span>
      <span class="mu-pct">${pct(r.w, r.n)}%</span>
    </li>`).join('');
}

document.querySelector('.toggle').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  state.sort = btn.dataset.sort;
  btn.parentElement.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b === btn));
  renderMatchups(scoped());
});

// ---------- histórico ----------

function renderHistory(list) {
  const q = state.q.trim().toLowerCase();
  const rows = list.filter((b) =>
    (!q || b.opp.name.toLowerCase().includes(q)) &&
    (!state.char || b.opp.char === state.char) &&
    (!state.res || (state.res === 'w') === b.win)
  ).reverse();

  const showAcc = state.account === 'all';
  $('#rows').innerHTML = rows.slice(0, state.shown).map((b) => {
    const dtp = b.me.tpDelta;
    return `<tr>
      <td title="${fmtDate.format(new Date(b.date))}">${ago(b.date)}<small>${esc(b.type)}${showAcc ? `, na ${esc(splitName(b.me.name).tag)}` : ''}</small></td>
      <td><span class="res ${b.win ? 'w' : 'l'}">${b.win ? 'Vitória' : 'Derrota'}</span></td>
      <td>${esc(b.opp.name)}<small>${esc(b.opp.char)}${b.opp.dan ? `, ${esc(b.opp.dan)}` : ''}</small></td>
      <td class="num">${b.me.rounds ?? '–'}–${b.opp.rounds ?? '–'}</td>
      <td class="num">${b.me.tekkenPower == null ? '—' : fmtNum.format(b.me.tekkenPower)}${dtp ? `<small class="delta ${dtp > 0 ? 'up' : 'down'}">${signedFmt(dtp)}</small>` : ''}</td>
    </tr>`;
  }).join('');
  $('#empty').hidden = rows.length > 0;
  $('#more').hidden = rows.length <= state.shown;
}

$('#filters').addEventListener('input', (e) => {
  const f = e.currentTarget;
  state.q = f.q.value; state.char = f.char.value; state.res = f.res.value; state.shown = 30;
  renderHistory(scoped());
});
$('#filters').addEventListener('submit', (e) => e.preventDefault());
$('#more').addEventListener('click', () => { state.shown += 30; renderHistory(scoped()); });

// ---------- tooltip ----------

const tip = $('#tip');
function showTip(e, html) {
  tip.innerHTML = html;
  tip.hidden = false;
  const pad = 14;
  const { width, height } = tip.getBoundingClientRect();
  let left = e.clientX + pad, top = e.clientY + pad;
  if (left + width > innerWidth - 8) left = e.clientX - width - pad;
  if (top + height > innerHeight - 8) top = e.clientY - height - pad;
  tip.style.left = `${left}px`; tip.style.top = `${top}px`;
}
function hideTip() { tip.hidden = true; }

load().catch((err) => {
  console.error(err);
  $('main').innerHTML = `<section class="panel history"><h2>Não foi possível carregar os dados</h2><p>O arquivo data/battles.json não foi encontrado ou está inválido. Rode o workflow "Atualizar partidas" na aba Actions do repositório.</p></section>`;
});
