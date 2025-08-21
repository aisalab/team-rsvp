// グループ管理（一覧・追加・改名・削除）
import { $, escapeHtml } from './utils.js';
import { state, storage } from './state.js';
import { TEAM_ID } from './config.js';
import { apiListGroups, apiAddGroup, apiDeleteGroup, apiRenameGroup } from './api.js';

export function bindGroupUI(){
  // 設定メニュー → グループ管理を必ず前描画してから開く
  document.body.addEventListener('click', async(e)=>{
    const btn = e.target.closest('[data-open="#groupDialog"]');
    if (!btn) return;
    e.preventDefault();
    
    await refreshGroups();      // ← Firestoreから最新取得
    renderGroupManagerList();
    const dlg = $("#groupDialog");
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open','');
  });

  $("#gdClose")?.addEventListener('click', ()=> $("#groupDialog").close());
  $("#gmAddBtn")?.addEventListener('click', onGmAdd);
}

async function refreshGroups(){
  const groups = await apiListGroups(TEAM_ID);
  state.groups = groups;               // 状態更新
  // 選択状態が存在しない/おかしければ全選択扱いにリセットしてもOK
}

export function renderGroupManagerList(){
  const ul = $("#gmList");
  ul.innerHTML = '';
//  state.groups.forEach(name=>{
    (state.groups || []).forEach(g=>{
    const name = (typeof g === 'string' ? g : g?.name) || '';
    const li = document.createElement('li');
    //li.innerHTML = `<span class="name">${escapeHtml(name)}</span>
    li.innerHTML = `<span class="name">${escapeHtml(String(name))}</span>
      <span class="ops">
        <button data-op="rename" data-name="${escapeHtml(String(name))}">名前変更</button>
        <button data-op="delete" data-name="${escapeHtml(String(name))}">削除</button>
      </span>`;
    ul.appendChild(li);
  });

  ul.querySelectorAll('button[data-op="rename"]').forEach(btn=>{
    btn.addEventListener('click', async()=>{
      const old = btn.getAttribute('data-name');
      const nw = (prompt('新しい名前を入力', old) || '').trim();
      if(!nw || nw===old) return;
      if(state.groups.includes(nw)){ alert('同名のグループが既にあります'); return; }

    //   state.groups = state.groups.map(g=> g===old ? nw : g);
    //   state.filters.groups = state.filters.groups.map(g=> g===old ? nw : g);
    //   storage.saveGroups(state.groups);
    //   storage.saveSelectedGroups(state.filters.groups);
        await apiRenameGroup(TEAM_ID, old, nw);
        await refreshGroups();
      renderGroupManagerList();
      document.dispatchEvent(new CustomEvent('filters:changed')); // カレンダー再取得
    });
  });

  ul.querySelectorAll('button[data-op="delete"]').forEach(btn=>{
    btn.addEventListener('click', async()=>{
      const name = btn.getAttribute('data-name');
      if(!confirm(`「${name}」を削除しますか？`)) return;
    //   state.groups = state.groups.filter(g=> g!==name);
    //   state.filters.groups = state.filters.groups.filter(g=> g!==name);
    //   storage.saveGroups(state.groups);
    //   storage.saveSelectedGroups(state.filters.groups);
      await apiDeleteGroup(TEAM_ID, name);
      // 選択からも外す
      state.filters.groups = state.filters.groups.filter(g=> g!==name);
      storage.saveSelectedGroups(state.filters.groups);
      await refreshGroups();
      renderGroupManagerList();
      document.dispatchEvent(new CustomEvent('filters:changed'));
    });
  });
}

async function onGmAdd(){
  const input = $("#gmInput");
  const name = (input.value || '').trim();
  if(!name) return;
  if(state.groups.includes(name)){ alert('同名のグループが既にあります'); return; }

//   state.groups.push(name);
//   storage.saveGroups(state.groups);

//   if(!state.filters.groups.includes(name)){
//     state.filters.groups.push(name);
//     storage.saveSelectedGroups(state.filters.groups);
//   }
    await apiAddGroup(TEAM_ID, name);
    await refreshGroups();
    if(!state.filters.groups.includes(name)){
    state.filters.groups.push(name);
    storage.saveSelectedGroups(state.filters.groups);
    }
  input.value='';
  renderGroupManagerList();
  document.dispatchEvent(new CustomEvent('filters:changed'));
}
