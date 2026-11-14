/**
 * 论语助学 · 核心模块单元测试
 * 运行：node tests/core.test.js
 * 零依赖：在 Node 的 vm 沙箱中加载数据与 app.js（无 document，因而不会启动页面渲染）。
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const jsDir = path.join(__dirname, "..", "assets", "js");
const sandbox = {
  window: {},
  console,
  performance,
  setTimeout,
  clearTimeout,
  encodeURIComponent,
  decodeURIComponent
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

["data-pian", "data-fulltext", "data-zhang-1", "data-zhang-2", "data-knowledge", "app"].forEach((f) => {
  vm.runInContext(fs.readFileSync(path.join(jsDir, f + ".js"), "utf8"), sandbox, { filename: f + ".js" });
});

const LX = sandbox.window.LX;
if (!LX) {
  console.error("无法加载测试入口 window.LX，请检查 app.js 是否暴露了测试接口");
  process.exit(1);
}

let pass = 0;
const failures = [];
function test(name, fn) {
  try {
    fn();
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
function hasAll(arr, expected) {
  expected.forEach((x) => ok(arr.indexOf(x) >= 0, "缺少 " + x + "，实际为 " + JSON.stringify(arr)));
}

/* ================= 1. 全本原文数据 ================= */
group("1. 全本原文数据");
test("二十篇齐全，篇号连续", () => {
  eq(LX.PIAN.length, 20);
  LX.PIAN.forEach((p, i) => eq(p.id, i + 1, "篇号"));
});
test("全本章句共 512 章，且与各篇声明章数一致", () => {
  eq(LX.FULL_TOTAL, 512);
  LX.PIAN.forEach((p) => {
    const n = (LX.FULLTEXT[p.id] || []).length;
    eq(n, p.chapters, "第 " + p.id + " 篇章数");
  });
});
test("每章原文非空且不含 HTML 标签", () => {
  LX.PIAN.forEach((p) => {
    (LX.FULLTEXT[p.id] || []).forEach((t, i) => {
      ok(typeof t === "string" && t.trim().length > 0, "第 " + p.id + "." + (i + 1) + " 章为空");
      ok(t.indexOf("<") < 0 && t.indexOf(">") < 0, "第 " + p.id + "." + (i + 1) + " 章含 HTML");
    });
  });
});

/* ================= 2. 精讲章节与全本对齐 ================= */
group("2. 精讲章节与全本对齐");
test("精讲共 131 章且 id 唯一", () => {
  eq(LX.TOTAL, 131);
  eq(LX.ZHANG.length, 131);
  const seen = {};
  LX.ZHANG.forEach((z) => {
    ok(!seen[z.id], "重复 id " + z.id);
    seen[z.id] = true;
  });
});
test("精讲 id 与 p.n 一致，且落在本篇章数范围内", () => {
  LX.ZHANG.forEach((z) => {
    eq(z.id, z.p + "." + z.n, "id 格式");
    const len = (LX.FULLTEXT[z.p] || []).length;
    ok(z.n >= 1 && z.n <= len, z.id + " 超出本篇章数 " + len);
  });
});
test("精讲原文与全本同章文字重合度不低于 75%（防止章号错位）", () => {
  const norm = (s) => s.replace(/[^\u4e00-\u9fa5]/g, "");
  LX.ZHANG.forEach((z) => {
    const real = (LX.FULLTEXT[z.p] || [])[z.n - 1] || "";
    const A = new Set(norm(z.t));
    const B = new Set(norm(real));
    let hit = 0;
    A.forEach((ch) => { if (B.has(ch)) hit++; });
    const ratio = hit / Math.max(1, A.size);
    ok(ratio >= 0.75, z.id + " 重合度仅 " + (ratio * 100).toFixed(0) + "%");
  });
});
test("精讲字段完整（译文/注释/要点/标签）", () => {
  LX.ZHANG.forEach((z) => {
    ok(z.tr && z.tr.length > 5, z.id + " 缺译文");
    ok(Array.isArray(z.notes) && z.notes.length > 0, z.id + " 缺注释");
    ok(z.idea && z.idea.length > 5, z.id + " 缺要点");
    ok(Array.isArray(z.tags) && z.tags.length > 0, z.id + " 缺标签");
  });
});

/* ================= 3. 检索模块 ================= */
group("3. 检索模块");
test("分词会剔除“孔子/什么/意思”等停用词", () => {
  const terms = LX.tokenize("孔子说的“仁”到底是什么意思？");
  ok(terms.indexOf("孔子") < 0, "未剔除 孔子");
  ok(terms.indexOf("什么") < 0, "未剔除 什么");
  ok(terms.indexOf("意思") < 0, "未剔除 意思");
  ok(terms.indexOf("仁") >= 0, "丢失关键词 仁");
});
test("空查询返回空结果", () => {
  eq(LX.searchChapters("").list.length, 0);
  eq(LX.searchChapters("   ").list.length, 0);
});
test("检索“孝”有结果，且前三条与主题相关", () => {
  const res = LX.searchChapters("孝");
  ok(res.list.length > 10, "结果过少：" + res.list.length);
  res.list.slice(0, 3).forEach((it) => {
    const blob = it.z.t + it.z.tr + (it.z.tags || []).join("");
    ok(blob.indexOf("孝") >= 0, it.z.id + " 与“孝”无关");
  });
});
test("支持按篇筛选", () => {
  const res = LX.searchChapters("孝", { pian: 2 });
  ok(res.list.length > 0, "筛选后无结果");
  res.list.forEach((it) => eq(it.z.p, 2, it.z.id + " 不属于为政篇"));
});
test("支持“仅看精讲”筛选", () => {
  const res = LX.searchChapters("孝", { onlyZhujiang: true });
  ok(res.list.length > 0);
  res.list.forEach((it) => ok(!it.full, it.z.id + " 为未精讲章"));
});
test("支持按篇序排序", () => {
  const res = LX.searchChapters("仁", { sort: "pian" });
  ok(res.list.length > 1);
  for (let i = 1; i < res.list.length; i++) {
    const prev = res.list[i - 1].z;
    const cur = res.list[i].z;
    ok(prev.p < cur.p || (prev.p === cur.p && prev.n <= cur.n), "篇序错误：" + prev.id + " 在 " + cur.id + " 之前");
  }
});
test("检索可命中未精讲的全本原文", () => {
  const res = LX.searchChapters("厩焚");
  ok(res.list.length > 0, "未命中");
  ok(res.list.some((it) => it.z.id === "10.17"), "应命中 10.17，实际：" + res.list.map((x) => x.z.id).join(","));
});

/* ================= 4. 问答引擎 ================= */
group("4. 问答引擎");
test("概念类：什么是仁", () => {
  const a = LX.answerQuestion("什么是仁");
  ok(a.title.indexOf("仁") >= 0, "标题不含仁：" + a.title);
  hasAll(a.ids, ["12.1", "12.2"]);
  ok(a.lead.length > 10 && a.body.length > 20, "答案过短");
});
test("概念类：如何学习（单字概念不能被词界规则误伤）", () => {
  const a = LX.answerQuestion("如何学习");
  ok(a.title.indexOf("学") >= 0, "标题：" + a.title);
});
test("人物类：颜回", () => {
  const a = LX.answerQuestion("颜回是个怎样的人");
  ok(a.title.indexOf("颜回") >= 0, "标题：" + a.title);
  ok(a.ids.length > 0, "缺少相关章句");
});
test("篇旨类：学而篇讲什么", () => {
  const a = LX.answerQuestion("学而篇主要讲了什么");
  ok(a.title.indexOf("学而第一") >= 0, "标题：" + a.title);
  ok(a.body.indexOf("核心命题") >= 0, "缺少核心命题");
  ok(a.ids.length > 0, "缺少开篇章节");
});
test("出处类：己所不欲，勿施于人的出处", () => {
  const a = LX.answerQuestion("“己所不欲，勿施于人”出自哪一章");
  hasAll(a.ids, ["12.2"]);
  ok(a.title.indexOf("颜渊") >= 0, "标题应含篇名：" + a.title);
});
test("对比类：君子与小人", () => {
  const a = LX.answerQuestion("君子和小人有什么区别");
  ok(a.body.indexOf("求诸己") >= 0, "缺“求诸己”");
  ok(a.body.indexOf("和而不同") >= 0, "缺“和而不同”");
});
test("短语类：乡原（应定位到 17.13）", () => {
  const a = LX.answerQuestion("乡原");
  hasAll(a.ids, ["17.13"]);
});
test("兜底类：无关问题不虚构出处", () => {
  const a = LX.answerQuestion("量子力学的基本假设是什么");
  eq(a.ids.length, 0);
  ok(a.title.indexOf("暂时没有直接匹配") >= 0, "标题：" + a.title);
});
test("所有答案结构完整（标题/导语/正文）", () => {
  ["什么是礼", "子路是谁", "为政篇讲了什么", "“过犹不及”什么意思", "学与思的区别", "颜回与子贡"].forEach((q) => {
    const a = LX.answerQuestion(q);
    ok(typeof a.title === "string" && a.title.length > 0, q + " 缺标题");
    ok(typeof a.lead === "string" && a.lead.length > 0, q + " 缺导语");
    ok(typeof a.body === "string" && a.body.length > 0, q + " 缺正文");
  });
});

/* ================= 5. 学习进度计数 ================= */
group("5. 学习进度计数");
test("初始已学数为 0", () => {
  eq(LX.learnedCount(), 0);
  eq(LX.learnedCount(1), 0);
});
test("标记精讲章后总数与分篇数同步 +1", () => {
  LX.store.learned["1.1"] = Date.now();
  eq(LX.learnedCount(), 1);
  eq(LX.learnedCount(1), 1);
  delete LX.store.learned["1.1"];
});
test("未精讲章不计入精讲完成度", () => {
  LX.store.learned["1.3"] = Date.now();
  eq(LX.learnedCount(), 0);
  delete LX.store.learned["1.3"];
});

/* ================= 汇总 ================= */
console.log("\n----------------------------------------");
console.log("通过 " + pass + " 项，失败 " + failures.length + " 项");
if (failures.length) {
  failures.forEach((f) => console.log("  \u2717 " + f.name + "：" + f.message));
  process.exit(1);
}
console.log("全部测试通过");
