# 議論記録: MVP完了基準とPhase 10(エッジ編集)の追加

- 日付: 2026-07-12
- 相手: Claude (Fable 5)
- 位置づけ: MVP をどこで「完了」と区切るかの議論。結論は `10_decision_log.md` の 2026-07-12 エントリに反映済み

---

## 1. 前提の確認(セッション冒頭)

- 前回(2026-07-10)の結論の再確認: 分割は「UI(React) / Player(再生系) / Analyzer(解析系) / それらをつなぐ TypeScript インターフェース」。差し替え対象は Analyzer のみで、Player は永続的に JS + Web Audio
- 実音声ファイルのインポート(`node.audioUrl` の読み込み、`decodeAudioData`)は **MVP 後**という位置づけを docs で再確認した(decision log の audioUrl 決定、Phase 8「オシレーターはプレースホルダ」、Phase 9 の Out of Scope)
- ファイルインポート実装時に初めてデコード済み PCM が生まれるため、そこが Player/Analyzer 境界が実体化する瞬間になる
- `docs/analyzer-player-split` ブランチ(前回議論のドキュメント反映)は PR #15 としてマージ完了

## 2. 残っていた論点の整理

1. MVP を「完了」と宣言するか(今回決着)
2. Player インターフェースの明文化 → docs/06 の Future Direction で反映済みと確認
3. リポジトリ外の方針書の扱い → 未決。方針書は repo 外にあり、二重管理のリスクあり
4. インポートした音声ファイルの永続化問題(object URL はリロードで死ぬ)→ 次フェーズの設計議論へ持ち越し
5. Analyzer を最初から Worker に置くか → 持ち越し

## 3. 本題: 「A user can define a simple transition」の解釈

現状は Inspector がエッジの `transitionType` / `fadeDurationSec` を読み取り専用表示するだけで、新規エッジは crossfade / 3秒に固定。cut や fade を試すには JSON の手編集が必要だった。

- **案A**: 「define = エッジを作ること」と解釈し、今すぐ MVP 完了と宣言する
- **案B**: 「define = つなぎ方を自分で選べること」と解釈し、Phase 10(エッジ編集)を足してから完了とする

**結論: 案B を採用。** 理由:

- 3種のトランジションのうち2種が UI から到達不能な状態は、プロダクトコンセプトのデモとして不十分
- エッジ編集 UI は `docs/05_ui_requirements.md` の「Edge Selected」に仕様が既に書かれており、decision log にも fadeDurationSec のルールが「合意済み・未実装」として残っていた(宿題の回収)
- 学習面でも「制御されたフォーム入力 → domain 状態の更新」という未経験パターンを小さく1回踏める

## 4. Phase 10 の実装方針

- Inspector のエッジビューに transitionType のセレクトと fadeDurationSec の数値入力を追加
- 整合性ルールは React に書かず、純粋関数 `src/domain/edgeRules.ts` に置いてユニットテストする(cut→0、fade/crossfade で 0→デフォルト3、不正値は 0 に丸め、cut 中は入力を無効化)
- `note` の編集は今回もスコープ外

## 次のアクション候補

1. Phase 10 のマージ後、MVP 完了を decision log で宣言する
2. ファイルインポートの設計議論(特に永続化: object URL / IndexedDB / File System Access API)
3. リポジトリ外の方針書の置き場所を決める
4. dsp-poems: poem 00(sine)は引き続き未着手
