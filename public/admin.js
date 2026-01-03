const tg = window.Telegram?.WebApp;
if (tg) tg.expand();

const state = { initData: tg?.initData || "" };
const $ = (id) => document.getElementById(id);

function toast(msg){
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(()=>t.classList.remove("show"), 1500);
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

async function adminCheck(){
  const r = await api("/api/admin/me", { method:"POST", body:"{}" });
  if (!r.ok) {
    $("adminSub").textContent = "Нет доступа";
    toast("Ты не админ");
    return false;
  }
  $("adminSub").textContent = "Доступ OK • adminId " + r.adminId;
  return true;
}

$("btnApply").onclick = async () => {
  const ok = await adminCheck();
  if (!ok) return;

  const userId = $("userId").value.trim();
  const delta = Number($("delta").value || 0);
  const info = $("applyInfo");
  info.textContent = "Применяем...";

  const r = await api("/api/admin/adjust", {
    method:"POST",
    body: JSON.stringify({ userId, delta })
  });

  if (!r.ok) {
    info.textContent = "Ошибка: " + (r.error || "unknown");
    toast("Ошибка");
    return;
  }

  info.textContent = "Готово ✅ Новый баланс: " + r.balance;
  toast("OK");
};

$("btnStats").onclick = async () => {
  const ok = await adminCheck();
  if (!ok) return;

  const r = await api("/api/admin/stats", { method:"GET" });
  if (!r.ok) { toast("Ошибка stats"); return; }
  $("stats").textContent = JSON.stringify(r, null, 2);
};

adminCheck();
