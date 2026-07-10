// 꿈 놀이터 로그인/가입 (Firebase Auth + 프로필 저장/수정/탈퇴).
// 구글 · 이메일 로그인. 처음 로그인하면 선생님 프로필을 받아 users/{uid} 에 저장.
// 카페 키오스크와 같은 Firebase 프로젝트 + 같은 주소라 로그인 세션이 공유됩니다.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signOut,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail,
  signInWithPopup, signInWithCredential, GoogleAuthProvider,
  deleteUser, reauthenticateWithPopup, reauthenticateWithCredential, EmailAuthProvider
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase, ref, get, set, update, remove, push } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// 관리자(99p) uid — 회원 목록·후원 기록 열람 권한
const ADMIN_UID = "qoYHZGbPCqShikrQJ6UbfBKSVPT2";
window.ADMIN_UID = ADMIN_UID;
window.isAdmin = () => !!(auth && auth.currentUser && auth.currentUser.uid === ADMIN_UID);

const cfg = window.FIREBASE_CONFIG || {};
const configured = cfg.apiKey && !String(cfg.apiKey).startsWith("여기에");

let auth = null, db = null;
if (configured) {
  try {
    const app = initializeApp(cfg);
    auth = getAuth(app);
    db = getDatabase(app);
  } catch (e) {
    console.error("[auth] Firebase 초기화 실패:", e);
  }
} else {
  console.warn("[auth] Firebase 설정이 없어 로그인 잠금이 꺼져 있습니다.");
}

window.AUTH_ENABLED = !!auth;
window.watchAuth = (cb) => { if (auth) onAuthStateChanged(auth, cb); };
window.getCurrentUser = () => auth && auth.currentUser;
window.providerId = () => (auth && auth.currentUser && auth.currentUser.providerData[0] && auth.currentUser.providerData[0].providerId) || "";

window.signInEmail = (email, pw) => signInWithEmailAndPassword(auth, email, pw);
window.signUpEmail = (email, pw) => createUserWithEmailAndPassword(auth, email, pw);
window.signInGoogle = () => signInWithPopup(auth, new GoogleAuthProvider());
window.signOutUser = () => signOut(auth);

// Google Identity Services(GIS): 사파리 등 모바일에서 도메인 간 저장소 차단을
// 우회하려고 구글 자체 도메인에서 ID 토큰을 받아 Firebase 로그인에 씀.
const GOOGLE_CLIENT_ID = "1015329905358-6j63r1q02jafntdd93trrf3ice7kia7m.apps.googleusercontent.com";
let _gisReady = null;
function loadGIS() {
  if (_gisReady) return _gisReady;
  _gisReady = new Promise((resolve, reject) => {
    if (window.google && google.accounts && google.accounts.id) return resolve();
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true; s.defer = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error("GIS load failed"));
    document.head.appendChild(s);
  });
  return _gisReady;
}
window.renderGoogleButton = async (container, onError) => {
  await loadGIS();
  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: async (resp) => {
      try { await signInWithCredential(auth, GoogleAuthProvider.credential(resp.credential)); }
      catch (e) { if (onError) onError(e); }
    },
  });
  google.accounts.id.renderButton(container, {
    type: "standard", theme: "outline", size: "large",
    text: "continue_with", shape: "pill", locale: "ko",
    width: Math.min(container.offsetWidth || 320, 400),
  });
};
window.sendPasswordReset = (email) => sendPasswordResetEmail(auth, email);

// 선생님 프로필 (users/{uid})
window.getProfile = async (uid) => {
  const snap = await get(ref(db, "users/" + uid));
  return snap.exists() ? snap.val() : null;
};
window.saveProfile = (uid, data) => set(ref(db, "users/" + uid), data);

// ── 회원 탈퇴 ──
// 프로필을 지운 뒤 계정을 삭제. 오래 로그인한 경우 requires-recent-login 가 날 수 있음.
window.deleteAccount = async () => {
  const user = auth.currentUser;
  await remove(ref(db, "users/" + user.uid));
  await deleteUser(user);
};
// 재인증 후 계정만 삭제 (프로필은 위에서 이미 삭제됨)
window.reauthGoogle = () => reauthenticateWithPopup(auth.currentUser, new GoogleAuthProvider());
window.reauthEmail = (pw) => reauthenticateWithCredential(
  auth.currentUser, EmailAuthProvider.credential(auth.currentUser.email, pw));
window.deleteUserOnly = () => deleteUser(auth.currentUser);

// ── 후원 자기기록 ── (로그인한 선생님이 후원했음을 스스로 기록)
window.recordDonation = (data) => push(ref(db, "donations"), data);

// ── 관리자 조회 ── (규칙상 관리자만 성공)
// SDK get()은 개별 조회 캐시와 병합되며 항목이 누락되는 버그가 있어 REST로 직접 읽는다.
async function restGet(path) {
  const token = await auth.currentUser.getIdToken();
  const res = await fetch(`${cfg.databaseURL}/${path}.json?auth=${token}`);
  const data = await res.json();
  if (!res.ok) throw new Error((data && data.error) || "read-failed");
  return data || {};
}
window.adminGetUsers = async () => {
  const data = await restGet("users");
  return Object.entries(data).map(([uid, v]) => ({ uid, ...v }));
};
window.adminGetDonations = async () => {
  const data = await restGet("donations");
  return Object.entries(data).map(([id, v]) => ({ id, ...v }));
};

// 오래된 주문 정리: beforeDate(YYYY-MM-DD)보다 이전 날짜의 주문을 한 번에 삭제하고 삭제 건수를 반환
window.adminCleanupOrders = async (beforeDate) => {
  const data = await restGet("orders");
  const updates = {};
  let count = 0;
  for (const [key, v] of Object.entries(data)) {
    if (v && v.date && v.date < beforeDate) { updates["orders/" + key] = null; count++; }
  }
  if (count > 0) await update(ref(db), updates);
  return count;
};

// 후원기록 개인정보 정리: 레거시 기록에 남은 이름·이메일 등 개인 필드를 비우고
// uid·시각·방법만 남긴다. 개인 필드가 있던 기록 수를 반환. (규칙상 관리자만 성공)
window.adminCleanupDonations = async () => {
  const data = await restGet("donations");
  const updates = {};
  let count = 0;
  const piiFields = ["name", "email", "orgName", "region", "affiliation"];
  for (const [key, v] of Object.entries(data)) {
    if (!v) continue;
    let touched = false;
    for (const f of piiFields) {
      if (v[f] !== undefined && v[f] !== null) { updates[`donations/${key}/${f}`] = null; touched = true; }
    }
    if (touched) count++;
  }
  if (Object.keys(updates).length) await update(ref(db), updates);
  return count;
};

window.AUTH_READY = true;
window.dispatchEvent(new Event("auth-ready"));
