import { $, escapeHtml } from './utils.js';
import { TEAM_ID } from './config.js';
import { state, storage } from './state.js';
import { apiGetMe, apiSetMyGroups } from './api.js';

// state.filters.myGroupsOnly を使う（既存 filters に boolean を追加）
export function bindMyGroupsUI(){
  // 開く
  document.body.addEventListener('click', async (e)=>{
    const btn = e.target.closest('[data-open="#myGroupsDialog"]');
    if (!btn) return;
    e.preventDefault();

    // 最新の自分の所属を取得
    // const me = await apiGetMe(TEAM_ID);
    // state.myGroups = me.groups || []; // ローカル状態
    // 最新の自分の所属を取得（失敗しても空で開く）
    try {
    const me = await apiGetMe(TEAM_ID);
    state.myGroups = me.groups || [];
    } catch (err) {
    console.warn('apiGetMe failed, open dialog anyway', err);
    state.myGroups = state.myGroups || [];
    }

    renderMyGroupsList();
    const dlg = $("#myGroupsDialog");
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open','');
  });

  $("#mgClose")?.addEventListener('click', ()=> $("#myGroupsDialog")?.close());
  $("#mgSave")?.addEventListener('click', onSave);
}

function renderMyGroupsList(){
  const ul = $("#mgList"); ul.innerHTML = '';
  // 既存の全グループは state.groups に入っている想定
  (state.groups || []).forEach(name=>{
    const li = document.createElement('li');
    const checked = (state.myGroups || []).includes(name) ? 'checked' : '';
    li.innerHTML = `
      <label>
        <input type="checkbox" value="${escapeHtml(name)}" ${checked}>
        ${escapeHtml(name)}
      </label>`;
    ul.appendChild(li);
  });
}

async function onSave(){
  const ul = $("#mgList");
  const sel = [...ul.querySelectorAll('input[type="checkbox"]')]
    .filter(i=> i.checked).map(i=> i.value);

  await apiSetMyGroups(TEAM_ID, sel, state.profile?.displayName || '');
  state.myGroups = sel;
  $("#myGroupsDialog")?.close();

  // 「自分のグループのみ表示」がONならカレンダー再読み込み
  if (state.filters?.myGroupsOnly) {
    document.dispatchEvent(new CustomEvent('filters:changed'));
  }
}
