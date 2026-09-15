/* Better Than Yesterday — local data store (plain JS, browser storage) */
(function (global) {
  "use strict";

  var USERS_KEY = "bty_users";
  var SESSION_KEY = "bty_session";
  var LAST_USER_KEY = "bty_last_user";
  var USER_ID_RE = /^[a-zA-Z0-9._-]{3,32}$/;

  var HABIT_COLORS = ["cyan", "purple", "emerald", "orange", "pink"];
  var STATUS_CYCLE = ["completed", "partial", "skipped", "missed"];
  var STATUS_META = {
    completed: { label: "Completed", short: "✓", color: "var(--neon-emerald)" },
    partial: { label: "Partial", short: "◐", color: "var(--neon-orange)" },
    skipped: { label: "Skipped", short: "–", color: "var(--neon-purple)" },
    missed: { label: "Missed", short: "✕", color: "var(--destructive)" },
  };

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  async function hash(text) {
    var bytes = new TextEncoder().encode("bty::" + text);
    var digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map(function (b) {
        return b.toString(16).padStart(2, "0");
      })
      .join("");
  }

  function uid() {
    return "h" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function toDateKey(d) {
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  }
  function daysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
  }
  function colorVar(color) {
    return "var(--neon-" + (HABIT_COLORS.indexOf(color) >= 0 ? color : "cyan") + ")";
  }

  function users() {
    return read(USERS_KEY, {});
  }

  function dataKey(userId) {
    return "bty_data_" + userId;
  }

  function starterHabits() {
    var seed = [
      { name: "Morning Workout", emoji: "🏋️", color: "cyan", category: "Fitness", target_value: 45, target_unit: "min" },
      { name: "Read 20 Pages", emoji: "📚", color: "purple", category: "Learning", target_value: 20, target_unit: "pages" },
      { name: "Deep Work", emoji: "🎯", color: "emerald", category: "Work", target_value: 2, target_unit: "hours" },
      { name: "Drink Water", emoji: "💧", color: "orange", category: "Health", target_value: 3, target_unit: "litres" },
      { name: "Sleep by 11 PM", emoji: "😴", color: "pink", category: "Health", target_value: 8, target_unit: "hours" },
    ];
    return seed.map(function (h, i) {
      return {
        id: uid(),
        name: h.name,
        emoji: h.emoji,
        color: h.color,
        category: h.category,
        priority: "medium",
        difficulty: "medium",
        target_value: h.target_value,
        target_unit: h.target_unit,
        reminder_time: "",
        sort_order: i,
        archived: false,
      };
    });
  }

  var Store = {
    USER_ID_RE: USER_ID_RE,
    HABIT_COLORS: HABIT_COLORS,
    STATUS_CYCLE: STATUS_CYCLE,
    STATUS_META: STATUS_META,
    toDateKey: toDateKey,
    daysInMonth: daysInMonth,
    colorVar: colorVar,
    uid: uid,

    lastUser: function () {
      return localStorage.getItem(LAST_USER_KEY) || "";
    },
    rememberUser: function (userId, on) {
      if (on) localStorage.setItem(LAST_USER_KEY, userId);
      else localStorage.removeItem(LAST_USER_KEY);
    },

    async register(form) {
      var id = String(form.userId || "").trim().toLowerCase();
      if (!USER_ID_RE.test(id))
        throw new Error("User ID must be 3–32 characters (letters, numbers, . _ -).");
      if (String(form.password).length < 8) throw new Error("Password must be at least 8 characters.");
      if (form.password !== form.confirm) throw new Error("Passwords do not match.");
      var all = users();
      if (all[id]) throw new Error("That User ID is already taken.");
      all[id] = {
        userId: id,
        fullName: String(form.fullName || "").trim(),
        username: String(form.username || "").trim(),
        email: String(form.email || "").trim(),
        pass: await hash(form.password),
        created_at: new Date().toISOString(),
      };
      write(USERS_KEY, all);
      write(dataKey(id), { habits: starterHabits(), logs: {} });
      localStorage.setItem(SESSION_KEY, id);
      return all[id];
    },

    async login(userId, password) {
      var id = String(userId || "").trim().toLowerCase();
      var account = users()[id];
      if (!account) throw new Error("No account found with that User ID.");
      if (account.pass !== (await hash(password))) throw new Error("Incorrect User ID or password.");
      localStorage.setItem(SESSION_KEY, id);
      return account;
    },

    currentUser: function () {
      var id = localStorage.getItem(SESSION_KEY);
      return id ? users()[id] || null : null;
    },

    signOut: function () {
      localStorage.removeItem(SESSION_KEY);
    },

    data: function () {
      var user = Store.currentUser();
      if (!user) return { habits: [], logs: {} };
      return read(dataKey(user.userId), { habits: [], logs: {} });
    },

    save: function (data) {
      var user = Store.currentUser();
      if (!user) return;
      write(dataKey(user.userId), data);
    },

    habits: function (includeArchived) {
      var list = Store.data().habits.slice().sort(function (a, b) {
        return a.sort_order - b.sort_order;
      });
      return includeArchived ? list : list.filter(function (h) { return !h.archived; });
    },

    saveHabit: function (habit) {
      var data = Store.data();
      if (habit.id) {
        data.habits = data.habits.map(function (h) {
          return h.id === habit.id ? Object.assign({}, h, habit) : h;
        });
      } else {
        data.habits.push(
          Object.assign(
            {
              id: uid(),
              emoji: "✅",
              color: "cyan",
              category: "General",
              priority: "medium",
              difficulty: "medium",
              target_value: 1,
              target_unit: "times",
              reminder_time: "",
              sort_order: data.habits.length,
              archived: false,
            },
            habit,
          ),
        );
      }
      Store.save(data);
    },

    deleteHabit: function (id) {
      var data = Store.data();
      data.habits = data.habits.filter(function (h) { return h.id !== id; });
      Object.keys(data.logs).forEach(function (k) {
        if (k.indexOf(id + "|") === 0) delete data.logs[k];
      });
      Store.save(data);
    },

    logFor: function (habitId, date) {
      return Store.data().logs[habitId + "|" + date] || null;
    },

    setLog: function (habitId, date, status, note) {
      var data = Store.data();
      var key = habitId + "|" + date;
      if (!status) {
        delete data.logs[key];
      } else {
        var prev = data.logs[key] || {};
        data.logs[key] = {
          status: status,
          note: note !== undefined ? note : prev.note || "",
          progress: status === "completed" ? 100 : status === "partial" ? 50 : 0,
        };
      }
      Store.save(data);
    },

    logList: function () {
      var logs = Store.data().logs;
      return Object.keys(logs).map(function (k) {
        var parts = k.split("|");
        return {
          habit_id: parts[0],
          log_date: parts[1],
          status: logs[k].status,
          note: logs[k].note,
          progress: logs[k].progress,
        };
      });
    },

    nextStatus: function (current) {
      if (!current) return "completed";
      var i = STATUS_CYCLE.indexOf(current);
      return i === STATUS_CYCLE.length - 1 ? null : STATUS_CYCLE[i + 1];
    },

    computeStreak: function (logs, habitCount) {
      if (!habitCount) return { current: 0, longest: 0 };
      var byDate = {};
      logs.forEach(function (l) {
        if (l.status !== "completed") return;
        byDate[l.log_date] = (byDate[l.log_date] || 0) + 1;
      });
      var dates = Object.keys(byDate).sort();
      var longest = 0;
      var run = 0;
      var prev = null;
      dates.forEach(function (d) {
        var full = byDate[d] >= Math.ceil(habitCount * 0.6);
        if (!full) { run = 0; prev = d; return; }
        if (prev && byDate[prev] >= Math.ceil(habitCount * 0.6)) {
          var diff = (new Date(d) - new Date(prev)) / 86400000;
          run = diff === 1 ? run + 1 : 1;
        } else {
          run = 1;
        }
        longest = Math.max(longest, run);
        prev = d;
      });

      var current = 0;
      var cursor = new Date();
      for (var i = 0; i < 400; i++) {
        var key = toDateKey(cursor);
        var done = byDate[key] || 0;
        if (done >= Math.ceil(habitCount * 0.6)) {
          current++;
        } else if (i > 0 || done === 0) {
          break;
        }
        cursor.setDate(cursor.getDate() - 1);
      }
      return { current: current, longest: Math.max(longest, current) };
    },
  };

  global.Store = Store;
})(window);
