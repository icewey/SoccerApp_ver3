# ゴールキーパー実装修正プラン

作成日: 2026-06-04 / 対象: `js/main.js`

## 背景

GK実装はコミット `8cd431b`〜`60c4661` で一通り入っているが、ユーザー報告では「いまだに動かない」。
現状コードを精査した結果、**2つの実害バグ**を特定した。

## 診断（根本原因）

### Bug 1: 見た目のリグレッション（コミット `60c4661`）
- `60c4661`「GKロード処理をenemyと同一パターンに統一」が、その前の `0b54838` / `090cd84`
  で入れていた **スケール自動計算 + モデル別Y接地補正を削除** し、固定 `scale=0.01` ＋
  プレイヤーの `groundY` 流用に戻した。
- GKモデル `我牙丸吟的なキャラ（ゴールキーパー）/T-Pose.fbx` はMeshy単位系が他キャラと異なる
  （`0b54838` のコミットメッセージが明言）。固定 `0.01` だとサイズ不正、`groundY` 流用だと
  接地ズレ（浮く/埋まる）→ GKが見えない＝「実装されていない」ように見える。

### Bug 2: セーブ判定が遅延し必ず失点する（致命的ロジックバグ）
- `animate()` 内で `updateBall(dt)`（**ゴール判定を内包**, L1490）が `updateGK(...)`（L1510）より**先**に走る。
- `gkAttemptSave()` はセーブ成否を `triggerMs`（アニメ長の約50% ≒ 500ms）後の `setTimeout` で確定。
- その間ボールは毎フレーム前進し、500ms以内にゴールラインを越えて `scoreGoal()` が発火。
- 遅延タイマー発火時には `isGoalScene === true` で早期return → **確保が常に間に合わず、オンターゲットのシュートは100%失点**。GKは飾り状態。

## 修正方針

### Fix 1: `loadOneGK` でスケール自動計算 + Y接地補正を復元
- `fbx` 追加後にバウンディングボックスから身長を測り、`1.75m` になるよう `autoScale` を設定（単位系非依存で頑健）。
- 再計算した接地オフセットを `gkGroup.userData.gkGroundOffset` に保存。
- `onCoreLoaded()`（2箇所）と `resetAfterGoal()`（2箇所）のGK Y設定を
  `userData.gkGroundOffset ?? groundY` に戻す。

### Fix 2: `gkAttemptSave` を「接触の瞬間に即決定・即確保」へ
- 成否は呼ばれた瞬間に `Math.random() < GK_CATCH_CHANCE`（50%）で決定。
- **成功**: 即座に `gkBallHolder=ownerKey` / `ballVel=0` / `state='hold'` にしてボールを止める
  → ゴール判定より先に確保され失点しない。
- **失敗**: `state` を `save`/`dive` のまま維持 → ボールは通過して失点、アニメ終了時に
  既存の mixer `finished` リスナが `patrol` へ戻す。
- 遅延 `setTimeout` を廃止（stale-closure 懸念も同時に解消）。

### 仕様充足の確認（変更不要な既存実装）
- キャラ固定・両チーム同一モデル: OK（`loadOneGK` を両GKで使用）
- 正面=Catch / 左右=Diving Save: OK（`useDive = |Δz| > GK_DIVE_Z_THR`）
- 50%でキャッチ失敗: OK（`GK_CATCH_CHANCE = 0.50`、Fix 2で正しく機能化）
- キャッチ後1.5秒→最寄り味方へOverhand Throw（砲丸投げ風アーク）: OK（`gkDoThrow`、`hold→throw`）

## TODO

- [ ] Fix 1-a: `loadOneGK` にスケール自動計算（1.75m基準）を復元
- [ ] Fix 1-b: 接地オフセットを `userData.gkGroundOffset` に保存
- [ ] Fix 1-c: `onCoreLoaded()` のGK Y設定2箇所を `?? groundY` フォールバックに復元
- [ ] Fix 1-d: `resetAfterGoal()` のGK Y設定2箇所を同様に復元
- [ ] Fix 2: `gkAttemptSave` を即時決定・即確保ロジックに置換（setTimeout廃止）
- [ ] 構文チェック（node --check）
- [ ] コミット & GitHub へ push

## 検証

- ブラウザ実機での3D挙動確認はヘッドレス困難なため、`node --check js/main.js` で構文を担保。
- ロジックは座標系（プレイヤー=右ゴール+GOAL_X、CPU=左ゴール-GOAL_X）と整合済み。
