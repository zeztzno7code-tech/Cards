/* ============================================================
   ANIME LEGENDS — cabinets.js
   ระบบตู้กาชา (ตู้ + ชื่อ + รูป + ตัวใส่ตู้) ปรับแต่งได้จากแดชบอร์ด
   - แต่ละตู้มี: ชื่อ, รูป (ในโฟลเดอร์ gacha), คำอธิบาย, การ์ดที่ใส่ในตู้
   - บันทึกอัตโนมัติใน localStorage
   ============================================================ */
(function () {
  const STORE_KEY = "anime_legends_cabinets_v1";

  /* ---------- ค่าเริ่มต้น: 2 ตู้การ์ด + 1 ตู้สกิน ---------- */
  const DEFAULTS = [
    { id: "cab-1", name: "ออลสตาร์", type: "card", img: "gacha/gacha_1.jpg", desc: "รวมการ์ดทั้งหมดในระบบ", cards: [], skins: [], rates: null },
    { id: "cab-2", name: "ตู้พิเศษ",  type: "card", img: "gacha/gacha_2.jpg", desc: "ตู้กาชาใหม่",           cards: [], skins: [], rates: null },
    { id: "cab-3", name: "ตู้สกิน",   type: "skin", img: "gacha/gacha_3.jpg", desc: "สุ่มสกินสำหรับเปลี่ยนรูปการ์ด", cards: [], skins: [], rates: null },
  ];

  function clone(a) { return a.map((c) => Object.assign({}, c, { cards: (c.cards || []).slice(), skins: (c.skins || []).map((s) => Object.assign({}, s)) })); }

  function loadCabinets() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length) return arr;
      }
    } catch (e) {}
    return clone(DEFAULTS);
  }
  function saveCabinets(arr) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(arr)); } catch (e) {}
  }

  /* ---------- สร้างข้อมูลตู้ให้เกม (เรียกได้ตอน runtime) ---------- */
  function rebuild() {
    if (!window.GAME_DATA) return;
    const cabs = loadCabinets();
    window.GAME_DATA.CABINETS = cabs;
    window.GAME_DATA.BANNERS = cabs.map((c) => ({
      id: c.id, name: c.name, desc: c.desc || "", type: c.type === "skin" ? "skin" : "card",
      img: c.img || "", cards: (c.cards || []).slice(),
      skins: (c.skins || []).map((s) => Object.assign({}, s)),
      rates: c.rates || null,
      anime: null, featuredUR: c.featuredUR || null, featuredLR: c.featuredLR || null,
    }));
  }

  window.CabinetStore = { STORE_KEY, DEFAULTS, clone, loadCabinets, saveCabinets, rebuild };
})();
