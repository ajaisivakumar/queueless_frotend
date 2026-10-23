// 👉 After deploying the backend on Render, put its URL here (keep "/api" at the end)
const API = " https://queueless-backend-hdh8.onrender.com/api";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function call(path, method = "GET", body) {
  const res = await fetch(API + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function setConn(state, text) {
  const c = $("conn");
  c.className = "conn " + state;
  c.textContent = text;
}

// ---------- tabs ----------
document.querySelectorAll(".tab").forEach((btn) => {
  btn.onclick = () => {
    document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    $(btn.dataset.tab).classList.add("active");
    loadAll();
  };
});

// ---------- dashboard ----------
async function loadDashboard() {
  const [counters, queue] = await Promise.all([call("/counters"), call("/queue")]);

  $("counters").innerHTML = counters.length
    ? counters.map((c) => `
      <div class="box">
        <h3>${esc(c.counter_name)}</h3>
        <span class="tag ${c.status}">${c.status}</span>
        <div>${c.serving_name ? `Serving: <b>#${c.serving_number} ${esc(c.serving_name)}</b>` : "No one being served"}</div>
        <div class="actions">
          ${c.status === "FREE"
            ? `<button class="small green" onclick="act('/counters/${c.counter_id}/serve')">Call Next</button>`
            : `<button class="small" onclick="act('/counters/${c.counter_id}/complete')">Complete</button>`}
          <button class="small red" onclick="delCounter(${c.counter_id})">Delete</button>
        </div>
      </div>`).join("")
    : `<div class="empty">No counters yet. Add one below.</div>`;

  $("avgInfo").textContent = `Average service time: ${queue.avgServiceMinutes} min`;
  $("waitingBody").innerHTML = queue.waiting.length
    ? queue.waiting.map((w) => `
      <tr>
        <td><b>#${w.queue_number}</b></td>
        <td>${esc(w.customer_name)}</td>
        <td>${esc(w.joined)}</td>
        <td>${w.position}</td>
        <td>${w.estimatedWait} min</td>
        <td><button class="small red" onclick="act('/customers/${w.customer_id}/cancel')">Cancel</button></td>
      </tr>`).join("")
    : `<tr><td colspan="6" class="empty">No customers waiting</td></tr>`;
}

async function act(path) {
  try { await call(path, "POST"); loadAll(); } catch (e) { alert(e.message); }
}

async function addCounter() {
  const name = $("counterName").value.trim();
  if (!name) return alert("Enter a counter name");
  try { await call("/counters", "POST", { name }); $("counterName").value = ""; loadAll(); } catch (e) { alert(e.message); }
}

async function delCounter(id) {
  if (!confirm("Delete this counter?")) return;
  try { await call("/counters/" + id, "DELETE"); loadAll(); } catch (e) { alert(e.message); }
}

// ---------- add customer ----------
async function addCustomer() {
  const name = $("custName").value.trim();
  const phone = $("custPhone").value.trim();
  if (!name) return alert("Enter customer name");
  try {
    const r = await call("/customers", "POST", { name, phone });
    $("addResult").innerHTML = `<div class="result">
      Customer: <b>${esc(r.customer_name)}</b><br>
      Queue Number: <span class="big">#${r.queue_number}</span><br>
      Position: <b>${r.position}</b><br>
      Estimated Wait: <b>${r.estimatedWait} min</b></div>`;
    $("custName").value = ""; $("custPhone").value = "";
  } catch (e) { $("addResult").innerHTML = `<div class="error">${esc(e.message)}</div>`; }
}

// ---------- check status ----------
async function checkStatus() {
  const n = $("statusNo").value;
  if (!n) return alert("Enter your queue number");
  try {
    const r = await call("/status/" + n);
    let html = `Queue Number: <span class="big">#${r.queue_number}</span><br>Name: <b>${esc(r.customer_name)}</b><br>`;
    if (r.status === "WAITING") html += `Status: <b>Waiting</b><br>Position: <b>${r.position}</b><br>Estimated Wait: <b>${r.estimatedWait} min</b>`;
    else if (r.status === "SERVING") html += `Status: <b>Being served</b> at <b>${esc(r.counter_name || "a counter")}</b>`;
    else if (r.status === "DONE") html += `Status: <b>Service completed</b>`;
    else html += `Status: <b>Cancelled</b>`;
    $("statusResult").innerHTML = `<div class="result">${html}</div>`;
  } catch (e) { $("statusResult").innerHTML = `<div class="error">${esc(e.message)}</div>`; }
}

// ---------- report ----------
async function loadReport() {
  const r = await call("/report");
  const items = [
    ["Total Customers", r.totalCustomers], ["Served", r.served],
    ["Waiting", r.waiting], ["Being Served", r.serving],
    ["Avg Service Time (min)", r.avgServiceMinutes],
  ];
  $("reportCards").innerHTML = items.map(([l, v]) =>
    `<div class="box stat"><div class="big">${v}</div><div class="label">${l}</div></div>`).join("");
}

// ---------- refresh ----------
async function loadAll() {
  try {
    const tab = document.querySelector(".panel.active").id;
    if (tab === "dashboard") await loadDashboard();
    if (tab === "report") await loadReport();
    setConn("ok", "online");
  } catch (e) {
    setConn("bad", "server unreachable");
  }
}

loadAll();
setInterval(loadAll, 5000);
