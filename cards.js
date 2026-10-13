/* ============================================================
   ANIME LEGENDS — cards.js
   ระบบจัดการการ์ด (Card Registry) + พื้นฐานสำหรับแดชบอร์ดแอดมิน
   - การ์ดทั้งหมดมาจากไฟล์รูปในโฟลเดอร์ Card_sets
   - แอดมินกำหนด ระดับ (rarity) / ธาตุ / บทบาท ได้เอง
   - บันทึกอัตโนมัติใน localStorage
   ============================================================ */
(function () {
  const STORE_KEY = "anime_legends_cards_v1";
  const VER_KEY = "anime_legends_cards_ver";
  const REGISTRY_VERSION = 6; // v6 = รีบิลด์ยูนิต/สกิน/ART ใหม่ทั้งหมด

  /* ---------- ค่าเริ่มต้น: การ์ดจากโฟลเดอร์ Card_sets ---------- */
  const DEFAULTS = [
    /* ---- ยูนิต (unit) ---- */
    { id: "abyss-lord", name: "Abyss Lord", img: "Card_sets/GBXBVZXbUAAKcex.png", rarity: "N", element: "dark", role: "Tank" },
    { id: "alan-art", name: "Alan (ART)", img: "Card_sets/Alan_ART.jpg", rarity: "ART", element: "light", role: "Attacker" },
    { id: "amatsumara", name: "Amatsumara", img: "Card_sets/Amatsumara.jpg", rarity: "N", element: "fire", role: "Attacker", skins: [{ id: "sk-amatsumara-alt-1", name: "Amatsumara (Alt 1)", img: "Card_sets/Amatsumara_1.jpg", gif: "", src: "amatsumara-alt-1" }] },
    { id: "amatsumara-ssr", name: "Amatsumara (SSR)", img: "Card_sets/Amatsumara_ssr.png", rarity: "N", element: "light", role: "Attacker" },
    { id: "azure-knight", name: "Azure Knight", img: "Card_sets/dd1d4c1653ed7730f567896bdca13250.jpg", rarity: "N", element: "water", role: "Tank" },
    { id: "blade-dancer", name: "Blade Dancer", img: "Card_sets/49555901748fcd227f591048e40ecb24.jpg", rarity: "N", element: "wind", role: "Attacker" },
    { id: "blazing-soul", name: "Blazing Soul", img: "Card_sets/964474f819853b21a9240fa221d6f6c1.jpg", rarity: "N", element: "fire", role: "Attacker" },
    { id: "chosuke-nakamoto", name: "Chosuke Nakamoto", img: "Card_sets/Chosuke Nakamoto.jpg", rarity: "N", element: "light", role: "Attacker" },
    { id: "court-of-puppets", name: "Court of Puppets", img: "Card_sets/Court of Puppets.jpg", rarity: "N", element: "dark", role: "Controller" },
    { id: "crimson-devil", name: "Crimson Devil", img: "Card_sets/9b38ea3d61d36d92228422208b049b4f.jpg", rarity: "N", element: "fire", role: "Attacker" },
    { id: "eddie-cassano", name: "Eddie Cassano", img: "Card_sets/Eddie Cassano.jpg", rarity: "N", element: "lightning", role: "Attacker", skins: [{ id: "sk-eddie-cassano-alt-1", name: "Eddie Cassano (Alt 1)", img: "Card_sets/Eddie Cassano_1.jpg", gif: "", src: "eddie-cassano-alt-1" }] },
    { id: "flame-emperor", name: "Flame Emperor", img: "Card_sets/ffb942793ebaa59ab083a9c855034e41.jpg", rarity: "N", element: "fire", role: "Attacker" },
    { id: "frost-giant", name: "Frost Giant", img: "Card_sets/0f853b8ccccf0ce782ea64e3ed8369ee.jpg", rarity: "N", element: "water", role: "Tank" },
    { id: "frost-warden", name: "Frost Warden", img: "Card_sets/f361df6f-0c09-43ab-9abb-5cdcac60a60d.jpg", rarity: "N", element: "water", role: "Tank" },
    { id: "gentleman", name: "Gentleman", img: "Card_sets/gentleman.jpg", rarity: "N", element: "light", role: "Support" },
    { id: "go-gunhee", name: "Go Gunhee", img: "Card_sets/go gunhee.jpg", rarity: "N", element: "earth", role: "Tank" },
    { id: "go-gunhee-art", name: "Go Gunhee (ART)", img: "Card_sets/go gunhee_ART.jpg", rarity: "ART", element: "earth", role: "Tank" },
    { id: "golden-echo", name: "Golden Echo", img: "Card_sets/b1450caae413c56660006b0c9c2567d1.jpg", rarity: "N", element: "light", role: "Support" },
    { id: "golden-lion", name: "Golden Lion", img: "Card_sets/F4lrlTBbgAAOEuJ.jpg", rarity: "N", element: "light", role: "Tank" },
    { id: "gonzo-kagemori", name: "Gonzo Kagemori", img: "Card_sets/gonzo kagemori.jpg", rarity: "N", element: "wind", role: "Controller", skins: [{ id: "sk-gonzo-kagemori-alt-1", name: "Gonzo Kagemori (Alt 1)", img: "Card_sets/gonzo kagemori_1.jpg", gif: "", src: "gonzo-kagemori-alt-1" }] },
    { id: "gonzo-kagemori-art", name: "Gonzo Kagemori (ART)", img: "Card_sets/gonzo kagemori_ART.jpg", rarity: "ART", element: "wind", role: "Controller", skins: [{ id: "sk-gonzo-kagemori-art-alt-1", name: "Gonzo Kagemori (ART Alt 1)", img: "Card_sets/gonzo kagemori_ART1.jpg", gif: "", src: "gonzo-kagemori-art-alt-1" }] },
    { id: "gouken", name: "Gouken", img: "Card_sets/gouken.jpg", rarity: "N", element: "earth", role: "Tank" },
    { id: "gouken-art", name: "Gouken (ART)", img: "Card_sets/gouken_ART.jpg", rarity: "ART", element: "earth", role: "Tank", skins: [{ id: "sk-gouken-art-alt-1", name: "Gouken (ART Alt 1)", img: "Card_sets/gouken_ART1.jpg", gif: "", src: "gouken-art-alt-1" }] },
    { id: "high-voltage", name: "High Voltage", img: "Card_sets/HIGH-VOLTAGE-IMG_1248-MRM.jpg", rarity: "N", element: "lightning", role: "Controller" },
    { id: "iron-will", name: "Iron Will", img: "Card_sets/6b7dff251d0a9a8287173543abd896ed.jpg", rarity: "N", element: "earth", role: "Tank" },
    { id: "kaijin", name: "Kaijin", img: "Card_sets/Kaijin.jpg", rarity: "N", element: "lightning", role: "Attacker" },
    { id: "kame-sennin", name: "Kame Sen'nin", img: "Card_sets/Kame-Sen'nin.jpg", rarity: "N", element: "water", role: "Support", skins: [{ id: "sk-kame-sen-nin-alt-1", name: "Kame Sen'nin (Alt 1)", img: "Card_sets/Kame-Sen'nin_1.jpg", gif: "", src: "kame-sen-nin-alt-1" }] },
    { id: "king-bradley", name: "King Bradley", img: "Card_sets/king bradley.png", rarity: "N", element: "lightning", role: "Attacker" },
    { id: "makarov-dreyer", name: "Makarov Dreyer", img: "Card_sets/makarov dreyer.jpg", rarity: "N", element: "light", role: "Support", skins: [{ id: "sk-makarov-dreyer-alt-1", name: "Makarov Dreyer (Alt 1)", img: "Card_sets/makarov dreyer_1.jpg", gif: "", src: "makarov-dreyer-alt-1" }] },
    { id: "map", name: "Map", img: "Card_sets/map.jpg", rarity: "N", element: "earth", role: "Support" },
    { id: "medeus", name: "Medeus", img: "Card_sets/medeus.jpg", rarity: "N", element: "dark", role: "Tank" },
    { id: "monkey-d-garp", name: "Monkey D Garp", img: "Card_sets/monkey d garp.jpg", rarity: "N", element: "fire", role: "Attacker" },
    { id: "monkey-d-garp-art", name: "Monkey D Garp (ART)", img: "Card_sets/monkey d garp_ART.jpg", rarity: "ART", element: "fire", role: "Attacker", skins: [{ id: "sk-monkey-d-garp-art-alt-1", name: "Monkey D Garp (ART Alt 1)", img: "Card_sets/monkey d garp_ART1.jpeg", gif: "", src: "monkey-d-garp-art-alt-1" }, { id: "sk-monkey-d-garp-art-alt-2", name: "Monkey D Garp (ART Alt 2)", img: "Card_sets/monkey d garp_ART2.jpg", gif: "", src: "monkey-d-garp-art-alt-2" }] },
    { id: "night-raven", name: "Night Raven", img: "Card_sets/2e4924b45f4919416c273ef4c76df77e.jpg", rarity: "N", element: "dark", role: "Controller" },
    { id: "reinhardt", name: "Reinhardt", img: "Card_sets/reinhardt.jpg", gif: "Card_sets/Reinhardt_gif.gif", rarity: "N", element: "water", role: "Tank" },
    { id: "sea-serpent", name: "Sea Serpent", img: "Card_sets/d989e751225d59fe1c1b2014dca9d7b3.jpg", rarity: "N", element: "water", role: "Controller" },
    { id: "shadow-blade", name: "Shadow Blade", img: "Card_sets/7b24879f-5ea2-434d-abaa-496698893c07.jpg", rarity: "N", element: "dark", role: "Attacker" },
    { id: "shadow-monarch", name: "Shadow Monarch", img: "Card_sets/0976d988c5a355be08c19374354c58b0.jpg", rarity: "N", element: "dark", role: "Attacker" },
    { id: "silver-tempest", name: "Silver Tempest", img: "Card_sets/979c7691-e1f1-446d-84df-c15ab479b319.jpg", rarity: "N", element: "wind", role: "Attacker" },
    { id: "storm-herald", name: "Storm Herald", img: "Card_sets/q2879k6yn71h1.jpeg", rarity: "N", element: "wind", role: "Support" },
    { id: "storm-rider", name: "Storm Rider", img: "Card_sets/FM8SBXEVIBMmTaQ.jpg", rarity: "N", element: "wind", role: "Controller" },
    { id: "takemura", name: "Takemura", img: "Card_sets/Takemura.jpg", rarity: "N", element: "lightning", role: "Attacker", skins: [{ id: "sk-takemura-alt-1", name: "Takemura (Alt 1)", img: "Card_sets/Takemura_1.png", gif: "", src: "takemura-alt-1" }, { id: "sk-takemura-alt-2", name: "Takemura (Alt 2)", img: "Card_sets/Takemura_2.png", gif: "", src: "takemura-alt-2" }, { id: "sk-takemura-alt-3", name: "Takemura (Alt 3)", img: "Card_sets/Takemura_3.png", gif: "", src: "takemura-alt-3" }] },
    { id: "takemura-art", name: "Takemura (ART)", img: "Card_sets/Takemura_ART.png", rarity: "ART", element: "light", role: "Attacker", skins: [{ id: "sk-takemura-art-alt-1", name: "Takemura (ART Alt 1)", img: "Card_sets/Takemura_ART1.png", gif: "", src: "takemura-art-alt-1" }] },
    { id: "thunder-god", name: "Thunder God", img: "Card_sets/8ea9943a0bc107eef7408739d0306b59.jpg", rarity: "N", element: "lightning", role: "Attacker" },
    { id: "ura", name: "Ura", img: "Card_sets/ura.png", rarity: "N", element: "water", role: "Support", skins: [{ id: "sk-ura-alt-1", name: "Ura (Alt 1)", img: "Card_sets/ura_1.png", gif: "", src: "ura-alt-1" }, { id: "sk-ura-alt-2", name: "Ura (Alt 2)", img: "Card_sets/ura_2.png", gif: "", src: "ura-alt-2" }, { id: "sk-ura-alt-3", name: "Ura (Alt 3)", img: "Card_sets/ura_3.png", gif: "", src: "ura-alt-3" }] },
    { id: "usuki", name: "Usuki", img: "Card_sets/Usuki.png", rarity: "N", element: "wind", role: "Controller", skins: [{ id: "sk-usuki-alt-1", name: "Usuki (Alt 1)", img: "Card_sets/Usuki_1.png", gif: "", src: "usuki-alt-1" }, { id: "sk-usuki-alt-2", name: "Usuki (Alt 2)", img: "Card_sets/Usuki_2.png", gif: "", src: "usuki-alt-2" }, { id: "sk-usuki-alt-3", name: "Usuki (Alt 3)", img: "Card_sets/Usuki_3.png", gif: "", src: "usuki-alt-3" }, { id: "sk-usuki-alt-4", name: "Usuki (Alt 4)", img: "Card_sets/Usuki_4.png", gif: "", src: "usuki-alt-4" }, { id: "sk-usuki-alt-5", name: "Usuki (Alt 5)", img: "Card_sets/Usuki_5.png", gif: "", src: "usuki-alt-5" }, { id: "sk-usuki-alt-6", name: "Usuki (Alt 6)", img: "Card_sets/Usuki_6.png", gif: "", src: "usuki-alt-6" }] },
    { id: "void-reaper", name: "Void Reaper", img: "Card_sets/9cd8623d-d92a-41e7-8f25-0aa36e825b9e.jpg", rarity: "N", element: "dark", role: "Attacker" },
    { id: "void-walker", name: "Void Walker", img: "Card_sets/f8737951e8a923f241b718bc7297544f.jpg", rarity: "N", element: "dark", role: "Controller" },
    { id: "war-maiden", name: "War Maiden", img: "Card_sets/EW_16KfVcAAPIb1.jpg", rarity: "N", element: "light", role: "Attacker" },
    { id: "warmth", name: "Warmth", img: "Card_sets/warmth.jpg", rarity: "N", element: "fire", role: "Support" },
    { id: "yakatsuri", name: "Yakatsuri", img: "Card_sets/yakatsuri.png", rarity: "N", element: "fire", role: "Attacker", skins: [{ id: "sk-yakatsuri-alt-1", name: "Yakatsuri (Alt 1)", img: "Card_sets/yakatsuri_1.png", gif: "", src: "yakatsuri-alt-1" }] },
    { id: "yamamoto-genryusai", name: "Yamamoto Genryusai", img: "Card_sets/yamamoto genryusai.png", rarity: "N", element: "fire", role: "Attacker" },
    { id: "yamamoto-genryusai-art", name: "Yamamoto Genryusai (ART)", img: "Card_sets/yamamoto genryusai_ART.png", rarity: "ART", element: "fire", role: "Attacker" },
    { id: "yamazaki-kenzou", name: "Yamazaki Kenzou", img: "Card_sets/Yamazaki Kenzou.jpg", rarity: "N", element: "earth", role: "Attacker", skins: [{ id: "sk-yamazaki-kenzou-alt-1", name: "Yamazaki Kenzou (Alt 1)", img: "Card_sets/Yamazaki Kenzou_1.png", gif: "", src: "yamazaki-kenzou-alt-1" }, { id: "sk-yamazaki-kenzou-alt-2", name: "Yamazaki Kenzou (Alt 2)", img: "Card_sets/Yamazaki Kenzou_2.jpg", gif: "", src: "yamazaki-kenzou-alt-2" }] },
    { id: "yggdrasil", name: "Yggdrasil", img: "Card_sets/Yggdrasil.jpg", rarity: "N", element: "earth", role: "Tank" },
    { id: "yuminaga-tobio", name: "Yuminaga Tobio", img: "Card_sets/Yuminaga Tobio.jpg", rarity: "N", element: "wind", role: "Controller" },
    /* ---- การ์ดสกิน (skin) ---- */
    { id: "amatsumara-alt-1", name: "Amatsumara (Alt 1)", img: "Card_sets/Amatsumara_1.jpg", rarity: "N", element: "fire", role: "Attacker", isSkin: true },
    { id: "eddie-cassano-alt-1", name: "Eddie Cassano (Alt 1)", img: "Card_sets/Eddie Cassano_1.jpg", rarity: "N", element: "lightning", role: "Attacker", isSkin: true },
    { id: "gonzo-kagemori-alt-1", name: "Gonzo Kagemori (Alt 1)", img: "Card_sets/gonzo kagemori_1.jpg", rarity: "N", element: "wind", role: "Controller", isSkin: true },
    { id: "gonzo-kagemori-art-alt-1", name: "Gonzo Kagemori (ART Alt 1)", img: "Card_sets/gonzo kagemori_ART1.jpg", rarity: "ART", element: "wind", role: "Controller", isSkin: true },
    { id: "gouken-art-alt-1", name: "Gouken (ART Alt 1)", img: "Card_sets/gouken_ART1.jpg", rarity: "ART", element: "earth", role: "Tank", isSkin: true },
    { id: "kame-sen-nin-alt-1", name: "Kame Sen'nin (Alt 1)", img: "Card_sets/Kame-Sen'nin_1.jpg", rarity: "N", element: "water", role: "Support", isSkin: true },
    { id: "makarov-dreyer-alt-1", name: "Makarov Dreyer (Alt 1)", img: "Card_sets/makarov dreyer_1.jpg", rarity: "N", element: "light", role: "Support", isSkin: true },
    { id: "monkey-d-garp-art-alt-1", name: "Monkey D Garp (ART Alt 1)", img: "Card_sets/monkey d garp_ART1.jpeg", rarity: "ART", element: "fire", role: "Attacker", isSkin: true },
    { id: "monkey-d-garp-art-alt-2", name: "Monkey D Garp (ART Alt 2)", img: "Card_sets/monkey d garp_ART2.jpg", rarity: "ART", element: "fire", role: "Attacker", isSkin: true },
    { id: "takemura-alt-1", name: "Takemura (Alt 1)", img: "Card_sets/Takemura_1.png", rarity: "N", element: "lightning", role: "Attacker", isSkin: true },
    { id: "takemura-alt-2", name: "Takemura (Alt 2)", img: "Card_sets/Takemura_2.png", rarity: "N", element: "lightning", role: "Attacker", isSkin: true },
    { id: "takemura-alt-3", name: "Takemura (Alt 3)", img: "Card_sets/Takemura_3.png", rarity: "N", element: "lightning", role: "Attacker", isSkin: true },
    { id: "takemura-art-alt-1", name: "Takemura (ART Alt 1)", img: "Card_sets/Takemura_ART1.png", rarity: "ART", element: "light", role: "Attacker", isSkin: true },
    { id: "ura-alt-1", name: "Ura (Alt 1)", img: "Card_sets/ura_1.png", rarity: "N", element: "water", role: "Support", isSkin: true },
    { id: "ura-alt-2", name: "Ura (Alt 2)", img: "Card_sets/ura_2.png", rarity: "N", element: "water", role: "Support", isSkin: true },
    { id: "ura-alt-3", name: "Ura (Alt 3)", img: "Card_sets/ura_3.png", rarity: "N", element: "water", role: "Support", isSkin: true },
    { id: "usuki-alt-1", name: "Usuki (Alt 1)", img: "Card_sets/Usuki_1.png", rarity: "N", element: "wind", role: "Controller", isSkin: true },
    { id: "usuki-alt-2", name: "Usuki (Alt 2)", img: "Card_sets/Usuki_2.png", rarity: "N", element: "wind", role: "Controller", isSkin: true },
    { id: "usuki-alt-3", name: "Usuki (Alt 3)", img: "Card_sets/Usuki_3.png", rarity: "N", element: "wind", role: "Controller", isSkin: true },
    { id: "usuki-alt-4", name: "Usuki (Alt 4)", img: "Card_sets/Usuki_4.png", rarity: "N", element: "wind", role: "Controller", isSkin: true },
    { id: "usuki-alt-5", name: "Usuki (Alt 5)", img: "Card_sets/Usuki_5.png", rarity: "N", element: "wind", role: "Controller", isSkin: true },
    { id: "usuki-alt-6", name: "Usuki (Alt 6)", img: "Card_sets/Usuki_6.png", rarity: "N", element: "wind", role: "Controller", isSkin: true },
    { id: "yakatsuri-alt-1", name: "Yakatsuri (Alt 1)", img: "Card_sets/yakatsuri_1.png", rarity: "N", element: "fire", role: "Attacker", isSkin: true },
    { id: "yamazaki-kenzou-alt-1", name: "Yamazaki Kenzou (Alt 1)", img: "Card_sets/Yamazaki Kenzou_1.png", rarity: "N", element: "earth", role: "Attacker", isSkin: true },
    { id: "yamazaki-kenzou-alt-2", name: "Yamazaki Kenzou (Alt 2)", img: "Card_sets/Yamazaki Kenzou_2.jpg", rarity: "N", element: "earth", role: "Attacker", isSkin: true },
  ];

  function clone(a) { return a.map((c) => Object.assign({}, c, { skins: (c.skins || []).map((s) => Object.assign({}, s)) })); }

  /* ---------- ตั้งชื่ออัตโนมัติให้การ์ดที่ยังไม่มีชื่อ ---------- */
  function prettifyName(s) {
    return String(s == null ? "" : s)
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (m) => m.toUpperCase());
  }
  function fillNames(arr) {
    let changed = false;
    arr.forEach((c) => {
      if (!c.name || !String(c.name).trim()) {
        const base = String(c.img || "").split("/").pop();
        c.name = prettifyName(base) || prettifyName(c.id) || "Card";
        changed = true;
      }
    });
    return changed;
  }

  function slugId(name) {
    return String(name).toLowerCase().trim()
      .replace(/[^a-z0-9\u0E00-\u0E7F]+/g, "-")
      .replace(/^-+|-+$/g, "") || ("card-" + Date.now().toString(36));
  }

  /* ---------- ตรวจว่าชื่อไฟล์เป็นการ์ดสกินหรือไม่ ----------
     กติกา: "_" ติดหน้าตัวเลข = สกินของยูนิตนั้น (Takemura_1.png, Usuki_3.webp)
            "ART" = ยูนิตพิเศษ, "ART"+ตัวเลข = สกินของยูนิต ART (gouken_ART1.jpg)
     ต้องไม่นับ EW_16KfVcAAPIb1.jpg / HIGH-VOLTAGE-IMG_1248-MRM.jpg
     (มีตัวอักษร/ขีด หลังตัวเลข) และ Amatsumara_ssr.png / reinhardt_gif.gif (ตามด้วยตัวอักษร) */
  const SKIN_RE = /(?:_\d+|_ART\d+)\.[a-z0-9]+$/i;
  function looksLikeSkin(img) {
    const base = String(img || "").split("/").pop();
    return SKIN_RE.test(base);
  }
  // ตั้งธง isSkin ให้การ์ดที่ชื่อไฟล์เข้าเกณฑ์ (ไม่ล้างค่าที่ตั้งไว้เดิม)
  function normalizeSkin(arr) {
    let changed = false;
    arr.forEach((c) => {
      if (!c.isSkin && looksLikeSkin(c.img)) { c.isSkin = true; changed = true; }
    });
    return changed;
  }

  /* ---------- โหลด / บันทึก ---------- */
  function loadCards() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        let arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          let ver = 0;
          try { ver = Number(localStorage.getItem(VER_KEY)) || 0; } catch (e) {}
          if (ver < REGISTRY_VERSION) {
            if (ver < 6) {
              /* v6 = เปลี่ยนโครงสร้างยูนิต/สกิน/ART ใหม่ทั้งหมด -> สร้างรีจิสทรีใหม่สด */
              arr = clone(DEFAULTS);
            } else {
              const byId = {};
              arr.forEach((c) => (byId[c.id] = c));
              DEFAULTS.forEach((d) => {
                const cur = byId[d.id];
                if (!cur) arr.push(clone([d])[0]);
                else if (d.gif && !cur.gif) cur.gif = d.gif; // เติม GIF ให้การ์ดเดิม
              });
            }
            saveCards(arr);
            try { localStorage.setItem(VER_KEY, String(REGISTRY_VERSION)); } catch (e) {}
          }
          if (normalizeSkin(arr)) saveCards(arr); // ชื่อไฟล์ที่มี _ หน้าตัวเลข = การ์ดสกินเสมอ
          if (fillNames(arr)) saveCards(arr);
          return arr;
        }
      }
    } catch (e) {}
    const def = clone(DEFAULTS);
    fillNames(def);
    normalizeSkin(def);
    try { localStorage.setItem(VER_KEY, String(REGISTRY_VERSION)); } catch (e) {}
    return def;
  }
  function saveCards(arr) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(arr));
      localStorage.setItem(VER_KEY, String(REGISTRY_VERSION));
    } catch (e) {}
  }
  function allCards() { return loadCards(); }

  /* ---------- สร้างสกิลอัตโนมัติตามธาตุ/บทบาท ---------- */
  const ELEM_TH = { fire: "เพลิง", water: "วารี", wind: "วายุ", lightning: "สายฟ้า", earth: "ปฐพี", light: "แสง", dark: "อเวจี" };
  const ROLE_PASSIVE = {
    Attacker:   [{ stat: "atk", value: 0.12 }],
    Tank:       [{ stat: "hp",  value: 0.22 }],
    Support:    [{ stat: "def", value: 0.12 }],
    Controller: [{ stat: "spd", value: 0.14 }],
  };
  const ROLE_ULT = {
    Attacker:   { effects: [{ kind: "buff", stat: "atk", value: 0.30, turns: 3 }] },
    Tank:       { effects: [{ kind: "status", name: "shield", turns: 3, power: 0.9 }] },
    Support:    { effects: [{ kind: "heal", power: 1.4 }] },
    Controller: { effects: [{ kind: "debuff", stat: "atk", value: 0.30, turns: 2 }] },
  };
  function genSkills(card) {
    const el = ELEM_TH[card.element] || "พลัง";
    const role = card.role || "Attacker";
    const ult = ROLE_ULT[role] || { effects: [] };
    return {
      basic: { name: "โจมตี" + el, power: 1.0, effects: [], target: "enemy" },
      passive: { name: "พรสวรรค์", desc: "เพิ่มค่าสถานะตามบทบาท " + role, passive: ROLE_PASSIVE[role] || [] },
      ultimate: {
        name: "ท่าไม้ตาย" + el, power: 2.3,
        effects: ult.effects.slice(), target: role === "Support" ? "allAlly" : "allEnemy",
        desc: "ปลดปล่อยพลัง" + el + " (" + role + ")",
      },
    };
  }

  function makeCharacter(card) {
    return {
      id: card.id,
      name: card.name,
      anime: card.set || "ชุดการ์ดของฉัน",
      img: card.img || "",
      gif: card.gif || "",
      isSkin: !!card.isSkin,
      skins: (card.skins || []).map((s) => ({ id: s.id, name: s.name || "สกิน", img: s.img || "", gif: s.gif || "", src: s.src || null })),
      rarity: card.rarity,
      element: card.element,
      role: card.role,
      skills: genSkills(card),
    };
  }

  /* ---------- สร้างข้อมูลเกมจาก registry (เรียกได้ตอน runtime) ---------- */
  function rebuild() {
    if (!window.GAME_DATA) return;
    const all = loadCards();
    const chars = all.filter((c) => c.rarity && window.GAME_DATA.RARITY && window.GAME_DATA.RARITY[c.rarity]).map(makeCharacter);
    const byId = {};
    chars.forEach((c) => (byId[c.id] = c));
    window.GAME_DATA.ALL_CARDS = all;
    window.GAME_DATA.CHARACTERS = chars;
    window.GAME_DATA.CHAR_BY_ID = byId;
    const RAR = window.GAME_DATA.RARITY || {};
    const drawable = chars.filter((c) => !c.isSkin && !(RAR[c.rarity] && RAR[c.rarity].skinOnly));
    window.GAME_DATA.DRAWABLE = drawable;
    window.GAME_DATA.STARTER_IDS = drawable.map((c) => c.id);
  }

  window.CardStore = {
    STORE_KEY, DEFAULTS, clone, slugId,
    prettifyName, fillNames,
    loadCards, saveCards, allCards,
    looksLikeSkin, normalizeSkin,
    genSkills, makeCharacter, rebuild,
  };
})();
