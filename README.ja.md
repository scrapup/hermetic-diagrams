# hermetic-diagrams

🌐 [English](./README.md) | **日本語** | [Português](./README.pt.md)

> ダイアグラムをオフラインでレンダリングする、密閉型・持ち出し防止の MCP — ダイアグラムのソースは
> あなたの環境から決して外に出ません。

[scrapup](https://github.com/scrapup/scrapup) エコシステムの一部 · 単体でも配布可能 ·
[Kroki](https://kroki.io) の上に構築 · MIT。
**ステータス: Beta — MVP 実装済み（ローカルレンダリング対応の記法、SVG + PNG）。**

## なぜ必要か

どの LLM — あるいはエンジニア — に「このダイアグラムを PNG にレンダリングして」と頼んでも、自然な
流れは **公開サーバーへの委譲**（`kroki.io`、`plantuml.com`）です。あらゆるチュートリアルで主流の
パターンであり、何もインストールする必要がなく、ハーネスを持たないモデルが画像を作る唯一の方法でも
あります。このデフォルトは **漏洩します**。ソース — サービス名、トポロジー、ときにはラベル内の
シークレット — が第三者に送られ、よく使われる「ソースを URL に含めた `GET`」の形式では、ダイアグラム
全体がプロキシのキャッシュ、アクセスログ、履歴に残ります。

人間も AI も、自分から密閉された経路を選ぶことはなく、どちらも摩擦の少ない経路を選びます。そのため
ここでの保証は **行動ではなく構造** によるものです。持ち出しはポリシーで抑止するのではなく、構造的に
不可能にしています。

## 何をするか

ダイアグラム — PlantUML、C4、D2、GraphViz、DBML、ERD、Vega/Vega-Lite — を SVG/PNG に、完全に
あなたのマシン上でレンダリングする MCP サーバーです。外部への通信がないことを検証可能な形で保証します。

## セキュリティモデル — 構造による封じ込め

すべてのリクエストは、直列に並んだ 3 つの障壁を通過します。

1. **意味レベル（Policy Enforcement Point としての MCP）。** 記法ごとの検証: 外部 include
   （`!includeurl`、リモートの sprite/テーマ、D2 の `icon: https://`、GraphViz の `image=`、Vega の
   `data.url`）を拒否し、`%getenv` をブロックし、XML の DTD/外部エンティティ（XXE）を無効化し、
   ダイアグラム種別を allowlist で制限し、サイズ/時間の上限を課し、確信を持って解析できないソースは
   すべて fail-closed で拒否します。
2. **ネットワーク — 主要な保証。** レンダラー（公開されることのない headless な Kroki、公開ポートなし）
   は `internal: true` の Docker ネットワークで動作します — **デフォルトゲートウェイなし、外への経路
   なし**。
3. **レンダラー。** 最終防衛線として `KROKI_SAFE_MODE=SECURE` がファイル/URL の include を拒否します。

MCP はレンダラーの **唯一のクライアント** です — MCP を経由しない経路は存在しません。返される SVG は
**サニタイズ** されており（本物の XML パーサー + 要素/属性の allowlist）、表示時にリクエストを発生
させません。`script`、`foreignObject`、リモートの `href`/`url()` は除去されます。

### 信頼せず、証明する

ゲートウェイは起動のたびに封じ込めを証明し、証明できなければ **fail-closed** になります — すべての
ゲートを通過しない限り、レンダリング用のツールは登録すらされません。

- **Egress self-check** — MCP は固定の公開 IP へ SYN のみの TCP 接続を試みます。*接続できた* 場合は
  外部への経路が存在するため、動作を拒否します（`NOT_CONTAINED`）。
- **Canary render** — リモート include を含むダイアグラムを PEP を通さずにエンジンへ送り、エンジンが
  拒否することを確認します。（CI では golden テストが、管理下のシンクに **一度も** 到達しないことを
  検証します。）
- **Kroki の healthcheck** — エンジンが準備完了を報告してから、ゲートウェイは応答を始めます。
- **承認済みかつ固定** — イメージは `sha256` で固定されています（`images.lock` を参照）。新しい
  digest は、封じ込めを再度証明した後にのみ採用されます。
- **外部通信のない MCP** — 外向きの HTTP クライアントもテレメトリーもありません。Kroki には内部
  ネットワーク経由でのみ、**ボディ付きの POST** で到達します（ソースを URL に含めた GET は使いません）。

## 要件

- **Linux containers** を実行する **Docker**（Desktop または Engine）と、Docker Compose 2.24 以降。
  Windows では WSL 2 バックエンドの Docker Desktop（Linux containers モード）を使用してください。
  重いランタイムはすべて固定された Linux イメージの中にあるため、同じ構成が Windows、macOS、Linux
  で動作します。
- `npx` のための **Node.js 24 以降**。

## インストール

Windows、macOS、Linux で同じ 2 ステップです。AI アシスタントにサーバーを登録し、一度だけ準備します。

### 1. サーバーを登録する

どのチャネルも同じものを起動します。正確なバージョンに固定され、`npx` で実行される npm パッケージ
`@scrapup/hermetic-diagrams` です。

**Claude Code プラグイン**（推奨）:

```
/plugin marketplace add scrapup/hermetic-diagrams
/plugin install hermetic-diagrams
```

**GitHub Copilot CLI プラグイン:**

```
copilot plugin marketplace add scrapup/hermetic-diagrams
copilot plugin install hermetic-diagrams
```

**その他の MCP クライアント** — プラグインと同じランチャーを登録してください。どの OS でも `npx` を
解決し（Windows では `npx.cmd`）、固定されたバージョンを実行します。

<!-- x-release-please-start-version -->
```json
{
  "mcpServers": {
    "hermetic-diagrams": {
      "command": "node",
      "args": [
        "-e",
        "const w=process.platform==='win32',a=['--prefer-offline','-y','@scrapup/hermetic-diagrams@'+process.argv[1]],p=require('node:child_process'),c=w?p.spawn('npx.cmd '+a.join(' '),{stdio:'inherit',shell:true}):p.spawn('npx',a,{stdio:'inherit'});for(const s of['SIGINT','SIGTERM'])process.on(s,()=>c.kill(s));c.on('exit',x=>process.exit(x??1));c.on('error',()=>process.exit(127))",
        "0.3.1"
      ]
    }
  }
}
```
<!-- x-release-please-end -->

### 2. 一度だけ準備する（バージョンごと）

初回の利用前と、アップグレードのたびに、ご自身のターミナルで次を実行してください。

<!-- x-release-please-start-version -->
```
npx @scrapup/hermetic-diagrams@0.3.1 up
```
<!-- x-release-please-end -->

`up` は前提条件（Docker に到達できること、Linux containers、Compose のバージョン）を確認し、固定
された Kroki イメージを digest で取得し、このバージョンの MCP イメージをあなたのマシン上でビルドし、
レンダラーを起動して healthy になるまで待ちます。進捗はターミナルに表示され、失敗した場合は失敗した
ステップを示して 0 以外のコードで終了します。

その後、AI アシスタントは数秒でサーバーを起動します。サーバーは何もダウンロードもビルドもしません。
バージョンが準備されていない場合、サーバーは即座に停止し、そのログに実行すべき正確な `up` コマンドが
表示されます — アシスタントがタイムアウトするまで固まることはありません。

スタックを停止してボリュームを削除するには、同じパッケージとバージョンで `up` を `down` に置き換えて
実行します。

### 3. 新しいバージョンへのアップグレード

プラグインのリリースごとに新しいパッケージバージョンが固定されるため、アップグレードは 2 ステップ
です。プラグインを更新し、その後 `up` で新しいバージョンを準備します。

**Claude Code** — マーケットプレイスのカタログを更新し、プラグインを更新してから Claude Code を
再起動します。

```
claude plugin marketplace update hermetic-diagrams
claude plugin update hermetic-diagrams@hermetic-diagrams
```

**GitHub Copilot CLI** — マーケットプレイスのカタログを更新してから、プラグインを更新します。

```
copilot plugin marketplace update
copilot plugin update hermetic-diagrams
```

その後、ステップ 2 と同様に新しいバージョンの `up` を実行してください。省略した場合、サーバーは
初回起動時に停止し、そのログに新しいバージョンの正確な `up` コマンドが表示されます。
**その他の MCP クライアント:** ランチャー設定のバージョンを変更し、そのバージョンの `up` を実行します。

## 使い方 — MCP ツール

### `render_diagram`

リクエスト:

```json
{ "format": "plantuml", "source": "@startuml\nAlice -> Bob: hi\n@enduml", "output": "svg" }
```

レスポンス（成功）:

```json
{ "format": "svg", "mimeType": "image/svg+xml", "encoding": "utf8", "data": "<svg …/>" }
```

レスポンス（エラー）:

```json
{ "error": { "code": "EXTERNAL_REFERENCE", "message": "…", "detail": "…" } }
```

エラーコード: `INVALID_FORMAT`、`INVALID_SYNTAX`、`EXTERNAL_REFERENCE`、`EMPTY_CONTENT`、
`TOO_LARGE`、`RENDER_TIMEOUT`、`RENDER_ERROR`、`NOT_CONTAINED`。

### `list_formats`

```json
{ "input": ["plantuml","c4","d2","graphviz","dbml","erd","vega","vega-lite"], "output": ["svg","png"] }
```

### `containment_status`

```json
{
  "contained": true,
  "checks": {
    "krokiHealth": "pass", "egressSelfCheck": "pass", "canaryRender": "pass",
    "krokiSafeMode": "SECURE", "publishedPorts": "none"
  }
}
```

## 対応フォーマット

| 入力記法 | SVG | PNG |
|---|---|---|
| PlantUML | ✅ | ✅ |
| C4 (C4-PlantUML) | ✅ | ✅ |
| GraphViz | ✅ | ✅ |
| ERD | ✅ | ✅ |
| D2 | ✅ | — |
| DBML | ✅ | — |
| Vega | ✅ | — |
| Vega-Lite | ✅ | — |

SVG（デフォルト）はすべての記法で利用できます。PNG は、Kroki の core イメージがブラウザコンポーネント
なしでラスタライズできる記法で利用できます。それ以外は SVG を指定してください。

## 制限事項（MVP）

- **ローカルレンダリング対応の記法のみ。** ブラウザコンポーネントが必要な記法（Mermaid、BPMN、
  Excalidraw）は後のサイクルに延期されています（RN-05）。
- **PNG は一部のみ**（表を参照）。このサイクルでは D2/DBML/Vega/Vega-Lite は SVG のみです。
- **オンラインが必要なのは `up` の間だけ** — パッケージ、固定されたイメージ（digest 指定）、MCP
  イメージの本番依存関係は、内部ネットワークが作られる前に、バージョンごとに一度だけ取得されます。
  稼働中のサーバーがネットワークを使うことはありません。エアギャップ用バンドルは後のサイクルです。
- **stdio トランスポートのみ。**

## ライセンス

MIT © 2026 scrapup. 作者: Marco Antonio Luqueti Faustino.
