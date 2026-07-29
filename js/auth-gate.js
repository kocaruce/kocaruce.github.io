// 꿈 놀이터 로그인/가입 화면.
// 홈은 로그인 없이 누구나 둘러볼 수 있고(검색 노출 포함), 로그인은 모달로 필요할 때만 연다.
// 흐름: [로그인 버튼 · 놀이에서 ?login=1 유도] → 로그인/가입 모달 → (처음이면) 프로필 입력 → 허브.

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

  // 카카오톡·인스타 등 '앱 속 브라우저' 감지 (구글이 로그인을 차단하는 환경)
  function inAppBrowser() {
    const ua = navigator.userAgent || "";
    return /KAKAOTALK|NAVER|Instagram|FBAN|FBAV|FB_IAB|Line\/|Snapchat|DaumApps|everytimeApp|; wv\)/i.test(ua);
  }

  // ── 로그인 / 가입 모달 ──
  function showLogin() {
    const isInApp = inAppBrowser();
    const googleBlock = isInApp
      ? `<div class="gate-inapp">📱 지금 앱 속 브라우저로 열려 있어요. <b>구글 로그인은 Chrome·Safari에서만</b> 돼요. 아래 <b>이메일</b>로 로그인하시거나, 오른쪽 위 메뉴에서 <b>다른 브라우저로 열기</b>를 눌러주세요.</div>
         <div class="gate-divider"><span>이메일로 로그인</span></div>`
      : `<div class="gate-gis" id="google-btn"></div>
         <div class="gate-divider"><span>또는 이메일</span></div>`;
    const ov = showOverlay(`
      <div class="gate-box">
        <button type="button" class="gate-close" id="gate-close" aria-label="닫기">✕</button>
        <div class="gate-brand"><img src="/assets/brand/logo-mark.svg" alt="" width="30" height="30"> 꿈 놀이터</div>
        <h2>선생님 로그인</h2>
        <p class="gate-sub">로그인하면 놀이 도구를 이용할 수 있어요.</p>
        ${googleBlock}
        <form id="email-form" autocomplete="on">
          <input id="g-email" type="email" placeholder="이메일" autocomplete="username" required>
          <input id="g-pw" type="password" placeholder="비밀번호 (6자 이상)" autocomplete="current-password" required>
          <div class="gate-row">
            <button type="submit" class="gate-primary" id="login-btn">로그인</button>
            <button type="button" class="gate-secondary" id="signup-btn">가입하기</button>
          </div>
        </form>
        <button type="button" class="gate-link" id="forgot-btn">비밀번호를 잊으셨나요?</button>
        <p class="gate-err" id="gate-err"></p>
      </div>`);

    const err = ov.querySelector("#gate-err");
    const setErr = (m, ok) => { err.textContent = m; err.classList.toggle("gate-ok", !!ok); };
    const busy = (b) => ov.querySelectorAll("button,input").forEach(e => e.disabled = b);

    ov.querySelector("#gate-close").onclick = hideOverlay;
    const gbtn = ov.querySelector("#google-btn");
    if (gbtn && window.renderGoogleButton) {
      window.renderGoogleButton(gbtn, (e) => setErr(googleErr(e)))
        .catch(() => { gbtn.style.display = "none"; });
    }
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
    ov.querySelector("#forgot-btn").onclick = async () => {
      const email = g_email();
      if (!email) { setErr("이메일을 먼저 입력해 주세요."); return; }
      setErr(""); busy(true);
      try {
        await window.sendPasswordReset(email);
        busy(false);
        setErr("재설정 링크를 이메일로 보냈어요. 받은편지함을 확인해 주세요.", true);
      } catch (ex) { busy(false); setErr(resetErr(ex)); }
    };
    function g_email() { return ov.querySelector("#g-email").value.trim(); }
    function g_pw() { return ov.querySelector("#g-pw").value; }
  }

  function resetErr(e) {
    if (e && e.code === "auth/invalid-email") return "이메일 형식을 확인해 주세요.";
    if (e && e.code === "auth/user-not-found") return "가입되지 않은 이메일이에요.";
    return "재설정 이메일 전송에 실패했어요. 잠시 후 다시 시도해 주세요.";
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

  // ── 프로필 입력 화면 (처음 로그인 시, 닫기 없음) ──
  function showProfile(user) {
    const regionOpts = REGIONS.map(r => `<option value="${r}">${r}</option>`).join("");
    const ov = showOverlay(`
      <div class="gate-box">
        <div class="gate-brand"><img src="/assets/brand/logo-mark.svg" alt="" width="30" height="30"> 꿈 놀이터</div>
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

  // 로그아웃 상태의 헤더 칩: "로그인" 버튼
  function setChipLoggedOut() {
    const chip = document.getElementById("account-btn");
    if (chip) {
      chip.textContent = "로그인";
      chip.title = "로그인";
      chip.onclick = () => showLogin();
    }
  }

  // ?login=1 · #login: 놀이 화면에서 유도된 경우 로그인 모달을 자동으로 연다 (한 번만)
  function consumeLoginParam() {
    const url = new URL(location.href);
    const has = url.searchParams.has("login") || location.hash === "#login";
    if (has) {
      url.searchParams.delete("login");
      url.hash = "";
      history.replaceState(null, "", url.pathname + url.search);
    }
    return has;
  }

  async function onUser(user) {
    if (!user) {
      setChipLoggedOut();
      if (consumeLoginParam()) showLogin();
      return;
    }
    let profile = null;
    try { profile = await window.getProfile(user.uid); } catch (e) { /* 규칙 준비 전일 수 있음 */ }
    consumeLoginParam();
    if (profile && profile.name) enterHub(profile, user);
    else showProfile(user);
  }

  function begin() {
    // 홈은 로그인 없이 공개 (검색엔진·처음 방문자도 콘텐츠를 볼 수 있게)
    body.classList.remove("locked");
    if (!window.REQUIRE_LOGIN || !window.AUTH_ENABLED || !window.watchAuth) return;
    window.watchAuth(onUser);
  }

  window.openLogin = showLogin;

  if (window.AUTH_READY) begin();
  else window.addEventListener("auth-ready", begin, { once: true });
})();
