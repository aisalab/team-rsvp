// アプリの状態と localStorage アクセス
const LS_KEYS = { GROUPS: 'groups', GROUPS_SELECTED: 'groups_selected' };

const loadJSON = (k, def=[]) => {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; }
};
const saveJSON = (k, v) => localStorage.setItem(k, JSON.stringify(v));

export const state = {
  profile: { displayName: '保護者', userId: 'anonymous' },
  children: [],
  eventsCache: new Map(),
  groups: loadJSON(LS_KEYS.GROUPS, []),
  filters: { groups: loadJSON(LS_KEYS.GROUPS_SELECTED, []) }
};

export const storage = {
  saveGroups: (arr)=> { localStorage.setItem(LS_KEYS.GROUPS, JSON.stringify(arr)); },
  saveSelectedGroups: (arr)=> { localStorage.setItem(LS_KEYS.GROUPS_SELECTED, JSON.stringify(arr)); },
  keys: LS_KEYS
};
