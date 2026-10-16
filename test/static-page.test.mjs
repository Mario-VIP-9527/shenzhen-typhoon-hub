import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pagePath = path.join(projectRoot, "dist", "index.html");

test("static page exposes the required typhoon dashboard sections", () => {
  assert.equal(existsSync(pagePath), true, "dist/index.html must be present");

  const html = readFileSync(pagePath, "utf8");
  for (const expectedText of [
    "试验 · 演示数据",
    "台风实况",
    "路径示意",
    "蓝色预警",
    "黄色预警",
    "橙色预警",
    "红色预警",
    "theme-toggle",
  ]) {
    assert.match(html, new RegExp(expectedText));
  }
});
