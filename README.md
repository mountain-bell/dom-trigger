# DomTrigger

DomTriggerは、JavaScriptで登録したハンドラをHTMLのクラス名でイベントに結び付けるDOMユーティリティです。

フレームワークを使わないサイトで、処理の定義とHTMLへのイベントの割り当てを分けたい場合に使えます。

---

## ✨ 特徴

- **処理の定義とイベントの割り当てを分離**：JavaScriptで登録したハンドラを、HTMLのクラスで要素やイベントに割り当てられます。同じハンドラを複数の要素・イベントで再利用できます。
- **要素ごとのデータや動作をHTMLで指定**：ハンドラに渡すJSONや、既定動作・イベント伝播の抑止をdata属性で設定できます。
- **後から追加した要素にも通常イベントが対応**：イベント委譲により、要素ごとにリスナーを登録し直す必要がありません。
- **表示領域への出入りも同じハンドラで扱う**：`viewin` / `viewout`で、要素が指定割合以上見えたときや、その状態から外れたときに処理を実行できます。

---

## 🧩 インストール

```bash
npm install @mountain-bell/dom-trigger
```

イベント監視にはブラウザの`document`・`window`が必要です。ビュー監視には`IntersectionObserver`が必要で、利用できない場合は警告を出してビュー監視だけをスキップします。DOMのないNode.js・SSRでの監視は対象外です。ブラウザごとの最低対応バージョンは定めていません。

ESM・CommonJS・TypeScriptに対応しています。

---

## 🚀 基本の使い方

次のHTMLとコードを用意します。コードはnpmのimportを解決できるバンドラーなどでブラウザ用にビルドしてください。

```html
<button type="button" class="js-click-greet">挨拶する</button>
```

```ts
import DomTrigger from "@mountain-bell/dom-trigger";

DomTrigger.use("greet", ({ el }) => {
	if (el) el.textContent = "こんにちは！";
});
DomTrigger.setupOnReady();
```

DOMの準備後に監視が始まり、クリックするとボタンの文字が`こんにちは！`に変わります。以降の応用例は同じ`DomTrigger`のimportを使います。

---

## 読み込み方法

基本例のdefault importに加えて、named importとCommonJSを利用できます。

### named importで使う

```ts
import { use, setupOnReady } from "@mountain-bell/dom-trigger";
```

### CommonJSで使う

```js
const { use, setupOnReady } = require("@mountain-bell/dom-trigger");
```

### scriptタグで使う

単独の`<script>`用ファイルはnpm配布物に含まれません。

[GitHubのbrowser/dom-trigger.js](https://github.com/mountain-bell/dom-trigger/blob/main/browser/dom-trigger.js)をダウンロードして配置すると、ビルド環境なしで使えます。GitHubのファイル表示ページのURLを直接scriptのsrcに指定せず、取得したJSファイルを指定してください。

```html
<button type="button" class="js-click-greet">挨拶する</button>
<script src="./dom-trigger.js"></script>
<script>
	DomTrigger.use("greet", ({ el }) => {
		if (el) el.textContent = "こんにちは！";
	});
	DomTrigger.setupOnReady();
</script>
```

グローバル変数`DomTrigger`から同じAPIを利用できます。ソースマップも使う場合は、同じ場所に`dom-trigger.js.map`を配置します。以降の例はnpmのimportを使う場合の説明です。

---

## 設計思想

CSSのクラスで見た目やアニメーションを指定するように、JavaScriptで定義した振る舞いもクラスで指定します。それがDomTriggerの考え方です。

エンジニアが用意した処理を、HTMLに`js-`クラスを付けることで組み合わせられます。クラスをデザイナーとエンジニアの接点にすることで、HTML上で見た目と振る舞いを表現・管理できます。

`js-`クラスには、振る舞いに必要なCSSを当てることもできます。装飾用のクラスと分けるなど、役割に応じた管理が可能です。処理に渡すデータや動作のオプションにはdata属性を使います。

---

## ハンドラとトリガーの設定

### 1. ハンドラを登録する

```ts
import DomTrigger from "@mountain-bell/dom-trigger";

DomTrigger.use("fade-in", ({ el, data, ctx }) => {
	el?.classList.add("is-visible");
	console.log(data, ctx);
});
```

受け取る値：

- `el`：トリガークラスを持つ対象要素、または`run()`・`invoke()`で指定した要素
- `data`：対象要素のdata属性から読み取った値、または`run()`で指定した値
- `ctx.name`：ハンドラ名
- `ctx.event`：発生元のイベント、または`run()`・`invoke()`で指定したイベント
- `ctx.source`：`run()`経由なら`"run"`、通常イベント・ビュートリガー・`invoke()`経由なら`"invoke"`

`run()`では`el`・`data`・`event`を省略できます。`invoke()`では`event`を省略できます。ビュートリガーでは`ctx.event`は渡されません。

### 2. HTMLのクラスにトリガーを書く

```html
<div class="js-viewin-fade-in"></div>
```

`js-viewin-fade-in`は、要素が表示領域に入ったと判定されたときに`fade-in`ハンドラを実行します。判定条件は「ビュートリガー」で説明します。

### 3. 初期化する

```ts
DomTrigger.setupOnReady();
```

DOMの準備後に通常イベントとビュートリガーの監視を開始します。`before` / `after`オプションで、初期化の前後に実行する処理を指定できます。

---

## 🗂️ data属性について

DomTriggerでは、`data-ハンドラ名`にJSONを記述することで、ハンドラに任意のデータを渡すことができます。

```html
<button
	class="js-click-track"
	data-track='{"category":"cta","label":"header"}'
></button>
```

ハンドラ側では`data`にパース済みオブジェクトとして渡されます。

JSONはオブジェクト形式で指定してください。属性がない場合や空文字の場合は`{}`となり、不正なJSONはエラーになります。空白だけの文字列も不正なJSONです。パース後の値の形は実行時検証されず、`use<TData>()`の型指定もJSONの内容を検証するものではありません。

JSONのパースはハンドラを呼ぶ前に行います。クリックやビュートリガー経由でJSONが不正だった場合、ハンドラは呼ばれず、未処理のPromise拒否になります。ハンドラ内の`try/catch`や、初期化用の`setupOnReady({ onError })`では捕捉できません。HTMLを生成するときに正しいJSONを設定してください。手動実行なら`invoke()`のPromiseを`await`と`try/catch`、または`.catch()`で処理できます。

```ts
DomTrigger.use("track", ({ data }) => {
	console.log(data?.category); // "cta"
});
```

### 💡 キャッシュについて

DomTriggerはJSONパース結果をWeakMapにキャッシュし、同じ要素・ハンドラ名の組み合わせで再利用します。

実行のたびに値を読み取り、再パースしたい場合は、`data-ハンドラ名`の代わりに`data-uncache-ハンドラ名`にJSONを指定します。

```html
<button class="js-click-update" data-uncache-update='{"step":1}'></button>
```

`data-uncache-ハンドラ名`の値はキャッシュせず、実行のたびに読み取ります。同じハンドラに対して`data-ハンドラ名`と`data-uncache-ハンドラ名`の両方を指定した場合は、`data-uncache-ハンドラ名`の値を使います。

通常属性のパース結果は、同じ要素・ハンドラ名の組み合わせで同じオブジェクトを再利用します。ハンドラ内で`data`を書き換えると次回にも変更が残るため、読み取り用として扱ってください。変更が必要なら必要な範囲をコピーします。`data`の変更がHTML属性へ書き戻されることはありません。

属性がない場合や空文字の場合に返す`{}`はキャッシュしません。その後で属性にJSONを設定すると、次回の実行で読み取ります。

`unuse()`・`clear()`・同名ハンドラの再登録はキャッシュを消しません。通常のdata属性を後から変更・削除しても、既存のキャッシュが優先されます。動的な値には`data-uncache-ハンドラ名`を使ってください。この属性を外すと以前の通常属性のキャッシュを再び使います。キャッシュを明示的に消す公開APIはありません。

---

## 🧭 イベントの種類

DomTriggerは、HTMLのクラス名でイベントを表現します。イベントごとに（例：click / submit）`data-イベント名-prevent-default` / `data-イベント名-stop-propagation`を付けることで、既定動作の抑止やイベント伝播の停止をHTML側で制御できます。

属性は存在すると有効になり、値が文字列`"false"`の場合だけ無効になります。DomTriggerが扱うイベントで、対応するトリガークラスがある要素に指定します。

例：

```html
<button class="js-click-open" data-click-stop-propagation></button>
<input class="js-change-update" />
<form class="js-submit-register" data-submit-prevent-default></form>
<div class="js-keydown-search" tabindex="0"></div>
```

### 複数ハンドラの実行順

クリックなどの要素上のイベントでは、イベントを受け取ったDomTriggerが対象要素から親方向へたどり、内側から外側の順にハンドラを呼び出します。同じ要素では、対応するトリガークラスの記述順に呼び出します。

各ハンドラの非同期処理の完了は待たずに、次のハンドラを呼び出します。完了順は開始順と一致するとは限りません。

`data-イベント名-stop-propagation`を指定した要素では、同じ要素の対応するハンドラをすべて呼び出した後、親方向のDomTrigger処理を打ち切ります。

### 外部のイベント処理への影響

停止属性は、DomTrigger以外のイベント処理にも影響します。例えば、次のボタンをクリックした場合です。

```html
<button class="js-click-open" data-click-stop-propagation>開く</button>
```

```ts
DomTrigger.setupOnReady({
	after: () => {
		document.addEventListener("click", () => {
			// 上のボタンのクリックでは実行されない
		});
	},
});
```

DomTriggerも内部で`document.addEventListener("click", ...)`を使っています。上の例では、DomTriggerが先にクリックを受け取り、`stopImmediatePropagation()`を呼ぶため、後から登録したdocumentのクリック処理は実行されません。windowへのバブリングも止まります。

停止属性に関係なく実行したいdocumentの処理は、DomTriggerより先に登録します。既に実行された処理は取り消されません。ボタンなど内側の要素に直接登録したリスナーや、キャプチャー段階のリスナーも先に実行されるため、この停止の対象にはなりません。

windowで受けるページイベントでも、停止属性がある場合は同じwindowに後から登録したリスナーを止めます。

以下に各イベントカテゴリを示します。

### 🟦 クリック / ポインターイベント

| イベント      | クラス接頭辞        | 例                       |
| ------------- | ------------------- | ------------------------ |
| click         | `js-click-`         | `js-click-like`          |
| pointerdown   | `js-pointerdown-`   | `js-pointerdown-start`   |
| pointermove   | `js-pointermove-`   | `js-pointermove-drag`    |
| pointerup     | `js-pointerup-`     | `js-pointerup-end`       |
| pointercancel | `js-pointercancel-` | `js-pointercancel-reset` |

`pointermove`のハンドラは、DomTriggerが`pointerdown`を受け取ってから`pointerup`または`pointercancel`を受け取るまで実行します。押下開始位置にトリガークラスがなくても追跡を開始します。ポインターIDごとの追跡や、ブラウザ自体のイベント発生の制御は行いません。

### 🟩 入力 / フォームイベント

| イベント | クラス接頭辞 | 例                 |
| -------- | ------------ | ------------------ |
| input    | `js-input-`  | `js-input-filter`  |
| change   | `js-change-` | `js-change-option` |
| submit   | `js-submit-` | `js-submit-form`   |

### 🟨 フォーカスイベント

| イベント | 接頭辞         |
| -------- | -------------- |
| focusin  | `js-focusin-`  |
| focusout | `js-focusout-` |

### 🟧 キーボードイベント

| イベント | 接頭辞        |
| -------- | ------------- |
| keydown  | `js-keydown-` |
| keyup    | `js-keyup-`   |

キーボード操作に使用できます。要素自身がキーイベントを受け取るには、フォーカス可能である必要があります。上の`div`の例では`tabindex="0"`を付けています。

### 🟫 マウスイベント

| イベント  | 接頭辞          |
| --------- | --------------- |
| mouseover | `js-mouseover-` |
| mouseout  | `js-mouseout-`  |

マウスによるホバー演出などに使用できます。

### 🟪 ページ / ライフサイクル

| イベント         | 接頭辞                 |
| ---------------- | ---------------------- |
| load             | `js-load-`             |
| pageshow         | `js-pageshow-`         |
| pagehide         | `js-pagehide-`         |
| visibilitychange | `js-visibilitychange-` |

ページ単位のトリガーは`body`に設定します。監視開始前に発生したイベントは再実行されません。

### 🟦 ネットワーク

| イベント | 接頭辞        |
| -------- | ------------- |
| online   | `js-online-`  |
| offline  | `js-offline-` |

ページ単位のトリガーと同様に、`body`に設定します。

### 🟩 クリップボード

| イベント | 接頭辞      |
| -------- | ----------- |
| copy     | `js-copy-`  |
| paste    | `js-paste-` |

### 🟪 アニメーション

| イベント      | 接頭辞              |
| ------------- | ------------------- |
| transitionend | `js-transitionend-` |
| animationend  | `js-animationend-`  |

---

## 👁️ ビュートリガー

表示領域への出入りは`IntersectionObserver`で監視します。

ここでのin/outは、ビューポートとの交差状態と表示割合による判定です。`opacity: 0`や他の要素による覆い隠しなど、見た目としての可視性を判定するものではありません。

```html
<div class="js-viewin-fade" data-view-ratio="0.3"></div>
<div class="js-viewout-fade"></div>
```

- `js-viewin-…` → 指定割合以上見えたら実行
- `js-viewout-…` → in状態から外れたら実行
- `data-view-ratio` → 0〜1（例：0.3 = 30% 以上見えたら）

割合の既定値は0です。属性値は`parseFloat()`で読み取り、範囲外や数値として解釈できない値も0として扱います。`isIntersecting`が`true`かつ表示割合が指定値以上ならinです。既定値0では、境界に接して表示割合が0でもinになる場合があります。初回にinなら`viewin`を実行し、初回のoutでは`viewout`を実行しません。その後はin/outの状態が切り替わったときに実行します。

表示割合の変化は10%刻みで判定するため、`data-view-ratio`も0.1刻みでの指定を推奨します。例えば`0.35`を指定しても、35%を境に直ちに切り替わるわけではありません。徐々に表示割合が増える場合は40%付近でinに、減る場合は30%付近でoutになります。監視開始時は、その時点の表示割合で判定します。

---

## 🛠️ API

以下のAPIは、named exportと`DomTrigger`のメソッドの両方で使えます。

`run()`・`invoke()`は`Promise<void>`を、それ以外のAPIは`void`を返します。

### `DomTrigger.use(name, handler)`

ハンドラを登録します。同じ名前で再登録した場合は、後から登録したハンドラで上書きします。

戻り値は`void`です。名前は英小文字で始め、英小文字・数字をハイフンで区切る形式にします（例：`open-menu`、`step-2`）。不正な名前や下記の予約語は例外になります。

イベントはHTML側、処理の意味はハンドラ名で表現します。例えば`click-open-menu`ではなく`open-menu`を登録し、`js-click-open-menu`や`js-viewin-open-menu`で実行します。同じハンドラを別のイベントに割り当てたり、`run("open-menu")`で直接実行したりできます。

設定属性との衝突・混同を避け、イベントと処理名を分離するため、次の語の単体と「その語＋`-`」で始まる名前は登録できません。

- 設定語：`prevent-default` / `stop-propagation` / `view-ratio` / `uncache`
- 対応する通常イベント名（上記「イベントの種類」を参照）と`viewin` / `viewout`

例：`click` / `click-open` / `input` / `load-data` / `viewin-fade` / `prevent-default-if-needed`は登録できません。`clickable`や`open-menu`は登録できます。

### `DomTrigger.run(name, options?)`

登録済みハンドラを手動実行し、完了を待つ`Promise<void>`を返します。`options`には`el`・`data`・`event`を任意で渡せます。要素のdata属性は自動で読みません。

```ts
DomTrigger.use<{ message: string }>("notify", ({ data }) => {
	console.log(data?.message);
});
DomTrigger.run("notify", { data: { message: "保存しました" } }).catch(
	console.error
);
```

ハンドラが未登録なら何もしません。不正な名前やハンドラの例外・Promise拒否は返されたPromiseの拒否になります。

### `DomTrigger.invoke(name, el, event?)`

要素のdata属性を読み、登録済みハンドラを呼ぶ`Promise<void>`を返します。DOMイベント自体をdispatchするメソッドではありません。未登録なら何もしません。不正な名前、不正なJSON、ハンドラの失敗はPromiseの拒否になります。

HTML・ビュートリガー経由の実行はこのPromiseの完了を待たず、拒否も自動で処理しません。同期・非同期いずれのハンドラの失敗も、ハンドラ側で処理してください。ハンドラ実行前のJSONパースエラーは上記「data属性について」の制約を参照してください。

### `DomTrigger.listen()`

ビュートリガー以外のトリガーの監視を開始します。繰り返し呼んでも同じイベントのリスナーを重複登録しません。通常イベントはイベント委譲のため、後から追加した要素にも対応します。

### `DomTrigger.observeView()`

ビュートリガーの監視対象を現在のDOMに合わせて更新します。DOMの追加・削除・置換後や、ビュートリガーのクラス変更後に呼び出します。

新しい対象の監視を開始し、DOMから外れた要素や有効なビュートリガーがなくなった要素の監視を解除します。継続対象の表示状態は維持します。要素の削除やビュートリガーのクラス削除によって監視対象から外れた場合、`viewout`は実行しません。

DOMの変更は自動検知しません。監視を解除した要素の再登録時は、新しい対象として表示状態を判定します。

### `DomTrigger.unuse(name)`

指定名のハンドラを削除し、`void`を返します。未登録名は何もせず、不正な形式の名前は例外になります。

### `DomTrigger.clear()`

登録済みのハンドラをすべて削除します。`unuse()`と同様に、イベントリスナー・ビュー監視・data属性のキャッシュは残ります。監視全体を停止する公開APIはありません。

### `DomTrigger.setup()`

`listen()`と`observeView()`を順に実行します。DOMの準備を待つ場合は`setupOnReady()`を使ってください。

### `DomTrigger.setupOnReady(options?)`

DOMの読み込み中はDOMContentLoadedを待ち、読み込み済みなら即時実行します。`before` → `setup()` → `after`の順に同期的に呼び出します。各オプションは省略できます。

繰り返し呼び出しても通常イベントのリスナーや継続対象のビュー監視は重複登録しません。ただし、初期化処理と`before`・`after`は呼び出しごとに実行します。コールバック内で追加するリスナーなどは、呼び出し側で重複を避けてください。

```ts
const recordClick = () => console.log("クリックを記録");
const closeMenu = () => console.log("メニューを閉じる処理");

DomTrigger.setupOnReady({
	before: () => {
		document.addEventListener("click", recordClick);
	},
	after: () => {
		document.addEventListener("click", closeMenu);
	},
	onError: (error) => {
		console.error("初期化に失敗しました", error);
	},
});
```

上の例では、`recordClick`はDomTriggerより先に動き、`closeMenu`は停止属性によって実行を止められます。同じdocument上のバブリングリスナーを登録する例です。初回の初期化で指定し、事前に`listen()` / `setup()`で登録済みの場合は順序を変更しません。コールバックが返すPromiseは待ちません。

`before` / `setup()` / `after`のいずれかが例外を投げた場合、以降の処理を中止し、省略可能な`onError(error)`を呼び出します。`onError`がなければ例外を再throwします。DOMContentLoadedを待つ場合も`onError`で捕捉できますが、呼び出し元の`try/catch`では捕捉できません。非同期処理のPromise拒否は対象外です。

---

## 不具合報告・問い合わせ

[公開元のIssues](https://github.com/mountain-bell/dom-trigger/issues)へ、パッケージ名・バージョン・ブラウザ・再現用HTMLとコードを添えて報告してください。

---

## 📄 ライセンス

MIT  
© 2025-2026 mountain-bell

---

## 👤 作者

[mountain-bell](https://github.com/mountain-bell) (a.k.a. MB)
