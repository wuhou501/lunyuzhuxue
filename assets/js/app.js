/* 论语助学 · 应用逻辑 */
(function () {
  "use strict";

  /* ---------- 数据与索引 ---------- */
  var PIAN = window.PIAN || [];
  var ZHANG = (window.ZHANG || []).slice();
  var CONCEPTS = window.CONCEPTS || [];
  var PEOPLE = window.PEOPLE || [];
  var COMPARE = window.COMPARE || [];
  var ASK_SUGGEST = window.ASK_SUGGEST || [];

  ZHANG.sort(function (a, b) { return a.p - b.p || a.n - b.n; });

  var pianById = {};
  PIAN.forEach(function (p) { pianById[p.id] = p; });

  var zhangById = {};
  var byPian = {};
  ZHANG.forEach(function (z, i) {
    z._i = i;
    zhangById[z.id] = z;
    (byPian[z.p] = byPian[z.p] || []).push(z);
  });
  var TOTAL = ZHANG.length;

  /* ---------- 全本原文（二十篇 · 逐章） ---------- */
  var FULLTEXT = window.FULLTEXT || {};
  var FULL_TOTAL = 0;
  PIAN.forEach(function (p) {
    var arr = FULLTEXT[p.id] || [];
    if (arr.length) p.chapters = arr.length;
    FULL_TOTAL += p.chapters;
  });
  var zhangIdSet = {};
  ZHANG.forEach(function (z) { zhangIdSet[z.id] = true; });

  var FULL_INDEX = [];
  PIAN.forEach(function (p) {
    (FULLTEXT[p.id] || []).forEach(function (t, i) {
      var id = p.id + "." + (i + 1);
      if (zhangIdSet[id]) return;
      FULL_INDEX.push({
        z: { id: id, p: p.id, n: i + 1, t: t, tr: "", tags: [], notes: [] },
        text: (t + " " + p.name + p.theme.join("")).toLowerCase(),
        full: true
      });
    });
  });

  function noteText(z) {
    return (z.notes || []).map(function (n) {
      return Array.isArray(n) ? n[0] + " " + n[1] : (n.w + " " + n.d);
    }).join(" ");
  }
  var INDEX = ZHANG.map(function (z) {
    var p = pianById[z.p];
    return {
      z: z,
      text: (z.t + " " + z.tr + " " + noteText(z) + " " + (z.tags || []).join(" ") + " " + (p ? p.name + p.theme.join("") : "")).toLowerCase()
    };
  });

  var ALL_INDEX = INDEX.concat(FULL_INDEX);

  /* ---------- 本地存储 ---------- */
  var KEY = "zhuxue.lunyu.v1";
  var store = { learned: {}, fav: {}, notes: {}, read: {}, last: null, hist: [] };
  try {
    var raw = localStorage.getItem(KEY);
    if (raw) {
      var d = JSON.parse(raw);
      store.learned = d.learned || {};
      store.fav = d.fav || {};
      store.notes = d.notes || {};
      store.read = d.read || {};
      store.last = d.last || null;
      store.hist = d.hist || [];
    }
  } catch (e) { /* ignore */ }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* ignore */ }
  }
  function isLearned(id) { return !!store.learned[id]; }
  function isFav(id) { return !!store.fav[id]; }
  function learnedCount(p) {
    if (p == null) {
      return Object.keys(store.learned).filter(function (id) { return !!zhangById[id]; }).length;
    }
    return (byPian[p] || []).filter(function (z) { return store.learned[z.id]; }).length;
  }
  function favList() {
    return Object.keys(store.fav)
      .filter(function (id) { return zhangById[id]; })
      .sort(function (a, b) { return store.fav[b] - store.fav[a]; })
      .map(function (id) { return zhangById[id]; });
  }
  function noteList() {
    return Object.keys(store.notes)
      .filter(function (id) { return zhangById[id] && store.notes[id]; })
      .sort(function (a, b) { return (store.notes[b].t || 0) - (store.notes[a].t || 0); })
      .map(function (id) { return zhangById[id]; });
  }

  /* ---------- 工具 ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function icon(id, cls) {
    return '<svg class="ico ' + (cls || "") + '"><use href="#i-' + id + '"/></svg>';
  }
  function refLabel(id) {
    var z = zhangById[id];
    if (!z) return "";
    var p = pianById[z.p];
    return p.full + " · 第" + z.n + "章";
  }
  function shortRef(z) {
    var p = pianById[z.p];
    return p.name + " " + z.p + "." + z.n;
  }
  function toast(msg) {
    var t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove("show"); }, 1800);
  }
  function pct(a, b) { return b ? Math.round(a / b * 100) : 0; }
  function todayKey() {
    var d = new Date();
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  }

  /* ---------- 路由 ---------- */
  var routes = ["home", "pian", "zhang", "search", "ask", "progress", "about"];
  var navConf = [
    { key: "home", label: "首页", icon: "home" },
    { key: "pian", label: "篇目", icon: "book" },
    { key: "search", label: "检索", icon: "search" },
    { key: "ask", label: "问答", icon: "chat" },
    { key: "progress", label: "进度", icon: "chart" }
  ];

  var navBuilt = false;
  function buildNav() {
    if (!navBuilt) {
      $("#sideNav").innerHTML = navConf.map(function (n) {
        return '<a class="nav-item" href="#/' + n.key + '" data-nav="' + n.key + '">' +
          icon(n.icon) + "<span>" + n.label + "</span></a>";
      }).join("");
      $("#tabbar").innerHTML = navConf.map(function (n) {
        return '<a class="tab" href="#/' + n.key + '" data-nav="' + n.key + '">' +
          icon(n.icon) + "<span>" + n.label + "</span></a>";
      }).join("");
      navBuilt = true;
    }
    $("#sideStat").innerHTML =
      "全本 <b>" + FULL_TOTAL + "</b> 章 · 精讲 <b>" + TOTAL + "</b> 章<br>已学 <b>" +
      learnedCount() + "</b> 章 · 收藏 <b>" + Object.keys(store.fav).length + "</b>";
  }

  function parseHash() {
    var h = location.hash.replace(/^#\/?/, "");
    if (!h) return { name: "home", q: "" };
    var qi = h.indexOf("?");
    var path = qi >= 0 ? h.slice(0, qi) : h;
    var qs = qi >= 0 ? h.slice(qi + 1) : "";
    var parts = path.split("/").filter(Boolean);
    var name = parts[0] || "home";
    if (routes.indexOf(name) < 0) name = "home";
    var q = "";
    qs.split("&").forEach(function (kv) {
      var p = kv.split("=");
      if (p[0] === "q") q = decodeURIComponent((p[1] || "").replace(/\+/g, " "));
    });
    return { name: name, arg: parts[1] ? decodeURIComponent(parts[1]) : "", q: q };
  }

  function setActive(name) {
    var all = document.querySelectorAll("[data-nav]");
    for (var i = 0; i < all.length; i++) {
      var on = all[i].getAttribute("data-nav") === name;
      all[i].classList.toggle("active", on);
    }
  }

  function router() {
    var r = parseHash();
    var view = $("#view");
    view.innerHTML = "";
    setActive(r.name);
    if (r.name !== "ask") askHandler = null;
    window.scrollTo({ top: 0, behavior: "auto" });
    if (r.name === "home") viewHome(view);
    else if (r.name === "pian") {
      if (r.arg) viewPianDetail(view, +r.arg); else viewPianList(view);
    }
    else if (r.name === "zhang") viewZhang(view, r.arg);
    else if (r.name === "search") viewSearch(view, r.q);
    else if (r.name === "ask") viewAsk(view, r.q);
    else if (r.name === "progress") viewProgress(view);
    else if (r.name === "about") viewAbout(view);
    buildNav();
    setActive(r.name);
  }

  /* ---------- 首页 ---------- */
  function homeStats() {
    var learned = learnedCount();
    return '<div class="hero-stats">' +
      "<div><b>" + PIAN.length + "</b><span>篇目全收录</span></div>" +
      "<div><b>" + FULL_TOTAL + "</b><span>全本章句</span></div>" +
      "<div><b>" + TOTAL + "</b><span>章句精讲</span></div>" +
      "<div><b>" + learned + "</b><span>已学章句</span></div>" +
      "</div>";
  }

  function viewHome(view) {
    var day = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    var daily = ZHANG[day % TOTAL];
    var last = store.last && zhangById[store.last];
    var recent = Object.keys(store.learned)
      .sort(function (a, b) { return store.learned[b] - store.learned[a]; })
      .slice(0, 3).map(function (id) { return zhangById[id]; }).filter(Boolean);

    view.innerHTML =
      '<section class="hero">' +
        '<div class="hero-tag">专注《论语》的智能学习工具</div>' +
        "<h1>一部可以问、可以读、<br>可以记的《论语》</h1>" +
        "<p>二十篇 " + FULL_TOTAL + " 章原文全收，" + TOTAL + " 章精讲配白话译注。用自然语言提问，或按字词检索，每条回答都能回溯到原文出处。</p>" +
        '<div class="hero-actions">' +
          '<a class="btn primary lg" href="#/ask">' + icon("chat") + "开始提问</a>" +
          '<a class="btn lg" href="#/pian">' + icon("book") + "浏览二十篇</a>" +
        "</div>" +
        homeStats() +
      "</section>" +

      '<div class="home-grid">' +
        '<div class="card daily">' +
          '<div class="daily-top"><span class="daily-label">今日一章</span><span class="daily-ref">' + esc(refLabel(daily.id)) + "</span></div>" +
          '<p class="daily-text">' + esc(daily.t) + "</p>" +
          '<p class="daily-tr">' + esc(daily.tr) + "</p>" +
          '<div class="daily-foot">' +
            '<span class="pill seal">' + esc(daily.tags[0] || "精讲") + "</span>" +
            '<a class="link" href="#/zhang/' + daily.id + '">读这一章 ' + icon("arrow") + "</a>" +
          "</div>" +
        "</div>" +
        '<div class="card cont">' +
          "<h3>继续学习</h3>" +
          (last
            ? '<div class="cont-item"><span class="cont-no">' + esc(last.p + "." + last.n) + '</span><div class="cont-txt">' + esc(last.t.slice(0, 46)) + "…<em>" + esc(refLabel(last.id)) + "</em></div></div>"
            : '<div class="cont-empty">还没有学习记录，从「今日一章」开始吧。</div>') +
          (recent.length
            ? recent.map(function (z) {
                return '<div class="cont-item"><span class="cont-no">' + esc(z.p + "." + z.n) + '</span><div class="cont-txt">' + esc(z.t.slice(0, 40)) + "…</div></div>";
              }).join("")
            : "") +
          '<a class="btn ghost" style="justify-content:flex-start;border:none;padding-left:0;color:var(--seal)" href="#/progress">查看学习进度 ' + icon("arrow") + "</a>" +
        "</div>" +
      "</div>" +

      '<section class="section">' +
        '<div class="section-head"><h2 class="section-title">核心功能</h2><a class="section-more" href="#/about">内容标准 ' + icon("arrow") + "</a></div>" +
        '<div class="feature-grid">' +
          '<a class="feature" href="#/pian">' + icon("book") + "<h4>二十篇精讲</h4><p>每篇有主旨、脉络与核心命题，逐章配原文、译文、字词注释与思想要点。</p></a>" +
          '<a class="feature" href="#/search">' + icon("search") + "<h4>原文检索</h4><p>按字词、篇名或主题检索，命中处高亮，并标明出自哪一篇第几章。</p></a>" +
          '<a class="feature" href="#/ask">' + icon("spark") + "<h4>自然语言问答</h4><p>直接问“什么是仁”，系统先识别意图，再给出释义、依据与原文出处。</p></a>" +
          '<a class="feature" href="#/progress">' + icon("chart") + "<h4>学习进度</h4><p>标记已学、收藏章句、随手记笔记，进度按篇统计，数据存在本地。</p></a>" +
        "</div>" +
      "</section>" +

      '<section class="section">' +
        '<div class="section-head"><h2 class="section-title">为什么可信</h2></div>' +
        '<div class="card" style="padding:24px 26px">' +
          '<div class="kv"><b>底本</b><span>原文依《论语》通行本，不作改动；节选章节明确标注“节选”。</span></div>' +
          '<div class="kv"><b>注译</b><span>白话译文、字词注释、思想要点均为平台自撰，参考公版原文与历代注疏的通行理解，不转录任何现代注本。</span></div>' +
          '<div class="kv"><b>溯源</b><span>问答与检索的每一条结论都附原文出处，可一键跳转核对。</span></div>' +
          '<div class="kv"><b>定位</b><span>面向初学者：先给白话，再给术语；有歧解处标明“一说”，不强作定论。</span></div>' +
        "</div>" +
      "</section>";
  }

  /* ---------- 篇目列表 ---------- */
  function viewPianList(view) {
    view.innerHTML =
      '<div class="page-head">' +
        '<div class="eyebrow">The Analects · 20 Books</div>' +
        '<h1 class="page-title">二十篇</h1>' +
        '<p class="page-sub">《论语》二十篇 ' + FULL_TOTAL + ' 章原文全部收录，并按篇连读；其中 ' + TOTAL + ' 章精讲，配原文、白话、字词、要点四件套。</p>' +
      "</div>" +
      '<div class="pian-grid">' +
      PIAN.map(function (p) {
        var all = byPian[p.id] || [];
        var done = learnedCount(p.id);
        var pctv = pct(done, all.length);
        return '<a class="pian-card" data-no="' + (p.id < 10 ? "0" + p.id : p.id) + '" href="#/pian/' + p.id + '">' +
          '<div class="pian-name">' + esc(p.name) + "<i>第" + toCn(p.id) + "篇</i></div>" +
          '<div class="pian-meta"><span>原书 ' + p.chapters + " 章</span><span>精讲 " + all.length + " 章</span></div>" +
          '<div class="pian-sum">' + esc(p.summary) + "</div>" +
          '<div class="pian-bar"><span style="width:' + pctv + '%"></span></div>' +
          "</a>";
      }).join("") +
      "</div>";
  }

  function toCn(n) {
    var d = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
    if (n <= 10) return d[n];
    if (n < 20) return "十" + d[n - 10];
    return "二十";
  }

  /* ---------- 篇详情 ---------- */
  function viewPianDetail(view, pid) {
    var p = pianById[pid];
    if (!p) { view.innerHTML = '<div class="empty">没有找到这一篇。<a href="#/pian">返回篇目</a></div>'; return; }
    var list = byPian[p.id] || [];
    var done = learnedCount(p.id);

    view.innerHTML =
      '<a class="back-link" href="#/pian">' + icon("back") + " 二十篇</a>" +
      '<section class="card pian-hero">' +
        '<div class="pian-hero-top"><h1>' + esc(p.name) + '</h1><span class="en">' + esc(p.py) + " · " + esc(p.full) + "</span></div>" +
        '<div class="pills">' + p.theme.map(function (t) { return '<span class="pill">' + esc(t) + "</span>"; }).join("") +
          '<span class="pill line">原书 ' + p.chapters + " 章</span>" +
          '<span class="pill line">精讲 ' + list.length + " 章</span></div>" +
        '<div class="thesis">' +
          '<div class="thesis-label">篇旨</div>' +
          "<p>" + esc(p.summary) + "</p>" +
          '<div class="thesis-grid">' +
            "<div><h5>核心命题</h5><p>" + esc(p.key) + "</p></div>" +
            "<div><h5>结构脉络</h5><p>" + esc(p.flow) + "</p></div>" +
            "<div><h5>阅读建议</h5><p>" + esc(p.tip) + "</p></div>" +
          "</div>" +
        "</div>" +
      "</section>" +

      '<section class="section">' +
        '<div class="section-head"><h2 class="section-title">全本章句</h2>' +
          '<span class="section-more">全本 ' + p.chapters + " 章 · 精讲 " + list.length + " 章</span></div>" +
        '<div class="card chapter-list">' +
          (FULLTEXT[p.id] || []).map(function (t, i) {
            var n = i + 1, id = p.id + "." + n, z = zhangById[id];
            return '<div class="chapter-row' + (isLearned(id) ? " is-done" : "") + '" data-goto="' + id + '">' +
              '<span class="idx">' + p.id + "." + n + "</span>" +
              '<div class="txt"><div class="src-text">' + esc(t) + "</div>" +
                '<div class="tag-row">' +
                  (z ? (z.tags || []).slice(0, 3).map(function (tag) { return '<span class="pill">' + esc(tag) + "</span>"; }).join("") +
                    (z.excerpt ? '<span class="pill line">节选</span>' : "") + '<span class="pill seal">精讲</span>'
                    : '<span class="pill line">原文</span>') +
                "</div></div>" +
              '<div class="state">' + (isLearned(id) ? '<span class="dot-done" title="已学"></span>' : "") +
                (isFav(id) ? '<span class="dot-fav" title="已收藏"></span>' : "") + "</div>" +
              "</div>";
          }).join("") +
        "</div>" +
      "</section>";
  }

  /* ---------- 章详情 ---------- */
  function viewZhang(view, id) {
    var z = zhangById[id];
    if (!z) { viewFullChapter(view, id); return; }
    var p = pianById[z.p];
    var list = byPian[z.p] || [];
    var arrF = FULLTEXT[z.p] || [];
    var prevId = z.n > 1 ? z.p + "." + (z.n - 1) : "";
    var nextId = z.n < arrF.length ? z.p + "." + (z.n + 1) : "";
    store.last = z.id;
    store.read[z.id] = Date.now();
    save();

    view.innerHTML =
      '<div class="zhang-wrap">' +
        '<a class="back-link" href="#/pian/' + z.p + '">' + icon("back") + " " + esc(p.full) + "</a>" +
        '<div class="zhang-head">' +
          '<div class="zhang-no"><b>' + esc(p.full) + " · 第" + z.n + "章</b><span>" + esc(z.tags.join(" · ")) + "</span></div>" +
          '<div class="zhang-actions">' +
            '<button class="btn' + (isLearned(z.id) ? " on" : "") + '" data-learn="' + z.id + '">' + icon("check") + (isLearned(z.id) ? "已学" : "标记已学") + "</button>" +
            '<button class="btn' + (isFav(z.id) ? " on" : "") + '" data-fav="' + z.id + '">' + icon("star") + (isFav(z.id) ? "已收藏" : "收藏") + "</button>" +
            '<button class="btn" data-note="' + z.id + '">' + icon("pen") + (store.notes[z.id] ? "我的笔记" : "记笔记") + "</button>" +
          "</div>" +
        "</div>" +

        '<div class="quote-card"><p class="quote-text" data-src="' + esc(z.t) + '">' + esc(z.t) + "</p>" +
          '<div class="quote-src">《论语·' + esc(p.name) + "》" + esc(z.p + "." + z.n) + (z.excerpt ? " · 节选" : "") + "</div></div>" +

        (store.notes[z.id] ? '<div class="note-editor open" style="margin-top:14px"><textarea data-note-input="' + z.id + '">' + esc(store.notes[z.id].text || "") + "</textarea>" +
          '<div class="note-editor-foot"><button class="btn" data-note-cancel="1">收起</button><button class="btn primary" data-note-save="' + z.id + '">保存笔记</button></div></div>' : "") +

        '<section class="block"><div class="block-title">白话译文</div><p class="trans-text">' + esc(z.tr) + "</p></section>" +

        (z.notes && z.notes.length
          ? '<section class="block"><div class="block-title">字词注释 · 点击词语在原文定位</div><ul class="note-list">' +
            z.notes.map(function (n) {
              var w = Array.isArray(n) ? n[0] : n.w, d = Array.isArray(n) ? n[1] : n.d;
              return '<li class="note-item" data-w="' + esc(w) + '"><b>' + esc(w) + "</b><span>" + esc(d) + "</span></li>";
            }).join("") + "</ul></section>"
          : "") +

        '<section class="block"><div class="block-title">思想要点</div><div class="idea-box">' + esc(z.idea) + "</div></section>" +

        '<section class="block"><div class="block-title">主题标签</div><div class="chips">' +
          z.tags.map(function (t) { return '<a class="chip" href="#/search?q=' + encodeURIComponent(t) + '">' + esc(t) + "</a>"; }).join("") +
        "</div></section>" +

        '<nav class="znav">' +
          (prevId ? '<a href="#/zhang/' + prevId + '"><small>上一章 · ' + prevId + "</small><b>" + esc((arrF[z.n - 2] || "").slice(0, 24)) + "…</b></a>" : "<span></span>") +
          (nextId ? '<a class="next" href="#/zhang/' + nextId + '"><small>下一章 · ' + nextId + "</small><b>" + esc((arrF[z.n] || "").slice(0, 24)) + "…</b></a>" : "<span></span>") +
        "</nav>" +
      "</div>";
  }

  /* ---------- 全本原文 · 未精讲章 ---------- */
  function viewFullChapter(view, id) {
    var parts = String(id || "").split(".");
    var pid = parseInt(parts[0], 10);
    var n = parseInt(parts[1], 10);
    var p = pianById[pid];
    var arr = FULLTEXT[pid] || [];
    if (!p || !arr[n - 1]) {
      view.innerHTML = '<div class="empty">没有找到这一章。<a href="#/pian">返回篇目</a></div>';
      return;
    }
    var text = arr[n - 1];
    store.read[id] = Date.now();
    save();
    var rel = (byPian[pid] || []).slice(0, 3);
    var prevId = n > 1 ? pid + "." + (n - 1) : "";
    var nextId = n < arr.length ? pid + "." + (n + 1) : "";

    view.innerHTML =
      '<div class="zhang-wrap">' +
        '<a class="back-link" href="#/pian/' + pid + '">' + icon("back") + " " + esc(p.full) + "</a>" +
        '<div class="zhang-head">' +
          '<div class="zhang-no"><b>' + esc(p.full) + " · 第" + n + "章</b><span>全本原文</span></div>" +
          '<div class="zhang-actions"><span class="pill line">暂未精讲</span>' +
            '<button class="btn" data-learn="' + id + '">' + icon("check") + (isLearned(id) ? "已学" : "标记已学") + "</button>" +
          "</div>" +
        "</div>" +
        '<div class="quote-card"><p class="quote-text">' + esc(text) + "</p>" +
          '<div class="quote-src">《论语·' + esc(p.name) + "》" + esc(pid + "." + n) + "</div></div>" +
        '<section class="block"><div class="block-title">本章说明</div>' +
          '<div class="idea-box">本章已收录全本原文，<strong>白话译文与字词注释仍在整理中</strong>。可以先参考同篇的精讲章节，或查看<a href="#/pian/' + pid + '" style="color:var(--seal)">本篇篇旨</a>。</div></section>' +
        (rel.length
          ? '<section class="block"><div class="block-title">同篇精讲</div><div class="card list-simple">' +
            rel.map(function (z) {
              return '<div class="list-row" data-goto="' + z.id + '"><span class="ref">' + esc(z.p + "." + z.n) + '</span><span class="t">' + esc(z.t) + "</span></div>";
            }).join("") + "</div></section>"
          : "") +
        '<nav class="znav">' +
          (prevId ? '<a href="#/zhang/' + prevId + '"><small>上一章 · ' + pid + "." + (n - 1) + "</small><b>" + esc(arr[n - 2].slice(0, 24)) + "…</b></a>" : "<span></span>") +
          (nextId ? '<a class="next" href="#/zhang/' + nextId + '"><small>下一章 · ' + pid + "." + (n + 1) + "</small><b>" + esc(arr[n].slice(0, 24)) + "…</b></a>" : "<span></span>") +
        "</nav>" +
      "</div>";
  }

  /* ---------- 检索 ---------- */
  var STOP = ["孔子", "子曰", "什么", "意思", "怎么", "如何", "为什么", "请问", "解释", "一下", "论语", "关于", "中的", "里的", "讲了", "说的", "这个", "那个", "还是", "可以", "我们", "他们"];
  var SYN = {
    "信任": ["信"], "诚信": ["信"], "孝顺": ["孝"], "学习": ["学"], "读书": ["学"],
    "治理": ["为政", "政"], "领导": ["政", "德治"], "朋友": ["友"], "贫穷": ["贫"],
    "富贵": ["富", "贵"], "错误": ["过", "改过"], "生气": ["怒"], "死亡": ["死"],
    "鬼神": ["鬼", "神"], "说话": ["言"], "行动": ["行"], "时间": ["逝"], "志向": ["志"],
    "勇气": ["勇"], "教育": ["教", "学"], "老师": ["师"], "名声": ["知", "名"],
    "孝顺父母": ["孝"], "规矩": ["礼"], "和谐": ["和"], "适度": ["中庸"], "智慧": ["知", "智"],
    "君子": ["君子"], "小人": ["小人"], "为政以德": ["为政", "德"], "治国": ["为政", "政"]
  };

  function tokenize(q) {
    var s = String(q || "").toLowerCase().replace(/[，。？！；：、“”‘’（）《》\s,.?!;:"'()<>\[\]]/g, " ").trim();
    var arr = s.split(/\s+/).filter(function (t) { return t && STOP.indexOf(t) < 0; });
    return arr;
  }

  function scoreChapter(item, terms) {
    var z = item.z, text = item.text, score = 0;
    var p = pianById[z.p];
    terms.forEach(function (raw) {
      var t = raw;
      if (t.length < 1) return;
      var groups = SYN[t] || [t];
      groups.forEach(function (g, gi) {
        var w = gi === 0 ? 1 : 0.75;
        if (!g) return;
        (z.tags || []).forEach(function (tag) {
          if (tag === t || tag === g) score += 4.5 * w;
          else if (tag.indexOf(g) >= 0) score += 2.4 * w;
        });
        if (z.t.indexOf(g) >= 0) score += 2.6 * w;
        if (z.tr.indexOf(g) >= 0) score += 1.5 * w;
        if (noteText(z).indexOf(g) >= 0) score += 1.1 * w;
        if (p && (p.name === g || p.summary.indexOf(g) >= 0)) score += 0.9 * w;
        if (text.indexOf(g) >= 0) score += 0.3 * w;
      });
    });
    return score;
  }

  function searchChapters(q, opts) {
    opts = opts || {};
    var terms = tokenize(q);
    if (!terms.length) return { terms: terms, list: [] };
    var pool = ALL_INDEX;
    if (opts.pian) pool = pool.filter(function (it) { return it.z.p === opts.pian; });
    if (opts.onlyZhujiang) pool = pool.filter(function (it) { return !it.full; });
    var scored = pool.map(function (item) {
      return { item: item, score: scoreChapter(item, terms) };
    }).filter(function (r) { return r.score > 0; });
    if (opts.sort === "pian") {
      scored.sort(function (a, b) { return a.item.z.p - b.item.z.p || a.item.z.n - b.item.z.n; });
    } else {
      scored.sort(function (a, b) { return b.score - a.score; });
    }
    return { terms: terms, list: scored.map(function (r) { return r.item; }) };
  }

  function markify(text, terms) {
    var out = esc(text);
    if (!terms || !terms.length) return out;
    var uniq = [];
    terms.forEach(function (t) { if (t.length > 0 && uniq.indexOf(t) < 0) uniq.push(t); });
    uniq.sort(function (a, b) { return b.length - a.length; });
    uniq.forEach(function (t) {
      var safe = esc(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (!safe) return;
      out = out.replace(new RegExp(safe, "g"), '<mark>$&</mark>');
    });
    return out;
  }

  function viewSearch(view, initQ) {
    var q = initQ || "";
    var state = { pian: 0, onlyZhujiang: false, sort: "score" };

    view.innerHTML =
      '<div class="page-head">' +
        '<div class="eyebrow">Search the Analects</div>' +
        '<h1 class="page-title">原文检索</h1>' +
        '<p class="page-sub">全本 ' + FULL_TOTAL + " 章原文与 " + TOTAL + " 章精讲联合检索：原文、白话、注释、标签一起匹配，命中处高亮。</p>" +
      "</div>" +
      '<div class="search-box">' + icon("search") +
        '<input id="q" type="search" placeholder="如：仁、孝、和而不同、为政以德" value="' + esc(q) + '" />' +
        '<button class="clear" id="clearQ" aria-label="清空">' + icon("close") + "</button>" +
      "</div>" +
      '<div class="search-tools">' +
        '<select id="pianSel" class="tool-select"><option value="0">全部篇目</option>' +
          PIAN.map(function (p) { return '<option value="' + p.id + '">' + esc(p.full) + "</option>"; }).join("") +
        "</select>" +
        '<button class="chip" id="onlyBtn">仅看精讲</button>' +
        '<button class="chip" id="sortBtn">按相关度</button>' +
      "</div>" +
      '<div class="chips" id="chips"></div>' +
      '<div class="hist-row" id="histRow"></div>' +
      '<div id="results"></div>';

    var chips = ["仁", "礼", "孝", "学", "君子", "为政以德", "和而不同", "过犹不及", "己所不欲", "岁寒"];
    $("#chips").innerHTML = chips.map(function (c) { return '<button class="chip" data-chip="' + esc(c) + '">' + esc(c) + "</button>"; }).join("");

    var input = $("#q");

    function commit(text) {
      var v = String(text || "").trim();
      if (!v) return;
      store.hist = [v].concat(store.hist.filter(function (h) { return h !== v; })).slice(0, 6);
      save();
      renderHist();
    }
    function renderHist() {
      var row = $("#histRow");
      if (!store.hist.length) { row.innerHTML = ""; return; }
      row.innerHTML = '<span class="hist-label">最近</span>' +
        store.hist.map(function (h) { return '<button class="chip ghost" data-hist="' + esc(h) + '">' + esc(h) + "</button>"; }).join("") +
        '<button class="hist-clear" id="histClear">清空</button>';
    }
    function run(qq) {
      var t0 = performance.now();
      var res = searchChapters(qq, state);
      var ms = (performance.now() - t0).toFixed(1);
      $("#clearQ").classList.toggle("show", !!qq);
      renderResults(qq, res, ms, state);
    }

    renderHist();
    renderResults(q, searchChapters(q, state), "0.0", state);

    var timer = null;
    input.addEventListener("input", function () {
      clearTimeout(timer);
      var v = input.value;
      timer = setTimeout(function () {
        run(v);
        history.replaceState(null, "", v ? "#/search?q=" + encodeURIComponent(v) : "#/search");
      }, 160);
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") commit(input.value);
    });
    $("#clearQ").addEventListener("click", function () { input.value = ""; run(""); input.focus(); });
    $("#chips").addEventListener("click", function (e) {
      var b = e.target.closest("[data-chip]");
      if (!b) return;
      input.value = b.getAttribute("data-chip");
      run(input.value);
      commit(input.value);
      history.replaceState(null, "", "#/search?q=" + encodeURIComponent(input.value));
    });
    $("#histRow").addEventListener("click", function (e) {
      if (e.target.closest("#histClear")) {
        store.hist = [];
        save();
        renderHist();
        return;
      }
      var b = e.target.closest("[data-hist]");
      if (!b) return;
      input.value = b.getAttribute("data-hist");
      run(input.value);
      commit(input.value);
      history.replaceState(null, "", "#/search?q=" + encodeURIComponent(input.value));
    });
    $("#pianSel").addEventListener("change", function () {
      state.pian = parseInt(this.value, 10) || 0;
      run(input.value);
    });
    $("#onlyBtn").addEventListener("click", function () {
      state.onlyZhujiang = !state.onlyZhujiang;
      this.classList.toggle("on", state.onlyZhujiang);
      this.textContent = state.onlyZhujiang ? "仅看精讲 ✓" : "仅看精讲";
      run(input.value);
    });
    $("#sortBtn").addEventListener("click", function () {
      state.sort = state.sort === "score" ? "pian" : "score";
      this.textContent = state.sort === "score" ? "按相关度" : "按篇序";
      run(input.value);
    });
    if (!/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) input.focus();
  }

  function renderResults(q, res, ms, state) {
    var box = $("#results");
    if (!q.trim()) {
      box.innerHTML = '<div class="empty">' + icon("search") + "<div>输入关键词，开始检索《论语》全本原文与精讲内容</div></div>";
      return;
    }
    if (!res.list.length) {
      box.innerHTML = '<div class="empty">' + icon("search") + "<div>没有找到“" + esc(q) + "”的相关章句<br/><span class='small'>试试更短的关键词，或换用主题词（如“孝”“君子”）</span></div></div>";
      return;
    }
    var list = res.list.slice(0, 50);
    var fullCount = res.list.filter(function (it) { return it.full; }).length;
    box.innerHTML =
      '<div class="search-meta"><span>共 ' + res.list.length + " 条 · 精讲 " + (res.list.length - fullCount) + " · 原文 " + fullCount + "</span>" +
        "<span>" + (state && state.sort === "pian" ? "按篇序" : "按相关度") + " · 本地索引 " + ms + " ms</span></div>" +
      '<div class="card">' + list.map(function (item) {
        var z = item.z;
        return '<div class="result" data-goto="' + z.id + '">' +
          '<div class="result-head"><span class="result-ref">' + esc(shortRef(z)) + "</span>" +
            (z.tags || []).slice(0, 2).map(function (t) { return '<span class="pill">' + esc(t) + "</span>"; }).join("") +
            (item.full ? '<span class="pill line">仅原文</span>' : '<span class="pill seal">精讲</span>') +
            (isLearned(z.id) ? '<span class="pill green">已学</span>' : "") +
          "</div>" +
          '<div class="result-src">' + markify(z.t, res.terms) + "</div>" +
          (z.tr ? '<div class="result-tr">' + markify(z.tr, res.terms) + "</div>" : "") +
        "</div>";
      }).join("") + "</div>";
  }

  /* ---------- 问答 ---------- */
  var chatLog = [];
  var asking = false;
  var askHandler = null;

  function viewAsk(view, q) {
    view.innerHTML =
      '<div class="ask-wrap">' +
        '<div class="page-head" style="margin-bottom:18px">' +
          '<div class="eyebrow">Ask the Analects</div>' +
          '<h1 class="page-title">问《论语》</h1>' +
          '<p class="page-sub">用日常语言提问即可。系统先判断意图（概念、人物、篇旨、原文出处、对比），再检索原文作答，并附出处。</p>' +
        "</div>" +
        '<div class="ask-log" id="askLog"></div>' +
        '<div id="askSuggest"></div>' +
        '<div class="ask-input-wrap">' +
          '<div class="ask-input"><textarea id="askInput" rows="1" placeholder="例如：孔子说的“仁”到底是什么意思？"></textarea>' +
            '<button class="ask-send" id="askSend" aria-label="发送">' + icon("arrow") + "</button></div>" +
          '<div class="ask-hint">回答基于站内精讲内容生成，均标注原文出处 · 按 Enter 发送</div>' +
        "</div>" +
      "</div>";

    var log = $("#askLog");
    chatLog = [];
    function renderSuggest() {
      $("#askSuggest").innerHTML = (!chatLog.length && ASK_SUGGEST.length)
        ? '<div class="ask-suggest">' + ASK_SUGGEST.map(function (s) {
            return "<button data-ask=\"" + esc(s) + '">' + esc(s) + "</button>";
          }).join("") + "</div>"
        : "";
    }
    renderSuggest();

    function addUser(text) {
      var d = document.createElement("div");
      d.className = "msg user";
      d.innerHTML = '<div class="bubble">' + esc(text) + "</div>";
      log.appendChild(d);
    }
    function addTyping() {
      var d = document.createElement("div");
      d.className = "msg ai";
      d.innerHTML = '<div class="ai-body"><div class="typing"><i></i><i></i><i></i></div></div>';
      log.appendChild(d);
      return d;
    }

    var pending = Promise.resolve();

    function ask(text) {
      text = String(text || "").trim();
      if (!text || asking) return;
      asking = true;
      $("#askSuggest").innerHTML = "";
      addUser(text);
      chatLog.push({ role: "user", text: text });
      var typing = addTyping();
      $("#askInput").value = "";
      $("#askInput").style.height = "auto";
      scrollAsk();

      pending = pending.then(function () {
        return new Promise(function (resolve) {
          setTimeout(function () {
            var a = answerQuestion(text);
            chatLog.push({ role: "ai", answer: a });
            typing.innerHTML = renderAnswer(a);
            typing.style.animation = "fadeUp .3s ease both";
            asking = false;
            scrollAsk();
            resolve();
          }, 420 + Math.min(420, text.length * 12));
        });
      });
    }

    function scrollAsk() {
      setTimeout(function () { window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }); }, 60);
    }

    $("#askSend").addEventListener("click", function () { ask($("#askInput").value); });
    $("#askInput").addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(this.value); }
    });
    $("#askInput").addEventListener("input", function () {
      this.style.height = "auto";
      this.style.height = Math.min(120, this.scrollHeight) + "px";
    });
    askHandler = ask;

    if (q) ask(q);
  }

  /* ---------- 问答引擎 ---------- */
  function stripPunct(s) {
    return String(s).replace(/[，。？！；：、“”‘’（）《》\s,.?!;:"'()<>\[\]…—·]/g, "");
  }

  function answerQuestion(q) {
    var raw = q.trim().replace(/\s+/g, " ");

    /* 1. 原文出处 / 引文定位 */
    var quoted = raw.match(/[“"「『]([^”"」』]{2,})[”"」』]/);
    var wantsSource = /出自|出处|哪一章|哪一篇|原话|在哪一/.test(raw);
    if (quoted || wantsSource) {
      var probe = quoted ? quoted[1] : raw;
      var hit = findChapterContaining(probe) || findByFragment(probe);
      if (hit) return answerOfQuote(hit, quoted ? quoted[1] : "");
    }

    /* 2. 概念对比 */
    var cmp = detectCompare(raw);
    if (cmp) return answerOfCompare(cmp);

    /* 3. 篇旨 */
    var pian = detectPian(raw);
    if (pian) {
      var plain = stripPunct(raw);
      var onlyName = plain === pian.name || plain === stripPunct(pian.full);
      if (onlyName || /篇|主旨|概括|主要讲|讲什么|讲了什么|内容|大意|结构/.test(raw)) return answerOfPian(pian);
    }

    /* 4. 人物 */
    var person = detectPerson(raw);
    if (person) return answerOfPerson(person);

    /* 5. 现成语句（如“和而不同”“过犹不及”） */
    var phrase = findByFragment(raw, 3);
    if (phrase) return answerOfQuote(phrase, "");

    /* 6. 概念 */
    var concept = detectConcept(raw);
    if (concept) return answerOfConcept(concept);

    /* 7. 兜底：检索 */
    return answerOfSearch(raw);
  }

  function findChapterContaining(s) {
    var probe = stripPunct(s);
    if (!probe) return null;
    for (var i = 0; i < ZHANG.length; i++) {
      if (stripPunct(ZHANG[i].t).indexOf(probe) >= 0) return ZHANG[i];
    }
    return null;
  }

  function findByFragment(s, minWin) {
    var q = stripPunct(s);
    if (q.length < (minWin || 4)) return null;
    var best = null, bestScore = 0;
    var L = Math.min(8, q.length);
    for (var i = 0; i < ZHANG.length; i++) {
      var zt = stripPunct(ZHANG[i].t);
      var score = 0;
      for (var k = 0; k + L <= q.length; k++) {
        if (zt.indexOf(q.substr(k, L)) >= 0) score++;
      }
      if (score > bestScore) { bestScore = score; best = ZHANG[i]; }
    }
    var need = (L >= 6 || q.length <= 6) ? 1 : 2;
    return bestScore >= need ? best : null;
  }

  /* 单字概念容易误命中（如“量子力学”里的“学”），要求前面是词界或常见虚词 */
  var CONCEPT_BOUNDARY = "是的与和之何谓讲说看论重为即乃呀吗呢吧，。？！：、“”「」《》（）";
  function conceptNameHit(q, name) {
    var idx = q.indexOf(name);
    if (idx < 0) return false;
    if (name.length >= 2 || idx === 0) return true;
    return CONCEPT_BOUNDARY.indexOf(q.charAt(idx - 1)) >= 0;
  }
  function detectConcept(q) {
    var best = null, bestLen = 0;
    CONCEPTS.forEach(function (c) {
      var names = [c.key].concat(c.alias || []);
      names.forEach(function (n) {
        if (n && conceptNameHit(q, n) && n.length > bestLen) { best = c; bestLen = n.length; }
      });
    });
    return best;
  }
  function detectPerson(q) {
    for (var i = 0; i < PEOPLE.length; i++) {
      var p = PEOPLE[i];
      if (q.indexOf(p.name) >= 0) return p;
      if (p.zi && q.indexOf(p.zi) >= 0) return p;
    }
    return null;
  }
  function detectPian(q) {
    for (var i = 0; i < PIAN.length; i++) {
      if (q.indexOf(PIAN[i].name) >= 0) return PIAN[i];
    }
    return null;
  }
  function detectCompare(q) {
    var marker = /区别|不同|差别|对比|相比|异同|不一样/.test(q);
    for (var i = 0; i < COMPARE.length; i++) {
      var c = COMPARE[i];
      if (q.indexOf(c.a) < 0 || q.indexOf(c.b) < 0) continue;
      if (marker || new RegExp(c.a + "\\s*[和与跟]\\s*" + c.b).test(q)) return c;
    }
    if (marker) {
      var cands = [];
      CONCEPTS.forEach(function (c) { if (q.indexOf(c.key) >= 0) cands.push(c); });
      if (cands.length >= 2) {
        return { key: cands[0].key + "与" + cands[1].key, a: cands[0].key, b: cands[1].key, rows: [], note: "这两个概念在《论语》中互有交叠，建议分别阅读后再对照。", mixed: true, c1: cands[0], c2: cands[1] };
      }
    }
    return null;
  }

  function answerOfConcept(c) {
    return {
      title: "关于「" + c.key + "」",
      lead: c.def,
      body:
        '<h4>' + esc(c.key) + " · 核心理解</h4>" +
        "<p>" + esc(c.def) + "</p>" +
        '<div style="margin-top:6px">' + c.points.map(function (p) {
          return '<div class="ai-point"><b>' + esc(p.t) + "</b><span>" + esc(p.s) + "</span></div>";
        }).join("") + "</div>" +
        '<p class="small muted" style="margin-top:14px">学习建议：' + esc(c.tip) + "</p>",
      ids: c.ids.slice(0, 5),
      srcTitle: "依据（原文出处）",
      follow: ["“" + c.key + "”和“礼”有什么区别？", "举一个“" + c.key + "”的例子", "孔子为什么重视“" + c.key + "”？"]
    };
  }

  function answerOfPerson(p) {
    return {
      title: p.name + (p.zi ? " · 字" + p.zi : ""),
      lead: p.role,
      body:
        "<h4>" + esc(p.name) + " · " + esc(p.role) + "</h4>" +
        "<p>" + esc(p.desc) + "</p>" +
        '<div class="ai-point"><b>代表言论</b><span class="ai-quote">“' + esc(p.quote || "") + "”</span></div>" +
        '<p class="small muted" style="margin-top:12px">提示：孔门弟子性格各异，孔子对同一问题的回答常因材而异。读相关章句时，注意看他是在对谁说。</p>',
      ids: p.ids.slice(0, 4),
      srcTitle: "相关章句",
      follow: ["孔子最欣赏哪个弟子？", p.name + "问过什么问题？", "从" + p.name + "身上能学到什么？"]
    };
  }

  function answerOfPian(p) {
    var list = (byPian[p.id] || []).slice(0, 4);
    return {
      title: p.full + " · 篇旨",
      lead: p.summary,
      body:
        "<h4>" + esc(p.full) + "</h4>" +
        "<p>" + esc(p.summary) + "</p>" +
        '<div class="ai-point"><b>核心命题</b><span>' + esc(p.key) + "</span></div>" +
        '<div class="ai-point"><b>结构脉络</b><span>' + esc(p.flow) + "</span></div>" +
        '<div class="ai-point"><b>阅读建议</b><span>' + esc(p.tip) + "</span></div>" +
        '<p class="small muted" style="margin-top:12px">原书共 ' + p.chapters + " 章，本站精讲 " + (byPian[p.id] || []).length + " 章。<a href='#/pian/" + p.id + "' style='color:var(--seal)'>查看全篇 →</a></p>",
      ids: list.map(function (z) { return z.id; }),
      srcTitle: "开篇几章",
      follow: ["“" + p.name + "”篇最著名的是哪一章？", "“" + p.theme[0] + "”在《论语》里怎么讲？"]
    };
  }

  function answerOfQuote(z, quoteText) {
    return {
      title: "找到了：" + refLabel(z.id),
      lead: "这句话出自《论语·" + pianById[z.p].name + "》第" + z.p + "." + z.n + "章" + (z.excerpt ? "（节选）" : "") + "。",
      body:
        "<h4>" + esc(refLabel(z.id)) + "</h4>" +
        '<p class="ai-quote" style="font-family:var(--serif);font-size:16.5px;line-height:1.95">“' + esc(z.t) + "”</p>" +
        '<div class="ai-point"><b>白话</b><span>' + esc(z.tr) + "</span></div>" +
        '<div class="ai-point"><b>要点</b><span>' + esc(z.idea) + "</span></div>",
      ids: [z.id],
      srcTitle: "原文出处",
      follow: ["这一章的字词怎么解？", "《" + pianById[z.p].name + "》篇主要讲什么？", "还有类似的句子吗？"]
    };
  }

  function answerOfCompare(c) {
    if (c.mixed) {
      return {
        title: "「" + c.a + "」与「" + c.b + "」",
        lead: "这两个概念分属不同层面，直接对比容易失真。先分别看它们的核心定义：",
        body: "<h4>" + esc(c.a) + " / " + esc(c.b) + "</h4>" +
          '<div class="ai-point"><b>' + esc(c.a) + "</b><span>" + esc(c.c1.def) + "</span></div>" +
          '<div class="ai-point"><b>' + esc(c.b) + "</b><span>" + esc(c.c2.def) + "</span></div>" +
          '<p class="small muted" style="margin-top:12px">' + esc(c.note) + "</p>",
        ids: [c.c1.ids[0], c.c2.ids[0]],
        srcTitle: "分别阅读",
        follow: ["“" + c.a + "”具体怎么做？", "“" + c.b + "”最关键的一章是哪一章？"]
      };
    }
    var rows = c.rows.map(function (r) {
      return "<tr><td style='color:var(--ink-4);white-space:nowrap;padding:8px 12px 8px 0;font-size:12.5px'>" + esc(r.dim) +
        "</td><td style='padding:8px 12px 8px 0;font-size:13.5px'>" + esc(r.a) +
        "</td><td style='padding:8px 0;font-size:13.5px'>" + esc(r.b) + "</td></tr>";
    }).join("");
    return {
      title: c.a + " 与 " + c.b + " 的区别",
      lead: c.note,
      body: "<h4>" + esc(c.a) + " 与 " + esc(c.b) + "</h4>" +
        '<table style="width:100%;border-collapse:collapse;margin:6px 0 4px">' +
          "<thead><tr><th style='text-align:left;font-size:11px;color:var(--ink-4);font-weight:500;padding-bottom:4px'>维度</th>" +
          "<th style='text-align:left;font-size:11px;color:var(--ink-4);font-weight:500;padding-bottom:4px'>" + esc(c.a) + "</th>" +
          "<th style='text-align:left;font-size:11px;color:var(--ink-4);font-weight:500;padding-bottom:4px'>" + esc(c.b) + "</th></tr></thead>" +
          "<tbody>" + rows + "</tbody></table>" +
        '<p class="small muted" style="margin-top:12px">' + esc(c.note) + "</p>",
      ids: c.rows.map(function (r) { return r.id; }).filter(function (id) { return !!zhangById[id]; }).slice(0, 4),
      srcTitle: "依据章句",
      follow: ["君子还有哪些特征？", "“和而不同”怎么理解？"]
    };
  }

  function answerOfSearch(q) {
    var res = searchChapters(q);
    if (!res.list.length) {
      return {
        title: "暂时没有直接匹配",
        lead: "站内精讲内容中没有找到与「" + q + "」直接对应的章句。",
        body: "<h4>可以换个问法</h4><p>试着用更短的关键词，或换成《论语》中的常用概念，例如：仁、礼、孝、君子、为政、中庸。</p>" +
          '<p class="small muted">也可以直接<a href="#/search?q=' + encodeURIComponent(q) + '" style="color:var(--seal)">在原文检索中查看</a>，或浏览二十篇目录。</p>',
        ids: [],
        follow: ASK_SUGGEST.slice(0, 3)
      };
    }
    var top = res.list.slice(0, 3).map(function (it) { return it.z; });
    var body = "<h4>检索到 " + res.list.length + " 条相关章句</h4><p>与「" + esc(q) + "」最贴近的是下面 " + top.length + " 条：</p>" +
      top.map(function (z) {
        return '<div class="ai-point" style="flex-direction:column;gap:4px"><b style="font-size:12px">' + esc(shortRef(z)) + "</b>" +
          '<span class="ai-quote">“' + esc(z.t) + "”</span>" +
          '<span class="small" style="color:var(--ink-3)">' + esc(z.tr) + "</span></div>";
      }).join("") + '<p class="small muted" style="margin-top:12px">以上为原文与白话的检索结果。若想看系统性的概念解释，可问“什么是" + esc((res.terms[0] || q).slice(0, 6)) + "”。</p>';
    return {
      title: "关于「" + q + "」的检索结果",
      lead: "已按相关度从全本 " + FULL_TOTAL + " 章中匹配。",
      body: body,
      ids: top.map(function (z) { return z.id; }),
      srcTitle: "原文出处",
      follow: ["“" + (res.terms[0] || "仁") + "”是什么意思？", "把这几章对比一下", "还有别的相关章句吗？"]
    };
  }

  function renderAnswer(a) {
    return '<div class="ai-body">' +
      "<h4>" + esc(a.title) + "</h4>" +
      "<p>" + esc(a.lead) + "</p>" +
      (a.body || "") +
      (a.ids && a.ids.length
        ? '<div class="ai-src-label">' + esc(a.srcTitle || "原文出处") + "</div><div class='ai-srcs'>" +
          a.ids.map(function (id) {
            var z = zhangById[id];
            if (!z) return "";
            return '<div class="ai-src" data-goto="' + id + '"><span class="ref">' + esc(z.p + "." + z.n) + '</span><span class="t">' + esc(z.t) + "</span></div>";
          }).join("") + "</div>"
        : "") +
      (a.follow && a.follow.length
        ? '<div class="ai-foot">' + a.follow.slice(0, 2).map(function (f) {
            return '<button class="btn" data-ask="' + esc(f) + '">' + esc(f) + "</button>";
          }).join("") + "</div>"
        : "") +
      "</div>";
  }

  /* ---------- 进度 ---------- */
  function viewProgress(view) {
    var learned = learnedCount();
    var readCount = Object.keys(store.read).length;
    var favs = favList();
    var notes = noteList();

    var counts = {};
    function bump(ts) {
      var d = new Date(ts);
      var k = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
      counts[k] = (counts[k] || 0) + 1;
    }
    Object.keys(store.learned).forEach(function (id) { bump(store.learned[id]); });
    Object.keys(store.read).forEach(function (id) { bump(store.read[id]); });

    function dayKey(offset) {
      var d = new Date();
      d.setDate(d.getDate() - offset);
      return { k: d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(), d: d };
    }

    var streak = 0;
    var from = counts[dayKey(0).k] ? 0 : (counts[dayKey(1).k] ? 1 : -1);
    if (from >= 0) {
      for (var s = from; ; s++) {
        if (counts[dayKey(s).k]) streak++;
        else break;
      }
    }

    var due = Object.keys(store.learned)
      .filter(function (id) { return zhangById[id] && Date.now() - store.learned[id] > 3 * 86400000; })
      .sort(function (a, b) { return store.learned[a] - store.learned[b]; })
      .slice(0, 4)
      .map(function (id) { return zhangById[id]; });

    var R = 72, C = 2 * Math.PI * R;
    var pv = pct(learned, TOTAL);

    view.innerHTML =
      '<div class="page-head">' +
        '<div class="eyebrow">Your Progress</div>' +
        '<h1 class="page-title">学习进度</h1>' +
        '<p class="page-sub">记录只保存在本机浏览器，不上传。标记已学、阅读原文、收藏章句、写下笔记，都会自动汇总。</p>' +
      "</div>" +
      '<div class="stat-grid">' +
        '<div class="card stat-card"><b>' + learned + "</b><span>精讲已学</span></div>" +
        '<div class="card stat-card"><b>' + readCount + "</b><span>全本阅读</span></div>" +
        '<div class="card stat-card"><b>' + streak + "</b><span>连续学习（天）</span></div>" +
        '<div class="card stat-card"><b>' + favs.length + "</b><span>收藏 / 笔记 " + notes.length + "</span></div>" +
      "</div>" +

      '<div class="progress-main">' +
        '<div class="card ring-card">' +
          '<div class="ring-wrap"><svg viewBox="0 0 170 170">' +
            '<circle cx="85" cy="85" r="' + R + '" fill="none" stroke="rgba(34,31,26,.08)" stroke-width="9"/>' +
            '<circle cx="85" cy="85" r="' + R + '" fill="none" stroke="#a13a2e" stroke-width="9" stroke-linecap="round" ' +
              'stroke-dasharray="' + C + '" stroke-dashoffset="' + (C * (1 - pv / 100)) + '"/>' +
          "</svg><div class='ring-val'><b>" + pv + "%</b><span>" + learned + " / " + TOTAL + " 章</span></div></div>" +
          '<div class="small muted" style="margin-top:10px">精讲完成度 · 全本 ' + FULL_TOTAL + " 章</div>" +
        "</div>" +
        '<div class="card bars-card">' +
          '<div class="section-head" style="margin-bottom:8px"><h3 style="font-family:var(--serif);font-size:15px;margin:0">按篇进度</h3>' +
            '<span class="small muted">' + PIAN.length + " 篇</span></div>" +
          PIAN.map(function (p) {
            var all = byPian[p.id] || [];
            var dn = learnedCount(p.id);
            return '<div class="bar-row"><span class="nm">' + esc(p.name) + '</span>' +
              '<span class="bar"><span style="width:' + pct(dn, all.length) + '%"></span></span>' +
              '<span class="num">' + dn + "/" + all.length + "</span></div>";
          }).join("") +
        "</div>" +
      "</div>" +

      (due.length
        ? '<section class="section"><div class="section-head"><h2 class="section-title">建议复习</h2>' +
          '<span class="section-more">标记已学超过 3 天</span></div>' +
          '<div class="card list-simple">' + due.map(function (z) {
            return '<div class="list-row" data-goto="' + z.id + '"><span class="ref">' + esc(z.p + "." + z.n) + '</span><span class="t">' + esc(z.t) + "</span></div>";
          }).join("") + "</div></section>"
        : "") +

      '<section class="section">' +
        '<div class="section-head"><h2 class="section-title">我的收藏</h2><span class="section-more">' + favs.length + " 章</span></div>" +
        (favs.length
          ? '<div class="card list-simple">' + favs.map(function (z) {
              return '<div class="list-row" data-goto="' + z.id + '"><span class="ref">' + esc(z.p + "." + z.n) + '</span><span class="t">' + esc(z.t) + "</span></div>";
            }).join("") + "</div>"
          : '<div class="card empty">' + icon("star") + "<div>还没有收藏。读到喜欢的章句，点「收藏」即可。</div></div>") +
      "</section>" +

      '<section class="section">' +
        '<div class="section-head"><h2 class="section-title">我的笔记</h2><span class="section-more">' + notes.length + " 条</span></div>" +
        (notes.length
          ? '<div class="card list-simple">' + notes.map(function (z) {
              return '<div class="list-row" data-goto="' + z.id + '"><span class="ref">' + esc(z.p + "." + z.n) + '</span><span class="t">' + esc(z.t.slice(0, 30)) + "…<em>" + esc((store.notes[z.id].text || "").slice(0, 50)) + "</em></span></div>";
            }).join("") + "</div>"
          : '<div class="card empty">' + icon("pen") + "<div>还没有笔记。每章右上角可以随手记下你的理解。</div></div>") +
      "</section>" +

      '<section class="section" style="display:flex;gap:10px;flex-wrap:wrap">' +
        '<button class="btn" id="exportData">' + icon("arrow") + " 导出学习数据</button>" +
        '<button class="btn" id="resetData" style="color:var(--ink-4)">清空本机学习数据</button>' +
      "</section>";
  }

  /* ---------- 关于 ---------- */
  function viewAbout(view) {
    view.innerHTML =
      '<a class="back-link" href="#/home">' + icon("back") + " 返回首页</a>" +
      '<div class="page-head">' +
        '<div class="eyebrow">About This Project</div>' +
        '<h1 class="page-title">产品说明与内容标准</h1>' +
        '<p class="page-sub">这不是一个“全知”的国学机器人，而是一台对准《论语》的阅读工具：范围有限，出处可查，语言尽量说人话。</p>' +
      "</div>" +

      '<div class="about-block card"><h3><span class="n">01</span>核心定位</h3>' +
        "<p>专注儒家经典《论语》的学习工具。不做泛国学问答，不扩展到其他典籍，把有限的内容做准、做透、说得明白。</p>" +
        '<div class="about-grid"><div>' +
          '<div class="kv"><b>做什么</b><span>全本原文阅读、原文检索、章句精讲、篇旨概括、自然语言问答、学习进度记录</span></div>' +
          '<div class="kv"><b>不做什么</b><span>不讲玄学，不做占卜命理，不对经典作政治化引申</span></div>' +
        "</div><div>" +
          '<div class="kv"><b>面向谁</b><span>第一次系统读《论语》的初学者、需要备课的中小学教师、想随手查阅出处的普通读者</span></div>' +
          '<div class="kv"><b>主要形态</b><span>手机与电脑均可访问的网页 Demo，无需安装</span></div>' +
        "</div></div>" +
      "</div>" +

      '<div class="about-block card"><h3><span class="n">02</span>核心功能</h3><ul>' +
        "<li><strong>原文检索与注释</strong>：按字词、主题、篇名联合检索，命中处高亮，标明篇次章次；每章附字词注释。</li>" +
        "<li><strong>全本原文</strong>：二十篇 " + FULL_TOTAL + " 章逐章收录，可按篇连读、逐章前后切换，并参与全文检索。</li>" +
        "<li><strong>章句精讲</strong>：原文、白话译文、字词注释、思想要点四件套，共 " + TOTAL + " 章，覆盖全部二十篇。</li>" +
        "<li><strong>篇旨与思想概括</strong>：每篇给出篇旨、核心命题、结构脉络与阅读建议，帮助先看森林再看树。</li>" +
        "<li><strong>自然语言问答</strong>：识别概念、人物、篇旨、原文出处、概念对比五类意图，回答附原文出处。</li>" +
        "<li><strong>学习进度记录</strong>：标记已学、收藏、笔记，按篇统计完成度，数据仅存本机。</li>" +
      "</ul></div>" +

      '<div class="about-block card"><h3><span class="n">03</span>内容质量标准</h3>' +
        "<p>这是本产品最在意的一条。宁可少讲，不讲错的。</p><ul>" +
        "<li><strong>底本公开</strong>：《论语》原文属公有领域，依通行本录入，不作改动；凡节选均明确标注“节选”。</li>" +
        "<li><strong>注译自撰</strong>：白话译文、字词注释、思想要点为平台自行撰写，参考历代注疏的通行理解，<strong>不转录任何现代注本</strong>，规避版权风险。</li>" +
        "<li><strong>歧解并存</strong>：历代理解不一致处标注“一说”，呈现分歧而不强行统一，例如“无友不如己者”。</li>" +
        "<li><strong>通俗但不庸俗</strong>：面向初学者，先给白话再给术语；不使用鸡汤化、成功学化的改写。</li>" +
        "<li><strong>出处可溯</strong>：问答与检索的每条结论都指向具体章句，可一键跳转核对原文。</li>" +
      "</ul></div>" +

      '<div class="about-block card"><h3><span class="n">04</span>使用流程</h3>' +
        '<div class="kv"><b>想读</b><span>从「篇目」进入，先读篇旨，再逐章看原文与译文</span></div>' +
        '<div class="kv"><b>想查</b><span>在「检索」输入字词或主题，结果按相关度排序并高亮</span></div>' +
        '<div class="kv"><b>想问</b><span>在「问答」直接用日常语言提问，回答会先给结论，再列原文依据</span></div>' +
        '<div class="kv"><b>想记</b><span>每章可标记已学、收藏、写笔记，进度页按篇汇总</span></div>' +
      "</div>" +

      '<div class="about-block card"><h3><span class="n">05</span>技术实现</h3>' +
        '<div class="kv"><b>形态</b><span>纯前端单页应用，原生 JavaScript，无框架、无后端依赖，双击即可打开</span></div>' +
        '<div class="kv"><b>检索</b><span>启动时预构建全文索引（原文 / 译文 / 注释 / 标签 / 篇旨），查询为纯内存匹配，响应通常在 10ms 内</span></div>' +
        '<div class="kv"><b>匹配</b><span>多维加权打分：标签命中 &gt; 原文命中 &gt; 译文命中 &gt; 注释命中，并做同义词扩展（如“信任 → 信”）</span></div>' +
        '<div class="kv"><b>问答</b><span>规则式意图识别 + 检索兜底，避免生成式模型常见的“编造出处”</span></div>' +
        '<div class="kv"><b>存储</b><span>localStorage 本地保存学习数据，无账号、无上传</span></div>' +
        '<div class="kv"><b>适配</b><span>桌面侧栏 / 移动底栏两套布局；手机与电脑浏览器均可使用</span></div>' +
      "</div>" +

      '<div class="about-block card"><h3><span class="n">06</span>Demo 边界</h3>' +
        "<p>本 Demo 已收录二十篇全部 " + FULL_TOTAL + " 章原文；其中 " + TOTAL + " 章完成精讲（译文、注释、要点），其余章节标注“暂未精讲”，仍可阅读、检索与标记已学。问答能力限定在精讲语料之内，不做超出语料的推断。</p>" +
        '<p class="small muted">如果你发现原文录入或注释有误，欢迎指出——对经典，认真比对是基本礼貌。</p>' +
      "</div>";
  }

  /* ---------- 全局事件 ---------- */
  function onDocClick(e) {
    var askBtn = e.target.closest("[data-ask]");
    if (askBtn && askHandler) {
      askHandler(askBtn.getAttribute("data-ask"));
      return;
    }
    var noteItem = e.target.closest(".note-item");
    if (noteItem) {
      var word = noteItem.getAttribute("data-w") || "";
      var qt = document.querySelector(".quote-text");
      if (qt && word) {
        var src = qt.getAttribute("data-src") || "";
        var all = document.querySelectorAll(".note-item.active");
        for (var ai = 0; ai < all.length; ai++) all[ai].classList.remove("active");
        if (qt.getAttribute("data-hl") === word) {
          qt.innerHTML = esc(src);
          qt.removeAttribute("data-hl");
        } else {
          var safeWord = esc(word);
          qt.innerHTML = esc(src).split(safeWord).join('<mark class="hl">' + safeWord + "</mark>");
          qt.setAttribute("data-hl", word);
          noteItem.classList.add("active");
        }
      }
      return;
    }
    var goto = e.target.closest("[data-goto]");
    if (goto) {
      location.hash = "#/zhang/" + goto.getAttribute("data-goto");
      return;
    }
    var learn = e.target.closest("[data-learn]");
    if (learn) {
      var id = learn.getAttribute("data-learn");
      if (store.learned[id]) { delete store.learned[id]; toast("已取消标记"); }
      else { store.learned[id] = Date.now(); store.last = id; toast("已标记为已学"); }
      save();
      viewZhang($("#view"), id);
      buildNav();
      return;
    }
    var fav = e.target.closest("[data-fav]");
    if (fav) {
      var fid = fav.getAttribute("data-fav");
      if (store.fav[fid]) { delete store.fav[fid]; toast("已取消收藏"); }
      else { store.fav[fid] = Date.now(); toast("已加入收藏"); }
      save();
      viewZhang($("#view"), fid);
      buildNav();
      return;
    }
    var noteBtn = e.target.closest("[data-note]");
    if (noteBtn) {
      var nid = noteBtn.getAttribute("data-note");
      var box = $(".note-editor");
      if (box) { box.classList.toggle("open"); return; }
      var wrap = document.createElement("div");
      wrap.className = "note-editor open";
      wrap.style.marginTop = "14px";
      wrap.innerHTML = '<textarea data-note-input="' + nid + '" placeholder="写下你对这一章的理解、疑问或联想…">' +
        esc(store.notes[nid] ? (store.notes[nid].text || "") : "") + "</textarea>" +
        '<div class="note-editor-foot"><button class="btn" data-note-cancel="1">收起</button>' +
        '<button class="btn primary" data-note-save="' + nid + '">保存笔记</button></div>';
      var blocks = document.querySelectorAll(".zhang-wrap .block");
      if (blocks.length) blocks[0].parentNode.insertBefore(wrap, blocks[0]);
      else $(".zhang-wrap").appendChild(wrap);
      return;
    }
    if (e.target.closest("[data-note-cancel]")) {
      var ed = $(".note-editor");
      if (ed) {
        var ta = $("[data-note-input]", ed);
        if (ta && !ta.value.trim()) ed.classList.remove("open");
        else ed.classList.remove("open");
      }
      return;
    }
    var saveNote = e.target.closest("[data-note-save]");
    if (saveNote) {
      var sid = saveNote.getAttribute("data-note-save");
      var ta2 = document.querySelector('[data-note-input="' + sid + '"]');
      var val = ta2 ? ta2.value.trim() : "";
      if (val) { store.notes[sid] = { text: val, t: Date.now() }; toast("笔记已保存"); }
      else { delete store.notes[sid]; toast("空笔记已清除"); }
      save();
      viewZhang($("#view"), sid);
      buildNav();
      return;
    }
    var exp = e.target.closest("#exportData");
    if (exp) {
      var payload = {
        app: "论语助学",
        exportedAt: new Date().toISOString(),
        learned: store.learned,
        read: store.read,
        fav: store.fav,
        notes: store.notes
      };
      var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "lunyu-zhuxue-progress.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
      toast("已导出学习数据");
      return;
    }
    var reset = e.target.closest("#resetData");
    if (reset) {
      if (window.confirm("确定清空本机的学习记录、收藏与笔记吗？此操作不可恢复。")) {
        store = { learned: {}, fav: {}, notes: {}, read: {}, last: null, hist: [] };
        save();
        router();
        toast("已清空");
      }
    }
  }

  /* ---------- 新手引导 ---------- */
  var GUIDE_KEY = "zhuxue.lunyu.guide.v1";
  var guideStep = 0;
  var guideEl = null;

  function guideSeen() {
    try { return localStorage.getItem(GUIDE_KEY) === "1"; } catch (e) { return true; }
  }
  function markGuideSeen() {
    try { localStorage.setItem(GUIDE_KEY, "1"); } catch (e) { /* ignore */ }
  }

  var GUIDE_STEPS = [
    {
      no: "壹",
      title: "读原文，也读精讲",
      text: "「篇目」收录全本 " + FULL_TOTAL + " 章原文，其中 " + TOTAL + " 章配有白话译文、字词注释与要点；首页每天推荐一章，点开即可开始。"
    },
    {
      no: "贰",
      title: "检索与问答",
      text: "「检索」可按字词或原句片段查找，支持限定篇目、只看精讲；「问答」用自然语言提问，比如“什么是仁”，回答都会给出原文出处。"
    },
    {
      no: "叁",
      title: "留下你的学习记录",
      text: "每章都能标记已学、收藏、写笔记；「进度」页自动汇总完成度与连续学习天数。数据只保存在本机浏览器，不会上传。"
    }
  ];

  function updateGuide() {
    if (!guideEl) return;
    var s = GUIDE_STEPS[guideStep];
    guideEl.querySelector(".guide-step-wrap").innerHTML =
      '<div class="guide-no">' + s.no + "</div>" +
      '<div class="guide-txt"><h3>' + s.title + "</h3><p>" + s.text + "</p></div>";
    var dots = guideEl.querySelectorAll(".guide-dot");
    for (var i = 0; i < dots.length; i++) {
      dots[i].className = "guide-dot" + (i === guideStep ? " on" : "");
    }
    guideEl.querySelector("#guidePrev").style.visibility = guideStep === 0 ? "hidden" : "visible";
    guideEl.querySelector("#guideNext").textContent = guideStep === GUIDE_STEPS.length - 1 ? "开始使用" : "下一步";
  }

  function closeGuide() {
    markGuideSeen();
    if (!guideEl) return;
    var el = guideEl;
    guideEl = null;
    el.classList.remove("show");
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 240);
  }

  function openGuide() {
    if (guideEl || guideSeen()) return;
    guideStep = 0;
    var mask = document.createElement("div");
    mask.className = "guide-mask";
    mask.setAttribute("role", "dialog");
    mask.setAttribute("aria-modal", "true");
    mask.setAttribute("aria-label", "新手引导");
    mask.innerHTML =
      '<div class="guide-card">' +
        '<button class="guide-close" type="button" aria-label="关闭">' + icon("close") + "</button>" +
        '<div class="guide-eyebrow">首次使用 · 功能速览</div>' +
        '<h2 class="guide-title">三步用好《论语》</h2>' +
        '<div class="guide-step-wrap"></div>' +
        '<div class="guide-dots">' + GUIDE_STEPS.map(function () { return '<i class="guide-dot"></i>'; }).join("") + "</div>" +
        '<div class="guide-foot">' +
          '<button class="guide-skip" type="button">跳过</button>' +
          '<div class="guide-actions">' +
            '<button class="btn" type="button" id="guidePrev">上一步</button>' +
            '<button class="btn primary" type="button" id="guideNext">下一步</button>' +
          "</div>" +
        "</div>" +
      "</div>";
    mask.addEventListener("click", function (e) {
      if (e.target === mask || e.target.closest(".guide-close") || e.target.closest(".guide-skip")) {
        closeGuide();
        return;
      }
      if (e.target.closest("#guidePrev")) {
        if (guideStep > 0) { guideStep--; updateGuide(); }
        return;
      }
      if (e.target.closest("#guideNext")) {
        if (guideStep < GUIDE_STEPS.length - 1) { guideStep++; updateGuide(); }
        else closeGuide();
      }
    });
    document.body.appendChild(mask);
    guideEl = mask;
    updateGuide();
    setTimeout(function () { mask.classList.add("show"); }, 20);
  }

  function onKeyDown(e) {
    if (e.key === "Escape") {
      if (guideEl) { closeGuide(); return; }
      var ed = $(".note-editor.open");
      if (ed) ed.classList.remove("open");
    }
  }

  /* 测试入口：供 Node 单元测试读取纯逻辑；浏览器中同样可用，不影响页面行为 */
  if (typeof window !== "undefined") {
    window.LX = {
      PIAN: PIAN,
      ZHANG: ZHANG,
      FULLTEXT: FULLTEXT,
      TOTAL: TOTAL,
      FULL_TOTAL: FULL_TOTAL,
      zhangById: zhangById,
      pianById: pianById,
      store: store,
      learnedCount: learnedCount,
      tokenize: tokenize,
      searchChapters: searchChapters,
      stripPunct: stripPunct,
      findByFragment: findByFragment,
      detectConcept: detectConcept,
      detectPerson: detectPerson,
      detectPian: detectPian,
      detectCompare: detectCompare,
      answerQuestion: answerQuestion
    };
  }

  if (typeof document !== "undefined" && typeof window !== "undefined" && window.addEventListener) {
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("hashchange", router);
    buildNav();
    router();
    if (!guideSeen()) setTimeout(openGuide, 420);
  }
})();
