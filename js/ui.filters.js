// フィルタモーダル（描画・保存）
import { $, escapeHtml } from './utils.js';
import { state, storage } from './state.js';

export function bindFilterUI(){
  $("#filterBtn")?.addEventListener('click', openFilterDialog);
  $("#fdClose")?.addEventListener('click', () => $("#filterDialog").close());
  $("#fdApply")?.addEventListener('click', applyFilters);

  const box = document.getElementById('fltMyGroupsOnly');
  if (box){
    box.checked = !!state.filters.myGroupsOnly;
    box.addEventListener('change', ()=>{
      state.filters.myGroupsOnly = box.checked;
      storage.saveFilters?.(state.filters); // 既存の保存があれば
      document.dispatchEvent(new CustomEvent('filters:changed'));
    });
  }

}

export function openFilterDialog(){
  renderFilterGroups();
  const dlg = $("#filterDialog");
  if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open','');
}

export function renderFilterGroups(){
  const box = $("#fdGroups");
  if (!box) return;
  box.innerHTML = '';

  const selected = Array.isArray(state.filters.groups) ? state.filters.groups : [];

  // 未設定チップは常に表示
  const chip0 = document.createElement('label');
  chip0.className = 'chip';
  chip0.innerHTML = `<input type="checkbox" value="__UNGROUPED__"><span>未設定</span>`;
  chip0.querySelector('input').checked = (selected.length === 0) ? true : selected.includes('__UNGROUPED__');
  box.appendChild(chip0);

  // 登録済みグループ
  if (state.groups?.length) {
    state.groups.forEach(name=>{
      const wrap = document.createElement('label');
      wrap.className = 'chip';
      wrap.innerHTML = `<input type="checkbox" value="${escapeHtml(name)}"><span>${escapeHtml(name)}</span>`;
      const cb = wrap.querySelector('input');
      cb.checked = (selected.length === 0) ? true : selected.includes(name);
      box.appendChild(wrap);
    });
  }
}

export function applyFilters(){
  const box = $("#fdGroups");
  if (box) {
    const selected = [...box.querySelectorAll('input[type="checkbox"]:checked')].map(cb=>cb.value);
    state.filters.groups = selected;                      // 空配列＝全件表示
    storage.saveSelectedGroups(selected);
  }
  $("#filterDialog").close();
  document.dispatchEvent(new CustomEvent('filters:changed'));
}
