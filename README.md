# Fourier Quest

フーリエ変換を「直感 → 数学 → 応用 → 大学レベル」へ段階的に進める、静的HTMLの学習アプリです。

## 目的

- フーリエ変換を、式の暗記ではなく「見方の変換」として理解する
- 波形を触りながら、時間領域と周波数領域の違いを掴む
- フーリエ級数、複素数、DFT/FFT、サンプリング、窓関数、STFTまで順番に進む
- 学習モチベーションを、気合いではなく仕組みで支える
- 高校生でも入れる言い換えから始め、最終的に大学教科書レベルの言葉へ接続する

## 教材設計

ホームでは「今日の一手」と「いま進める1章」だけを見せます。全12章は学習マップを開いたときだけ表示し、前章をクリアすると次章が開きます。

各章は内容を一度に並べず、次の9ステップを1画面ずつ進みます。

- 到達目標
- やさしい言い換え
- イメージ
- 教科書の言葉
- 式の読み方
- 活用例
- よくある誤解
- ドリル
- ラボと理解チェック

「やさしい説明」だけで終わらせず、大学教科書で使う用語や式へ接続します。一方で、音声、画像、スタジアム音声、PV、チケット発券数、センサーデータなど、現実の信号を例にして理解できるようにしています。

各章の完了には、波形ラボを一度開き、章別の理解チェック2問に正解する必要があります。読むだけで終わらず、「予想 → 操作 → 想起」を通ってから次へ進む設計です。

## 主な機能

- 12章構成のカリキュラム
  - そもそも波とは何か
  - サイン波・コサイン波
  - 合成波
  - 内積と直交
  - フーリエ級数
  - 複素数とオイラーの公式
  - フーリエ変換
  - サンプリングとエイリアシング
  - DFTとFFT
  - 窓関数とスペクトル漏れ
  - 時間周波数解析
  - 大学レベルの到達課題
- Canvasによる波形ラボ
  - 時間領域の波形
  - 周波数成分の棒グラフ
  - ミックス波、矩形波、チャープのプリセット
- 進捗管理
  - 完了章数
  - XP
  - 連続学習日数
  - 自信度
  - バッジ
- 学習継続の仕組み
  - 60秒ミッション（先に予想してから観察）
  - 1画面1ステップのレッスン
  - 前章クリアで開く学習マップ
  - つまずきログ
  - 選択肢を毎回シャッフルする小テスト
  - 章別の理解チェック
  - 短時間ドリル
- PWA対応
  - `manifest.webmanifest`
  - `sw.js`
  - `icon.svg`
- GitHub Pages用ワークフロー
  - `.github/workflows/deploy-pages.yml`
  - `.nojekyll`

## GitHub Pagesでの公開

このリポジトリには GitHub Pages 用の Actions ワークフローを入れています。Pages の設定で GitHub Actions を公開元にしてください。

```text
Settings → Pages → Build and deployment → Source: GitHub Actions
```

公開後は以下のようなURLになります。

```text
https://silovar-uk.github.io/fourier/
```

## ファイル構成

```text
index.html                         アプリ本体のHTML
styles.css                         UIスタイル
app.js                             進捗管理・描画・クイズなどのロジック
data.js                            カリキュラム、クイズ、参考リンク
manifest.webmanifest               PWA設定
sw.js                              オフラインキャッシュ
icon.svg                           アプリアイコン
.nojekyll                          GitHub Pages用
.github/workflows/deploy-pages.yml GitHub Pagesデプロイ
README.md                          この説明
```

## 参考リンク

- Wolfram MathWorld: Fourier Transform  
  https://mathworld.wolfram.com/FourierTransform.html
- NIST: The Fast Fourier Transform for Experimentalists, Part I  
  https://www.nist.gov/publications/fast-fourier-transform-experimentalists-part-i-concepts
- MIT OpenCourseWare: Fourier Series Basics  
  https://ocw.mit.edu/courses/18-03sc-differential-equations-fall-2011/pages/unit-iii-fourier-series-and-laplace-transform/fourier-series-basics/
- Stanford Engineering Everywhere: EE261 - The Fourier Transform and its Applications  
  https://see.stanford.edu/Course/EE261
- The Scientist and Engineer's Guide to Digital Signal Processing  
  https://www.dspguide.com/
- Khan Academy: Trigonometry  
  https://www.khanacademy.org/math/trigonometry

## 実装メモ

- 外部ライブラリなし
- データ保存は `localStorage`
- すべてブラウザ内で完結
- 学習データは外部送信しない
- スマホとPCの両対応
- 日付判定は日本時間（Asia/Tokyo）
- Service Workerはナビゲーションをネットワーク優先、静的資産をキャッシュしつつ更新
