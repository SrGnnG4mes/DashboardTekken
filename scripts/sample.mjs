// Gera dados de exemplo (formato bruto plausível do ewgf) e passa pelo
// mesmo normalizador do script real. Útil pra ver o site antes do token.
// Uso: node scripts/sample.mjs

import { writeFile, mkdir } from 'node:fs/promises';
import { normalizeBattle, normalizeProfile } from './tekken.mjs';

const ME = 'demoBushin01';
const ALT = 'demoAlt00002';
let seed = 42;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pickOne = (arr) => arr[Math.floor(rnd() * arr.length)];

const oppChars = [8, 6, 0, 1, 40, 21, 2, 7, 12, 33, 14, 5, 4, 3, 34, 36, 15, 28, 38, 44];
const oppNames = ['Kurogane', 'AcreMishima', 'ZeroFrame', 'PunisherBR', 'WallSplat', 'NorteKing',
  'Ghost_88', 'Hellsweep', 'Yuki-Raven', 'iWS2enjoyer', 'BeloKazuya', 'PanteraNegra'];

const raws = [];
let rating = 1640;
const now = Date.now();
for (let i = 0; i < 160; i++) {
  const alt = i % 7 === 0;
  const myChar = alt ? 40 : 15; // Dragunov na principal, Heihachi na secundária
  const oppChar = pickOne(oppChars);
  const tough = [8, 40, 12, 33].includes(oppChar) ? 0.4 : 0.56;
  const win = rnd() < tough;
  const delta = Math.round((win ? 1 : -1) * (6 + rnd() * 14));
  const mine = { name: 'BushinFRV', polarisId: alt ? ALT : ME, characterId: myChar,
    danRank: alt ? 16 : 24, ratingBefore: alt ? 1450 : rating, ratingChange: delta,
    rounds: win ? 3 : Math.floor(rnd() * 3) };
  const theirs = { name: pickOne(oppNames), polarisId: `opp${Math.floor(rnd() * 1e6)}`,
    characterId: oppChar, danRank: 20 + Math.floor(rnd() * 7),
    ratingBefore: rating + Math.round((rnd() - 0.5) * 200), ratingChange: -delta,
    rounds: win ? Math.floor(rnd() * 3) : 3 };
  if (!alt) rating += delta;
  const meFirst = rnd() < 0.5;
  const [a, b] = meFirst ? [mine, theirs] : [theirs, mine];
  const flat = {};
  for (const [k, v] of Object.entries(a)) flat['player1' + k[0].toUpperCase() + k.slice(1)] = v;
  for (const [k, v] of Object.entries(b)) flat['player2' + k[0].toUpperCase() + k.slice(1)] = v;
  raws.push({
    battleId: `demo-${i}`,
    battleAt: new Date(now - (160 - i) * 3.1 * 3600e3 - rnd() * 3600e3).toISOString(),
    battleType: rnd() < 0.85 ? 2 : 1,
    stageId: pickOne(['Arena', 'Urban Square', 'Yakushima', 'Ortiz Farm', 'Fallen Destiny']),
    winner: win === meFirst ? 1 : 2,
    ...flat,
  });
}

const battles = raws
  .map((r) => normalizeBattle(r, r.player1PolarisId === ME || r.player1PolarisId === ALT ? r.player1PolarisId : r.player2PolarisId,
    (r.player1PolarisId === ALT || r.player2PolarisId === ALT) ? 'conta2' : 'conta1'))
  .sort((a, b) => b.date.localeCompare(a.date));

const profiles = [
  { account: 'conta1', ...normalizeProfile({ data: { name: 'BushinFRV', region: 'América do Sul', platform: 'Steam', mainCharacter: 15, danRank: 24, tekkenPower: 187430 } }, ME) },
  { account: 'conta2', ...normalizeProfile({ data: { name: 'BushinFRV', region: 'América do Sul', platform: 'Steam', mainCharacter: 40, danRank: 16, tekkenPower: 61200 } }, ALT) },
];

const dir = new URL('../data/', import.meta.url);
await mkdir(dir, { recursive: true });
const stamp = new Date().toISOString();
await writeFile(new URL('battles.json', dir), JSON.stringify({ sample: true, updatedAt: stamp, count: battles.length, battles }, null, 2) + '\n');
await writeFile(new URL('profile.json', dir), JSON.stringify({ sample: true, updatedAt: stamp, accounts: profiles }, null, 2) + '\n');
console.log(`✔ ${battles.length} partidas de exemplo geradas.`);
