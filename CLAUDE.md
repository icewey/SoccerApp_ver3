# CLAUDE.md

このファイルは Claude Code がこのプロジェクトで作業する際の指示です。

## ⚠️ 最重要ルール: 実装したら必ず GitHub までプッシュする

- **コードを実装・修正したら、確認待ちをせず必ずコミットして `git push origin master` まで実行すること。**
- ユーザーがチャットで毎回「プッシュして」と書かなくても、実装完了 = コミット + プッシュ までが1セット。
- コミットメッセージは Conventional Commits 形式（`feat:` / `fix:` / `tweak:` / `revert:` など）+ 日本語の簡潔な説明。
- コミット前に `node --check js/main.js` で構文を確認する。

## プロジェクト概要

- 3Dサッカーゲーム（Three.js r0.169.0、バニラJS、ビルド工程なし）。
- メインロジックはほぼ `js/main.js`（大きな単一ファイル）。ロビーは `js/lobby.js`、リアル対戦同期は `js/multiplayer.js`（Firebase Realtime Database）。
- モード: ソロ(1vs1) / チーム戦(2vs2・3vs3) / リアル対戦(1vs1) / PK。
- リアル対戦は **ホスト権威モデル**（計算は全てHost、Guestは入力送信＋描画のみ）。

## 動作確認

- ブラウザで `index.html` を開いて確認。ヘッドレス検証は `python -m http.server 8099` + Playwright（`node_modules` 済み）。
- ヘッドレスでは rAF が間引かれるため、ゲーム内時間 ≠ 実時間。所有権などゲームプレイの検証は実機で行う。

## コーディング方針

- 既存の `js/main.js` のスタイル（コメント密度・命名・関数粒度）に合わせる。
- スキルFBXは `キャラ/<名>/Skill/<スキル>/` に配置。無ければ既定モーション。
