# 変形菌フィールドノート / Myxomycete Field Notes

iPhone Safari向けのオフライン対応フィールドノートPWAです。採集記録、GPS位置・標高、写真（野外・子実体・顕微鏡・その他）、測定値、CSV/ZIP出力、JSONバックアップを扱います。

## 使い方

HTTPSでホストしたページをSafariで開き、「ホーム画面に追加」してください。最初の読み込み後、アプリ本体はService Workerによってキャッシュされます。記録と写真は各端末のIndexedDBに保存され、サーバーには送信されません。

調査後は「出力」画面からCSV・写真付きZIPを保存してください。端末内データの永続性は保証されないため、定期的なバックアップを推奨します。

## GitHub Pages

リポジトリの **Settings → Pages → Build and deployment → Deploy from a branch → main / (root)** を設定すると公開できます。`index.html`, `app.js`, `sw.js`, `manifest.webmanifest`, `icon.svg` をルートに置いています。

## 注意

GPSと標高の取得には利用者の許可が必要です。標高・垂直精度は端末や環境によって取得できない場合があります。現地での動作確認を行ってから本調査に利用してください。
