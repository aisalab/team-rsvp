// ====== 設定 ======
const LIFF_ID   = 'https://miniapp.line.me/2007941730-gGwPVonW'; // ← ミニアプリID（=LIFF ID）に置き換え
const TEAM_ID   = new URLSearchParams(location.search).get('team_id') || 'T01';
const BASE_URL  = 'https://your.api.example.com'; // バックエンドAPI。未用意ならモックが動作
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

// ====== 状態 ======
let state = {
  profile: { displayName: '保護者', userId: 'anonymous' },
  children: [],
  eventsCache: new Map()
};

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
}

// ====== UIイベント ======
function bindUI(){
  $("#prevBtn").addEventListener('click', ()=> calendar?.prev());
  $("#nextBtn").addEventListener('click', ()=> calendar?.next());
  $("#typeFilter").addEventListener('change', ()=> calendar?.refetchEvents());
  $("#childFilter").addEventListener('change', ()=> calendar?.refetchEvents());
  $("#closeDialog").addEventListener('click', ()=>$("#eventDialog").close());
  $("#saveBtn").addEventListener('click', saveRSVP);
  $("#openInChat").addEventListener('click', shareToChat);
}

// ====== FullCalendar 初期化 ======
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
    const type = $("#typeFilter").value;
    const childId = $("#childFilter").value;
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
    success(evs.filter(e => (e.extendedProps.my?.status || 'maybe') !== 'no'));
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
  const select = $("#childFilter");
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

function mockEvents(){
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
}
function mockFetch(url, options){
  const u = new URL(url, location.origin);
  if(u.pathname.endsWith('/calendar')) return Promise.resolve({ events: mockEvents(), children:[{id:'C01',name:'長男'},{id:'C02',name:'次男'}] });
  if(u.pathname.endsWith('/children')) return Promise.resolve({ children:[{id:'C01',name:'長男'},{id:'C02',name:'次男'}] });
  if(u.pathname.includes('/rsvp')) return Promise.resolve({ ok:true });
  return Promise.resolve({});
}
