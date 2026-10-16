import assert from "node:assert/strict";
import test from "node:test";

import { fetchCurrentDataset } from "../scripts/fetch-typhoon-data.mjs";

const currentPoint = {
  TCNO: "2601",
  TCIDX: "9991",
  CNAME: "测试台风",
  ENAME: "TEST STORM",
  LONGITUDE: 116.2,
  LATITUDE: 20.6,
  ISSUEDATE: "/Date(1792124000000)/",
  WIND: 25,
  AIRPRESSURE: 985,
  MOVESPEED: 20,
  MOVEDIR: "西北",
};

function response(body, ok = true) {
  return {
    ok,
    status: ok ? 200 : 503,
    async json() { return body; },
  };
}

test("fetchCurrentDataset selects maximpact then requests bulletin and BABJ forecast", async () => {
  const calls = [];
  const dataset = await fetchCurrentDataset({
    fetchImpl: async (url) => {
      calls.push(url);
      if (url.includes("CheckCurrentTyphoon.txt")) {
        return response({ maximpact: "9991", typhoons: { 9991: [currentPoint] } });
      }
      if (url.includes("typhoonBabj/tcno_2601.txt")) {
        return response({ Location: "南海东北部海面", Conclusion: "向西北方向移动" });
      }
      if (url.includes("tyForecast/GetTyphoonForecast_9991_")) {
        return response({ BABJ: [{ FORECASTDATE: "/Date(1792167200000)/", LONGITUDE: 115.5, LATITUDE: 21.2, WIND: 27, AIRPRESSURE: 980, INTERVALTIME: 12 }] });
      }
      throw new Error(`意外请求：${url}`);
    },
    now: () => new Date("2026-10-16T00:00:00.000Z"),
  });

  assert.equal(dataset.mode, "live");
  assert.equal(dataset.storm.name, "测试台风");
  assert.equal(dataset.forecast[0].agency, "BABJ");
  assert.ok(calls.some((url) => url.includes("typhoonBabj/tcno_2601.txt")));
  assert.ok(calls.some((url) => url.includes("tyForecast/GetTyphoonForecast_9991_")));
});

test("fetchCurrentDataset marks a valid empty current response as no-active-storm", async () => {
  const dataset = await fetchCurrentDataset({
    fetchImpl: async () => response({ maximpact: null, typhoons: {} }),
    now: () => new Date("2026-10-16T00:00:00.000Z"),
  });

  assert.equal(dataset.mode, "no-active-storm");
  assert.equal("storm" in dataset, false);
});

test("fetchCurrentDataset returns demo-fallback when the current request fails", async () => {
  const dataset = await fetchCurrentDataset({
    fetchImpl: async () => { throw new Error("network down"); },
    now: () => new Date("2026-10-16T00:00:00.000Z"),
  });

  assert.equal(dataset.mode, "demo-fallback");
  assert.match(dataset.reason, /network down/);
});
