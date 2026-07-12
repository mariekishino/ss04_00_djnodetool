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

## 5. ファイルインポートフェーズへ持ち越す設計論点(同日追記)

Phase 10 実装後の質疑で確認・整理した内容。次フェーズ(音声ファイルインポート)の設計で決めるべきこと:

**現状の確認(誤解しやすい点):**

- 「Import JSON」ボタンが読むのは**プロジェクト構造のみ**。音声ファイルのインポートは未実装
- Track Library に表示される BPM は**解析結果ではなく mock データの手書きメタデータ**。Analyzer は実装ゼロ(docs のインターフェース案のみ)
- 音源フォーマットの推奨: 普段は **MP3**(全ブラウザ対応・Suno等の標準出力)、自作・実験用は **WAV**(dsp-poems で生成するのはこれ)。M4A/OGG/FLAC は対応差があるので主役にしない

**次フェーズで決めること:**

1. **音声ファイルの取り込み方法と永続化**: ローカルファイル選択は object URL になり**リロードで参照が死ぬ**。プロジェクト JSON の `audioUrl` 保存との整合をどうするか(候補: メモリのみで割り切る / IndexedDB に音声データごと保存 / File System Access API で再リンク)
2. **解析のタイミング**: 方針は「**インポート時に1回**」(再生のたびに解析しない)。ファイル選択 → `decodeAudioData` で PCM 化 → `Analyzer.analyze()` → 結果を保持、の流れ
3. **解析結果(AnalysisResult)の保存場所**: メモリ上の Map(trackId → 結果)/ プロジェクト JSON に含める / IndexedDB キャッシュ、のどれにするか。AnalysisResult をシリアライズ可能なデータに縛ったのはこのための布石
4. デコード済み PCM は Player(再生)と Analyzer(解析)の両方が使う。ファイルインポートが Player/Analyzer 境界が初めて実体化する瞬間になる

## 次のアクション候補

1. Phase 10 のマージ後、MVP 完了を decision log で宣言する
2. ファイルインポートの設計議論(上記セクション5の論点1〜4)
3. リポジトリ外の方針書の置き場所を決める
4. dsp-poems: poem 00(sine)は引き続き未着手
