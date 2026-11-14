/**
 * 测试辅助：用 jsdom 启动真实页面
 * 加载 index.html → 依次执行数据脚本与 app.js，返回常用查询/驾驶方法。
 */
const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");

const ROOT = path.join(__dirname, "..", "..");
const JS_DIR = path.join(ROOT, "assets", "js");
const FILES = ["data-pian", "data-fulltext", "data-zhang-1", "data-zhang-2", "data-knowledge", "app"];

module.exports = function boot() {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", function (e) { errors.push("jsdomError: " + e.message); });
  vc.on("error", function () { errors.push("console.error: " + Array.prototype.join.call(arguments, " ")); });

  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const dom = new JSDOM(html, {
    url: "http://127.0.0.1:8123/",
    runScripts: "dangerously",
    pretendToBeVisual: true,
    virtualConsole: vc
  });
  const win = dom.window;
  const doc = win.document;

  win.scrollTo = function () {};
  win.HTMLElement.prototype.scrollIntoView = function () {};
  win.localStorage.clear();

  FILES.forEach(function (f) {
    win.eval(fs.readFileSync(path.join(JS_DIR, f + ".js"), "utf8"));
  });

  const $ = function (sel) { return doc.querySelector(sel); };
  const $$ = function (sel) { return Array.prototype.slice.call(doc.querySelectorAll(sel)); };
  const text = function (sel) {
    const el = $(sel);
    return el ? el.textContent.replace(/\s+/g, " ").trim() : "";
  };
  const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  const go = async function (hash) {
    win.location.hash = hash;
    win.dispatchEvent(new win.HashChangeEvent("hashchange"));
    await sleep(30);
  };

  return { dom, win, doc, $, $$, text, sleep, go, errors };
};
