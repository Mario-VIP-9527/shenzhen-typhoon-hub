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

test("phone layout protects safe areas and keeps primary controls comfortably tappable", () => {
  const html = readFileSync(pagePath, "utf8");

  assert.match(html, /viewport-fit=cover/, "the viewport must include phone safe areas");
  assert.match(html, /safe-area-inset-top/, "the header must respect a phone safe area");
  assert.match(html, /\.theme-toggle, \.alert-select\s*\{\s*min-height: 44px;/, "phone controls need a 44px tap target");
  assert.match(html, /\.data-value\s*\{[^}]*overflow-wrap: anywhere;/s, "long live values must not force horizontal scrolling");
});
