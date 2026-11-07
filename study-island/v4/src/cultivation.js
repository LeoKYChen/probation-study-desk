// X2：修為境界（見 docs/STUDY_ISLAND_XIANXIA_DESIGN_20261031.md 第六節）。
// 原則：修為只升不降；只從打坐、自行回報、師門任務取得（沿用既有每日上限與去重帳本）；
// 突破只需修為達標與對應丹藥，一定成功；修為反映修煉次數，不代表考試能力。

// 每種來源給的修為。採集、煉丹、聊天不給。
export const XP = { focus5: 10, focus25: 60, study: 20, quest: 5 };

// 大境界：index 0 是練氣（分九層，每 100 一層，不需突破）。
export const REALMS = [
  { id: 'qi', name: '練氣', threshold: 0 },
  { id: 'foundation', name: '築基', threshold: 900, pill: 'pill-foundation' },
  { id: 'core', name: '結丹', threshold: 3000, pill: 'pill-core' },
  { id: 'nascent', name: '元嬰', threshold: 7000, pill: 'pill-nascent' },
  { id: 'spirit', name: '化神', threshold: 15000, pill: 'pill-spirit' }
];

// 突破用丹藥（遊戲數值）。在丹房以既有材料煉製。
export const PILLS = [
  { id: 'pill-foundation', name: '築基丹', icon: '💊', needs: { shell: 3, wood: 2, leaf: 2, fruit: 1 } },
  { id: 'pill-core', name: '凝丹丹', icon: '💊', needs: { shell: 5, wood: 3, leaf: 3, fruit: 2 } },
  { id: 'pill-nascent', name: '化嬰丹', icon: '💊', needs: { shell: 8, wood: 4, leaf: 4, fruit: 3 } },
  { id: 'pill-spirit', name: '凝神丹', icon: '💊', needs: { shell: 12, wood: 6, leaf: 6, fruit: 4 } }
];

const NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
export const PAST_LIFE_PER_DAY = 30;
export const PAST_LIFE_MAX = 900;

export const pillById = id => PILLS.find(p => p.id === id) || null;

export function emptyCultivation() {
  return { xp: 0, realm: 0, history: [], pastLife: false };
}

export function normalizeCultivation(c) {
  const base = emptyCultivation();
  if (!c || typeof c !== 'object') return base;
  const xp = Number.isSafeInteger(c.xp) && c.xp > 0 ? c.xp : 0;
  const realm = Number.isInteger(c.realm) && c.realm >= 0 && c.realm < REALMS.length ? c.realm : 0;
  return {
    xp,
    realm,
    history: Array.isArray(c.history) ? c.history.filter(h => h && typeof h.at === 'string').slice(-20) : [],
    pastLife: !!c.pastLife
  };
}

// 前世修為：v3 學習天數 × 30，上限 900（剛好到築基門檻）。
export function pastLifeAmount(legacy) {
  if (!legacy || !Array.isArray(legacy.days)) return 0;
  return Math.min(PAST_LIFE_MAX, legacy.days.length * PAST_LIFE_PER_DAY);
}

// 顯示用：目前境界名稱、到下一個大境界的進度、能否突破。
export function realmInfo(cult) {
  const c = normalizeCultivation(cult);
  const cur = REALMS[c.realm], next = REALMS[c.realm + 1] || null;
  let label;
  if (c.realm === 0) {
    label = '練氣' + NUM[Math.min(8, Math.floor(c.xp / 100))] + '層';
  } else {
    const span = next ? next.threshold - cur.threshold : cur.threshold;
    const into = Math.max(0, c.xp - cur.threshold);
    label = cur.name + (into < span / 3 ? '初期' : into < span * 2 / 3 ? '中期' : '後期');
  }
  const ready = !!next && c.xp >= next.threshold;
  const progress = next ? Math.min(1, (c.xp - cur.threshold) / (next.threshold - cur.threshold)) : 1;
  return { xp: c.xp, realm: c.realm, name: cur.name, label, next, ready, progress, pill: next ? pillById(next.pill) : null };
}
