// イベント詳細ダイアログ（表示／保存／共有）
import { $, fmtD, fmtT, typeLabel, toast } from './utils.js';
import { TZ, TEAM_ID, BASE_URL } from './config.js';
import { state } from './state.js';
import { safeFetch } from './api.js';
import { refetchCalendar } from './calendar.js'; // カレンダー再読込の関数があれば利用

export function bindEventDialogUI(){
  // 追加ボタン → 作成ダイアログ
  $("#addEventBtn")?.addEventListener('click', ()=>{
    openEventEditor(); // 空で開く
  });

  $("#eedClose")?.addEventListener('click', ()=> $("#eventEditDialog")?.close());
  $("#eedSave")?.addEventListener('click', onSaveEvent);

  // RSVP ダイアログ
  $("#rdClose")?.addEventListener('click', ()=> $("#rsvpDialog")?.close());
  $("#rdSubmit")?.addEventListener('click', onSubmitRsvp);
}

// === イベント作成 ===
function openEventEditor(ev=null){
  $("#eedTitle").textContent = ev ? "スケジュール編集" : "スケジュール作成";
  $("#evTitle").value   = ev?.title || '';
  $("#evPlace").value   = ev?.place || '';
  $("#evNote").value    = ev?.note  || '';
  $("#evAllDay").checked = !!ev?.allDay;
  // 既定は「今から2時間」
  const now = new Date(); const after2h = new Date(now.getTime()+2*3600*1000);
  $("#evStart").value = toLocalInputValue(ev?.start || now);
  $("#evEnd").value   = toLocalInputValue(ev?.end   || after2h);
  // グループ候補埋め込み
  const sel = $("#evGroups"); sel.innerHTML = '';
  (state.groups || []).forEach(g=>{
    const opt = document.createElement('option');
    opt.value = g; opt.textContent = g;
    if (ev?.groups?.includes?.(g)) opt.selected = true;
    sel.appendChild(opt);
  });
  $("#evNeedRsvp").checked = ev?.needRsvp ?? true;
  $("#evDeadline").value = toLocalInputValue(ev?.deadline || after2h);

  $("#eventEditDialog").showModal();
}

async function onSaveEvent(){
  const title = $("#evTitle").value.trim();
  if (!title){ toast('タイトルを入力してください'); return; }

  const allDay = $("#evAllDay").checked;
  const start = fromLocalInputValue($("#evStart").value);
  const end   = fromLocalInputValue($("#evEnd").value);
  if (!allDay && start >= end){ toast('終了は開始より後にしてください'); return; }

  const payload = {
    title,
    allDay,
    start: start.toISOString(),
    end:   end.toISOString(),
    place: $("#evPlace").value.trim(),
    note:  $("#evNote").value.trim(),
    groups: [...$("#evGroups").selectedOptions].map(o=>o.value),
    needRsvp: $("#evNeedRsvp").checked,
    deadline: fromLocalInputValue($("#evDeadline").value)?.toISOString()
  };

  try{
    await apiCreateEvent(TEAM_ID, payload);
    $("#eventEditDialog").close();
    // カレンダー再読込（あなたの実装に合わせて）
    document.dispatchEvent(new CustomEvent('filters:changed'));
    toast('保存しました');
  }catch(e){
    console.error(e); toast('保存に失敗しました');
  }
}

// === RSVP ===
let currentEventId = null;

export function openRsvpDialog(evData){
  currentEventId = evData.id;
  $("#rdTitle").textContent = evData.title || '出欠回答';
  const when = fmtDateRange(new Date(evData.start), new Date(evData.end), evData.allDay);
  $("#rdWhenWhere").textContent = `${when} / ${evData.place || ''}`;
  $("#rdNote").value = '';
  // 既存回答の初期化が必要ならここで status を選択
  $("#rsvpDialog").showModal();
}

async function onSubmitRsvp(){
  const status = [...document.querySelectorAll('input[name="rsvpStatus"]')]
    .find(r=>r.checked)?.value || '○';
  const note = $("#rdNote").value.trim();

  try{
    await apiSendRsvp(TEAM_ID, currentEventId, status, note);
    $("#rsvpDialog").close();
    // RSVP 反映を見せたい場合は再読み込み
    document.dispatchEvent(new CustomEvent('filters:changed'));
    toast('送信しました');
  }catch(e){
    console.error(e); toast('送信に失敗しました');
  }
}

// === ユーティリティ ===
function toLocalInputValue(d){
  const dt = (d instanceof Date) ? d : new Date(d);
  const tz = dt.getTimezoneOffset() * -1; // 分
  const local = new Date(dt.getTime());
  // <input type="datetime-local"> は「ローカル時刻の文字列」が必要
  const pad = (n)=> String(n).padStart(2,'0');
  return `${local.getFullYear()}-${pad(local.getMonth()+1)}-${pad(local.getDate())}T${pad(local.getHours())}:${pad(local.getMinutes())}`;
}
function fromLocalInputValue(s){
  if (!s) return null;
  // ブラウザはローカル時刻で解釈する
  return new Date(s);
}



let currentEvent = null;

export function bindEventDialog(){
  $("#closeDialog")?.addEventListener('click', ()=> $("#eventDialog").close());
  $("#saveBtn")?.addEventListener('click', saveRSVP);
  $("#openInChat")?.addEventListener('click', shareToChat);
}

export function openEventDialog(evId, preFilled){
  const ev = preFilled || state.eventsCache.get(evId);
  if(!ev) return;
  currentEvent = ev;

  $("#dTitle").textContent = ev.title;
  const dt = `${fmtD(new Date(ev.start), TZ)} ${fmtT(new Date(ev.start), TZ)}〜${fmtT(new Date(ev.end), TZ)}`;
  $("#dDateTime").textContent = dt;
  $("#dType").textContent  = typeLabel(ev.type);
  const placeText = ev.place || '—';
  $("#dPlaceLink").textContent = placeText;
  $("#dPlaceLink").href = ev.place ? `https://maps.apple.com/?q=${encodeURIComponent(ev.place)}` : '#';
  $("#openMaps").href = $("#dPlaceLink").href;

  const status = ev.my?.status || 'maybe';
  document.querySelectorAll('input[name="rsvp"]').forEach(r=> r.checked = (r.value===status));
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
  return '<ul>'+a.map(x=>`<li>${x.role}：${x.name}</li>`).join('')+'</ul>';
}

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
  document.dispatchEvent(new Event('filters:changed')); // 再取得トリガ
}

async function shareToChat(){
  if(!currentEvent) return;
  if(!liff.isApiAvailable('shareTargetPicker')){ toast('共有に未対応の環境'); return; }
  const text = `【出欠登録】${currentEvent.title}\n${fmtD(new Date(currentEvent.start), TZ)} ${fmtT(new Date(currentEvent.start), TZ)}〜\n\nあなたの出欠を登録してください👇`;
  const url  = location.origin + location.pathname + `?team_id=${encodeURIComponent(TEAM_ID)}&event_id=${encodeURIComponent(currentEvent.id)}`;
  await liff.shareTargetPicker([{ type:'text', text },{ type:'text', text:url }]);
}
