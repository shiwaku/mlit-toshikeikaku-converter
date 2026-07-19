# 都市計画決定GISデータ PMTiles パイプライン

国土交通省 都市局が公開する
**[都市計画決定GISデータ 全国データダウンロードページ](https://www.mlit.go.jp/toshi/tosiko/toshi_tosiko_tk_000182.html)**
の全国 GeoJSON を自動でダウンロードし、テーマ別の **PMTiles** に変換して
**GitHub Releases** で配信するためのツール群です。

- **DLツール** — ダウンロードページを毎回スクレイプし、47都道府県の GeoJSON zip を取得・展開
- **コンバーター** — GeoJSON → PMTiles（テーマ別 / 都道府県別を選択可）
- **バージョン管理** — 版ごとに GitHub Release を作成。**過去版はそのまま残る**
- **ワンクリック更新** — GitHub Actions の手動実行で 更新検知 → 変換 → 配信 を一括処理

> ⚠️ 本データは国土交通省が提供する**参考情報**です。概ねの位置を示すものであり、
> 建築確認等の公式手続に用いることは想定されていません。最新でない場合があります。
> 利用の際は必ず[提供元ページ](https://www.mlit.go.jp/toshi/tosiko/toshi_tosiko_tk_000087.html)の注記をご確認ください。

## データ構成

- 元データは 47都道府県 × 3形式（シェープファイル / CityGML / GeoJSON）。本パイプラインは **GeoJSON** を使用。
- zip 内は `都道府県/市区町村/<市区町村コード>_<テーマ>.geojson` 構造。
- テーマ（用途地域 `youto`、都市計画区域 `tokei`、区域区分 `senbiki` ほか全26種）と
  日本語名の対応は [`data/themes.json`](data/themes.json) を参照（出典: データ定義書）。
- 座標系は EPSG:6668（JGD2011 緯度経度、実用上 WGS84 と同等）。

生成された PMTiles の一覧は [`CATALOG.md`](CATALOG.md)、版の履歴は
[`versions.json`](versions.json) にまとまります。

## ローカルでの実行

前提: Python 3.10+ / [tippecanoe](https://github.com/felt/tippecanoe)（PMTiles 出力対応版）。

```bash
make setup                         # venv 作成 + 依存インストール
make all                           # 全県: scrape→download→convert→catalog

# 一部の県だけ試す
make download PREF="東京都"
make convert SPLIT=theme           # dist/*.pmtiles を生成
make catalog
```

主なコマンド（`python -m tosiko_pmtiles.cli <sub>`）:

| サブコマンド | 内容 |
| --- | --- |
| `scrape` | ダウンロードページ解析 → `dist/sources.json` |
| `download [--pref 東京都 ...] [--force]` | GeoJSON zip 取得・展開（`raw/`）。**既取得で内容が変わっていない県はスキップ**（`--force` で全再取得） |
| `convert [--split theme\|prefecture]` | PMTiles 生成（`dist/*.pmtiles`） |
| `catalog` | `versions/manifest-<版>.json` / `versions.json` / `CATALOG.md` 生成 |
| `all` | 上記を一括実行 |
| `check-update` | 更新有無を判定（CI 用、`--github-output` 対応） |

### 変換の粒度

- `--split theme`（既定）: テーマごとに 1 つの PMTiles（例 `youto.pmtiles`）。
  レイヤーには全都道府県の当該テーマ地物を統合。Web地図で必要テーマだけ読み込める。
- `--split prefecture`: 都道府県ごとに 1 つの PMTiles。テーマ = レイヤーのマルチレイヤー構成。

## 自動更新（GitHub Actions）

[`.github/workflows/update.yml`](.github/workflows/update.yml) が

1. **手動（`workflow_dispatch`）で起動**（Actions タブから実行。定期実行は行いません）
2. `check-update` で提供元の更新を検知（県ごとの `content-ID` の変化で判定。変更のあった県数も出力）
3. 変更があれば ダウンロード → 変換 → カタログ生成。
   **ダウンロードは差分方式**: 前回の zip を Actions cache（`raw/zip`）から復元し、
   content-ID が変わった県だけ提供元から再取得します（提供元サーバーへの負荷も最小化）
4. `data-<YYYYMMDD>` タグの **Release** を作成し、`*.pmtiles` と `manifest.json` を添付
5. `versions/`・`versions.json`・`CATALOG.md` をコミット

を実行します。PMTiles バイナリは git には置かず Release アセットとして管理するため、
**過去の版は過去の Release として保持**されます。

## 生成データ（PMTiles）の入手 — GitHub Releases

生成された PMTiles は **git リポジトリの中には入っていません**（`git clone` しても
`*.pmtiles` は含まれません）。**GitHub Releases** に版ごとに添付して配布しています。

### GitHub Releases とは

GitHub がリポジトリごとに提供している**ファイル配布機能**です。git のタグ
（ある時点のスナップショットの目印）に、タイトル・説明文・**添付ファイル（Assets）**を
付けて公開できます。ソースコードのように差分管理されるものではなく、
「この版の完成品一式」を棚に並べるイメージです。

本プロジェクトで使い分けは次のとおりです。

| 置き場 | 内容 | 理由 |
| --- | --- | --- |
| git リポジトリ | 変換コード・`versions.json`（版の台帳）・`CATALOG.md` | テキストで差分管理に向く |
| **GitHub Releases** | `*.pmtiles` 全26テーマ + `manifest.json` | 合計 260MB 超のバイナリ。git に置くと履歴が肥大化し、100MB 超は GitHub が拒否。Releases は1ファイル2GBまで・帯域無料 |

### リポジトリからの辿り方

1. リポジトリのトップページ https://github.com/shiwaku/mlit-urban-planning-converter を開く
2. **右サイドバー**の「**Releases**」欄（`Latest` バッジ付き）をクリック
   - 見当たらない場合は URL 末尾に `/releases` を付ける →
     https://github.com/shiwaku/mlit-urban-planning-converter/releases
3. リリース（例: `都市計画決定GISデータ 20260707`）の「**Assets**」を展開
4. `youto.pmtiles` などをクリックするとダウンロードされる

### URL の使い方

```bash
# 常に最新版を指す固定 URL（releases/latest/download/<ファイル名>）
https://github.com/shiwaku/mlit-urban-planning-converter/releases/latest/download/youto.pmtiles

# 特定の版に固定したい場合（releases/download/<タグ>/<ファイル名>）
https://github.com/shiwaku/mlit-urban-planning-converter/releases/download/data-20260707/youto.pmtiles
```

- データ更新のたびに `data-<YYYYMMDD>` という新しいリリースが追加され、
  `latest` は自動的に新版を指すようになります。**過去の版のリリースはそのまま残る**ため、
  タグ指定 URL は再現性のある固定参照として使えます
- 収録ファイルの一覧・サイズは [`CATALOG.md`](CATALOG.md)、
  版の履歴は [`versions.json`](versions.json) を参照してください
- QGIS ではこの URL をそのまま PMTiles ソースとして指定できます

## Web 地図での利用

> ⚠️ Release アセットは CORS ヘッダを返さないため、ブラウザから直接 fetch（Range 取得）はできません。
> Web 地図に組み込む場合は PMTiles を自分のホスト（同一オリジン）へ配置してください
> （本プロジェクトのビューアも、デプロイ時に Release から PMTiles をコピーして同一オリジンで配信しています）。

### ビューア（`viewer/`）

MapLibre GL JS + [pmtiles](https://github.com/protomaps/PMTiles) + 国土地理院 最適化ベクトルタイルの
モダンなビューア（Vite + TypeScript / ライト・ダークテーマ）を同梱しています。
用途地域などの配色は [全国都市計画GISビューア](https://toshikeikaku-info.jp/) を参考にしています。

```bash
cd viewer
npm install
npm run dev      # http://localhost:8000（dev サーバーが ../dist/*.pmtiles を Range 配信）
```

**公開**: [`.github/workflows/pages.yml`](.github/workflows/pages.yml) が最新 Release の PMTiles を
ビューアに同梱して GitHub Pages へデプロイします（同一オリジン配信）。
公開先 → https://shiwaku.github.io/mlit-urban-planning-converter/

## ディレクトリ構成

```
src/tosiko_pmtiles/   スクレイプ・DL・変換・カタログのコード
data/themes.json      テーマコード → 日本語名
versions/             版ごとの manifest（監査証跡・コミット対象）
versions.json         版の履歴インデックス
viewer/               MapLibre + PMTiles ビューア（Vite + TypeScript）
raw/ dist/            中間・出力物（.gitignore、コミットしない）
```

## ライセンス / 出典

- コード: MIT（[LICENSE](LICENSE)）
- データ: 国土交通省 都市局「都市計画決定GISデータ」。利用時は出典を明記してください。
