// 外觀主題：島嶼（預設）與修仙。只管名稱、文案、配色與造型；遊戲規則、存檔與獎勵完全共用。
// 修仙主題的角色、地名、文案都是原創（見 docs/STUDY_ISLAND_XIANXIA_DESIGN_20261031.md）。

const ISLAND = {
  id: 'island', label: '島嶼', icon: '🏝',
  place: null, // 使用存檔中的島名
  words: {
    bag: '背包', bagIcon: '🎒', tasks: '任務', tasksIcon: '📒', build: '建造', buildIcon: '🔨',
    tasksTitle: '今日委託', questGroup: '島上委託', questOf: '的委託', claimMsg: '領到委託獎勵',
    buildTitle: '工坊與擺放', workshop: '工坊', furniture: '家具', place: '島上', placedGroup: '島上的家具',
    focus: '專注', focusIcon: '⏱', focusGo: '去讀書吧，小島會等你',
    study: '學習任務', friendship: '親密度', residents: '居民', outfit: '衣服顏色',
    legacy: '舊島花園', hint: '點地面走路 · 找居民聊天 · 去沙灘和樹林採集',
    mapLabel: '地圖', home: '小屋', homeMsg: '這是你的小屋，之後會開放進去。', waterMsg: '那裡是海，走不過去。',
    noPlay: '不讀書也能在島上玩。'
  },
  materials: {
    shell: { name: '貝殼', icon: '🐚', where: '海灘' },
    wood: { name: '木材', icon: '🪵', where: '樹林' },
    leaf: { name: '葉子', icon: '🍃', where: '樹林' },
    fruit: { name: '果實', icon: '🍎', where: '樹林' }
  },
  furniture: {
    'starter-stool': { name: '新手木凳', icon: '🪑', note: '新手禮物，到「建造」就能擺在島上。' },
    'wood-chair': { name: '木椅', icon: '🪑', note: '工坊製作的木椅。' },
    flowerbed: { name: '花圃', icon: '🌷', note: '工坊製作的花圃。' },
    lantern: { name: '小燈籠', icon: '🏮', note: '工坊製作的小燈籠。' }
  },
  terrain: {
    water: '海', sand: '沙灘', grass: '草地', forest: '樹林', path: '小路', plaza: '廣場',
    flower: '花叢', house: '小屋', tree: '樹', rock: '岩石'
  },
  study: { essay: '完成一題申論', correction: '完成一次訂正', recall: '完成一次主動回憶' },
  npcs: {
    chestnut: { name: '栗子', role: '' },
    brownie: { name: '阿棕', role: '' },
    snowy: { name: '小白', role: '' },
    inky: { name: '墨墨', role: '' }
  },
  greet: { again: '又見面了！今天的風好舒服。', first: n => '嗨！我是' + n + '，很高興認識你。', close: '是你！能在島上遇到你真好。', mid: '早安！我們越來越熟了呢。' },
  lines: null, // 使用 npc/dialogue.js 的原本台詞
  palette: {
    water: '#7ec8d8', waterDeep: '#6bb8cc', foam: '#dff4f1', sand: '#f2e2b3', sandDot: '#e2cd93',
    grass: '#a9d78c', grassDark: '#93c779', forest: '#8bc17a', forestTuft: '#6fa862',
    path: '#e6d3a3', plaza: '#ecdcb2', plazaLine: '#d9c48f', wave: 'rgba(255,255,255,.55)', themeColor: '#7ec8d8'
  }
};

const XIANXIA = {
  id: 'xianxia', label: '修仙', icon: '⛰️',
  place: '青嵐山',
  words: {
    bag: '乾坤袋', bagIcon: '👝', tasks: '師門', tasksIcon: '📜', build: '丹房', buildIcon: '⚗️',
    tasksTitle: '師門任務', questGroup: '師門任務', questOf: '交付的任務', claimMsg: '領到師門獎勵',
    buildTitle: '丹房與佈置', workshop: '丹房', furniture: '器物', place: '山上', placedGroup: '山上的器物',
    focus: '打坐', focusIcon: '🧘', focusGo: '去讀書吧，山門會等你',
    study: '修行功課', friendship: '同門情誼', residents: '同門', outfit: '道袍顏色',
    legacy: '舊日庭園', hint: '點地面走路 · 找同門說話 · 去靈泉灘和靈竹林採集',
    mapLabel: '山門地圖', home: '洞府', homeMsg: '這是你的洞府，之後會開放進去。', waterMsg: '那裡是雲海，走不過去。',
    noPlay: '不讀書也能在山上走走。'
  },
  materials: {
    shell: { name: '靈石', icon: '💎', where: '靈泉灘' },
    wood: { name: '靈竹', icon: '🎋', where: '靈竹林' },
    leaf: { name: '靈草', icon: '🌿', where: '靈竹林' },
    fruit: { name: '靈果', icon: '🍑', where: '靈竹林' }
  },
  furniture: {
    'starter-stool': { name: '入門蒲團', icon: '🪷', note: '入門禮物，到「丹房」就能擺在山上。' },
    'wood-chair': { name: '蒲團', icon: '🪷', note: '丹房製作的蒲團。' },
    flowerbed: { name: '靈草圃', icon: '🌱', note: '丹房製作的靈草圃。' },
    lantern: { name: '長明燈', icon: '🏮', note: '丹房製作的長明燈。' }
  },
  terrain: {
    water: '雲海', sand: '靈泉灘', grass: '草坡', forest: '靈竹林', path: '山徑', plaza: '演武坪',
    flower: '花叢', house: '洞府', tree: '靈竹', rock: '山石'
  },
  study: { essay: '參悟：完成一題申論', correction: '修心：完成一次訂正', recall: '溫故：完成一次主動回憶' },
  npcs: {
    chestnut: { name: '秋棠', role: '師姐' },
    brownie: { name: '石岳', role: '師兄' },
    snowy: { name: '白芷', role: '小師妹' },
    inky: { name: '墨衡', role: '藏經閣長老' }
  },
  greet: { again: '又見面了，今天山上的風很清。', first: n => '你好，我是' + n + '。初入山門，慢慢來。', close: '是你！今日也來修行了？', mid: '來啦，我們越來越熟了。' },
  lines: {
    chestnut: {
      hint: ctx => ctx.shellsToday === 0
        ? '靈泉灘上今天有 ' + ctx.shellsTotal + ' 塊靈石在發光，去看看吧？'
        : ctx.shellsToday < ctx.shellsTotal
          ? '你已經撿到 ' + ctx.shellsToday + ' 塊靈石了，還有 ' + (ctx.shellsTotal - ctx.shellsToday) + ' 塊在靈泉灘。'
          : '今天的靈石都被你找到了！明天泉水會再湧出新的。',
      rest: '今天先把一個爭點想清楚就好，修行不急在一時。'
    },
    brownie: { hint: () => '靈竹林裡常有斷落的靈竹，撿回去就能在丹房做蒲團。', rest: '坐下來，呼吸放慢。專注二十五分鐘，就是一次小周天。' },
    snowy: { hint: () => '我最喜歡靈草了！多採幾株，就能在丹房做靈草圃。', rest: '師兄說要閉關，可是你吃飯了嗎？' },
    inky: { hint: () => '丹房在下面。器物擺錯了也能收回來重放——訂正也是這樣。', rest: '寫錯的地方，才是功法真正要你看的地方。' }
  },
  palette: {
    water: '#dfe9f1', waterDeep: '#cddcea', foam: '#ffffff', sand: '#e4eedb', sandDot: '#c9dcc4',
    grass: '#b9dba9', grassDark: '#9cc98d', forest: '#9cc792', forestTuft: '#7fb174',
    path: '#d9d3c4', plaza: '#e1dbcc', plazaLine: '#c6bda8', wave: 'rgba(255,255,255,.95)', themeColor: '#cddcea'
  }
};

export const THEMES = { island: ISLAND, xianxia: XIANXIA };
export const THEME_LIST = [ISLAND, XIANXIA];

let current = ISLAND;
export function setTheme(id) { current = THEMES[id] || ISLAND; return current; }
export function theme() { return current; }

export const w = key => current.words[key];
export const mat = id => current.materials[id] || { name: id, icon: '', where: '' };
export const furn = id => current.furniture[id] || { name: id, icon: '', note: '' };
export const terrainLabel = id => current.terrain[id] || id;
export const studyTitle = (id, fallback) => current.study[id] || fallback;
export const npcName = id => (current.npcs[id] || { name: id }).name;
export const npcRole = id => (current.npcs[id] || { role: '' }).role;
export const placeName = save => current.place || save.islandName;
