// 꿈 놀이터 로그인/가입 잠금 화면.
// 흐름: 로그인/가입 → (처음이면) 프로필 입력 → 허브 열림.

(function () {
  const body = document.body;
  const REGIONS = ["서울","부산","대구","인천","광주","대전","울산","세종",
    "경기","강원","충북","충남","전북","전남","경북","경남","제주"];

  function overlay() {
    let ov = document.getElementById("gate-overlay");
    if (!ov) {
      ov = document.createElement("div");
      ov.id = "gate-overlay";
      body.appendChild(ov);
    }
    return ov;
  }
  function hideOverlay() {
    const ov = document.getElementById("gate-overlay");
    if (ov) ov.style.display = "none";
  }
  function showOverlay(html) {
    const ov = overlay();
    ov.style.display = "flex";
    ov.innerHTML = html;
    return ov;
  }

  function enterHub(profile, user) {
    body.classList.remove("locked");
    hideOverlay();
    const chip = document.getElementById("account-btn");
    if (chip) {
      const name = (profile && profile.name) || (user.email ? user.email.split("@")[0] : "선생님");
      chip.innerHTML = `<span class="dot"></span>${name} 선생님`;
      chip.title = "마이페이지";
      chip.onclick = () => { if (window.openMyPage) window.openMyPage(); };
    }
  }

  // ── 로그인 / 가입 화면 ──
  function showLogin() {
    body.classList.add("locked");
    const ov = showOverlay(`
      <div class="gate-box">
        <div class="gate-brand"><span>🌈</span> 꿈 놀이터</div>
        <h2>선생님 로그인</h2>
        <p class="gate-sub">로그인하면 놀이 도구를 이용할 수 있어요.</p>
        <button type="button" class="social-btn google" id="google-btn">
          <span class="g">G</span> 구글로 계속하기
        </button>
        <div class="gate-divider"><span>또는 이메일</span></div>
        <form id="email-form" autocomplete="on">
          <input id="g-email" type="email" placeholder="이메일" autocomplete="username" required>
          <input id="g-pw" type="password" placeholder="비밀번호 (6자 이상)" autocomplete="current-password" required>
          <div class="gate-row">
            <button type="submit" class="gate-primary" id="login-btn">로그인</button>
            <button type="button" class="gate-secondary" id="signup-btn">가입하기</button>
          </div>
        </form>
        <p class="gate-err" id="gate-err"></p>
      </div>`);

    const err = ov.querySelector("#gate-err");
    const setErr = (m) => { err.textContent = m; };
    const busy = (b) => ov.querySelectorAll("button,input").forEach(e => e.disabled = b);

    ov.querySelector("#google-btn").onclick = async () => {
      setErr(""); busy(true);
      try { await window.signInGoogle(); }
      catch (e) { busy(false); setErr(googleErr(e)); }
    };
    ov.querySelector("#email-form").addEventListener("submit", async (e) => {
      e.preventDefault(); setErr(""); busy(true);
      try { await window.signInEmail(g_email(), g_pw()); }
      catch (ex) { busy(false); setErr("이메일 또는 비밀번호를 확인해 주세요."); }
    });
    ov.querySelector("#signup-btn").onclick = async () => {
      setErr(""); busy(true);
      try { await window.signUpEmail(g_email(), g_pw()); }
      catch (ex) { busy(false); setErr(signupErr(ex)); }
    };
    function g_email() { return ov.querySelector("#g-email").value.trim(); }
    function g_pw() { return ov.querySelector("#g-pw").value; }
  }

  function googleErr(e) {
    if (e && e.code === "auth/unauthorized-domain") return "이 주소가 아직 허용되지 않았어요. (관리자 설정 필요)";
    if (e && e.code === "auth/operation-not-allowed") return "구글 로그인이 아직 켜지지 않았어요. (관리자 설정 필요)";
    if (e && e.code === "auth/popup-closed-by-user") return "";
    return "구글 로그인에 실패했어요. 잠시 후 다시 시도해 주세요.";
  }
  function signupErr(e) {
    if (e && e.code === "auth/email-already-in-use") return "이미 가입된 이메일이에요. 로그인해 주세요.";
    if (e && e.code === "auth/weak-password") return "비밀번호는 6자 이상으로 해주세요.";
    if (e && e.code === "auth/invalid-email") return "이메일 형식을 확인해 주세요.";
    return "가입에 실패했어요. 잠시 후 다시 시도해 주세요.";
  }

  // ── 프로필 입력 화면 (처음 로그인 시) ──
  function showProfile(user) {
    body.classList.add("locked");
    const regionOpts = REGIONS.map(r => `<option value="${r}">${r}</option>`).join("");
    const ov = showOverlay(`
      <div class="gate-box">
        <div class="gate-brand"><span>🌈</span> 꿈 놀이터</div>
        <h2>선생님 정보를 알려주세요</h2>
        <p class="gate-sub">딱 한 번만 입력하면 돼요.</p>
        <form id="profile-form">
          <input id="p-name" type="text" placeholder="선생님 이름" required>
          <select id="p-aff" required>
            <option value="" disabled selected>소속 유형</option>
            <option>유치원</option><option>어린이집</option>
            <option>프리랜스</option><option>기타</option>
          </select>
          <select id="p-region" required>
            <option value="" disabled selected>지역 (시/도)</option>
            ${regionOpts}
          </select>
          <input id="p-org" type="text" placeholder="원 이름 (예: 꿈터유치원)">
          <button type="submit" class="gate-primary" id="p-save">시작하기</button>
        </form>
        <p class="gate-err" id="gate-err"></p>
      </div>`);

    const err = ov.querySelector("#gate-err");
    const affSel = ov.querySelector("#p-aff");
    const orgInput = ov.querySelector("#p-org");
    const updateOrg = () => {
      const freelance = affSel.value === "프리랜스" || affSel.value === "기타";
      orgInput.placeholder = freelance ? "원 이름 (선택)" : "원 이름 (예: 꿈터유치원)";
      orgInput.required = !freelance;
    };
    affSel.onchange = updateOrg;

    ov.querySelector("#profile-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      err.textContent = "";
      const data = {
        name: ov.querySelector("#p-name").value.trim(),
        affiliation: affSel.value,
        region: ov.querySelector("#p-region").value,
        orgName: orgInput.value.trim(),
        email: user.email || "",
        createdAt: Date.now(),
      };
      const btn = ov.querySelector("#p-save");
      btn.disabled = true; btn.textContent = "저장 중…";
      try {
        await window.saveProfile(user.uid, data);
        enterHub(data, user);
      } catch (ex) {
        btn.disabled = false; btn.textContent = "시작하기";
        err.textContent = "저장에 실패했어요. 잠시 후 다시 시도해 주세요.";
      }
    });
  }

  async function onUser(user) {
    if (!user) { showLogin(); return; }
    let profile = null;
    try { profile = await window.getProfile(user.uid); } catch (e) { /* 규칙 준비 전일 수 있음 */ }
    if (profile && profile.name) enterHub(profile, user);
    else showProfile(user);
  }

  function begin() {
    if (!window.REQUIRE_LOGIN || !window.AUTH_ENABLED || !window.watchAuth) {
      body.classList.remove("locked");
      return;
    }
    // 로그인 확인 중엔 스플래시만 표시 (로그인창 깜박임 방지)
    body.classList.add("locked");
    showOverlay(`<div class="gate-splash"><span class="em">🌈</span><span class="tx">꿈 놀이터</span></div>`);
    window.watchAuth(onUser);
  }

  if (window.AUTH_READY) begin();
  else window.addEventListener("auth-ready", begin, { once: true });
})();
