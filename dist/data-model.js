export const SOURCE = {
  name: "深圳台风网",
  url: "https://tf.121.com.cn/",
};

export const SHENZHEN = {
  latitude: 22.5431,
  longitude: 114.0579,
};

const RADIAN = Math.PI / 180;
const EARTH_RADIUS_KM = 6371;

function asFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function asNonEmptyString(value, fallback = "未提供") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function officialDateToIso(value) {
  if (typeof value === "string") {
    const match = value.match(/\/Date\((-?\d+)/);
    if (match) return new Date(Number(match[1])).toISOString();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }

  const parsed = Date.parse(value);
  if (Number.isFinite(parsed)) return new Date(parsed).toISOString();

  return null;
}

function distanceBetween({ latitude: oneLatitude, longitude: oneLongitude }, { latitude: twoLatitude, longitude: twoLongitude }) {
  const latitudeDelta = (twoLatitude - oneLatitude) * RADIAN;
  const longitudeDelta = (twoLongitude - oneLongitude) * RADIAN;
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(oneLatitude * RADIAN) * Math.cos(twoLatitude * RADIAN) * Math.sin(longitudeDelta / 2) ** 2;

  return Math.round(EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function normaliseObservedPoint(point) {
  const latitude = asFiniteNumber(point?.LATITUDE);
  const longitude = asFiniteNumber(point?.LONGITUDE);
  const at = officialDateToIso(point?.ISSUEDATE);

  if (latitude === null || longitude === null || !at) return null;

  return {
    at,
    latitude,
    longitude,
    kind: "observed",
    windMps: asFiniteNumber(point.WIND),
    pressureHpa: asFiniteNumber(point.AIRPRESSURE),
  };
}

function normaliseForecastPoint(point) {
  const latitude = asFiniteNumber(point?.LATITUDE);
  const longitude = asFiniteNumber(point?.LONGITUDE);
  const at = officialDateToIso(point?.FORECASTDATE);

  if (latitude === null || longitude === null || !at) return null;

  return {
    at,
    latitude,
    longitude,
    kind: "forecast",
    agency: "BABJ",
    hoursAhead: asFiniteNumber(point.INTERVALTIME),
    windMps: asFiniteNumber(point.WIND),
    pressureHpa: asFiniteNumber(point.AIRPRESSURE),
  };
}

function hasValidStorm(storm) {
  return Boolean(
    storm
    && typeof storm.name === "string"
    && Number.isFinite(storm.latitude)
    && Number.isFinite(storm.longitude)
    && Number.isFinite(storm.windMps)
    && Number.isFinite(storm.pressureHpa),
  );
}

function hasSource(dataset) {
  return Boolean(dataset?.source && typeof dataset.source.name === "string" && typeof dataset.source.url === "string");
}

export function createNoActiveStorm({ retrievedAt }) {
  return {
    schemaVersion: 1,
    mode: "no-active-storm",
    retrievedAt,
    source: SOURCE,
    reason: "官方接口未返回活动台风",
  };
}

export function createDemoFallback({ retrievedAt, reason }) {
  const issueTime = new Date(Date.parse(retrievedAt) - 30 * 60 * 1000).toISOString();

  return {
    schemaVersion: 1,
    mode: "demo-fallback",
    retrievedAt,
    source: SOURCE,
    reason: asNonEmptyString(reason, "实时数据暂不可用"),
    storm: {
      id: "DEMO-A01",
      name: "试验风暴 A-01",
      englishName: "DEMO A-01",
      latitude: 20.6,
      longitude: 116.2,
      windMps: 23,
      pressureHpa: 970,
      movementDirection: "西北",
      movementSpeedKmh: 18,
      sourceIssuedAt: issueTime,
      location: "深圳东南海域外（演示）",
      conclusion: "演示路径，仅用于说明页面布局。",
    },
    track: [
      { at: new Date(Date.parse(issueTime) - 24 * 60 * 60 * 1000).toISOString(), latitude: 19.8, longitude: 117.7, kind: "observed", windMps: 20, pressureHpa: 985 },
      { at: issueTime, latitude: 20.6, longitude: 116.2, kind: "observed", windMps: 23, pressureHpa: 970 },
    ],
    forecast: [
      { at: new Date(Date.parse(issueTime) + 12 * 60 * 60 * 1000).toISOString(), latitude: 21.2, longitude: 115.5, kind: "forecast", agency: "BABJ", hoursAhead: 12, windMps: 25, pressureHpa: 965 },
      { at: new Date(Date.parse(issueTime) + 24 * 60 * 60 * 1000).toISOString(), latitude: 21.8, longitude: 114.8, kind: "forecast", agency: "BABJ", hoursAhead: 24, windMps: 27, pressureHpa: 960 },
    ],
    calculated: { shenzhenDistanceKm: 310 },
  };
}

export function normaliseCurrentTyphoon({ current, bulletin = {}, forecast = {}, retrievedAt }) {
  const observed = Array.isArray(current) ? current.map(normaliseObservedPoint).filter(Boolean) : [];
  const latest = observed.at(-1);
  const rawLatest = Array.isArray(current) ? current.at(-1) : null;

  if (!latest || !rawLatest) throw new Error("当前台风数据不完整");

  const windMps = asFiniteNumber(rawLatest.WIND);
  const pressureHpa = asFiniteNumber(rawLatest.AIRPRESSURE);
  if (windMps === null || pressureHpa === null) throw new Error("当前台风强度数据不完整");

  const forecastPoints = Array.isArray(forecast?.BABJ)
    ? forecast.BABJ.map(normaliseForecastPoint).filter(Boolean)
    : [];

  const storm = {
    id: asNonEmptyString(rawLatest.TCIDX || rawLatest.TCNO, "未知编号"),
    name: asNonEmptyString(rawLatest.CNAME, "未命名台风"),
    englishName: asNonEmptyString(rawLatest.ENAME, "UNNAMED"),
    latitude: latest.latitude,
    longitude: latest.longitude,
    windMps,
    pressureHpa,
    movementDirection: asNonEmptyString(rawLatest.MOVEDIR),
    movementSpeedKmh: asFiniteNumber(rawLatest.MOVESPEED) ?? 0,
    sourceIssuedAt: latest.at,
    location: asNonEmptyString(bulletin.Location),
    conclusion: asNonEmptyString(bulletin.Conclusion),
  };

  return {
    schemaVersion: 1,
    mode: "live",
    retrievedAt,
    source: SOURCE,
    storm,
    track: observed,
    forecast: forecastPoints,
    calculated: {
      shenzhenDistanceKm: distanceBetween(storm, SHENZHEN),
    },
  };
}

export function isSupportedDataset(dataset) {
  if (!dataset || dataset.schemaVersion !== 1 || !hasSource(dataset) || typeof dataset.retrievedAt !== "string") return false;

  if (dataset.mode === "no-active-storm") return typeof dataset.reason === "string" && !("storm" in dataset);

  if (dataset.mode === "live" || dataset.mode === "demo-fallback") {
    return hasValidStorm(dataset.storm)
      && Array.isArray(dataset.track)
      && dataset.track.length > 0
      && Array.isArray(dataset.forecast)
      && Number.isFinite(dataset.calculated?.shenzhenDistanceKm);
  }

  return false;
}
