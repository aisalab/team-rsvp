// ====== 設定 ======
const LIFF_ID   = 'https://miniapp.line.me/2007941730-gGwPVonW'; // ← ミニアプリID（=LIFF ID）に置き換え
const TEAM_ID   = new URLSearchParams(location.search).get('team_id') || 'T01';
const BASE_URL  = 'https://miniapp-firestore-api-978580566817.asia-northeast1.run.app'; // バックエンドAPI。未用意ならモックが動作
const TZ        = 'Asia/Tokyo';

// ====== ユーティリティ ======
const $ = (s)=>document.querySelector(s);
const fmtD = (d)=>d.toLocaleDateString('ja-JP',{year:'numeric',month:'long',day:'numeric', timeZone:TZ});
const fmtT = (d)=>d.toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:TZ});
const pad2 = (n)=>n.toString().padStart(2,'0');
function toLocalISO(date){ const y=date.getFullYear(), m=pad2(date.getMonth()+1), d=pad2(date.getDate());
  const hh=pad2(date.getHours()), mm=pad2(date.getMinutes()); return `${y}-${m}-${d}T${hh}:${mm}:00+09:00`; }
function toast(msg){ const t=$("#toast"); if(!t) return; t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),1800); }
function labelOf(k){ return k==='yes'?'○':k==='no'?'×':'△'; }
function typeLabel(t){ return t==='match'?'試合':t==='practice'?'練習':'イベント'; }
function escapeHtml(s=''){ return s.replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }

// const typeSel = $("#fdType");
// const childSel = $("#fdChild");
// const type = typeSel ? typeSel.value : 'all';
// const childId = childSel ? childSel.value : 'all';
// if (type && type !== 'all') params.append('type', type);
// if (childId && childId !== 'all') params.append('childId', childId);

// === 追加：ローカル保存ヘルパー（後でサーバAPIに差し替え可） ===
const LS_KEYS = { GROUPS: 'groups', GROUPS_SELECTED: 'groups_selected' };
const loadJSON = (k, def=[]) => {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; }
};
const saveJSON = (k, v) => localStorage.setItem(k, JSON.stringify(v));

// ====== 状態 ======

// 既存の state に項目を追加 or 初期化直後に上書き
let state = {
  profile: { displayName: '保護者', userId: 'anonymous' },
  children: [],
  eventsCache: new Map(),
  groups: loadJSON(LS_KEYS.GROUPS, []),
  filters: { groups: loadJSON(LS_KEYS.GROUPS_SELECTED, []) }
};

/* // ====== 状態 ======
let state = {
  profile: { displayName: '保護者', userId: 'anonymous' },
  children: [],
  eventsCache: new Map()
}; */

// ====== 起動 ======
document.addEventListener('DOMContentLoaded', init);
let calendar;

async function init(){
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

  bindUI();
  initCalendar();
  await fillChildFilter();

    // === 追加：初回だけデモグループ ===
  if (!state.groups || state.groups.length === 0) {
    state.groups = ['A班', 'B班'];
    saveJSON(LS_KEYS.GROUPS, state.groups);
    state.filters.groups = ['A班','B班'];
    saveJSON(LS_KEYS.GROUPS_SELECTED, state.filters.groups);
  }

}

// ====== UIイベント ======
function bindUI(){
  $("#prevBtn").addEventListener('click', ()=> calendar?.prev());
  $("#nextBtn").addEventListener('click', ()=> calendar?.next());
  // $("#typeFilter").addEventListener('change', ()=> calendar?.refetchEvents());
  // $("#childFilter").addEventListener('change', ()=> calendar?.refetchEvents());
  $("#closeDialog").addEventListener('click', ()=>$("#eventDialog").close());
  $("#saveBtn").addEventListener('click', saveRSVP);
  $("#openInChat").addEventListener('click', shareToChat);
  // グループ管理ダイアログを開くたびにセットアップ
  const gd = document.getElementById('groupDialog');
  gd?.addEventListener('show', () => { renderGroupManagerList(); });
  gd?.addEventListener('close', () => { /* 必要なら後片付け */ });
  document.getElementById('gmAddBtn')?.addEventListener('click', onGmAdd);
}

// ====== FullCalendar 初期化 ======
// ====== グループ管理 ======
/* function openGroupManager(){
  const dlg = document.getElementById('groupManager');
  renderGroupManagerList();
  if(typeof dlg.showModal==='function') dlg.showModal(); else dlg.setAttribute('open','');
  document.getElementById('closeGroupMgr').addEventListener('click', ()=> dlg.close(), { once:true });
  document.getElementById('gmAddBtn').addEventListener('click', onGmAdd, { once:true });
} */
function openGroupManager(){
  const dlg = document.getElementById('groupDialog');  // ← groupDialog に変更
  //renderGroupManagerList();
  if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open','');
  document.getElementById('gdClose')?.addEventListener('click', ()=> dlg.close(), { once:true });  // ← gdClose
  document.getElementById('gmAddBtn')?.addEventListener('click', onGmAdd, { once:true });
  renderGroupManagerList();
}

function renderGroupManagerList(){
  const ul = document.getElementById('gmList');
  ul.innerHTML = '';
  state.groups.forEach(name=>{
    const li = document.createElement('li');
    li.innerHTML = `<span class="name">${escapeHtml(name)}</span>
      <span class="ops">
        <button data-op="rename" data-name="${escapeHtml(name)}">名前変更</button>
        <button data-op="delete" data-name="${escapeHtml(name)}">削除</button>
      </span>`;
    ul.appendChild(li);
  });
  ul.querySelectorAll('button[data-op="rename"]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const old = btn.getAttribute('data-name');
      const nw = (prompt('新しい名前を入力', old) || '').trim();
      if(!nw || nw===old) return;
      if(state.groups.includes(nw)){ alert('同名のグループが既にあります'); return; }
      state.groups = state.groups.map(g=> g===old ? nw : g);
      // 選択状態も置換
      state.filters.groups = state.filters.groups.map(g=> g===old ? nw : g);
      saveJSON(LS_KEYS.GROUPS, state.groups);
      saveJSON(LS_KEYS.GROUPS_SELECTED, state.filters.groups);
      // renderGroupOptions();
      // initFiltersUI();
      renderGroupManagerList();
      renderFilterGroups();
      calendar?.refetchEvents();
    });
  });
  ul.querySelectorAll('button[data-op="delete"]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const name = btn.getAttribute('data-name');
      if(!confirm(`「${name}」を削除しますか？`)) return;
      state.groups = state.groups.filter(g=> g!==name);
      state.filters.groups = state.filters.groups.filter(g=> g!==name);
      saveJSON(LS_KEYS.GROUPS, state.groups);
      saveJSON(LS_KEYS.GROUPS_SELECTED, state.filters.groups);
      // renderGroupOptions();
      // initFiltersUI();
      renderGroupManagerList();
      // renderFilterGroups();
      calendar?.refetchEvents();
    });
  });
}
function onGmAdd(){
  const input = document.getElementById('gmInput');
  const name = (input.value || '').trim();
  if(!name) return;
  if(state.groups.includes(name)){ alert('同名のグループが既にあります'); return; }
  state.groups.push(name);
  saveJSON(LS_KEYS.GROUPS, state.groups);
  // 追加したグループは自動で選択に含める（好みで変更可）
  if(!state.filters.groups.includes(name)){
    state.filters.groups.push(name);
    saveJSON(LS_KEYS.GROUPS_SELECTED, state.filters.groups);
  }
  input.value='';
  // renderGroupOptions();
  // initFiltersUI();
  renderGroupManagerList();
  renderFilterGroups();
  calendar?.refetchEvents();
}

function initCalendar(){
  const el = document.getElementById('fc');
  calendar = new FullCalendar.Calendar(el, {
    initialView: 'dayGridMonth',
    firstDay: 1,
    locale: 'ja',
    height: 'auto',
    dayMaxEventRows: 4,
    fixedWeekCount: true,
    headerToolbar: false,
  	dayCellContent: function(arg){
	  	return arg.date.getDate();
	  },

    datesSet: updateMonthLabel,
    events: fetchEvents,
    eventContent: renderEventContent,
    eventClick: handleEventClick,
  });
  calendar.render();
  updateMonthLabel();
}

function updateMonthLabel(){
  const d = calendar.getDate();
  $("#monthLabel").textContent = `${d.getFullYear()}年 ${d.getMonth()+1}月`;
}

// ====== イベント取得 ======
async function fetchEvents(info, success, failure){
  try {
    const params = new URLSearchParams({
      teamId: TEAM_ID,
      from: info.startStr,
      to: info.endStr,
    });
    // const type = $("#typeFilter").value;
    // const childId = $("#childFilter").value;
    const typeSel = $("#fdType");
    const childSel = $("#fdChild");
    const type = typeSel?.value || 'all';
    const childId = childSel?.value || 'all';


    if (type && type !== 'all') params.append('type', type);
    if (childId && childId !== 'all') params.append('childId', childId);

    const res = await safeFetch(`${BASE_URL}/calendar?${params.toString()}`);
    const evs = (res.events || mockEvents()).map(ev => {
      state.eventsCache.set(ev.id, ev);
      return {
        id: ev.id,
        title: ev.title,
        start: ev.start,
        end:   ev.end,
        extendedProps: {
          place: ev.place,
          type:  ev.type,
          //group: ev.group ?? "__UNGROUPED__",   // ← 未設定は特別トークンに,
          group: normalizeGroup(ev.group),
          summary: ev.summary,
          my: ev.my,
          unansweredCount: ev.unansweredCount
        }
      };
    });
    if (!state.children.length && res.children) {
      state.children = res.children;
      fillChildFilter(true);
    }
    // success(evs.filter(e => (e.extendedProps.my?.status || 'maybe') !== 'no'));
    // 欠席×は非表示
    let out = evs.filter(e => (e.extendedProps.my?.status || 'maybe') !== 'no');
    // グループ選択で絞り込み（未選択＝全件）
    const sel = state.filters.groups || [];
    if (sel.length > 0) {
      out = out.filter(e => sel.includes(e.extendedProps.group));
    }
    success(out);

  } catch (e) {
    console.error(e);
    failure(e);
  }
}

function renderEventContent(arg){
  const title = escapeHtml(arg.event.title || '');
  return { html: `<div class="fc-ev"><span class="title">${title}</span></div>` };
}

function handleEventClick(info){
  const evId = info.event.id;
  const ev = state.eventsCache.get(evId) || {
    id: evId,
    title: info.event.title,
    start: info.event.start?.toISOString(),
    end:   info.event.end?.toISOString() || info.event.start?.toISOString(),
    place: info.event.extendedProps.place,
    type:  info.event.extendedProps.type,
    summary: info.event.extendedProps.summary,
    unansweredCount: info.event.extendedProps.unansweredCount,
    my: info.event.extendedProps.my
  };
  openDialog(ev.id, ev);
}

// ====== 子どもフィルタ ======
async function fillChildFilter(force=false){
  //　const select = $("#childFilter");
  // 旧: const select = $("#childFilter");
  const select = $("#fdChild");

  if (!force && select.options.length>1) return;
  try {
    const res = await safeFetch(`${BASE_URL}/children?teamId=${TEAM_ID}`);
    const children = res.children || [{id:'C01',name:'長男'},{id:'C02',name:'次男'}];
    state.children = children;
  } catch(e){
    state.children = [{id:'C01',name:'長男'},{id:'C02',name:'次男'}];
  }
  state.children.forEach(c=>{
    const op=document.createElement('option');
    op.value=c.id; op.textContent=c.name;
    select.appendChild(op);
  });
}

// ====== モーダル ======
let currentEvent = null;
function openDialog(eventId, pre){
  const ev = pre || state.eventsCache.get(eventId);
  if(!ev) return;
  currentEvent = ev;
  $("#dTitle").textContent = ev.title;
  const dt = `${fmtD(new Date(ev.start))} ${fmtT(new Date(ev.start))}〜${fmtT(new Date(ev.end))}`;
  $("#dDateTime").textContent = dt;
  $("#dType").textContent = typeLabel(ev.type);
  const placeText = ev.place || '—';
  $("#dPlaceLink").textContent = placeText;
  $("#dPlaceLink").href = ev.place ? `https://maps.apple.com/?q=${encodeURIComponent(ev.place)}` : '#';
  $("#openMaps").href = $("#dPlaceLink").href;

  const status = ev.my?.status || 'maybe';
  document.querySelectorAll('input[name="rsvp"]').forEach(r=>r.checked=(r.value===status));
  $("#dNote").value = ev.my?.note || '';

  $("#dSummary").innerHTML = renderSummary(ev);
  $("#dAssignments").innerHTML = renderAssignments(ev);

  const dlg = $("#eventDialog");
  if(typeof dlg.showModal==='function') dlg.showModal(); else dlg.setAttribute('open','');
}
function renderSummary(ev){
  const s = ev.summary || { yes:0, no:0, maybe:0 };
  return `<div>参加: ${s.yes}　/　欠席: ${s.no}　/　未定: ${s.maybe}</div>`;
}
function renderAssignments(ev){
  const a = ev.assignments || [];
  if(!a.length) return '<div>担当：なし</div>';
  return '<ul>'+a.map(x=>`<li>${escapeHtml(x.role)}：${escapeHtml(x.name)}</li>`).join('')+'</ul>';
}

// ====== 保存 ======
async function saveRSVP(){
  if(!currentEvent) return;
  const status = document.querySelector('input[name="rsvp"]:checked')?.value || 'maybe';
  const note = $("#dNote").value || '';

  const payload = { teamId: TEAM_ID, eventId: currentEvent.id, userId: state.profile.userId, status, note };
  await safeFetch(`${BASE_URL}/events/${currentEvent.id}/rsvp`, {
    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)
  });

  currentEvent.my = { status, note };
  state.eventsCache.set(currentEvent.id, currentEvent);
  toast('保存しました');
  calendar.refetchEvents();
}

// ====== 共有 ======
async function shareToChat(){
  if(!currentEvent) return;
  if(!liff.isApiAvailable('shareTargetPicker')){ toast('共有に未対応の環境'); return; }
  const text = `【出欠登録】${currentEvent.title}\n${fmtD(new Date(currentEvent.start))} ${fmtT(new Date(currentEvent.start))}〜\n\nあなたの出欠を登録してください👇`;
  const url  = location.origin + location.pathname + `?team_id=${encodeURIComponent(TEAM_ID)}&event_id=${encodeURIComponent(currentEvent.id)}`;
  await liff.shareTargetPicker([{ type:'text', text },{ type:'text', text:url }]);
}

// ====== 安全fetch（モック） ======
async function safeFetch(url, options={}){
  try {
    if(BASE_URL.startsWith('https://your.api.')) return mockFetch(url, options);
    const r = await fetch(url, options);
    if(!r.ok) throw new Error(`${r.status}`);
    return await r.json();
  } catch(e){
    console.error(e);
    return mockFetch(url, options);
  }
}

/* function mockEvents(){
  const base = new Date(); base.setHours(9,0,0,0);
  const e=(ofs, type, title, place, yes,no,maybe, my='maybe')=>{
    const s=new Date(base); s.setDate(1+ofs); const e=new Date(s); e.setHours(s.getHours()+2);
    return { id:`EVT${ofs}`, title, start:s.toISOString(), end:e.toISOString(), place, type,
             unansweredCount:maybe, children:[], assignments:[{role:'氷',name:'山田'},{role:'車出し',name:'田中'}],
             summary:{yes,no,maybe}, my:{status:my, note:''} };
  };
  return [ e(3,'match','U12 リーグ第5節','○○市総合G',8,4,3,'yes'),
           e(10,'practice','全体練習','△△小 学校G',4,2,9,'maybe'),
           e(15,'event','保護者会','クラブハウス',9,3,1,'no'),
           e(-1,'practice','前月末 練習','学校G',3,1,0,'yes'),
           e(32,'match','翌月 初戦','陸上競技場',2,0,1,'maybe') ];
} */
function mockEvents(){
  const base = new Date(); base.setHours(9,0,0,0);
  const e=(ofs, type, title, place, yes,no,maybe, my='maybe', group='A班')=>{
    const s=new Date(base); s.setDate(1+ofs); const e=new Date(s); e.setHours(s.getHours()+2);
    return { id:`EVT${ofs}`, title, start:s.toISOString(), end:e.toISOString(), place, type, group,
             unansweredCount:maybe, children:[], assignments:[{role:'氷',name:'山田'},{role:'車出し',name:'田中'}],
             summary:{yes,no,maybe}, my:{status:my, note:''} };
  };
  return [
    e(3,'match','U12 リーグ第5節','○○市総合G',8,4,3,'yes','A班'),
    e(10,'practice','全体練習','△△小 学校G',4,2,9,'maybe','B班'),
    e(15,'event','保護者会','クラブハウス',9,3,1,'no','A班'),
    e(-1,'practice','前月末 練習','学校G',3,1,0,'yes','B班'),
    e(32,'match','翌月 初戦','陸上競技場',2,0,1,'maybe','A班')
  ];
}

function mockFetch(url, options){
  const u = new URL(url, location.origin);
  if(u.pathname.endsWith('/calendar')) return Promise.resolve({ events: mockEvents(), children:[{id:'C01',name:'長男'},{id:'C02',name:'次男'}] });
  if(u.pathname.endsWith('/children')) return Promise.resolve({ children:[{id:'C01',name:'長男'},{id:'C02',name:'次男'}] });
  if(u.pathname.includes('/rsvp')) return Promise.resolve({ ok:true });
  return Promise.resolve({});
}


// フィルタモーダル
$("#filterBtn").addEventListener('click', openFilterDialog);
$("#fdClose").addEventListener('click', () => $("#filterDialog").close());
$("#fdApply").addEventListener('click', applyFilters);

function openFilterDialog(){
  // 現在の選択値をモーダルのセレクトに反映（初回はデフォルトall）
  const dlg = $("#filterDialog");
  renderFilterGroups();  // ← 追加
  // 初回は子ども選択肢を埋める
  if ($("#fdChild").options.length <= 1 && state.children.length) {
    state.children.forEach(c=>{
      const op = document.createElement('option');
      op.value = c.id; op.textContent = c.name;
      $("#fdChild").appendChild(op);
    });
  }
  if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open','');
}

function applyFilters(){
  // グループ選択を収集して保存（空配列＝全選択扱い）
  const box = document.getElementById('fdGroups');
  if (box) {
    const selected = [...box.querySelectorAll('input[type="checkbox"]:checked')].map(cb=>cb.value);
    state.filters.groups = selected;
    saveJSON(LS_KEYS.GROUPS_SELECTED, state.filters.groups);
  }
  // 次回fetchで参照できるよう、値はDOMに残す（IDを fdChild/fdType に変更）
  $("#filterDialog").close();
  calendar?.refetchEvents();
  toast('フィルタを適用しました');
}


// // ヘルパ
// const $ = (q, el=document)=> el.querySelector(q);

// 起動時にイベントをバインド
function bindIconMenus() {
  const filterBtn = $("#filterBtn");
  const settingsBtn = $("#settingsBtn");

  // フィルタ：既存の filterDialog を開く
  if (filterBtn) {
    filterBtn.addEventListener('click', () => {
      const dlg = $("#filterDialog");
      if (!dlg) return console.warn('filterDialogが見つかりません');
      if (typeof dlg.showModal === 'function') dlg.showModal();
      else dlg.setAttribute('open','');
    });
  }

  // 設定：settingsDialog を開く
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      const dlg = $("#settingsDialog");
      if (!dlg) return console.warn('settingsDialogが見つかりません');
      if (typeof dlg.showModal === 'function') dlg.showModal();
      else dlg.setAttribute('open','');
    });
  }

  // 設定内の「グループ管理を開く」
  const sd = $("#settingsDialog");
  if (sd) {
    $("#sdClose")?.addEventListener('click', () => sd.close());
    sd.addEventListener('click', (e) => {
      const btn = e.target.closest('.settings-item');
      if (!btn) return;
      const sel = btn.dataset.open;
      if (sel) {
        const target = document.querySelector(sel);
        if (target) {
          sd.close();
          // ★グループダイアログを開く直前に一覧をレンダリング
          if (target.id === 'groupDialog') renderGroupManagerList();
          if (typeof target.showModal === 'function') target.showModal();
          else target.setAttribute('open','');
        } else {
          alert(`指定のダイアログが見つかりません: ${sel}`);
        }
      }
    });
  }
}

// どこかの初期化の最後で呼び出し
document.addEventListener('DOMContentLoaded', () => {
  bindIconMenus();
});


function mockFetch(url, options){
  const u = new URL(url, location.origin);

  // 追加: /groups
  if (u.pathname.endsWith('/groups')) {
    // 今はローカルの state.groups を返す
    return Promise.resolve({ groups: state.groups.map((name, i)=>({ id: String(i+1), name })) });
  }

  if (u.pathname.endsWith('/calendar')) return Promise.resolve({ events: mockEvents(), children:[{id:'C01',name:'長男'},{id:'C02',name:'次男'}] });
  if (u.pathname.endsWith('/children')) return Promise.resolve({ children:[{id:'C01',name:'長男'},{id:'C02',name:'次男'}] });
  if (u.pathname.includes('/rsvp')) return Promise.resolve({ ok:true });
  return Promise.resolve({});
}

function renderFilterGroups(){
  const box = document.getElementById('fdGroups');
  if (!box) return;
  box.innerHTML = '';
  // // なければ「未設定」を表示
  // if (!state.groups || state.groups.length === 0) {
  //   box.innerHTML = '<span style="color:var(--muted)">（グループ未登録）</span>';
  //   return;
  // }

  const selected = Array.isArray(state.filters.groups) ? state.filters.groups : [];

  // まず「未設定」特別チップ
  const chip0 = document.createElement('label');
  chip0.className = 'chip';
  chip0.innerHTML = `
    <input type="checkbox" value="__UNGROUPED__">
    <span>未設定</span>
  `;
  chip0.querySelector('input').checked = selected.length === 0 ? true : selected.includes('__UNGROUPED__');
  box.appendChild(chip0);

  // 2) 登録済みグループがなければここで終わり
  if (!state.groups || state.groups.length === 0) {
    return;
  }

  state.groups.forEach(name=>{
    const id = `g_${name}`;
    const wrap = document.createElement('label');
    wrap.className = 'chip';
    wrap.innerHTML = `
      <input type="checkbox" id="${id}" value="${escapeHtml(name)}">
      <span>${escapeHtml(name)}</span>
    `;
    const cb = wrap.querySelector('input');
    cb.checked = state.filters.groups.length === 0
      ? true  // 何も選んでいない＝全選択扱い
      : state.filters.groups.includes(name);
    box.appendChild(wrap);
  });
}

function normalizeGroup(name){
  if (!name) return "__UNGROUPED__";
  return state.groups.includes(name) ? name : "__UNGROUPED__";
}
