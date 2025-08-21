// js/ui.items.js
import { $, escapeHtml } from './utils.js';
import { TEAM_ID } from './config.js';
import { apiListItems, apiAddItem, apiUpdateItem, apiDeleteItem } from './api.js';

let items = []; // {name, qty}[]

export function bindItemsUI(){
  // 設定メニュー → 荷物管理を開く
  document.body.addEventListener('click', async (e)=>{
    const btn = e.target.closest('[data-open="#itemsDialog"]');
    if (!btn) return;
    e.preventDefault();
    await refreshItems();
    renderItemsList();
    const dlg = $("#itemsDialog");
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open','');
  });

  $("#idClose")?.addEventListener('click', ()=> $("#itemsDialog")?.close());
  $("#imAddBtn")?.addEventListener('click', onAddItem);
}

async function refreshItems(){
  items = await apiListItems(TEAM_ID);
}

function renderItemsList(){
  const ul = $("#imList");
  ul.innerHTML = '';
  (items || []).forEach(({name, qty})=>{
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="im-name">${escapeHtml(String(name))}</span>
      <span class="im-qty">
        <input type="number" min="0" step="1" value="${Number(qty)}" data-role="qty" data-name="${escapeHtml(String(name))}">
      </span>
      <span class="im-ops">
        <button data-op="rename" data-name="${escapeHtml(String(name))}">名前変更</button>
        <button data-op="delete" data-name="${escapeHtml(String(name))}">削除</button>
        <button data-op="save" data-name="${escapeHtml(String(name))}">保存</button>
      </span>
    `;
    ul.appendChild(li);
  });

  // 数量保存
  ul.querySelectorAll('button[data-op="save"]').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const name = btn.getAttribute('data-name');
      const input = ul.querySelector(`input[data-role="qty"][data-name="${CSS.escape(name)}"]`);
      const qty = Number(input?.value || 0);
      await apiUpdateItem(TEAM_ID, name, { qty });
      await refreshItems(); renderItemsList();
    });
  });

  // 名前変更
  ul.querySelectorAll('button[data-op="rename"]').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const oldName = btn.getAttribute('data-name');
      const nw = (prompt('新しい名前を入力', oldName) || '').trim();
      if (!nw || nw === oldName) return;
      if (items.some(it => it.name === nw)) { alert('同名の荷物が既にあります'); return; }
      await apiUpdateItem(TEAM_ID, oldName, { newName: nw });
      await refreshItems(); renderItemsList();
    });
  });

  // 削除
  ul.querySelectorAll('button[data-op="delete"]').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const name = btn.getAttribute('data-name');
      if(!confirm(`「${name}」を削除しますか？`)) return;
      await apiDeleteItem(TEAM_ID, name);
      await refreshItems(); renderItemsList();
    });
  });
}

async function onAddItem(){
  const nameInput = $("#imName");
  const qtyInput  = $("#imQty");
  const name = (nameInput.value || '').trim();
  const qty  = Number(qtyInput.value || 0);
  if (!name) { alert('名前を入力してください'); return; }
  if (items.some(it => it.name === name)) { alert('同名の荷物が既にあります'); return; }

  await apiAddItem(TEAM_ID, name, qty);
  nameInput.value = ''; qtyInput.value = '0';
  await refreshItems(); renderItemsList();
}
