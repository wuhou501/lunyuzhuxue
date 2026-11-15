/**
 * 论语助学 · 集成测试
 * 运行：node tests/integration.test.js（需先在 tests/ 下执行 npm install）
 * 方式：用 jsdom 载入真实 index.html，再按页面顺序执行数据脚本与 app.js，
 *       通过真实 DOM 事件驱动路由、检索、问答、学习记录，验证模块之间的协作。
 */
const boot = require("./helpers/boot");

let pass = 0;
const failures = [];
async function test(name, fn) {
  try {
    await fn();
    pass++;
    console.log("  \u2713 " + name);
  } catch (err) {
    failures.push({ name, message: err.message });
    console.log("  \u2717 " + name + "\n      " + err.message);
  }
}
function group(name) {
  console.log("\n" + name);
}
function eq(actual, expected, label) {
  if (actual !== expected) throw new Error((label || "") + " 期望 " + expected + "，实际 " + actual);
}
function ok(cond, message) {
  if (!cond) throw new Error(message || "断言失败");
}

/* ---------------- 启动页面 ---------------- */
const env = boot();
const win = env.win;
const $ = env.$;
const $$ = env.$$;
const text = env.text;
const sleep = env.sleep;
const go = env.go;
const jsdomErrors = env.errors;

async function click(el) {
  ok(el, "待点击元素不存在");
  el.click();
  await sleep(20);
}

/* ---------------- 1. 首屏渲染 ---------------- */
(async function run() {
  group("1. 首屏渲染");
  await go("#/home");
  await test("侧栏与底部导航已生成（5 项）", () => {
    eq($$("#sideNav a").length, 5);
    eq($$("#tabbar a").length, 5);
  });
  await test("首页主标题与统计正确", () => {
    ok(text("#view h1").indexOf("一部可以问") >= 0, "标题：" + text("#view h1"));
    const stats = text(".hero-stats");
    ok(stats.indexOf("512") >= 0, "统计缺 512：" + stats);
    ok(stats.indexOf("131") >= 0, "统计缺 131：" + stats);
  });
  await test("今日一章有原文与出处", () => {
    ok($(".daily"), "缺今日一章卡片");
    ok($(".daily-text").textContent.length > 5, "原文为空");
    ok($(".daily-ref").textContent.indexOf("第") >= 0, "缺出处编号：" + $(".daily-ref").textContent);
  });

  /* ---------------- 2. 篇目与全本 ---------------- */
  group("2. 篇目与全本阅读");
  await go("#/pian");
  await test("篇目页渲染 20 张卡片", () => {
    eq($$(".pian-card").length, 20);
  });
  await go("#/pian/1");
  await test("学而篇列出全本 16 章，且区分精讲/原文", () => {
    eq($$(".chapter-row").length, 16);
    ok(text("#view").indexOf("全本 16 章 · 精讲 9 章") >= 0, "头部统计：" + text(".section-more"));
    const r3 = $('.chapter-row[data-goto="1.3"]');
    ok(r3 && r3.textContent.indexOf("原文") >= 0, "1.3 应标为原文");
    const r1 = $('.chapter-row[data-goto="1.1"]');
    ok(r1 && r1.textContent.indexOf("精讲") >= 0, "1.1 应标为精讲");
  });
  await go("#/zhang/1.3");
  await test("未精讲章可阅读，并提供前后章导航", () => {
    ok(text("#view").indexOf("暂未精讲") >= 0, "缺暂未精讲标记");
    ok($(".quote-text").textContent.indexOf("巧言令色") >= 0, "原文不对");
    const nav = $$(".znav a").map(function (a) { return a.getAttribute("href"); });
    ok(nav.join(",").indexOf("#/zhang/1.2") >= 0 && nav.join(",").indexOf("#/zhang/1.4") >= 0, "导航：" + nav.join(","));
  });

  /* ---------------- 3. 章句详情与学习记录 ---------------- */
  group("3. 章句详情与学习记录");
  await go("#/zhang/1.1");
  await test("展示原文、译文、字词注释与要点", () => {
    ok($(".quote-text").textContent.indexOf("学而时习之") >= 0, "原文缺失");
    ok(text("#view").indexOf("白话译文") >= 0, "缺译文区块");
    ok($$(".note-item").length >= 2, "注释过少");
    ok(text("#view").indexOf("思想要点") >= 0, "缺要点区块");
  });
  await test("点击“标记已学”后按钮变已学并写入 localStorage", async () => {
    const btn = $('[data-learn="1.1"]');
    ok(btn && btn.textContent.indexOf("标记已学") >= 0, "初始按钮状态异常");
    btn.click();
    await sleep(20);
    const after = $('[data-learn="1.1"]');
    ok(after.classList.contains("on"), "按钮未进入选中态");
    ok(after.textContent.indexOf("标记已学") < 0, "按钮文案未切换：" + after.textContent);
    const saved = JSON.parse(win.localStorage.getItem("zhuxue.lunyu.v1"));
    ok(saved.learned && saved.learned["1.1"], "未写入学习记录");
  });
  await test("点击“收藏”后按钮变已收藏并写入 localStorage", async () => {
    const btn = $('[data-fav="1.1"]');
    ok(btn, "缺收藏按钮");
    btn.click();
    await sleep(20);
    const after = $('[data-fav="1.1"]');
    ok(after.classList.contains("on"), "收藏未进入选中态");
    ok(after.textContent.indexOf("已收藏") >= 0, "按钮文案未切换：" + after.textContent);
    const saved = JSON.parse(win.localStorage.getItem("zhuxue.lunyu.v1"));
    ok(saved.fav && saved.fav["1.1"], "未写入收藏");
  });

  /* ---------------- 4. 注释定位 ---------------- */
  group("4. 注释定位");
  await test("点击注释词在原文中高亮，再点取消", async () => {
    const item = $(".note-item");
    const word = item.getAttribute("data-w");
    ok(word, "注释项缺 data-w");
    item.click();
    await sleep(20);
    const mark = $(".quote-text mark.hl");
    ok(mark, "未生成高亮");
    eq(mark.textContent, word, "高亮词");
    item.click();
    await sleep(20);
    ok(!$(".quote-text mark.hl"), "再次点击未取消高亮");
  });

  /* ---------------- 5. 检索 ---------------- */
  group("5. 检索");
  await go("#/search?q=" + encodeURIComponent("孝"));
  await test("搜索“孝”返回结果并显示精讲/原文构成", () => {
    ok($$(".result").length > 10, "结果过少：" + $$(".result").length);
    ok(/共 \d+ 条 · 精讲 \d+ · 原文 \d+/.test(text(".search-meta")), "统计：" + text(".search-meta"));
  });
  await test("篇目下拉筛选后仅显示为政篇", async () => {
    const sel = $("#pianSel");
    sel.value = "2";
    sel.dispatchEvent(new win.Event("change", { bubbles: true }));
    await sleep(30);
    const refs = $$(".result-ref").map(function (e) { return e.textContent; });
    ok(refs.length > 0, "筛选后无结果");
    refs.forEach(function (r) { ok(r.indexOf("为政") >= 0, "混入他篇：" + r); });
  });
  await test("“仅看精讲”后结果不含未精讲章", async () => {
    const before = $$(".result").length;
    $("#onlyBtn").click();
    await sleep(30);
    const after = $$(".result").length;
    ok(after > 0 && after <= before, "结果数异常：" + after);
    ok(text("#results").indexOf("仅原文") < 0, "仍出现仅原文条目");
  });
  await test("点击热词后写入搜索历史", async () => {
    const chip = $('#chips [data-chip="仁"]');
    await click(chip);
    ok($$("#histRow [data-hist]").length >= 1, "历史未记录");
  });

  /* ---------------- 6. 问答（单字概念修复的集成验证） ---------------- */
  group("6. 问答");
  await go("#/ask");
  async function ask(q) {
    const input = $("#askInput");
    input.value = q;
    $("#askSend").click();
    await sleep(1100);
    const msgs = $$(".msg.ai");
    return msgs[msgs.length - 1];
  }
  await test("无关问题走兜底：不给出处", async () => {
    const ai = await ask("量子力学的基本假设是什么");
    ok(ai.textContent.indexOf("暂时没有直接匹配") >= 0, "未走兜底：" + ai.textContent.slice(0, 60));
    eq(ai.querySelectorAll(".ai-src").length, 0);
  });
  await test("“如何学习”仍能识别为「学」并附出处", async () => {
    const ai = await ask("如何学习");
    ok(ai.textContent.indexOf("关于「学」") >= 0, "未识别为学：" + ai.textContent.slice(0, 40));
    ok(ai.querySelectorAll(".ai-src").length > 0, "缺原文出处");
  });
  await test("“什么是仁”给出 12.1 / 12.2 等出处", async () => {
    const ai = await ask("什么是仁");
    const refs = Array.prototype.map.call(ai.querySelectorAll(".ai-src .ref"), function (e) { return e.textContent; });
    ok(refs.join(",").indexOf("12.1") >= 0, "缺 12.1：" + refs.join(","));
    ok(refs.join(",").indexOf("12.2") >= 0, "缺 12.2：" + refs.join(","));
  });

  /* ---------------- 7. 学习进度 ---------------- */
  group("7. 学习进度");
  await go("#/progress");
  await test("统计已汇总", () => {
    const t = text("#view");
    ok(t.indexOf("精讲已学") >= 0 && t.indexOf("连续学习") >= 0, "统计项缺失");
    ok($("#exportData"), "缺导出按钮");
  });
  await test("已学章句计入侧栏统计", () => {
    ok(text("#sideStat").indexOf("已学 1") >= 0, "侧栏：" + text("#sideStat"));
  });

  /* ---------------- 8. 关于页 ---------------- */
  group("8. 内容标准");
  await go("#/about");
  await test("关于页披露全本 512 与精讲 131 的范围", () => {
    const t = text("#view");
    ok(t.indexOf("512") >= 0, "缺全本章数");
    ok(t.indexOf("131") >= 0, "缺精讲章数");
    ok(t.indexOf("自撰") >= 0 || t.indexOf("版权") >= 0, "缺内容标准说明");
  });

  /* ---------------- 9. 运行期错误 ---------------- */
  group("9. 运行期错误");
  await test("整个流程无 jsdom / console 错误", () => {
    eq(jsdomErrors.length, 0, "错误：" + jsdomErrors.join(" | "));
  });

  console.log("\n----------------------------------------");
  console.log("通过 " + pass + " 项，失败 " + failures.length + " 项");
  env.dom.window.close();
  if (failures.length) {
    failures.forEach(function (f) { console.log("  \u2717 " + f.name + "：" + f.message); });
    process.exit(1);
  }
  console.log("全部集成测试通过");
})();
