# Shenzhen Typhoon Live Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the Shenzhen Typhoon one-screen page to GitHub Pages with a 15-minute official-data refresh and an explicit safe fallback.

**Architecture:** A dependency-free Node fetcher validates and normalizes Shenzhen Typhoon Network responses into `dist/data/current.json`. Browser presentation code renders that contract into the existing static dashboard and never labels fallback data as live. A GitHub Actions workflow generates the JSON inside its deployment workspace and deploys `dist` to Pages without committing refreshed data back to the repository.

**Tech Stack:** Static HTML/CSS/ES modules, Node.js 22 built-in `fetch` and `node:test`, GitHub Actions, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-10-16-shenzhen-typhoon-live-data.md`

## Global Constraints

- Use the public `https://tf.121.com.cn/` endpoints named in the spec; do not scrape a visual map or embed credentials.
- Use Node.js 22 and no npm runtime dependencies for scheduled data generation.
- Preserve all three modes: `live`, `no-active-storm`, and `demo-fallback`; only `live` may display real storm fields.
- Show the data source and generated time in every mode; label any unavailable-data view “试验 · 演示数据”.
- Treat the four action lists as generic self-check lists, not real-time government instructions.
- The GitHub workflow schedules `*/15 * * * *`, supports manual dispatch, and deploys artifacts rather than committing periodic updates.

---

### Task 1: Establish the normalised data contract

**Files:**
- Create: `dist/data-model.js`
- Create: `test/data-model.test.mjs`
- Create: `dist/data/current.json`

**Interfaces:**
- Consumes: parsed values from the official endpoints as plain objects.
- Produces: `normaliseCurrentTyphoon({ current, bulletin, forecast, retrievedAt })`, `createNoActiveStorm({ retrievedAt })`, `createDemoFallback({ retrievedAt, reason })`, and `isSupportedDataset(dataset)`.

- [x] **Step 1: Write the failing data-contract tests**

```js
import { normaliseCurrentTyphoon, createDemoFallback } from "../dist/data-model.js";

test("normaliseCurrentTyphoon emits a live dataset with an estimated Shenzhen distance", () => {
  const result = normaliseCurrentTyphoon({ current: fixturePoint, bulletin: fixtureBulletin, forecast: fixtureForecast, retrievedAt: "2026-10-16T00:00:00.000Z" });
  assert.equal(result.mode, "live");
  assert.equal(result.storm.name, "测试台风");
  assert.equal(result.track.at(-1).kind, "observed");
  assert.equal(result.forecast[0].agency, "BABJ");
  assert.ok(result.calculated.shenzhenDistanceKm > 0);
});

test("createDemoFallback never marks fixture values as live", () => {
  assert.equal(createDemoFallback({ retrievedAt: "2026-10-16T00:00:00.000Z", reason: "timeout" }).mode, "demo-fallback");
});
```

- [x] **Step 2: Run the contract tests and verify they fail because the module is missing**

Run: `node --test test/data-model.test.mjs`

Expected: `ERR_MODULE_NOT_FOUND` for `dist/data-model.js`.

- [x] **Step 3: Implement the small pure data model**

```js
export const SHENZHEN = { latitude: 22.5431, longitude: 114.0579 };
export function createNoActiveStorm({ retrievedAt }) {
  return { schemaVersion: 1, mode: "no-active-storm", retrievedAt, source: SOURCE, reason: "官方接口未返回活动台风" };
}
export function createDemoFallback({ retrievedAt, reason }) {
  return { schemaVersion: 1, mode: "demo-fallback", retrievedAt, source: SOURCE, reason, storm: DEMO_STORM, track: DEMO_TRACK, forecast: DEMO_FORECAST, calculated: { shenzhenDistanceKm: 310 } };
}
```

Map only validated finite number fields, translate `/Date(epoch)/` into ISO strings, and calculate distance with a local haversine helper. Reject unrecognised top-level schema/mode in `isSupportedDataset`.

- [x] **Step 4: Run the data-contract tests and the existing suite**

Run: `node --test test/data-model.test.mjs && npm.cmd test`

Expected: all tests pass.

- [x] **Step 5: Add a checked-in fallback JSON fixture**

Write `dist/data/current.json` as a `demo-fallback` instance with a reason explaining it is for local/static preview. This lets the browser have safe content before its first Action deployment.

- [x] **Step 6: Commit the contract work**

```bash
git add dist/data-model.js dist/data/current.json test/data-model.test.mjs
git commit -m "feat: add typhoon data contract"
```

### Task 2: Fetch and validate Shenzhen Typhoon Network data

**Files:**
- Create: `scripts/fetch-typhoon-data.mjs`
- Create: `test/fetch-typhoon-data.test.mjs`

**Interfaces:**
- Consumes: `fetchCurrentDataset({ fetchImpl, now })` dependency injection and the official endpoint JSON.
- Produces: a supported dataset from Task 1; command-line execution writes the file passed by `--output` and exits 0 even for safe fallback output.

- [x] **Step 1: Write failing fetcher tests using a finite response map**

```js
import { fetchCurrentDataset } from "../scripts/fetch-typhoon-data.mjs";

test("fetchCurrentDataset requests bulletin and BABJ forecast after selecting maximpact", async () => {
  const calls = [];
  const dataset = await fetchCurrentDataset({ fetchImpl: async (url) => fixtureFetch(url, calls), now: () => new Date("2026-10-16T00:00:00Z") });
  assert.equal(dataset.mode, "live");
  assert.ok(calls.some((url) => url.includes("typhoonBabj/tcno_")));
  assert.ok(calls.some((url) => url.includes("tyForecast/GetTyphoonForecast_")));
});

test("fetchCurrentDataset returns demo-fallback when the current endpoint rejects", async () => {
  const dataset = await fetchCurrentDataset({ fetchImpl: async () => { throw new Error("network down"); }, now: () => new Date("2026-10-16T00:00:00Z") });
  assert.equal(dataset.mode, "demo-fallback");
  assert.match(dataset.reason, /network down/);
});
```

- [x] **Step 2: Run the fetcher tests and verify they fail because the export is missing**

Run: `node --test test/fetch-typhoon-data.test.mjs`

Expected: import/export failure for `fetchCurrentDataset`.

- [x] **Step 3: Implement the fetcher and CLI writer**

Use `fetch(url, { signal: AbortSignal.timeout(15000), headers: { Accept: "application/json" } })`. Select `maximpact` only when it points to a non-empty `typhoons` array, otherwise use the latest valid array. Fetch the bulletin and forecast defensively; a bulletin/forecast failure may omit only that optional section, while current-data failure creates `demo-fallback`. Use `mkdir({ recursive: true })` and `writeFile` for `--output`.

- [x] **Step 4: Run focused and full tests**

Run: `node --test test/fetch-typhoon-data.test.mjs && npm.cmd test`

Expected: all tests pass.

- [x] **Step 5: Exercise the script without publishing**

Run: `node scripts/fetch-typhoon-data.mjs --output .tmp/current.json`

Expected: `.tmp/current.json` parses as JSON and has one of the three supported modes. Remove only the verified `.tmp/current.json` afterward.

- [x] **Step 6: Commit the fetcher work**

```bash
git add scripts/fetch-typhoon-data.mjs test/fetch-typhoon-data.test.mjs
git commit -m "feat: fetch Shenzhen typhoon data safely"
```

### Task 3: Render live, inactive, and fallback states in the one-screen page

**Files:**
- Modify: `dist/index.html`
- Modify: `dist/app.js`
- Modify: `test/app.test.mjs`

**Interfaces:**
- Consumes: supported JSON fetched from `./data/current.json` and the data model’s three modes.
- Produces: `getPresentation(dataset)` and `applyDataset({ dataset, elements })`, plus stable element IDs in `index.html`.

- [x] **Step 1: Write failing presentation tests**

```js
import { getPresentation } from "../dist/app.js";

test("getPresentation gives a real source label only to live data", () => {
  assert.equal(getPresentation(liveFixture).badge, "实时数据 · 深圳台风网");
  assert.equal(getPresentation(fallbackFixture).badge, "试验 · 演示数据");
});

test("getPresentation does not fabricate storm details without active data", () => {
  const view = getPresentation({ schemaVersion: 1, mode: "no-active-storm", retrievedAt: "2026-10-16T00:00:00.000Z", source: sourceFixture, reason: "无活动台风" });
  assert.match(view.title, /当前无活动台风/);
  assert.equal(view.showTrack, false);
});
```

- [x] **Step 2: Run the presentation test and verify it fails because `getPresentation` is absent**

Run: `node --test test/app.test.mjs`

Expected: named export error for `getPresentation`.

- [x] **Step 3: Add explicit dynamic targets to the existing HTML**

Keep the current visual structure and checklists. Add IDs for badge, notice, storm title/lead, generated time, source text, four facts, route SVG/title/description, and route narrative. Preserve the static initial fallback as a no-JavaScript-safe presentation.

- [x] **Step 4: Implement presentation and browser loading**

`getPresentation` must return safe copy for every mode. `initialisePage` must fetch `./data/current.json` with `{ cache: "no-store" }`, validate it with `isSupportedDataset`, and call `applyDataset`; fetch/parse failure must call `applyDataset` with a generated demo fallback. Render only observed/forecast points supplied by the dataset; for no-active-storm clear/hide the route instead of leaving old coordinates. Leave alert selection manual and label it as a resident self-check list.

- [x] **Step 5: Add `applyDataset` behavior tests and run all browser-independent tests**

```js
test("applyDataset replaces fallback labels with official live presentation", () => {
  const elements = createElements();
  applyDataset({ dataset: liveFixture, elements });
  assert.equal(elements.badge.textContent, "实时数据 · 深圳台风网");
  assert.match(elements.stormName.textContent, /测试台风/);
  assert.match(elements.source.textContent, /深圳台风网/);
});
```

Run: `npm.cmd test`

Expected: all tests pass.

- [x] **Step 6: Commit the page state work**

```bash
git add dist/index.html dist/app.js test/app.test.mjs
git commit -m "feat: render official and fallback typhoon states"
```

### Task 4: Add scheduled GitHub Pages deployment

**Files:**
- Create: `.github/workflows/deploy-pages.yml`
- Modify: `package.json`

**Interfaces:**
- Consumes: `scripts/fetch-typhoon-data.mjs` and the `dist` site directory.
- Produces: a Pages artifact containing `dist/data/current.json`; no repository commit is made by the scheduled job.

- [x] **Step 1: Create the declarative Pages workflow**

This is declarative GitHub configuration, so its meaningful verification is a real GitHub Actions run rather than a source-text test. Use this exact job sequence: `on.workflow_dispatch`, quoted `*/15 * * * *`, `actions/checkout@v4`, `actions/setup-node@v4` with `node-version: 22`, `node scripts/fetch-typhoon-data.mjs --output dist/data/current.json`, `actions/configure-pages@v5`, `actions/upload-pages-artifact@v3` with `path: ./dist`, and `actions/deploy-pages@v4`. Set only the Pages-related permissions and deploy concurrency group.

- [x] **Step 2: Include all behavioral tests in the standard command and verify them**

Change the `test` script to `node --test test/*.test.mjs`.

Run: `npm.cmd test`

Expected: all data, fetcher, presentation, and static-page tests pass.

- [ ] **Step 3: Check the workflow syntax through the GitHub Actions run after publishing**

Run: the manually dispatched `deploy-pages.yml` workflow in Task 5.

Expected: the job accepts the schedule/workflow syntax, generates data, uploads exactly `dist`, and completes the Pages deployment. A workflow that does not start or fails before the fetch step must be corrected before the task is complete.

- [x] **Step 4: Commit the deployment automation**

```bash
git add .github/workflows/deploy-pages.yml package.json
git commit -m "ci: deploy refreshed typhoon site to Pages"
```

### Task 5: Document, publish, and verify the live site

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: the workflow and JSON schema from Tasks 1–4.
- Produces: operational instructions for the public repository and expected URL `https://mario-vip-9527.github.io/shenzhen-typhoon-hub/`.

- [x] **Step 1: Update README with operational boundaries**

Document the source URL, the distinction among `live`, `no-active-storm`, and `demo-fallback`, why the action lists are not orders, `npm.cmd test`, a local fetch invocation, manual Actions dispatch, and that schedule timing is best effort.

- [x] **Step 2: Run final local verification**

Run: `npm.cmd test` and `node scripts/fetch-typhoon-data.mjs --output .tmp/current.json`.

Expected: all tests pass and output JSON has an allowed mode. Remove the exact generated `.tmp/current.json` after reading its mode.

- [ ] **Step 3: Commit and publish exactly the project files**

```bash
git add README.md
git commit -m "docs: explain live typhoon data operation"
git remote add origin https://github.com/Mario-VIP-9527/shenzhen-typhoon-hub.git
git push -u origin HEAD:main
```

If Git credential-manager authentication is unavailable, use the authenticated GitHub connector to create the initial files/commit rather than exposing a token or asking the user to share one.

- [ ] **Step 4: Enable GitHub Pages with GitHub Actions as its source**

In repository Settings → Pages, choose **GitHub Actions** under Build and deployment. Do not select branch-based Pages because the deployment is an Action artifact.

- [ ] **Step 5: Trigger and inspect the first deployment**

Use `workflow_dispatch` or the Actions UI. Confirm the data script step exits successfully, confirm the Pages deployment succeeds, then load `https://mario-vip-9527.github.io/shenzhen-typhoon-hub/` and verify its badge/source/time agree with `dist/data/current.json` from that run.

- [ ] **Step 6: Commit any only documentation-side adjustments and report the verified URL**

```bash
git status --short
git log --oneline -5
```

Expected: no uncommitted project changes; report the final Pages URL and whether the first dataset was `live`, `no-active-storm`, or `demo-fallback`.
