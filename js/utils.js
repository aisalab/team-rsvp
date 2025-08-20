// 汎用ユーティリティ集
export const $ = (sel, el=document) => el.querySelector(sel);

export function escapeHtml(s=''){
  return s.replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
}

export function toast(msg){
  const t=$("#toast"); if(!t) return;
  t.textContent=msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),1800);
}

export function fmtD(d, tz='Asia/Tokyo'){
  return d.toLocaleDateString('ja-JP',{year:'numeric',month:'long',day:'numeric', timeZone:tz});
}
export function fmtT(d, tz='Asia/Tokyo'){
  return d.toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:tz});
}
export const typeLabel = (t)=> t==='match'?'試合':t==='practice'?'練習':'イベント';
