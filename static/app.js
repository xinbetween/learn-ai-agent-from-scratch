/* Build an AI Agent From Scratch — client runtime.
   No dependencies. Handles theme, nav, TOC scrollspy, search, quizzes,
   progress, copy buttons, and registration of per-chapter labs. */
(function () {
  "use strict";

  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  /* ---------------- theme ---------------- */
  var THEME_KEY = "agentcourse.theme";
  var THEME_ICON = {
    system: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.4" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 3.6a8.4 8.4 0 0 1 0 16.8z" fill="currentColor"/></svg>',
    light: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2.2M12 19.2v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.6 12h2.2M19.2 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/></svg>',
    dark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.2A8.4 8.4 0 0 1 9.8 4a8.4 8.4 0 1 0 10.2 10.2z"/></svg>'
  };
  function applyTheme(t) {
    var root = document.documentElement;
    if (t === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", t);
  }
  function initTheme() {
    applyTheme(LS.get(THEME_KEY, "system"));
    var btn = document.getElementById("theme-btn");
    if (!btn) return;
    function paint(t) {
      btn.innerHTML = THEME_ICON[t] || THEME_ICON.system;
      btn.setAttribute("title", "Theme: " + t);
      btn.setAttribute("aria-label", "Theme: " + t + ". Click to change.");
    }
    btn.addEventListener("click", function () {
      var order = ["system", "light", "dark"];
      var cur = LS.get(THEME_KEY, "system");
      var next = order[(order.indexOf(cur) + 1) % 3];
      LS.set(THEME_KEY, next);
      applyTheme(next);
      paint(next);
    });
    paint(LS.get(THEME_KEY, "system"));
  }

  /* ---------------- nav placeholders (socials, language) ---------------- */
  function initPlaceholders() {
    document.querySelectorAll("[data-placeholder]").forEach(function (el) {
      el.addEventListener("click", function (e) { e.preventDefault(); });
    });
  }

  /* ---------------- mobile sidebar ---------------- */
  function initNav() {
    var side = document.querySelector(".sidebar");
    var scrim = document.querySelector(".scrim");
    var tog = document.getElementById("nav-toggle");
    if (!tog || !side) return;
    function set(open) {
      side.setAttribute("data-open", open ? "true" : "false");
      if (scrim) scrim.setAttribute("data-open", open ? "true" : "false");
    }
    tog.addEventListener("click", function () { set(side.getAttribute("data-open") !== "true"); });
    if (scrim) scrim.addEventListener("click", function () { set(false); });
    side.addEventListener("click", function (e) { if (e.target.closest("a")) set(false); });
  }

  /* ---------------- copy buttons ---------------- */
  function initCopy() {
    document.querySelectorAll(".copy").forEach(function (b) {
      b.addEventListener("click", function () {
        var pre = b.closest(".code").querySelector("pre");
        var txt = pre ? pre.innerText : "";
        var done = function () { var o = b.textContent; b.textContent = "copied"; setTimeout(function () { b.textContent = o; }, 1200); };
        if (navigator.clipboard) navigator.clipboard.writeText(txt).then(done, done);
        else done();
      });
    });
  }

  /* ---------------- on-this-page scrollspy ---------------- */
  function initSpy() {
    var links = Array.prototype.slice.call(document.querySelectorAll(".rail a[data-spy]"));
    if (!links.length) return;
    var targets = links.map(function (l) { return document.getElementById(l.getAttribute("href").slice(1)); }).filter(Boolean);
    function upd() {
      var y = window.scrollY + 140, best = 0;
      targets.forEach(function (t, i) { if (t.offsetTop <= y) best = i; });
      links.forEach(function (l, i) { l.classList.toggle("active", i === best); });
    }
    window.addEventListener("scroll", upd, { passive: true });
    upd();
  }

  /* ---------------- progress ---------------- */
  var PROG_KEY = "agentcourse.progress";
  function getProg() { return LS.get(PROG_KEY, {}); }
  function markVisited(id) { if (!id) return; var p = getProg(); if (!p[id]) p[id] = {}; p[id].seen = true; LS.set(PROG_KEY, p); }
  function markQuiz(id, score, total) { var p = getProg(); if (!p[id]) p[id] = {}; p[id].quiz = [score, total]; LS.set(PROG_KEY, p); }
  function initProgress() {
    var id = document.body.getAttribute("data-chapter");
    if (id) markVisited(id);
    var p = getProg();
    document.querySelectorAll(".side-link[data-ch]").forEach(function (a) {
      var c = a.getAttribute("data-ch");
      if (p[c] && p[c].quiz && p[c].quiz[0] >= Math.ceil(p[c].quiz[1] * 0.7)) a.classList.add("done");
    });
    var box = document.getElementById("prog-box");
    if (box) {
      var total = parseInt(box.getAttribute("data-total") || "0", 10);
      var seen = 0, mastered = 0;
      Object.keys(p).forEach(function (k) {
        if (p[k].seen) seen++;
        if (p[k].quiz && p[k].quiz[0] >= Math.ceil(p[k].quiz[1] * 0.7)) mastered++;
      });
      var m = box.querySelector(".meter > i");
      if (m) m.style.width = (total ? (mastered / total) * 100 : 0).toFixed(1) + "%";
      var n = box.querySelector(".pn2");
      if (n) n.textContent = mastered + " / " + total + " chapters passed · " + seen + " opened";
    }
    var reset = document.getElementById("prog-reset");
    if (reset) reset.addEventListener("click", function () { LS.set(PROG_KEY, {}); location.reload(); });
  }

  /* ---------------- quiz engine ---------------- */
  function initQuiz() {
    var root = document.querySelector("[data-quiz]");
    if (!root) return;
    var data;
    try { data = JSON.parse(document.getElementById("quiz-data").textContent); } catch (e) { return; }
    var chId = document.body.getAttribute("data-chapter");
    var i = 0, score = 0, answered = false;

    var qn = root.querySelector(".qnum"), qtot = root.querySelector(".qtot");
    var qtext = root.querySelector(".qtext"), qopts = root.querySelector(".qopts");
    var qexp = root.querySelector(".qexp"), scoreEl = root.querySelector(".score");
    var nextBtn = root.querySelector(".q-next"), againBtn = root.querySelector(".q-again");
    if (qtot) qtot.textContent = String(data.length);

    function render() {
      answered = false;
      var q = data[i];
      qn.textContent = String(i + 1);
      qtext.textContent = q.q;
      qopts.innerHTML = "";
      qexp.style.display = "none";
      nextBtn.disabled = true;
      nextBtn.textContent = i === data.length - 1 ? "See result" : "Next question";
      q.options.forEach(function (opt, k) {
        var b = document.createElement("button");
        b.type = "button"; b.className = "qopt";
        b.innerHTML = '<span class="k">' + "ABCD"[k] + "</span><span></span>";
        b.lastChild.textContent = opt;
        b.addEventListener("click", function () { choose(k); });
        qopts.appendChild(b);
      });
      scoreEl.textContent = score + " / " + data.length;
    }

    function choose(k) {
      if (answered) return;
      answered = true;
      var q = data[i];
      var btns = qopts.querySelectorAll(".qopt");
      btns.forEach(function (b, n) {
        b.disabled = true;
        if (n === q.answer) b.setAttribute("data-state", "right");
        else if (n === k) b.setAttribute("data-state", "wrong");
      });
      if (k === q.answer) score++;
      qexp.style.display = "block";
      qexp.innerHTML = "<b>" + (k === q.answer ? "Correct." : "Not quite.") + "</b> ";
      qexp.appendChild(document.createTextNode(q.why));
      scoreEl.textContent = score + " / " + data.length;
      nextBtn.disabled = false;
    }

    nextBtn.addEventListener("click", function () {
      if (i < data.length - 1) { i++; render(); }
      else {
        markQuiz(chId, score, data.length);
        var pct = Math.round((score / data.length) * 100);
        qtext.textContent = "Result: " + score + " of " + data.length + " (" + pct + "%)";
        qopts.innerHTML = "";
        qexp.style.display = "block";
        qexp.innerHTML = "<b>" + (pct >= 70 ? "Chapter passed." : "Worth another pass.") + "</b> " +
          (pct >= 70 ? "The sidebar marks this chapter complete. Continue to the next one."
                     : "Re-read the sections behind the questions you missed, then retake.");
        nextBtn.disabled = true;
        againBtn.style.display = "inline-block";
      }
    });
    againBtn.addEventListener("click", function () { i = 0; score = 0; againBtn.style.display = "none"; render(); });
    render();
  }

  /* ---------------- search ---------------- */
  function initSearch() {
    var ov = document.getElementById("search-ov");
    if (!ov) return;
    var input = ov.querySelector("input"), res = ov.querySelector(".search-res");
    var idx = window.__SEARCH_INDEX__ || [];
    var sel = 0, cur = [];

    function open() { ov.setAttribute("data-open", "true"); input.value = ""; draw(idx.slice(0, 12)); input.focus(); }
    function close() { ov.setAttribute("data-open", "false"); }
    function draw(items) {
      cur = items; sel = 0;
      if (!items.length) { res.innerHTML = '<div class="search-empty">No matches.</div>'; return; }
      res.innerHTML = items.map(function (it, n) {
        return '<a href="' + it.u + '" class="' + (n === 0 ? "sel" : "") + '">' +
          '<span class="rid">' + it.i + '</span> <span class="rt">' + it.t + "</span>" +
          '<div class="rs">' + it.s + "</div></a>";
      }).join("");
    }
    function score(it, q) {
      var hay = (it.i + " " + it.t + " " + it.s + " " + (it.k || "")).toLowerCase();
      if (hay.indexOf(q) === -1) return 0;
      var s = 1;
      if (it.t.toLowerCase().indexOf(q) !== -1) s += 4;
      if (it.i.toLowerCase().indexOf(q) === 0) s += 6;
      return s;
    }
    input.addEventListener("input", function () {
      var q = input.value.trim().toLowerCase();
      if (!q) return draw(idx.slice(0, 12));
      draw(idx.map(function (it) { return [score(it, q), it]; })
        .filter(function (p) { return p[0] > 0; })
        .sort(function (a, b) { return b[0] - a[0]; })
        .slice(0, 14).map(function (p) { return p[1]; }));
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Escape") return close();
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        sel = Math.max(0, Math.min(cur.length - 1, sel + (e.key === "ArrowDown" ? 1 : -1)));
        res.querySelectorAll("a").forEach(function (a, n) { a.classList.toggle("sel", n === sel); });
        var el = res.querySelectorAll("a")[sel]; if (el) el.scrollIntoView({ block: "nearest" });
      }
      if (e.key === "Enter") { var a = res.querySelectorAll("a")[sel]; if (a) location.href = a.getAttribute("href"); }
    });
    ov.addEventListener("click", function (e) { if (e.target === ov) close(); });
    var btn = document.getElementById("search-btn");
    if (btn) btn.addEventListener("click", open);
    document.addEventListener("keydown", function (e) {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && document.activeElement === document.body)) {
        e.preventDefault(); open();
      }
    });
  }

  /* ---------------- lab registry ---------------- */
  /* Adopt anything the head stub queued before this file arrived, then take
     over registration. Same array either way, so initLabs() sees all of it. */
  var labs = window.__labs || [];
  window.registerLab = function (fn) { labs.push(fn); };
  function initLabs() {
    labs.forEach(function (fn) { try { fn(); } catch (e) { console.error("lab failed", e); } });
  }

  /* ---------------- deterministic RNG (shared by labs) ---------------- */
  window.mulberry32 = function (a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  function boot() {
    initTheme(); initNav(); initCopy(); initSpy();
    initProgress(); initQuiz(); initSearch(); initPlaceholders(); initLabs();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
