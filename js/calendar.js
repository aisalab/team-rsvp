// FullCalendar 初期化とデータ供給
import { $, escapeHtml } from './utils.js';
import { TEAM_ID,BASE_URL } from './config.js';
import { state } from './state.js';
import { safeFetch, normalizeGroup } from './api.js';
import { openEventDialog } from './ui.events.js';

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
    datesSet: updateMonthLabel,
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
    },
  });
  calendar.render();
  updateMonthLabel();

  // フィルタ変更で再取得
  document.addEventListener('filters:changed', ()=> calendar?.refetchEvents());

  return calendar; // ← 追加：インスタンスを返す
}

function updateMonthLabel(){
  const d = calendar.getDate();
  $("#monthLabel").textContent = `${d.getFullYear()}年 ${d.getMonth()+1}月`;
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
