// agentpack — the built-in dev UI: pack switcher, example prompts, live agent
// network with animated dotted connectors + chat. Zero build step, served at
// GET /, vanilla JS over the same SSE contract the eval harness uses.
import type { AgentPack } from "./types.js";

export function devUiHtml(packs: AgentPack[]): string {
  const title = packs.length > 1 ? "agentpack" : packs[0].title || packs[0].name;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(title)} — agentpack</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ctext y='26' font-size='26'%3E%E2%9A%A1%3C/text%3E%3C/svg%3E"/>
<script src="https://cdn.jsdelivr.net/npm/marked@12/marked.min.js"></script>
<script>document.documentElement.dataset.theme = localStorage.getItem("agentpack-theme") || "light";</script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#f4f6fb;--panel:#ffffff;--panel2:#f1f5f9;--line:#dde5f0;--txt:#1e293b;--dim:#64748b;
  --sup:#b45309;--spec:#0369a1;--tool:#475569;--active:#d97706;--visited:#059669;--edge:#c3cfdf;
  --head:#0f172a;--codebg:#eef2f7;--supbg:linear-gradient(180deg,#fffbeb,#fef3c7);--spcardbg:#f8fafc;
  --err:#dc2626;--g1:rgba(3,105,161,.05);--g2:rgba(217,119,6,.04)}
[data-theme=dark]{--bg:#0b1020;--panel:#10172e;--panel2:#0d1426;--line:#1e293b;--txt:#e2e8f0;--dim:#64748b;
  --sup:#fbbf24;--spec:#38bdf8;--tool:#94a3b8;--active:#fbbf24;--visited:#34d399;--edge:#22304a;
  --head:#f1f5f9;--codebg:#1e293b;--supbg:linear-gradient(180deg,#1a2138,#141a2e);--spcardbg:rgba(13,20,38,.6);
  --err:#f87171;--g1:rgba(56,189,248,.07);--g2:rgba(251,191,36,.05)}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:var(--txt);min-height:100vh;
  background:var(--bg);transition:background .25s,color .25s;
  background-image:radial-gradient(1100px 500px at 15% -10%, var(--g1), transparent 60%),
    radial-gradient(900px 420px at 90% 0%, var(--g2), transparent 55%)}
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
.packtab.build{border-style:dashed;color:var(--sup)}
.packtab.build.on{border-color:var(--sup);color:var(--sup);
  box-shadow:0 0 0 1px rgba(251,191,36,.25), 0 4px 16px -8px rgba(251,191,36,.5)}
.packtab.custom{border-style:dashed}
.packdesc{font-size:.82rem;color:var(--dim);margin-bottom:14px;min-height:1.2em}
.builder{display:none;background:var(--panel);border:1px solid var(--line);border-radius:14px;
  padding:22px;margin-bottom:20px}
.builder .bhead{font-size:1rem;font-weight:700;margin-bottom:4px}
.builder .bsub{font-size:.8rem;color:var(--dim);margin-bottom:16px;line-height:1.5}
.builder label{display:block;font-size:.72rem;color:var(--dim);margin:10px 0 4px;text-transform:uppercase;letter-spacing:.04em}
.builder input,.builder textarea{width:100%;background:var(--panel2);border:1px solid var(--line);border-radius:8px;
  padding:9px 12px;color:var(--txt);font-size:.86rem;outline:none;font-family:inherit;transition:border-color .15s}
.builder input:focus,.builder textarea:focus{border-color:var(--spec)}
.builder textarea{resize:vertical;min-height:64px;line-height:1.5}
.brow{display:grid;grid-template-columns:1fr 2fr;gap:12px}
.spcard{border:1px solid var(--line);border-radius:10px;padding:14px 16px;margin-top:14px;background:var(--spcardbg);position:relative}
.spcard .spx{position:absolute;top:10px;right:12px;border:none;background:transparent;color:var(--dim);
  cursor:pointer;font-size:.9rem}
.spcard .spx:hover{color:var(--err)}
.toolpick{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
.tpick{border:1px solid var(--line);background:transparent;color:var(--dim);border-radius:12px;
  padding:3px 11px;font-size:.72rem;cursor:pointer;transition:all .12s}
.tpick:hover{color:var(--txt)}
.tpick.on{border-color:var(--spec);color:var(--spec);background:rgba(56,189,248,.08)}
.baction{display:flex;gap:10px;margin-top:18px;align-items:center;flex-wrap:wrap}
.baction .primary{background:linear-gradient(180deg,#fcd34d,#f59e0b);color:#1c1206;font-weight:700;border:none;
  border-radius:10px;padding:11px 22px;font-size:.9rem;cursor:pointer;transition:filter .15s}
.baction .primary:hover{filter:brightness(1.08)}
.baction .primary:disabled{opacity:.55;cursor:wait}
.baction .ghost{border:1px solid var(--line);background:transparent;color:var(--dim);border-radius:10px;
  padding:10px 16px;font-size:.82rem;cursor:pointer;transition:all .15s}
.baction .ghost:hover{color:var(--spec);border-color:var(--spec)}
.berr{color:var(--err);font-size:.8rem;margin-top:10px;white-space:pre-line;display:none}
.theme{border:1px solid var(--line);background:var(--panel);color:var(--dim);border-radius:8px;
  padding:3px 9px;font-size:.85rem;cursor:pointer;line-height:1.4;transition:all .15s}
.theme:hover{color:var(--txt);border-color:var(--spec)}
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
  background:var(--supbg)}
.node.spec{border-color:var(--spec);color:var(--spec);font-weight:600}
.node.tool{color:var(--tool);font-size:.72rem}
.node.active{box-shadow:0 0 16px rgba(251,191,36,.55);border-color:var(--active)!important;color:var(--active)!important;
  transform:translateY(-1px)}
.node.visited{border-color:var(--visited)!important;color:var(--visited)!important}
.node .badge{position:absolute;top:-7px;right:-4px;background:#f59e0b;color:#111;border-radius:9px;
  font-size:.62rem;font-weight:800;padding:1px 5px;display:none}
.legend{display:flex;gap:18px;margin-top:18px;font-size:.72rem;color:var(--dim);flex-wrap:wrap;position:relative;z-index:1}
.legend i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:5px;border:1.5px solid}
.approve{display:none;background:var(--panel);border:1.5px solid var(--sup);border-radius:14px;
  padding:14px 20px;margin-bottom:20px;font-size:.86rem;align-items:center;gap:12px;flex-wrap:wrap;
  box-shadow:0 0 18px -6px rgba(217,119,6,.45)}
.approve b{color:var(--sup)}
.approve .q{color:var(--dim);flex:1;min-width:200px;font-style:italic}
.approve button{border:none;border-radius:8px;padding:8px 18px;font-size:.84rem;font-weight:700;cursor:pointer;transition:filter .15s}
.approve button:hover{filter:brightness(1.08)}
.approve .ok{background:linear-gradient(180deg,#34d399,#059669);color:#03281c}
.approve .no{background:transparent;border:1px solid var(--line);color:var(--dim)}
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
.abody h1,.abody h2,.abody h3{margin:18px 0 8px;color:var(--head)}.abody h1{font-size:1.2rem}.abody h2{font-size:1.05rem}
.abody p,.abody ul,.abody ol{margin-bottom:10px}.abody li{margin-left:22px}
.abody code{background:var(--codebg);border-radius:4px;padding:1px 5px;font-size:.85em}
.abody table{border-collapse:collapse;margin:10px 0}.abody td,.abody th{border:1px solid var(--line);padding:6px 10px;font-size:.85rem}
.abody hr{border:none;border-top:1px solid var(--line);margin:14px 0}
footer{text-align:center;margin-top:34px;font-size:.75rem;color:var(--dim)}
footer a{color:var(--spec);text-decoration:none}
@media (max-width:760px){.cols{grid-auto-flow:row;grid-template-columns:repeat(2,1fr);row-gap:26px}}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1 id="title">${esc(title)}</h1>
    <span class="fw">⚡ agentpack</span>
    <span class="right"><span class="dot" id="dot"></span><span id="stats"></span>
      <button class="theme" id="theme" title="Toggle light/dark theme">🌙</button></span>
  </header>

  <div class="packbar" id="packbar" style="display:none"></div>
  <div class="packdesc" id="packdesc"></div>

  <div class="querybar" id="querybar">
    <input id="q" placeholder="Ask your agent team anything…" autofocus/>
    <button id="go">Run</button>
  </div>
  <div class="chips" id="chips"></div>

  <div class="builder" id="builder">
    <div class="bhead">🛠️ Build your own agent</div>
    <div class="bsub">Define your supervisor and specialists, assign them tools from the catalog below, and launch —
      your agent runs live with the full network view, and the page URL becomes a shareable link.
      Agents built here expire after 24 hours. For custom <i>tools</i> and a permanent setup,
      scaffold a project with <code>npx @selvaonline/agentpack init</code>.</div>
    <div class="brow">
      <div><label>Agent name</label><input id="bname" placeholder="my-deal-agent" maxlength="40"/></div>
      <div><label>Description</label><input id="bdesc" placeholder="What does this agent do?" maxlength="200"/></div>
    </div>
    <label>Supervisor instructions (optional)</label>
    <textarea id="bsup" rows="2" placeholder="Extra guidance for the supervisor, e.g. 'Always end with a go / no-go recommendation.'"></textarea>
    <div id="bspecs"></div>
    <div class="baction">
      <button class="ghost" id="baddspec">＋ Add specialist</button>
      <span style="flex:1"></span>
      <button class="ghost" id="byaml">Copy as agentpack.yaml</button>
      <button class="primary" id="blaunch">🚀 Launch agent</button>
    </div>
    <div class="berr" id="berr"></div>
  </div>

  <div class="net" id="net">
    <svg id="edges"></svg>
    <div class="head"><b>Agent Network</b><span id="netsub"></span>
      <span class="meta"><span id="toks"></span><span id="hops"></span><span id="timer"></span></span></div>
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

  <div class="approve" id="approve">⏸️ Approval needed: run <b id="apname"></b>?<span class="q" id="apquery"></span>
    <button class="ok" id="apok">Approve</button><button class="no" id="apno">Decline</button></div>

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
for (const id of ["q","go","suprow","cols","feed","answer","abody","atitle","copy","hops","timer","toks","stats","netsub","packbar","packdesc","chips","title","dot","mcppath","edges","net","querybar","builder","bname","bdesc","bsup","bspecs","baddspec","byaml","blaunch","berr","theme","approve","apname","apquery","apok","apno"])
  els[id] = document.getElementById(id);
let allPacks = [], activePack = null, netData = null, dynamicEnabled = false;
let nodeEls = {}, edgeEls = {}, hopCount = 0, t0 = 0, timerIv = null, running = false, rawAnswer = "";
let toolCat = [], specs = [], currentRunId = null, currentApproval = null;

async function respondApproval(approve) {
  els.approve.style.display = "none";
  if (!currentRunId || !currentApproval) return;
  await fetch("/api/approve", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ runId: currentRunId, approvalId: currentApproval, approve }) });
  currentApproval = null;
}

const pretty = s => s.replace(/[_-]/g," ").replace(/\\b\\w/g, c => c.toUpperCase());
const label = p => p.title || pretty(p.name);

async function init() {
  const data = await (await fetch("/api/packs")).json();
  allPacks = data.packs; dynamicEnabled = data.dynamicEnabled !== false;
  renderTabs();
  const fromUrl = new URLSearchParams(location.search).get("pack");
  const saved = fromUrl || sessionStorage.getItem("agentpack-active");
  switchPack(allPacks.some(p => p.name === saved) ? saved : allPacks[0].name);
}

function renderTabs() {
  els.packbar.innerHTML = "";
  els.packbar.style.display = (allPacks.length > 1 || dynamicEnabled) ? "flex" : "none";
  for (const p of allPacks) {
    const b = document.createElement("button");
    b.className = "packtab" + (p.custom ? " custom" : "");
    b.textContent = label(p); b.dataset.pack = p.name;
    if (p.custom) b.title = "Custom agent built in the browser (ephemeral)";
    b.onclick = () => { if (!running) switchPack(p.name); };
    els.packbar.appendChild(b);
  }
  if (dynamicEnabled) {
    const b = document.createElement("button");
    b.className = "packtab build"; b.id = "buildtab"; b.textContent = "＋ Build your own";
    b.onclick = () => { if (!running) showBuilder(); };
    els.packbar.appendChild(b);
  }
}

async function switchPack(name) {
  activePack = allPacks.find(p => p.name === name);
  sessionStorage.setItem("agentpack-active", name);
  history.replaceState({}, "", "?pack=" + encodeURIComponent(name));
  for (const b of els.packbar.children) b.classList.toggle("on", b.dataset.pack === name);
  els.title.textContent = label(activePack);
  els.packdesc.textContent = activePack.description + (activePack.custom ? " · custom agent (expires in ~24h) — share this page URL" : "");
  els.mcppath.textContent = allPacks.length > 1 ? "/mcp/" + name : "/mcp";
  els.builder.style.display = "none";
  els.querybar.style.display = "flex"; els.net.style.display = "block";
  els.answer.style.display = "none"; els.feed.style.display = "none";
  els.hops.textContent = ""; els.timer.textContent = ""; els.dot.className = "dot";
  renderChips();
  await loadNetwork();
}

// ── build-your-own ──────────────────────────────────────────────────────────
async function showBuilder() {
  activePack = null;
  for (const b of els.packbar.children) b.classList.toggle("on", b.id === "buildtab");
  els.querybar.style.display = "none"; els.chips.innerHTML = "";
  els.net.style.display = "none"; els.feed.style.display = "none"; els.answer.style.display = "none";
  els.builder.style.display = "block";
  els.title.textContent = "Build Your Own";
  if (!toolCat.length) toolCat = (await (await fetch("/api/toolcatalog")).json()).tools;
  els.packdesc.textContent = "Compose a new agent from " + toolCat.length + " available tools — no code required.";
  if (!specs.length) { prefillSpecs(); renderSpecs(); }
}

function prefillSpecs() {
  const names = toolCat.map(t => t.name);
  specs = [
    { name: "researcher", description: "Gathers the raw data the team needs using its tools.",
      prompt: "You are a research specialist. Use your tools to gather concrete data for each inquiry and report every field the tools return. All search filters are optional — search immediately with whatever criteria were given.",
      tools: names.slice(0, 2) },
    { name: "analyst", description: "Analyzes the researcher's findings and produces a recommendation.",
      prompt: "You are an analyst. Evaluate the data you are given using your tools, show your reasoning with concrete numbers, and end with a clear recommendation.",
      tools: names.slice(2, 4) },
  ];
}

function bfield(label, kind, value, set, ph) {
  const w = document.createElement("div");
  const l = document.createElement("label"); l.textContent = label; w.appendChild(l);
  const el = document.createElement(kind);
  el.value = value; el.placeholder = ph || "";
  if (kind === "textarea") el.rows = 3;
  el.oninput = () => set(el.value);
  w.appendChild(el);
  return w;
}

function renderSpecs() {
  els.bspecs.innerHTML = "";
  specs.forEach((s, i) => {
    const card = document.createElement("div"); card.className = "spcard";
    if (specs.length > 1) {
      const x = document.createElement("button"); x.className = "spx"; x.textContent = "✕"; x.title = "Remove specialist";
      x.onclick = () => { specs.splice(i, 1); renderSpecs(); };
      card.appendChild(x);
    }
    card.appendChild(bfield("Specialist name", "input", s.name, v => s.name = v, "e.g. market_scout"));
    card.appendChild(bfield("Role description (what the supervisor sees when delegating)", "input", s.description, v => s.description = v, "Finds acquisition targets matching given criteria"));
    card.appendChild(bfield("System prompt", "textarea", s.prompt, v => s.prompt = v, "You are a …"));
    const lbl = document.createElement("label"); lbl.textContent = "Tools (" + s.tools.length + " selected)";
    card.appendChild(lbl);
    const tp = document.createElement("div"); tp.className = "toolpick";
    for (const t of toolCat) {
      const b = document.createElement("button");
      b.className = "tpick" + (s.tools.includes(t.name) ? " on" : "");
      b.textContent = pretty(t.name);
      b.title = t.description + "  ·  from " + pretty(t.source);
      b.onclick = () => {
        const j = s.tools.indexOf(t.name);
        if (j >= 0) s.tools.splice(j, 1); else s.tools.push(t.name);
        b.classList.toggle("on");
        lbl.textContent = "Tools (" + s.tools.length + " selected)";
      };
      tp.appendChild(b);
    }
    card.appendChild(tp);
    const ap = document.createElement("label");
    ap.style.cssText = "display:flex;align-items:center;gap:7px;text-transform:none;letter-spacing:0;margin-top:12px;cursor:pointer;font-size:.78rem";
    const cb = document.createElement("input");
    cb.type = "checkbox"; cb.checked = !!s.approval; cb.style.width = "auto";
    cb.onchange = () => s.approval = cb.checked;
    ap.appendChild(cb);
    ap.appendChild(document.createTextNode("Require my approval before this specialist runs"));
    card.appendChild(ap);
    els.bspecs.appendChild(card);
  });
}

els.baddspec.onclick = () => {
  if (specs.length >= 8) return;
  specs.push({ name: "", description: "", prompt: "", tools: [] });
  renderSpecs();
};

els.blaunch.onclick = async () => {
  els.berr.style.display = "none";
  els.blaunch.disabled = true; els.blaunch.textContent = "Launching…";
  const r = await fetch("/api/packs", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: els.bname.value.trim() || "my-agent",
      description: els.bdesc.value.trim(),
      supervisor: { instructions: els.bsup.value.trim() },
      specialists: specs,
    }) });
  const j = await r.json().catch(() => ({}));
  els.blaunch.disabled = false; els.blaunch.textContent = "🚀 Launch agent";
  if (!r.ok) {
    els.berr.textContent = (j.problems || [j.error || "launch failed"]).join("\\n");
    els.berr.style.display = "block";
    return;
  }
  allPacks = (await (await fetch("/api/packs")).json()).packs;
  renderTabs();
  switchPack(j.name);
};

const slugify = s => s.trim().toLowerCase().replace(/[^a-z0-9-_]+/g, "-").replace(/-{2,}/g, "-").replace(/^[-_]+|[-_]+$/g, "").slice(0, 40);

els.byaml.onclick = async () => {
  const raw = els.bname.value.trim();
  const y = ["name: " + (slugify(raw) || "my-agent")];
  if (raw && slugify(raw) !== raw) y.push("title: " + JSON.stringify(raw));
  if (els.bdesc.value.trim()) y.push("description: " + JSON.stringify(els.bdesc.value.trim()));
  y.push("", "specialists:");
  for (const s of specs) {
    y.push("  - name: " + (s.name || "specialist"));
    y.push("    description: " + JSON.stringify(s.description));
    y.push("    prompt: |");
    for (const line of (s.prompt || "").split("\\n")) y.push("      " + line);
    y.push("    tools: [" + s.tools.join(", ") + "]");
    if (s.approval) y.push("    approval: true");
  }
  y.push("", "# point at your own tool modules — scaffold with: npx @selvaonline/agentpack init", "tools: ./tools");
  await navigator.clipboard.writeText(y.join("\\n"));
  els.byaml.textContent = "Copied ✓";
  setTimeout(() => els.byaml.textContent = "Copy as agentpack.yaml", 1500);
};

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
  els.approve.style.display = "none";
  els.feed.style.display = "block"; els.feed.innerHTML = "";
  for (const el of Object.values(nodeEls)) { el.classList.remove("active","visited");
    const b = el.querySelector(".badge"); b.textContent=""; b.style.display="none"; }
  for (const p of Object.values(edgeEls)) p.classList.remove("active","visited");
  hopCount = 0; els.hops.textContent = ""; els.toks.textContent = ""; t0 = Date.now();
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
  currentRunId = runId;

  const es = new EventSource("/events/" + runId);
  es.onmessage = (m) => {
    const ev = JSON.parse(m.data);
    if (ev.kind === "hop") { hopCount++; els.hops.textContent = hopCount + " hops"; setActive(ev.target, ev.chain); }
    if (ev.kind === "thinking") feedLine(ev.text);
    if (ev.kind === "tool_executing") feedLine("🔧 " + pretty(ev.toolName) + " executing…");
    if (ev.kind === "usage") els.toks.textContent = fmtToks(ev.inputTokens + ev.outputTokens) + " tok";
    if (ev.kind === "approval_request") {
      currentApproval = ev.approvalId;
      els.apname.textContent = pretty(ev.specialist);
      els.apquery.textContent = '"' + ev.inquiry + '"';
      els.approve.style.display = "flex";
      els.approve.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    if (ev.kind === "approval_resolved") els.approve.style.display = "none";
    if (ev.kind === "answer_token") { rawAnswer += ev.text; liveAnswer(); }
    if (ev.kind === "answer_reset") { rawAnswer = ""; els.abody.innerHTML = ""; els.answer.style.display = "none"; }
    if (ev.kind === "answer_chunk") rawAnswer = ev.text;
    if (ev.kind === "run_finished") {
      es.close();
      finishRun(ev.ok);
      if (rawAnswer) {
        els.atitle.textContent = "Final Report — " + label(activePack);
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

const fmtToks = n => n >= 1000 ? (n/1000).toFixed(1).replace(/\\.0$/,"") + "k" : String(n);

// Live markdown rendering of streamed answer tokens (throttled).
let lastRender = 0;
function liveAnswer() {
  if (els.answer.style.display !== "block") {
    els.atitle.textContent = "Final Report — " + label(activePack);
    els.answer.style.display = "block";
    els.answer.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  const now = Date.now();
  if (now - lastRender > 120) {
    lastRender = now;
    els.abody.innerHTML = marked.parse(rawAnswer);
  }
}

els.copy.onclick = async () => {
  await navigator.clipboard.writeText(rawAnswer);
  els.copy.textContent = "Copied ✓";
  setTimeout(() => els.copy.textContent = "Copy markdown", 1500);
};
els.apok.onclick = () => respondApproval(true);
els.apno.onclick = () => respondApproval(false);
els.go.onclick = run;
els.q.addEventListener("keydown", e => { if (e.key === "Enter") run(); });

const themeIcon = () => els.theme.textContent = document.documentElement.dataset.theme === "dark" ? "☀️" : "🌙";
els.theme.onclick = () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("agentpack-theme", next);
  themeIcon();
};
themeIcon();
init();
</script>
</body>
</html>`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
