/* Better Than Yesterday — dashboard behaviour (plain JS) */
(function () {
  "use strict";

  var user = Store.currentUser();
  if (!user) {
    window.location.replace("/app/index.html");
    return;
  }

  var META = Store.STATUS_META;
  var CYCLE = Store.STATUS_CYCLE;
  var charts = {};

  var QUOTES = [
    "Discipline is choosing what you want most over what you want now.",
    "Small daily improvements are the key to staggering long-term results.",
    "You do not rise to the level of your goals, you fall to the level of your systems.",
    "The pain of discipline weighs ounces, the pain of regret weighs tons.",
    "Consistency compounds. Show up again today.",
    "Win the morning, and the day follows.",
  ];

  var $ = function (id) { return document.getElementById(id); };
  function esc(text) {
    return String(text == null ? "" : text).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  $("user-tag").textContent = "@" + user.userId;
  $("first-name").textContent = (user.fullName || "there").split(" ")[0];
  $("signout").addEventListener("click", function () {
    Store.signOut();
    window.location.replace("/app/index.html");
  });

  /* ---------- clock + greeting ---------- */
  function tick() {
    var now = new Date();
    var hour = now.getHours();
    $("greeting").textContent = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
    $("clock").textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    $("today-date").textContent = now.toLocaleDateString(undefined, {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
    $("quote").textContent = "“" + QUOTES[now.getDate() % QUOTES.length] + "”";
  }
  tick();
  setInterval(tick, 1000);

  /* ---------- render ---------- */
  var today = new Date();
  var year = today.getFullYear();
  var month = today.getMonth();
  var todayKey = Store.toDateKey(today);

  function monthLogsOf(logs) {
    var start = year + "-" + String(month + 1).padStart(2, "0") + "-01";
    var end = year + "-" + String(month + 1).padStart(2, "0") + "-31";
    return logs.filter(function (l) { return l.log_date >= start && l.log_date <= end; });
  }

  function render() {
    var habits = Store.habits(false);
    var all = Store.habits(true);
    var logs = Store.logList();
    var mLogs = monthLogsOf(logs);
    var todayLogs = logs.filter(function (l) { return l.log_date === todayKey; });

    var completedToday = todayLogs.filter(function (l) { return l.status === "completed"; }).length;
    var score = habits.length ? Math.round((completedToday / habits.length) * 100) : 0;
    var streak = Store.computeStreak(logs, habits.length);
    var xp = logs.filter(function (l) { return l.status === "completed"; }).length * 10;
    var level = Math.floor(xp / 500) + 1;

    $("score-pill").textContent = score + "%";
    $("progress-fill").style.width = score + "%";
    $("today-sub").textContent =
      completedToday + " of " + habits.length + " completed · tap a habit to cycle its status";

    renderStats([
      { icon: "🔥", label: "Current Streak", value: streak.current + " days", tone: "orange" },
      { icon: "🏆", label: "Longest Streak", value: streak.longest + " days", tone: "purple" },
      { icon: "⭐", label: "Level", value: "Lv " + level, tone: "cyan" },
      { icon: "📈", label: "XP", value: xp + " XP", tone: "emerald" },
      { icon: "🎯", label: "Productivity Score", value: score + "%", tone: score >= 70 ? "emerald" : score >= 40 ? "orange" : "pink" },
    ]);
    renderHabits(habits, todayLogs);
    renderMonth(habits, mLogs);
    renderArchived(all);
    renderCharts(habits, logs, mLogs);
  }

  function renderStats(items) {
    $("stats").innerHTML = items
      .map(function (s) {
        return (
          '<div class="glass-tile stat"><div class="icon" style="background:color-mix(in oklab, var(--neon-' +
          s.tone +
          ') 18%, transparent);color:var(--neon-' +
          s.tone +
          ')">' +
          s.icon +
          '</div><div style="min-width:0"><p class="label">' +
          esc(s.label) +
          '</p><p class="value">' +
          esc(s.value) +
          "</p></div></div>"
        );
      })
      .join("");
  }

  function renderHabits(habits, todayLogs) {
    var wrap = $("habit-list");
    if (!habits.length) {
      wrap.innerHTML = '<p class="empty">No habits yet. Add your first habit to start the streak.</p>';
      return;
    }
    wrap.innerHTML = habits
      .map(function (h, index) {
        var log = todayLogs.filter(function (l) { return l.habit_id === h.id; })[0];
        var meta = log ? META[log.status] : null;
        var progress = log ? log.progress : 0;
        return (
          '<article class="glass-tile habit" style="border-left:3px solid ' + Store.colorVar(h.color) + '">' +
          '<div class="habit-top">' +
          '<button class="status-btn" data-cycle="' + h.id + '" aria-label="Cycle status for ' + esc(h.name) + '"' +
          (meta
            ? ' style="border-color:' + meta.color + ';color:' + meta.color +
              ';background:color-mix(in oklab, ' + meta.color + ' 20%, transparent)"'
            : "") +
          ">" + (meta ? meta.short : esc(h.emoji)) + "</button>" +
          '<div style="min-width:0;flex:1">' +
          "<h3>" + esc(h.emoji) + " " + esc(h.name) + "</h3>" +
          '<p class="meta">' + esc(h.category) + " · " + esc(h.target_value) + " " + esc(h.target_unit) +
          " · " + esc(h.difficulty) + " · " + esc(h.priority) + " priority" +
          (h.reminder_time ? " · ⏰ " + esc(h.reminder_time) : "") + "</p>" +
          (log && log.note ? '<p class="meta">📝 ' + esc(log.note) + "</p>" : "") +
          '<div class="progress-track" style="margin-top:.6rem;height:.3rem"><div class="progress-fill" style="width:' +
          progress + "%;background:" + Store.colorVar(h.color) + '"></div></div>' +
          "</div>" +
          '<div class="habit-actions">' +
          '<button class="icon-btn" data-note="' + h.id + '" title="Add note">📝</button>' +
          '<button class="icon-btn" data-edit="' + h.id + '" title="Edit">✏️</button>' +
          '<button class="icon-btn" data-duplicate="' + h.id + '" title="Duplicate">⧉</button>' +
          '<button class="icon-btn" data-up="' + h.id + '" title="Move up"' + (index === 0 ? " disabled" : "") + ">↑</button>" +
          '<button class="icon-btn" data-down="' + h.id + '" title="Move down"' + (index === habits.length - 1 ? " disabled" : "") + ">↓</button>" +
          '<button class="icon-btn" data-archive="' + h.id + '" title="Archive">📦</button>' +
          '<button class="icon-btn" data-delete="' + h.id + '" title="Delete">🗑️</button>' +
          "</div></div></article>"
        );
      })
      .join("");
  }

  function renderMonth(habits, logs) {
    $("month-title").textContent =
      "Daily Progress · " + new Date(year, month, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });

    $("legend").innerHTML =
      CYCLE.map(function (s) {
        return '<span><span class="dot" style="background:' + META[s].color + '"></span>' + META[s].label + "</span>";
      }).join("") +
      '<span class="tag" style="color:var(--primary);font-weight:600" id="month-pct"></span>';

    var total = Store.daysInMonth(year, month);
    var days = [];
    for (var d = 1; d <= total; d++) days.push(d);
    var key = function (d) {
      return year + "-" + String(month + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");
    };

    var completedTotal = logs.filter(function (l) { return l.status === "completed"; }).length;
    var possible = habits.length * total;
    var monthPct = possible ? Math.round((completedTotal / possible) * 100) : 0;

    var head =
      '<tr><th class="habit-col">Habit</th>' +
      days.map(function (d) { return "<th>" + d + "</th>"; }).join("") +
      '<th style="text-align:right">%</th></tr>';

    var body = habits
      .map(function (h) {
        var hLogs = logs.filter(function (l) { return l.habit_id === h.id; });
        var done = 0;
        var cells = days
          .map(function (d) {
            var log = hLogs.filter(function (l) { return l.log_date === key(d); })[0];
            var meta = log ? META[log.status] : null;
            if (log && log.status === "completed") done++;
            var style = meta
              ? "border-color:" + meta.color + ";color:" + meta.color +
                ";background:color-mix(in oklab, " + meta.color + " 18%, transparent);box-shadow:0 0 10px color-mix(in oklab, " +
                meta.color + " 45%, transparent)"
              : "";
            return (
              '<td><button class="cell" style="' + style + '" data-cell="' + h.id + "|" + key(d) +
              '" aria-label="' + esc(h.name) + " day " + d + '">' + (meta ? meta.short : "") + "</button></td>"
            );
          })
          .join("");
        return (
          '<tr><td class="habit-col"><span style="color:' + Store.colorVar(h.color) + '">' + esc(h.emoji) +
          "</span> " + esc(h.name) + "</td>" + cells +
          '<td class="pct">' + Math.round((done / total) * 100) + "%</td></tr>"
        );
      })
      .join("");

    $("month-grid").innerHTML = habits.length
      ? '<table class="grid"><thead>' + head + "</thead><tbody>" + body + "</tbody></table>"
      : '<p class="empty">Add a habit to unlock the monthly grid.</p>';
    if ($("month-pct")) $("month-pct").textContent = monthPct + "% month";
  }

  function renderArchived(all) {
    var archived = all.filter(function (h) { return h.archived; });
    $("archived-section").classList.toggle("hide", archived.length === 0);
    $("archived-list").innerHTML = archived
      .map(function (h) {
        return '<button class="chip" data-restore="' + h.id + '">' + esc(h.emoji) + " " + esc(h.name) + " · restore</button>";
      })
      .join("");
  }

  /* ---------- charts ---------- */
  // Chart.js cannot parse oklch()/color-mix(), so charts use hex equivalents of the tokens.
  var HEX = {
    cyan: "#3ad4e6",
    purple: "#a866f0",
    emerald: "#25d6a0",
    orange: "#f2a63a",
    pink: "#f5619f",
    destructive: "#ef5350",
    muted: "#9aa5ba",
    grid: "rgba(255,255,255,0.12)",
  };
  var STATUS_HEX = {
    completed: HEX.emerald,
    partial: HEX.orange,
    skipped: HEX.purple,
    missed: HEX.destructive,
  };
  function habitHex(color) {
    return HEX[color] || HEX.cyan;
  }
  function alpha(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
  }

  function renderCharts(habits, logs, mLogs) {
    if (typeof Chart === "undefined") {
      window.addEventListener("load", function () { renderCharts(habits, logs, mLogs); }, { once: true });
      return;
    }
    var grid = HEX.grid;
    var muted = HEX.muted;
    Chart.defaults.color = muted;
    Chart.defaults.font.family = "Manrope, sans-serif";

    var labels = [];
    var rates = [];
    for (var i = 13; i >= 0; i--) {
      var d = new Date();
      d.setDate(d.getDate() - i);
      var k = Store.toDateKey(d);
      var done = logs.filter(function (l) { return l.log_date === k && l.status === "completed"; }).length;
      labels.push(d.toLocaleDateString(undefined, { day: "numeric", month: "short" }));
      rates.push(habits.length ? Math.round((done / habits.length) * 100) : 0);
    }
    draw("chart-trend", {
      type: "line",
      data: {
        labels: labels,
        datasets: [{
          data: rates,
          borderColor: HEX.cyan,
          backgroundColor: alpha(HEX.cyan, 0.25),
          fill: true, tension: 0.35, borderWidth: 2.5, pointRadius: 2,
        }],
      },
      options: baseOptions(grid, { y: { min: 0, max: 100 } }),
    });

    var ranking = habits
      .map(function (h) {
        return {
          name: h.name.length > 16 ? h.name.slice(0, 15) + "…" : h.name,
          color: habitHex(h.color),
          done: mLogs.filter(function (l) { return l.habit_id === h.id && l.status === "completed"; }).length,
        };
      })
      .sort(function (a, b) { return b.done - a.done; })
      .slice(0, 8);
    draw("chart-ranking", {
      type: "bar",
      data: {
        labels: ranking.map(function (r) { return r.name; }),
        datasets: [{
          data: ranking.map(function (r) { return r.done; }),
          backgroundColor: ranking.map(function (r) { return r.color; }),
          borderRadius: 6,
        }],
      },
      options: baseOptions(grid, { y: { beginAtZero: true, precision: 0 } }),
    });

    var mix = CYCLE.map(function (s) {
      return { name: META[s].label, value: mLogs.filter(function (l) { return l.status === s; }).length, color: STATUS_HEX[s] };
    }).filter(function (s) { return s.value > 0; });
    draw("chart-mix", {
      type: "doughnut",
      data: {
        labels: mix.map(function (m) { return m.name; }),
        datasets: [{ data: mix.map(function (m) { return m.value; }), backgroundColor: mix.map(function (m) { return m.color; }), borderWidth: 0 }],
      },
      options: { responsive: true, maintainAspectRatio: false, cutout: "58%", plugins: { legend: { position: "bottom" } } },
    });

    var byCategory = {};
    habits.forEach(function (h) {
      var entry = byCategory[h.category] || { done: 0, total: 0 };
      entry.done += mLogs.filter(function (l) { return l.habit_id === h.id && l.status === "completed"; }).length;
      entry.total += new Date().getDate();
      byCategory[h.category] = entry;
    });
    var cats = Object.keys(byCategory);
    draw("chart-radar", {
      type: "radar",
      data: {
        labels: cats,
        datasets: [{
          data: cats.map(function (c) {
            var v = byCategory[c];
            return v.total ? Math.round((v.done / v.total) * 100) : 0;
          }),
          borderColor: HEX.purple,
          backgroundColor: alpha(HEX.purple, 0.35),
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { r: { angleLines: { color: grid }, grid: { color: grid }, suggestedMin: 0, suggestedMax: 100, pointLabels: { color: muted } } },
      },
    });
  }

  function baseOptions(grid, scales) {
    var s = { x: { grid: { display: false } }, y: Object.assign({ grid: { color: grid } }, scales.y || {}) };
    s.y.grid = { color: grid };
    return {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: s,
    };
  }

  function draw(id, config) {
    if (charts[id]) charts[id].destroy();
    charts[id] = new Chart(document.getElementById(id), config);
  }

  /* ---------- interactions ---------- */
  document.addEventListener("click", function (e) {
    var t = e.target.closest("button");
    if (!t) return;
    var id;

    if ((id = t.getAttribute("data-cycle"))) {
      var log = Store.logFor(id, todayKey);
      Store.setLog(id, todayKey, Store.nextStatus(log && log.status));
      return render();
    }
    if ((id = t.getAttribute("data-cell"))) {
      var parts = id.split("|");
      var existing = Store.logFor(parts[0], parts[1]);
      Store.setLog(parts[0], parts[1], Store.nextStatus(existing && existing.status));
      return render();
    }
    if ((id = t.getAttribute("data-note"))) {
      var current = Store.logFor(id, todayKey);
      var note = window.prompt("Note for today", (current && current.note) || "");
      if (note === null) return;
      Store.setLog(id, todayKey, (current && current.status) || "partial", note);
      return render();
    }
    if ((id = t.getAttribute("data-edit"))) return openEditor(findHabit(id));
    if ((id = t.getAttribute("data-duplicate"))) {
      var h = findHabit(id);
      Store.saveHabit({
        name: h.name + " (copy)", emoji: h.emoji, color: h.color, category: h.category,
        priority: h.priority, difficulty: h.difficulty, target_value: h.target_value,
        target_unit: h.target_unit, reminder_time: h.reminder_time, sort_order: h.sort_order + 1,
      });
      return render();
    }
    if ((id = t.getAttribute("data-archive"))) { Store.saveHabit({ id: id, archived: true }); return render(); }
    if ((id = t.getAttribute("data-restore"))) { Store.saveHabit({ id: id, archived: false }); return render(); }
    if ((id = t.getAttribute("data-delete"))) {
      if (window.confirm("Delete this habit and its history?")) { Store.deleteHabit(id); render(); }
      return;
    }
    if ((id = t.getAttribute("data-up")) || (id = t.getAttribute("data-down"))) {
      var dir = t.hasAttribute("data-up") ? -1 : 1;
      var list = Store.habits(false);
      var index = list.findIndex(function (x) { return x.id === id; });
      var swap = list[index + dir];
      if (!swap) return;
      var self = list[index];
      Store.saveHabit({ id: self.id, sort_order: swap.sort_order });
      Store.saveHabit({ id: swap.id, sort_order: self.sort_order });
      return render();
    }
  });

  function findHabit(id) {
    return Store.habits(true).filter(function (h) { return h.id === id; })[0];
  }

  $("add-habit").addEventListener("click", function () { openEditor(null); });

  /* ---------- habit editor modal ---------- */
  function openEditor(habit) {
    var h = habit || {
      name: "", emoji: "✅", color: "cyan", category: "General", priority: "medium",
      difficulty: "medium", target_value: 1, target_unit: "times", reminder_time: "",
    };
    var root = $("modal-root");
    root.innerHTML =
      '<div class="modal-backdrop" id="backdrop"><div class="glass-panel modal">' +
      "<h2>" + (habit ? "Edit Habit" : "New Habit") + "</h2>" +
      '<p class="small muted" style="margin-bottom:1.25rem">Everything about this habit is editable.</p>' +
      '<form id="habit-form" class="stack">' +
      '<div class="two-col">' +
      '<div><label class="lbl">Name</label><input class="field" id="f-name" value="' + esc(h.name) + '" required /></div>' +
      '<div><label class="lbl">Emoji</label><input class="field" id="f-emoji" value="' + esc(h.emoji) + '" maxlength="4" /></div>' +
      "</div>" +
      '<div class="two-col">' +
      '<div><label class="lbl">Category</label><input class="field" id="f-category" value="' + esc(h.category) + '" /></div>' +
      '<div><label class="lbl">Reminder time</label><input class="field" id="f-reminder" type="time" value="' + esc(h.reminder_time || "") + '" /></div>' +
      "</div>" +
      '<div class="two-col">' +
      '<div><label class="lbl">Target value</label><input class="field" id="f-target" type="number" min="1" value="' + esc(h.target_value) + '" /></div>' +
      '<div><label class="lbl">Target unit</label><input class="field" id="f-unit" value="' + esc(h.target_unit) + '" /></div>' +
      "</div>" +
      '<div class="two-col">' +
      '<div><label class="lbl">Priority</label><select class="field" id="f-priority">' + opts(["low", "medium", "high"], h.priority) + "</select></div>" +
      '<div><label class="lbl">Difficulty</label><select class="field" id="f-difficulty">' + opts(["easy", "medium", "hard"], h.difficulty) + "</select></div>" +
      "</div>" +
      '<div><label class="lbl">Color</label><div class="chips" id="f-colors">' +
      Store.HABIT_COLORS.map(function (c) {
        return '<button type="button" class="chip' + (c === h.color ? " active" : "") + '" data-color="' + c +
          '" style="color:var(--neon-' + c + ')">' + c + "</button>";
      }).join("") +
      "</div></div>" +
      '<div style="display:flex;gap:.75rem;justify-content:flex-end;padding-top:.5rem">' +
      '<button type="button" class="btn-ghost" id="cancel">Cancel</button>' +
      '<button type="submit" class="btn-neon">Save Habit</button>' +