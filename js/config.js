// 設定・定数を一元管理
export const LIFF_ID  = 'https://miniapp.line.me/2007941730-gGwPVonW'; // ← そのまま
export const TEAM_ID  = new URLSearchParams(location.search).get('team_id') || 'T01';
export const BASE_URL = 'https://miniapp-firestore-api-978580566817.asia-northeast1.run.app';
export const TZ       = 'Asia/Tokyo';
