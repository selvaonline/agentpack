// agentpack — embeddable network-panel widget.
// Drop into any page:
//   <script src="https://your-agentpack-host/widget.js" data-pack="my-team"></script>
//   <div id="agentpack-widget"></div>
// Renders a live agent-network panel (supervisor + specialists), a query box,
// and the streamed answer — inside Shadow DOM so host CSS never clashes.
export function widgetJs(): string {
  return `(function(){
  var script = document.currentScript;
  var base = new URL(script.src).origin;
  var packName = script.getAttribute("data-pack") || "";
  var qs = packName ? "?pack=" + encodeURIComponent(packName) : "";

  function mount(){
    var host = document.getElementById(script.getAttribute("data-target") || "agentpack-widget");
    if (!host) { host = document.createElement("div"); script.parentNode.insertBefore(host, script.nextSibling); }
    var root = host.attachShadow({ mode: "open" });
    root.innerHTML = \`
<style>
:host{all:initial}
*{box-sizing:border-box;font-family:ui-sans-serif,system-ui,-apple-system,sans-serif}
.w{background:#0b1020;color:#e2e8f0;border:1px solid #1e293b;border-radius:14px;padding:18px;max-width:680px}
.hd{display:flex;align-items:baseline;gap:8px;margin-bottom:12px}
.hd b{font-size:.95rem;color:#f1f5f9}
.hd span{font-size:.72rem;color:#64748b}
.hd a{margin-left:auto;font-size:.68rem;color:#38bdf8;text-decoration:none}
.sup{display:inline-block;background:linear-gradient(180deg,#1a2138,#141a2e);border:1.5px solid #fbbf24;
  border-radius:10px;padding:6px 14px;font-size:.78rem;font-weight:700;color:#fbbf24;margin-bottom:10px}
.specs{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px}
.sp{border:1px solid #1e3a52;border-radius:8px;padding:5px 10px;font-size:.72rem;color:#38bdf8;background:rgba(13,20,38,.6);transition:all .2s}
.sp.on{border-color:#fbbf24;color:#fbbf24;box-shadow:0 0 12px -3px #fbbf24}
.sp.done{border-color:#34d399;color:#34d399}
.row{display:flex;gap:8px}
input{flex:1;background:#0d1426;border:1px solid #1e293b;border-radius:8px;color:#e2e8f0;padding:9px 12px;font-size:.8rem;outline:none}
input:focus{border-color:#38bdf8}
button{background:linear-gradient(180deg,#38bdf8,#0284c7);border:none;border-radius:8px;color:#04121f;
  font-weight:700;font-size:.8rem;padding:9px 18px;cursor:pointer}
button:disabled{opacity:.5;cursor:default}
.st{font-size:.7rem;color:#64748b;margin:8px 0 0;min-height:1em}
.ans{display:none;margin-top:12px;border-top:1px solid #1e293b;padding-top:12px;font-size:.78rem;
  line-height:1.55;white-space:pre-wrap;max-height:340px;overflow-y:auto;color:#cbd5e1}
</style>
<div class="w">
  <div class="hd"><b id="t">agentpack</b><span id="d"></span><a id="l" target="_blank" rel="noopener">open full UI ↗</a></div>
  <div class="sup" id="s"></div>
  <div class="specs" id="sp"></div>
  <div class="row"><input id="q" placeholder="Ask the agent team…"/><button id="go">Run</button></div>
  <div class="st" id="st"></div>
  <div class="ans" id="a"></div>
</div>\`;
    var $ = function(id){ return root.getElementById(id); };
    var nodes = {};
    var pretty = function(x){ return x.replace(/_/g," ").replace(/\\b\\w/g,function(c){return c.toUpperCase()}); };

    Promise.all([
      fetch(base + "/api/network" + qs).then(function(r){ return r.json(); }),
      fetch(base + "/api/packs").then(function(r){ return r.json(); }).catch(function(){ return null; })
    ]).then(function(res){
      var net = res[0], packsInfo = res[1];
      var info = packsInfo && packsInfo.packs && (packsInfo.packs.find(function(p){ return p.name === packName; }) || (!packName && packsInfo.packs[0]));
      if (info && !packName) packName = info.name;
      $("t").textContent = (info && info.title) || pretty(packName || "agent team");
      $("d").textContent = (info && info.description) || "";
      $("l").href = base + "/" + (packName ? "?pack=" + encodeURIComponent(packName) : "");
      var sup = (net.nodes || []).find(function(n){ return n.type === "supervisor"; });
      if (sup) $("s").textContent = "👑 " + pretty(sup.id);
      (net.nodes || []).filter(function(n){ return n.type === "specialist"; }).forEach(function(sp){
        var el = document.createElement("div");
        el.className = "sp"; el.textContent = pretty(sp.id);
        nodes[sp.id] = el; $("sp").appendChild(el);
      });
    }).catch(function(){ $("st").textContent = "could not reach " + base; });

    function run(){
      var q = $("q").value.trim(); if (!q) return;
      $("go").disabled = true; $("a").style.display = "none"; $("a").textContent = "";
      $("st").textContent = "running…";
      Object.values(nodes).forEach(function(n){ n.className = "sp"; });
      fetch(base + "/api/run", { method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify(packName ? { query: q, pack: packName } : { query: q }) })
      .then(function(r){ return r.json(); })
      .then(function(j){
        if (!j.runId) throw new Error(j.error || "run failed");
        var es = new EventSource(base + "/events/" + j.runId);
        es.onmessage = function(m){
          var ev = JSON.parse(m.data);
          if (ev.kind === "hop" && ev.targetType === "specialist" && nodes[ev.target]) {
            Object.values(nodes).forEach(function(n){ if (n.className === "sp on") n.className = "sp done"; });
            nodes[ev.target].className = "sp on";
            $("st").textContent = "→ " + pretty(ev.target);
          }
          if (ev.kind === "answer_token") {
            $("a").style.display = "block";
            $("a").textContent += ev.text;
          }
          if (ev.kind === "answer_reset") { $("a").textContent = ""; }
          if (ev.kind === "answer_chunk") { $("a").style.display = "block"; $("a").textContent = ev.text; }
          if (ev.kind === "run_finished") {
            es.close(); $("go").disabled = false;
            $("st").textContent = ev.ok ? "done" : "failed";
            Object.values(nodes).forEach(function(n){ if (n.className === "sp on") n.className = "sp done"; });
          }
        };
        es.onerror = function(){ es.close(); $("go").disabled = false; $("st").textContent = "connection lost"; };
      })
      .catch(function(e){ $("go").disabled = false; $("st").textContent = String(e.message || e); });
    }
    $("go").onclick = run;
    $("q").addEventListener("keydown", function(e){ if (e.key === "Enter") run(); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
`;
}
