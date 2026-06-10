// agentpack — the built-in dev UI: pack switcher, example prompts, live agent
// network + chat. Zero build step, served at GET /, vanilla JS over the same
// SSE contract the eval harness uses.
import type { AgentPack } from "./types.js";

export function devUiHtml(packs: AgentPack[]): string {
  const title = packs.length > 1 ? "agentpack" : packs[0].name;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(title)} — agentpack</title>
<script src="https://cdn.jsdelivr.net/npm/marked@12/marked.min.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#0b1020;--panel:#10172e;--line:#1e293b;--txt:#e2e8f0;--dim:#64748b;
  --sup:#fbbf24;--spec:#38bdf8;--tool:#94a3b8;--active:#fbbf24;--visited:#34d399}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:var(--bg);color:var(--txt);min-height:100vh}
.wrap{max-width:1100px;margin:0 auto;padding:28px 20px 60px}
header{display:flex;align-items:baseline;gap:12px;margin-bottom:14px;flex-wrap:wrap}
header h1{font-size:1.4rem}
header .fw{font-size:.75rem;color:var(--dim);border:1px solid var(--line);border-radius:12px;padding:2px 10px}
header .stats{margin-left:auto;font-size:.8rem;color:var(--dim)}
.packbar{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap}
.packtab{border:1.5px solid var(--line);background:var(--panel);color:var(--dim);border-radius:10px;
  padding:8px 16px;font-size:.85rem;cursor:pointer;transition:all .15s}
.packtab:hover{color:var(--txt)}
.packtab.on{border-color:var(--spec);color:var(--spec);font-weight:700}
.packdesc{font-size:.82rem;color:var(--dim);margin-bottom:14px;min-height:1.2em}
.querybar{display:flex;gap:10px;margin-bottom:10px}
.querybar input{flex:1;background:var(--panel);border:1px solid var(--line);border-radius:10px;
  padding:13px 16px;color:var(--txt);font-size:.95rem;outline:none}
.querybar input:focus{border-color:var(--spec)}
.querybar button{background:var(--spec);color:#06203a;font-weight:700;border:none;border-radius:10px;
  padding:0 22px;font-size:.95rem;cursor:pointer}
.querybar button:disabled{opacity:.5;cursor:wait}
.chips{display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap}
.chip{border:1px dashed var(--line);background:transparent;color:var(--dim);border-radius:14px;
  padding:6px 13px;font-size:.76rem;cursor:pointer;max-width:480px;white-space:nowrap;
  overflow:hidden;text-overflow:ellipsis;transition:all .15s;text-align:left}
.chip:hover{color:var(--spec);border-color:var(--spec)}
.net{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:20px;margin-bottom:20px}
.net .head{display:flex;align-items:center;gap:10px;margin-bottom:18px;font-size:.85rem;color:var(--dim)}
.net .head b{color:var(--txt);font-size:1rem}
.net .head .meta{margin-left:auto;display:flex;gap:16px}
.node{border:1.5px solid var(--line);border-radius:9px;padding:7px 13px;font-size:.8rem;text-align:center;
  background:#0d1426;transition:all .25s;position:relative;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.node.sup{border-color:var(--sup);color:var(--sup);font-weight:700;display:inline-block;padding:9px 26px}
.node.spec{border-color:var(--spec);color:var(--spec);font-weight:600}
.node.tool{color:var(--tool);font-size:.72rem}
.node.active{box-shadow:0 0 14px var(--active);border-color:var(--active)!important;color:var(--active)!important}
.node.visited{border-color:var(--visited)!important;color:var(--visited)!important}
.node .badge{position:absolute;top:-7px;right:-4px;background:#f59e0b;color:#111;border-radius:9px;
  font-size:.62rem;font-weight:800;padding:1px 5px;display:none}
.suprow{text-align:center;margin-bottom:22px}
.cols{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:12px}
.col{display:flex;flex-direction:column;gap:8px;min-width:0}
.legend{display:flex;gap:18px;margin-top:16px;font-size:.72rem;color:var(--dim)}
.legend i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:5px;border:1.5px solid}
.feed{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px 20px;margin-bottom:20px;
  max-height:180px;overflow-y:auto;font-size:.82rem;display:none}
.feed div{padding:3px 0;color:var(--dim)}
.feed div.latest{color:var(--txt)}
.answer{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:24px;display:none;line-height:1.65;font-size:.92rem}
.answer h1,.answer h2,.answer h3{margin:18px 0 8px;color:#f1f5f9}.answer h1{font-size:1.2rem}.answer h2{font-size:1.05rem}
.answer p,.answer ul,.answer ol{margin-bottom:10px}.answer li{margin-left:22px}
.answer code{background:#1e293b;border-radius:4px;padding:1px 5px;font-size:.85em}
.answer table{border-collapse:collapse;margin:10px 0}.answer td,.answer th{border:1px solid var(--line);padding:6px 10px;font-size:.85rem}
footer{text-align:center;margin-top:34px;font-size:.75rem;color:var(--dim)}
footer a{color:var(--spec);text-decoration:none}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1 id="title">${esc(title)}</h1>
    <span class="fw">⚡ agentpack</span>
    <span class="stats" id="stats"></span>
  </header>

  <div class="packbar" id="packbar" style="display:none"></div>
  <div class="packdesc" id="packdesc"></div>

  <div class="querybar">
    <input id="q" placeholder="Ask your agent team anything…" autofocus/>
    <button id="go">Run</button>
  </div>
  <div class="chips" id="chips"></div>

  <div class="net">
    <div class="head"><b>Agent Network</b><span id="netsub"></span>
      <span class="meta"><span id="hops"></span><span id="timer"></span></span></div>
    <div class="suprow" id="suprow"></div>
    <div class="cols" id="cols"></div>
    <div class="legend">
      <span><i style="border-color:var(--sup)"></i>supervisor</span>
      <span><i style="border-color:var(--spec)"></i>specialist</span>
      <span><i style="border-color:var(--tool)"></i>tool (zero-token API call)</span>
      <span><i style="border-color:var(--active)"></i>active</span>
      <span><i style="border-color:var(--visited)"></i>visited</span>
    </div>
  </div>

  <div class="feed" id="feed"></div>
  <div class="answer" id="answer"></div>

  <footer>built with <a href="https://github.com/selvaonline/agentpack" target="_blank">agentpack</a> ·
    MCP server live at <code>/mcp</code> · API at <code>/api/run</code></footer>
</div>

<script>
const els = {};
for (const id of ["q","go","suprow","cols","feed","answer","hops","timer","stats","netsub","packbar","packdesc","chips","title"]) els[id] = document.getElementById(id);
let allPacks = [], activePack = null, nodeEls = {}, hopCount = 0, t0 = 0, timerIv = null, running = false;

const pretty = s => s.replace(/[_-]/g," ").replace(/\\b\\w/g, c => c.toUpperCase());

async function init() {
  allPacks = (await (await fetch("/api/packs")).json()).packs;
  if (allPacks.length > 1) {
    els.packbar.style.display = "flex";
    for (const p of allPacks) {
      const b = document.createElement("button");
      b.className = "packtab"; b.textContent = pretty(p.name); b.dataset.pack = p.name;
      b.onclick = () => { if (!running) switchPack(p.name); };
      els.packbar.appendChild(b);
    }
  }
  const saved = sessionStorage.getItem("agentpack-active");
  switchPack(allPacks.some(p => p.name === saved) ? saved : allPacks[0].name);
}

async function switchPack(name) {
  activePack = allPacks.find(p => p.name === name);
  sessionStorage.setItem("agentpack-active", name);
  for (const b of els.packbar.children) b.classList.toggle("on", b.dataset.pack === name);
  els.title.textContent = pretty(name);
  els.packdesc.textContent = activePack.description;
  els.answer.style.display = "none"; els.feed.style.display = "none";
  els.hops.textContent = ""; els.timer.textContent = "";
  renderChips();
  await loadNetwork();
}

function renderChips() {
  els.chips.innerHTML = "";
  for (const ex of (activePack.examples || []).slice(0, 4)) {
    const c = document.createElement("button");
    c.className = "chip"; c.textContent = ex; c.title = ex;
    c.onclick = () => { if (!running) { els.q.value = ex; run(); } };
    els.chips.appendChild(c);
  }
}

async function loadNetwork() {
  const net = await (await fetch("/api/network?pack=" + encodeURIComponent(activePack.name))).json();
  const sup = net.nodes.find(n => n.type === "supervisor");
  const specs = net.nodes.filter(n => n.type === "specialist");
  els.suprow.innerHTML = ""; els.cols.innerHTML = ""; nodeEls = {};
  els.suprow.appendChild(mkNode(sup.id, "sup"));
  for (const s of specs) {
    const col = document.createElement("div"); col.className = "col";
    col.appendChild(mkNode(s.id, "spec"));
    for (const t of net.nodes.filter(n => n.type === "tool" && n.parent === s.id)) col.appendChild(mkNode(t.id, "tool"));
    els.cols.appendChild(col);
  }
  els.netsub.textContent = \`\${specs.length} specialists · \${net.nodes.filter(n=>n.type==="tool").length} tools\`;
  els.stats.textContent = els.netsub.textContent;
}

function mkNode(id, cls) {
  const el = document.createElement("div");
  el.className = "node " + cls;
  el.title = id;
  el.innerHTML = pretty(id) + '<span class="badge"></span>';
  nodeEls[id] = el;
  return el;
}

function setActive(id) {
  for (const el of Object.values(nodeEls)) el.classList.remove("active");
  const el = nodeEls[id];
  if (el) { el.classList.add("active","visited");
    const b = el.querySelector(".badge"); b.textContent = (parseInt(b.textContent||"0")+1); b.style.display="block"; }
}

async function run() {
  const query = els.q.value.trim();
  if (!query || running) return;
  running = true;
  els.go.disabled = true; els.answer.style.display = "none"; els.answer.innerHTML = "";
  els.feed.style.display = "block"; els.feed.innerHTML = "";
  for (const el of Object.values(nodeEls)) { el.classList.remove("active","visited");
    const b = el.querySelector(".badge"); b.textContent=""; b.style.display="none"; }
  hopCount = 0; els.hops.textContent = ""; t0 = Date.now();
  timerIv = setInterval(() => els.timer.textContent = Math.round((Date.now()-t0)/1000)+"s", 500);

  const threadKey = "agentpack-thread-" + activePack.name;
  const threadId = sessionStorage.getItem(threadKey) || undefined;
  const r = await fetch("/api/run", { method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ query, threadId, pack: activePack.name }) });
  if (r.status === 429) {
    clearInterval(timerIv); els.go.disabled = false; running = false;
    feedLine("⏳ Rate limit reached for this demo — try again in a bit.");
    return;
  }
  const { runId, threadId: tid } = await r.json();
  if (tid) sessionStorage.setItem(threadKey, tid);

  const es = new EventSource("/events/" + runId);
  let answer = "";
  es.onmessage = (m) => {
    const ev = JSON.parse(m.data);
    if (ev.kind === "hop") { hopCount++; els.hops.textContent = hopCount + " hops"; setActive(ev.target); }
    if (ev.kind === "thinking") feedLine(ev.text);
    if (ev.kind === "tool_executing") feedLine("🔧 " + pretty(ev.toolName) + " executing…");
    if (ev.kind === "answer_chunk") answer += ev.text;
    if (ev.kind === "run_finished") {
      es.close(); clearInterval(timerIv); els.go.disabled = false; running = false;
      for (const el of Object.values(nodeEls)) el.classList.remove("active");
      if (answer) { els.answer.style.display = "block"; els.answer.innerHTML = marked.parse(answer); }
      if (!ev.ok) feedLine("❌ run failed — check server logs");
    }
  };
}

function feedLine(text) {
  for (const d of els.feed.children) d.classList.remove("latest");
  const d = document.createElement("div"); d.className = "latest"; d.textContent = text;
  els.feed.appendChild(d); els.feed.scrollTop = els.feed.scrollHeight;
}

els.go.onclick = run;
els.q.addEventListener("keydown", e => { if (e.key === "Enter") run(); });
init();
</script>
</body>
</html>`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
