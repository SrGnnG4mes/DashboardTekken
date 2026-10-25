// Tabelas do Tekken 8 e normalização das respostas do ewgf.
// O formato exato dos campos do ewgf não é documentado publicamente,
// então o normalizador aceita várias grafias (camelCase, snake_case,
// objetos aninhados). As respostas brutas ficam em data/raw/ (fora do git).

export const CHARACTERS = {
  0: 'Paul', 1: 'Law', 2: 'King', 3: 'Yoshimitsu', 4: 'Hwoarang', 5: 'Xiaoyu',
  6: 'Jin', 7: 'Bryan', 8: 'Kazuya', 9: 'Steve', 10: 'Jack-8', 11: 'Asuka',
  12: 'Devil Jin', 13: 'Feng', 14: 'Lili', 15: 'Dragunov', 16: 'Leo', 17: 'Lars',
  18: 'Alisa', 19: 'Claudio', 20: 'Shaheen', 21: 'Nina', 22: 'Lee', 23: 'Kuma',
  24: 'Panda', 28: 'Zafina', 29: 'Leroy', 32: 'Jun', 33: 'Reina', 34: 'Azucena',
  35: 'Victor', 36: 'Raven', 38: 'Eddy', 39: 'Lidia', 40: 'Heihachi', 41: 'Clive',
  42: 'Anna', 43: 'Fahkumram', 44: 'Armor King', 45: 'Miary Zo',
};

export const DAN_RANKS = [
  'Beginner', '1st Dan', '2nd Dan', 'Fighter', 'Strategist', 'Combatant',
  'Brawler', 'Ranger', 'Cavalry', 'Warrior', 'Assailant', 'Dominator',
  'Vanquisher', 'Destroyer', 'Eliminator', 'Garyu', 'Shinryu', 'Tenryu',
  'Mighty Ruler', 'Flame Ruler', 'Battle Ruler', 'Fujin', 'Raijin', 'Kishin',
  'Bushin', 'Tekken King', 'Tekken Emperor', 'Tekken God', 'Tekken God Supreme',
  'God of Destruction',
];

const BATTLE_TYPES = { 1: 'Quick', 2: 'Ranked', 3: 'Group', 4: 'Player' };

// --- helpers -------------------------------------------------------------

const norm = (k) => String(k).toLowerCase().replace(/[_\-\s]/g, '');

function flatIndex(obj) {
  const idx = {};
  for (const [k, v] of Object.entries(obj ?? {})) idx[norm(k)] = v;
  return idx;
}

function pick(idx, keys) {
  for (const k of keys) {
    const v = idx[norm(k)];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
}

function toNum(v) {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function toIso(v) {
  if (v === undefined) return undefined;
  if (typeof v === 'number' || /^\d+$/.test(String(v))) {
    const n = Number(v);
    return new Date(n < 1e12 ? n * 1000 : n).toISOString();
  }
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export function charName(v) {
  if (v === undefined) return 'Desconhecido';
  const n = toNum(v);
  if (n !== undefined) return CHARACTERS[n] ?? `Char #${n}`;
  return String(v);
}

export function danName(v) {
  const n = toNum(v);
  if (n !== undefined) return DAN_RANKS[n] ?? `Rank #${n}`;
  return v === undefined ? undefined : String(v);
}

// Lê os campos de um lado (1 ou 2) da partida.
function side(battle, s) {
  const top = flatIndex(battle);
  const nested = battle[`player${s}`] ?? battle[`p${s}`] ?? battle[`Player${s}`];
  const n = nested && typeof nested === 'object' ? flatIndex(nested) : {};
  const prefixes = [`player${s}`, `p${s}`];
  const get = (...suffixes) => {
    const fromNested = pick(n, suffixes);
    if (fromNested !== undefined) return fromNested;
    return pick(top, prefixes.flatMap((p) => suffixes.map((x) => p + x)));
  };
  const charRaw = get('characterId', 'charaId', 'chara', 'character', 'charId', 'characterName');
  const danRaw = get('danRank', 'rank', 'dan', 'danRankId');
  return {
    name: get('name', 'playerName', 'displayName') ?? '???',
    polarisId: get('polarisId', 'tekkenId', 'id', 'userId'),
    charId: toNum(charRaw),
    char: charName(charRaw),
    danId: toNum(danRaw),
    dan: danName(danRaw),
    rating: toNum(get('ratingBefore', 'rating', 'glicko')),
    ratingChange: toNum(get('ratingChange', 'ratingDelta')),
    tekkenPower: toNum(get('tekkenPower', 'power')),
    rounds: toNum(get('rounds', 'roundsWon', 'roundWins')),
  };
}

/**
 * Converte uma partida do ewgf para o formato do dashboard,
 * sempre do ponto de vista de `myId` (o seu Tekken ID).
 */
export function normalizeBattle(raw, myId, account) {
  const idx = flatIndex(raw);
  const p1 = side(raw, 1);
  const p2 = side(raw, 2);

  const lc = (x) => String(x ?? '').toLowerCase();
  let mySide = 1;
  if (lc(p2.polarisId) === lc(myId)) mySide = 2;
  else if (lc(p1.polarisId) !== lc(myId) && pick(idx, ['playerSide', 'side']) == 2) mySide = 2;

  const me = mySide === 1 ? p1 : p2;
  const opp = mySide === 1 ? p2 : p1;

  let winnerSide = toNum(pick(idx, ['winner', 'winnerSide', 'winnerPlayer']));
  if (winnerSide === undefined) {
    const w1 = pick(idx, ['player1Winner', 'p1Winner', 'p1Win']);
    if (w1 !== undefined) winnerSide = w1 === true || w1 === 1 || w1 === 'true' ? 1 : 2;
  }
  if (winnerSide === undefined && me.rounds !== undefined && opp.rounds !== undefined) {
    winnerSide = me.rounds > opp.rounds ? mySide : mySide === 1 ? 2 : 1;
  }
  const result = pick(idx, ['result', 'outcome']);
  let win = winnerSide !== undefined ? winnerSide === mySide : undefined;
  if (win === undefined && result !== undefined) win = /win|vit/i.test(String(result));

  const typeRaw = pick(idx, ['battleType', 'type', 'mode', 'gameMode']);
  const id =
    pick(idx, ['battleId', 'id', 'replayId', 'battleCode']) ??
    `${pick(idx, ['battleAt', 'date'])}-${p1.polarisId}-${p2.polarisId}`;

  return {
    id: String(id),
    account,
    date: toIso(pick(idx, ['battleAt', 'battleTime', 'date', 'timestamp', 'createdAt', 'playedAt'])),
    type: BATTLE_TYPES[toNum(typeRaw)] ?? (typeRaw !== undefined ? String(typeRaw) : 'Ranked'),
    stage: pick(idx, ['stageName', 'stageId', 'stage']),
    win: win ?? false,
    me,
    opp,
  };
}

/** Extrai a lista de partidas de qualquer envelope plausível. */
export function extractBattles(body) {
  const d = body?.data ?? body;
  if (Array.isArray(d)) return d;
  for (const key of ['battles', 'matches', 'replays', 'items', 'results']) {
    if (Array.isArray(d?.[key])) return d[key];
  }
  return [];
}

export function normalizeProfile(body, tekkenId) {
  const d = body?.data ?? body ?? {};
  const idx = flatIndex(d);
  const mainRaw = pick(idx, ['mainCharacter', 'currentMain', 'main', 'mainCharacterId', 'characterId']);
  const danRaw = pick(idx, ['danRank', 'rank', 'highestRank', 'currentRank']);
  return {
    tekkenId,
    name: pick(idx, ['name', 'playerName', 'displayName']) ?? tekkenId,
    region: pick(idx, ['region', 'regionName', 'regionId']),
    platform: pick(idx, ['platform', 'platformName']),
    main: mainRaw !== undefined ? charName(mainRaw) : undefined,
    dan: danName(danRaw),
    danId: toNum(danRaw),
    tekkenPower: toNum(pick(idx, ['tekkenPower', 'power'])),
  };
}
