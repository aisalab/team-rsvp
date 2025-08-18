// Minimal app.js with the new render() to demonstrate contiguous days and fixed date header.
const LIFF_ID   = 'YOUR_LIFF_ID_HERE';
const TEAM_ID   = 'T01';
const BASE_URL  = 'https://your.api.example.com';
const TZ        = 'Asia/Tokyo';

const $ = (s)=>document.querySelector(s);
const pad2 = (n)=>n.toString().padStart(2,'0');
function fmtD(d){ return d.toLocaleDateString('ja-JP',{year:'numeric',month:'long',day:'numeric', timeZone:TZ}); }
function fmtT(d){ return d.toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:TZ}); }
function labelOf(k){ return k==='yes'?'○':k==='no'?'×':'△'; }
function hhmm(iso){ const d=new Date(iso); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
function escapeHtml(s=''){ return s.replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }
function toLocalISO(date){ const y=date.getFullYear(), m=pad2(date.getMonth()+1), d=pad2(date.getDate());
  const hh=pad2(date.getHours()), mm=pad2(date.getMinutes()); return `${y}-${m}-${d}T${hh}:${mm}:00+09:00`; }
function toast(msg){ const t=$("#toast"); if(!t) return; t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),1800); }

let state={ month:new Date(), profile:{displayName:'保護者',userId:'anonymous'}, events:[], children:[] };

document.addEventListener('DOMContentLoaded', async ()=>{
  bindUI();
  await loadMonth();
});

function bindUI(){
  const prevBtn = $("#prevBtn"), nextBtn = $("#nextBtn");
  if(prevBtn) prevBtn.addEventListener('click', ()=>{ shiftMonth(-1); });
  if(nextBtn) nextBtn.addEventListener('click', ()=>{ shiftMonth( 1); });
}
function shiftMonth(diff){ const d=state.month; d.setMonth(d.getMonth()+diff); loadMonth(); }

async function loadMonth(){
  const y = state.month.getFullYear();
  const m = state.month.getMonth();
  const from = new Date(y, m, 1);
  const to   = new Date(y, m+1, 0, 23, 59);
  const monthLabel = $("#monthLabel"); if(monthLabel) monthLabel.textContent = `${y}年 ${m+1}月`;

  // Mock events so UI shows something
  state.events = mockEvents();
  render();
}

function render(){
  const grid = $("#grid");
  grid.innerHTML = '';
  const y = state.month.getFullYear();
  const m = state.month.getMonth();

  const first = new Date(y, m, 1);
  const startIdx = (first.getDay() + 6) % 7; // Monday-start
  const startDate = new Date(y, m, 1 - startIdx);

  for(let i=0;i<42;i++){
    const d = new Date(startDate); d.setDate(startDate.getDate() + i);
    const cell = document.createElement('div'); cell.className='cell';
    if (d.getMonth()!==m) cell.classList.add('out');

    const header = document.createElement('div'); header.className='date-row';
    const dateLabel = document.createElement('div'); dateLabel.className='date'; dateLabel.textContent = `${d.getDate()}`;
    const badges = document.createElement('div'); badges.className='badges';
    header.appendChild(dateLabel); header.appendChild(badges);
    cell.appendChild(header);

    const evWrap = document.createElement('div'); evWrap.className='events'; cell.appendChild(evWrap);

    const dayEvents = state.events.filter(ev=>{
      const sd = new Date(ev.start);
      return sd.getFullYear()===d.getFullYear() && sd.getMonth()===d.getMonth() && sd.getDate()===d.getDate();
    });

    const counts = {yes:0,no:0,maybe:0};
    dayEvents.forEach(ev=>{ if(ev.my?.status) counts[ev.my.status]++; });
    Object.entries(counts).forEach(([k,v])=>{ if(v>0){ const b=document.createElement('span'); b.className=`badge b-${k}`; b.textContent=`${labelOf(k)}×${v}`; badges.appendChild(b); }});

    dayEvents.forEach(ev=>{
      const el = document.createElement('button');
      el.className='event';
      el.innerHTML = `<span class="title">${escapeHtml(ev.title)}</span><span class="time">${hhmm(ev.start)}〜${hhmm(ev.end)}</span>`;
      evWrap.appendChild(el);
    });

    const unanswered = dayEvents.reduce((acc,ev)=>acc + (ev.unansweredCount||0), 0);
    if(unanswered>0){ const dot=document.createElement('span'); dot.className='dot'; cell.appendChild(dot); }

    grid.appendChild(cell);
  }
}

// Mock data
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
