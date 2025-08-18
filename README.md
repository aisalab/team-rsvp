# スポ少 出欠カレンダー（LINEミニアプリ用フロント）

このフォルダは **GitHub Pages** などで公開できる「フロント（HTML/CSS/JS）」の雛形です。  
バックエンドAPIが未用意でも **モックデータで動作確認** できます。

## ファイル構成
- `index.html` … 画面本体（LIFF SDKを読み込み）
- `styles.css` … 見た目
- `app.js` … ロジック（カレンダー描画・LIFF初期化・RSVP保存など）

## 使い方（最短）
1. LINE Developers で **LINEミニアプリチャネル** を作成
2. チャネルの **ミニアプリID（= LIFF ID）** を取得
3. `app.js` の `LIFF_ID` を置き換え
4. このフォルダをGitHubにアップして **GitHub Pages** を有効化
5. 発行されたURLを **エンドポイントURL** に設定（https必須）

> バックエンドAPI（保存先）ができるまでの間は、`BASE_URL` が `https://your.api...` のあいだモックが返る設計です。

## API 仕様（最小）
- `GET /calendar?teamId=...&from=...&to=...`
- `POST /events/{id}/rsvp { teamId, userId, status, note }`

Apps Script / Firebase Functions どちらでもOKです。
