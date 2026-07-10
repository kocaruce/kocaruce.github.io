// 관리자 화면: 가입 선생님 목록 + 후원 기록 + 운영 관리. (99p 관리자만 접근)

let allUsers = [];
let allDons = [];
let shownUsers = [];

function kstToday() {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}
function fmtDate(ts) {
  if (!ts) return "–";
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function gate(msg, cls) {
  const g = document.getElementById("admin-gate");
  g.hidden = false;
  g.className = "admin-note" + (cls ? " " + cls : "");
  g.innerHTML = msg;
  document.getElementById("admin-content").hidden = true;
}

function loginPrompt() {
  gate(`
    <div class="admin-login">
      <p>관리자 로그인이 필요해요.</p>
      <button class="social-btn google" id="ad-google"><span class="g">G</span> 구글로 로그인</button>
      <div class="gate-divider"><span>또는 이메일</span></div>
      <input id="ad-email" type="email" placeholder="이메일">
      <input id="ad-pw" type="password" placeholder="비밀번호">
      <button class="gate-primary" id="ad-login">로그인</button>
      <p class="gate-err" id="ad-err"></p>
    </div>`);
  const err = document.getElementById("ad-err");
  document.getElementById("ad-google").onclick = async () => {
    err.textContent = "";
    try { await window.signInGoogle(); } catch (e) { err.textContent = "로그인에 실패했어요."; }
  };
  document.getElementById("ad-login").onclick = async () => {
    err.textContent = "";
    try { await window.signInEmail(document.getElementById("ad-email").value.trim(), document.getElementById("ad-pw").value); }
    catch (e) { err.textContent = "이메일 또는 비밀번호를 확인해 주세요."; }
  };
}

/* ── 표 렌더링 ── */
function renderUsers(list) {
  shownUsers = list;
  const utb = document.querySelector("#users-table tbody");
  utb.innerHTML = list.length ? list.map(u => `
    <tr>
      <td>${esc(u.name)}</td>
      <td>${esc(u.affiliation)}</td>
      <td>${esc(u.region)}</td>
      <td>${esc(u.orgName) || "–"}</td>
      <td class="mono">${esc(u.email)}</td>
      <td class="mono">${fmtDate(u.createdAt)}</td>
    </tr>`).join("") : `<tr><td colspan="6" class="empty">${allUsers.length ? "검색 결과가 없어요." : "아직 가입한 선생님이 없어요."}</td></tr>`;
  document.getElementById("count-users").textContent = `(${list.length}명)`;
}

function renderDons(list) {
  const dtb = document.querySelector("#dons-table tbody");
  dtb.innerHTML = list.length ? list.map(d => `
    <tr>
      <td class="mono">${fmtDate(d.at)}</td>
      <td>${esc(d.name)}</td>
      <td>${esc([d.affiliation, d.orgName].filter(Boolean).join(" · ")) || "–"}</td>
      <td>${esc(d.region) || "–"}</td>
      <td>${esc(d.method === "kakaopay" ? "카카오페이" : d.method) || "–"}</td>
    </tr>`).join("") : `<tr><td colspan="5" class="empty">아직 후원 기록이 없어요.</td></tr>`;
  document.getElementById("count-dons").textContent = `(${list.length}건)`;
}

/* ── 검색 필터 ── */
function applyUserSearch() {
  const q = document.getElementById("user-search").value.trim().toLowerCase();
  if (!q) { renderUsers(allUsers); return; }
  const filtered = allUsers.filter(u =>
    [u.name, u.affiliation, u.region, u.orgName].some(v => String(v || "").toLowerCase().includes(q)));
  renderUsers(filtered);
}

/* ── CSV 내보내기 ── */
function csvEscape(v) {
  const s = String(v == null ? "" : v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function toCSV(rows, headers) {
  const lines = [headers.map(h => csvEscape(h.label)).join(",")];
  rows.forEach(r => lines.push(headers.map(h => csvEscape(h.get(r))).join(",")));
  return "﻿" + lines.join("\r\n"); // BOM: 엑셀에서 한글 깨짐 방지
}
function downloadCSV(filename, csv) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function exportUsersCSV() {
  const csv = toCSV(shownUsers, [
    { label: "이름", get: u => u.name },
    { label: "소속", get: u => u.affiliation },
    { label: "지역", get: u => u.region },
    { label: "원 이름", get: u => u.orgName },
    { label: "이메일", get: u => u.email },
    { label: "가입일", get: u => fmtDate(u.createdAt) },
  ]);
  downloadCSV(`꿈놀이터_회원목록_${kstToday()}.csv`, csv);
}
function exportDonsCSV() {
  const csv = toCSV(allDons, [
    { label: "일시", get: d => fmtDate(d.at) },
    { label: "이름", get: d => d.name },
    { label: "소속", get: d => d.affiliation },
    { label: "원 이름", get: d => d.orgName },
    { label: "지역", get: d => d.region },
    { label: "방법", get: d => d.method === "kakaopay" ? "카카오페이" : d.method },
  ]);
  downloadCSV(`꿈놀이터_후원기록_${kstToday()}.csv`, csv);
}

/* ── 운영 관리: 오래된 주문 정리 ── */
function setupCleanup() {
  const dateInput = document.getElementById("cleanup-date");
  const d = new Date(Date.now() - 90 * 86400000);
  dateInput.value = d.toISOString().slice(0, 10); // 기본값: 90일 전

  document.getElementById("cleanup-btn").onclick = async () => {
    const before = dateInput.value;
    const result = document.getElementById("cleanup-result");
    if (!before) { result.textContent = "날짜를 선택해 주세요."; return; }
    if (!confirm(`${before} 이전 주문을 모두 삭제할까요?\n되돌릴 수 없어요.`)) return;
    result.textContent = "정리하는 중…";
    try {
      const count = await window.adminCleanupOrders(before);
      result.textContent = count > 0 ? `${count}건을 정리했어요.` : "정리할 주문이 없어요.";
    } catch (e) {
      result.textContent = "정리에 실패했어요. 잠시 후 다시 시도해 주세요.";
    }
  };
}

/* ── 데이터 로드 ── */
async function loadAdmin() {
  gate("불러오는 중…");
  try {
    allUsers = await window.adminGetUsers();
    allDons = await window.adminGetDonations();
  } catch (e) {
    gate("데이터를 불러오지 못했어요. 잠시 후 새로고침해 주세요.", "err");
    return;
  }

  document.getElementById("admin-gate").hidden = true;
  document.getElementById("admin-content").hidden = false;

  allUsers.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  allDons.sort((a, b) => (b.at || 0) - (a.at || 0));

  document.getElementById("stat-users").textContent = allUsers.length;
  document.getElementById("stat-dons").textContent = allDons.length;

  renderUsers(allUsers);
  renderDons(allDons);

  document.getElementById("user-search").oninput = applyUserSearch;
  document.getElementById("users-csv").onclick = exportUsersCSV;
  document.getElementById("dons-csv").onclick = exportDonsCSV;
  setupCleanup();
}

function begin() {
  if (!window.AUTH_ENABLED) { gate("Firebase 설정이 필요해요.", "err"); return; }
  window.watchAuth((user) => {
    if (!user) { loginPrompt(); return; }
    if (window.isAdmin && window.isAdmin()) loadAdmin();
    else gate("이 화면은 <b>관리자</b>만 볼 수 있어요.<br>관리자 계정으로 로그인해 주세요.", "err");
  });
}

if (window.AUTH_READY) begin();
else window.addEventListener("auth-ready", begin, { once: true });
