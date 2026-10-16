import { createDemoFallback, isSupportedDataset } from "./data-model.js";

const levelLabels = {
  blue: "蓝色预警",
  yellow: "黄色预警",
  orange: "橙色预警",
  red: "红色预警",
};

function readStorage(storage, key) {
  if (!storage) return null;
  return typeof storage.getItem === "function" ? storage.getItem(key) : storage.get(key);
}

function writeStorage(storage, key, value) {
  if (!storage) return;
  if (typeof storage.setItem === "function") storage.setItem(key, value);
  else storage.set(key, value);
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未提供";

  const values = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (name) => values.find((valuePart) => valuePart.type === name)?.value;
  return `${part("year")}-${part("month")}-${part("day")} ${part("hour")}:${part("minute")}`;
}

function coordinate(latitude, longitude) {
  return `${Number(latitude).toFixed(1)}°N / ${Number(longitude).toFixed(1)}°E`;
}

function withCommonPresentation(dataset, presentation) {
  return {
    ...presentation,
    updatedAt: `生成时间：${formatTime(dataset.retrievedAt)}（北京时间）`,
    source: `来源：${dataset.source.name} · 官方入口`,
    route: dataset.track ?? [],
    forecast: dataset.forecast ?? [],
  };
}

function noStormFacts() {
  return {
    position: { value: "—", detail: "当前没有可展示的风暴中心" },
    wind: { value: "—", detail: "无活动台风数据" },
    movement: { value: "—", detail: "请留意深圳市气象局后续发布" },
    distance: { value: "—", detail: "不是影响或风险判断" },
  };
}

export function getPresentation(dataset) {
  if (dataset.mode === "no-active-storm") {
    return withCommonPresentation(dataset, {
      badge: "当前无活动台风",
      noticeTitle: "实时说明",
      notice: `${dataset.reason}。本页会继续按计划刷新，请以官方发布为准。`,
      title: "当前无活动台风",
      lead: "深圳周边当前未从数据源取得活动台风。这里不展示模拟路径，也不推断影响。",
      warning: "居民自检清单 · 非实时预警",
      pressure: "—",
      facts: noStormFacts(),
      showTrack: false,
      routeTitle: "暂无路径可展示",
      routeLead: "没有活动台风时，本页不会保留旧路径或补造预测。",
      routeItems: [],
    });
  }

  const storm = dataset.storm;
  const live = dataset.mode === "live";
  const windKmh = Math.round(storm.windMps * 3.6);
  const facts = {
    position: {
      value: coordinate(storm.latitude, storm.longitude),
      detail: `${storm.location}${live ? "" : " · 演示"}`,
    },
    wind: {
      value: `${storm.windMps} m/s`,
      detail: `近中心最大风速 · 约 ${windKmh} km/h`,
    },
    movement: {
      value: storm.movementDirection,
      detail: `移动速度 ${storm.movementSpeedKmh} km/h`,
    },
    distance: {
      value: `约 ${dataset.calculated.shenzhenDistanceKm} km`,
      detail: "距深圳中心估算 · 不是影响判断",
    },
  };
  const firstForecast = dataset.forecast?.[0];

  return withCommonPresentation(dataset, {
    badge: live ? "实时数据 · 深圳台风网" : "试验 · 演示数据",
    noticeTitle: live ? "实时说明" : "试验提示",
    notice: live
      ? "本页自动读取深圳台风网公开数据。路径与时间仅供信息参考，正式预警和指令以政府发布为准。"
      : `实时数据暂不可用：${dataset.reason}。下方数字和路径为演示，不能作为避险依据。`,
    title: storm.name,
    lead: storm.conclusion || `${storm.name}当前位于${storm.location}。`,
    warning: live ? "居民自检清单 · 非实时预警" : "居民自检清单 · 演示数据",
    pressure: `${storm.pressureHpa} hPa`,
    facts,
    showTrack: Array.isArray(dataset.track) && dataset.track.length > 0,
    routeTitle: live ? "实况路径与官方预报" : "演示路径",
    routeLead: live
      ? "实线为已发布的实况点；虚线为数据源中的 BABJ 预报点。路径会随数据更新。"
      : "以下路径仅用来验证信息布局，不表示实际预报。",
    routeItems: [
      { label: "当前中心", value: coordinate(storm.latitude, storm.longitude) },
      ...(firstForecast ? [{ label: `+${firstForecast.hoursAhead ?? "?"}h 预报`, value: coordinate(firstForecast.latitude, firstForecast.longitude) }] : []),
      { label: "距深圳估算", value: `约 ${dataset.calculated.shenzhenDistanceKm} km` },
    ],
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    "\"": "&quot;",
  })[character]);
}

function renderRoute(dataset) {
  const points = [...dataset.track, ...dataset.forecast];
  const allPoints = [...points, { latitude: 22.5431, longitude: 114.0579 }];
  const latitudes = allPoints.map((point) => point.latitude);
  const longitudes = allPoints.map((point) => point.longitude);
  const padding = 0.35;
  const minLatitude = Math.min(...latitudes) - padding;
  const maxLatitude = Math.max(...latitudes) + padding;
  const minLongitude = Math.min(...longitudes) - padding;
  const maxLongitude = Math.max(...longitudes) + padding;
  const width = 650;
  const height = 330;
  const project = (point) => ({
    x: 42 + ((point.longitude - minLongitude) / (maxLongitude - minLongitude || 1)) * (width - 84),
    y: 42 + ((maxLatitude - point.latitude) / (maxLatitude - minLatitude || 1)) * (height - 84),
  });
  const path = (list) => list.map((point, index) => {
    const projected = project(point);
    return `${index === 0 ? "M" : "L"}${projected.x.toFixed(1)} ${projected.y.toFixed(1)}`;
  }).join(" ");
  const observed = dataset.track;
  const forecast = dataset.forecast;
  const current = observed.at(-1);
  const shenzhen = project({ latitude: 22.5431, longitude: 114.0579 });
  const currentProjected = project(current);
  const futurePath = forecast.length ? path([current, ...forecast]) : "";

  return `
    <title>${escapeHtml(dataset.storm.name)}路径示意</title>
    <desc>深圳标记、已发布实况点和 BABJ 预报点的简化地理投影，不是地图导航。</desc>
    <defs><pattern id="route-grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M 32 0 L 0 0 0 32" fill="none" stroke="currentColor" stroke-opacity=".12" stroke-width="1"/></pattern></defs>
    <rect x="0" y="0" width="650" height="330" rx="12" fill="url(#route-grid)" style="color:var(--ocean)"/>
    <path d="${path(observed)}" fill="none" stroke="var(--ocean)" stroke-width="3" stroke-linecap="round"/>
    ${futurePath ? `<path d="${futurePath}" fill="none" stroke="var(--orange)" stroke-width="3" stroke-dasharray="7 8" stroke-linecap="round"/>` : ""}
    <circle cx="${shenzhen.x.toFixed(1)}" cy="${shenzhen.y.toFixed(1)}" r="12" fill="var(--ocean)"/><path d="M${shenzhen.x.toFixed(1)} ${(shenzhen.y - 7).toFixed(1)}v14M${(shenzhen.x - 7).toFixed(1)} ${shenzhen.y.toFixed(1)}h14" stroke="#fff" stroke-width="2"/>
    <text x="${(shenzhen.x + 17).toFixed(1)}" y="${(shenzhen.y - 6).toFixed(1)}" class="svg-label">深圳</text>
    <text x="${(shenzhen.x + 17).toFixed(1)}" y="${(shenzhen.y + 11).toFixed(1)}" class="svg-small">22.54°N / 114.06°E</text>
    <circle cx="${currentProjected.x.toFixed(1)}" cy="${currentProjected.y.toFixed(1)}" r="13" fill="var(--yellow)"/><circle cx="${currentProjected.x.toFixed(1)}" cy="${currentProjected.y.toFixed(1)}" r="5" fill="var(--panel-solid)"/>
    <text x="${(currentProjected.x + 17).toFixed(1)}" y="${(currentProjected.y - 7).toFixed(1)}" class="svg-label">当前：${escapeHtml(dataset.storm.name)}</text>
    ${forecast.map((point) => { const projected = project(point); return `<circle cx="${projected.x.toFixed(1)}" cy="${projected.y.toFixed(1)}" r="7" fill="var(--orange)"/><text x="${(projected.x + 10).toFixed(1)}" y="${(projected.y - 8).toFixed(1)}" class="svg-small">+${escapeHtml(point.hoursAhead ?? "?")}h</text>`; }).join("")}
  `;
}

function setText(element, value) {
  if (element) element.textContent = value;
}

export function applyDataset({ dataset, elements, root }) {
  const presentation = getPresentation(dataset);
  if (root) root.dataset.sourceMode = dataset.mode;

  setText(elements.badge, presentation.badge);
  setText(elements.noticeTitle, presentation.noticeTitle);
  setText(elements.noticeText, presentation.notice);
  setText(elements.stormName, presentation.title);
  setText(elements.stormLead, presentation.lead);
  setText(elements.warning, presentation.warning);
  setText(elements.updatedAt, presentation.updatedAt);
  setText(elements.source, presentation.source);
  setText(elements.pressure, presentation.pressure);
  setText(elements.position, presentation.facts.position.value);
  setText(elements.positionDetail, presentation.facts.position.detail);
  setText(elements.wind, presentation.facts.wind.value);
  setText(elements.windDetail, presentation.facts.wind.detail);
  setText(elements.movement, presentation.facts.movement.value);
  setText(elements.movementDetail, presentation.facts.movement.detail);
  setText(elements.distance, presentation.facts.distance.value);
  setText(elements.distanceDetail, presentation.facts.distance.detail);
  setText(elements.routeSideTitle, presentation.routeTitle);
  setText(elements.routeSideLead, presentation.routeLead);
  if (elements.routeList) {
    elements.routeList.innerHTML = presentation.routeItems.map((item) => `<li><i></i><div><b>${escapeHtml(item.label)}</b><br><span>${escapeHtml(item.value)}</span></div></li>`).join("");
  }
  if (elements.route) {
    elements.route.hidden = !presentation.showTrack;
    elements.route.innerHTML = presentation.showTrack ? renderRoute(dataset) : "";
    elements.route.setAttribute?.("aria-label", presentation.showTrack ? `${presentation.title}路径示意` : "当前没有路径可展示");
  }
  return presentation;
}

export function setTheme({ root, button, storage, theme }) {
  root.dataset.theme = theme;
  const isNight = theme === "night";
  button.textContent = isNight ? "切换至日间" : "切换至夜间";
  button.setAttribute("aria-pressed", String(isNight));
  writeStorage(storage, "typhoon-demo-theme", theme);
}

export function setLevel({ level, cards, activeLabel, heroWarning, context = "演示" }) {
  const label = levelLabels[level];
  if (!label) return;
  cards.forEach((card) => card.classList.toggle("active", card.dataset.level === level));
  activeLabel.textContent = label;
  heroWarning.textContent = `${label} · ${context}`;
}

function elementsFromDocument(documentRoot) {
  const byId = (id) => documentRoot.getElementById(id);
  return {
    badge: byId("source-mode-badge"), noticeTitle: byId("data-notice-title"), noticeText: byId("data-notice-text"),
    stormName: byId("storm-name"), stormLead: byId("storm-lead"), warning: byId("hero-warning"),
    updatedAt: byId("updated-at"), source: byId("source-line"), pressure: byId("pressure-value"),
    position: byId("position-value"), positionDetail: byId("position-detail"), wind: byId("wind-value"),
    windDetail: byId("wind-detail"), movement: byId("movement-value"), movementDetail: byId("movement-detail"),
    distance: byId("distance-value"), distanceDetail: byId("distance-detail"), route: byId("route-svg"),
    routeSideTitle: byId("route-side-title"), routeSideLead: byId("route-side-lead"), routeList: byId("route-list"),
  };
}

async function loadDataset() {
  try {
    const response = await fetch("./data/current.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const dataset = await response.json();
    if (!isSupportedDataset(dataset)) throw new Error("数据格式不受支持");
    return dataset;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return createDemoFallback({ retrievedAt: new Date().toISOString(), reason: `页面加载实时数据失败：${detail}` });
  }
}

async function initialisePage() {
  const root = document.documentElement;
  const themeToggle = document.getElementById("theme-toggle");
  const selectedLevel = document.getElementById("alert-select");
  const activeAlertLabel = document.getElementById("active-alert-label");
  const heroWarning = document.getElementById("hero-warning");
  const cards = [...document.querySelectorAll(".alert-card")];
  const storage = window.localStorage;
  const storedTheme = readStorage(storage, "typhoon-demo-theme");
  if (storedTheme === "night" || storedTheme === "day") setTheme({ root, button: themeToggle, storage, theme: storedTheme });
  themeToggle.addEventListener("click", () => setTheme({ root, button: themeToggle, storage, theme: root.dataset.theme === "night" ? "day" : "night" }));

  const dataset = await loadDataset();
  applyDataset({ dataset, elements: elementsFromDocument(document), root });
  const checklistContext = dataset.mode === "live" ? "居民自检清单" : "演示数据";
  setLevel({ level: selectedLevel.value, cards, activeLabel: activeAlertLabel, heroWarning, context: checklistContext });
  selectedLevel.addEventListener("change", (event) => setLevel({ level: event.target.value, cards, activeLabel: activeAlertLabel, heroWarning, context: checklistContext }));
}

if (typeof document !== "undefined") initialisePage();
