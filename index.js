const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 10000;
const BOT_TOKEN = process.env.BOT_TOKEN || "";
const ADMIN_IDS = (process.env.ADMIN_IDS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

const DB_PATH = path.join(__dirname, "db.json");

// ---------- DB helpers ----------
function loadDB() {
  try { return JSON.parse(fs.readFileSync(DB_PATH, "utf8")); }
  catch { return { users: {}, daily: {}, logs: [] }; }
}
function saveDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf8");
}
function nowSec() { return Math.floor(Date.now() / 1000); }
function uidKey(userId) { return String(userId); }

function getOrCreateUser(db, user) {
  const key = uidKey(user.id);
  if (!db.users[key]) {
    db.users[key] = {
      id: user.id,
      username: user.username || "",
      first_name: user.first_name || "",
      balance: 1300,
      inventory: {},
      createdAt: Date.now()
    };
  }
  // обновим имя/юзернейм
  db.users[key].username = user.username || db.users[key].username;
  db.users[key].first_name = user.first_name || db.users[key].first_name;
  return db.users[key];
}

// ---------- Telegram initData verify ----------
function parseInitData(initData) {
  // initData = "query_id=...&user=...&auth_date=...&hash=..."
  const params = new URLSearchParams(initData);
  const hash = params.get("hash") || "";
  params.delete("hash");

  // data_check_string: сортировка по key=value \n
  const pairs = [];
  for (const [k, v] of params.entries()) pairs.push([k, v]);
  pairs.sort((a, b) => a[0].localeCompare(b[0]));
  const dataCheckString = pairs.map(([k, v]) => `${k}=${v}`).join("\n");

  return { hash, dataCheckString, params };
}

function verifyInitData(initData) {
  if (!BOT_TOKEN) return { ok: false, error: "BOT_TOKEN missing" };
  if (!initData) return { ok: false, error: "initData missing" };

  const { hash, dataCheckString, params } = parseInitData(initData);

  // secret_key = HMAC_SHA256("WebAppData", bot_token)
  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(BOT_TOKEN)
    .digest();

  const calcHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (calcHash !== hash) return { ok: false, error: "bad hash" };

  // auth_date проверка (не обяз, но полезно)
  const authDate = Number(params.get("auth_date") || "0");
  if (authDate && Math.abs(nowSec() - authDate) > 60 * 60 * 24) {
    return { ok: false, error: "auth_date too old" };
  }

  const userRaw = params.get("user");
  if (!userRaw) return { ok: false, error: "user missing" };

  let user;
  try { user = JSON.parse(userRaw); }
  catch { return { ok: false, error: "bad user json" }; }

  return { ok: true, user };
}

function requireAuth(req, res, next) {
  const initData = req.headers["x-telegram-initdata"] || "";
  const v = verifyInitData(initData);
  if (!v.ok) return res.status(401).json({ ok: false, error: v.error });
  req.tgUser = v.user;
  next();
}

function isAdmin(userId) {
  return ADMIN_IDS.includes(String(userId));
}

// ---------- API ----------
app.get("/api/me", requireAuth, (req, res) => {
  const db = loadDB();
  const u = getOrCreateUser(db, req.tgUser);
  saveDB(db);

  res.json({
    ok: true,
    user: {
      id: u.id,
      username: u.username,
      first_name: u.first_name
    },
    balance: u.balance,
    inventory: u.inventory,
    isAdmin: isAdmin(u.id)
  });
});

// Coin flip: side = "heads"|"tails", bet integer
app.post("/api/flip", requireAuth, (req, res) => {
  const { side, bet } = req.body || {};
  const betInt = Math.floor(Number(bet || 0));

  if (!["heads", "tails"].includes(side)) {
    return res.status(400).json({ ok: false, error: "bad side" });
  }
  if (!Number.isFinite(betInt) || betInt <= 0) {
    return res.status(400).json({ ok: false, error: "bad bet" });
  }

  const db = loadDB();
  const u = getOrCreateUser(db, req.tgUser);

  if (u.balance < betInt) return res.json({ ok: false, error: "not_enough" });

  const result = crypto.randomInt(0, 2) === 0 ? "heads" : "tails";
  const win = (result === side);

  u.balance -= betInt;
  if (win) u.balance += betInt * 2; // x2

  db.logs.push({ t: Date.now(), type: "flip", userId: u.id, bet: betInt, side, result, win });
  if (db.logs.length > 2000) db.logs.shift();
  saveDB(db);

  res.json({ ok: true, result, win, balance: u.balance });
});

// Cups: pick 1..3, bet
app.post("/api/cups", requireAuth, (req, res) => {
  const { pick, bet } = req.body || {};
  const betInt = Math.floor(Number(bet || 0));
  const pickInt = Math.floor(Number(pick || 0));

  if (![1,2,3].includes(pickInt)) return res.status(400).json({ ok:false, error:"bad pick" });
  if (!Number.isFinite(betInt) || betInt <= 0) return res.status(400).json({ ok:false, error:"bad bet" });

  const db = loadDB();
  const u = getOrCreateUser(db, req.tgUser);
  if (u.balance < betInt) return res.json({ ok:false, error:"not_enough" });

  const hidden = crypto.randomInt(1, 4); // 1..3
  const win = (hidden === pickInt);

  u.balance -= betInt;
  if (win) u.balance += betInt * 3; // x3 (как “стаканчики” обычно)

  db.logs.push({ t: Date.now(), type:"cups", userId:u.id, bet:betInt, pick:pickInt, hidden, win });
  if (db.logs.length > 2000) db.logs.shift();
  saveDB(db);

  res.json({ ok:true, hidden, win, balance:u.balance });
});

// Daily bonus: 1 раз в 24 часа
app.post("/api/daily", requireAuth, (req, res) => {
  const db = loadDB();
  const u = getOrCreateUser(db, req.tgUser);
  const key = uidKey(u.id);

  const last = Number(db.daily[key] || 0);
  const now = Date.now();
  const cd = 24 * 60 * 60 * 1000;

  if (now - last < cd) {
    const leftMs = cd - (now - last);
    return res.json({ ok:false, error:"cooldown", leftMs, balance:u.balance });
  }

  const reward = crypto.randomInt(120, 301); // 120..300
  u.balance += reward;
  db.daily[key] = now;
  db.logs.push({ t: now, type:"daily", userId:u.id, reward });
  if (db.logs.length > 2000) db.logs.shift();
  saveDB(db);

  res.json({ ok:true, reward, balance:u.balance });
});

// Simple shop buy (virtual items)
const SHOP = [
  { id: "vip_badge", name: "VIP Badge", price: 500 },
  { id: "luck_charm", name: "Lucky Charm", price: 800 },
  { id: "skin_dark", name: "Dark Skin", price: 1200 }
];

app.get("/api/shop", requireAuth, (req, res) => {
  res.json({ ok:true, items: SHOP });
});

app.post("/api/shop/buy", requireAuth, (req, res) => {
  const { itemId } = req.body || {};
  const item = SHOP.find(x => x.id === itemId);
  if (!item) return res.status(400).json({ ok:false, error:"no_item" });

  const db = loadDB();
  const u = getOrCreateUser(db, req.tgUser);
  if (u.balance < item.price) return res.json({ ok:false, error:"not_enough", balance:u.balance });

  u.balance -= item.price;
  u.inventory[item.id] = (u.inventory[item.id] || 0) + 1;

  db.logs.push({ t: Date.now(), type:"buy", userId:u.id, itemId:item.id, price:item.price });
  if (db.logs.length > 2000) db.logs.shift();
  saveDB(db);

  res.json({ ok:true, balance:u.balance, inventory:u.inventory });
});

// ---------- Admin ----------
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// Admin verify
app.post("/api/admin/me", requireAuth, (req, res) => {
  const ok = isAdmin(req.tgUser.id);
  if (!ok) return res.status(403).json({ ok:false, error:"not_admin" });
  res.json({ ok:true, adminId: req.tgUser.id });
});

// Admin adjust balance
app.post("/api/admin/adjust", requireAuth, (req, res) => {
  if (!isAdmin(req.tgUser.id)) return res.status(403).json({ ok:false, error:"not_admin" });

  const { userId, delta } = req.body || {};
  const uid = String(userId || "");
  const d = Math.floor(Number(delta || 0));
  if (!uid) return res.status(400).json({ ok:false, error:"bad userId" });
  if (!Number.isFinite(d) || d === 0) return res.status(400).json({ ok:false, error:"bad delta" });

  const db = loadDB();
  const u = db.users[uid];
  if (!u) return res.status(404).json({ ok:false, error:"user not found" });

  u.balance = Math.max(0, (u.balance || 0) + d);
  db.logs.push({ t: Date.now(), type:"admin_adjust", adminId:req.tgUser.id, userId: uid, delta: d });
  saveDB(db);

  res.json({ ok:true, balance: u.balance });
});

// Admin stats
app.get("/api/admin/stats", requireAuth, (req, res) => {
  if (!isAdmin(req.tgUser.id)) return res.status(403).json({ ok:false, error:"not_admin" });
  const db = loadDB();
  const usersCount = Object.keys(db.users || {}).length;
  const top = Object.values(db.users || {})
    .sort((a,b)=> (b.balance||0)-(a.balance||0))
    .slice(0, 10)
    .map(u => ({ id:u.id, username:u.username, first_name:u.first_name, balance:u.balance }));

  res.json({ ok:true, usersCount, top, logs: db.logs.slice(-40).reverse() });
});

app.get("/health", (req,res)=>res.json({ ok:true }));

app.listen(PORT, () => {
  console.log("Server started on port", PORT);
});
