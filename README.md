# スポ少 出欠カレンダー（FullCalendar版・LINEミニアプリ用フロント）
FullCalendar を採用した月間カレンダーUIの完成版です。LIFF連携・出欠モーダル・API連携（モック対応）込み。

## 手順
1. LINE Developers の **ミニアプリID（= LIFF ID）** を取得
2. `app.js` の `LIFF_ID` を置き換え
3. GitHubにアップ → **GitHub Pages** を有効化（https）
4. 発行URLを **エンドポイントURL** に設定
5. テスター登録してLINEで起動

## API
- `GET /calendar?teamId&from&to[&type][&childId]`
- `POST /events/{id}/rsvp`
- `GET /children?teamId=...`
`BASE_URL` が `https://your.api...` のままならモックで動きます。
