/* ============================================================
   ANIME LEGENDS — engine.js
   ตรรกะล้วน: ค่าสถานะ, Gacha+Pity, พัฒนาตัวละคร, ระบบต่อสู้
   ทุกผลลัพธ์คำนวณตามกฎจริง ไม่มีการกำหนดผลตามใจ
   ============================================================ */
(function () {
  const D = window.GAME_DATA;
  const { RARITY, RARITY_ORDER, ROLES, ELEMENT_ADV, ELEMENTS, GACHA, GE } = D;

  /* ---------- RNG ---------- */
  const rnd = () => Math.random();
  function rndInt(n) { return Math.floor(rnd() * n); }
  function rank(r) { return RARITY_ORDER.indexOf(r); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* ============================================================
     1) ค่าสถานะ
     ============================================================ */
  function baseStats(char) {
    const r = RARITY[char.rarity];
    const w = ROLES[char.role].w;
    const m = char.statMod || {};
    const p = r.power;
    return {
      atk: p * 0.16 * w.atk * (m.atk || 1),
      hp:  p * 1.60 * w.hp  * (m.hp  || 1),
      def: p * 0.10 * w.def * (m.def || 1),
      spd: (40 + p * 0.02 * w.spd) * (m.spd || 1),
    };
  }

  function statsAt(char, level, star) {
    const b = baseStats(char);
    const lv = 1 + 0.06 * (level - 1);
    const st = 1 + 0.12 * (star - 1);
    const lvS = 1 + 0.02 * (level - 1);
    const stS = 1 + 0.03 * (star - 1);
    return {
      atk: Math.round(b.atk * lv * st),
      hp:  Math.round(b.hp  * lv * st),
      def: Math.round(b.def * lv * st),
      spd: Math.round(b.spd * lvS * stS),
    };
  }

  /* ค่าสถานะรวม passive */
  function passiveMods(char) {
    const mods = { atk: 0, hp: 0, def: 0, spd: 0 };
    const p = char.skills && char.skills.passive && char.skills.passive.passive;
    if (p) p.forEach((e) => { if (mods[e.stat] !== undefined) mods[e.stat] += e.value; });
    return mods;
  }
  function statsWithPassive(char, level, star) {
    const s = statsAt(char, level, star);
    const m = passiveMods(char);
    return {
      atk: Math.round(s.atk * (1 + m.atk)),
      hp:  Math.round(s.hp  * (1 + m.hp)),
      def: Math.round(s.def * (1 + m.def)),
      spd: Math.round(s.spd * (1 + m.spd)),
    };
  }

  /* ---------- วิวัฒนาการ -----------------------------------------
     ตัวละครที่รองรับจะเพิ่มดาวได้เร็วขึ้นและได้สถานะโบนัสเมื่อถึงเงื่อนไข */
  function canEvolve(char, star) {
    return !!char.evolution && star >= (char.evolution.atStar || 5);
  }

  /* ============================================================
     2) GACHA + PITY
     ============================================================ */
  const DEFAULT_RATES = {};
  RARITY_ORDER.forEach((r) => { DEFAULT_RATES[r] = RARITY[r].rate; });
  /* เรทของตู้: ใช้เรทที่กำหนดเองถ้ามี ไม่งั้นใช้ค่าเริ่มต้น */
  function ratesFor(banner) {
    return (banner && banner.rates) ? banner.rates : DEFAULT_RATES;
  }
  function rollRarity(rates) {
    rates = rates || DEFAULT_RATES;
    let x = rnd() * 100;
    for (const r of RARITY_ORDER) { x -= (rates[r] || 0); if (x <= 0) return r; }
    return "N";
  }

  /* ---------- พูลของตู้ (รวมยูนิต + สกิน ที่ติ๊กใส่ตู้) ----------
     ตู้ไม่แบ่งประเภทแล้ว: ออกเฉพาะสิ่งที่ติ๊กใส่ตู้เท่านั้น
     ตู้ที่ไม่ติ๊กอะไรเลย = ล็อก (cabHasContent = false) */
  function cabCards(banner) {
    const all = D.DRAWABLE || D.CHARACTERS;
    const ids = (banner && banner.cards) || [];
    if (!ids.length) return [];
    const set = {};
    ids.forEach((id) => (set[id] = 1));
    return all.filter((c) => set[c.id]);
  }
  /* ข้อมูลสกินจาก (cardId, skinId) — ดึงรูป/ชื่อ/ระดับจาก registry */
  function skinInfo(cardId, skinId, rarity) {
    const ch = D.CHAR_BY_ID[cardId];
    if (!ch || !ch.skins) return null;
    const sk = ch.skins.find((s) => s.id === skinId);
    if (!sk) return null;
    const sc = sk.src ? D.CHAR_BY_ID[sk.src] : null;
    return {
      cardId, skinId,
      name: sk.name || "สกิน",
      gif: sk.gif || "", img: sk.img || "",
      rarity: rarity || (sc && sc.rarity) || ch.rarity || "N",
    };
  }
  function cabSkins(banner) {
    return ((banner && banner.skins) || [])
      .map((e) => (e ? skinInfo(e.cardId, e.skinId) : null))
      .filter(Boolean);
  }
  function cabPool(banner) {
    return { units: cabCards(banner), skins: cabSkins(banner) };
  }
  function cabHasContent(banner) {
    const p = cabPool(banner);
    return p.units.length + p.skins.length > 0;
  }
  /* สุ่มจากพูลตามระดับ — ยูนิต/สกิน ใช้เรตร่วมกัน (สกินถ่วงด้วย skinWeight) */
  function pickFromPool(pool, rarity, banner) {
    let units = pool.units.filter((c) => c.rarity === rarity);
    let skins = pool.skins.filter((s) => s.rarity === rarity);
    if (!units.length && !skins.length) { units = pool.units; skins = pool.skins; }
    const w = (GE.skinWeight == null) ? 1 : GE.skinWeight;
    const wc = units.length, ws = skins.length * w;
    if (wc + ws <= 0) return null;
    if (rnd() * (wc + ws) < ws) {
      const s = skins[rndInt(skins.length)];
      return { kind: "skin", skin: s, rarity: s.rarity };
    }
    let featuredId = null;
    if (banner) { if (rarity === "UR") featuredId = banner.featuredUR; else if (rarity === "LR") featuredId = banner.featuredLR; }
    if (featuredId && rnd() < 0.5) {
      const fc = units.find((c) => c.id === featuredId);
      if (fc) return { kind: "unit", char: fc, rarity: fc.rarity };
    }
    const c = units[rndInt(units.length)];
    return { kind: "unit", char: c, rarity: c.rarity };
  }

  function poolFor(rarity, banner) {
    const base = cabCards(banner);
    const cands = base.filter((c) => c.rarity === rarity);
    return cands.length ? cands : base.slice();
  }

  function pickChar(rarity, banner) {
    const cands = poolFor(rarity, banner);
    if (!cands.length) return null;
    let featuredId = null;
    if (rarity === "UR") featuredId = banner.featuredUR;
    if (rarity === "LR") featuredId = banner.featuredLR;
    if (featuredId && rnd() < 0.5) {
      const fc = D.CHAR_BY_ID[featuredId];
      if (fc && fc.rarity === rarity) return fc;
    }
    return cands[rndInt(cands.length)];
  }

  /* pity: {pulls, sinceSR, sinceSSR, sinceUR} */
  function drawOne(banner, pity) {
    pity.pulls++;
    pity.sinceSR++;
    pity.sinceSSR++;
    pity.sinceUR++;

    const forceUR = pity.sinceUR >= GACHA.pityUR;
    const forceSSR = pity.sinceSSR >= GACHA.pitySSR;
    const forceSR = pity.sinceSR >= GACHA.pitySR;

    let rarity;
    if (forceUR) rarity = "UR";
    else {
      rarity = rollRarity(ratesFor(banner));
      if (forceSSR && rank(rarity) < rank("SSR")) rarity = "SSR";
      else if (forceSR && rank(rarity) < rank("SR")) rarity = "SR";
    }

    /* ออกเฉพาะที่ติ๊กใส่ตู้ (ยูนิต/สกิน) — สกินไม่นับเป็นการได้ตัวละคร */
    const pick = pickFromPool(cabPool(banner), rarity, banner);
    const skin = pick && pick.kind === "skin" ? pick.skin : null;
    const char = skin ? (D.CHAR_BY_ID[skin.cardId] || null) : (pick ? pick.char : null);

    if (rank(rarity) >= rank("UR")) pity.sinceUR = 0;
    if (rank(rarity) >= rank("SSR")) pity.sinceSSR = 0;
    if (rank(rarity) >= rank("SR")) pity.sinceSR = 0;

    return { rarity: pick ? pick.rarity : rarity, char, skin, pityForced: forceUR ? "UR" : forceSSR ? "SSR" : forceSR ? "SR" : null };
  }

  function multiPull(banner, pity, n) {
    const results = [];
    for (let i = 0; i < n; i++) results.push(drawOne(banner, pity));
    // ประกัน SR+ อย่างน้อย 1 ใบต่อการเปิด 10
    if (n >= GACHA.multiSize && !results.some((r) => rank(r.rarity) >= rank("SR"))) {
      results[n - 1] = drawOne(banner, pity);
      const last = results[n - 1];
      if (rank(last.rarity) < rank("SR")) {
        const pick = pickFromPool(cabPool(banner), "SR", banner);
        if (pick) {
          last.rarity = pick.rarity;
          if (pick.kind === "skin") { last.skin = pick.skin; last.char = D.CHAR_BY_ID[pick.skin.cardId] || null; }
          else { last.skin = null; last.char = pick.char; }
        }
      }
    }
    return results;
  }

  /* ============================================================
     2b) สุ่มสกิน (ตู้กาชาสกิน)
     entry: { cardId, skinId, rarity }
     ============================================================ */
  function skinEntryOK(e) {
    if (!e || !e.cardId || !e.skinId) return false;
    const ch = D.CHAR_BY_ID[e.cardId];
    if (!ch || !ch.skins) return false;
    return ch.skins.some((s) => s.id === e.skinId);
  }
  /* รายการสกินในตู้ — ถ้าตั้งว่างไว้ = ใช้สกินทั้งหมดในระบบ (เหมือนตู้การ์ด) */
  function skinCabEntries(banner) {
    const explicit = (banner && banner.skins ? banner.skins : []).filter(skinEntryOK)
      .map((s) => {
        const info = skinInfo(s.cardId, s.skinId);
        return info ? { cardId: s.cardId, skinId: s.skinId, rarity: info.rarity } : null;
      })
      .filter(Boolean);
    if (explicit.length) return explicit;
    const out = [];
    (D.CHARACTERS || []).forEach((ch) => {
      (ch.skins || []).forEach((s) => {
        const sc = D.CHAR_BY_ID[s.src];
        out.push({ cardId: ch.id, skinId: s.id, rarity: (sc && sc.rarity) || "N" });
      });
    });
    return out;
  }
  function skinPoolFor(rarity, banner) {
    const list = skinCabEntries(banner);
    let cands = list.filter((e) => e.rarity === rarity);
    if (!cands.length) cands = list.slice();
    return cands;
  }
  function drawSkinOne(banner, pity) {
    pity.pulls++; pity.sinceSR++; pity.sinceSSR++; pity.sinceUR++;
    const forceUR = pity.sinceUR >= GACHA.pityUR;
    const forceSSR = pity.sinceSSR >= GACHA.pitySSR;
    const forceSR = pity.sinceSR >= GACHA.pitySR;
    let rarity;
    if (forceUR) rarity = "UR";
    else {
      rarity = rollRarity(ratesFor(banner));
      if (forceSSR && rank(rarity) < rank("SSR")) rarity = "SSR";
      else if (forceSR && rank(rarity) < rank("SR")) rarity = "SR";
    }
    let pool = skinPoolFor(rarity, banner);
    if (!pool.length) pool = skinPoolFor("N", banner);
    const entry = pool.length ? pool[rndInt(pool.length)] : null;
    if (rank(rarity) >= rank("UR")) pity.sinceUR = 0;
    if (rank(rarity) >= rank("SSR")) pity.sinceSSR = 0;
    if (rank(rarity) >= rank("SR")) pity.sinceSR = 0;
    return { rarity: entry ? (entry.rarity || rarity) : rarity, entry, cardId: entry ? entry.cardId : null, skinId: entry ? entry.skinId : null };
  }
  function multiSkinPull(banner, pity, n) {
    const results = [];
    for (let i = 0; i < n; i++) results.push(drawSkinOne(banner, pity));
    if (n >= GACHA.multiSize && !results.some((r) => rank(r.rarity) >= rank("SR"))) {
      const last = results[n - 1];
      const pool = skinPoolFor("SR", banner);
      const entry = pool.length ? pool[rndInt(pool.length)] : last.entry;
      if (entry) { last.entry = entry; last.cardId = entry.cardId; last.skinId = entry.skinId; last.rarity = entry.rarity || "SR"; }
    }
    return results;
  }

  /* ============================================================
     3) ครอบครอง / พัฒนาตัวละคร
     ============================================================ */
  let uidSeq = 1;
  function newOwned(charId) {
    return { uid: "c" + (uidSeq++) + "_" + Date.now().toString(36), charId, level: 1, star: 1, exp: 0 };
  }
  function dupShards(rarity) {
    return { N: 3, R: 5, SR: 10, SSR: 20, UR: 40, LR: 80, ART: 120 }[rarity] || 3;
  }
  function expNeeded(level) { return 50 + level * 25; }

  function addExp(owned, char, amount) {
    const cap = RARITY[char.rarity].levelCap;
    owned.exp += amount;
    let ups = 0;
    while (owned.level < cap && owned.exp >= expNeeded(owned.level)) {
      owned.exp -= expNeeded(owned.level);
      owned.level++;
      ups++;
    }
    if (owned.level >= cap) owned.exp = 0;
    return ups;
  }

  function levelUpGoldCost(level) { return GE.levelUpGoldPerLvl * level; }

  /* เพิ่มเลเวลด้วยทอง 1 ระดับ -> คืน {ok, cost, before, after} */
  function levelUpWithGold(owned, char, gold) {
    const cap = RARITY[char.rarity].levelCap;
    if (owned.level >= cap) return { ok: false, reason: "ถึงเลเวลสูงสุดของระดับแล้ว" };
    const cost = levelUpGoldCost(owned.level);
    if (gold < cost) return { ok: false, reason: "ทองไม่พอ", cost };
    const before = { level: owned.level, stats: statsWithPassive(char, owned.level, owned.star) };
    owned.level++;
    const after = { level: owned.level, stats: statsWithPassive(char, owned.level, owned.star) };
    return { ok: true, cost, before, after };
  }

  /* ใช้ไอเทม EXP */
  function useExpItems(owned, char, count) {
    const ups = addExp(owned, char, count * GE.expItemValue);
    return { ups, level: owned.level };
  }

  function starUpInfo(owned, char) {
    const r = RARITY[char.rarity];
    const st = owned.star;
    if (st >= r.maxStars) return { ok: false, reason: "ดาวสูงสุดแล้ว" };
    const shardNeed = r.starShards[st - 1];
    const goldNeed = GE.starGoldBase * st;
    return { ok: true, shardNeed, goldNeed, nextStar: st + 1 };
  }

  function starUp(owned, char, inventoryShards, gold) {
    const info = starUpInfo(owned, char);
    if (!info.ok) return { ok: false, reason: info.reason };
    const have = inventoryShards[owned.charId] || 0;
    if (have < info.shardNeed) return { ok: false, reason: "ชิ้นส่วนไม่พอ", shardNeed: info.shardNeed, have };
    if (gold < info.goldNeed) return { ok: false, reason: "ทองไม่พอ", goldNeed: info.goldNeed };
    const before = { star: owned.star, stats: statsWithPassive(char, owned.level, owned.star) };
    inventoryShards[owned.charId] = have - info.shardNeed;
    owned.star = info.nextStar;
    const after = { star: owned.star, stats: statsWithPassive(char, owned.level, owned.star) };
    return { ok: true, goldCost: info.goldNeed, shardCost: info.shardNeed, before, after };
  }

  /* ============================================================
     4) การต่อสู้แบบผลัดกัน (Turn-Based)
     ============================================================ */
  function elemMul(a, b) {
    if (ELEMENT_ADV[a] === b) return 1.5;
    if (ELEMENT_ADV[b] === a) return 0.75;
    return 1.0;
  }

  function makeUnitFromOwned(owned, side, slot) {
    const char = D.CHAR_BY_ID[owned.charId];
    if (!char) return null;
    const st = statsWithPassive(char, owned.level, owned.star);
    return {
      uid: side + "-" + slot + "-" + owned.charId,
      charId: char.id, name: char.name, anime: char.anime, rarity: char.rarity,
      element: char.element, role: char.role, side, slot,
      level: owned.level, star: owned.star,
      base: { atk: st.atk, hp: st.hp, def: st.def, spd: st.spd },
      hp: st.hp, maxHp: st.hp,
      buffs: [], statuses: [], ult: 0, alive: true, defending: false,
      skills: char.skills,
    };
  }
  function makeUnitFromEnemy(e, side, slot) {
    const char = D.CHAR_BY_ID[e.id];
    if (!char) return null;
    const st = statsWithPassive(char, e.level, e.star);
    return {
      uid: side + "-" + slot + "-" + char.id,
      charId: char.id, name: char.name, anime: char.anime, rarity: char.rarity,
      element: char.element, role: char.role, side, slot,
      level: e.level, star: e.star,
      base: { atk: st.atk, hp: st.hp, def: st.def, spd: st.spd },
      hp: st.hp, maxHp: st.hp,
      buffs: [], statuses: [], ult: 0, alive: true, defending: false,
      skills: char.skills,
    };
  }

  function effStat(u, stat) {
    let v = u.base[stat];
    u.buffs.forEach((b) => { if (b.stat === stat) v *= (1 + b.value); });
    return Math.max(1, v);
  }
  function effSpd(u) { return effStat(u, "spd"); }

  function critChance(u) {
    const spd = effStat(u, "spd");
    return clamp(0.10 + spd / (spd + 400), 0.05, 0.5);
  }

  function computeDamage(atkU, defU, power) {
    const atk = effStat(atkU, "atk");
    const def = effStat(defU, "def");
    const raw = atk * power;
    const mitig = def / (def + 100 + 10 * atkU.level);
    let dmg = raw * (1 - mitig);
    const em = elemMul(atkU.element, defU.element);
    dmg *= em;
    const crit = rnd() < critChance(atkU);
    if (crit) dmg *= 1.5;
    dmg = Math.max(1, Math.round(dmg));
    return { dmg, crit, em };
  }

  function shieldOf(u) {
    let s = 0;
    u.statuses.forEach((st) => { if (st.name === "shield") s += st.power; });
    return s;
  }

  function pushLog(state, text, cls) {
    state.log.push({ round: state.round, text, cls: cls || "" });
  }

  function aliveOf(state, side) {
    return state.units.filter((u) => u.side === side && u.alive);
  }

  function battleStart(playerOwned, enemyDefs) {
    const units = [];
    playerOwned.forEach((o, i) => { const u = makeUnitFromOwned(o, "player", i); if (u) units.push(u); });
    enemyDefs.forEach((e, i) => { const u = makeUnitFromEnemy(e, "enemy", i); if (u) units.push(u); });
    const state = { units, order: [], idx: 0, round: 1, log: [], status: "ongoing", awaiting: null };
    buildOrder(state);
    pushLog(state, "การต่อสู้เริ่มต้น! ลำดับเทิร์นคำนวณจากค่า SPD", "sys");
    return state;
  }

  function buildOrder(state) {
    state.order = state.units
      .filter((u) => u.alive)
      .sort((a, b) => {
        const d = effSpd(b) - effSpd(a);
        if (d !== 0) return d;
        if (a.side !== b.side) return a.side === "player" ? -1 : 1;
        return a.slot - b.slot;
      });
  }

  function checkEnd(state) {
    if (aliveOf(state, "player").length === 0) { state.status = "lose"; return "enemy"; }
    if (aliveOf(state, "enemy").length === 0) { state.status = "win"; return "player"; }
    return null;
  }

  function applyDamage(state, atkU, defU, dmg, opts) {
    const sh = shieldOf(defU);
    let toShield = Math.min(sh, dmg);
    if (toShield > 0) {
      // ลดโล่ห์ที่เก่าแก่ที่สุดก่อน
      let rem = toShield;
      for (const st of defU.statuses) {
        if (st.name === "shield" && rem > 0) {
          const take = Math.min(st.power, rem);
          st.power -= take; rem -= take;
        }
      }
      defU.statuses = defU.statuses.filter((st) => !(st.name === "shield" && st.power <= 0));
    }
    const finalDmg = dmg - toShield;
    defU.hp = Math.max(0, defU.hp - finalDmg);
    if (defU.hp <= 0) { defU.alive = false; }
    // เกจไม้ตายผู้ถูกโจมตี
    addUlt(defU, 15);
    if (atkU.side !== defU.side) addUlt(atkU, 0);
    return { toShield, finalDmg };
  }

  function addUlt(u, v) {
    if (!u.alive) return;
    u.ult = clamp(u.ult + v, 0, 100);
  }

  function resolveTargets(state, actor, target) {
    const enemies = aliveOf(state, actor.side === "player" ? "enemy" : "player");
    const allies = aliveOf(state, actor.side);
    switch (target) {
      case "allEnemy": return enemies;
      case "allAlly": return allies;
      case "self": return [actor];
      case "ally": {
        const sorted = allies.slice().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
        return [sorted[0] || actor];
      }
      case "enemy":
      default: {
        const sorted = enemies.slice().sort((a, b) => a.hp - b.hp);
        return [sorted[0] || null].filter(Boolean);
      }
    }
  }

  function applyEffect(state, actor, skill, targetSet, enemiesForDebuff, ef) {
    const targets = (function () {
      if (ef.kind === "buff" || ef.kind === "heal" || ef.kind === "regen" || ef.kind === "shield") {
        const tSide = skill.target;
        if (tSide === "self" || tSide === "ally" || tSide === "allAlly") return targetSet;
        return [actor];
      }
      if (ef.kind === "debuff" || ef.kind === "status") return targetSet.length && targetSet[0] && targetSet[0].side !== actor.side ? targetSet : enemiesForDebuff;
      return targetSet;
    })();

    targets.forEach((t) => {
      if (!t || !t.alive) return;
      if (ef.kind === "buff") {
        t.buffs.push({ stat: ef.stat, value: ef.value, turns: ef.turns });
        pushLog(state, `  ↳ ${t.name} ได้รับบัฟ ${ef.stat.toUpperCase()} +${Math.round(ef.value * 100)}% (${ef.turns} เทิร์น)`, "buff");
      } else if (ef.kind === "debuff") {
        t.buffs.push({ stat: ef.stat, value: -ef.value, turns: ef.turns });
        pushLog(state, `  ↳ ${t.name} ถูกสาป ${ef.stat.toUpperCase()} -${Math.round(ef.value * 100)}% (${ef.turns} เทิร์น)`, "debuff");
      } else if (ef.kind === "status") {
        if (ef.name === "shield") {
          const amount = Math.round(actor.base.hp * (ef.power || 0.2));
          t.statuses.push({ name: "shield", power: amount, turns: ef.turns });
          pushLog(state, `  ↳ ${t.name} ได้รับโล่ห์ ${amount} หน่วย`, "buff");
        } else {
          t.statuses.push({ name: ef.name, power: ef.power || 0, turns: ef.turns, from: actor.uid });
          const label = { poison: "ติดพิษ", burn: "ติดไฟ", stun: "ติดสตัน", regen: "ฟื้นฟูต่อเนื่อง" }[ef.name] || ef.name;
          pushLog(state, `  ↳ ${t.name} ${label} (${ef.turns} เทิร์น)`, ef.name === "regen" ? "buff" : "debuff");
        }
      } else if (ef.kind === "heal") {
        const amount = Math.round(effStat(actor, "atk") * ef.power);
        const before = t.hp;
        t.hp = Math.min(t.maxHp, t.hp + amount);
        pushLog(state, `  ↳ ${t.name} ฟื้น HP +${t.hp - before} (HP ${t.hp}/${t.maxHp})`, "heal");
      }
    });
  }

  function performSkill(state, actor, skill, targetHint) {
    const enemies = aliveOf(state, actor.side === "player" ? "enemy" : "player");
    let targetSet = resolveTargets(state, actor, skill.target);
    // ถ้าเป้าหมายเดี่ยวให้เลือกตัวที่ผู้เล่นกำหนด (ถ้ามี)
    if ((skill.target === "enemy" || !skill.target) && targetHint) {
      const t = state.units.find((u) => u.uid === targetHint && u.alive);
      if (t) targetSet = [t];
    }
    targetSet = targetSet.filter((t) => t && t.alive);
    pushLog(state, `${actor.name} ใช้ "${skill.name}"`, "act");

    // ดาเมจ
    if (skill.power && skill.power > 0 && (skill.target === "enemy" || skill.target === "allEnemy" || !skill.target)) {
      targetSet.forEach((t) => {
        const { dmg, crit, em } = computeDamage(actor, t, skill.power);
        const res = applyDamage(state, actor, t, dmg);
        const emTxt = em > 1 ? " [ได้เปรียบธาตุ x1.5]" : em < 1 ? " [เสียเปรียบธาตุ x0.75]" : "";
        const critTxt = crit ? " ★คริติคอล★" : "";
        let txt = `  ⚔ ${actor.name} → ${t.name}: ดาเมจ ${res.finalDmg}`;
        if (res.toShield > 0) txt += ` (โล่ห์ดูดซับ ${res.toShield})`;
        txt += `${emTxt}${critTxt} | HP ${t.name} เหลือ ${t.hp}/${t.maxHp}`;
        pushLog(state, txt, crit ? "crit" : "dmg");
        if (!t.alive) pushLog(state, `  ✖ ${t.name} ถูกกำจัด!`, "dead");
      });
    }
    // เอฟเฟกต์
    (skill.effects || []).forEach((ef) => applyEffect(state, actor, skill, targetSet, enemies, ef));
  }

  function aiAction(state, actor) {
    const allies = aliveOf(state, actor.side);
    const lowAlly = allies.some((a) => a.hp / a.maxHp < 0.4);
    if (actor.ult >= 100) {
      actor.ult = 0;
      performSkill(state, actor, actor.skills.ultimate, null);
      return;
    }
    if (actor.role === "Support" && lowAlly && rnd() < 0.5) {
      // ใช้สกิลพื้นฐานช่วยทีม
      performSkill(state, actor, actor.skills.basic, null);
      addUlt(actor, 18);
      return;
    }
    if (actor.role === "Tank" && actor.hp / actor.maxHp < 0.3 && rnd() < 0.4) {
      actor.defending = true;
      actor.buffs.push({ stat: "def", value: 0.5, turns: 1 });
      addUlt(actor, 15);
      pushLog(state, `${actor.name} ตั้งการ์ดป้องกัน (DEF +50% ในเทิร์นนี้)`, "act");
      return;
    }
    performSkill(state, actor, actor.skills.basic, null);
    addUlt(actor, 20);
  }

  function endRound(state) {
    // เอฟเฟกต์ต่อเนื่อง
    state.units.forEach((u) => {
      if (!u.alive) return;
      u.statuses.forEach((st) => {
        if (st.name === "poison") {
          const d = Math.max(1, Math.round(u.maxHp * 0.05 + (st.power || 0) * effStat(u, "atk") * 0.1));
          u.hp = Math.max(0, u.hp - d);
          pushLog(state, `  ☠ ${u.name} เสียหายจากพิษ ${d} (HP ${u.hp}/${u.maxHp})`, "debuff");
        } else if (st.name === "burn") {
          const d = Math.max(1, Math.round((st.power || 0.3) * effStat(u, "atk") * 0.5));
          u.hp = Math.max(0, u.hp - d);
          pushLog(state, `  🔥 ${u.name} เสียหายจากไฟ ${d} (HP ${u.hp}/${u.maxHp})`, "debuff");
        } else if (st.name === "regen") {
          const h = Math.round(u.maxHp * (st.power || 0.2));
          if (u.hp < u.maxHp) {
            u.hp = Math.min(u.maxHp, u.hp + h);
            pushLog(state, `  ➕ ${u.name} ฟื้นฟู ${h} (HP ${u.hp}/${u.maxHp})`, "heal");
          }
        }
      });
      if (u.hp <= 0) { u.alive = false; pushLog(state, `  ✖ ${u.name} ล้มลง!`, "dead"); }
    });
    // ลดเวลา บัฟ/ดีบัฟ
    state.units.forEach((u) => {
      u.buffs.forEach((b) => (b.turns -= 1));
      u.buffs = u.buffs.filter((b) => b.turns > 0);
      u.statuses.forEach((st) => { if (st.name !== "shield") st.turns -= 1; });
      u.statuses = u.statuses.filter((st) => st.turns > 0 && !(st.name === "shield" && st.power <= 0));
    });
  }

  /* เดินระบบจนถึงจุดที่ต้องรอ input ผู้เล่น หรือจบการต่อสู้
     payload: {actorUid, action, targetUid} เมื่อผู้เล่นเลือก action */
  function battleRun(state, payload) {
    if (payload) {
      const actor = state.units.find((u) => u.uid === payload.actorUid);
      if (actor && actor.alive) performPlayerAction(state, actor, payload);
      state.awaiting = null;
      state.idx++;
    }
    let guard = 0;
    while (guard++ < 5000) {
      if (checkEnd(state)) {
        pushLog(state, state.status === "win" ? "🏆 ฝ่ายผู้เล่นชนะ!" : "💀 ฝ่ายผู้เล่นแพ้!", "sys");
        return { awaiting: null, winner: state.status };
      }
      if (state.idx >= state.order.length) {
        endRound(state);
        if (checkEnd(state)) continue;
        state.round++;
        buildOrder(state);
        state.idx = 0;
        continue;
      }
      const actor = state.order[state.idx];
      if (!actor || !actor.alive) { state.idx++; continue; }

      // สตัน
      const stun = actor.statuses.find((s) => s.name === "stun");
      if (stun) {
        stun.turns -= 1;
        actor.statuses = actor.statuses.filter((s) => s.turns > 0);
        pushLog(state, `⏸ ${actor.name} ถูกสตัน ข้ามเทิร์น`, "debuff");
        state.idx++;
        continue;
      }

      if (actor.side === "enemy") {
        aiAction(state, actor);
        state.idx++;
        continue;
      }
      // ผู้เล่น -> รอ input
      state.awaiting = actor;
      return { awaiting: actor, winner: null };
    }
    return { awaiting: null, winner: state.status };
  }

  function performPlayerAction(state, actor, payload) {
    if (payload.action === "defend") {
      actor.defending = true;
      actor.buffs.push({ stat: "def", value: 0.5, turns: 1 });
      addUlt(actor, 15);
      pushLog(state, `${actor.name} ตั้งการ์ดป้องกัน (DEF +50% ในเทิร์นนี้)`, "act");
      return;
    }
    if (payload.action === "ult") {
      if (actor.ult < 100) {
        pushLog(state, `${actor.name} เกจไม้ตายไม่พอ ใช้โจมตีปกติแทน`, "sys");
        performSkill(state, actor, actor.skills.basic, payload.targetUid);
        addUlt(actor, 20);
        return;
      }
      actor.ult = 0;
      performSkill(state, actor, actor.skills.ultimate, payload.targetUid);
      return;
    }
    if (payload.action === "attack") {
      performSkill(state, actor, { name: "โจมตีปกติ", power: 0.9, target: "enemy", effects: [] }, payload.targetUid);
      addUlt(actor, 25);
      return;
    }
    // skill
    performSkill(state, actor, actor.skills.basic, payload.targetUid);
    addUlt(actor, 18);
  }

  /* ---------- รางวัลการต่อสู้ ---------- */
  function battleReward(enemyUnits, enemyDefs) {
    let avgLv = 0;
    enemyDefs.forEach((e) => (avgLv += e.level));
    avgLv = avgLv / (enemyDefs.length || 1);
    return {
      gold: Math.round(GE.battleGoldBase + GE.battleGoldPerLv * avgLv),
      exp: Math.round(GE.battleExpBase + GE.battleExpPerLv * avgLv),
    };
  }

  window.Engine = {
    rnd, rndInt, rank, clamp,
    baseStats, statsAt, statsWithPassive, passiveMods, canEvolve,
    rollRarity, ratesFor, DEFAULT_RATES, poolFor, pickChar, drawOne, multiPull,
    cabCards, cabSkins, cabPool, cabHasContent, skinInfo, pickFromPool,
    skinEntryOK, skinCabEntries, skinPoolFor, drawSkinOne, multiSkinPull,
    newOwned, dupShards, expNeeded, addExp, levelUpGoldCost, levelUpWithGold,
    useExpItems, starUpInfo, starUp,
    battleStart, battleRun, buildOrder, effStat, computeDamage, battleReward,
  };
})();
