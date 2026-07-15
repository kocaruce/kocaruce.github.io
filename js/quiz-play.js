// 낱말 퀴즈 놀이 화면: 로그인 게이트 → 퀴즈 선택 → 게임.
// 퀴즈 엔진(격자·힌트카드)은 quiz-model.js의 buildPuzzle 결과로 동작한다.
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  let quizzes = [];
  let idx = 0, CARDS = [], inputs = {}, ans = {};
  // 입력 모드: "cards"(글자 카드 선택, 기본) | "type"(직접 타이핑, 심화)
  let mode = "cards", selKey = null;
  // 단어 단위 선택(크로스워드식): WORDS[i] = {keys, dir, clue, n}, actW = 현재 단어 인덱스
  let WORDS = [], cellWords = {}, actW = -1;

  const COLORS = [['#FFD36B', '#FFE9A8'], ['#9CD6F5', '#C9EAFB'], ['#FF9E8A', '#FFC9BE'], ['#A9DD7B', '#CFEEAE'],
    ['#C9A7E8', '#E2CFF4'], ['#FFB85C', '#FFD49A'], ['#7FD0C4', '#B4E6DE'], ['#F4A0C0', '#FBC9DC']];
  const dots = (n) => '○ '.repeat(n).trim();

  function showScreen(which) {
    $("wq-gate").hidden = which !== "gate";
    $("wq-select").hidden = which !== "select";
    $("game").hidden = which !== "game";
  }

  // ── 게이트 ──
  function gateSplash() {
    $("wq-gate").innerHTML = `<div class="wq-splash">🧩<br>낱말 퀴즈</div>`;
    showScreen("gate");
  }
  function gateLoggedOut() {
    $("wq-gate").innerHTML =
      `<div class="wq-gate-msg">🔒 로그인이 필요해요.<br>꿈 놀이터에서 로그인한 뒤 이용해 주세요.<br>
       <a class="btn btn-show" href="../index.html">꿈 놀이터에서 로그인하기</a></div>`;
    showScreen("gate");
  }

  // ── 퀴즈 선택 화면 ──
  function renderSelect() {
    const host = $("wq-select");
    host.innerHTML =
      `<div class="wq-select-head"><h1>🧩 낱말 퀴즈</h1><p class="sub">함께 풀 퀴즈를 골라요!</p></div>
       <div class="wq-grid" id="wq-grid"></div>`;
    const grid = $("wq-grid");
    quizzes.forEach((q) => {
      const div = document.createElement("div");
      div.className = "wq-quiz";
      const n = (q.words || []).length;
      div.innerHTML =
        `<div class="em">${esc(q.emojis || "🧩")}</div>` +
        `<h3>${esc(q.title || "낱말 퀴즈")}</h3>` +
        `<p>${esc(q.subtitle || "")}</p>` +
        `<div class="meta">${n}낱말${q.builtin ? " · 기본" : ""}</div>`;
      div.onclick = () => startGame(q);
      grid.appendChild(div);
    });
    showScreen("select");
  }

  // ── 게임 시작 ──
  function startGame(quiz) {
    const p = window.buildPuzzle(quiz);
    $("q-title").textContent = quiz.title || "낱말퀴즈";
    $("q-sub").textContent = quiz.subtitle || "";
    $("q-emojis").textContent = quiz.emojis || "";

    const board = $("board");
    board.style.gridTemplateColumns = `repeat(${p.cols},1fr)`;
    board.style.aspectRatio = `${p.cols}/${p.rows}`;
    board.innerHTML = "";
    ans = {}; inputs = {};
    p.cells.forEach(([r, c, ch]) => { ans[r + "_" + c] = ch; });
    for (let r = 0; r < p.rows; r++) for (let c = 0; c < p.cols; c++) {
      const key = r + "_" + c;
      const div = document.createElement("div");
      if (ans[key]) {
        div.className = "cell on"; div.dataset.key = key;
        if (p.nums[key]) { const s = document.createElement("span"); s.className = "num"; s.textContent = p.nums[key]; div.appendChild(s); }
        const inp = document.createElement("input");
        inp.className = "cinp"; inp.type = "text"; inp.setAttribute("inputmode", "text"); inp.maxLength = 2;
        inp.addEventListener("input", () => { div.classList.remove("correct", "wrong"); $("result").textContent = ""; });
        div.addEventListener("click", () => { if (mode === "cards") selectCell(key); });
        div.appendChild(inp); inputs[key] = inp;
      } else { div.className = "cell"; }
      board.appendChild(div);
    }

    // 단어 목록 (번호순, 같은 번호는 가로 먼저) — 셀 탭 시 단어 하이라이트·힌트 바에 사용
    WORDS = (quiz.words || []).filter(w => w && w.answer && w.dir).map(w => {
      const keys = [];
      const chars = [...String(w.answer)];
      for (let i = 0; i < chars.length; i++) {
        const r = w.dir === "세로" ? w.r + i : w.r;
        const c = w.dir === "세로" ? w.c : w.c + i;
        keys.push(r + "_" + c);
      }
      return { keys, dir: w.dir, clue: w.clue || "", n: p.nums[w.r + "_" + w.c] || 0 };
    });
    WORDS.sort((a, b) => (a.n - b.n) || ((a.dir === "가로" ? 0 : 1) - (b.dir === "가로" ? 0 : 1)));
    cellWords = {};
    WORDS.forEach((w, i) => w.keys.forEach(k => { (cellWords[k] = cellWords[k] || []).push(i); }));
    actW = -1;

    CARDS = p.cards; idx = 0;
    const prog = $("progress"); prog.innerHTML = "";
    CARDS.forEach((cd, i) => {
      const pip = document.createElement("div"); pip.className = "pip"; pip.textContent = cd.n;
      pip.onclick = () => { idx = i; renderCard(); };
      prog.appendChild(pip);
    });
    renderCard();
    $("result").textContent = "";
    renderTray();
    setMode(mode);
    selectCell(null);
    showScreen("game");
  }

  // ── 글자 카드 입력 ──
  function setMode(m) {
    mode = m;
    const btn = $("modeBtn");
    if (btn) btn.textContent = m === "cards" ? "🃏 글자 카드" : "⌨️ 글자 쓰기";
    for (const key in inputs) inputs[key].readOnly = (m === "cards");
    const tray = $("tray");
    if (tray) tray.hidden = (m !== "cards");
    if (m !== "cards") selectCell(null);
    updateClueBar();
  }

  // 셀 선택: 속한 단어 전체를 하이라이트하고 힌트 바를 갱신.
  // 같은 칸을 다시 탭하면 교차하는 다른 단어(가로↔세로)로 전환.
  function selectCell(key, wi) {
    const board = $("board");
    board.querySelectorAll(".cell.sel").forEach(d => d.classList.remove("sel"));
    board.querySelectorAll(".cell.word").forEach(d => d.classList.remove("word"));
    if (key == null) { selKey = null; actW = -1; updateClueBar(); return; }
    const list = cellWords[key] || [];
    if (wi == null) {
      if (list.length > 1 && selKey === key && list.includes(actW)) wi = list[(list.indexOf(actW) + 1) % list.length];
      else if (list.includes(actW)) wi = actW;
      else wi = list.length ? list[0] : -1;
    }
    selKey = key; actW = (wi == null ? -1 : wi);
    if (actW >= 0 && WORDS[actW]) WORDS[actW].keys.forEach(k => {
      const d = board.querySelector('[data-key="' + k + '"]');
      if (d) d.classList.add("word");
    });
    const d = board.querySelector('[data-key="' + key + '"]');
    if (d) d.classList.add("sel");
    updateClueBar();
  }

  function updateClueBar() {
    const bar = $("cluebar");
    if (!bar) return;
    bar.hidden = (mode !== "cards");
    const t = $("clueTxt");
    if (actW < 0 || !WORDS[actW]) { t.innerHTML = "채울 칸을 콕 눌러 주세요 👆"; return; }
    const w = WORDS[actW];
    t.innerHTML = '<b>' + w.n + ' ' + esc(w.dir) + '</b> · ' + esc(w.clue);
  }

  // 힌트 바 ◀▶: 이전/다음 단어의 첫 빈칸으로 이동
  function moveWord(step) {
    if (!WORDS.length) return;
    const from = actW < 0 ? (step > 0 ? -1 : 0) : actW;
    const wi = (from + step + WORDS.length) % WORDS.length;
    const w = WORDS[wi];
    const firstEmpty = w.keys.find(k => inputs[k] && !(inputs[k].value || "").trim()) || w.keys[0];
    selectCell(firstEmpty, wi);
  }

  // 트레이: 퍼즐의 글자(중복 제거) + 방해 글자 몇 개를 섞어 보여줌
  const DISTRACTORS = ["가", "나", "도", "루", "미", "보", "수", "오", "코", "하"];
  function renderTray() {
    const tray = $("tray");
    if (!tray) return;
    const set = new Set(Object.values(ans));
    const chars = [...set];
    for (const d of DISTRACTORS) {
      if (chars.length >= Math.max(10, set.size + 3)) break;
      if (!set.has(d)) chars.push(d);
    }
    for (let i = chars.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    tray.innerHTML = chars.map(c => `<button type="button" class="lcard">${esc(c)}</button>`).join("") +
      `<button type="button" class="lcard eraser" aria-label="지우기">🧽</button>`;
    tray.querySelectorAll(".lcard").forEach(b => b.onclick = () => {
      if (!selKey) { $("result").textContent = "먼저 채울 칸을 콕 눌러 주세요 👆"; return; }
      const cellDiv = $("board").querySelector('[data-key="' + selKey + '"]');
      const isErase = b.classList.contains("eraser");
      inputs[selKey].value = isErase ? "" : b.textContent;
      cellDiv.classList.remove("correct", "wrong");
      $("result").textContent = "";
      // 채우면 같은 단어의 다음 칸으로 자동 이동 (지우개는 제자리 유지)
      if (isErase) { selectCell(selKey, actW); return; }
      const w = WORDS[actW];
      if (w) {
        const next = w.keys[w.keys.indexOf(selKey) + 1];
        selectCell(next || selKey, actW);
      } else {
        selectCell(null);
      }
    });
  }

  function renderCard() {
    const card = CARDS[idx];
    const [c1, c2] = COLORS[idx % COLORS.length];
    const tiles = $("tiles");
    tiles.innerHTML = "";
    card.clues.forEach((cl) => {
      const tile = document.createElement("div"); tile.className = "tile";
      tile.style.setProperty("--c1", c1); tile.style.setProperty("--c2", c2);
      tile.innerHTML =
        '<div class="tinner">' +
          '<div class="tface tfront">' +
            '<div class="tag"><span class="dir">' + esc(cl.dir) + '</span></div>' +
            '<div class="clue-text">' + esc(cl.text) + '</div>' +
            '<div class="blanks">' + dots(cl.blanks) + '</div>' +
            '<div class="tap-hint">👆 눌러서 정답 보기</div>' +
          '</div>' +
          '<div class="tface tback">' +
            '<div class="ans-emoji">' + esc(cl.emoji) + '</div>' +
            '<div class="ans-word">' + esc(cl.word) + '</div>' +
            '<div class="ans-desc">' + esc(cl.desc) + '</div>' +
          '</div>' +
        '</div>';
      tile.addEventListener("click", () => tile.classList.toggle("flipped"));
      tiles.appendChild(tile);
    });
    [...$("progress").children].forEach((pip, i) => pip.classList.toggle("active", i === idx));
    $("prevBtn").disabled = idx === 0;
    $("nextBtn").disabled = idx === CARDS.length - 1;
  }

  function gradeAll() {
    let total = 0, right = 0;
    for (const key in ans) {
      total++;
      const cellDiv = $("board").querySelector('[data-key="' + key + '"]');
      const v = (inputs[key].value || "").trim();
      cellDiv.classList.remove("correct", "wrong");
      if (v === "") continue;
      if (v === ans[key]) { cellDiv.classList.add("correct"); right++; }
      else { cellDiv.classList.add("wrong"); }
    }
    return { total, right };
  }

  function wireButtons() {
    $("checkBtn").onclick = () => {
      const { total, right } = gradeAll();
      $("result").textContent = right === total
        ? "🎉 와! " + total + "칸 모두 정답이에요!"
        : "총 " + total + "칸 중 " + right + "칸 맞았어요! 다시 도전해봐요 💪";
    };
    $("showBtn").onclick = () => {
      for (const key in ans) {
        const cellDiv = $("board").querySelector('[data-key="' + key + '"]');
        inputs[key].value = ans[key];
        cellDiv.classList.remove("wrong"); cellDiv.classList.add("correct");
      }
      $("result").textContent = "정답을 모두 보여줄게요 ✨";
    };
    $("clearBtn").onclick = () => {
      for (const key in ans) {
        inputs[key].value = "";
        $("board").querySelector('[data-key="' + key + '"]').classList.remove("correct", "wrong");
      }
      $("result").textContent = "";
    };
    $("prevBtn").onclick = () => { if (idx > 0) { idx--; renderCard(); } };
    $("nextBtn").onclick = () => { if (idx < CARDS.length - 1) { idx++; renderCard(); } };
    $("back-btn").onclick = () => renderSelect();
    const mb = $("modeBtn");
    if (mb) mb.onclick = () => setMode(mode === "cards" ? "type" : "cards");
    const cp = $("cluePrev"), cn = $("clueNext");
    if (cp) cp.onclick = () => moveWord(-1);
    if (cn) cn.onclick = () => moveWord(1);
  }

  // ── 부팅 ──
  async function onUser(user) {
    if (!user) { gateLoggedOut(); return; }
    quizzes = [window.QUIZ_DEFAULT];
    try {
      const fromDb = await window.listQuizzes();
      // 최신 생성순으로 뒤에 붙임
      fromDb.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      quizzes = quizzes.concat(fromDb);
    } catch (e) { /* 규칙 준비 전이거나 아직 만든 퀴즈가 없음 */ }
    renderSelect();
  }

  function begin() {
    wireButtons();
    if (!window.watchAuth) { quizzes = [window.QUIZ_DEFAULT]; renderSelect(); return; }
    gateSplash();
    window.watchAuth(onUser);
  }

  if (window.AUTH_READY) begin();
  else window.addEventListener("auth-ready", begin, { once: true });

  // 핀치 확대 / 더블탭 확대 잠금 (태블릿)
  document.addEventListener("touchmove", (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
  document.addEventListener("gesturestart", (e) => e.preventDefault());
  let lastTouch = 0;
  document.addEventListener("touchend", (e) => {
    const now = Date.now();
    if (now - lastTouch <= 300) e.preventDefault();
    lastTouch = now;
  }, { passive: false });
})();
