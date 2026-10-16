# 深圳台风一屏信息站

面向深圳沿海居民的一页式台风信息页：名称、位置、强度、移动方向、路径示意和居民自检清单都放在同一屏内。发布地址预期为：

<https://mario-vip-9527.github.io/shenzhen-typhoon-hub/>

## 数据与安全边界

- 实况数据使用[深圳台风网](https://tf.121.com.cn/)公开接口；该站由深圳市气象局主办。
- GitHub Actions 每 15 分钟尝试生成一次数据。GitHub 的计划任务可能延迟，因此页面显示的是“生成时间”，不是刷新承诺。
- 页面有三种明确状态：
  - `live`：显示“实时数据 · 深圳台风网”，且只呈现官方接口给出的中心位置、风速、气压、公告摘要与路径点；
  - `no-active-storm`：数据源没有活动台风，不显示虚构台风或旧路径；
  - `demo-fallback`：请求、解析或页面加载失败时显示“试验 · 演示数据”，不会把演示数值标成实况。
- 深圳距离为中心点到固定深圳坐标的直线估算，不代表登陆概率、影响范围或风险等级。
- 蓝、黄、橙、红卡片是居民自检清单，不是实时预警或政府指令。任何正式预警、停课停工、撤离或避险指令以[深圳市气象局](https://weather.sz.gov.cn/)及应急部门发布为准。

## 本地验证

使用 Node.js 22 或更高版本：

```powershell
npm.cmd test
node scripts/fetch-typhoon-data.mjs --output .tmp/current.json
```

第二条命令会请求官方公开接口，并把规范化 JSON 写到临时文件。输出只可能是 `live`、`no-active-storm` 或 `demo-fallback` 之一。检查完成后删除该临时文件即可。

直接打开 `dist/index.html` 可查看安全的本地演示状态。浏览器从 `file://` 加载时可能无法请求 JSON，页面会明确回退为演示状态；这不是部署后的实时结果。

## 自动部署

`.github/workflows/deploy-pages.yml` 支持手动触发和 `*/15 * * * *` 的计划任务。它会：

1. 在临时构建空间请求并校验官方数据；
2. 写入 `dist/data/current.json`；
3. 把整个 `dist` 目录作为 GitHub Pages artifact 发布。

工作流不会每 15 分钟向仓库提交数据。首次发布后，在仓库 **Settings → Pages** 中确认 **Build and deployment** 的来源为 **GitHub Actions**；也可以在 **Actions → Deploy Shenzhen Typhoon Pages** 里执行 **Run workflow** 触发首次部署。

## 主要文件

- `dist/index.html`：单页界面、昼夜主题、四级勾选清单与可访问语义。
- `dist/app.js`：读取 JSON、区分三种状态、渲染事实卡与路径。
- `dist/data-model.js`：官方字段的纯转换、演示降级和数据契约校验。
- `scripts/fetch-typhoon-data.mjs`：无第三方依赖的官方数据抓取器。
- `dist/data/current.json`：本地安全演示样本；部署时由工作流生成内容替换。
- `test/*.test.mjs`：数据转换、抓取失败、页面状态和现有交互的行为测试。
