// agentpack — the built-in dev UI: pack switcher, example prompts, live agent
// network with animated dotted connectors + chat. Zero build step, served at
// GET /, vanilla JS over the same SSE contract the eval harness uses.
import type { AgentPack } from "./types.js";

export function devUiHtml(packs: AgentPack[]): string {
  const title = packs.length > 1 ? "agentpack" : packs[0].name;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(title)} — agentpack</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ctext y='26' font-size='26'%3E%E2%9A%A1%3C/text%3E%3C/svg%3E"/>
<script src="https://cdn.jsdelivr.net/npm/marked@12/marked.min.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#0b1020;--panel:#10172e;--panel2:#0d1426;--line:#1e293b;--txt:#e2e8f0;--dim:#64748b;
  --sup:#fbbf24;--spec:#38bdf8;--tool:#94a3b8;--active:#fbbf24;--visited:#34d399;--edge:#22304a}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:var(--txt);min-height:100vh;
  background:var(--bg);
  background-image:radial-gradient(1100px 500px at 15% -10%, rgba(56,189,248,.07), transparent 60%),
    radial-gradient(900px 420px at 90% 0%, rgba(251,191,36,.05), transparent 55%)}
.wrap{max-width:1100px;margin:0 auto;padding:28px 20px 60px}
header{display:flex;align-items:center;gap:12px;margin-bottom:14px;flex-wrap:wrap}
header h1{font-size:1.4rem;letter-spacing:-.02em}
header .fw{font-size:.75rem;color:var(--dim);border:1px solid var(--line);border-radius:12px;padding:2px 10px}
header .right{margin-left:auto;display:flex;align-items:center;gap:10px;font-size:.8rem;color:var(--dim)}
.dot{width:9px;height:9px;border-radius:50%;background:#475569;transition:background .3s}
.dot.run{background:var(--active);animation:dotpulse 1s ease-in-out infinite}
.dot.done{background:var(--visited)}
@keyframes dotpulse{50%{opacity:.35}}
.packbar{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap}
.packtab{border:1.5px solid var(--line);background:var(--panel);color:var(--dim);border-radius:10px;
  padding:8px 16px;font-size:.85rem;cursor:pointer;transition:all .15s}
.packtab:hover{color:var(--txt);transform:translateY(-1px)}
.packtab.on{border-color:var(--spec);color:var(--spec);font-weight:700;
  box-shadow:0 0 0 1px rgba(56,189,248,.25), 0 4px 16px -8px rgba(56,189,248,.5)}
.packdesc{font-size:.82rem;color:var(--dim);margin-bottom:14px;min-height:1.2em}
.querybar{display:flex;gap:10px;margin-bottom:10px}
.querybar input{flex:1;background:var(--panel);border:1px solid var(--line);border-radius:10px;
  padding:13px 16px;color:var(--txt);font-size:.95rem;outline:none;transition:border-color .15s, box-shadow .15s}
.querybar input:focus{border-color:var(--spec);box-shadow:0 0 0 3px rgba(56,189,248,.12)}
.querybar button{background:linear-gradient(180deg,#4cc5f7,#2ea8de);color:#06203a;font-weight:700;border:none;
  border-radius:10px;padding:0 22px;font-size:.95rem;cursor:pointer;transition:filter .15s}
.querybar button:hover{filter:brightness(1.1)}
.querybar button:disabled{opacity:.55;cursor:wait}
.chips{display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap}
.chip{border:1px dashed var(--line);background:transparent;color:var(--dim);border-radius:14px;
  padding:6px 13px;font-size:.76rem;cursor:pointer;max-width:480px;white-space:nowrap;
  overflow:hidden;text-overflow:ellipsis;transition:all .15s;text-align:left}
.chip:hover{color:var(--spec);border-color:var(--spec);background:rgba(56,189,248,.06)}
.net{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:20px;margin-bottom:20px;position:relative}
.net .head{display:flex;align-items:center;gap:10px;margin-bottom:24px;font-size:.85rem;color:var(--dim)}
.net .head b{color:var(--txt);font-size:1rem}
.net .head .meta{margin-left:auto;display:flex;gap:16px;font-variant-numeric:tabular-nums}
#edges{position:absolute;left:0;top:0;pointer-events:none;z-index:0;overflow:visible}
.edge{stroke:var(--edge);stroke-width:1.4;fill:none;stroke-dasharray:3 5;stroke-linecap:round;transition:stroke .25s}
.edge.visited{stroke:rgba(52,211,153,.55)}
.edge.active{stroke:var(--active);stroke-width:2.2;stroke-dasharray:7 5;animation:flow .6s linear infinite;
  filter:drop-shadow(0 0 3px rgba(251,191,36,.7))}
@keyframes flow{to{stroke-dashoffset:-12}}
.suprow{text-align:center;margin-bottom:38px;position:relative;z-index:1}
.cols{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(128px,1fr);gap:12px;position:relative;z-index:1;overflow:visible}
.col{display:flex;flex-direction:column;gap:14px;min-width:0}
.node{border:1.5px solid var(--line);border-radius:9px;padding:7px 13px;font-size:.8rem;text-align:center;
  background:var(--panel2);transition:all .25s;position:relative;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.node.sup{border-color:var(--sup);color:var(--sup);font-weight:700;display:inline-block;padding:9px 26px;
  background:linear-gradient(180deg,#1a2138,#141a2e)}
.node.spec{border-color:var(--spec);color:var(--spec);font-weight:600}
.node.tool{color:var(--tool);font-size:.72rem}
.node.active{box-shadow:0 0 16px rgba(251,191,36,.55);border-color:var(--active)!important;color:var(--active)!important;
  transform:translateY(-1px)}
.node.visited{border-color:var(--visited)!important;color:var(--visited)!important}
.node .badge{position:absolute;top:-7px;right:-4px;background:#f59e0b;color:#111;border-radius:9px;
  font-size:.62rem;font-weight:800;padding:1px 5px;display:none}
.legend{display:flex;gap:18px;margin-top:18px;font-size:.72rem;color:var(--dim);flex-wrap:wrap;position:relative;z-index:1}
.legend i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:5px;border:1.5px solid}
.feed{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px 20px;margin-bottom:20px;
  max-height:190px;overflow-y:auto;font-size:.82rem;display:none}
.feed div{padding:3px 0;color:var(--dim);animation:fadein .3s ease}
.feed div.latest{color:var(--txt)}
@keyframes fadein{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:none}}
.answer{background:var(--panel);border:1px solid var(--line);border-radius:14px;display:none;overflow:hidden}
.answer .ahead{display:flex;align-items:center;gap:10px;padding:13px 20px;border-bottom:1px solid var(--line);
  background:rgba(56,189,248,.04);font-size:.85rem;font-weight:700}
.answer .ahead .copy{margin-left:auto;border:1px solid var(--line);background:transparent;color:var(--dim);
  border-radius:8px;padding:4px 12px;font-size:.74rem;cursor:pointer;transition:all .15s}
.answer .ahead .copy:hover{color:var(--spec);border-color:var(--spec)}
.answer .abody{padding:20px 24px;line-height:1.65;font-size:.92rem}
.abody h1,.abody h2,.abody h3{margin:18px 0 8px;color:#f1f5f9}.abody h1{font-size:1.2rem}.abody h2{font-size:1.05rem}
.abody p,.abody ul,.abody ol{margin-bottom:10px}.abody li{margin-left:22px}
.abody code{background:#1e293b;border-radius:4px;padding:1px 5px;font-size:.85em}
.abody table{border-collapse:collapse;margin:10px 0}.abody td,.abody th{border:1px solid var(--line);padding:6px 10px;font-size:.85rem}
.abody hr{border:none;border-top:1px solid var(--line);margin:14px 0}
footer{text-align:center;margin-top:34px;font-size:.75rem;color:var(--dim)}
footer a{color:var(--spec);text-decoration:none}
@media (max-width:760px){.cols{grid-auto-flow:row;grid-template-columns:repeat(2,1fr)}#edges{display:none}}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1 id="title">${esc(title)}</h1>
    <span class="fw">⚡ agentpack</span>
    <span class="right"><span class="dot" id="dot"></span><span id="stats"></span></span>
  </header>

  <div class="packbar" id="packbar" style="display:none"></div>
  <div class="packdesc" id="packdesc"></div>

  <div class="querybar">
    <input id="q" placeholder="Ask your agent team anything…" autofocus/>
    <button id="go">Run</button>
  </div>
  <div class="chips" id="chips"></div>

  <div class="net">
    <svg id="edges"></svg>
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
  <div class="answer" id="answer">
    <div class="ahead">📋 <span id="atitle">Final Report</span>
      <button class="copy" id="copy">Copy markdown</button></div>
    <div class="abody" id="abody"></div>
  </div>

  <footer>built with <a href="https://github.com/selvaonline/agentpack" target="_blank">agentpack</a> ·
    MCP server live at <code id="mcppath">/mcp</code> · API at <code>/api/run</code></footer>
</div>

<script>
const els = {};
for (const id of ["q","go","suprow","cols","feed","answer","abody","atitle","copy","hops","timer","stats","netsub","packbar","packdesc","chips","title","dot","mcppath","edges"])
  els[id] = document.getElementById(id);
let allPacks = [], activePack = null, netData = null;
let nodeEls = {}, edgeEls = {}, hopCount = 0, t0 = 0, timerIv = null, running = false, rawAnswer = "";

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
  els.mcppath.textContent = allPacks.length > 1 ? "/mcp/" + name : "/mcp";
  els.answer.style.display = "none"; els.feed.style.display = "none";
  els.hops.textContent = ""; els.timer.textContent = ""; els.dot.className = "dot";
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
  netData = await (await fetch("/api/network?pack=" + encodeURIComponent(activePack.name))).json();
  const sup = netData.nodes.find(n => n.type === "supervisor");
  const specs = netData.nodes.filter(n => n.type === "specialist");
  els.suprow.innerHTML = ""; els.cols.innerHTML = ""; nodeEls = {};
  els.suprow.appendChild(mkNode(sup.id, "sup"));
  for (const s of specs) {
    const col = document.createElement("div"); col.className = "col";
    col.appendChild(mkNode(s.id, "spec"));
    for (const t of netData.nodes.filter(n => n.type === "tool" && n.parent === s.id)) col.appendChild(mkNode(t.id, "tool"));
    els.cols.appendChild(col);
  }
  els.netsub.textContent = specs.length + " specialists · " + netData.nodes.filter(n=>n.type==="tool").length + " tools";
  els.stats.textContent = els.netsub.textContent;
  requestAnimationFrame(drawEdges);
}

function mkNode(id, cls) {
  const el = document.createElement("div");
  el.className = "node " + cls;
  el.title = id;
  el.innerHTML = pretty(id) + '<span class="badge"></span>';
  nodeEls[id] = el;
  return el;
}

// ── dotted connectors ───────────────────────────────────────────────────────
function drawEdges() {
  if (!netData) return;
  const svg = els.edges;
  const net = svg.parentElement;
  const W = net.clientWidth, H = net.clientHeight;
  svg.setAttribute("width", W); svg.setAttribute("height", H);
  svg.setAttribute("viewBox", "0 0 " + W + " " + H);
  svg.innerHTML = "";
  edgeEls = {};
  const base = net.getBoundingClientRect();
  const at = (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left - base.left + r.width / 2, top: r.top - base.top, bot: r.top - base.top + r.height };
  };
  for (const e of netData.edges) {
    const a = nodeEls[e.from], b = nodeEls[e.to];
    if (!a || !b) continue;
    const p1 = at(a), p2 = at(b);
    const dy = Math.max(14, (p2.top - p1.bot) * 0.55);
    const d = "M" + p1.x + "," + (p1.bot + 1)
      + " C" + p1.x + "," + (p1.bot + dy) + " " + p2.x + "," + (p2.top - dy)
      + " " + p2.x + "," + (p2.top - 1);
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    path.setAttribute("class", "edge");
    svg.appendChild(path);
    edgeEls[e.from + ">" + e.to] = path;
  }
}
window.addEventListener("resize", () => requestAnimationFrame(drawEdges));

function activateChain(chain) {
  for (const p of Object.values(edgeEls)) p.classList.remove("active");
  for (let i = 0; i + 1 < chain.length; i++) {
    const p = edgeEls[chain[i] + ">" + chain[i + 1]];
    if (p) p.classList.add("active", "visited");
  }
}

function setActive(id, chain) {
  for (const el of Object.values(nodeEls)) el.classList.remove("active");
  const el = nodeEls[id];
  if (el) { el.classList.add("active","visited");
    const b = el.querySelector(".badge"); b.textContent = (parseInt(b.textContent||"0")+1); b.style.display="block"; }
  if (Array.isArray(chain) && chain.length > 1) activateChain(chain);
}

// ── runs ────────────────────────────────────────────────────────────────────
async function run() {
  const query = els.q.value.trim();
  if (!query || running) return;
  running = true; rawAnswer = "";
  els.go.disabled = true; els.go.textContent = "Running…";
  els.dot.className = "dot run";
  els.answer.style.display = "none"; els.abody.innerHTML = "";
  els.feed.style.display = "block"; els.feed.innerHTML = "";
  for (const el of Object.values(nodeEls)) { el.classList.remove("active","visited");
    const b = el.querySelector(".badge"); b.textContent=""; b.style.display="none"; }
  for (const p of Object.values(edgeEls)) p.classList.remove("active","visited");
  hopCount = 0; els.hops.textContent = ""; t0 = Date.now();
  timerIv = setInterval(() => els.timer.textContent = Math.round((Date.now()-t0)/1000)+"s", 500);

  const threadKey = "agentpack-thread-" + activePack.name;
  const threadId = sessionStorage.getItem(threadKey) || undefined;
  const r = await fetch("/api/run", { method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ query, threadId, pack: activePack.name }) });
  if (r.status === 429) {
    finishRun(false);
    feedLine("⏳ Rate limit reached for this demo — try again in a bit.");
    return;
  }
  const { runId, threadId: tid } = await r.json();
  if (tid) sessionStorage.setItem(threadKey, tid);

  const es = new EventSource("/events/" + runId);
  es.onmessage = (m) => {
    const ev = JSON.parse(m.data);
    if (ev.kind === "hop") { hopCount++; els.hops.textContent = hopCount + " hops"; setActive(ev.target, ev.chain); }
    if (ev.kind === "thinking") feedLine(ev.text);
    if (ev.kind === "tool_executing") feedLine("🔧 " + pretty(ev.toolName) + " executing…");
    if (ev.kind === "answer_chunk") rawAnswer += ev.text;
    if (ev.kind === "run_finished") {
      es.close();
      finishRun(ev.ok);
      if (rawAnswer) {
        els.atitle.textContent = "Final Report — " + pretty(activePack.name);
        els.answer.style.display = "block";
        els.abody.innerHTML = marked.parse(rawAnswer);
        els.answer.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
      if (!ev.ok) feedLine("❌ run failed — check server logs");
    }
  };
}

function finishRun(ok) {
  clearInterval(timerIv);
  els.go.disabled = false; els.go.textContent = "Run";
  els.dot.className = ok ? "dot done" : "dot";
  running = false;
  for (const el of Object.values(nodeEls)) el.classList.remove("active");
  for (const p of Object.values(edgeEls)) p.classList.remove("active");
}

function feedLine(text) {
  for (const d of els.feed.children) d.classList.remove("latest");
  const d = document.createElement("div"); d.className = "latest"; d.textContent = text;
  els.feed.appendChild(d); els.feed.scrollTop = els.feed.scrollHeight;
}

els.copy.onclick = async () => {
  await navigator.clipboard.writeText(rawAnswer);
  els.copy.textContent = "Copied ✓";
  setTimeout(() => els.copy.textContent = "Copy markdown", 1500);
};
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
