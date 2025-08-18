// ====== 設定 ======
const LIFF_ID   = 'https://miniapp.line.me/2007941730-gGwPVonW'; // ← LINE DevelopersのミニアプリID（=LIFF ID）に置き換えてください
const TEAM_ID   = new URLSearchParams(location.search).get('team_id') || 'T01';
const BASE_URL  = 'https://your.api.example.com'; // バックエンドAPI。未用意ならモックが動きます
const TZ        = 'Asia/Tokyo';

// ====== ユーティリティ ======
const $ = (s)=>document.querySelector(s);
const fmtD = (d)=>d.toLocaleDateString('ja-JP',{year:'numeric',month:'long',day:'numeric', timeZone:TZ});
const fmtT = (d)=>d.toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:TZ});
const pad2 = (n)=>n.toString().padStart(2,'0');
function toLocalISO(date){ // YYYY-MM-DDTHH:mm:ss+09:00
  const y=date.getFullYear(), m=pad2(date.getMonth()+1), d=pad2(date.getDate());
  const hh=pad2(date.getHours()), mm=pad2(date.getMinutes());
  return `${y}-${m}-${d}T${hh}:${mm}:00+09:00`;
}
function toast(msg){ const t=$("#toast"); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),1800); }

// ====== 状態 ======
let state = {
  month: new Date(), // 表示中の月
  profile: null,
  events: [],         // {id,title,start,end,place,type,unansweredCount,my:{status,note}}
  children: []        // 子どもの候補（フィルタ用）
};

// ====== 起動 ======
/* - document.addEventListener('DOMContentLoaded', init);
- async function init(){
-   await liff.init({ liffId: LIFF_ID });
-   if(!liff.isLoggedIn()) liff.login({});
-
-   const profile = await liff.getProfile();
-   state.profile = profile;
-   $("#userName").textContent = profile.displayName || '保護者';
-   $("#userAvatar").src = profile.pictureUrl || '';
-
-   bindUI();
-   await loadMonth();
- } */
 document.addEventListener('DOMContentLoaded', init);
 async function init(){
   // プロフィールが取れなくても描画は進める
   state.profile = { displayName: '保護者', userId: 'anonymous' };
   try {
     await liff.init({ liffId: LIFF_ID });
     if (!liff.isLoggedIn()) {
       // ミニアプリ内なら通常自動ログインだが、万一のため
       liff.login({});
       return; // リダイレクトされるので一旦終了
     }
     try {
       const profile = await liff.getProfile();
       state.profile = profile || state.profile;
       $("#userName").textContent = state.profile.displayName || '保護者';
       if (state.profile.pictureUrl) $("#userAvatar").src = state.profile.pictureUrl;
     } catch (e) {
       // プロフィール取れない（scope未設定/テスター外など）→既定値で続行
       console.warn('getProfile failed', e);
       $("#userName").textContent = state.profile.displayName;
     }
   } catch (e) {
     // liff.init自体が失敗（LIFF_ID違い等）→とりあえず描画続行
     console.warn('liff.init failed', e);
     $("#userName").textContent = state.profile.displayName;
   }
   bindUI();
   await loadMonth();
 }

// ====== UIイベント ======
function bindUI(){
  $("#prevBtn").addEventListener('click', ()=>{ shiftMonth(-1); });
  $("#nextBtn").addEventListener('click', ()=>{ shiftMonth( 1); });
  $("#childFilter").addEventListener('change', render);
  $("#typeFilter").addEventListener('change', render);
  $("#closeDialog").addEventListener('click', ()=>$("#eventDialog").close());
  $("#saveBtn").addEventListener('click', saveRSVP);
  $("#openInChat").addEventListener('click', shareToChat);
}

function shiftMonth(diff){
  const d = state.month;
  d.setMonth(d.getMonth()+diff);
  loadMonth();
}

// ====== データ取得 ======
async function loadMonth(){
  const y = state.month.getFullYear();
  const m = state.month.getMonth();
  const from = new Date(y, m, 1);
  const to   = new Date(y, m+1, 0, 23, 59);

  $("#monthLabel").textContent = `${y}年 ${m+1}月`;

  // API: 月間イベント取得
  const qs = new URLSearchParams({
    teamId: TEAM_ID,
    from: toLocalISO(from),
    to:   toLocalISO(to),
  }).toString();

  const url = `${BASE_URL}/calendar?${qs}`;
  const res = await safeFetch(url);
  state.events   = res.events || [];
  state.children = res.children || [];
  fillChildFilter();
  render();
}

function fillChildFilter(){
  const select = $("#childFilter");
  // すでに埋めてあればスキップ
  if(select.options.length>1) return;
  state.children.forEach(c=>{
    const op=document.createElement('option');
    op.value=c.id; op.textContent=c.name;
    select.appendChild(op);
  });
}

// ====== 描画 ======
function render(){
  const grid = $("#grid");
  grid.innerHTML = '';
  const y = state.month.getFullYear();
  const m = state.month.getMonth();
  const first = new Date(y, m, 1);
  const startIdx = first.getDay(); // 0=日
  const lastDay  = new Date(y, m+1, 0).getDate();

  // 42セル固定（6週）
  const cells = 42;
  for(let i=0;i<cells;i++){
    const cell = document.createElement('div');
    cell.className = 'cell';

    const dayNum = i - startIdx + 1;
    const inMonth = dayNum>=1 && dayNum<=lastDay;

    const dateLabel = document.createElement('div');
    dateLabel.className = 'date';
    if(inMonth) dateLabel.textContent = `${dayNum}`;
    else dateLabel.style.visibility='hidden';
    cell.appendChild(dateLabel);

    if(inMonth){
      // その日のイベント
      const dayEvents = filteredEventsFor(y,m,dayNum);
      // 自分のステータス小バッジ
      const badges = document.createElement('div'); badges.className='badges';
      const counts = {yes:0,no:0,maybe:0};
      dayEvents.forEach(ev=>{ if(ev.my?.status) counts[ev.my.status]++; });
      Object.entries(counts).forEach(([k,v])=>{
        if(v>0){ const b=document.createElement('span'); b.className=`badge b-${k}`; b.textContent=`${labelOf(k)}×${v}`; badges.appendChild(b); }
      });
      if(badges.childElementCount) cell.appendChild(badges);

      dayEvents.forEach(ev=>{
        const el = document.createElement('button');
        el.className='event';
        el.innerHTML = `<span class="title">${escapeHtml(ev.title)}</span>
                        <span class="time">${hhmm(ev.start)}〜${hhmm(ev.end)}</span>`;
        el.addEventListener('click', ()=>openDialog(ev.id));
        cell.appendChild(el);
        if(ev.unansweredCount>0){
          const dot = document.createElement('span'); dot.className='dot'; cell.appendChild(dot);
        }
      });
    }
    grid.appendChild(cell);
  }
}
function filteredEventsFor(y,m,day){
  const type = $("#typeFilter").value;
  const childId = $("#childFilter").value;
  return state.events.filter(ev=>{
    const d = new Date(ev.start);
    const inDay = d.getFullYear()===y && d.getMonth()===m && d.getDate()===day;
    if(!inDay) return false;
    if(type!=='all' && ev.type!==type) return false;
    if(childId!=='all' && !(ev.children||[]).includes(childId)) return false;
    return true;
  });
}
function hhmm(iso){ const d=new Date(iso); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
function labelOf(k){ return k==='yes'?'○':k==='no'?'×':'△'; }
function escapeHtml(s=''){ return s.replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }

// ====== 詳細モーダル ======
let currentEvent = null;
async function openDialog(eventId){
  const ev = state.events.find(e=>e.id===eventId);
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

  // 自分の出欠初期値
  const status = ev.my?.status || 'maybe';
  document.querySelectorAll('input[name="rsvp"]').forEach(r=>r.checked=(r.value===status));
  $("#dNote").value = ev.my?.note || '';

  // 集計
  $("#dSummary").innerHTML = renderSummary(ev);
  $("#dAssignments").innerHTML = renderAssignments(ev);

  const dlg = $("#eventDialog");
  if(typeof dlg.showModal==='function') dlg.showModal(); else dlg.setAttribute('open','');
}
function typeLabel(t){ return t==='match'?'試合':t==='practice'?'練習':'イベント'; }
function renderSummary(ev){
  const s = ev.summary || { yes:0, no:0, maybe:0 };
  return `
    <div>参加: ${s.yes}　/　欠席: ${s.no}　/　未定: ${s.maybe}</div>
  `;
}
function renderAssignments(ev){
  const a = ev.assignments || [];
  if(!a.length) return '<div>担当：なし</div>';
  return '<ul>'+a.map(x=>`<li>${escapeHtml(x.role)}：${escapeHtml(x.name)}</li>`).join('')+'</ul>';
}

// ====== RSVP保存 ======
async function saveRSVP(){
  if(!currentEvent) return;
  const status = document.querySelector('input[name="rsvp"]:checked')?.value || 'maybe';
  const note = $("#dNote").value || '';

  const payload = {
    teamId: TEAM_ID,
    eventId: currentEvent.id,
    userId: state.profile.userId, // LIFFのプロフィールID
    status, note
  };

  await safeFetch(`${BASE_URL}/events/${currentEvent.id}/rsvp`, {
    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)
  });

  // 画面の即時反映
  currentEvent.my = { status, note };
  toast('保存しました');
  render();

  // （任意）トークにも共有：トーク内起動 + chat_message.write スコープが必要
  // try { await liff.sendMessages([{ type:'text', text:`${state.profile.displayName}：${currentEvent.title} を ${labelOf(status)} で登録しました` }]); } catch(_){}
}

// ====== トークに共有（Share Target Picker） ======
async function shareToChat(){
  if(!currentEvent) return;
  if(!liff.isApiAvailable('shareTargetPicker')){ toast('共有に未対応の環境'); return; }
  const text = `【出欠登録】${currentEvent.title}\n${fmtD(new Date(currentEvent.start))} ${fmtT(new Date(currentEvent.start))}〜\n\nあなたの出欠を登録してください👇`;
  const url  = location.origin + location.pathname + `?team_id=${encodeURIComponent(TEAM_ID)}&event_id=${encodeURIComponent(currentEvent.id)}`;
  await liff.shareTargetPicker([
    { type:'text', text },
    { type:'text', text:url }
  ]);
}

// ====== 安全fetch（モック付き） ======
async function safeFetch(url, options={}){
  try {
    // 本番APIが未用意ならモックにフォールバック
    if(BASE_URL.startsWith('https://your.api.')) return mockFetch(url, options);
    const r = await fetch(url, options);
    if(!r.ok) throw new Error(`${r.status}`);
    return await r.json();
  } catch(e){
    console.error(e);
    toast('通信に失敗しました');
    // モック返し
    return mockFetch(url, options);
  }
}

// ====== モックAPI ======
function mockFetch(url, options){
  const u = new URL(url);
  if(u.pathname.endsWith('/calendar')){
    // ダミーイベント3件
    const base = new Date(); base.setHours(9,0,0,0);
    const e=(ofs, type, title, place, yes,no,maybe, my='maybe')=>{
      const s=new Date(base); s.setDate(1+ofs); const e=new Date(s); e.setHours(s.getHours()+2);
      return {
        id:`EVT${ofs}`, title, start:s.toISOString(), end:e.toISOString(),
        place, type, unansweredCount:maybe, children:[], assignments:[{role:'氷',name:'山田'},{role:'車出し',name:'田中'}],
        summary:{yes,no,maybe}, my:{status:my, note:''}
      };
    };
    return Promise.resolve({
      events:[
        e(3,'match','U12 リーグ第5節','○○市総合G',8,4,3,'yes'),
        e(10,'practice','全体練習','△△小 学校G',4,2,9,'maybe'),
        e(15,'event','保護者会','クラブハウス',9,3,1,'no'),
      ],
      children:[{id:'C01',name:'長男'},{id:'C02',name:'次男'}]
    });
  }
  if(u.pathname.includes('/rsvp')){ return Promise.resolve({ ok:true }); }
  return Promise.resolve({});
}
