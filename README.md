# GridCanvasStudio

<p align="center">
  <strong>PMO向け 無限キャンバス型ドキュメントエディタ</strong>
</p>

<p align="center">
  テキスト・テーブル・図表・画像を自由に配置し、プロジェクト管理ドキュメントを効率的に作成できるデスクトップアプリケーション
</p>

---

## ✨ 特徴

- 🖼️ **無限キャンバス** — パン・ズーム・グリッドスナップ対応の自由配置キャンバス
- 📝 **リッチテキスト編集** — Tiptap (ProseMirror) ベースの高機能テキストエディタ
- 📊 **テーブルエディタ** — 行列の追加・削除、セル結合、背景色変更に対応
- 🎨 **Draw.io統合** — 組み込みDraw.ioエディタで構成図やフロー図を直接作成
- 🖼️ **画像ノード** — PNG/JPG/GIF/WebP等の画像をキャンバスに配置
- 🤖 **AIアシスタント** — OpenAI互換APIによるコンテンツ自動生成・編集支援
- 📋 **テンプレート** — WBS、カンバンボード、運用設計書、プロジェクト計画書をワンクリック展開
- 📤 **Excelエクスポート** — キャンバスレイアウトを忠実に再現したExcelファイル出力
- 💾 **JSON保存・読込** — プロジェクトデータの永続化と復元
- ⚡ **超軽量デスクトップアプリ** — Tauri v2によるネイティブアプリ（Windows対応）

---

## 🛠️ 技術スタック

| カテゴリ | 技術 |
|---|---|
| デスクトップ基盤 | Tauri v2 (Rust + WebView2) |
| フロントエンド | React 19 + Vite |
| テキストエディタ | Tiptap (ProseMirror) |
| 図表作成 | Draw.io Embed (iframe) |
| Excelエクスポート | rust_xlsxwriter (Rustバックエンド) |
| Markdown変換 | turndown |
| AI連携 | OpenAI互換API |

---

## 🚀 セットアップ

### 前提条件

- [Node.js](https://nodejs.org/) (v18以上)
- [Rust](https://www.rust-lang.org/tools/install)
- [Tauri v2 の前提環境](https://v2.tauri.app/start/prerequisites/)

### インストール

```bash
# リポジトリをクローン
git clone https://github.com/Uchiteru/GridCanvasStudio.git
cd GridCanvasStudio

# 依存パッケージをインストール
npm install
```

### 開発モードで起動

```bash
# Tauri デスクトップアプリとして起動
npm run tauri dev

# ブラウザ開発サーバーのみ起動
npm run dev
```

### ビルド

```bash
# プロダクションビルド（デスクトップアプリ .exe の生成）
npm run tauri build
```

---

## 📖 使い方

### キャンバス操作

| 操作 | 方法 |
|---|---|
| パン（移動） | 空きスペースで左クリック＋ドラッグ / 中ボタン / Alt+左クリック |
| ズーム | マウスホイール / ツールバーの `+` `-` ボタン |
| グリッドスナップ | 40pxグリッドに自動スナップ |
| A4モード | 印刷用A4サイズ枠への配置制限 |

### ノード操作

- **追加**: ツールバーからテキスト / テーブル / Draw.io / 画像を選択
- **編集**: ダブルクリックで編集モードに入る
- **移動**: ドラッグ＆ドロップ
- **複数選択**: クリックで複数ノードを選択
- **コピー＆ペースト**: `Ctrl+C` / `Ctrl+V`
- **削除**: `Delete` キー
- **元に戻す / やり直し**: `Ctrl+Z` / `Ctrl+Y`

### AIアシスタント

1. ノードを選択し、AIアシストボタンをクリック
2. ⚙️ 設定からAPIエンドポイント・APIキー・モデル名を設定
3. プロンプトを入力してコンテンツを自動生成

### エクスポート

- **JSON**: プロジェクト全体をJSONファイルとして保存・読込
- **Excel**: キャンバスの配置を忠実に再現したExcelファイルを出力
- **Markdown**: テキストノードのMarkdown変換

---

## 📁 プロジェクト構成

```
GridCanvasStudio/
├── src/                    # フロントエンドソース
│   ├── App.jsx             # アプリケーションルート
│   ├── canvas-editor.jsx   # メインキャンバスエディタ
│   ├── App.css             # スタイル
│   ├── index.css           # グローバルスタイル
│   └── main.jsx            # エントリーポイント
├── src-tauri/              # Tauri (Rust) バックエンド
│   ├── src/
│   │   ├── main.rs         # Tauriエントリーポイント
│   │   └── lib.rs          # Rustコマンド (Excelエクスポート等)
│   ├── tauri.conf.json     # Tauri設定
│   └── Cargo.toml          # Rust依存関係
├── index.html              # HTMLエントリーポイント
├── vite.config.js          # Vite設定
├── package.json            # npm依存関係
└── design.md               # 詳細設計書
```

---

## 📄 ライセンス

このプロジェクトはプライベートリポジトリです。

---

## 🔗 関連ドキュメント

- [設計書](./design.md) — システムの詳細設計ドキュメント
