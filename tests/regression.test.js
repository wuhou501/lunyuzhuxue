/**
 * 论语助学 · 回归测试
 * 每个用例对应一个已修复缺陷，编号 REG-xx，防止同类问题再次出现。
 * 运行：node tests/regression.test.js
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

const env = boot();
const win = env.win;
const $ = env.$;
const $$ = env.$$;
const text = env.text;
const sleep = env.sleep;
const go = env.go;

function metaCounts() {
  const t = text(".search-meta");
  const m = t.match(/共 (\d+) 条 · 精讲 (\d+) · 原文 (\d+)/);
  if (!m) throw new Error("无法解析检索统计：" + t);
  return { total: +m[1], jj: +m[2], yw: +m[3] };
}
function onlySourceBadges() {
  return $$(".result").filter(function (r) { return r.textContent.indexOf("仅原文") >= 0; }).length;
}

(async function run() {
  /* ------------------------------------------------------------------
   * 缺陷：viewSearch 内部状态为 state.only，而 searchChapters 读取
   * opts.onlyZhujiang，导致“仅看精讲”点击后无任何过滤效果。
   * ------------------------------------------------------------------ */
  group("REG-01 “仅看精讲”应真正过滤结果");
  await go("#/search?q=" + encodeURIComponent("孝"));
  const before = metaCounts();

  await test("前置：默认结果同时包含精讲与原文", () => {
    ok(before.jj > 0, "精讲条数为 0");
    ok(before.yw > 0, "原文条数为 0");
    eq(before.total, before.jj + before.yw, "总数不等于两者之和");
  });

  await test("点击后原文条数归零，总数等于原精讲数", async () => {
    $("#onlyBtn").click();
    await sleep(30);
    const after = metaCounts();
    eq(after.yw, 0, "原文条数");
    eq(after.total, before.jj, "总条数");
    eq(onlySourceBadges(), 0, "仍渲染“仅原文”徽标");
  });

  await test("按钮选中态与筛选状态一致", () => {
    const btn = $("#onlyBtn");
    ok(btn.classList.contains("on"), "缺少 on 选中态");
    ok(btn.textContent.indexOf("✓") >= 0, "文案未标对勾：" + btn.textContent);
  });

  await test("再次点击恢复全部结果并清除选中态", async () => {
    $("#onlyBtn").click();
    await sleep(30);
    const back = metaCounts();
    eq(back.total, before.total, "恢复总条数");
    eq(back.yw, before.yw, "恢复原文条数");
    ok(!$("#onlyBtn").classList.contains("on"), "选中态未清除");
  });

  group("REG-02 “仅看精讲”与篇目筛选组合生效");
  await go("#/search?q=" + encodeURIComponent("孝"));
  await test("篇内精讲筛选结果不为空且条数吻合", async () => {
    const sel = $("#pianSel");
    sel.value = "2";
    sel.dispatchEvent(new win.Event("change", { bubbles: true }));
    await sleep(30);
    const inPian = metaCounts();
    ok(inPian.jj > 0 && inPian.yw > 0, "为政篇内应同时有两种结果");

    $("#onlyBtn").click();
    await sleep(30);
    const both = metaCounts();
    eq(both.yw, 0, "组合后仍有原文");
    eq(both.total, inPian.jj, "组合后条数应等于篇内精讲数");
    $$(".result-ref").forEach(function (e) {
      ok(e.textContent.indexOf("为政") >= 0, "混入他篇：" + e.textContent);
    });
  });

  /* ------------------------------------------------------------------
   * 同类风险：同一工具条上的排序/筛选按钮，接线错误同样会被静默吞掉。
   * ------------------------------------------------------------------ */
  group("REG-03 排序按钮切换真实生效");
  await go("#/search?q=" + encodeURIComponent("孝"));
  await test("切到篇序后首条来自学而，切回后统计区同步", async () => {
    $("#sortBtn").click();
    await sleep(30);
    ok(text(".search-meta").indexOf("按篇序") >= 0, "统计区未显示按篇序");
    const first = $$(".result-ref")[0].textContent;
    ok(first.indexOf("学而") >= 0, "首条不是学而：" + first);

    $("#sortBtn").click();
    await sleep(30);
    ok(text(".search-meta").indexOf("按相关度") >= 0, "未切回相关度");
  });

  /* ------------------------------------------------------------------
   * 缺陷：单字概念用 indexOf 直接匹配，“量子力学”命中“学”概念。
   * ------------------------------------------------------------------ */
  group("REG-04 单字概念不误命中");
  await go("#/ask");
  async function ask(q) {
    $("#askInput").value = q;
    $("#askSend").click();
    await sleep(1100);
    const msgs = $$(".msg.ai");
    return msgs[msgs.length - 1];
  }

  await test("“量子力学的基本假设是什么”走兜底且无出处", async () => {
    const ai = await ask("量子力学的基本假设是什么");
    ok(ai.textContent.indexOf("暂时没有直接匹配") >= 0, "未走兜底：" + ai.textContent.slice(0, 50));
    eq(ai.querySelectorAll(".ai-src").length, 0, "不应给出处");
  });

  await test("“如何学习”仍识别为「学」并附出处", async () => {
    const ai = await ask("如何学习");
    ok(ai.textContent.indexOf("关于「学」") >= 0, "未识别为学：" + ai.textContent.slice(0, 40));
    ok(ai.querySelectorAll(".ai-src").length > 0, "缺出处");
  });

  /* ------------------------------------------------------------------
   * 边界：空查询、零结果、筛选状态在篇目/排序切换中的保持
   * ------------------------------------------------------------------ */
  group("REG-05 检索工具条边界");
  await go("#/search");
  await test("空查询下点击“仅看精讲”不崩溃，保持空态提示", async () => {
    $("#onlyBtn").click();
    await sleep(20);
    ok(text("#results").indexOf("输入关键词") >= 0, "空态文案丢失：" + text("#results"));
    ok($("#onlyBtn").classList.contains("on"), "选中态未保持");
  });
  await test("空查询再输入关键词，仍应用“仅看精讲”", async () => {
    const input = $("#q");
    input.value = "孝";
    input.dispatchEvent(new win.Event("input", { bubbles: true }));
    await sleep(280);
    const m = metaCounts();
    ok(m.total > 0, "输入后无结果");
    eq(m.yw, 0, "原文条数");
  });

  await go("#/search?q=" + encodeURIComponent("巧言令色"));
  const onlyFull = metaCounts();
  await test("仅有未精讲匹配时，开启筛选归零并给出空态", async () => {
    eq(onlyFull.jj, 0, "该查询不应有精讲结果");
    ok(onlyFull.yw >= 1, "应至少有原文结果");
    eq($$(".result .pill.seal").length, 0, "不应出现精讲徽标");
    $("#onlyBtn").click();
    await sleep(20);
    ok(text("#results").indexOf("没有找到") >= 0, "缺空结果提示：" + text("#results").slice(0, 40));
    ok($("#onlyBtn").classList.contains("on"), "选中态丢失");
    eq($$(".result").length, 0, "筛选后仍有结果");
  });
  await test("零结果下切换篇目/排序不报错，关闭筛选后恢复", async () => {
    await go("#/search?q=" + encodeURIComponent("巧言令色"));
    const base = metaCounts();
    $("#onlyBtn").click();
    await sleep(20);

    const sel = $("#pianSel");
    sel.value = "20";
    sel.dispatchEvent(new win.Event("change", { bubbles: true }));
    $("#sortBtn").click();
    await sleep(20);
    eq($$(".result").length, 0, "零结果状态被破坏");

    $("#sortBtn").click();
    sel.value = "0";
    sel.dispatchEvent(new win.Event("change", { bubbles: true }));
    $("#onlyBtn").click();
    await sleep(20);
    eq(metaCounts().total, base.total, "恢复后总数");
    eq(metaCounts().yw, base.yw, "恢复后原文条数");
  });
  await test("筛选开启时切换篇目，状态保持且只含精讲", async () => {
    await go("#/search?q=" + encodeURIComponent("孝"));
    $("#onlyBtn").click();
    await sleep(20);
    const sel = $("#pianSel");
    sel.value = "2";
    sel.dispatchEvent(new win.Event("change", { bubbles: true }));
    await sleep(20);
    ok($("#onlyBtn").classList.contains("on"), "切换篇目后选中态丢失");
    eq(metaCounts().yw, 0, "切换后出现原文");
    ok(metaCounts().total > 0, "为政篇内应有精讲结果");
  });
  await test("连续点击三次，最终为开启态且无原文", async () => {
    await go("#/search?q=" + encodeURIComponent("孝"));
    for (let i = 0; i < 3; i++) {
      $("#onlyBtn").click();
      await sleep(15);
    }
    ok($("#onlyBtn").classList.contains("on"), "三次点击后应为开启");
    eq(metaCounts().yw, 0, "原文条数");
  });

  /* ------------------------------------------------------------------
   * 边界：单字概念在复合词、空串、纯符号下的表现
   * ------------------------------------------------------------------ */
  group("REG-06 单字概念边界");
  const LX = win.LX;
  await test("句首单字正常命中：「仁」「学」", () => {
    ok(LX.answerQuestion("仁").title.indexOf("仁") >= 0, LX.answerQuestion("仁").title);
    ok(LX.answerQuestion("学").title.indexOf("学") >= 0, LX.answerQuestion("学").title);
  });
  await test("复合词不误命中：科学家 / 果仁 / 今天天气 / 网友", () => {
    ["科学家", "果仁", "今天天气", "网友"].forEach(function (q) {
      const a = LX.answerQuestion(q);
      eq(a.ids.length, 0, q + " 不应给出处（标题：" + a.title + "）");
    });
  });
  await test("空串与纯符号不抛错，返回兜底结构", () => {
    ["", "   ", "？？？"].forEach(function (q) {
      const a = LX.answerQuestion(q);
      ok(typeof a.title === "string" && a.title.length > 0, q + " 未返回标题");
      ok(typeof a.body === "string", q + " 未返回正文");
    });
  });

  /* ------------------------------------------------------------------
   * 回归过程中不得引入新的运行期错误
   * ------------------------------------------------------------------ */
  group("REG-07 运行期无错误");
  await test("整轮回归无 jsdom / console 错误", () => {
    eq(env.errors.length, 0, "错误：" + env.errors.join(" | "));
  });

  console.log("\n----------------------------------------");
  console.log("通过 " + pass + " 项，失败 " + failures.length + " 项");
  env.dom.window.close();
  if (failures.length) {
    failures.forEach(function (f) { console.log("  \u2717 " + f.name + "：" + f.message); });
    process.exit(1);
  }
  console.log("全部回归测试通过");
})();
