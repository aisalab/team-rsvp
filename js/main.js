// エントリポイント：LIFF 初期化、UIバインド、カレンダー起動
import { LIFF_ID } from './config.js';
import { $, toast } from './utils.js';
import { state, storage } from './state.js';
import { initCalendar } from './calendar.js';
import { bindEventDialog } from './ui.events.js';
import { bindFilterUI } from './ui.filters.js';
import { bindGroupUI } from './ui.groups.js';

document.addEventListener('DOMContentLoaded', init);

async function init(){
  // LIFF 初期化＆プロフィール
  try {
    await liff.init({ liffId: LIFF_ID });
    if (!liff.isLoggedIn()) { liff.login({}); return; }
    const profile = await liff.getProfile();
    state.profile = profile || state.profile;
    $("#userName").textContent = state.profile.displayName || '保護者';
    if (state.profile.pictureUrl) $("#userAvatar").src = state.profile.pictureUrl;
  } catch (e) {
    console.warn('LIFF init/profile failed', e);
    $("#userName").textContent = state.profile.displayName;
  }

  // 初回だけデモグループ
  if (!state.groups || state.groups.length === 0) {
    state.groups = ['A班','B班'];
    storage.saveGroups(state.groups);
    state.filters.groups = ['A班','B班'];
    storage.saveSelectedGroups(state.filters.groups);
  }

  // UI バインド
//   $("#prevBtn")?.addEventListener('click', ()=> window.__calendar?.prev?.());
//   $("#nextBtn")?.addEventListener('click', ()=> window.__calendar?.next?.());
//   bindEventDialog();
//   bindFilterUI();
//   bindGroupUI();
    // カレンダーを先に作って返り値を受け取る
    const cal = initCalendar();

    // UI バインド（作成済み cal を使う）
    $("#prevBtn")?.addEventListener('click', ()=> cal.prev());
    $("#nextBtn")?.addEventListener('click', ()=> cal.next());
    $("#todayBtn")?.addEventListener('click', ()=> cal.today());  // ← 追加
    bindEventDialog();
    bindFilterUI();
    bindGroupUI(); 

    // 設定ダイアログの開閉をここで面倒見る
    const settingsBtn = $("#settingsBtn");
    const settingsDialog = $("#settingsDialog");
    settingsBtn?.addEventListener('click', ()=>{
    if (!settingsDialog) return;
    if (typeof settingsDialog.showModal === 'function') settingsDialog.showModal();
    else settingsDialog.setAttribute('open','');
    });
    $("#sdClose")?.addEventListener('click', ()=> settingsDialog?.close());

  // カレンダー
  initCalendar();

  toast('準備できました');
}
