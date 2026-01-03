const tg = window.Telegram?.WebApp;
if (tg) {
  tg.expand();
  tg.setHeaderColor("#0b0f16");
  tg.setBackgroundColor("#0b0f16");
}

const $ = (id) => document.getElementById(id);

const state = {
  me: null,
  initData: tg?.initData || "", // главное!
};

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 1600);
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      "X-Telegram-InitData": state.initData
    }
  });
  return res.json();
}

function setBalance(v) { $("balance").textContent = String(v); }

function showTab(name) {
  document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b.dataset.tab === name));
  ["games","bonus","shop","profile"].forEach(t => {
    const el = document.getElementById("tab-" + t);
    el.classList.toggle("hidden", t !== name);
  });
}

document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => showTab(btn.dataset.tab));
});

$("btnOpenGames").onclick = () => showTab("games");
$("btnOpenShop").onclick = () => showTab("shop");

// chips for flip bet
document.querySelectorAll("[data-chip]").forEach(b => {
  b.onclick = () => $("flipBet").value = Number($("flipBet").value || 0) + Number(b.dataset.chip);
});
document.querySelectorAll("[data-chip2]").forEach(b => {
  b.onclick = () => $("cupsBet").value = Number($("cupsBet").value || 0) + Number(b.dataset.chip2);
});

async function loadMe() {
  if (!state.initData) {
    $("subLine").textContent = "Открой внутри Telegram (Mini App)";
    toast("Открой в Telegram");
    return;
  }
  const data = await api("/api/me", { method: "GET" });
  if (!data.ok) {
    $("subLine").textContent = "Ошибка авторизации";
    toast("Auth error");
    return;
  }
  state.me = data;
  $("subLine").textContent = "Подключено • " + (data.user.first_name || "User");
  setBalance(data.balance);
  $("uid").textContent = data.user.id;
  $("uname").textContent = data.user.username ? "@"+data.user.username : "-";
  $("inv").textContent = JSON.stringify(data.inventory || {}, null, 2);

  if (data.isAdmin) $("btnAdmin").style.display = "inline-flex";
}

async function flip(side) {
  const bet = Number($("flipBet").value || 0);
  const anim = $("coinAnim");
  const text = $("flipText");
  anim.classList.remove("spin");
  void anim.offsetWidth; // restart anim
  anim.classList.add("spin");

  text.textContent = "Крутим...";
  text.className = "resultText";

  const r = await api("/api/flip", { method:"POST", body: JSON.stringify({ side, bet }) });
  if (!r.ok) {
    if (r.error === "not_enough") toast("Не хватает баланса");
    else toast("Ошибка ставки");
    text.textContent = "Ошибка";
    text.className = "resultText bad";
    return;
  }

  setBalance(r.balance);
  if (r.win) {
    text.textContent = `WIN ✅ Выпало: ${r.result === "heads" ? "ОРЁЛ" : "РЕШКА"}`;
    text.className = "resultText good";
    toast("Победа!");
  } else {
    text.textContent = `LOSE ❌ Выпало: ${r.result === "heads" ? "ОРЁЛ" : "РЕШКА"}`;
    text.className = "resultText bad";
    toast("Не угадал");
  }
}

$("flipHeads").onclick = () => flip("heads");
$("flipTails").onclick = () => flip("tails");

async function cups(pick) {
  const bet = Number($("cupsBet").value || 0);
  const anim = $("cupsAnim");
  const text = $("cupsText");

  anim.classList.remove("bounce");
  void anim.offsetWidth;
  anim.classList.add("bounce");
  anim.textContent = "🥤";

  text.textContent = "Мешаем...";
  text.className = "resultText";

  const r = await api("/api/cups", { method:"POST", body: JSON.stringify({ pick, bet }) });
  if (!r.ok) {
    if (r.error === "not_enough") toast("Не хватает баланса");
    else toast("Ошибка ставки");
    text.textContent = "Ошибка";
    text.className = "resultText bad";
    return;
  }

  setBalance(r.balance);
  anim.textContent = "🥤" + r.hidden;

  if (r.win) {
    text.textContent = `WIN ✅ Шарик был в стакане #${r.hidden}`;
    text.className = "resultText good";
    toast("Победа!");
  } else {
    text.textContent = `LOSE ❌ Шарик был в стакане #${r.hidden}`;
    text.className = "resultText bad";
    toast("Мимо");
  }
}

document.querySelectorAll(".cup").forEach(c => {
  c.onclick = () => cups(Number(c.dataset.pick));
});

$("btnDaily").onclick = async () => {
  const info = $("dailyInfo");
  info.textContent = "Проверяем...";
  const r = await api("/api/daily", { method:"POST", body: "{}" });
  if (!r.ok) {
    if (r.error === "cooldown") {
      const mins = Math.ceil(r.leftMs / 60000);
      info.textContent = `Ещё нельзя. Осталось ~${mins} мин`;
      toast("Ежедневка на кулдауне");
      return;
    }
    info.textContent = "Ошибка";
    toast("Ошибка");
    return;
  }
  setBalance(r.balance);
  info.textContent = `+${r.reward} монет ✅`;
  toast("Забрал ежедневку!");
};

async function loadShop() {
  const grid = $("shopGrid");
  grid.innerHTML = "";
  const r = await api("/api/shop", { method:"GET" });
  if (!r.ok) return;

  r.items.forEach(item => {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div class="itemName">✨ ${item.name}</div>
      <div class="itemPrice">Цена: ${item.price} 🪙</div>
      <button class="btn" style="width:100%">Купить</button>
    `;
    div.querySelector("button").onclick = async () => {
      const b = await api("/api/shop/buy", { method:"POST", body: JSON.stringify({ itemId: item.id }) });
      if (!b.ok) {
        if (b.error === "not_enough") toast("Не хватает монет");
        else toast("Ошибка");
        return;
      }
      setBalance(b.balance);
      $("inv").textContent = JSON.stringify(b.inventory || {}, null, 2);
      toast("Куплено ✅");
    };
    grid.appendChild(div);
  });
}

$("btnAdmin").onclick = () => {
  // откроем админку в том же домене
  window.location.href = "/admin";
};

(async function init() {
  await loadMe();
  await loadShop();
})();
