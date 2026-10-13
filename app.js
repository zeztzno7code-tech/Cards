/* ============================================================
   ANIME LEGENDS — app.js
   state + save/load + หน้าจอ UI + event
   ============================================================ */
(function () {
  const D = window.GAME_DATA;
  const E = window.Engine;
  const CARDSTORE = window.CardStore;
  const CABSTORE = window.CabinetStore;
  const SAVE_KEY = "anime_legends_v1";

  let state = null;
  let battle = null;          // battle state
  let battleCtx = null;       // {type,id,name,enemyDefs,reward,firstGems,flag}
  let pendingStarter = null;  // {bannerId, step}
  let uiState = { collFilter: "all", collSort: "rarity", targetUid: null, pendingIndex: 0, detailUid: null, adminTab: "units", skinOpen: {}, exchFilter: "all" };

  /* ---------------------------------------------------------
     Persistence
     --------------------------------------------------------- */
  function defaultState() {
    const banners = {};
    D.BANNERS.forEach((b) => (banners[b.id] = { pulls: 0, sinceSR: 0, sinceSSR: 0, sinceUR: 0 }));
    return {
      version: 1,
      player: { name: "ผู้เล่น", level: 1, exp: 0, gold: 100000, gems: 100000, avatar: null, profileBg: null, ownedBgs: [] },
      collection: [],
      team: [],
      banners,
      inventory: { shards: {}, expItem: 5, enhMat: 2 },
      progress: { stages: {}, bosses: {}, arena: {}, tower: 0, events: {} },
      missions: newDaily(),
      skinChoice: {},
      ownedSkins: {},
      starter: null,
      counters: { levelUps: 0 },
      screen: "title",
    };
  }
  function newDaily() {
    return { date: new Date().toDateString(), progress: {}, claimed: {} };
  }
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) {}
  }
  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || s.version !== 1) return null;
      const base = defaultState();
      Object.keys(base).forEach((k) => { if (s[k] === undefined || s[k] === null) s[k] = base[k]; });
      if (!s.player || typeof s.player !== "object") s.player = base.player;
      if (s.player.profileBg === undefined) s.player.profileBg = null;
      if (!Array.isArray(s.player.ownedBgs)) s.player.ownedBgs = [];
      if (!s.collection || !Array.isArray(s.collection)) s.collection = [];
      if (!s.team || !Array.isArray(s.team)) s.team = [];
      if (!s.banners || typeof s.banners !== "object") s.banners = base.banners;
      if (!s.missions || typeof s.missions !== "object") s.missions = base.missions;
      if (!s.inventory || typeof s.inventory !== "object") s.inventory = base.inventory;
      if (!s.progress || typeof s.progress !== "object") s.progress = base.progress;
      if (!s.skinChoice) s.skinChoice = {};
      if (!s.ownedSkins) s.ownedSkins = {};
      return s;
    } catch (e) { return null; }
  }
  function resetSave() {
    localStorage.removeItem(SAVE_KEY);
    App.newGame();
  }

  /* ---------------------------------------------------------
     Utils
     --------------------------------------------------------- */
  function fmt(n) { return Number(n).toLocaleString("en-US"); }
  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  function xmlEsc(s) {
    return String(s == null ? "" : s).replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[c]));
  }
  /* สร้างรูปการ์ด/ตัวละครด้วย SVG อัตโนมัติ — การ์ดจะมีรูปเสมอแม้ไม่มีไฟล์จริง */
  function genArt(o, variant) {
    o = o || {};
    const el = D.ELEMENTS[o.element] || D.ELEMENTS.light;
    const rar = D.RARITY[o.rarity] || D.RARITY.N;
    const enemy = variant === "enemy";
    const name = String(o.name || "?").trim();
    const initial = xmlEsc(name.charAt(0) || "?");
    const top = enemy ? "#3a0d1c" : "#100d24";
    const accent = enemy ? "#ef4444" : rar.color;
    let rays = "";
    for (let i = 0; i < 12; i++) {
      const a = (i * 30) * Math.PI / 180;
      rays += "<line x1='120' y1='150' x2='" + Math.round(120 + Math.cos(a) * 260) + "' y2='" + Math.round(150 + Math.sin(a) * 260) + "'/>";
    }
    const svg =
      "<svg xmlns='http://www.w3.org/2000/svg' width='240' height='300'>" +
      "<defs>" +
        "<radialGradient id='bg' cx='50%' cy='34%' r='82%'>" +
          "<stop offset='0%' stop-color='" + el.color + "' stop-opacity='0.95'/>" +
          "<stop offset='55%' stop-color='" + el.color + "' stop-opacity='0.35'/>" +
          "<stop offset='100%' stop-color='" + top + "'/>" +
        "</radialGradient>" +
        "<linearGradient id='sh' x1='0' y1='0' x2='0' y2='1'>" +
          "<stop offset='0%' stop-color='#000' stop-opacity='0'/>" +
          "<stop offset='100%' stop-color='#000' stop-opacity='0.55'/>" +
        "</linearGradient>" +
      "</defs>" +
      "<rect width='240' height='300' fill='url(#bg)'/>" +
      "<g stroke='#ffffff' stroke-opacity='0.18' stroke-width='2'>" + rays + "</g>" +
      "<circle cx='120' cy='150' r='86' fill='none' stroke='" + accent + "' stroke-opacity='0.55' stroke-width='3'/>" +
      "<circle cx='120' cy='150' r='104' fill='none' stroke='" + accent + "' stroke-opacity='0.25' stroke-width='1'/>" +
      "<text x='120' y='150' font-size='128' text-anchor='middle' dominant-baseline='central' fill='#ffffff' fill-opacity='0.92' font-family='Chakra Petch, Kanit, sans-serif' font-weight='bold'>" + initial + "</text>" +
      "<text x='120' y='266' font-size='48' text-anchor='middle'>" + el.icon + "</text>" +
      "<rect y='240' width='240' height='60' fill='url(#sh)'/>" +
      "</svg>";
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }
  /* หาสกินที่ผู้เล่นเลือกไว้ของการ์ด (คืน object สกิน หรือ null) */
  function activeSkin(charId) {
    if (!state || !state.skinChoice || !charId) return null;
    const sid = state.skinChoice[charId];
    if (!sid) return null;
    const ch = D.CHAR_BY_ID[charId];
    if (!ch || !ch.skins) return null;
    const skin = ch.skins.find((s) => s.id === sid) || null;
    if (skin && skinLocked(charId, skin.id)) return null; /* สกินที่ยังไม่ได้รับ = ใช้ไม่ได้ */
    return skin;
  }
  /* ---------- ระบบครอบครองสกิน ---------- */
  function skinOwned(cardId, skinId) {
    return !!(state && state.ownedSkins && state.ownedSkins[cardId] && state.ownedSkins[cardId].indexOf(skinId) >= 0);
  }
  /* สกินทุกใบใช้ได้เฉพาะเมื่อ "สุ่มได้" แล้วเท่านั้น */
  function skinLocked(cardId, skinId) { return !skinOwned(cardId, skinId); }
  function grantSkin(cardId, skinId) {
    if (!state.ownedSkins) state.ownedSkins = {};
    if (!state.ownedSkins[cardId]) state.ownedSkins[cardId] = [];
    if (state.ownedSkins[cardId].indexOf(skinId) >= 0) return false;
    state.ownedSkins[cardId].push(skinId);
    return true;
  }
  /* หาแหล่งรูปของการ์ด/ยูนิต — สกินที่เลือก > ไฟล์จริง > รูปที่สร้างให้ */
  function imgSrcFor(o) {
    o = o || {};
    const charId = o.charId || (o.element && o.id ? o.id : null);
    const skin = activeSkin(charId);
    if (skin && (skin.gif || skin.img)) return skin.gif || skin.img;
    if (o.gif) return o.gif;
    if (o.img) return o.img;
    const ch = o.charId ? D.CHAR_BY_ID[o.charId] : null;
    if (ch && ch.gif) return ch.gif;
    if (ch && ch.img) return ch.img;
    return genArt(o);
  }
  function charOf(owned) { return D.CHAR_BY_ID[owned.charId]; }
  function ownedByUid(uid) { return state.collection.find((c) => c.uid === uid); }
  /* ---------- เรียงการ์ดตามความแรร์ (แรร์สุดก่อน) ---------- */
  function rarRank(c) { return (c && c.rarity && D.RARITY[c.rarity]) ? E.rank(c.rarity) : -1; }
  function byRarity(a, b) { return rarRank(b) - rarRank(a) || String((a && a.name) || "").localeCompare(String((b && b.name) || "")); }
  function byRarityOwned(a, b) { const ca = charOf(a), cb = charOf(b); return rarRank(cb) - rarRank(ca) || String((ca && ca.name) || "").localeCompare(String((cb && cb.name) || "")); }
  function teamOwned() { return state.team.map(ownedByUid).filter((o) => o && charOf(o)); }
  function charInTeam(charId, excludeUid) {
    return state.team.some((uid) => {
      if (uid === excludeUid) return false;
      const o = ownedByUid(uid);
      return o && o.charId === charId;
    });
  }

  function cardHTML(char, owned, opts) {
    opts = opts || {};
    const el = D.ELEMENTS[char.element];
    const imgPath = imgSrcFor(char);
    const skin = activeSkin(char.id);
    const isGif = (skin && skin.gif) ? true : (skin ? false : !!char.gif);
    const st = E.statsWithPassive(char, owned ? owned.level : 1, owned ? owned.star : 1);
    return (
      '<div class="acard rar-' + char.rarity + " " + (opts.cls || "") + '" ' + (opts.attrs || "") + ">" +
        '<div class="acard-frame">' +
          '<div class="acard-art">' +
            '<div class="fallback" style="background:radial-gradient(circle at 50% 32%,' + el.color + "55,#0b0a1a)\">" +
              '<span class="fb-initial">' + esc(char.name.charAt(0)) + "</span>" +
              '<span class="fb-elem">' + el.icon + "</span>" +
            "</div>" +
            '<img loading="lazy" src="' + imgPath + '" data-gen="' + genArt(char) + '" alt="' + esc(char.name) + '" onerror="App.imgErr(this)">' +
            '<div class="holo"></div>' +
          "</div>" +
          '<span class="rarity-tag">' + char.rarity + "</span>" +
          '<span class="elem-tag" title="' + el.name + '">' + el.icon + "</span>" +
          (isGif ? '<span class="gif-tag">GIF</span>' : "") +
          (skin ? '<span class="skin-tag">🎨</span>' : "") +
          (owned ? '<span class="lv-tag">Lv' + owned.level + "</span>" : "") +
          (owned ? '<span class="star-tag">' + "★".repeat(owned.star) + "</span>" : "") +
        "</div>" +
        '<div class="acard-info">' +
          '<div class="acard-name">' + esc(char.name) + "</div>" +
          '<div class="acard-anime">' + esc(char.anime) + ' · <span class="role-mini">' + D.ROLES[char.role].icon + "</span></div>" +
          '<div class="acard-pow"><span>⚔' + st.atk + "</span><span>❤" + st.hp + "</span><span>🛡" + st.def + "</span><span>💨" + st.spd + "</span></div>" +
        "</div>" +
      "</div>"
    );
  }

  /* ลำดับนามสกุลรูปที่ลองโหลด: png -> jpg -> jpeg -> webp -> ใช้ fallback */
  const IMG_EXTS = ["png", "jpg", "jpeg", "webp", "gif"];
  function imgErr(img) {
    const src = img.getAttribute("src") || "";
    const gen = img.getAttribute("data-gen");
    if (src.indexOf("data:") === 0) {
      if (gen) { img.setAttribute("src", gen); img.removeAttribute("data-gen"); }
      else img.remove();
      return;
    }
    const step = Number(img.dataset.ext || 0) + 1;
    const base = src.replace(/\.(png|jpe?g|webp)$/i, "");
    if (step < IMG_EXTS.length) {
      img.dataset.ext = step;
      img.setAttribute("src", base + "." + IMG_EXTS[step]);
    } else if (gen) {
      img.setAttribute("src", gen);
      img.removeAttribute("data-gen");
    } else {
      img.remove();
    }
  }

  /* ถ้ารูปไม่โหลด ให้ใช้ภาพที่สร้างสำรองทันที (ไม่วนหานามสกุล) */
  function imgGen(img) {
    const g = img.getAttribute("data-gen");
    if (g) { img.setAttribute("src", g); img.removeAttribute("data-gen"); }
    else img.remove();
  }

  function toast(msg, kind) {
    const wrap = document.getElementById("toast-wrap");
    const t = document.createElement("div");
    t.className = "toast " + (kind || "");
    t.textContent = msg;
    wrap.appendChild(t);
    setTimeout(() => t.classList.add("show"), 10);
    setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, 2600);
  }

  function modal(html) {
    const root = document.getElementById("modal-root");
    root.innerHTML = '<div class="modal-bg" id="modal-bg"><div class="modal-panel">' + html + '<button class="modal-close" onclick="App.closeModal()">✕</button></div></div>';
    root.style.display = "block";
  }
  function closeModal() {
    const root = document.getElementById("modal-root");
    root.innerHTML = "";
    root.style.display = "none";
  }

  /* ---------------------------------------------------------
     Cutscene — เอฟเฟคเต็มจอตอนสุ่มได้ระดับ UR ขึ้นไป
     (วิบวับ · เด้ง · เคลื่อนไหว)
     --------------------------------------------------------- */
  let fxTimer = null;
  function fxRoot() {
    let el = document.getElementById("fx-root");
    if (!el) { el = document.createElement("div"); el.id = "fx-root"; document.body.appendChild(el); }
    return el;
  }
  function endCutscene() {
    if (fxTimer) { clearTimeout(fxTimer); fxTimer = null; }
    const root = document.getElementById("fx-root");
    if (root) { root.style.display = "none"; root.innerHTML = ""; }
  }
  function playCutscene(opts, onDone) {
    opts = opts || {};
    const root = fxRoot();
    const r = (opts.rarity && D.RARITY[opts.rarity]) ? opts.rarity : "UR";
    const cnt = opts.count > 1 ? '<div class="fx-count">✦ ได้ ' + r + " × " + opts.count + " ใบ</div>" : "";
    let sparks = "";
    for (let i = 0; i < 24; i++) {
      const x = (Math.random() * 100).toFixed(1), y = (Math.random() * 100).toFixed(1);
      const s = (6 + Math.random() * 12).toFixed(0), d = (Math.random() * 1.8).toFixed(2);
      sparks += '<i class="fx-spark" style="left:' + x + "%;top:" + y + "%;width:" + s + "px;height:" + s + "px;animation-delay:" + d + 's"></i>';
    }
    root.innerHTML =
      '<div class="fx-overlay rar-' + r + '" id="fx-overlay">' +
        '<div class="fx-rays"></div>' +
        '<div class="fx-burst"></div>' +
        '<div class="fx-sparks">' + sparks + "</div>" +
        '<div class="fx-stage">' +
          '<div class="fx-rarity">' + r + "</div>" +
          '<div class="fx-cardwrap"><div class="fx-card"><img src="' + esc(opts.img || "") + '" alt="" onerror="this.style.display=\'none\'"></div><div class="fx-shine"></div></div>' +
          cnt +
          '<div class="fx-name">' + esc(opts.name || "") + "</div>" +
        "</div>" +
        '<div class="fx-tap">แตะเพื่อไปต่อ ▶</div>' +
      "</div>";
    root.style.display = "block";
    let done = false;
    const finish = function () { if (done) return; done = true; endCutscene(); if (onDone) onDone(); };
    const overlay = (root.querySelector ? root.querySelector("#fx-overlay") : null);
    if (overlay && overlay.addEventListener) overlay.addEventListener("click", finish);
    if (fxTimer) clearTimeout(fxTimer);
    fxTimer = setTimeout(finish, opts.duration || 3400);
  }

  /* ---------------------------------------------------------
     Navigation / render
     --------------------------------------------------------- */
  function render() {
    const app = document.getElementById("app");
    const scr = state.screen || "title";
    const fn = SCREENS[scr] || SCREENS.title;
    app.innerHTML = fn();
  }
  function go(screen, params) {
    if (params) uiState = Object.assign(uiState, params);
    state.screen = screen;
    save();
    render();
    window.scrollTo(0, 0);
  }

  /* ---------------------------------------------------------
     Resources
     --------------------------------------------------------- */
  function addGold(n) { state.player.gold = Math.max(0, state.player.gold + n); }
  function addGems(n) { state.player.gems = Math.max(0, state.player.gems + n); }
  function addShards(charId, n) {
    state.inventory.shards[charId] = (state.inventory.shards[charId] || 0) + n;
  }
  /* คลาสฉากหลังโปรไฟล์ที่ติดตั้งอยู่ (ค่าว่าง = ค่าเริ่มต้น) */
  function bgClass() {
    const id = state.player.profileBg;
    return (id && (D.PROFILE_BGS || []).some((b) => b.id === id)) ? " pb-" + id : "";
  }
  /* เปิดหีบสมบัติ: สุ่มรางวัลหลายอย่าง แล้วโชว์ผล */
  function openChest() {
    const gains = [];
    const gold = 600 + Math.floor(Math.random() * 1401); // 600–2000
    addGold(gold);
    gains.push({ i: "🪙", t: "ทอง", v: fmt(gold) });
    const expN = 2 + Math.floor(Math.random() * 7); // 2–8
    state.inventory.expItem += expN;
    gains.push({ i: "🧪", t: "ยา EXP", v: "×" + expN });
    if (Math.random() < 0.7) {
      const enhN = 1 + Math.floor(Math.random() * 4); // 1–4
      state.inventory.enhMat += enhN;
      gains.push({ i: "🔧", t: "วัสดุเสริมพลัง", v: "×" + enhN });
    }
    if (Math.random() < 0.5) {
      const chars = D.CHARACTERS || [];
      if (chars.length) {
        const c = chars[Math.floor(Math.random() * chars.length)];
        const shN = 10 + Math.floor(Math.random() * 21); // 10–30
        addShards(c.id, shN);
        gains.push({ i: "🧩", t: "เศษ " + c.name, v: "×" + shN });
      }
    }
    save();
    const rows = gains.map((g) => '<div class="chest-row"><span class="chest-ico">' + g.i + '</span><span class="chest-lbl">' + esc(g.t) + '</span><span class="chest-val">' + g.v + "</span></div>").join("");
    modal('<h3>🎁 หีบสมบัติ</h3>' +
      '<p class="center">คุณได้รับ…</p>' +
      '<div class="chest-list">' + rows + "</div>" +
      '<div class="modal-actions"><button class="btn primary" onclick="App.closeModal()">เยี่ยม!</button></div>');
    render();
  }
  /* ---------- แลกการ์ด/สกินด้วยเศษซ้ำ (UR+) ----------
     รวมเศษซ้ำต่อตัวของยูนิตที่ระดับ >= UR เป็นพูลเดียว ใช้แลกได้ทุกใบ (ยูนิต + สกิน) ที่ระดับ UR/LR/ART */
  function exchCost(rarity) {
    const c = D.EXCHANGE && D.EXCHANGE.cost ? D.EXCHANGE.cost : {};
    return c[rarity] != null ? c[rarity] : null;
  }
  function exchMinRank() { return E.rank((D.EXCHANGE && D.EXCHANGE.minRarity) || "UR"); }
  function shardPoolIds() {
    return Object.keys(state.inventory.shards).filter((id) => {
      const c = D.CHAR_BY_ID[id];
      return c && E.rank(c.rarity) >= exchMinRank() && (state.inventory.shards[id] || 0) > 0;
    });
  }
  function shardPoolTotal() {
    return shardPoolIds().reduce((a, id) => a + (state.inventory.shards[id] || 0), 0);
  }
  /* หักเศษจากพูล (ใช้ระดับต่ำสุดก่อน) — คืน true ถ้าหักครบ */
  function spendShards(cost) {
    if (shardPoolTotal() < cost) return false;
    const ids = shardPoolIds().sort((a, b) => E.rank(D.CHAR_BY_ID[a].rarity) - E.rank(D.CHAR_BY_ID[b].rarity));
    let left = cost;
    for (let i = 0; i < ids.length && left > 0; i++) {
      const id = ids[i];
      const take = Math.min(state.inventory.shards[id], left);
      state.inventory.shards[id] -= take;
      left -= take;
    }
    return true;
  }
  /* ระดับของสกิน = จากการ์ดต้นทาง (เหมือนระบบตู้) */
  function exchSkinRarity(ch, sk) {
    const sc = sk.src ? D.CHAR_BY_ID[sk.src] : null;
    return (sc && sc.rarity) || ch.rarity || "N";
  }
  /* รายการที่แลกได้ทั้งหมด: ยูนิต + สกิน ที่ระดับ UR/LR/ART */
  function exchItems() {
    const out = [];
    (D.DRAWABLE || []).forEach((c) => {
      if (!c.isSkin && exchCost(c.rarity) != null) out.push({ kind: "unit", char: c, rarity: c.rarity, name: c.name });
    });
    (D.CHARACTERS || []).forEach((ch) => {
      (ch.skins || []).forEach((sk) => {
        const r = exchSkinRarity(ch, sk);
        if (exchCost(r) == null) return;
        out.push({ kind: "skin", char: ch, sk, cardId: ch.id, skinId: sk.id, rarity: r, name: sk.name || "สกิน", ownerName: ch.name });
      });
    });
    return out.sort((a, b) => E.rank(b.rarity) - E.rank(a.rarity) || String(a.name).localeCompare(String(b.name)));
  }
  function addPlayerExp(n) {
    state.player.exp += n;
    let need = 100 * state.player.level;
    while (state.player.exp >= need) {
      state.player.exp -= need;
      state.player.level++;
      need = 100 * state.player.level;
      toast("เลเวลผู้เล่นเพิ่มเป็น " + state.player.level + "!", "good");
    }
  }
  function gainCard(char) {
    const existing = state.collection.find((c) => c.charId === char.id);
    if (existing) {
      const sh = E.dupShards(char.rarity);
      addShards(char.id, sh);
      return { isNew: false, shards: sh };
    }
    const owned = E.newOwned(char.id);
    state.collection.push(owned);
    return { isNew: true, owned };
  }

  /* ---------------------------------------------------------
     Missions
     --------------------------------------------------------- */
  function checkDailyReset() {
    if (state.missions.date !== new Date().toDateString()) state.missions = newDaily();
  }
  function missionProgress(type, n) {
    checkDailyReset();
    D.DAILY_TEMPLATES.forEach((m) => {
      if (m.type === type) state.missions.progress[m.id] = (state.missions.progress[m.id] || 0) + n;
    });
  }
  function claimMission(id) {
    const m = D.DAILY_TEMPLATES.find((x) => x.id === id);
    if (!m) return;
    if (state.missions.claimed[id]) return toast("รับรางวัลไปแล้ว");
    const prog = state.missions.progress[id] || 0;
    if (prog < m.target) return toast("ยังทำไม่ครบ");
    state.missions.claimed[id] = true;
    if (m.reward.gold) addGold(m.reward.gold);
    if (m.reward.gems) addGems(m.reward.gems);
    if (m.reward.expItem) state.inventory.expItem += m.reward.expItem;
    toast("รับรางวัลภารกิจสำเร็จ!", "good");
    save(); render();
  }

  /* =========================================================
     SCREENS
     ========================================================= */
  const SCREENS = {};

  function topbar(active) {
    const p = state.player;
    const links = [
      ["home", "🏠", "หน้าหลัก"],
      ["gacha", "🎁", "เปิดแพ็ก"],
      ["collection", "🃏", "คอลเลกชัน"],
      ["team", "👥", "จัดทีม"],
      ["battle", "⚔️", "ต่อสู้"],
      ["missions", "📋", "ภารกิจ"],
      ["shop", "🛒", "ร้านค้า"],
      ["status", "📊", "สถานะ"],
      ["admin", "🛠️", "แอดมิน"],
    ];
    return (
      '<header class="topbar">' +
        '<div class="brand">⚡ ANIME<span>LEGENDS</span></div>' +
        '<nav class="nav">' +
          links.map((l) => '<button class="nav-btn ' + (active === l[0] ? "active" : "") + '" onclick="App.go(\'' + l[0] + '\')">' + l[1] + " " + l[2] + "</button>").join("") +
        "</nav>" +
        '<div class="res">' +
          '<span class="res-pill gold">🪙 ' + fmt(p.gold) + "</span>" +
          '<span class="res-pill gem">💎 ' + fmt(p.gems) + "</span>" +
          '<span class="res-pill lvl">Lv ' + p.level + "</span>" +
        "</div>" +
      "</header>"
    );
  }

  /* ---------- TITLE ---------- */
  SCREENS.title = function () {
    const hasSave = !!load();
    return (
      '<section class="hero">' +
        '<div class="hero-art"></div>' +
        '<div class="hero-inner">' +
          '<h1 class="game-title">ANIME<br><span>LEGENDS</span></h1>' +
          '<p class="subtitle">เกมสะสมการ์ดตัวละครจากอนิเมะหลายจักรวาล</p>' +
          '<div class="hero-btns">' +
            (hasSave ? '<button class="btn primary big" onclick="App.continueGame()">▶ เล่นต่อ</button>' : "") +
            '<button class="btn ' + (hasSave ? "" : "primary") + ' big" onclick="App.newGame()">✦ เริ่มเกมใหม่</button>' +
          "</div>" +
        "</div>" +
      "</section>"
    );
  };

  /* ---------- STARTER ---------- */
  SCREENS.starter = function () {
    if (!pendingStarter) pendingStarter = { bannerId: null, step: "banner" };
    if (pendingStarter.step === "banner") {
      return (
        '<section class="screen center">' +
          '<h2 class="screen-title">เลือกแบนเนอร์เริ่มต้น</h2>' +
          '<p class="screen-sub">เลือกลุ่มการ์ดจักรวาลที่คุณอยากเริ่มสะสม</p>' +
          '<div class="banner-grid">' +
            D.BANNERS.map((b) =>
              '<button class="banner-card" onclick="App.chooseStarterBanner(\'' + b.id + '\')">' +
                '<div class="banner-name">' + esc(b.name) + "</div>" +
                '<div class="banner-desc">' + esc(b.desc) + "</div>" +
                '<div class="banner-feat">UR: ' + (D.CHAR_BY_ID[b.featuredUR] ? D.CHAR_BY_ID[b.featuredUR].name : "-") + "</div>" +
              "</button>"
            ).join("") +
          "</div>" +
        "</section>"
      );
    }
    // step method
    const b = D.BANNERS.find((x) => x.id === pendingStarter.bannerId);
    return (
      '<section class="screen center">' +
        '<h2 class="screen-title">แบนเนอร์: ' + esc(b.name) + "</h2>" +
        '<p class="screen-sub">เลือกวิธีรับตัวละครเริ่มต้น</p>' +
        '<div class="choice-row">' +
          '<button class="choice" onclick="App.starterRandom()"><b>🎲 สุ่มการ์ดเริ่มต้น</b><span>สุ่มจริง 1 ครั้งฟรีตามกติกาแบนเนอร์</span></button>' +
          '<button class="choice" onclick="App.go(\'starterPick\')"><b>🎯 เลือกตัวละครเอง</b><span>เลือกจากรายการที่อนุญาต</span></button>' +
        "</div>" +
        '<button class="btn ghost" onclick="App.go(\'starter\')">← กลับ</button>' +
      "</section>"
    );
  };
  SCREENS.starterPick = function () {
    const chars = D.STARTER_IDS.map((id) => D.CHAR_BY_ID[id]);
    return (
      '<section class="screen">' +
        '<h2 class="screen-title center">เลือกตัวละครเริ่มต้น</h2>' +
        '<div class="card-grid">' +
          chars.map((c) => cardHTML(c, null, { cls: "pickable", attrs: 'onclick="App.starterPick(\'' + c.id + '\')"' })).join("") +
        "</div>" +
      "</section>"
    );
  };

  /* ---------- HOME ---------- */
  SCREENS.home = function () {
    checkDailyReset();
    const p = state.player;
    const team = teamOwned();
    const power = team.reduce((s, o) => {
      const st = E.statsWithPassive(charOf(o), o.level, o.star);
      return s + st.atk + st.hp * 0.1 + st.def;
    }, 0);
    const menu = [
      ["gacha", "🎁", "เปิดแพ็ก", "สุ่มการ์ดใหม่ด้วยเพชร"],
      ["collection", "🃏", "คอลเลกชันการ์ด", state.collection.length + " ใบในครอบครอง"],
      ["team", "👥", "จัดทีม", "ทีมปัจจุบัน " + team.length + "/5"],
      ["battle", "⚔️", "ต่อสู้", "Story · Boss · Tower · Arena"],
      ["missions", "📋", "ภารกิจ", "ภารกิจประจำวัน"],
      ["shop", "🛒", "ร้านค้า", "ซื้อไอเทมด้วยทอง"],
      ["status", "📊", "สถานะผู้เล่น", "ทรัพยากรและความก้าวหน้า"],
      ["admin", "🛠️", "แดชบอร์ดแอดมิน", "จัดการการ์ด · กำหนดระดับ"],
    ];
    return topbar("home") +
      '<section class="screen">' +
        '<div class="profile-bar' + bgClass() + '">' +
          '<div class="avatar ' + (p.avatar && D.CHAR_BY_ID[p.avatar] ? "has-img" : "") + '" onclick="App.pickAvatar()" title="เปลี่ยนรูปโปรไฟล์">' +
            (p.avatar && D.CHAR_BY_ID[p.avatar]
              ? '<img loading="lazy" src="' + imgSrcFor(D.CHAR_BY_ID[p.avatar]) + '" data-gen="' + genArt(D.CHAR_BY_ID[p.avatar]) + '" alt="" onerror="App.imgErr(this)">'
              : esc(p.name.charAt(0))) +
          "</div>" +
          '<div><div class="pname">' + esc(p.name) + " · Lv " + p.level + "</div>" +
          '<div class="pxp"><div class="bar"><i style="width:' + Math.round((p.exp / (100 * p.level)) * 100) + '%"></i></div><small>EXP ' + p.exp + "/" + 100 * p.level + "</small></div></div>" +
          '<div class="power">⚡ กำลังทีม<br><b>' + Math.round(power) + "</b></div>" +
        "</div>" +
        '<div class="menu-grid">' +
          menu.map((m) => '<button class="menu-card" onclick="App.go(\'' + m[0] + '\')"><span class="mi">' + m[1] + '</span><b>' + m[2] + "</b><small>" + esc(m[3]) + "</small></button>").join("") +
        "</div>" +
      "</section>";
  };

  /* ---------- Gacha machine (หน้าตู้กาชา) ---------- */
  /* ปกตู้มาตรฐาน 1334x750 (ใช้เป็นภาพสำรองเมื่อไม่มีไฟล์ในโฟลเดอร์ gacha) */
  function machineSVG() {
    return "<svg viewBox='0 0 1334 750' width='1334' height='750' xmlns='http://www.w3.org/2000/svg' role='img' aria-label='ตู้กาชา'>" +
        "<defs>" +
          "<linearGradient id='sky' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='#2a1a4d'/><stop offset='100%' stop-color='#0b0a1a'/></linearGradient>" +
          "<linearGradient id='mg' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='#7c3aed'/><stop offset='100%' stop-color='#3b1d78'/></linearGradient>" +
          "<radialGradient id='dome' cx='50%' cy='35%' r='70%'><stop offset='0%' stop-color='#ffffff' stop-opacity='0.75'/><stop offset='100%' stop-color='#38bdf8' stop-opacity='0.22'/></radialGradient>" +
        "</defs>" +
        "<rect width='1334' height='750' fill='url(#sky)'/>" +
        "<circle cx='170' cy='600' r='30' fill='#fb7dc0' opacity='0.55'/>" +
        "<circle cx='1120' cy='560' r='42' fill='#38bdf8' opacity='0.5'/>" +
        "<circle cx='1210' cy='180' r='24' fill='#fbbf24' opacity='0.55'/>" +
        "<circle cx='140' cy='180' r='20' fill='#34d399' opacity='0.5'/>" +
        "<g transform='translate(513,150) scale(1.4)'>" +
          "<ellipse cx='110' cy='272' rx='86' ry='12' fill='#000' opacity='0.45'/>" +
          "<rect x='30' y='120' width='160' height='140' rx='18' fill='url(#mg)' stroke='#4b3f8f' stroke-width='3'/>" +
          "<rect x='72' y='150' width='76' height='48' rx='8' fill='#0d0b1e' stroke='#a78bfa' stroke-width='2'/>" +
          "<circle cx='110' cy='72' r='62' fill='url(#dome)' stroke='#a78bfa' stroke-width='3'/>" +
          "<circle cx='86' cy='60' r='12' fill='#fb7dc0'/><circle cx='120' cy='48' r='12' fill='#fbbf24'/>" +
          "<circle cx='138' cy='82' r='12' fill='#38bdf8'/><circle cx='98' cy='94' r='12' fill='#34d399'/>" +
          "<circle cx='126' cy='104' r='10' fill='#f87171'/>" +
          "<circle cx='110' cy='72' r='62' fill='none' stroke='#ffffff' stroke-opacity='0.15'/>" +
        "</g>" +
        "<text x='667' y='712' text-anchor='middle' font-size='34' fill='#d9d3ff' font-family='Chakra Petch, Kanit, sans-serif' font-weight='bold' letter-spacing='6'>GACHA</text>" +
      "</svg>";
  }
  /* โหลดภาพตู้จากโฟลเดอร์ gacha — ถ้าไม่มีไฟล์จริงใช้ภาพที่สร้างให้แทน */
  function cabinetDisplay(b, cabs) {
    const fallback = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(machineSVG());
    const src = b.img || "gacha/gacha_1.jpg";
    const tabs = cabs.map((x) => '<button class="tab ' + (x.id === b.id ? "active" : "") + '" onclick="App.selectBanner(\'' + x.id + '\')">' + (E.cabHasContent(x) ? "" : "🔒 ") + esc(x.name) + "</button>").join("");
    return '<div class="banner-tabs">' + tabs + "</div>" +
      '<div class="gacha-machine">' +
        '<img loading="lazy" src="' + esc(src) + '" data-gen="' + fallback + '" alt="' + esc(b.name) + '" onerror="App.imgGen(this)">' +
        '<div class="gb-title">' + esc(b.name) + "</div>" +
        (b.desc ? '<div class="gb-desc">' + esc(b.desc) + "</div>" : "") +
      "</div>";
  }
  /* การ์ดสกิน (ใช้โชว์ในตู้ + ผลการสุ่ม) */
  function skinTile(e, tag, hideOwned) {
    if (!e) return "";
    const rc = CARDSTORE.loadCards().find((c) => c.id === e.cardId);
    if (!rc) return "";
    const sk = (rc.skins || []).find((s) => s.id === e.skinId);
    if (!sk) return "";
    const ch = D.CHAR_BY_ID[e.cardId] || rc;
    const owned = skinOwned(e.cardId, e.skinId);
    return '<div class="skin-tile rar-' + (e.rarity || "N") + (owned && !hideOwned ? " owned" : "") + '">' +
      '<div class="st-img"><img loading="lazy" src="' + esc(sk.gif || sk.img || "") + '" data-gen="' + genArt(ch) + '" alt="" onerror="App.imgErr(this)"></div>' +
      '<span class="rarity-tag">' + (e.rarity || "N") + "</span>" +
      (hideOwned ? "" : (owned ? '<span class="st-owned">มีแล้ว</span>' : '<span class="st-lock" title="ยังไม่ปลดล็อก — สุ่มได้จากตู้">🔒</span>')) +
      (tag || "") +
      '<div class="st-name">' + esc(sk.name) + "</div>" +
      '<div class="st-card">' + esc(rc.name || "") + "</div>" +
    "</div>";
  }
  /* ---------- เปิดตู้สกิน ---------- */
  function dupSkinGems(r) { return { N: 3, R: 6, SR: 12, SSR: 25, UR: 50, LR: 100, ART: 150 }[r] || 3; }
  function pullSkin(b, n) {
    const entries = E.skinCabEntries(b);
    if (!entries.length) return toast("ตู้นี้ยังไม่มีสกิน — ตั้งค่าที่แดชบอร์ดแอดมิน");
    const cost = n === 10 ? D.GACHA.multiCost : D.GACHA.singleCost;
    if (state.player.gems < cost) return toast("เพชรไม่พอ (ต้องใช้ 💎 " + cost + ")");
    state.player.gems -= cost;
    const pity = state.banners[b.id] || (state.banners[b.id] = { pulls: 0, sinceSR: 0, sinceSSR: 0, sinceUR: 0 });
    const results = n === 10 ? E.multiSkinPull(b, pity, 10) : [E.drawSkinOne(b, pity)];
    results.sort((a, b) => E.rank(b.rarity || "N") - E.rank(a.rarity || "N"));
    let dupCount = 0, dupGems = 0;
    const tiles = results.map((r) => {
      if (!r.entry) return '<div class="pull-slot"><p class="empty">—</p></div>';
      const wasOwned = skinOwned(r.cardId, r.skinId);
      let tag;
      if (!wasOwned) { grantSkin(r.cardId, r.skinId); tag = '<span class="tag-new">NEW</span>'; }
      else { const g = dupSkinGems(r.rarity); state.player.gems += g; dupCount++; dupGems += g; tag = '<span class="tag-dup" title="สกินซ้ำ คืน +' + g + ' เพชร">+' + g + " 💎</span>"; }
      return '<div class="pull-slot">' + skinTile(r.entry, tag, true) + "</div>";
    }).join("");
    missionProgress("gachaPulls", n);
    save();
    const resultHtml = '<h3>🎨 ผลการเปิดตู้สกิน (' + n + " ครั้ง)</h3>" +
      '<div class="pull-result">' + tiles + "</div>" +
      (dupCount ? '<p class="hint">💎 ซ้ำ ' + dupCount + " ใบ · คืนเพชร +" + dupGems + "</p>" : "") +
      '<p class="hint">หักเพชรแล้ว 💎 ' + cost + " · คงเหลือ 💎 " + fmt(state.player.gems) + " · สกินที่ได้เลือกใช้ได้ที่หน้ารายละเอียดการ์ด</p>" +
      '<div class="modal-actions">' +
        '<button class="btn gold" onclick="App.pull(' + n + ')">🔁 สุ่มต่อ (' + n + ")</button>" +
        '<button class="btn primary" onclick="App.closeModal()">ตกลง</button>' +
      "</div>";
    render();
    const best = results.reduce((m, r) => (!m || (r.entry && E.rank(r.rarity || "N") > E.rank(m.rarity || "N"))) ? r : m, null);
    if (best && best.entry && E.rank(best.rarity || "N") >= E.rank("UR")) {
      playCutscene({ img: best.entry.gif || best.entry.img, rarity: best.rarity || "UR", name: best.entry.name }, function () { modal(resultHtml); });
    } else {
      modal(resultHtml);
    }
  }

  /* ---------- GACHA ---------- */
  SCREENS.gacha = function () {
    const cabs = D.CABINETS;
    if (!cabs || !cabs.length) {
      return topbar("gacha") + '<section class="screen"><p class="empty">ยังไม่มีตู้กาชา — เพิ่มได้ที่แดชบอร์ดแอดมิน</p></section>';
    }
    const b = cabs.find((x) => x.id === uiState.bannerId) || cabs[0];
    uiState.bannerId = b.id;
    const pity = state.banners[b.id] || (state.banners[b.id] = { pulls: 0, sinceSR: 0, sinceSSR: 0, sinceUR: 0 });
    const rates = D.RARITY_ORDER.map((r) => {
      const v = (b.rates && b.rates[r] != null) ? b.rates[r] : D.RARITY[r].rate;
      return '<div class="rate-row"><span class="rar-pill rar-' + r + '">' + r + "</span><span>" + v + "%</span></div>";
    }).join("");
    const feat = D.CHAR_BY_ID[b.featuredUR];
    const pool = E.cabPool(b);
    const units = pool.units.slice().sort(byRarity);
    const skins = pool.skins.slice().sort((a, c) => E.rank(c.rarity || "N") - E.rank(a.rarity || "N"));
    const locked = (units.length + skins.length) === 0;
    const contentsTitle = "📦 ตัวในตู้ (" + (units.length + skins.length) + ")";
    const unitContents = units.length
      ? '<div class="card-grid cabinet">' + units.map((c) => cardHTML(c, null, {})).join("") + "</div>"
      : "";
    const skinContents = skins.length
      ? '<h4 class="sub-title">🎨 สกินในตู้ (' + skins.length + ")</h4>" +
        '<div class="skin-grid">' + skins.map((e) => skinTile(e)).join("") + "</div>"
      : "";
    const pullLabel = locked ? "🔒 ตู้นี้ถูกล็อก — ไปติ๊กตัวละคร/สกินใส่ตู้ที่แดชบอร์ดแอดมินก่อน" : "";
    const pullButtons = locked
      ? '<div class="gacha-btns"><button class="btn" disabled>🔒 ตู้ถูกล็อก</button></div>'
      : '<div class="gacha-btns">' +
          '<button class="btn primary" onclick="App.pull(1)">เปิด 1 ครั้ง<br><small>💎 ' + D.GACHA.singleCost + "</small></button>" +
          '<button class="btn gold" onclick="App.pull(10)">เปิด 10 ครั้ง<br><small>💎 ' + D.GACHA.multiCost + "</small></button>" +
        "</div>";
    return topbar("gacha") +
      '<section class="screen">' +
        '<h2 class="screen-title">🎁 เปิดแพ็ก</h2>' +
        '<div class="gacha-layout">' +
          '<div class="gacha-main">' +
            cabinetDisplay(b, cabs) +
            (feat ? '<div class="gacha-banner rar-UR"><div class="gb-feat">การันตี UR: <b>' + esc(feat.name) + "</b> (" + D.ELEMENTS[feat.element].icon + " " + esc(feat.anime) + ")</div></div>" : "") +
            (pullLabel ? '<p class="hint center">' + pullLabel + "</p>" : "") +
            pullButtons +
            '<div class="pity-box">' +
              '<div class="pity-row"><span>เปิดแพ็กแล้ว</span><b>' + pity.pulls + " ครั้ง</b></div>" +
              '<div class="pity-row"><span>การันตี SR+ ภายใน</span><b>' + D.GACHA.pitySR + " ครั้ง</b></div>" +
              '<div class="pity-row"><span>อีก ' + Math.max(0, D.GACHA.pitySSR - pity.sinceSSR) + " ครั้ง → SSR+</span>" +
                '<div class="bar"><i style="width:' + Math.round((pity.sinceSSR / D.GACHA.pitySSR) * 100) + '%"></i></div></div>' +
              '<div class="pity-row"><span>อีก ' + Math.max(0, D.GACHA.pityUR - pity.sinceUR) + " ครั้ง → featured UR</span>" +
                '<div class="bar ur"><i style="width:' + Math.round((pity.sinceUR / D.GACHA.pityUR) * 100) + '%"></i></div></div>' +
            "</div>" +
            '<div class="cab-contents"><h3>' + contentsTitle + "</h3>" +
              (locked ? '<p class="empty">ยังไม่ได้ติ๊กตัวหรือสกินใส่ตู้ — ตู้ถูกล็อก</p>' : unitContents + skinContents) +
            "</div>" +
          "</div>" +
          '<aside class="rates-box"><h3>อัตราการสุ่ม</h3>' + rates + '<p class="hint">หักเพชรทุกครั้งตามราคาจริง · ตู้ออกเฉพาะตัว/สกินที่ติ๊กใส่ตู้</p></aside>' +
        "</div>" +
      "</section>";
  };

  /* ---------- COLLECTION ---------- */
  SCREENS.collection = function () {
    let list = state.collection.slice().filter((o) => charOf(o));
    if (uiState.collFilter !== "all") list = list.filter((o) => charOf(o).rarity === uiState.collFilter);
    const sorters = {
      rarity: byRarityOwned,
      atk: (a, b) => E.statsWithPassive(charOf(b), b.level, b.star).atk - E.statsWithPassive(charOf(a), a.level, a.star).atk,
      level: (a, b) => b.level - a.level || b.star - a.star,
    };
    list.sort(sorters[uiState.collSort] || sorters.rarity);
    return topbar("collection") +
      '<section class="screen">' +
        '<div class="row-between"><h2 class="screen-title">🃏 คอลเลกชัน (' + state.collection.length + ")</h2>" +
          '<div class="filters">' +
            '<select onchange="App.setFilter(this.value)">' +
              '<option value="all">ทุกระดับ</option>' +
              D.RARITY_ORDER.map((r) => '<option value="' + r + '"' + (uiState.collFilter === r ? " selected" : "") + ">" + r + "</option>").join("") +
            "</select>" +
            '<select onchange="App.setSort(this.value)">' +
              '<option value="rarity"' + (uiState.collSort === "rarity" ? " selected" : "") + ">เรียงตามระดับ</option>" +
              '<option value="atk"' + (uiState.collSort === "atk" ? " selected" : "") + ">เรียงตาม ATK</option>" +
              '<option value="level"' + (uiState.collSort === "level" ? " selected" : "") + ">เรียงตามเลเวล</option>" +
            "</select>" +
          "</div>" +
        "</div>" +
        (list.length
          ? '<div class="card-grid cabinet">' + list.map((o) => cardHTML(charOf(o), o, { cls: "clickable", attrs: 'onclick="App.openCard(\'' + o.uid + '\')"' })).join("") + "</div>"
          : '<p class="empty">ยังไม่มีการ์ด — ไปเปิดแพ็กกันเถอะ!</p>') +
      "</section>";
  };

  function openCard(uid) {
    const o = ownedByUid(uid);
    if (!o) return;
    uiState.detailUid = uid;
    const char = charOf(o);
    if (!char) return toast("การ์ดนี้ยังไม่ได้กำหนดระดับ");
    const st = E.statsWithPassive(char, o.level, o.star);
    const cap = D.RARITY[char.rarity].levelCap;
    const si = E.starUpInfo(o, char);
    const sh = state.inventory.shards[char.id] || 0;
    const sk = char.skills;
    const skins = char.skins || [];
    const skinPicker = skins.length
      ? '<div class="skin-picker"><div class="sk-title">🎨 สกิน</div><div class="skin-opts">' +
          '<button class="skin-opt ' + (activeSkin(char.id) ? "" : "sel") + '" onclick="App.setSkin(\'' + char.id + "','')\">" +
            '<span class="sk-img"><img loading="lazy" src="' + esc(char.gif || char.img || "") + '" data-gen="' + genArt(char) + '" alt="" onerror="App.imgErr(this)"></span><span>ปกติ</span></button>' +
          skins.map((s) => {
            const lock = skinLocked(char.id, s.id);
            return '<button class="skin-opt ' + (state.skinChoice[char.id] === s.id ? "sel" : "") + (lock ? " locked" : "") + '"' +
              (lock ? ' disabled title="ยังไม่ปลดล็อก — สุ่มได้จากตู้"' : " onclick=\"App.setSkin('" + char.id + "','" + s.id + "')\"") + ">" +
              '<span class="sk-img"><img loading="lazy" src="' + esc(s.gif || s.img || "") + '" data-gen="' + genArt(char) + '" alt="" onerror="App.imgErr(this)">' +
              (lock ? '<span class="sk-lock">🔒</span>' : "") + "</span>" +
              "<span>" + esc(s.name) + "</span></button>";
          }).join("") +
        "</div></div>"
      : "";
    modal(
      '<div class="detail">' +
        '<div class="detail-card">' + cardHTML(char, o, {}) + "</div>" +
        '<div class="detail-info">' +
          '<h3>' + esc(char.name) + '</h3>' +
          '<div class="detail-sub">' + esc(char.anime) + " · " + D.ELEMENTS[char.element].icon + " " + D.ELEMENTS[char.element].name + " · " + D.ROLES[char.role].icon + " " + D.ROLES[char.role].name + "</div>" +
          '<div class="stat-grid">' +
            statBox("ATK", st.atk) + statBox("HP", st.hp) + statBox("DEF", st.def) + statBox("SPD", st.spd) +
          "</div>" +
          '<div class="skill-list">' +
            '<div><b>สกิล: ' + esc(sk.basic.name) + "</b><small>พลัง x" + sk.basic.power + "</small></div>" +
            '<div><b>ติดตัว: ' + esc(sk.passive.name) + "</b><small>" + esc(sk.passive.desc) + "</small></div>" +
            '<div><b>ไม้ตาย: ' + esc(sk.ultimate.name) + "</b><small>พลัง x" + sk.ultimate.power + " · " + esc(sk.ultimate.desc || "") + "</small></div>" +
          "</div>" +
          skinPicker +
          '<div class="prog-line">เลเวล ' + o.level + "/" + cap + " · ดาว " + "★".repeat(o.star) + "</div>" +
          '<div class="exp-line">EXP ' + o.exp + "/" + E.expNeeded(o.level) + '</div>' +
          '<div class="shard-line">ชิ้นส่วน ' + esc(char.name) + ": " + sh + "</div>" +
          '<div class="detail-actions">' +
            '<button class="btn" onclick="App.doLevelUp(\'' + uid + '\')">⬆ เพิ่มเลเวล (🪙 ' + E.levelUpGoldCost(o.level) + ")</button>" +
            '<button class="btn" onclick="App.doExpItem(\'' + uid + '\')">🧪 ใช้ยา EXP (มี ' + state.inventory.expItem + ")</button>" +
            (si.ok
              ? '<button class="btn gold" onclick="App.doStarUp(\'' + uid + '\')">★ เพิ่มดาว ' + si.nextStar + " (ชิ้นส่วน " + si.shardNeed + " + 🪙 " + si.goldNeed + ")</button>"
              : '<button class="btn" disabled>★ ดาวสูงสุดแล้ว</button>') +
            '<button class="btn ghost" onclick="App.toggleTeam(\'' + uid + '\')">' + (state.team.includes(uid) ? "➖ ออกจากทีม" : "➕ เข้าทีม") + "</button>" +
          "</div>" +
        "</div>" +
      "</div>"
    );
  }
  function statBox(l, v) { return '<div class="stat-box"><small>' + l + "</small><b>" + v + "</b></div>"; }

  /* ---------- TEAM ---------- */
  SCREENS.team = function () {
    const slots = [];
    for (let i = 0; i < 5; i++) {
      const uid = state.team[i];
      const o = uid ? ownedByUid(uid) : null;
      if (o) slots.push(cardHTML(charOf(o), o, { cls: "clickable", attrs: 'onclick="App.removeFromTeam(' + i + ')"' }).replace("</div>\n", "</div>"));
      else slots.push('<div class="slot-empty">ช่อง ' + (i + 1) + "</div>");
    }
    const teamCharIds = {};
    state.team.forEach((uid) => { const o = ownedByUid(uid); if (o) teamCharIds[o.charId] = 1; });
    const pool = state.collection.filter((o) => !state.team.includes(o.uid) && charOf(o) && !teamCharIds[o.charId]).sort(byRarityOwned);
    return topbar("team") +
      '<section class="screen">' +
        '<h2 class="screen-title">👥 จัดทีม (' + state.team.length + "/5)</h2>" +
        '<div class="team-slots">' + slots.join("") + "</div>" +
        '<p class="screen-sub">คลิกการ์ดในทีมเพื่อนำออก · ลำดับซ้าย→ขวาคือตำแหน่งที่ 1-5</p>' +
        '<h3>การ์ดที่ยังไม่เข้าทีม</h3>' +
        (pool.length
          ? '<div class="card-grid small">' + pool.map((o) => cardHTML(charOf(o), o, { cls: "clickable", attrs: 'onclick="App.addToTeam(\'' + o.uid + '\')"' })).join("") + "</div>"
          : '<p class="empty">ไม่มีการ์ดว่าง</p>') +
      "</section>";
  };

  /* ---------- BATTLE (mode list) ---------- */
  SCREENS.battle = function () {
    const pr = state.progress;
    function badges() { return ""; }
    const story = D.STAGES.map((s) => {
      const cleared = !!pr.stages[s.id];
      return '<button class="mode-row" onclick="App.prebattle(\'story\',\'' + s.id + '\')">' +
        '<span class="mr-ic">' + (cleared ? "✅" : "📍") + "</span>" +
        '<span class="mr-body"><b>' + esc(D.CHAPTERS[s.chapter]) + " — " + esc(s.name) + '</b><small>' + s.enemies.length + " ศัตรู · รางวัล 🪙" + s.reward.gold + " 💎" + s.reward.gems + "</small></span>" +
        '<span class="mr-go">' + (cleared ? "เล่นซ้ำ" : "เริ่ม") + "</span></button>";
    }).join("");

    const bosses = D.BOSSES.map((b) => '<button class="mode-row boss" onclick="App.prebattle(\'boss\',\'' + b.id + '\')">' +
      '<span class="mr-ic">👹</span><span class="mr-body"><b>' + esc(b.name) + "</b><small>" + esc(b.mechanic) + "</small></span>" +
      '<span class="mr-go">' + (state.progress.bosses[b.id] ? "เล่นซ้ำ" : "ท้าทาย") + "</span></button>").join("");

    const towerRows = [];
    for (let n = 1; n <= D.TOWER_MAX_FLOOR; n++) {
      const unlocked = n <= state.progress.tower + 1;
      towerRows.push('<button class="mode-row ' + (unlocked ? "" : "locked") + '" ' + (unlocked ? 'onclick="App.prebattle(\'tower\',' + n + ')"' : "disabled") + ">" +
        '<span class="mr-ic">' + (n <= state.progress.tower ? "✅" : unlocked ? "🗼" : "🔒") + "</span>" +
        '<span class="mr-body"><b>ชั้นที่ ' + n + "</b><small>" + (unlocked ? "รางวัลผ่านชั้น" : "ล็อกอยู่") + "</small></span>" +
        '<span class="mr-go">' + (n <= state.progress.tower ? "ผ่านแล้ว" : unlocked ? "เริ่ม" : "🔒") + "</span></button>");
    }

    const arena = D.ARENA_TIERS.map((a) => '<button class="mode-row" onclick="App.prebattle(\'arena\',\'' + a.id + '\')">' +
      '<span class="mr-ic">🏅</span><span class="mr-body"><b>' + esc(a.name) + "</b><small>ทีม NPC " + a.enemies.length + " ตัว · รางวัล 🪙" + a.reward.gold + " 💎" + a.reward.gems + "</small></span>" +
      '<span class="mr-go">' + (state.progress.arena[a.id] ? "เล่นซ้ำ" : "เริ่ม") + "</span></button>").join("");

    const events = D.EVENTS.map((ev) => '<button class="mode-row event" onclick="App.prebattle(\'event\',\'' + ev.id + '\')">' +
      '<span class="mr-ic">🎉</span><span class="mr-body"><b>' + esc(ev.name) + "</b><small>" + esc(ev.desc) + "</small></span>" +
      '<span class="mr-go">' + (state.progress.events[ev.id] ? "เล่นซ้ำ" : "เข้าร่วม") + "</span></button>").join("");

    return topbar("battle") +
      '<section class="screen">' +
        '<h2 class="screen-title">⚔️ ต่อสู้</h2>' +
        (state.team.length === 0 ? '<p class="warn">⚠ ยังไม่ได้จัดทีม — ไปที่ “จัดทีม” ก่อน</p>' : "") +
        '<h3 class="mode-head">📖 Story Mode</h3><div class="mode-list">' + story + "</div>" +
        '<h3 class="mode-head">👹 Boss Battle</h3><div class="mode-list">' + bosses + "</div>" +
        '<h3 class="mode-head">🗼 Tower Mode</h3><div class="mode-list tower">' + towerRows.join("") + "</div>" +
        '<h3 class="mode-head">🏅 Arena</h3><div class="mode-list">' + arena + "</div>" +
        '<h3 class="mode-head">🎉 Event Mode</h3><div class="mode-list">' + events + "</div>" +
      "</section>";
  };

  /* ---------- PREBATTLE ---------- */
  SCREENS.prebattle = function () {
    const ctx = battleCtx;
    if (!ctx) return topbar("battle") + '<section class="screen"><p class="empty">ไม่พบข้อมูลด่าน</p></section>';
    const team = teamOwned();
    const teamHTML = team.map((o) => cardHTML(charOf(o), o, { cls: "pb-card" })).join("");
    const enemyHTML = ctx.enemyDefs.map((e) => {
      const c = D.CHAR_BY_ID[e.id];
      if (!c) return "";
      return cardHTML(c, { level: e.level, star: e.star }, { cls: "pb-card enemy-card" });
    }).join("");
    return topbar("battle") +
      '<section class="screen">' +
        '<h2 class="screen-title">' + esc(ctx.name) + "</h2>" +
        (state.team.length === 0 ? '<p class="warn">⚠ ยังไม่ได้จัดทีม</p>' : "") +
        '<div class="prebattle">' +
          '<div class="pb-side"><h3>ทีมของคุณ</h3><div class="card-grid">' + (teamHTML || '<p class="empty">ไม่มี</p>') + "</div></div>" +
          '<div class="vs">VS</div>' +
          '<div class="pb-side"><h3>ทีมศัตรู</h3><div class="card-grid">' + enemyHTML + "</div></div>" +
        "</div>" +
        (ctx.mechanic ? '<p class="mechanic">⚙ กลไก: ' + esc(ctx.mechanic) + "</p>" : "") +
        '<div class="center"><button class="btn primary big" ' + (state.team.length === 0 ? "disabled" : "") + " onclick=\"App.startBattle()\">▶ เริ่มต่อสู้</button></div>" +
      "</section>";
  };

  /* ---------- BATTLE ---------- */
  SCREENS.battlefield = function () {
    if (!battle) return topbar("battle") + '<section class="screen"><p class="empty">ไม่มีการต่อสู้</p></section>';
    const renderUnits = (side) => {
      const units = battle.units.filter((u) => u.side === side);
      return units.map((u) => {
        const pct = Math.round((u.hp / u.maxHp) * 100);
        const active = battle.awaiting && battle.awaiting.uid === u.uid;
        const sel = uiState.targetUid === u.uid;
        const cls = "bu rar-" + u.rarity + (u.alive ? "" : " dead") + (active ? " active" : "") + (sel ? " targetsel" : "") +
          (side === "enemy" && u.alive && battle.awaiting ? " targetable" : "");
        const clickAttr = side === "enemy" && u.alive && battle.awaiting ? 'onclick="App.selectTarget(\'' + u.uid + '\')"' : "";
        return '<div class="' + cls + '" ' + clickAttr + ">" +
          '<div class="bu-art"><img loading="lazy" src="' + imgSrcFor(u) + '" data-gen="' + genArt(u) + '" alt="" onerror="App.imgErr(this)"></div>' +
          '<div class="bu-top"><span class="bu-name">' + esc(u.name) + '</span><span class="bu-el">' + D.ELEMENTS[u.element].icon + "</span></div>" +
          '<div class="hpbar"><i style="width:' + pct + '%"></i><span>' + u.hp + "/" + u.maxHp + "</span></div>" +
          '<div class="ultbar"><i style="width:' + u.ult + '%"></i></div>' +
          '<div class="bu-buffs">' + u.buffs.map((b) => '<span class="bf">' + b.stat + (b.value > 0 ? "+" : "") + Math.round(b.value * 100) + "%</span>").join("") +
            u.statuses.map((s) => '<span class="st st-' + s.name + '">' + ({ poison: "☠", burn: "🔥", stun: "💫", shield: "🛡", regen: "➕" }[s.name] || s.name) + "</span>").join("") + "</div>" +
          "</div>";
      }).join("");
    };
    const log = battle.log.map((l) => '<div class="logline ' + l.cls + '">' + esc(l.text) + "</div>").join("");
    let actionBar = "";
    if (battle.awaiting && battle.awaiting.side === "player") {
      const a = battle.awaiting;
      const canUlt = a.ult >= 100;
      actionBar =
        '<div class="action-bar">' +
          '<div class="acting">เทิร์นของ <b>' + esc(a.name) + "</b> · ไม้ตาย " + Math.round(a.ult) + "%</div>" +
          '<div class="act-btns">' +
            '<button class="btn" onclick="App.battleAction(\'attack\')">🗡 โจมตี</button>' +
            '<button class="btn" onclick="App.battleAction(\'skill\')">✨ สกิล: ' + esc(a.skills.basic.name) + "</button>" +
            '<button class="btn" onclick="App.battleAction(\'defend\')">🛡 ป้องกัน</button>' +
            '<button class="btn gold" ' + (canUlt ? "" : "disabled") + " onclick=\"App.battleAction('ult')\">💥 ไม้ตาย: " + esc(a.skills.ultimate.name) + "</button>" +
          "</div>" +
          '<small class="hint">คลิกการ์ดศัตรูเพื่อเลือกเป้าหมาย (ค่าเริ่มต้น: ศัตรู HP ต่ำสุด)</small>' +
        "</div>";
    } else if (battle.status !== "ongoing") {
      actionBar = '<div class="action-bar"><button class="btn primary big" onclick="App.closeBattle()">เสร็จสิ้น</button></div>';
    }
    return topbar("battle") +
      '<section class="screen battle-screen">' +
        '<div class="bt-head"><span>รอบที่ ' + battle.round + "</span><span>" + esc(battleCtx.name) + "</span></div>" +
        '<div class="bt-side enemy"><h4>ศัตรู</h4><div class="bu-row">' + renderUnits("enemy") + "</div></div>" +
        '<div class="bt-side"><h4>ทีมของคุณ</h4><div class="bu-row">' + renderUnits("player") + "</div></div>" +
        '<div class="bt-log">' + log + "</div>" +
        actionBar +
      "</section>";
  };
  function scrollLog() {
    const el = document.querySelector(".bt-log");
    if (el) el.scrollTop = el.scrollHeight;
  }

  /* ---------- MISSIONS ---------- */
  SCREENS.missions = function () {
    checkDailyReset();
    const rows = D.DAILY_TEMPLATES.map((m) => {
      const prog = Math.min(state.missions.progress[m.id] || 0, m.target);
      const done = prog >= m.target;
      const claimed = !!state.missions.claimed[m.id];
      const rw = [m.reward.gold ? "🪙" + m.reward.gold : "", m.reward.gems ? "💎" + m.reward.gems : "", m.reward.expItem ? "🧪" + m.reward.expItem : ""].filter(Boolean).join(" ");
      return '<div class="mission ' + (claimed ? "claimed" : "") + '">' +
        '<div class="ms-body"><b>' + esc(m.desc) + '</b><div class="bar"><i style="width:' + Math.round((prog / m.target) * 100) + '%"></i></div><small>' + prog + "/" + m.target + " · รางวัล " + rw + "</small></div>" +
        (claimed ? '<span class="ms-done">✅ รับแล้ว</span>'
          : '<button class="btn ' + (done ? "gold" : "") + '" ' + (done ? "" : "disabled") + " onclick=\"App.claim('" + m.id + "')\">รับรางวัล</button>") +
        "</div>";
    }).join("");
    return topbar("missions") +
      '<section class="screen">' +
        '<h2 class="screen-title">📋 ภารกิจประจำวัน</h2>' +
        '<p class="screen-sub">รีเซ็ตอัตโนมัติทุกวัน · ทำครบแล้วกดรับรางวัล</p>' +
        '<div class="mission-list">' + rows + "</div>" +
      "</section>";
  };

  /* ---------- SHOP ---------- */
  function exchTile(it, pool) {
    const cost = exchCost(it.rarity);
    const owned = it.kind === "unit"
      ? state.collection.some((o) => o.charId === it.char.id)
      : skinOwned(it.cardId, it.skinId);
    const img = it.kind === "unit" ? imgSrcFor(it.char) : (it.sk.gif || it.sk.img || imgSrcFor(it.char));
    const afford = pool >= cost && !(it.kind === "skin" && owned);
    const onclick = it.kind === "unit"
      ? "App.exchangeCard('" + it.char.id + "')"
      : "App.exchangeSkin('" + esc(it.cardId) + "','" + esc(it.skinId) + "')";
    return '<div class="exch-tile rar-' + it.rarity + '">' +
      '<div class="exch-art">' +
        '<img loading="lazy" src="' + img + '" data-gen="' + genArt(it.char) + '" alt="' + esc(it.name) + '" onerror="App.imgErr(this)">' +
        '<span class="rarity-tag">' + it.rarity + "</span>" +
        (it.kind === "skin" ? '<span class="exch-kind">🎨</span>' : "") +
        (owned ? '<span class="exch-owned">มีแล้ว</span>' : "") +
      "</div>" +
      '<div class="exch-name">' + esc(it.name) + "</div>" +
      (it.kind === "skin" ? '<div class="exch-sub">สกินของ ' + esc(it.ownerName) + "</div>" : "") +
      '<button class="btn ' + (afford ? "gold" : "") + '" ' + (afford ? "" : "disabled") + ' onclick="' + onclick + '">' + (owned ? "⭐ " : "") + "แลก " + cost + " 🧩</button>" +
    "</div>";
  }
  SCREENS.shop = function () {
    const items = D.SHOP.filter((s) => s.price > 0).map((s) => {
      const cur = s.currency === "gold" ? "🪙" : "💎";
      const bal = s.currency === "gold" ? state.player.gold : state.player.gems;
      return '<div class="shop-item"><div class="si-name">' + esc(s.name) + '</div><div class="si-desc">' + esc(s.desc) + "</div>" +
        '<div class="si-buy"><span>' + cur + " " + fmt(s.price) + '</span><button class="btn" ' + (bal >= s.price ? "" : "disabled") + " onclick=\"App.buy('" + s.id + "')\">ซื้อ</button></div></div>";
    }).join("");

    /* ----- แลกการ์ด/สกินด้วยเศษซ้ำ (UR+) ----- */
    const pool = shardPoolTotal();
    const all = exchItems();
    const rf = uiState.exchFilter || "all";
    const rarities = D.RARITY_ORDER.filter((r) => all.some((c) => c.rarity === r));
    const shown = rf === "all" ? all : all.filter((c) => c.rarity === rf);
    const filterBtns = ["all"].concat(rarities).map((r) =>
      '<button class="exch-filter ' + (rf === r ? "active" : "") + '" onclick="App.exchangeFilter(\'' + r + '\')">' + (r === "all" ? "ทั้งหมด" : r) + "</button>").join("");
    const exchGrid = shown.length
      ? '<div class="exch-grid">' + shown.map((it) => exchTile(it, pool)).join("") + "</div>"
      : '<p class="empty">ยังไม่มีการ์ด/สกินระดับ UR ขึ้นไปในระบบ</p>';

    return topbar("shop") +
      '<section class="screen"><h2 class="screen-title">🛒 ร้านค้า</h2>' +
        '<p class="screen-sub">มี 🪙 ' + fmt(state.player.gold) + " · 🧪 EXP " + state.inventory.expItem + " · 🔧 วัสดุ " + state.inventory.enhMat + "</p>" +
        '<div class="shop-grid">' + items + "</div>" +
        '<h3 class="shop-head">🎴 แลกการ์ด/สกินด้วยเศษซ้ำ (' + ((D.EXCHANGE && D.EXCHANGE.minRarity) || "UR") + " ขึ้นไป)</h3>" +
        '<p class="screen-sub">เศษซ้ำที่มี (UR+): 🧩 ' + fmt(pool) + " · เลือกใบที่ต้องการแล้วกด “แลก” (รวมสกินด้วย)</p>" +
        '<div class="exch-filters">' + filterBtns + "</div>" +
        exchGrid +
      "</section>";
  };

  /* ---------- STATUS ---------- */
  SCREENS.status = function () {
    const p = state.player;
    const shardLines = Object.keys(state.inventory.shards).filter((k) => state.inventory.shards[k] > 0)
      .map((k) => '<span class="shard-chip">' + esc(D.CHAR_BY_ID[k] ? D.CHAR_BY_ID[k].name : k) + ": " + state.inventory.shards[k] + "</span>").join("") || '<span class="hint">— ยังไม่มีชิ้นส่วน —</span>';
    const cleared = Object.keys(state.progress.stages).length;
    const bgList = D.PROFILE_BGS || [];
    const ownedBgs = state.player.ownedBgs || [];
    const curBg = state.player.profileBg;
    const bgSwatches = bgList.map((b) => {
      const has = ownedBgs.includes(b.id);
      const cls = "bg-swatch pb-" + b.id + (curBg === b.id ? " active" : "") + (has ? "" : " locked");
      return '<button class="' + cls + '"' + (has ? ' onclick="App.equipBg(\'' + b.id + '\')"' : " disabled") +
        ' title="' + esc(b.name) + '">' +
        (has ? "" : '<span class="bg-lock">🔒</span>') +
        '<span class="bg-name">' + esc(b.name) + "</span></button>";
    }).join("");
    return topbar("status") +
      '<section class="screen"><h2 class="screen-title">📊 สถานะผู้เล่น</h2>' +
        '<div class="status-grid">' +
          '<div class="stat-block"><h4>โปรไฟล์</h4><div>ชื่อ: ' + esc(p.name) + "</div><div>เลเวล: " + p.level + "</div><div>EXP: " + p.exp + "/" + 100 * p.level + "</div></div>" +
          '<div class="stat-block"><h4>ทรัพยากร</h4><div>🪙 Gold: ' + fmt(p.gold) + "</div><div>💎 Gems: " + fmt(p.gems) + "</div><div>🧪 ยา EXP: " + state.inventory.expItem + "</div><div>🔧 วัสดุเสริมพลัง: " + state.inventory.enhMat + "</div></div>" +
          '<div class="stat-block"><h4>ความก้าวหน้า</h4><div>การ์ดในครอบครอง: ' + state.collection.length + '</div><div>ด่านที่ผ่าน: ' + cleared + "/" + D.STAGES.length + '</div><div>บอสที่ชนะ: ' + Object.keys(state.progress.bosses).length + "/" + D.BOSSES.length + '</div><div>หอคอย: ชั้น ' + state.progress.tower + "</div></div>" +
          '<div class="stat-block"><h4>ภารกิจที่สำเร็จ</h4><div>' + Object.keys(state.missions.claimed).length + " รายการวันนี้</div></div>" +
        "</div>" +
        '<h4>ชิ้นส่วนตัวละคร</h4><div class="shard-wrap">' + shardLines + "</div>" +
        '<h4>🖼 ฉากหลังโปรไฟล์ (' + ownedBgs.length + "/" + bgList.length + ')</h4>' +
        (bgList.length ? '<div class="bg-picker">' + bgSwatches + "</div>" : '<p class="hint">— ยังไม่มีฉากหลัง —</p>') +
        '<h4>บันทึกข้อมูล</h4><div class="save-actions">' +
          '<button class="btn" onclick="App.exportSave()">⬇ ส่งออกเซฟ (JSON)</button>' +
          '<button class="btn" onclick="App.importSave()">⬆ นำเข้าเซฟ</button>' +
          '<button class="btn danger" onclick="App.confirmReset()">🗑 ล้างเซฟทั้งหมด</button>' +
        "</div>" +
        '<p class="hint">ข้อมูลบันทึกใน localStorage ของเบราว์เซอร์นี้เท่านั้น</p>' +
      "</section>";
  };

  /* ---------- ADMIN (แดชบอร์ดแอดมิน) ---------- */
  const rarOpts = (sel) =>
    '<option value=""' + (sel ? "" : " selected") + ">— ไม่กำหนด —</option>" +
    D.RARITY_ORDER.map((r) => '<option value="' + r + '"' + (sel === r ? " selected" : "") + ">" + r + "</option>").join("");
  const elOpts = (sel) => Object.keys(D.ELEMENTS).map((k) =>
    '<option value="' + k + '"' + (sel === k ? " selected" : "") + ">" + D.ELEMENTS[k].icon + " " + D.ELEMENTS[k].name + "</option>").join("");
  const roleOpts = (sel) => Object.keys(D.ROLES).map((k) =>
    '<option value="' + k + '"' + (sel === k ? " selected" : "") + ">" + D.ROLES[k].icon + " " + k + "</option>").join("");

  const isSkinCard = (c) => !!(c && (c.isSkin || CARDSTORE.looksLikeSkin(c.img) || (D.RARITY[c.rarity] && D.RARITY[c.rarity].skinOnly)));

  SCREENS.admin = function () {
    const tab = uiState.adminTab || "units";
    const tbtn = (id, label) => '<button class="admin-tab ' + (tab === id ? "active" : "") + '" onclick="App.adminTab(\'' + id + '\')">' + label + "</button>";
    const tabs = '<div class="admin-tabs">' +
      tbtn("units", "🧑 การ์ดยูนิต") + tbtn("skins", "🎨 การ์ดสกิน") + tbtn("cabs", "🎰 ตู้กาชา") +
    "</div>";
    return topbar("admin") +
      '<section class="screen">' +
        '<h2 class="screen-title">🛠️ แดชบอร์ดแอดมิน</h2>' +
        tabs +
        (tab === "cabs" ? cabAdmin() : cardsAdmin(tab)) +
      "</section>";
  };

  function cardsAdmin(tab) {
    const all = CARDSTORE.loadCards();
    const wantSkin = tab === "skins";
    const skinCards = all.filter(isSkinCard).slice().sort(byRarity);
    const order = all.map((c, i) => i)
      .filter((i) => isSkinCard(all[i]) === wantSkin)
      .sort((a, b) => byRarity(all[a], all[b]));
    const rows = order.map((i) => {
      const c = all[i];
      const el = D.ELEMENTS[c.element] || D.ELEMENTS.light;
      const skins = c.skins || [];
      const skinRows = skins.map((s, si) => {
        const srcCard = s.src ? all.find((x) => x.id === s.src) : null;
        const sr = (srcCard && srcCard.rarity) || c.rarity || "N";
        return '<div class="skin-row">' +
          '<span class="rar-pill rar-' + sr + '" title="ระดับมาจากการ์ดสกิน">' + esc(sr) + "</span>" +
          '<input type="text" value="' + esc(s.name || "") + '" placeholder="ชื่อสกิน" onchange="App.adminSkinEdit(' + i + "," + si + ",'name',this.value)\">" +
          '<input type="text" value="' + esc(s.img || "") + '" placeholder="Card_sets/ไฟล์รูป" onchange="App.adminSkinEdit(' + i + "," + si + ",'img',this.value)\">" +
          '<input type="text" value="' + esc(s.gif || "") + '" placeholder="gif (ไม่บังคับ)" onchange="App.adminSkinEdit(' + i + "," + si + ",'gif',this.value)\">" +
          '<button class="btn ghost" onclick="App.adminSkinDelete(' + i + "," + si + ')">✕</button>' +
        "</div>";
      }).join("");
      const pickOpen = !!uiState.skinOpen[c.id];
      const pickGallery = wantSkin ? "" : (
        '<div class="sk-pick">' +
          '<button type="button" class="btn ghost sk-open" onclick="App.adminSkinOpen(\'' + esc(c.id) + '\')">' +
            (pickOpen ? "🔽 ซ่อนการ์ดสกิน" : "🔍 เปิดหาสกิน (" + skinCards.length + ")") +
          "</button>" +
          (pickOpen
            ? (skinCards.length
                ? '<div class="sk-pick-grid">' + skinCards.map((sc) => {
                    const assigned = skins.some((s) => s.src === sc.id);
                    return '<button type="button" class="sk-pick-item' + (assigned ? " assigned" : "") + '" title="' + esc(sc.name || sc.id) + '" onclick="App.adminSkinPick(' + i + ",'" + esc(sc.id) + "')\">" +
                      '<img loading="lazy" src="' + esc(sc.gif || sc.img || "") + '" data-gen="' + genArt(sc) + '" alt="" onerror="App.imgErr(this)">' +
                      (assigned ? '<span class="sk-check" title="ตั้งเป็นสกินของตัวนี้แล้ว">✓</span>' : "") +
                    "</button>";
                  }).join("") + "</div>"
                : '<p class="hint">ยังไม่มีการ์ดสกิน — ทำที่แท็บ “การ์ดสกิน” ก่อน</p>')
            : "") +
        "</div>");
      const toggleBtn = CARDSTORE.looksLikeSkin(c.img)
        ? '<span class="admin-skin-toggle locked" title="ชื่อไฟล์มี _ หน้าตัวเลข จึงเป็นการ์ดสกินอัตโนมัติ">🔒 สกินตามชื่อไฟล์</span>'
        : (wantSkin
          ? '<button class="btn ghost admin-skin-toggle" onclick="App.adminToggleSkin(' + i + ')">🧑 ทำเป็นยูนิต</button>'
          : '<button class="btn ghost admin-skin-toggle" onclick="App.adminToggleSkin(' + i + ')">🎨 ทำเป็นสกิน</button>');
      return '<div class="admin-card' + (wantSkin ? " skin-card" : "") + '">' +
        '<div class="admin-preview ' + (c.rarity ? "rar-" + c.rarity : "") + '">' +
          '<div class="fallback" style="background:radial-gradient(circle at 50% 32%,' + el.color + "55,#0b0a1a)\"><span class=\"fb-initial\">" + esc((c.name || "?").charAt(0)) + "</span></div>" +
          '<img loading="lazy" src="' + esc(c.gif || c.img || "") + '" alt="" onerror="App.imgErr(this)">' +
        "</div>" +
        '<div class="admin-fields">' +
          '<label>ชื่อการ์ด<input type="text" value="' + esc(c.name || "") + '" onchange="App.adminEdit(' + i + ",'name',this.value)\"></label>" +
          '<label>ไฟล์รูป (ใน Card_sets)<input type="text" value="' + esc(c.img || "") + '" onchange="App.adminEdit(' + i + ",'img',this.value)\"></label>" +
          '<label>ไฟล์ GIF เคลื่อนไหว (ไม่บังคับ)<input type="text" value="' + esc(c.gif || "") + '" placeholder="Card_sets/ชื่อไฟล์.gif" onchange="App.adminEdit(' + i + ",'gif',this.value)\"></label>" +
          '<div class="admin-row">' +
            '<label>ระดับ<select onchange="App.adminEdit(' + i + ",'rarity',this.value)\">" + rarOpts(c.rarity) + "</select></label>" +
            '<label>ธาตุ<select onchange="App.adminEdit(' + i + ",'element',this.value)\">" + elOpts(c.element) + "</select></label>" +
            '<label>บทบาท<select onchange="App.adminEdit(' + i + ",'role',this.value)\">" + roleOpts(c.role) + "</select></label>" +
          "</div>" +
          (wantSkin ? "" :
            '<div class="skins-editor">' +
              '<div class="sk-title">🎨 สกินของตัวละครนี้ (' + skins.length + ")</div>" +
              pickGallery +
              (skinRows || '<p class="hint">ยังไม่มีสกิน</p>') +
              '<button class="btn" onclick="App.adminSkinAdd(' + i + ')">➕ เพิ่มสกิน (กำหนดรูปเอง)</button>' +
            "</div>") +
        "</div>" +
        '<div class="admin-card-actions">' + toggleBtn +
          '<button class="btn danger admin-del" onclick="App.adminDelete(' + i + ')">🗑 ลบ</button></div>' +
      "</div>";
    }).join("");
    const count = all.filter((c) => isSkinCard(c) === wantSkin).length;

    return '<p class="screen-sub">' +
        (wantSkin
          ? "การ์ดเหล่านี้ถือเป็น “สกิน” — จะไม่ถูกสุ่มเป็นตัวละคร · ใช้เป็นภาพสกินให้ตัวละครได้"
          : "การ์ดยูนิต — ใช้ต่อสู้/สุ่มเป็นตัวละคร · กำหนดระดับ/ธาตุ/บทบาท และจัดการสกินได้") +
        "</p>" +
      '<div class="admin-add">' +
        '<h3>➕ เพิ่มการ์ดใหม่</h3>' +
        '<div class="admin-row">' +
          '<label>ชื่อการ์ด<input id="adm-name" type="text" placeholder="เช่น Chosuke Nakamoto"></label>' +
          '<label>ไฟล์รูป<input id="adm-img" type="text" placeholder="Card_sets/ชื่อไฟล์.png"></label>' +
          '<label>ไฟล์ GIF (ไม่บังคับ)<input id="adm-gif" type="text" placeholder="Card_sets/ชื่อไฟล์.gif"></label>' +
        "</div>" +
        '<div class="admin-row">' +
          '<label>ชนิด<select id="adm-isSkin">' +
            '<option value=""' + (wantSkin ? "" : " selected") + ">🧑 การ์ดยูนิต</option>" +
            '<option value="1"' + (wantSkin ? " selected" : "") + ">🎨 การ์ดสกิน</option></select></label>" +
          '<label>ระดับ<select id="adm-rarity">' + rarOpts("N") + "</select></label>" +
          '<label>ธาตุ<select id="adm-element">' + elOpts("light") + "</select></label>" +
          '<label>บทบาท<select id="adm-role">' + roleOpts("Attacker") + "</select></label>" +
        "</div>" +
        '<button class="btn primary" onclick="App.adminAdd()">เพิ่มการ์ด</button>' +
      "</div>" +
      '<h3 class="mode-head">' + (wantSkin ? "🎨 การ์ดสกิน" : "🧑 การ์ดยูนิต") + " (" + count + ")</h3>" +
      '<div class="admin-list">' + (rows || '<p class="empty">ยังไม่มีการ์ดในหมวดนี้</p>') + "</div>" +
      '<div class="admin-foot">' +
        '<button class="btn" onclick="App.adminReset()">↺ คืนค่าเริ่มต้น</button>' +
        '<button class="btn" onclick="App.adminExport()">⬇ ส่งออกการ์ด (JSON)</button>' +
        '<button class="btn" onclick="App.adminImport()">⬆ นำเข้าการ์ด</button>' +
      "</div>" +
      '<p class="hint">การ์ดที่ “ไม่กำหนดระดับ” จะยังไม่ถูกใช้ในเกม · การ์ดสกินจะไม่ถูกสุ่มเป็นตัวละคร · การ์ดที่มี _ หน้าตัวเลขในชื่อไฟล์ถือเป็นสกินอัตโนมัติ · ไอดีการ์ดสร้างจากชื่อโดยอัตโนมัติ</p>';
  }

  /* ---------- ตู้กาชา (ส่วนในแดชบอร์ดแอดมิน) ---------- */
  const GACHA_IMGS = ["gacha/gacha_1.jpg", "gacha/gacha_2.jpg", "gacha/gacha_3.jpg", "gacha/gacha_4.png", "gacha/gacha_5.png", "gacha/gacha_6.png"];
  function cabAdmin() {
    const cabs = CABSTORE.loadCabinets();
    const cards = CARDSTORE.loadCards();
    const datalist = '<datalist id="gacha-img-list">' + GACHA_IMGS.map((p) => '<option value="' + p + '"></option>').join("") + "</datalist>";
    const rows = cabs.map((c, i) => cabCard(i, c, cards)).join("");
    return '<p class="screen-sub">ปรับชื่อ · รูปหน้าตู้ · เรทการออก · และ “ตัวในตู้” — ติ๊กได้ทั้งตัวละครและสกิน ตู้จะออกเฉพาะที่ติ๊ก (ไม่ติ๊กอะไรเลย = ตู้ถูกล็อก)</p>' +
      datalist +
      '<div class="admin-list">' + (rows || '<p class="empty">ยังไม่มีตู้</p>') + "</div>" +
      '<button class="btn primary" onclick="App.adminCabAdd()">➕ เพิ่มตู้ใหม่</button>';
  }

  function cabCard(i, c, cards) {
    const imgGallery = GACHA_IMGS.map((p) =>
      '<button type="button" class="ci-thumb ' + (c.img === p ? "sel" : "") + '" title="' + esc(p) + '" onclick="App.adminCabEdit(' + i + ",'img','" + p + "')\">" +
        '<img loading="lazy" src="' + esc(p) + '" data-gen="' + cabImgFallback() + '" alt="" onerror="App.imgGen(this)">' +
      "</button>").join("");

    const rateEdits = D.RARITY_ORDER.map((r) => {
      const v = (c.rates && c.rates[r] != null) ? c.rates[r] : D.RARITY[r].rate;
      return '<label class="rate-edit rar-' + r + '"><span class="rar-pill rar-' + r + '">' + r + "</span>" +
        '<input type="number" step="0.001" min="0" value="' + v + '" onchange="App.adminCabRate(' + i + ",'" + r + "',this.value)\"></label>";
    }).join("");

    /* แกลเลอรีตัวละคร (เฉพาะที่สุ่มได้) */
    const drawSet = {};
    (D.DRAWABLE || []).forEach((cc) => (drawSet[cc.id] = 1));
    const unitGallery = cards.filter((cc) => drawSet[cc.id]).sort(byRarity).map((cc) => {
      const on = (c.cards || []).indexOf(cc.id) >= 0;
      return '<button type="button" class="cg-thumb ' + (on ? "sel" : "") + '" title="' + esc(cc.name || cc.id) + '" onclick="App.adminCabToggleCard(' + i + ",'" + esc(cc.id) + "')\">" +
        '<img loading="lazy" src="' + esc(cc.gif || cc.img || "") + '" data-gen="' + genArt(cc) + '" alt="" onerror="App.imgErr(this)">' +
        '<span>' + esc(cc.name || cc.id) + "</span></button>";
    }).join("");

    /* แกลเลอรีสกิน — ระดับ (rarity) อ้างอิงจากการ์ดสกินต้นทางเอง */
    const skinRarityOf = (e) => {
      const rc = cards.find((x) => x.id === e.cardId);
      const sk = rc && (rc.skins || []).find((s) => s.id === e.skinId);
      const sc = sk && sk.src ? cards.find((x) => x.id === sk.src) : null;
      return (sc && sc.rarity) || (rc && rc.rarity) || "N";
    };
    const entries = (c.skins || []).map((e, idx) => ({ e, idx, r: skinRarityOf(e) }))
      .sort((a, b) => E.rank(b.r) - E.rank(a.r));
    const skinGallery = cards.filter((cc) => (cc.skins || []).length).sort(byRarity).map((cc) =>
      '<div class="cg-group"><div class="cg-gname">' + esc(cc.name || cc.id) + "</div><div class=\"cg-row\">" +
        (cc.skins || []).map((s) => {
          const on = entries.some((row) => row.e.cardId === cc.id && row.e.skinId === s.id);
          return '<button type="button" class="cg-skin ' + (on ? "sel" : "") + '" title="' + esc(s.name || s.id) + '" onclick="App.adminCabToggleSkin(' + i + ",'" + esc(cc.id) + "','" + esc(s.id) + "')\">" +
            '<img loading="lazy" src="' + esc(s.gif || s.img || "") + '" data-gen="' + genArt(cc) + '" alt="" onerror="App.imgErr(this)">' +
            '<span>' + esc(s.name || s.id) + "</span></button>";
        }).join("") +
      "</div></div>").join("");
    const entryRows = entries.map((row) => {
      const e = row.e, ei = row.idx;
      const rc = cards.find((x) => x.id === e.cardId);
      const sk = rc && (rc.skins || []).find((s) => s.id === e.skinId);
      return '<div class="cab-entry">' +
        '<span class="ce-name">' + esc((rc ? rc.name : "?") + " · " + (sk ? sk.name : "?")) + "</span>" +
        '<span class="rar-pill rar-' + row.r + '">' + esc(row.r) + "</span>" +
        '<button class="btn ghost" onclick="App.adminCabSkinDelete(' + i + "," + ei + ')">✕</button>' +
      "</div>";
    }).join("");

    const locked = ((c.cards || []).length === 0 && entries.length === 0);
    const poolEditor = '<div class="cab-pool">' +
      '<div class="ci-label">ตัวละครในตู้ (' + ((c.cards || []).length) + ") — คลิกรูปเพื่อเพิ่ม/ลบ" + (locked ? " · ยังไม่ติ๊ก = ตู้ล็อก" : "") + "</div>" +
      '<div class="cab-gallery">' + (unitGallery || '<p class="hint">ยังไม่มีการ์ดที่กำหนดระดับ</p>') + "</div>" +
      '<div class="ci-label" style="margin-top:12px">สกินในตู้ (' + entries.length + ") — คลิกรูปเพื่อเพิ่ม/ลบ · ระดับมาจากการ์ดสกิน (แท็บ “การ์ดสกิน”)</div>" +
      (skinGallery || '<p class="hint">ยังไม่มีการ์ดที่มีสกิน</p>') +
      (entryRows ? '<div class="cab-entries">' + entryRows + "</div>" : "") +
    "</div>";

    return '<div class="cab-admin-card">' +
      '<div class="cab-head">' +
        '<label>ชื่อตู้<input type="text" value="' + esc(c.name || "") + '" onchange="App.adminCabEdit(' + i + ",'name',this.value)\"></label>" +
        '<label>คำอธิบาย<input type="text" value="' + esc(c.desc || "") + '" onchange="App.adminCabEdit(' + i + ",'desc',this.value)\"></label>" +
        '<button class="btn danger admin-del" onclick="App.adminCabDelete(' + i + ')">🗑 ลบตู้</button>' +
      "</div>" +
      '<div class="cab-imgs">' +
        '<div class="ci-label">ภาพหน้าตู้ — คลิกเพื่อเลือก</div>' +
        '<div class="ci-gallery">' + imgGallery + "</div>" +
        '<input type="text" list="gacha-img-list" value="' + esc(c.img || "") + '" onchange="App.adminCabEdit(' + i + ",'img',this.value)\">" +
      "</div>" +
      '<div class="cab-rates-wrap">' +
        '<div class="ci-label">เรทการออก (%) — แก้ได้เอง ' +
          '<button class="btn ghost" onclick="App.adminCabRateReset(' + i + ')">↺ คืนค่าเริ่มต้น</button></div>' +
        '<div class="cab-rates">' + rateEdits + "</div>" +
      "</div>" +
      poolEditor +
    "</div>";
  }

  function cabImgFallback() { return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(machineSVG()); }

  /* =========================================================
     ACTIONS
     ========================================================= */
  const App = {
    go,
    continueGame() { state = load(); if (!state) return App.newGame(); startDailyCheck(); go("home"); },
    newGame() {
      state = defaultState();
      state.screen = "home";
      save();
      render();
      window.scrollTo(0, 0);
      toast("เริ่มเกมใหม่! ยังไม่มีการ์ด — ไปเปิดกาชาเพื่อรับตัวละคร", "good");
    },
    chooseStarterBanner(id) { pendingStarter.bannerId = id; pendingStarter.step = "method"; render(); },
    starterRandom() {
      const raw = D.BANNERS.find((x) => x.id === pendingStarter.bannerId) || D.BANNERS[0];
      const b = Object.assign({}, raw, { cards: D.STARTER_IDS, skins: [], type: "card" });
      const pity = state.banners[raw.id] || (state.banners[raw.id] = { pulls: 0, sinceSR: 0, sinceSSR: 0, sinceUR: 0 });
      const res = E.drawOne(b, pity);
      if (!res.char) return toast("สุ่มไม่ได้ — ยังไม่มีการ์ดที่กำหนดระดับไว้");
      const gained = gainCard(res.char);
      state.team = [state.collection[state.collection.length - 1].uid];
      state.starter = res.char.id;
      const msg = gained.isNew ? "ได้ตัวละครเริ่มต้น!" : "ได้ชิ้นส่วน +" + gained.shards;
      modal('<h3>🎲 ผลการสุ่มเริ่มต้น</h3><div class="pull-result single">' + cardHTML(res.char, gained.owned || state.collection.find((c) => c.charId === res.char.id), {}) + "</div><p>" + msg + "</p>" +
        '<button class="btn primary big" onclick="App.finishStarter()">เข้าสู่หน้าหลัก ▶</button>');
    },
    starterPick(id) {
      const char = D.CHAR_BY_ID[id];
      const res = gainCard(char);
      state.team = [state.collection[state.collection.length - 1].uid];
      state.starter = id;
      modal("<h3>🎯 เลือกตัวละครเริ่มต้น</h3><div class=\"pull-result single\">" + cardHTML(char, res.owned, {}) + "</div><p>" + esc(char.name) + " เข้าร่วมทีมแล้ว!</p>" +
        '<button class="btn primary big" onclick="App.finishStarter()">เข้าสู่หน้าหลัก ▶</button>');
    },
    finishStarter() { closeModal(); pendingStarter = null; go("home"); },

    selectBanner(id) { uiState.bannerId = id; render(); },
    pull(n) {
      closeModal();
      const b = (D.CABINETS.find((x) => x.id === uiState.bannerId)) || D.CABINETS[0];
      if (!b) return toast("ยังไม่มีตู้");
      if (!E.cabHasContent(b)) return toast("ตู้นี้ถูกล็อก — ยังไม่ได้ติ๊กตัวหรือสกินใส่ตู้");
      if (!(D.DRAWABLE && D.DRAWABLE.length)) return toast("ไม่มีการ์ดที่สุ่มได้ — ตั้งค่าที่หน้าแอดมินก่อน");
      const cost = n === 10 ? D.GACHA.multiCost : D.GACHA.singleCost;
      if (state.player.gems < cost) return toast("เพชรไม่พอ (ต้องใช้ 💎 " + cost + ")");
      state.player.gems -= cost;
      const pity = state.banners[b.id] || (state.banners[b.id] = { pulls: 0, sinceSR: 0, sinceSSR: 0, sinceUR: 0 });
      const results = n === 10 ? E.multiPull(b, pity, 10) : [E.drawOne(b, pity)];
      const shown = results.map((r) => {
        if (r.skin) {
          const wasOwned = skinOwned(r.skin.cardId, r.skin.skinId);
          let tag, gems = 0;
          if (!wasOwned) { grantSkin(r.skin.cardId, r.skin.skinId); tag = '<span class="tag-new">NEW</span>'; }
          else { gems = dupSkinGems(r.skin.rarity); state.player.gems += gems; tag = '<span class="tag-dup" title="สกินซ้ำ คืน +' + gems + ' เพชร">+' + gems + " 💎</span>"; }
          return { r, skin: r.skin, tag, isNew: !wasOwned, gems };
        }
        const g = gainCard(r.char);
        const owned = state.collection.find((c) => c.charId === r.char.id);
        let tag;
        if (g.isNew) tag = '<span class="tag-new">NEW</span>';
        else {
          const total = state.inventory.shards[r.char.id] || 0;
          tag = '<span class="tag-dup" title="เศษซ้ำ +' + g.shards + " · มีทั้งหมด " + total + ' เศษ">+' + g.shards + " 🧩</span>";
        }
        return { r, g, owned, tag, isNew: g.isNew, shards: g.shards };
      });
      const shownRank = (s) => (s.skin ? E.rank(s.skin.rarity) : rarRank(s.r.char));
      shown.sort((a, b) => shownRank(b) - shownRank(a));
      missionProgress("gachaPulls", n);
      save();
      const dupCount = shown.filter((s) => !s.skin && !s.isNew).length;
      const dupShardTotal = shown.reduce((a, s) => a + ((!s.skin && !s.isNew) ? s.shards : 0), 0);
      const dupSkinCount = shown.filter((s) => s.skin && !s.isNew).length;
      const dupGemTotal = shown.reduce((a, s) => a + ((s.skin && !s.isNew) ? s.gems : 0), 0);
      const cards = shown.map((s) => {
        if (s.skin) return '<div class="pull-slot">' + skinTile(s.r.skin, s.tag, true) + "</div>";
        return '<div class="pull-slot">' + cardHTML(s.r.char, s.owned, {
          attrs: 'onclick="App.openCard(\'' + s.owned.uid + '\')"',
        }) + s.tag + "</div>";
      }).join("");
      const hints = (dupCount ? '<p class="hint">🧩 ซ้ำ ' + dupCount + " ใบ · ได้เศษรวม +" + dupShardTotal + " เศษ</p>" : "") +
        (dupSkinCount ? '<p class="hint">🎨 สกินซ้ำ ' + dupSkinCount + " ใบ · คืนเพชร +" + dupGemTotal + "</p>" : "");
      const resultHtml = '<h3>🎁 ผลการเปิดแพ็ก (' + n + " ครั้ง)</h3>" +
        '<div class="pull-result">' + cards + "</div>" +
        hints +
        '<p class="hint">หักเพชรแล้ว 💎 ' + cost + " · คงเหลือ 💎 " + fmt(state.player.gems) + "</p>" +
        '<div class="modal-actions">' +
          '<button class="btn gold" onclick="App.pull(' + n + ')">🔁 สุ่มต่อ (' + n + ")</button>" +
          '<button class="btn primary" onclick="App.closeModal()">ตกลง</button>' +
        "</div>";
      render();
      const best = shown.reduce((m, s) => (!m || shownRank(s) > m.rank) ? { s, rank: shownRank(s) } : m, null);
      if (best && best.rank >= E.rank("UR")) {
        const bs = best.s;
        const cut = bs.skin
          ? { img: bs.skin.gif || bs.skin.img || imgSrcFor(bs.r.char), rarity: bs.skin.rarity, name: bs.skin.name }
          : { img: imgSrcFor(bs.r.char), rarity: bs.r.char.rarity, name: bs.r.char.name };
        cut.count = shown.filter((s) => shownRank(s) >= E.rank("UR")).length;
        playCutscene(cut, function () { modal(resultHtml); });
      } else {
        modal(resultHtml);
      }
    },
    openCard, closeModal, imgErr, imgGen, imgSrcFor,
    setSkin(charId, skinId) {
      if (skinId && skinLocked(charId, skinId)) return toast("สกินนี้ยังไม่ปลดล็อก — สุ่มได้จากตู้สกิน");
      if (!state.skinChoice) state.skinChoice = {};
      if (skinId) state.skinChoice[charId] = skinId; else delete state.skinChoice[charId];
      save();
      render();
      if (uiState.detailUid) openCard(uiState.detailUid);
      toast(skinId ? "เปลี่ยนสกินแล้ว" : "กลับเป็นรูปปกติ", "good");
    },
    setFilter(v) { uiState.collFilter = v; render(); },
    setSort(v) { uiState.collSort = v; render(); },

    pickAvatar() {
      const seen = {}, owned = [];
      state.collection.forEach((o) => { const c = charOf(o); if (c && !seen[c.id]) { seen[c.id] = 1; owned.push(c); } });
      if (!owned.length) return toast("ยังไม่มีการ์ดให้ใช้เป็นรูปโปรไฟล์");
      owned.sort(byRarity);
      const opts = owned.map((c) =>
        '<button class="av-opt ' + (state.player.avatar === c.id ? "sel" : "") + '" onclick="App.setAvatar(\'' + c.id + '\')">' +
          '<img loading="lazy" src="' + imgSrcFor(c) + '" data-gen="' + genArt(c) + '" alt="" onerror="App.imgErr(this)">' +
          "<span>" + esc(c.name) + "</span></button>").join("");
      modal('<h3>🖼 เลือกรูปโปรไฟล์</h3><p class="hint">ใช้รูปจากการ์ดที่คุณมี</p>' +
        '<div class="avatar-pick">' + opts + "</div>" +
        (state.player.avatar ? '<button class="btn ghost" onclick="App.setAvatar(\'\')">✕ เอารูปโปรไฟล์ออก</button>' : ""));
    },
    setAvatar(id) { state.player.avatar = id || null; save(); closeModal(); render(); toast("เปลี่ยนรูปโปรไฟล์แล้ว", "good"); },

    adminEdit(i, field, value) {
      const cards = CARDSTORE.loadCards();
      if (!cards[i]) return;
      cards[i][field] = value;
      CARDSTORE.saveCards(cards);
      CARDSTORE.rebuild();
      save();
      render();
    },
    adminDelete(i) {
      const cards = CARDSTORE.loadCards();
      if (!cards[i]) return;
      const nm = cards[i].name;
      cards.splice(i, 1);
      CARDSTORE.saveCards(cards);
      CARDSTORE.rebuild();
      save();
      toast("ลบการ์ด: " + nm);
      render();
    },
    adminAdd() {
      const name = (document.getElementById("adm-name").value || "").trim();
      const img = (document.getElementById("adm-img").value || "").trim();
      const gif = (document.getElementById("adm-gif").value || "").trim();
      const rarity = document.getElementById("adm-rarity").value;
      const element = document.getElementById("adm-element").value;
      const role = document.getElementById("adm-role").value;
      const isSkinEl = document.getElementById("adm-isSkin");
      const isSkin = !!(isSkinEl && isSkinEl.value) || CARDSTORE.looksLikeSkin(img || gif);
      if (!name && !img && !gif) return toast("ใส่ชื่อหรือไฟล์รูปก่อน");
      const finalName = name || CARDSTORE.prettifyName((img || gif).split("/").pop()) || "Card";
      const cards = CARDSTORE.loadCards();
      let id = CARDSTORE.slugId(finalName);
      if (cards.some((c) => c.id === id)) id = id + "-" + Date.now().toString(36);
      cards.push({ id, name: finalName, img: img || ("Card_sets/" + finalName), gif, skins: [], rarity, element, role, isSkin });
      CARDSTORE.saveCards(cards);
      CARDSTORE.rebuild();
      save();
      toast("เพิ่มการ์ดแล้ว", "good");
      render();
    },
    adminReset() {
      CARDSTORE.saveCards(CARDSTORE.clone(CARDSTORE.DEFAULTS));
      CARDSTORE.rebuild();
      save();
      toast("คืนค่าการ์ดเริ่มต้นแล้ว");
      render();
    },
    adminSkinAdd(i) {
      const cards = CARDSTORE.loadCards();
      if (!cards[i]) return;
      if (!cards[i].skins) cards[i].skins = [];
      cards[i].skins.push({ id: "sk-" + Date.now().toString(36), name: "สกิน " + (cards[i].skins.length + 1), img: "", gif: "", src: null });
      CARDSTORE.saveCards(cards);
      CARDSTORE.rebuild();
      save();
      toast("เพิ่มสกินแล้ว", "good");
      render();
    },
    adminToggleSkin(i) {
      const cards = CARDSTORE.loadCards();
      if (!cards[i]) return;
      cards[i].isSkin = !isSkinCard(cards[i]);
      if (!cards[i].isSkin) {
        /* ถอดออกจาก DRAWABLE ก็ต่อเมื่อระดับไม่ใช่ skinOnly */
      }
      CARDSTORE.saveCards(cards);
      CARDSTORE.rebuild();
      save();
      toast(cards[i].isSkin ? "ย้ายเป็นการ์ดสกินแล้ว" : "ย้ายเป็นการ์ดยูนิตแล้ว", "good");
      render();
    },
    adminSkinPick(i, cardId) {
      const cards = CARDSTORE.loadCards();
      const src = cards.find((c) => c.id === cardId);
      if (!cards[i] || !src) return;
      if (!cards[i].skins) cards[i].skins = [];
      if (cards[i].skins.some((s) => s.src === cardId)) return toast("เพิ่มสกินนี้แล้ว");
      cards[i].skins.push({
        id: "sk-" + Date.now().toString(36),
        name: src.name || cardId,
        img: src.img || "",
        gif: src.gif || "",
        src: cardId,
      });
      CARDSTORE.saveCards(cards);
      CARDSTORE.rebuild();
      save();
      toast("เพิ่มสกินจาก “" + (src.name || cardId) + "” แล้ว", "good");
      render();
    },
    adminSkinEdit(i, si, field, value) {
      const cards = CARDSTORE.loadCards();
      if (!cards[i] || !cards[i].skins || !cards[i].skins[si]) return;
      cards[i].skins[si][field] = value;
      CARDSTORE.saveCards(cards);
      CARDSTORE.rebuild();
      save();
      render();
    },
    adminSkinDelete(i, si) {
      const cards = CARDSTORE.loadCards();
      if (!cards[i] || !cards[i].skins || !cards[i].skins[si]) return;
      const removed = cards[i].skins[si].id;
      cards[i].skins.splice(si, 1);
      CARDSTORE.saveCards(cards);
      CARDSTORE.rebuild();
      if (state.skinChoice && state.skinChoice[cards[i].id] === removed) delete state.skinChoice[cards[i].id];
      save();
      toast("ลบสกินแล้ว");
      render();
    },
    adminCabEdit(i, field, value) {
      const arr = CABSTORE.loadCabinets();
      if (!arr[i]) return;
      arr[i][field] = value;
      if (!arr[i].cards) arr[i].cards = [];
      if (!arr[i].skins) arr[i].skins = [];
      CABSTORE.saveCabinets(arr);
      CABSTORE.rebuild();
      save();
      render();
    },
    adminCabSkinAdd(i) {
      const arr = CABSTORE.loadCabinets();
      if (!arr[i]) return;
      if (!arr[i].skins) arr[i].skins = [];
      arr[i].skins.push({ cardId: "", skinId: "" });
      CABSTORE.saveCabinets(arr);
      CABSTORE.rebuild();
      save();
      render();
    },
    adminCabSkinCard(i, ei, cardId) {
      const arr = CABSTORE.loadCabinets();
      if (!arr[i] || !arr[i].skins || !arr[i].skins[ei]) return;
      arr[i].skins[ei].cardId = cardId;
      arr[i].skins[ei].skinId = "";
      CABSTORE.saveCabinets(arr);
      CABSTORE.rebuild();
      save();
      render();
    },
    adminCabSkinSet(i, ei, skinId) {
      const arr = CABSTORE.loadCabinets();
      if (!arr[i] || !arr[i].skins || !arr[i].skins[ei]) return;
      arr[i].skins[ei].skinId = skinId;
      CABSTORE.saveCabinets(arr);
      CABSTORE.rebuild();
      save();
      render();
    },
    adminCabSkinDelete(i, ei) {
      const arr = CABSTORE.loadCabinets();
      if (!arr[i] || !arr[i].skins || !arr[i].skins[ei]) return;
      arr[i].skins.splice(ei, 1);
      CABSTORE.saveCabinets(arr);
      CABSTORE.rebuild();
      save();
      render();
    },
    adminCabCards(i, sel) {
      const arr = CABSTORE.loadCabinets();
      if (!arr[i]) return;
      arr[i].cards = Array.prototype.map.call(sel.selectedOptions, (o) => o.value);
      CABSTORE.saveCabinets(arr);
      CABSTORE.rebuild();
      save();
      toast("อัพเดตตัวใส่ตู้แล้ว (" + arr[i].cards.length + " การ์ด)", "good");
      render();
    },
    adminCabAdd() {
      const arr = CABSTORE.loadCabinets();
      const id = "cab-" + Date.now().toString(36);
      arr.push({ id, name: "ตู้ใหม่ " + (arr.length + 1), type: "card", img: GACHA_IMGS[0], desc: "", cards: [], skins: [], rates: null });
      CABSTORE.saveCabinets(arr);
      CABSTORE.rebuild();
      save();
      toast("เพิ่มตู้ใหม่แล้ว", "good");
      render();
    },
    adminCabDelete(i) {
      const arr = CABSTORE.loadCabinets();
      if (!arr[i]) return;
      const nm = arr[i].name;
      arr.splice(i, 1);
      CABSTORE.saveCabinets(arr);
      CABSTORE.rebuild();
      save();
      toast("ลบตู้: " + nm);
      render();
    },
    adminTab(t) {
      uiState.adminTab = t;
      render();
      window.scrollTo(0, 0);
    },
    adminSkinOpen(id) {
      uiState.skinOpen = uiState.skinOpen || {};
      uiState.skinOpen[id] = !uiState.skinOpen[id];
      render();
    },
    adminCabToggleCard(i, id) {
      const arr = CABSTORE.loadCabinets();
      if (!arr[i]) return;
      if (!arr[i].cards) arr[i].cards = [];
      const k = arr[i].cards.indexOf(id);
      if (k >= 0) arr[i].cards.splice(k, 1);
      else arr[i].cards.push(id);
      CABSTORE.saveCabinets(arr);
      CABSTORE.rebuild();
      save();
      render();
    },
    adminCabToggleSkin(i, cardId, skinId) {
      const arr = CABSTORE.loadCabinets();
      if (!arr[i]) return;
      if (!arr[i].skins) arr[i].skins = [];
      const k = arr[i].skins.findIndex((e) => e.cardId === cardId && e.skinId === skinId);
      if (k >= 0) arr[i].skins.splice(k, 1);
      else arr[i].skins.push({ cardId, skinId });
      CABSTORE.saveCabinets(arr);
      CABSTORE.rebuild();
      save();
      render();
    },
    adminCabRate(i, rarity, value) {
      const arr = CABSTORE.loadCabinets();
      if (!arr[i]) return;
      const base = Object.assign({}, E.DEFAULT_RATES);
      arr[i].rates = Object.assign(base, arr[i].rates || {});
      arr[i].rates[rarity] = Math.max(0, Number(value) || 0);
      CABSTORE.saveCabinets(arr);
      CABSTORE.rebuild();
      save();
      render();
    },
    adminCabRateReset(i) {
      const arr = CABSTORE.loadCabinets();
      if (!arr[i]) return;
      arr[i].rates = null;
      CABSTORE.saveCabinets(arr);
      CABSTORE.rebuild();
      save();
      toast("คืนค่าเรทเริ่มต้นแล้ว");
      render();
    },
    adminExport() {
      const data = btoa(unescape(encodeURIComponent(JSON.stringify(CARDSTORE.loadCards()))));
      const blob = new Blob([data], { type: "text/plain" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "anime-legends-cards.txt";
      a.click();
      toast("ส่งออกการ์ดแล้ว");
    },
    adminImport() {
      const inp = document.createElement("input");
      inp.type = "file"; inp.accept = ".txt,.json";
      inp.onchange = () => {
        const f = inp.files[0]; if (!f) return;
        const rd = new FileReader();
        rd.onload = () => {
          try {
            const arr = JSON.parse(decodeURIComponent(escape(atob(String(rd.result).trim()))));
            if (!Array.isArray(arr)) throw 0;
            CARDSTORE.saveCards(arr);
            CARDSTORE.rebuild();
            save(); render();
            toast("นำเข้าการ์ดสำเร็จ", "good");
          } catch (e) { toast("ไฟล์การ์ดไม่ถูกต้อง"); }
        };
        rd.readAsText(f);
      };
      inp.click();
    },

    doLevelUp(uid) {
      const o = ownedByUid(uid); const char = charOf(o);
      const res = E.levelUpWithGold(o, char, state.player.gold);
      if (!res.ok) return toast(res.reason);
      addGold(-res.cost);
      missionProgress("levelUp", 1);
      toast("เลเวล " + res.before.level + " → " + res.after.level, "good");
      save(); openCard(uid); render();
    },
    doExpItem(uid) {
      if (state.inventory.expItem <= 0) return toast("ยา EXP หมดแล้ว");
      const o = ownedByUid(uid); const char = charOf(o);
      state.inventory.expItem--;
      const res = E.useExpItems(o, char, 1);
      toast("ใช้ยา EXP · ขึ้น " + res.ups + " เลเวล (Lv" + res.level + ")", "good");
      save(); openCard(uid); render();
    },
    doStarUp(uid) {
      const o = ownedByUid(uid); const char = charOf(o);
      const res = E.starUp(o, char, state.inventory.shards, state.player.gold);
      if (!res.ok) return toast(res.reason);
      addGold(-res.goldCost);
      toast("เพิ่มดาว " + res.before.star + "★ → " + res.after.star + "★", "good");
      save(); openCard(uid); render();
    },
    toggleTeam(uid) {
      const i = state.team.indexOf(uid);
      if (i >= 0) state.team.splice(i, 1);
      else {
        if (state.team.length >= 5) return toast("ทีมเต็ม (สูงสุด 5)");
        const o = ownedByUid(uid);
        if (o && charInTeam(o.charId, uid)) return toast("ตัวนี้อยู่ในทีมแล้ว (ใส่ตัวซ้ำไม่ได้)");
        state.team.push(uid);
      }
      save(); openCard(uid); render();
    },
    addToTeam(uid) {
      if (state.team.length >= 5) return toast("ทีมเต็ม (สูงสุด 5)");
      const o = ownedByUid(uid);
      if (o && charInTeam(o.charId, uid)) return toast("ตัวนี้อยู่ในทีมแล้ว (ใส่ตัวซ้ำไม่ได้)");
      state.team.push(uid); save(); render();
    },
    removeFromTeam(i) { state.team.splice(i, 1); save(); render(); },

    /* ---- battle prep ---- */
    prebattle(type, id) {
      let ctx = null;
      if (type === "story") {
        const s = D.STAGES.find((x) => x.id === id);
        ctx = { type, id, name: D.CHAPTERS[s.chapter] + " — " + s.name, enemyDefs: s.enemies, reward: s.reward, firstGems: s.firstGems, flag: ["stages", s.id] };
      } else if (type === "boss") {
        const b = D.BOSSES.find((x) => x.id === id);
        ctx = { type, id, name: b.name, enemyDefs: b.enemies, reward: b.reward, firstGems: b.firstGems, flag: ["bosses", b.id], mechanic: b.mechanic };
      } else if (type === "tower") {
        const f = D.towerFloor(Number(id));
        ctx = { type, id: f.floor, name: "หอคอย ชั้น " + f.floor, enemyDefs: f.enemies, reward: f.reward, firstGems: 0, flag: ["tower", f.floor] };
      } else if (type === "arena") {
        const a = D.ARENA_TIERS.find((x) => x.id === id);
        ctx = { type, id, name: a.name, enemyDefs: a.enemies, reward: a.reward, firstGems: 0, flag: ["arena", a.id] };
      } else if (type === "event") {
        const ev = D.EVENTS.find((x) => x.id === id);
        ctx = { type, id, name: ev.name, enemyDefs: ev.enemies, reward: ev.reward, firstGems: ev.firstGems, flag: ["events", ev.id] };
      }
      if (!ctx) return;
      battleCtx = ctx;
      go("prebattle");
    },
    startBattle() {
      if (state.team.length === 0) return toast("ยังไม่ได้จัดทีม");
      battle = E.battleStart(teamOwned(), battleCtx.enemyDefs);
      uiState.targetUid = null;
      E.battleRun(battle, null);
      go("battlefield");
      setTimeout(scrollLog, 30);
    },
    selectTarget(uid) { uiState.targetUid = uid; render(); setTimeout(scrollLog, 10); },
    battleAction(action) {
      if (!battle || !battle.awaiting) return;
      const actor = battle.awaiting;
      const payload = { actorUid: actor.uid, action, targetUid: uiState.targetUid };
      uiState.targetUid = null;
      const r = E.battleRun(battle, payload);
      render();
      setTimeout(scrollLog, 20);
      if (r.winner) setTimeout(() => App.finishBattle(r.winner), 400);
    },
    finishBattle(winner) {
      const ctx = battleCtx;
      if (winner === "win" || winner === "player") {
        const reward = ctx.reward;
        addGold(reward.gold || 0);
        addGems(reward.gems || 0);
        let firstTxt = "";
        if (ctx.firstGems && !state.progress[ctx.flag[0]][ctx.flag[1]]) {
          addGems(ctx.firstGems);
          firstTxt = " + โบนัสผ่านครั้งแรก 💎" + ctx.firstGems;
        }
        // EXP ให้การ์ดในทีม
        teamOwned().forEach((o) => E.addExp(o, charOf(o), reward.exp || 0));
        addPlayerExp(Math.round((reward.exp || 0) / 2));
        if (reward.shards) Object.keys(reward.shards).forEach((k) => addShards(k, reward.shards[k]));
        // บันทึกความก้าวหน้า
        const [grp, key] = ctx.flag;
        if (grp === "tower") state.progress.tower = Math.max(state.progress.tower, key);
        else state.progress[grp][key] = true;
        missionProgress("battleWin", 1);
        save();
        modal("<h3>🏆 ชนะ!</h3><div class=\"reward-line\">🪙 +" + (reward.gold || 0) + " · 💎 +" + (reward.gems || 0) + " · EXP +" + (reward.exp || 0) + firstTxt + "</div>" +
          "<p>EXP แจกให้ตัวละครในทีมทุกตัว</p>" +
          '<button class="btn primary" onclick="App.closeBattle()">ตกลง</button>');
      } else {
        save();
        modal("<h3>💀 แพ้</h3><p>ทีมของคุณพ่ายแพ้ ลองอัปเกรดตัวละครหรือจัดทีมใหม่</p>" +
          '<button class="btn primary" onclick="App.closeBattle()">ตกลง</button>');
      }
    },
    closeBattle() { closeModal(); battle = null; battleCtx = null; go("home"); },

    claim(id) { claimMission(id); },
    buy(id) {
      const s = D.SHOP.find((x) => x.id === id);
      if (!s || s.price <= 0) return;
      const isGold = s.currency === "gold";
      if (isGold) { if (state.player.gold < s.price) return toast("ทองไม่พอ"); }
      else { if (state.player.gems < s.price) return toast("เพชรไม่พอ"); }

      /* ฉากหลังโปรไฟล์: ต้องเหลือแบบที่ยังไม่ปลดล็อก */
      if (s.give.profileBg) {
        const owned = state.player.ownedBgs || (state.player.ownedBgs = []);
        const unowned = (D.PROFILE_BGS || []).filter((b) => !owned.includes(b.id));
        if (!unowned.length) return toast("ปลดล็อกฉากหลังครบทุกแบบแล้ว");
        if (isGold) addGold(-s.price); else addGems(-s.price);
        const pick = unowned[Math.floor(Math.random() * unowned.length)];
        owned.push(pick.id);
        state.player.profileBg = pick.id;
        save();
        modal("<h3>🖼 ได้ฉากหลังใหม่!</h3>" +
          '<div class="bg-preview pb-' + pick.id + '"><span>' + esc(pick.name) + "</span></div>" +
          '<p class="center">ติดตั้งเป็นฉากหลังโปรไฟล์แล้ว · เปลี่ยนได้ที่หน้าสถานะ</p>' +
          '<div class="modal-actions"><button class="btn primary" onclick="App.closeModal()">เยี่ยม!</button></div>');
        render();
        return;
      }

      if (isGold) addGold(-s.price); else addGems(-s.price);

      if (s.give.chest) { openChest(); return; }
      if (s.give.expItem) state.inventory.expItem += s.give.expItem;
      if (s.give.enhMat) state.inventory.enhMat += s.give.enhMat;
      toast("ซื้อ " + s.name + " สำเร็จ", "good");
      save(); render();
    },
    equipBg(id) {
      if (!(state.player.ownedBgs || []).includes(id)) return;
      state.player.profileBg = (state.player.profileBg === id) ? null : id;
      save(); render();
      toast(state.player.profileBg ? "ติดตั้งฉากหลังแล้ว" : "เอาฉากหลังออกแล้ว", "good");
    },
    exchangeFilter(r) { uiState.exchFilter = r; render(); },
    exchangeCard(charId) {
      const char = D.CHAR_BY_ID[charId];
      if (!char) return;
      const cost = exchCost(char.rarity);
      if (cost == null) return toast("การ์ดนี้แลกไม่ได้");
      const pool = shardPoolTotal();
      if (pool < cost) return toast("เศษซ้ำไม่พอ (ต้องใช้ " + cost + " เศษ · มี " + pool + ")");
      const owned = state.collection.some((o) => o.charId === char.id);
      modal('<h3>🎴 ยืนยันการแลก</h3>' +
        '<p>แลก <b>' + esc(char.name) + "</b> (" + char.rarity + ") ด้วยเศษซ้ำ <b>" + cost + " 🧩</b></p>" +
        '<p class="hint">' + (owned ? "คุณมีการ์ดนี้แล้ว — จะได้เศษซ้ำคืน +" + E.dupShards(char.rarity) + " เศษ" : "การ์ดใหม่! เข้าคอลเลกชันทันที") + "</p>" +
        '<div class="modal-actions"><button class="btn primary" onclick="App.doExchange(\'' + char.id + '\')">ยืนยันแลก</button>' +
        '<button class="btn ghost" onclick="App.closeModal()">ยกเลิก</button></div>');
    },
    doExchange(charId) {
      closeModal();
      const char = D.CHAR_BY_ID[charId];
      if (!char) return;
      const cost = exchCost(char.rarity);
      if (cost == null) return;
      if (!spendShards(cost)) return toast("เศษซ้ำไม่พอ");
      const gained = gainCard(char);
      if (gained.isNew) toast("แลกสำเร็จ! ได้ " + char.name + " 🎉", "good");
      else toast("แลกสำเร็จ! " + char.name + " ซ้ำ → +" + gained.shards + " เศษ", "good");
      save(); render();
    },
    exchangeSkin(cardId, skinId) {
      const ch = D.CHAR_BY_ID[cardId];
      const sk = ch && (ch.skins || []).find((s) => s.id === skinId);
      if (!sk) return;
      const rarity = exchSkinRarity(ch, sk);
      const cost = exchCost(rarity);
      if (cost == null) return toast("สกินนี้แลกไม่ได้");
      if (skinOwned(cardId, skinId)) return toast("มีสกินนี้แล้ว");
      const pool = shardPoolTotal();
      if (pool < cost) return toast("เศษซ้ำไม่พอ (ต้องใช้ " + cost + " เศษ · มี " + pool + ")");
      modal('<h3>🎨 ยืนยันการแลกสกิน</h3>' +
        '<p>แลก <b>' + esc(sk.name || "สกิน") + "</b> (" + rarity + ") ของ <b>" + esc(ch.name) + "</b> ด้วยเศษซ้ำ <b>" + cost + " 🧩</b></p>" +
        '<div class="modal-actions"><button class="btn primary" onclick="App.doExchangeSkin(\'' + esc(cardId) + "','" + esc(skinId) + '\')">ยืนยันแลก</button>' +
        '<button class="btn ghost" onclick="App.closeModal()">ยกเลิก</button></div>');
    },
    doExchangeSkin(cardId, skinId) {
      closeModal();
      const ch = D.CHAR_BY_ID[cardId];
      const sk = ch && (ch.skins || []).find((s) => s.id === skinId);
      if (!sk) return;
      const rarity = exchSkinRarity(ch, sk);
      const cost = exchCost(rarity);
      if (cost == null) return;
      if (skinOwned(cardId, skinId)) return toast("มีสกินนี้แล้ว");
      if (!spendShards(cost)) return toast("เศษซ้ำไม่พอ");
      grantSkin(cardId, skinId);
      toast("แลกสำเร็จ! ได้สกิน " + (sk.name || "สกิน") + " 🎉", "good");
      save(); render();
    },
    exportSave() {
      const data = btoa(unescape(encodeURIComponent(JSON.stringify(state))));
      const blob = new Blob([data], { type: "text/plain" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "anime-legends-save.txt";
      a.click();
      toast("ส่งออกเซฟแล้ว");
    },
    importSave() {
      const inp = document.createElement("input");
      inp.type = "file"; inp.accept = ".txt,.json";
      inp.onchange = () => {
        const f = inp.files[0]; if (!f) return;
        const rd = new FileReader();
        rd.onload = () => {
          try {
            const s = JSON.parse(decodeURIComponent(escape(atob(String(rd.result).trim()))));
            if (!s || s.version !== 1) throw 0;
            state = s; startDailyCheck(); save(); go("home"); toast("นำเข้าเซฟสำเร็จ", "good");
          } catch (e) { toast("ไฟล์เซฟไม่ถูกต้อง"); }
        };
        rd.readAsText(f);
      };
      inp.click();
    },
    confirmReset() {
      modal("<h3>⚠ ล้างเซฟทั้งหมด?</h3><p>การกระทำนี้ย้อนกลับไม่ได้</p>" +
        '<button class="btn danger" onclick="App.resetNow()">ยืนยันล้าง</button> <button class="btn ghost" onclick="App.closeModal()">ยกเลิก</button>');
    },
    resetNow() { closeModal(); resetSave(); },
  };

  function startDailyCheck() { checkDailyReset(); }

  /* ---------------------------------------------------------
     Boot
     --------------------------------------------------------- */
  function boot() {
    try {
      const saved = load();
      if (saved) { state = saved; checkDailyReset(); state.screen = "title"; }
      else { state = defaultState(); state.screen = "title"; }
      render();
    } catch (e) {
      try {
        state = defaultState();
        render();
        toast("โหลดเซฟเดิมไม่ได้ — เริ่มเซฟใหม่ให้แล้ว", "bad");
      } catch (e2) {
        const app = document.getElementById("app");
        if (app) app.innerHTML = '<div style="padding:40px;text-align:center;color:#fff;font-family:sans-serif">' +
          "<h2>เกิดข้อผิดพลาดในการโหลด</h2><p>ลองรีเฟรชหน้าเว็บหรือล้างแคช</p>" +
          '<button onclick="localStorage.clear();location.reload()" style="padding:10px 18px;border-radius:10px;border:0;cursor:pointer">ล้างข้อมูลและโหลดใหม่</button></div>';
      }
    }
  }

  window.App = App;
  window.addEventListener("DOMContentLoaded", boot);
  if (document.readyState !== "loading") boot();
})();
