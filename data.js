/* ============================================================
   ANIME LEGENDS: CARD COLLECTOR
   data.js — ข้อมูลเกม (static) + สร้างรายชื่อการ์ดจาก CardStore
   ============================================================ */

/* ---------- ระดับความหายาก ---------- */
const RARITY_ORDER = ["N", "R", "SR", "SSR", "UR", "LR", "ART"];

const RARITY = {
  N:   { name: "N",   power: 400,  rate: 57,    color: "#9aa4b2", levelCap: 20,  maxStars: 3, starShards: [5, 10] },
  R:   { name: "R",   power: 600,  rate: 27,    color: "#3ec6ff", levelCap: 30,  maxStars: 4, starShards: [10, 20, 40] },
  SR:  { name: "SR",  power: 850,  rate: 10,    color: "#a78bfa", levelCap: 40,  maxStars: 5, starShards: [20, 40, 80, 120] },
  SSR: { name: "SSR", power: 1150, rate: 3.5,   color: "#fbbf24", levelCap: 60,  maxStars: 6, starShards: [40, 80, 120, 160, 220] },
  UR:  { name: "UR",  power: 1500, rate: 1.5,   color: "#fb7dc0", levelCap: 80,  maxStars: 7, starShards: [60, 100, 160, 220, 300, 400] },
  LR:  { name: "LR",  power: 2000, rate: 0.999, color: "#ff4d6d", levelCap: 100, maxStars: 8, starShards: [80, 140, 200, 280, 380, 520, 700] },
  ART: { name: "ART", power: 2600, rate: 0.001, color: "#ff6ad5", levelCap: 120, maxStars: 8, starShards: [100, 160, 220, 300, 400, 540, 720] },
};

/* ---------- ธาตุ ---------- */
const ELEMENTS = {
  fire:      { name: "ไฟ",      icon: "🔥", color: "#ff6b35" },
  water:     { name: "น้ำ",     icon: "💧", color: "#3ea6ff" },
  wind:      { name: "ลม",      icon: "🌪️", color: "#4ade80" },
  lightning: { name: "สายฟ้า",  icon: "⚡", color: "#facc15" },
  earth:     { name: "ดิน",     icon: "🪨", color: "#b08d57" },
  light:     { name: "แสง",     icon: "✨", color: "#fde68a" },
  dark:      { name: "มืด",     icon: "🌑", color: "#a78bfa" },
};
/* วงจรได้เปรียบ */
const ELEMENT_ADV = {
  fire: "wind", wind: "earth", earth: "lightning",
  lightning: "water", water: "fire", light: "dark", dark: "light",
};

/* ---------- บทบาท ---------- */
const ROLES = {
  Attacker:   { name: "Attacker",   icon: "⚔️", w: { atk: 1.45, hp: 0.80, def: 0.70, spd: 1.15 } },
  Tank:       { name: "Tank",       icon: "🛡️", w: { atk: 0.80, hp: 1.55, def: 1.45, spd: 0.70 } },
  Support:    { name: "Support",    icon: "💚", w: { atk: 0.90, hp: 1.10, def: 1.05, spd: 1.05 } },
  Controller: { name: "Controller", icon: "🌀", w: { atk: 1.00, hp: 1.00, def: 0.90, spd: 1.30 } },
};

/* ============================================================
   การ์ดทั้งหมดมาจาก CardStore (cards.js)
   เฉพาะการ์ดที่กำหนดระดับแล้วจึงถูกใช้ในเกม
   ============================================================ */
const CARDSTORE = window.CardStore;
const ALL_CARDS = CARDSTORE.loadCards();
function hasRarity(c) { return c.rarity && RARITY[c.rarity]; }
const CHARACTERS = ALL_CARDS.filter(hasRarity).map(CARDSTORE.makeCharacter);
const CHAR_BY_ID = {};
CHARACTERS.forEach((c) => (CHAR_BY_ID[c.id] = c));
const CARD_IDS = ALL_CARDS.map((c) => c.id);

/* การ์ดที่ "สุ่มได้" — ตัดระดับที่เป็นสกินเท่านั้น (เช่น ART) ออก
   สกิน/ART จะไม่ถูกสุ่มตอนเริ่มเกมหรือในตู้ตัวละคร */
function isDrawable(c) { return !c.isSkin && !(RARITY[c.rarity] && RARITY[c.rarity].skinOnly); }
const DRAWABLE = CHARACTERS.filter(isDrawable);

/* ---------- ตัวช่วยสร้างทีมศัตรู (อ้างการ์ดที่มีอยู่จริง) ---------- */
function E(id, level, star) { return { id, level: level || 1, star: star || 1 }; }
function enemyTeam(n, level, star) {
  if (!CARD_IDS.length) return [];
  const out = [];
  for (let i = 0; i < n; i++) out.push(E(CARD_IDS[i % CARD_IDS.length], level, star));
  return out;
}

/* ---------- ตู้ Gacha (ปรับแต่งได้จากแดชบอร์ด) ---------- */
const CABINETS = window.CabinetStore.loadCabinets();
const BANNERS = CABINETS.map((c) => ({
  id: c.id, name: c.name, desc: c.desc || "", type: c.type === "skin" ? "skin" : "card",
  img: c.img || "", cards: c.cards || [], skins: c.skins || [], rates: c.rates || null,
  anime: null, featuredUR: c.featuredUR || null, featuredLR: c.featuredLR || null,
}));

const GACHA = {
  singleCost: 30,
  multiCost: 270,
  multiSize: 10,
  pitySR: 10,
  pitySSR: 60,
  pityUR: 120,
};

/* ---------- การ์ดเริ่มต้นให้เลือก (ตัดสกิน/ART ออก) ---------- */
const STARTER_IDS = DRAWABLE.map((c) => c.id);

/* ---------- ภารกิจ / โหมด ---------- */
const STAGES = [
  { id: "s1-1", chapter: 1, name: "จุดเริ่มต้น", anime: null,
    enemies: enemyTeam(2, 3, 1), reward: { gold: 120, exp: 40, gems: 10 }, firstGems: 30 },
  { id: "s1-2", chapter: 1, name: "ด่านที่สอง", anime: null,
    enemies: enemyTeam(3, 5, 1), reward: { gold: 160, exp: 55, gems: 10 }, firstGems: 30 },
  { id: "s2-1", chapter: 2, name: "ด่านที่สาม", anime: null,
    enemies: enemyTeam(3, 8, 2), reward: { gold: 220, exp: 75, gems: 15 }, firstGems: 40 },
  { id: "s2-2", chapter: 2, name: "ด่านที่สี่", anime: null,
    enemies: enemyTeam(3, 11, 2), reward: { gold: 300, exp: 100, gems: 20 }, firstGems: 50 },
];
const CHAPTERS = { 1: "บทที่ 1: จุดเริ่มต้น", 2: "บทที่ 2: ท้าทาย" };

/* ---------- Arena ---------- */
const ARENA_TIERS = [
  { id: "arena-bronze", name: "ลีกทองแดง", power: 1, enemies: enemyTeam(3, 6, 1),  reward: { gold: 150, gems: 8,  exp: 45 } },
  { id: "arena-silver", name: "ลีกเงิน",   power: 2, enemies: enemyTeam(4, 14, 2), reward: { gold: 320, gems: 15, exp: 90 } },
  { id: "arena-gold",   name: "ลีกทอง",    power: 3, enemies: enemyTeam(5, 30, 3), reward: { gold: 700, gems: 30, exp: 200 } },
];

/* ---------- Boss ---------- */
const BOSSES = [
  { id: "boss-1", name: "บอส: ผู้ท้าทาย", mechanic: "ศัตรู HP สูงมาก ใช้ท่าไม้ตายต่อเนื่อง",
    enemies: enemyTeam(2, 35, 4), reward: { gold: 900, gems: 60, exp: 300 }, firstGems: 100 },
  { id: "boss-2", name: "บอส: จอมพลัง", mechanic: "ทีมศัตรูแข็งแกร่ง ต้องอัปเกรดและจัดทีมให้พร้อม",
    enemies: enemyTeam(3, 40, 4), reward: { gold: 1400, gems: 90, exp: 420 }, firstGems: 150 },
];

/* ---------- Tower (10 ชั้น) ---------- */
const TOWER_MAX_FLOOR = 10;
function towerFloor(n) {
  const lvl = 4 + n * 3;
  const star = Math.min(1 + Math.floor(n / 3), 4);
  const count = Math.min(2 + Math.floor(n / 2), 5);
  return { floor: n, enemies: enemyTeam(count, lvl, star), reward: { gold: 80 + n * 40, gems: 5 + n * 2, exp: 30 + n * 15 }, firstGems: 0 };
}

/* ---------- ภารกิจประจำวัน ---------- */
const DAILY_TEMPLATES = [
  { id: "daily-win", type: "battleWin", target: 3, desc: "ชนะการต่อสู้ 3 ครั้ง", reward: { gold: 200, gems: 20 } },
  { id: "daily-gacha", type: "gachaPulls", target: 5, desc: "เปิดแพ็ก 5 ครั้ง", reward: { gold: 150, gems: 30 } },
  { id: "daily-levelup", type: "levelUp", target: 2, desc: "อัปเกรดตัวละคร 2 ครั้ง", reward: { expItem: 3, gems: 15 } },
];

/* ---------- กิจกรรม (Event) ---------- */
const EVENTS = [
  { id: "event-1", name: "เทศกาลพิเศษ", desc: "ต่อสู้กับทีมพิเศษรับรางวัล",
    enemies: enemyTeam(4, 18, 2), reward: { gold: 500, gems: 40, exp: 150 }, firstGems: 60 },
];

/* ---------- ร้านค้า ---------- */
const SHOP = [
  { id: "exp-small", name: "ยา EXP เล็ก", currency: "gold", price: 100, give: { expItem: 1 }, desc: "EXP +100 เมื่อใช้กับตัวละคร" },
  { id: "exp-large", name: "ยา EXP ใหญ่", currency: "gold", price: 400, give: { expItem: 5 }, desc: "EXP รวม +600" },
  { id: "enh-mat", name: "วัสดุเสริมพลัง", currency: "gold", price: 250, give: { enhMat: 1 }, desc: "ใช้เพิ่มดาว/เสริมพลังตัวละคร" },
  { id: "chest", name: "หีบสมบัติ", currency: "gems", price: 200, give: { chest: 1 }, desc: "สุ่มรับรางวัล: ทอง · ยา EXP · วัสดุ · เศษซ้ำ" },
  { id: "profile-bg", name: "ฉากหลังโปรไฟล์", currency: "gems", price: 250, give: { profileBg: 1 }, desc: "สุ่มปลดล็อกฉากหลังโปรไฟล์ 1 แบบ (ติดตั้งให้อัตโนมัติ)" },
  { id: "gem-pack", name: "แพ็กเพชรเล็ก", currency: "gems", price: 0, give: {}, desc: "แลกได้ในอีเวนต์เท่านั้น" },
];

/* ---------- ฉากหลังโปรไฟล์ (ตกแต่ง) ----------
   เฉดสีกำหนดผ่านคลาส .pb-<id> ใน styles.css (ใช้ตัวแปร --pb) */
const PROFILE_BGS = [
  { id: "cosmos", name: "เนบิวลาหมื่นดวง" },
  { id: "sunset", name: "แสงอาทิตย์อัสดง" },
  { id: "ocean", name: "ห้วงสมุทร" },
  { id: "forest", name: "ป่าลึกลับ" },
  { id: "sakura", name: "ซากุระบาน" },
  { id: "gold", name: "ทองอร่าม" },
];

/* ---------- แลกการ์ดด้วยเศษซ้ำ (เฉพาะระดับ UR ขึ้นไป) ----------
   ใช้เศษซ้ำต่อตัวของยูนิต UR/LR/ART ที่มีอยู่ รวมเป็นพูลเดียว แล้วเลือกแลกการ์ดได้เอง */
const EXCHANGE = {
  minRarity: "UR",
  cost: { UR: 100, LR: 300, ART: 1000 },
};

/* ค่าคงที่เศรษฐกิจ */
const GE = {
  expItemValue: 100,
  levelUpGoldPerLvl: 40,
  starGoldBase: 300,
  battleGoldBase: 60,
  battleExpBase: 35,
  battleGoldPerLv: 8,
  battleExpPerLv: 5,
  /* น้ำหนักสกินต่อตู้การ์ด — ยิ่งสูงยิ่งมีโอกาสออกสกินบ่อย
     โอกาสออกสกินระดับ r = (จำนวนสกินที่ r * skinWeight) / (จำนวนตัวที่ r + จำนวนสกินที่ r * skinWeight) */
  skinWeight: 0.5,
};

window.GAME_DATA = {
  RARITY_ORDER, RARITY, ELEMENTS, ELEMENT_ADV, ROLES,
  ALL_CARDS, CARD_IDS,
  CHARACTERS, CHAR_BY_ID, BANNERS, CABINETS, GACHA, STARTER_IDS, DRAWABLE,
  STAGES, CHAPTERS, ARENA_TIERS, BOSSES, TOWER_MAX_FLOOR, towerFloor,
  DAILY_TEMPLATES, EVENTS, SHOP, GE, EXCHANGE, PROFILE_BGS,
};
