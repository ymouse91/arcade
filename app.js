const el = (sel)=>document.querySelector(sel);

const state = {
  games: [],
  tag: "",
  q: ""
};

function isIOS(){
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function installHintText(){
  if(isIOS()){
    return "iPhone/iPad: avaa peli, paina Jaa (□↑) ja valitse “Lisää Koti-valikkoon”.";
  }
  return "Android/Chrome: avaa peli ja valitse valikosta “Asenna sovellus” tai selaimen tarjoama asennuskehote (□↓).";
}

async function fetchJSON(url){
  const r = await fetch(url, { cache: "no-cache" });
  if(!r.ok) throw new Error(`Fetch failed: ${url}`);
  return await r.json();
}

function normalizeIconUrl(base, src){
  try{
    return new URL(src, base).toString();
  }catch{
    return src;
  }
}

async function bestIconFromManifest(manifestUrl){
  const m = await fetchJSON(manifestUrl);
  const icons = Array.isArray(m.icons) ? m.icons : [];
  if(!icons.length) return null;

  // valitse mieluiten 192..256 tai isoin saatavilla
  const scored = icons.map(ic=>{
    const sizes = (ic.sizes || "").split(/\s+/).map(s=>parseInt(s,10)).filter(n=>Number.isFinite(n));
    const best = sizes.length ? Math.max(...sizes) : 0;
    return { ic, best };
  }).sort((a,b)=> (Math.abs(192-a.best) - Math.abs(192-b.best)) || (b.best - a.best));

  const pick = scored[0]?.ic?.src;
  if(!pick) return null;

  return normalizeIconUrl(manifestUrl, pick);
}

function buildTagOptions(games){
  const tags = new Map();
  for(const g of games){
    for(const t of (g.tags || [])){
      const key = String(t).trim();
      if(!key) continue;
      tags.set(key, (tags.get(key)||0)+1);
    }
  }
  const tagSel = el("#tag");
  const current = tagSel.value;

  const items = [...tags.entries()].sort((a,b)=> b[1]-a[1] || a[0].localeCompare(b[0], "fi"));
  tagSel.innerHTML = `<option value="">Kaikki</option>` + items.map(([t,c])=>`<option value="${escapeHtml(t)}">${escapeHtml(t)} (${c})</option>`).join("");
  tagSel.value = current;
}

function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll("\"","&quot;");
}

function gameMatches(g){
  const q = state.q.trim().toLowerCase();
  if(state.tag){
    const tags = (g.tags||[]).map(x=>String(x).toLowerCase());
    if(!tags.includes(state.tag.toLowerCase())) return false;
  }
  if(q){
    const hay = [
      g.name, g.goal, ...(g.tags||[])
    ].join(" ").toLowerCase();
    if(!hay.includes(q)) return false;
  }
  return true;
}

function render(){
  const grid = el("#grid");
  const list = state.games.filter(gameMatches);

  el("#count").textContent = `${list.length} peliä`;

  grid.innerHTML = list.map(g=>{
    const tags = (g.tags||[]).map(t=>`<span class="tag">${escapeHtml(t)}</span>`).join("");
    const icon = g._icon || g.iconFallback || "";
    const iconHtml = icon ? `<img alt="" src="${escapeHtml(icon)}" loading="lazy" />` : "🎮";

    return `
      <article class="card">
        <div class="cardTop">
          <div class="ico">${iconHtml}</div>
          <div class="meta">
            <h3 class="name">${escapeHtml(g.name || g.id)}</h3>
            <div class="tags">${tags}</div>
          </div>
        </div>

        <div class="goal">${escapeHtml(g.goal || "")}</div>

<div class="actions">
  <button class="btn primary" data-install="${escapeHtml(g.startUrl)}">Avaa</button>
</div>

      </article>
    `;
  }).join("");

  // Asenna-napit: avaa peli ja näytä opastus
  grid.querySelectorAll("button[data-install]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const url = btn.getAttribute("data-install");
      const hint = el("#installHint");
      el("#hintBody").textContent = installHintText() + " (Asennus tehdään pelin omalla sivulla.)";
      hint.hidden = false;
      window.open(url, "_blank", "noopener");
    });
  });
}

async function load(){
  const data = await fetchJSON("./games.json");
  el("#title").textContent = data.title || "PWA-pelit";
  el("#subtitle").textContent = data.subtitle || "";

  state.games = Array.isArray(data.games) ? data.games : [];

  // Yritä hakea iconit pelien manifesteista (jos polut oikein)
  await Promise.allSettled(state.games.map(async g=>{
    if(g.manifestUrl){
      try{
        g._icon = await bestIconFromManifest(g.manifestUrl);
      }catch{
        // fallbackiin
      }
    }
  }));

  buildTagOptions(state.games);
  render();
}

function wire(){
  el("#q").addEventListener("input", (e)=>{
    state.q = e.target.value || "";
    render();
  });
  el("#tag").addEventListener("change", (e)=>{
    state.tag = e.target.value || "";
    render();
  });
}

async function boot(){
  wire();

  // Hubin oma service worker (offline hubi)
  if("serviceWorker" in navigator){
    try{ await navigator.serviceWorker.register("./sw.js"); }catch{}
  }

  // asennusohje näkyviin heti (ei pakollinen)
  const hint = el("#installHint");
  el("#hintBody").textContent = installHintText();
  hint.hidden = false;

  await load();
}

boot();
