import assert from "node:assert/strict";
import test from "node:test";

import {
  createDemoFallback,
  createNoActiveStorm,
  isSupportedDataset,
  normaliseCurrentTyphoon,
} from "../dist/data-model.js";

const retrievedAt = "2026-10-16T00:00:00.000Z";

const currentPoints = [
  {
    TCNO: "2601",
    TCIDX: "9991",
    CNAME: "测试台风",
    ENAME: "TEST STORM",
    LONGITUDE: 116.2,
    LATITUDE: 20.6,
    ISSUEDATE: "/Date(1792120400000)/",
    WIND: 23,
    AIRPRESSURE: 990,
    MOVESPEED: 18,
    MOVEDIR: "西北",
  },
  {
    TCNO: "2601",
    TCIDX: "9991",
    CNAME: "测试台风",
    ENAME: "TEST STORM",
    LONGITUDE: 115.9,
    LATITUDE: 20.9,
    ISSUEDATE: "/Date(1792124000000)/",
    WIND: 25,
    AIRPRESSURE: 985,
    MOVESPEED: 20,
    MOVEDIR: "西北",
  },
];

test("normaliseCurrentTyphoon emits a valid live dataset from official-shaped fields", () => {
  const dataset = normaliseCurrentTyphoon({
    current: currentPoints,
    bulletin: {
      Location: "南海东北部海面",
      Conclusion: "未来将向西北方向移动。",
    },
    forecast: {
      BABJ: [{
        FORECASTDATE: "/Date(1792167200000)/",
        LONGITUDE: 115.3,
        LATITUDE: 21.5,
        WIND: 28,
        AIRPRESSURE: 980,
        INTERVALTIME: 12,
      }],
    },
    retrievedAt,
  });

  assert.equal(dataset.mode, "live");
  assert.equal(dataset.storm.name, "测试台风");
  assert.equal(dataset.storm.windMps, 25);
  assert.equal(dataset.storm.location, "南海东北部海面");
  assert.equal(dataset.track.length, 2);
  assert.equal(dataset.track.at(-1).kind, "observed");
  assert.equal(dataset.forecast[0].agency, "BABJ");
  assert.equal(dataset.forecast[0].hoursAhead, 12);
  assert.ok(dataset.calculated.shenzhenDistanceKm > 100);
  assert.ok(dataset.calculated.shenzhenDistanceKm < 400);
  assert.equal(isSupportedDataset(dataset), true);
});

test("createNoActiveStorm has no fake storm fields", () => {
  const dataset = createNoActiveStorm({ retrievedAt });

  assert.equal(dataset.mode, "no-active-storm");
  assert.equal("storm" in dataset, false);
  assert.match(dataset.reason, /活动台风/);
  assert.equal(isSupportedDataset(dataset), true);
});

test("createDemoFallback is supported but never reports itself as live", () => {
  const dataset = createDemoFallback({ retrievedAt, reason: "网络超时" });

  assert.equal(dataset.mode, "demo-fallback");
  assert.equal(dataset.reason, "网络超时");
  assert.equal(dataset.storm.name, "试验风暴 A-01");
  assert.equal(isSupportedDataset(dataset), true);
});

test("isSupportedDataset rejects an incomplete live payload", () => {
  assert.equal(isSupportedDataset({ schemaVersion: 1, mode: "live", retrievedAt }), false);
});
