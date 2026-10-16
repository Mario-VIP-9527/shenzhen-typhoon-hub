import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createDemoFallback,
  createNoActiveStorm,
  normaliseCurrentTyphoon,
  officialDateToIso,
} from "../dist/data-model.js";

export const BASE_URL = "https://tf.121.com.cn/weather/typhoonWeb";
export const CURRENT_ENDPOINT = `${BASE_URL}/CheckCurrentTyphoon.txt`;

function timestampedUrl(url, now) {
  return `${url}?_=${now.getTime()}`;
}

async function fetchJson(fetchImpl, url) {
  const response = await fetchImpl(url, {
    headers: { Accept: "application/json, text/plain;q=0.9" },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response?.ok) throw new Error(`请求失败（HTTP ${response?.status ?? "未知"}）`);
  return response.json();
}

function pointIssueTime(point) {
  const iso = officialDateToIso(point?.ISSUEDATE);
  return iso ? Date.parse(iso) : Number.NEGATIVE_INFINITY;
}

export function selectCurrentPoints(payload) {
  const typhoons = payload?.typhoons;
  if (!typhoons || typeof typhoons !== "object") return [];

  const maxImpactKey = payload.maximpact === null || payload.maximpact === undefined ? null : String(payload.maximpact);
  if (maxImpactKey && Array.isArray(typhoons[maxImpactKey]) && typhoons[maxImpactKey].length > 0) {
    return typhoons[maxImpactKey];
  }

  const candidates = Object.values(typhoons).filter((points) => Array.isArray(points) && points.length > 0);
  candidates.sort((left, right) => pointIssueTime(right.at(-1)) - pointIssueTime(left.at(-1)));
  return candidates[0] ?? [];
}

function shenzhenIssueStamp(point) {
  const iso = officialDateToIso(point?.ISSUEDATE);
  if (!iso) return null;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const valueFor = (type) => parts.find((part) => part.type === type)?.value;

  return `${valueFor("year")}${valueFor("month")}${valueFor("day")}${valueFor("hour")}${valueFor("minute")}`;
}

async function fetchOptional(fetchImpl, url) {
  try {
    return await fetchJson(fetchImpl, url);
  } catch {
    return {};
  }
}

export async function fetchCurrentDataset({ fetchImpl = fetch, now = () => new Date() } = {}) {
  const generatedAt = now();
  const retrievedAt = generatedAt.toISOString();

  try {
    const currentPayload = await fetchJson(fetchImpl, timestampedUrl(CURRENT_ENDPOINT, generatedAt));
    const current = selectCurrentPoints(currentPayload);
    if (current.length === 0) return createNoActiveStorm({ retrievedAt });

    const latest = current.at(-1);
    const bulletin = latest?.TCNO
      ? await fetchOptional(fetchImpl, timestampedUrl(`${BASE_URL}/typhoonBabj/tcno_${latest.TCNO}.txt`, generatedAt))
      : {};
    const issueStamp = shenzhenIssueStamp(latest);
    const forecast = latest?.TCIDX && issueStamp
      ? await fetchOptional(fetchImpl, timestampedUrl(`${BASE_URL}/tyForecast/GetTyphoonForecast_${latest.TCIDX}_${issueStamp}.txt`, generatedAt))
      : {};

    return normaliseCurrentTyphoon({ current, bulletin, forecast, retrievedAt });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return createDemoFallback({ retrievedAt, reason: `实时数据暂不可用：${detail}` });
  }
}

export async function writeCurrentDataset({ output, fetchImpl, now } = {}) {
  if (!output) throw new Error("请通过 --output 指定 JSON 输出路径");

  const dataset = await fetchCurrentDataset({ fetchImpl, now });
  const destination = resolve(output);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, `${JSON.stringify(dataset, null, 2)}\n`, "utf8");
  return dataset;
}

function outputArgument(argv) {
  const index = argv.indexOf("--output");
  return index >= 0 ? argv[index + 1] : null;
}

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    const dataset = await writeCurrentDataset({ output: outputArgument(process.argv.slice(2)) });
    console.log(`Generated ${dataset.mode} dataset at ${dataset.retrievedAt}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
