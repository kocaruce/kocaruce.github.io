// 꿈 놀이터 로그인/가입 (Firebase Auth + 프로필 저장/수정/탈퇴).
// 구글 · 이메일 로그인. 처음 로그인하면 선생님 프로필을 받아 users/{uid} 에 저장.
// 카페 키오스크와 같은 Firebase 프로젝트 + 같은 주소라 로그인 세션이 공유됩니다.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signOut,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail,
  signInWithPopup, GoogleAuthProvider,
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

window.AUTH_READY = true;
window.dispatchEvent(new Event("auth-ready"));
