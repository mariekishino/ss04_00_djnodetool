# 議論記録: AudioEngine設計・TypeScript・解析ライブラリ・dsp-poems学習プラン

- 日付: 2026-07-10
- 相手: Claude (Fable 5)
- 入力: Grokとの議論でまとめた「DJ Node Mix プロジェクト方針書(2026年7月改訂)」+ 別スレッドの議論まとめ(dsp-poems構想)
- 位置づけ: 方針書(憲法)への修正提案を含む議論記録。採用する場合は方針書と `10_decision_log.md` に反映する

---

## 1. 最重要の修正提案: 差し替え単位は「エンジン全体」ではなく「Analyzer」

方針書の「WebAudioEngine を将来 CppAudioEngine に置き換える」という単位設定には無理がある。

**理由**: ブラウザで動く限り、音の出口は永遠に Web Audio API。C++をWASMにコンパイルしても、WASMは直接スピーカーに音を出せない。再生・スケジューリング・クロスフェードといった再生系は、C++化してもJSからWeb Audioを叩く構造のまま変わらない。

一方、解析(BPM検出、ビート位置、波形ピーク、キー検出)は「PCMを入れたら数値が返る純粋関数」であり、WASMの得意領域そのもの。差し替える価値も現実性もあるのはここだけ。

**修正案**: インターフェースを2つに分ける。

| インターフェース | 役割 | 差し替え |
|---|---|---|
| `Player` (再生系) | load / play / stop / crossfade / 位置イベント | しない。ずっと JS + Web Audio。抽象化は「ReactにWeb Audioの生オブジェクトを触らせない」程度の薄い壁で十分 |
| `Analyzer` (解析系) | PCMを受け取り解析結果を返す | **ここだけが将来 C++/WASM に差し替わる** |

方針書の文言としては「AudioEngineを差し替える」→「**Analyzerを差し替える。Playerは差し替えない**」に書き換える。

## 2. 移植性を保証するのは「境界を通るデータの型」

将来C++に差し替えられるかどうかは、クラス設計よりも境界を何が通過するかで決まる。ルールは3つ:

1. **Web Audioの型を境界から漏らさない**: `AudioBuffer` / `AudioNode` を Analyzer の引数・戻り値に使わない(Workerに渡せず、C++側に存在しない)。代わりに `Float32Array + sampleRate`
2. **最初から全部async**: C++版は確実にWorker上で動くので、JS版の段階から `Promise` を返すシグネチャに。JS版も最初からWorkerに置くと差し替え時の構造変化がゼロになる
3. **戻り値はプレーンなシリアライズ可能データのみ**: 数値・数値配列・Float32Array。クラスインスタンスや関数は Worker/WASM 境界を越えられない

```ts
interface Analyzer {
  analyze(pcm: Float32Array, sampleRate: number): Promise<AnalysisResult>;
}

interface AnalysisResult {
  bpm: number;
  beats: number[];             // 秒単位のビート位置
  waveformPeaks: Float32Array; // 波形表示用の間引きピーク
  duration: number;
}
```

**デコード(MP3→PCM)は `decodeAudioData` でJS側に固定する**。C++側にデコーダを持ち込む必要がなくなり、Analyzerの入力が常にPCMに統一される。

やりすぎ注意(YAGNI):
- C++を想定した詳細なインターフェースを先回りで設計しない。MVPでReactが実際に呼ぶメソッドだけ定義する。移植性は上のデータ型ルールが守る
- リアルタイムDSP(タイムストレッチ等)のC++化は AudioWorklet + WASM の話で、Analyzerとは別の境界。今は考えない

## 3. TypeScript採用の理由(方針書のJavaScriptからの変更提案)

- TypeScriptは実行時にはJavaScriptそのもの。型注釈がビルド時に消えるだけで、「解析をJSで書く」方針とは対立しない
- JSには `interface` 構文が存在しない。「契約を決めて実装を差し替える」というこのプロジェクトの核心は、JSだと口約束になる
- TSなら `class WasmAnalyzer implements Analyzer` で、差し替え時の契約違反(引数の順番ミス、asyncの付け忘れ等)を実行前にコンパイラが検出する
- 適用範囲は**JS側のコード全部**(UI・Player・Analyzer実装)。TSでないのは将来のC++コア(→WASM)だけ。WASMを呼ぶ薄いラッパー(`WasmAnalyzer`)はTS

## 4. JS/TSの解析ライブラリ事情と、C++移植の位置づけの変化

| ライブラリ | できること | 中身 |
|---|---|---|
| essentia.js | BPM、ビート位置、キー検出等の研究水準MIR | **C++(Essentia)のWASM化** |
| aubiojs | テンポ、オンセット、ピッチ | **C(aubio)のWASM化** |
| web-audio-beat-detector | BPM検出のみ、導入が楽 | 純JS/TS |
| music-tempo | BPMとビート位置 | 純JS |
| Meyda | RMS、MFCC、クロマ等の特徴量 | 純JS |

- 波形ピーク抽出はライブラリ不要(数十行で自作可、良い練習)
- 純JS製BPM検出は4つ打ち等ビートが安定した曲なら実用、複雑な曲では精度が落ちる
- **重要な示唆**: essentia.jsを使った時点で「C++解析エンジンをWASM経由で呼ぶ」構成に初日から到達してしまう。よって自作C++移植は性能のための必須作業ではなく、**純粋に学習目的の選択肢**になる
- Analyzerインターフェースの価値はむしろ上がる: React側を変えずに「既製ライブラリ → 高精度ライブラリ → 自作C++」と段階的に差し替えられる

```
SimpleAnalyzer (web-audio-beat-detector) → EssentiaAnalyzer → MyCppAnalyzer(学習目的)
```

**MVPへの推奨**: MVP(ノードを繋いで順次再生)に解析は不要。BPM検出すら要らない。
1. Analyzerはインターフェース定義だけ置き、実装なしでMVP完成
2. 波形表示が欲しくなったら自作ピーク抽出
3. BPMが欲しくなったら web-audio-beat-detector をAnalyzerの裏に隠して導入
4. 不満が出たら essentia.js に差し替え

ライブラリは玉石混淆でメンテが止まっているものもある。導入前に最新のメンテ状況を要確認。

## 5. dsp-poems学習プランのレビュー

**総評: 良いプラン**。「本番はJSで動かしながら、裏で同じ概念をCで手書きして理解する」二本立て、poem ↔ DJ Node Mix対応表、`stdio.h + math.h`縛り(Web Audioが隠すサンプル単位の計算を強制的に見せる)は、いずれも目的に合っている。修正はすべて「難易度の崖をならす」類のもの。

### 誤解しやすい点

1. **poem 06のコードは本番の `analyze()` にならない**。本番はライブラリを呼ぶ可能性が高い。poemの価値はコード流用ではなく、ライブラリが何をしているか理解し精度を判断できるようになること。「書いたCを本番に載せなきゃ」という義務感は誤り
2. **難易度カーブは00〜05と06〜07の間で崖になる**。00〜05は各「週末1回分」、06(ビート検出)・07(FFT)は別次元に重い
3. **リポジトリ3つ(Claude版・Grok版・dsp-poems) + 学習領域2つ(React & C)は多い**。レース区間は短く(2〜3週間で決着)、dsp-poemsは週1 poem程度のスローペース併走、と時間配分を先に決める。Claude vs Grok の差分考察というメタ作業が制作時間を食うのが最大のリスク

### カリキュラム改善案

- **07を2段に**: 素朴なDFT(O(N²)、10数行、概念そのもの) → FFT(高速化アルゴリズム)。概念と最適化を同時に飲まない
- **06を2段に**: 06a オンセット検出(エネルギー急増の検出) → 06b テンポ推定(オンセット間隔の自己相関/ヒストグラム)
- **Nyquist周波数とエイリアシングを追加**(poem 00の直後が適所)。「サンプリングレートの半分を超えた周波数は化ける」を耳で聴く。数行で書けてグリッチ音として面白い。全信号処理の前提なのに対応表から抜けている
- **(任意)poem 08: リサンプリング/再生速度変更**。線形補間で速度を変えるとピッチも変わる体験は、DJツールのテンポ同期(`playbackRate`)に直結
- poem 00の隠れた学習内容: WAVヘッダ手書き(RIFF、リトルエンディアン)、float→int16変換とクリッピング。「雑用」ではなくDSPの入り口
- 実務メモ: 開発VM(exe.dev)は音が出ないので、生成WAVはダウンロードして手元で聴く

## 次のアクション候補(前スレッドから継続)

1. dsp-poems: poem 00(sine)をCで書いてWAV生成 ← 推奨の起点
2. DJ Node Mix: Analyzer/Playerインターフェース設計から着手
3. 方針書への反映: 「Analyzerを差し替える、Playerは差し替えない」への書き換え + TS採用の明記
