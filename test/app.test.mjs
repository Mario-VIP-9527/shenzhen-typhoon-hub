import assert from "node:assert/strict";
import test from "node:test";

import { applyDataset, getPresentation, setLevel, setTheme } from "../dist/app.js";

const source = { name: "深圳台风网", url: "https://tf.121.com.cn/" };
const liveDataset = {
  schemaVersion: 1,
  mode: "live",
  retrievedAt: "2026-10-16T00:00:00.000Z",
  source,
  storm: {
    id: "9991",
    name: "测试台风",
    englishName: "TEST STORM",
    latitude: 20.9,
    longitude: 115.9,
    windMps: 25,
    pressureHpa: 985,
    movementDirection: "西北",
    movementSpeedKmh: 20,
    sourceIssuedAt: "2026-10-15T23:00:00.000Z",
    location: "南海东北部海面",
    conclusion: "向西北方向移动",
  },
  track: [{ at: "2026-10-15T23:00:00.000Z", latitude: 20.9, longitude: 115.9, kind: "observed" }],
  forecast: [{ at: "2026-10-16T11:00:00.000Z", latitude: 21.5, longitude: 115.2, kind: "forecast", agency: "BABJ", hoursAhead: 12 }],
  calculated: { shenzhenDistanceKm: 230 },
};

function element() {
  return { textContent: "", innerHTML: "", hidden: false, dataset: {}, setAttribute() {} };
}

function presentationElements() {
  return {
    badge: element(),
    noticeTitle: element(),
    noticeText: element(),
    stormName: element(),
    stormLead: element(),
    warning: element(),
    updatedAt: element(),
    source: element(),
    pressure: element(),
    position: element(),
    positionDetail: element(),
    wind: element(),
    windDetail: element(),
    movement: element(),
    movementDetail: element(),
    distance: element(),
    distanceDetail: element(),
    route: element(),
    routeTitle: element(),
    routeDescription: element(),
    routeSideTitle: element(),
    routeSideLead: element(),
    routeList: element(),
  };
}

test("getPresentation labels official data as live without calling the checklist a warning", () => {
  const presentation = getPresentation(liveDataset);

  assert.equal(presentation.badge, "实时数据 · 深圳台风网");
  assert.equal(presentation.title, "测试台风");
  assert.equal(presentation.showTrack, true);
  assert.equal(presentation.facts.wind.value, "25 m/s");
  assert.match(presentation.warning, /居民自检清单/);
  assert.doesNotMatch(presentation.warning, /当前预警/);
});

test("getPresentation removes storm content when no activity is reported", () => {
  const presentation = getPresentation({
    schemaVersion: 1,
    mode: "no-active-storm",
    retrievedAt: "2026-10-16T00:00:00.000Z",
    source,
    reason: "官方接口未返回活动台风",
  });

  assert.equal(presentation.badge, "当前无活动台风");
  assert.match(presentation.title, /当前无活动台风/);
  assert.equal(presentation.showTrack, false);
});

test("applyDataset replaces fallback labels and route visibility from the selected dataset", () => {
  const elements = presentationElements();

  applyDataset({ dataset: liveDataset, elements });

  assert.equal(elements.badge.textContent, "实时数据 · 深圳台风网");
  assert.equal(elements.stormName.textContent, "测试台风");
  assert.match(elements.source.textContent, /深圳台风网/);
  assert.equal(elements.route.hidden, false);
  assert.match(elements.route.innerHTML, /测试台风/);

  applyDataset({
    dataset: { schemaVersion: 1, mode: "no-active-storm", retrievedAt: "2026-10-16T00:00:00.000Z", source, reason: "无活动台风" },
    elements,
  });
  assert.equal(elements.route.hidden, true);
  assert.match(elements.stormName.textContent, /当前无活动台风/);
});

test("setTheme applies the requested theme and an accessible control label", () => {
  const root = { dataset: {} };
  const button = {
    textContent: "",
    attributes: new Map(),
    setAttribute(name, value) { this.attributes.set(name, value); },
  };
  const saved = new Map();

  setTheme({ root, button, storage: saved, theme: "night" });

  assert.equal(root.dataset.theme, "night");
  assert.equal(button.textContent, "切换至日间");
  assert.equal(button.attributes.get("aria-pressed"), "true");
  assert.equal(saved.get("typhoon-demo-theme"), "night");
});

test("setLevel marks one alert card active and updates both labels", () => {
  const cards = ["blue", "yellow", "orange", "red"].map((level) => ({
    dataset: { level },
    classList: { active: false, toggle(name, value) { if (name === "active") this.active = value; } },
  }));
  const activeLabel = { textContent: "" };
  const heroWarning = { textContent: "" };

  setLevel({ level: "red", cards, activeLabel, heroWarning });

  assert.deepEqual(cards.map((card) => card.classList.active), [false, false, false, true]);
  assert.equal(activeLabel.textContent, "红色预警");
  assert.equal(heroWarning.textContent, "红色预警 · 演示");
});
