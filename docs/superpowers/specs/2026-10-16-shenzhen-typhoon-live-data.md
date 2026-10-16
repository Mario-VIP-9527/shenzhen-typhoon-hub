# 深圳台风一屏信息站：实时数据与 GitHub Pages 规格

## 目标

将现有静态演示页发布为 GitHub Pages 站点。每 15 分钟由 GitHub Actions 请求深圳台风网公开接口，生成适合浏览器消费的单个 JSON 文件并重新部署；任何关键请求、解析或校验失败时，站点必须回落至清晰标识的演示数据。

## 范围与数据边界

- 首选实况来源为深圳台风网 `https://tf.121.com.cn/weather/typhoonWeb/CheckCurrentTyphoon.txt`，该站由深圳市气象局主办。
- 当前台风点从 `typhoons` 与 `maximpact` 中选择；公告摘要从 `typhoonBabj/tcno_{TCNO}.txt` 获取；能构造时，使用 `tyForecast/GetTyphoonForecast_{TCIDX}_{YYYYMMDDHHmm}.txt` 的 `BABJ` 路径作为预报点。
- 页面只呈现来源已提供的中心位置、风速、气压、移动信息、公告摘要及路径。深圳距离由中心位置与固定深圳坐标（22.5431, 114.0579）按 haversine 公式估算，并标为估算值。
- 四级行动清单是常备居民自检清单，不是实时预警或政府指令。实时数据不自动选择或声称任何预警级别。
- “没有活动台风”不是抓取失败：页面显示该状态，不借机伪造风暴。

## 发布行为

- 工作流必须在 `workflow_dispatch` 和 `*/15 * * * *` 下运行。GitHub 的计划任务可能延迟，页面须显示本次生成时间，不能承诺精确到分钟。
- 工作流不向仓库提交 15 分钟一条的数据提交；它在构建工作区写入 `dist/data/current.json`，随后把整个 `dist` 作为 Pages artifact 部署。
- 工作流只使用 Node 22 的内置 `fetch` 与标准库，不引入 npm 运行时依赖。
- 需要 `pages: write`、`id-token: write`、`contents: read` 权限，并用部署并发组避免部署交叠。

## 数据契约

`dist/data/current.json` 的顶层结构为：

```json
{
  "schemaVersion": 1,
  "mode": "live | no-active-storm | demo-fallback",
  "retrievedAt": "ISO-8601 UTC",
  "source": { "name": "深圳台风网", "url": "https://tf.121.com.cn/" },
  "reason": "仅在 no-active-storm 或 demo-fallback 时存在",
  "storm": {
    "id": "string",
    "name": "string",
    "englishName": "string",
    "latitude": 0,
    "longitude": 0,
    "windMps": 0,
    "pressureHpa": 0,
    "movementDirection": "string",
    "movementSpeedKmh": 0,
    "sourceIssuedAt": "ISO-8601 UTC",
    "location": "string",
    "conclusion": "string"
  },
  "track": [{ "at": "ISO-8601 UTC", "latitude": 0, "longitude": 0, "kind": "observed" }],
  "forecast": [{ "at": "ISO-8601 UTC", "latitude": 0, "longitude": 0, "kind": "forecast", "agency": "BABJ" }],
  "calculated": { "shenzhenDistanceKm": 0 }
}
```

`storm`、`track`、`forecast` 只在 `live` 模式存在。`demo-fallback` 必须包含非实时演示风暴字段；`no-active-storm` 不能包含虚假的风暴字段。

## 页面状态与安全文案

| 数据模式 | 徽标与说明 | 禁止的表述 |
| --- | --- | --- |
| `live` | “实时数据 · 深圳台风网”，附数据生成时间和官方链接 | 将行动清单说成当前官方命令 |
| `no-active-storm` | “当前无活动台风”，附数据生成时间和官方链接 | 显示虚构台风、假路径或预警级别 |
| `demo-fallback` | “试验 · 演示数据”，说明实时数据暂不可用 | 用演示数字伪装实况 |

加载失败、无 JSON 或不支持的 schema 也必须呈现 `demo-fallback`；不能保留误导性的旧实时文案。所有外链保留 `rel="noreferrer"`。

## 验收标准

1. 单元测试覆盖官方时间解析、合法实况转换、无活动台风、失败降级、以及三种页面展示状态。
2. 静态页面保留实况面板、路径示意、四级勾选行动清单和昼夜主题，并提供可由脚本更新的语义化元素。
3. 工作流含 15 分钟 schedule、手动触发、数据生成、Pages artifact 与部署步骤；无 15 分钟的仓库写回。
4. README 写明官方来源、数据延迟/失败边界、本地测试方式、手动部署方式和最终 Pages URL 格式。
5. 发布前本地 `npm.cmd test` 通过；远端 Actions 完成后检查 Pages workflow 的成功状态与实际 URL。
