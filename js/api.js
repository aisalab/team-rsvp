// 通信（safeFetch）とモック、グループ正規化
import { state } from './state.js';
import { BASE_URL } from './config.js';
import { getUserHeader } from './state.js'; // ← 既に userId を知る仕組みがあればそこから。無ければ後述。


export async function safeFetch(url, options={}){
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


//　ユーザのグループ
export async function apiGetMe(teamId){
  const r = await fetch(`${BASE_URL}/me?teamId=${encodeURIComponent(teamId)}`, {
    headers: { ...getUserHeader() }
  });
  if(!r.ok) throw new Error(`${r.status}`);
  return await r.json(); // {userId, groups:[]}
}

export async function apiSetMyGroups(teamId, groups, displayName=''){
  const r = await fetch(`${BASE_URL}/me/groups`, {
    method: 'PATCH',
    headers: { 'Content-Type':'application/json', ...getUserHeader() },
    body: JSON.stringify({ teamId, groups, displayName })
  });
  if(!r.ok) throw new Error(`${r.status}`);
  return await r.json(); // {ok:true}
}


//　グループ
export function normalizeGroup(name){
  if (!name) return '__UNGROUPED__';
  return state.groups.includes(name) ? name : '__UNGROUPED__';
}

export async function apiListGroups(teamId){
  const r = await safeFetch(`${BASE_URL}/groups?teamId=${encodeURIComponent(teamId)}`);
//  return r.groups || [];
  const raw = r.groups || [];
  // 文字列 or {name} の両方に対応して正規化
  return raw.map(g => (typeof g === 'string' ? g : g?.name)).filter(Boolean);
}

export async function apiAddGroup(teamId, name){
  return safeFetch(`${BASE_URL}/groups`, {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ teamId, name })
  });
}

export async function apiDeleteGroup(teamId, name){
  return safeFetch(`${BASE_URL}/groups/${encodeURIComponent(name)}?teamId=${encodeURIComponent(teamId)}`, {
    method: 'DELETE'
  });
}

export async function apiRenameGroup(teamId, oldName, newName){
  return safeFetch(`${BASE_URL}/groups/${encodeURIComponent(oldName)}`, {
    method: 'PATCH', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ teamId, newName })
  });
}

//　荷物
export async function apiListItems(teamId){
  const r = await safeFetch(`${BASE_URL}/items?teamId=${encodeURIComponent(teamId)}`);
  // 正規化（name, qty）
  return (r.items || []).map(it => ({
    name: String(it.name || ''),
    qty: Number(it.qty || 0)
  }));
}

export async function apiAddItem(teamId, name, qty){
  return safeFetch(`${BASE_URL}/items`, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ teamId, name, qty })
  });
}

export async function apiUpdateItem(teamId, oldName, { qty, newName }){
  return safeFetch(`${BASE_URL}/items/${encodeURIComponent(oldName)}`, {
    method: 'PATCH',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ teamId, qty, newName })
  });
}

export async function apiDeleteItem(teamId, name){
  return safeFetch(`${BASE_URL}/items/${encodeURIComponent(name)}?teamId=${encodeURIComponent(teamId)}`, {
    method: 'DELETE'
  });
}


// イベント作成
export async function apiCreateEvent(teamId, payload){
  return safeFetch(`${BASE_URL}/events`, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ teamId, ...payload })
  });
}

// 出欠回答
export async function apiSendRsvp(teamId, eventId, status, note){
  return safeFetch(`${BASE_URL}/rsvp`, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ teamId, eventId, status, note })
  });
}



// ---- モック ----
function mockEvents(){
  const base = new Date(); base.setHours(9,0,0,0);
  const e=(ofs, type, title, place, yes,no,maybe, my='maybe', group='A班')=>{
    const s=new Date(base); s.setDate(1+ofs); const e2=new Date(s); e2.setHours(s.getHours()+2);
    return { id:`EVT${ofs}`, title, start:s.toISOString(), end:e2.toISOString(), place, type, group,
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

export function mockFetch(url, options){
  const u = new URL(url, location.origin);
  if (u.pathname.endsWith('/calendar')) return Promise.resolve({ events: mockEvents(), children:[{id:'C01',name:'長男'},{id:'C02',name:'次男'}] });
  if (u.pathname.endsWith('/children')) return Promise.resolve({ children:[{id:'C01',name:'長男'},{id:'C02',name:'次男'}] });
  if (u.pathname.includes('/rsvp')) return Promise.resolve({ ok:true });
  if (u.pathname.endsWith('/groups')) return Promise.resolve({ groups: state.groups.map((name,i)=>({id:String(i+1), name})) });
  return Promise.resolve({});
}
