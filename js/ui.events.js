// イベント詳細ダイアログ（表示／保存／共有）
import { $, fmtD, fmtT, typeLabel, toast } from './utils.js';
import { TZ, TEAM_ID, BASE_URL } from './config.js';
import { state } from './state.js';
import { safeFetch } from './api.js';

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
