/* Better Than Yesterday — sign in / sign up page behaviour */
(function () {
  "use strict";

  if (Store.currentUser()) {
    window.location.replace("/app/dashboard.html");
    return;
  }

  var tabLogin = document.getElementById("tab-login");
  var tabRegister = document.getElementById("tab-register");
  var loginForm = document.getElementById("login-form");
  var registerForm = document.getElementById("register-form");
  var errorEl = document.getElementById("error");
  var noticeEl = document.getElementById("notice");

  function show(el, text) {
    el.textContent = text;
    el.classList.remove("hide");
  }
  function clearMessages() {
    errorEl.classList.add("hide");
    noticeEl.classList.add("hide");
  }

  function setMode(mode) {
    clearMessages();
    var login = mode === "login";
    tabLogin.classList.toggle("active", login);
    tabRegister.classList.toggle("active", !login);
    loginForm.classList.toggle("hide", !login);
    registerForm.classList.toggle("hide", login);
  }

  tabLogin.addEventListener("click", function () { setMode("login"); });
  tabRegister.addEventListener("click", function () { setMode("register"); });

  document.getElementById("forgot").addEventListener("click", function () {
    show(
      noticeEl,
      "Password recovery is handled by your account owner for now — contact support or create a new account.",
    );
  });

  var loginId = document.getElementById("loginId");
  loginId.value = Store.lastUser();

  loginForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    clearMessages();
    var button = loginForm.querySelector("button[type=submit]");
    button.disabled = true;
    try {
      await Store.login(loginId.value, document.getElementById("loginPw").value);
      Store.rememberUser(loginId.value.trim().toLowerCase(), document.getElementById("remember").checked);
      window.location.href = "/app/dashboard.html";
    } catch (err) {
      show(errorEl, err.message || "Login failed.");
      button.disabled = false;
    }
  });

  registerForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    clearMessages();
    var button = registerForm.querySelector("button[type=submit]");
    button.disabled = true;
    try {
      await Store.register({
        fullName: document.getElementById("fullName").value,
        username: document.getElementById("username").value,
        userId: document.getElementById("userId").value,
        email: document.getElementById("email").value,
        password: document.getElementById("password").value,
        confirm: document.getElementById("confirm").value,
      });
      window.location.href = "/app/dashboard.html";
    } catch (err) {
      show(errorEl, err.message || "Registration failed.");
      button.disabled = false;
    }
  });
})();
