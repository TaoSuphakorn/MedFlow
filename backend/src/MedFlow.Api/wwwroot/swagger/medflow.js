(() => {
  "use strict";
  let sessionChannel = null;
  try {
    if (typeof BroadcastChannel !== "undefined")
      sessionChannel = new BroadcastChannel("medflow.session");
  } catch {
    /* Focus refresh remains available when cross-tab signals are blocked. */
  }
  const announceSessionChange = () => sessionChannel?.postMessage("changed");

  // Normal browser cookies and server antiforgery validation apply to every write.
  window.medflowSwaggerRequest = async (request) => {
    const url = new URL(request.url, window.location.origin);
    if (url.origin !== window.location.origin)
      throw new Error("Only same-origin API requests are allowed.");
    request.credentials = "same-origin";
    if (
      url.pathname.startsWith("/api/") &&
      !["GET", "HEAD", "OPTIONS"].includes(
        (request.method || "GET").toUpperCase(),
      )
    ) {
      const response = await fetch("/api/auth/csrf", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok)
        throw new Error(
          "Unable to obtain a security token. Refresh and try again.",
        );
      const { token } = await response.json();
      request.headers = { ...request.headers, "X-CSRF-TOKEN": token };
    }
    return request;
  };

  async function request(path, method = "GET", body) {
    const config = await window.medflowSwaggerRequest({
      url: path,
      method,
      headers: body ? { "Content-Type": "application/json" } : {},
    });
    const response = await fetch(config.url, {
      method,
      credentials: config.credentials,
      headers: config.headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (
      response.ok &&
      method === "POST" &&
      ["/api/auth/login", "/api/auth/logout"].includes(path)
    )
      announceSessionChange();
    return response;
  }

  document.addEventListener("DOMContentLoaded", () => {
    const target = document.getElementById("swagger-ui");
    if (!target) return;
    const panel = document.createElement("section");
    panel.className = "medflow-session";
    panel.setAttribute("aria-label", "Demo API session");
    panel.innerHTML = `
      <div class="session-heading"><div><span class="session-label">MEDFLOW AI · LOCAL DEMONSTRATION</span><h2>Demo API session</h2></div><span class="session-disclaimer">Portfolio demonstration only. Not for clinical use.</span></div>
      <p>Sign in here, then use Try it out below. Requests use normal role checks, session cookies and automatic CSRF protection.</p>
      <form class="session-form">
        <label>Demo role<select name="role" aria-label="Demo role"><option value="doctor">Doctor</option><option value="nurse">Nurse</option><option value="admin">Administrator</option></select></label>
        <label>Email<input name="email" type="email" autocomplete="username" value="doctor@medflow.demo" required></label>
        <label>Password<input name="password" type="password" autocomplete="current-password" value="Demo!2026" required></label>
        <button type="submit">Sign in to API</button><button type="button" class="session-signout" hidden>Sign out of API</button>
      </form>
      <p class="session-status" role="status" aria-live="polite">Checking session…</p>
      <p class="session-help">Demo credentials are public development defaults. If you configured a different demo password, enter it here. POST /ai can incur charges when a live OpenAI key is configured. Confirming a clinical note still requires an explicit Doctor review.</p>`;
    target.before(panel);
    const form = panel.querySelector("form");
    const status = panel.querySelector(".session-status");
    const signout = panel.querySelector(".session-signout");
    const submit = panel.querySelector("button[type=submit]");
    const role = form.elements.namedItem("role");
    const email = form.elements.namedItem("email");
    const password = form.elements.namedItem("password");
    // The bundled initializer is registered before DOMContentLoaded. Install the
    // interceptor directly after it runs, without evaluating a function string.
    window.addEventListener("load", () => {
      const config = window.ui?.getConfigs?.();
      if (config) {
        config.requestInterceptor = window.medflowSwaggerRequest;
        config.responseInterceptor = async (response) => {
          const url = new URL(response.url || "", window.location.origin);
          if (
            url.origin === window.location.origin &&
            ["/api/auth/login", "/api/auth/logout"].includes(url.pathname) &&
            response.status >= 200 &&
            response.status < 300
          ) {
            await refreshSession();
            announceSessionChange();
          }
          return response;
        };
      }
    });
    role.addEventListener("change", () => {
      email.value = `${role.value}@medflow.demo`;
    });

    let sessionRead = 0;
    async function refreshSession() {
      const currentRead = ++sessionRead;
      const response = await request("/api/auth/me");
      if (currentRead !== sessionRead) return;
      if (response.status === 401) {
        status.textContent = "Not signed in. Choose a demo role to start.";
        signout.hidden = true;
        return;
      }
      if (!response.ok) throw new Error("Unable to read the current session.");
      const user = await response.json();
      status.textContent = `Signed in as ${user.name} · ${user.role} · ${user.aiMode} AI Mode`;
      signout.hidden = false;
    }
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      submit.disabled = true;
      signout.disabled = true;
      try {
        const response = await request("/api/auth/login", "POST", {
          email: email.value,
          password: password.value,
        });
        if (!response.ok)
          throw new Error(
            response.status === 429
              ? "Too many attempts. Wait a minute before signing in again."
              : "Sign-in failed. Check the email and password.",
          );
        password.value = "";
        await refreshSession();
      } catch (error) {
        status.textContent = error.message;
      } finally {
        submit.disabled = false;
        signout.disabled = false;
      }
    });
    signout.addEventListener("click", async () => {
      signout.disabled = true;
      submit.disabled = true;
      try {
        const response = await request("/api/auth/logout", "POST");
        if (!response.ok)
          throw new Error("Unable to sign out. Refresh and try again.");
        await refreshSession();
      } catch (error) {
        status.textContent = error.message;
      } finally {
        signout.disabled = false;
        submit.disabled = false;
      }
    });
    refreshSession().catch(() => {
      status.textContent =
        "Unable to read the current session. Refresh and try again.";
    });
    const refreshOnChange = () =>
      refreshSession().catch(() => {
        status.textContent =
          "Unable to verify the session. Refresh and try again.";
      });
    window.addEventListener("focus", refreshOnChange);
    sessionChannel?.addEventListener("message", (event) => {
      if (event.data === "changed") refreshOnChange();
    });
  });
})();
