// Busca perfil e partidas no ewgf e acumula o histórico em data/.
// Uso: EWGF_TOKEN=... TEKKEN_IDS=id1,id2 node scripts/fetch.mjs
// Roda no GitHub Actions (veja .github/workflows/update.yml).

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { normalizeBattle, extractBattles, normalizeProfile } from './tekken.mjs';

const API = 'https://api.ewgf.gg';
const TOKEN = process.env.EWGF_TOKEN;
// Aceita o ID do jogo com traços (38A8-9ANq-JyN4) ou sem (como na URL do ewgf).
const IDS = (process.env.TEKKEN_IDS ?? '').split(',').map((s) => s.trim().replace(/-/g, '')).filter(Boolean);
const DATA = new URL('../data/', import.meta.url);

if (!TOKEN) fail('Defina EWGF_TOKEN (secret do repositório).');
if (!IDS.length) fail('Defina TEKKEN_IDS (variável do repositório), ex.: abc123,def456');

function fail(msg) {
  console.error(`✖ ${msg}`);
  process.exit(1);
}

async function api(path) {
  const res = await fetch(API + path, {
    headers: { Authorization: `Bearer ${TOKEN}`, 'Accept-Encoding': 'gzip', 'User-Agent': 'tekken-dashboard' },
  });
  if (res.status === 429) {
    console.warn(`⚠ Limite de requisições atingido (retry-after: ${res.headers.get('retry-after')}s).`);
    return null;
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} em ${path}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function readJson(name, fallback) {
  const url = new URL(name, DATA);
  if (!existsSync(url)) return fallback;
  return JSON.parse(await readFile(url, 'utf8'));
}

async function writeJson(name, value) {
  await writeFile(new URL(name, DATA), JSON.stringify(value, null, 2) + '\n');
}

await mkdir(new URL('raw/', DATA), { recursive: true });

const stored = await readJson('battles.json', { battles: [] });
// Na primeira execução real, descarta os dados de exemplo.
const store = stored.sample ? { battles: [] } : stored;
const byId = new Map(store.battles.map((b) => [b.id, b]));
const profiles = [];
let added = 0;
let meta;

for (const id of IDS) {
  // A conta é identificada pelo próprio Tekken ID; a ordem em TEKKEN_IDS
  // define só qual aparece primeiro no site (a primeira é a principal).
  const account = id;
  console.log(`→ ${id}`);

  const prof = await api(`/external/profile/${encodeURIComponent(id)}`);
  if (prof) {
    meta = prof._metadata ?? meta;
    await writeJson(`raw/profile_${id}.json`, prof);
    profiles.push({ account, ...normalizeProfile(prof, id) });
  }

  const body = await api(`/external/battles/${encodeURIComponent(id)}`);
  if (!body) continue;
  meta = body._metadata ?? meta;
  // Resposta bruta guardada para conferir o formato se algo vier estranho.
  await writeJson(`raw/battles_${id}.json`, body);

  const list = extractBattles(body);
  if (list[0]) console.log(`  campos de uma partida: ${Object.keys(list[0]).join(', ')}`);
  for (const raw of list) {
    const b = normalizeBattle(raw, id, account);
    if (!byId.has(b.id)) added++;
    byId.set(b.id, b);
  }
}

const battles = [...byId.values()].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
await writeJson('battles.json', { updatedAt: new Date().toISOString(), count: battles.length, battles });
if (profiles.length) await writeJson('profile.json', { updatedAt: new Date().toISOString(), accounts: profiles });

console.log(`✔ ${added} partidas novas, ${battles.length} no total.`);
if (meta) console.log(`  plano: ${meta.tier}, requisições restantes hoje: ${meta.rate_limit_remaining}`);
