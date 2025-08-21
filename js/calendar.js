// FullCalendar 初期化とデータ供給
import { $, escapeHtml } from './utils.js';
import { TEAM_ID,BASE_URL } from './config.js';
import { state } from './state.js';
import { safeFetch, normalizeGroup } from './api.js';
import { openEventDialog } from './ui.events.js';
import { openRsvpDialog } from './ui.events.js';

let calendar;

export function initCalendar(){
  const el = $("#fc");
  calendar = new FullCalendar.Calendar(el, {
    initialView: 'dayGridMonth',
    firstDay: 1,
    locale: 'ja',
    height: 'auto',
    dayMaxEventRows: 4,
    fixedWeekCount: true,
    headerToolbar: false,
    dayCellContent: (arg)=> arg.date.getDate(),
    //datesSet: updateMonthLabel,
    // 表示月が変わるたびに「年月」表示を更新
    datesSet: (info) => updateMonthLabel(info),
    events: fetchEvents,
    eventContent: renderEventContent,
    eventClick: (info)=> {
      const evId = info.event.id;
      const pre = {
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
      openEventDialog(evId, pre);
        eventClick: (info)=>{
    const ev = info.event;
    // 必要な最小情報だけ組み立て
    openRsvpDialog({
      id: ev.id,
      title: ev.title,
      start: ev.start,
      end: ev.end,
      allDay: ev.allDay,
      place: ev.extendedProps?.place
    });
  }
    },
  });
  calendar.render();
  //updateMonthLabel();
  //updateMonthLabel({ start: calendar.getDate() });
  updateMonthLabel({ view: calendar.view });

  // フィルタ変更で再取得
  document.addEventListener('filters:changed', ()=> calendar?.refetchEvents());

  return calendar; // ← 追加：インスタンスを返す
}

// function updateMonthLabel(arg){
//   //const d = calendar.getDate();
//   // datesSet から渡る start を優先、なければ現在日付
//  const d = arg?.start || calendar.getDate();
//   $("#monthLabel").textContent = `${d.getFullYear()}年 ${d.getMonth()+1}月`;
// }
function updateMonthLabel(info){
  // 月ラベルは「ビューの先頭日」で判定する（前月末に引っ張られない）
  const d = info?.view?.currentStart || calendar.getDate();
  const y = d.getFullYear();
  const m = d.getMonth() + 1; // getMonth() は 0 始まりなので +1 でOK
  $("#monthLabel").textContent = `${y}年 ${m}月`;
 }

async function fetchEvents(info, success, failure){
  try {
    const params = new URLSearchParams({
      teamId: TEAM_ID,
      from: info.startStr,
      to: info.endStr,
    });

    const res = await safeFetch(`${BASE_URL}/calendar?${params.toString()}`);
    const evs = (res.events || []).map(ev => {
      state.eventsCache.set(ev.id, ev);
      return {
        id: ev.id,
        title: ev.title,
        start: ev.start,
        end:   ev.end,
        extendedProps: {
          place: ev.place,
          type:  ev.type,
          group: normalizeGroup(ev.group),
          summary: ev.summary,
          my: ev.my,
          unansweredCount: ev.unansweredCount
        }
      };
    });

    // 欠席×は非表示
    let out = evs.filter(e => (e.extendedProps.my?.status || 'maybe') !== 'no');
    // グループ絞り込み：選択ありなら含まれるもののみ。未選択なら全件。
    const sel = state.filters.groups || [];
    if (sel.length > 0) out = out.filter(e => sel.includes(e.extendedProps.group));

    // モックにフォールバック
    if (out.length === 0 && (!res.events || !res.events.length)) {
      success(out); // そのまま
    } else {
      success(out);
    }
  } catch (e) {
    console.error(e);
    failure(e);
  }
}

function renderEventContent(arg){
  const title = escapeHtml(arg.event.title || '');
  return { html: `<div class="fc-ev"><span class="title">${title}</span></div>` };
}

// fetchEvents の最後でクライアントフィルタ
function applyClientFilters(events){
  const { groups: selected, statuses, hideAbsent, myGroupsOnly } = state.filters || {};
  const myGroups = state.myGroups || [];

  return events.filter(ev=>{
    const g = normalizeGroup(ev.group); // 既存の未設定扱いロジック
    // グループ選択フィルタ
    if (selected && selected.length && !selected.includes(g) && g!=='(未設定)') return false;
    // 「自分のグループのみ」
    if (myGroupsOnly && myGroups.length){
      if (!g || g==='(未設定)' || !myGroups.includes(g)) return false;
    }
    // 出欠フィルタ（既存）
    if (hideAbsent && ev.status==='×') return false;
    return true;
  });
}

// 外部からイベントを再取得してカレンダーをリロード
export async function refetchCalendar(){
  if (calendarInstance) {
    await calendarInstance.refetchEvents();
  }
}