/* ============================================================
   Pricing — Front · vanilla JS
   ============================================================ */

// ---------- Config ----------

const API_URL = "https://pricing-9khk.onrender.com";

const ZONE_ICONS = {
  standard:   "🚗",
  xl:         "🚛",
  disabled:   "♿",
  electric:   "⚡",
  two_wheels: "🏍️",
};

const ZONE_LABELS = {
  standard:   "Standard",
  xl:         "XL",
  disabled:   "Handicapé",
  electric:   "Électrique",
  two_wheels: "2 roues",
};

const MODE_LABELS = {
  walk_in:  "Walk-in",
  reserved: "Réservation",
};

const MAX_DURATION_MIN = 10_080;

// ---------- Utils ----------

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function formatEUR(amount) {
  const n = Number(amount);
  if (Number.isNaN(n)) return "—";
  return n.toFixed(2);
}

/**
 * Interprète une date ISO renvoyée par l'API comme UTC.
 * SQLite stocke des datetimes naïfs — sans "Z", JS les lirait en local.
 * On ajoute donc "Z" quand le fuseau est absent.
 */
function formatDate(iso) {
  if (!iso) return "—";
  const hasTz = /Z$|[+-]\d{2}:?\d{2}$/.test(iso);
  const utcIso = hasTz ? iso : iso + "Z";
  const d = new Date(utcIso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function zoneIcon(zone)  { return ZONE_ICONS[zone]  ?? "•"; }
function zoneLabel(zone) { return ZONE_LABELS[zone] ?? zone; }
function modeLabel(mode) { return MODE_LABELS[mode] ?? mode; }

// ---------- Toast ----------

function toast(kind, title, message) {
  const stack = $("#toastStack");
  const el = document.createElement("div");
  el.className = `toast toast-${kind}`;
  el.innerHTML = `<p class="toast-title">${title}</p><p class="toast-msg"></p>`;
  el.querySelector(".toast-msg").textContent = message;
  stack.appendChild(el);
  setTimeout(() => {
    el.style.transition = "opacity 0.3s";
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 300);
  }, 4200);
}

const toastOk  = (msg) => toast("success", "Succès", msg);
const toastErr = (msg) => toast("error", "Erreur", msg);

// ---------- API client ----------

const api = {
  async request(path, { method = "GET", body, admin = false } = {}) {
    const headers = { "Accept": "application/json" };
    if (body) headers["Content-Type"] = "application/json";
    if (admin) {
      const token = localStorage.getItem("adminToken") || "";
      if (!token) throw new Error("Jeton administrateur manquant.");
      headers["X-Admin-Token"] = token;
    }
    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const msg = data?.message || data?.detail?.message || `HTTP ${res.status}`;
      const err = new Error(msg);
      err.code = data?.code || data?.detail?.code || "HTTP_ERROR";
      err.status = res.status;
      throw err;
    }
    return data;
  },

  health:          ()               => api.request("/health"),
  currentGrid:     ()               => api.request("/grids/current"),
  listGrids:       ()               => api.request("/grids"),
  listRates:       ()               => api.request("/rates"),
  freePeriod:      ()               => api.request("/settings/free-period"),
  computeQuote:    (body)           => api.request("/quote",             { method: "POST", body }),
  getQuote:        (id)             => api.request(`/quotes/${id}`),
  updateRate:      (zone, mode, b)  => api.request(`/rates/${zone}/${mode}`, { method: "PATCH", body: b, admin: true }),
  createRate:      (body)           => api.request("/rates",             { method: "POST", body, admin: true }),
  updateFreePeriod:(body)           => api.request("/settings/free-period", { method: "PATCH", body, admin: true }),
};

// ---------- Health check ----------

async function checkHealth() {
  const dot = $(".status-dot", $("#apiStatus"));
  const label = $(".status-label", $("#apiStatus"));
  try {
    await api.health();
    dot.classList.remove("is-down");
    dot.classList.add("is-up");
    label.textContent = "API en ligne";
  } catch (_) {
    dot.classList.remove("is-up");
    dot.classList.add("is-down");
    label.textContent = "API hors ligne";
  }
}

// ---------- Router (tabs) ----------

function showView(name) {
  $$(".view").forEach(v => v.hidden = v.dataset.view !== name);
  $$(".tab").forEach(t => t.setAttribute("aria-selected", t.dataset.viewLink === name ? "true" : "false"));
  if (name === "grille")     loadGrilleView();
  if (name === "simulateur") loadSimZones();
  if (name === "admin")      loadAdminView();
  if (name === "docs")       loadDocsView();
}

function initRouter() {
  document.addEventListener("click", (e) => {
    const link = e.target.closest("[data-view-link]");
    if (!link) return;
    e.preventDefault();
    showView(link.dataset.viewLink);
  });
  showView("grille");
}

// ---------- Vue Grille ----------

let CURRENT_GRID = null;

async function loadGrilleView() {
  const body = $("#grilleBody");
  body.innerHTML = `<div class="loading">Chargement…</div>`;
  try {
    const grid = await api.currentGrid();
    CURRENT_GRID = grid;

    $("#grilleVersion").textContent    = `v${grid.version}`;
    $("#grilleFreePeriod").textContent = `${grid.free_period_min} min`;
    $("#grilleSince").textContent      = formatDate(grid.effective_from);

    const byZone = new Map();
    for (const r of grid.rates) {
      if (!byZone.has(r.zone)) byZone.set(r.zone, { reserved: null, walk_in: null });
      byZone.get(r.zone)[r.mode] = r.hourly_rate_eur;
    }

    if (byZone.size === 0) {
      body.innerHTML = `<div class="empty">Aucun tarif défini.</div>`;
      return;
    }

    body.innerHTML = [...byZone.entries()].map(([zone, prices]) => `
      <div class="board-row" role="row">
        <div class="board-cell board-cell-zone" role="cell">
          <span class="zone-icon" aria-hidden="true">${zoneIcon(zone)}</span>
          <span>${zoneLabel(zone)}</span>
        </div>
        <div class="board-cell board-cell-price" role="cell">
          ${prices.reserved != null
            ? `<span class="price-value">${formatEUR(prices.reserved)}</span>`
            : `<span class="price-missing">—</span>`}
        </div>
        <div class="board-cell board-cell-price" role="cell">
          ${prices.walk_in != null
            ? `<span class="price-value">${formatEUR(prices.walk_in)}</span>`
            : `<span class="price-missing">—</span>`}
        </div>
      </div>
    `).join("");
  } catch (err) {
    body.innerHTML = `<div class="empty">Impossible de charger la grille : ${err.message}</div>`;
  }
}

// ---------- Vue Simulateur ----------

async function loadSimZones() {
  const sel = $("#simZone");
  if (sel.dataset.loaded === "1") return;
  try {
    if (!CURRENT_GRID) CURRENT_GRID = await api.currentGrid();
    const zones = [...new Set(CURRENT_GRID.rates.map(r => r.zone))].sort();
    sel.innerHTML = `<option value="">— choisir —</option>` +
      zones.map(z => `<option value="${z}">${zoneIcon(z)}  ${zoneLabel(z)}</option>`).join("");
    sel.dataset.loaded = "1";
  } catch (err) {
    toastErr(`Zones : ${err.message}`);
  }
}

function currentMode() {
  return $$('input[name="mode"]').find(r => r.checked)?.value || "walk_in";
}

function updateSimHints() {
  const mode = currentMode();
  const modeHint = $("#modeHint");
  const durationHint = $("#durationHint");
  const minutesInput = $("#simMinutes");

  if (mode === "reserved") {
    modeHint.textContent = "Facturation à l'heure pleine. La gratuité initiale ne s'applique pas.";
    durationHint.textContent = "Multiple d'une heure. Max 168 h (7 j).";
    minutesInput.value = 0;
    minutesInput.disabled = true;
  } else {
    modeHint.textContent = "Facturation au quart d'heure entamé, période de gratuité initiale déduite.";
    durationHint.textContent = "Max 7 jours (168 h).";
    minutesInput.disabled = false;
  }
}

function readDurationMinutes() {
  const days = Number($("#simDays").value) || 0;
  const hours = Number($("#simHours").value) || 0;
  const minutes = Number($("#simMinutes").value) || 0;
  return days * 24 * 60 + hours * 60 + minutes;
}

async function submitSim(e) {
  e.preventDefault();
  const btn = $("#simSubmit");
  const zone = $("#simZone").value;
  const mode = currentMode();
  const duration_min = readDurationMinutes();

  if (!zone) { toastErr("Choisissez une zone."); return; }
  if (!Number.isFinite(duration_min) || duration_min <= 0) {
    toastErr("La durée doit être supérieure à zéro."); return;
  }
  if (duration_min > MAX_DURATION_MIN) {
    toastErr(`La durée maximum est de 168 heures.`); return;
  }
  if (mode === "reserved" && duration_min % 60 !== 0) {
    toastErr("Le mode réservation exige un nombre entier d'heures."); return;
  }

  btn.disabled = true;
  btn.textContent = "Calcul…";
  try {
    const quote = await api.computeQuote({ zone, mode, duration_min });
    renderTicket(quote);
    toastOk(`Devis émis pour ${formatEUR(quote.amount_eur)} €`);
  } catch (err) {
    toastErr(`${err.code || "ERR"} : ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = "Calculer";
  }
}

function renderTicket(quote) {
  $("#ticketAmount").textContent = formatEUR(quote.amount_eur);
  const details = $("#ticketDetails");
  const b = quote.breakdown || {};
  const rows = [
    ["Zone",           `${zoneIcon(b.zone)} ${zoneLabel(b.zone)}`],
    ["Mode",           modeLabel(b.mode)],
    ["Durée",          `${b.duration_min} min`],
  ];
  if (b.free_min != null)         rows.push(["Gratuité",      `${b.free_min} min`]);
  if (b.billable_min != null)     rows.push(["Facturable",    `${b.billable_min} min`]);
  if (b.quarters != null)         rows.push(["Quarts d'h",    b.quarters]);
  if (b.hours != null)            rows.push(["Heures",        b.hours]);
  if (b.hourly_rate_eur != null)  rows.push(["Tarif horaire", `${formatEUR(b.hourly_rate_eur)} €`]);
  rows.push(["Grille",            `v${quote.grid_version ?? "?"}`]);

  details.innerHTML = rows
    .map(([dt, dd]) => `<div class="ticket-row"><dt>${dt}</dt><dd>${dd}</dd></div>`)
    .join("");
  $("#ticketQuoteId").textContent = `Devis ${quote.quote_id}`;
}

// ---------- Vue Admin ----------

async function loadAdminView() {
  const tokenInput = $("#adminToken");
  tokenInput.value = localStorage.getItem("adminToken") || "";

  try {
    if (!CURRENT_GRID) CURRENT_GRID = await api.currentGrid();
    const zones = [...new Set(CURRENT_GRID.rates.map(r => r.zone))].sort();
    $("#updZone").innerHTML = zones.map(z => `<option value="${z}">${z}</option>`).join("");
    $("#updFree").value = CURRENT_GRID.free_period_min;
  } catch (err) {
    toastErr(err.message);
  }

  await refreshGridsTable();
}

async function refreshGridsTable() {
  const tbody = $("#gridsTable tbody");
  tbody.innerHTML = `<tr><td colspan="5" class="loading">Chargement…</td></tr>`;
  try {
    const grids = await api.listGrids();
    tbody.innerHTML = grids.map(g => `
      <tr>
        <td>v${g.version}</td>
        <td>${g.effective_to == null
          ? `<span class="badge-active">Active</span>`
          : `<span class="badge-closed">Fermée</span>`}</td>
        <td>${formatDate(g.effective_from)}</td>
        <td>${g.effective_to ? formatDate(g.effective_to) : "—"}</td>
        <td>${g.id}</td>
      </tr>
    `).join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty">${err.message}</td></tr>`;
  }
}

function initAdminForms() {
  $("#adminToken").addEventListener("input", (e) => {
    localStorage.setItem("adminToken", e.target.value);
  });

  $("#tokenClear").addEventListener("click", () => {
    $("#adminToken").value = "";
    localStorage.removeItem("adminToken");
    toastOk("Jeton effacé.");
  });

  $("#updateRateForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const zone = $("#updZone").value;
    const mode = $("#updMode").value;
    const rate = $("#updRate").value;
    if (!rate || Number(rate) <= 0) { toastErr("Tarif invalide."); return; }
    try {
      const g = await api.updateRate(zone, mode, { hourly_rate_eur: rate });
      CURRENT_GRID = g;
      toastOk(`Nouvelle grille v${g.version} publiée.`);
      await refreshGridsTable();
    } catch (err) {
      toastErr(`${err.code || "ERR"} : ${err.message}`);
    }
  });

  $("#updateFreeForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const free_period_min = Number($("#updFree").value);
    if (!Number.isFinite(free_period_min) || free_period_min < 0) {
      toastErr("Durée invalide."); return;
    }
    try {
      const res = await api.updateFreePeriod({ free_period_min });
      toastOk(`Gratuité mise à jour, grille v${res.grid_version}.`);
      CURRENT_GRID = await api.currentGrid();
      await refreshGridsTable();
    } catch (err) {
      toastErr(`${err.code || "ERR"} : ${err.message}`);
    }
  });

  $("#createRateForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const zone = $("#newZone").value.trim();
    const mode = $("#newMode").value;
    const rate = $("#newRate").value;
    if (!zone) { toastErr("Zone requise."); return; }
    if (!rate || Number(rate) <= 0) { toastErr("Tarif invalide."); return; }
    try {
      const g = await api.createRate({ zone, mode, hourly_rate_eur: rate });
      CURRENT_GRID = g;
      toastOk(`Zone "${zone}/${mode}" créée dans grille v${g.version}.`);
      $("#newZone").value = "";
      $("#newRate").value = "";
      await refreshGridsTable();
      const zones = [...new Set(g.rates.map(r => r.zone))].sort();
      $("#updZone").innerHTML = zones.map(z => `<option value="${z}">${z}</option>`).join("");
    } catch (err) {
      toastErr(`${err.code || "ERR"} : ${err.message}`);
    }
  });

  $("#lookupQuoteForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = $("#lookupQuoteId").value.trim();
    const out = $("#quoteLookupOut");
    out.textContent = "";
    if (!id) { toastErr("ID requis."); return; }
    try {
      const q = await api.getQuote(id);
      out.textContent = JSON.stringify(q, null, 2);
    } catch (err) {
      out.textContent = "";
      toastErr(`${err.code || "ERR"} : ${err.message}`);
    }
  });
}

// ---------- Vue Documentation ----------

function loadDocsView() {
  const set = (id, path) => {
    const el = $(id);
    if (el) el.href = `${API_URL}${path}`;
  };
  set("#docsSwaggerBtn",  "/docs");
  set("#docsSwaggerCard", "/docs");
  set("#docsRedocCard",   "/redoc");
  set("#docsOpenapiCard", "/openapi.json");

  const baseLink = $("#apiBaseLink");
  if (baseLink) {
    baseLink.href = API_URL;
    baseLink.textContent = API_URL;
  }
}

function initDocsCopy() {
  const btn = $("#apiUrlCopy");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(API_URL);
      const original = btn.textContent;
      btn.textContent = "Copié ✓";
      setTimeout(() => (btn.textContent = original), 1500);
    } catch (_) {
      toastErr("Impossible de copier.");
    }
  });
}

// ---------- Theme toggle ----------

function initTheme() {
  const saved = localStorage.getItem("theme");
  // Thème clair par défaut ; la préférence OS n'est plus consultée.
  // On force explicitement "light" tant que l'utilisateur n'a pas choisi.
  document.documentElement.setAttribute("data-theme", saved === "dark" ? "dark" : "light");
  $("#themeToggle").addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  });
}

// ---------- Boot ----------

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initRouter();
  initAdminForms();
  initDocsCopy();
  $("#simForm").addEventListener("submit", submitSim);
  $$('input[name="mode"]').forEach(r => r.addEventListener("change", updateSimHints));
  updateSimHints();
  checkHealth();
  setInterval(checkHealth, 30_000);
});
