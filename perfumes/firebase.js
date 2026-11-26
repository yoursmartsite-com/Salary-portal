// Firebase configuration for ZEIN & RAHAF
export const firebaseConfig = {
  apiKey: "AIzaSyDDHhjq64f-fau6nkFJYiogiuYlRQFPDss",
  authDomain: "perfumes-12f57.firebaseapp.com",
  databaseURL: "https://perfumes-12f57-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "perfumes-12f57",
  storageBucket: "perfumes-12f57.firebasestorage.app",
  messagingSenderId: "204218273808",
  appId: "1:204218273808:web:1473df15998131a905fa95",
  measurementId: "G-SFETJ1WBXF"
};

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, getIdTokenResult,
  GoogleAuthProvider, OAuthProvider, signInWithRedirect, signInWithPopup, getRedirectResult,
  sendPasswordResetEmail, signOut, onAuthStateChanged, updateProfile,
  RecaptchaVerifier, signInWithPhoneNumber, linkWithPhoneNumber, updatePassword
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getDatabase, ref, set, get, update, onValue, push } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
export { createUserWithEmailAndPassword, signInWithEmailAndPassword, getIdTokenResult, GoogleAuthProvider, OAuthProvider, signInWithRedirect, signInWithPopup, getRedirectResult, sendPasswordResetEmail, signOut, onAuthStateChanged, updateProfile, RecaptchaVerifier, signInWithPhoneNumber, linkWithPhoneNumber, updatePassword, ref, set, get, update, onValue, push };

export function authMessage(error) {
  const code = error?.code || "";
  const messages = {
    "auth/email-already-in-use": "البريد الإلكتروني مسجل بالفعل. سجّل الدخول بدل إنشاء حساب جديد.",
    "auth/invalid-email": "البريد الإلكتروني غير صحيح.",
    "auth/weak-password": "كلمة المرور ضعيفة؛ استخدم 6 أحرف على الأقل.",
    "auth/user-not-found": "لا يوجد حساب بهذا البريد الإلكتروني.",
    "auth/wrong-password": "كلمة المرور غير صحيحة.",
    "auth/invalid-credential": "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
    "auth/too-many-requests": "محاولات كثيرة. انتظر قليلًا ثم حاول مرة أخرى.",
    "auth/network-request-failed": "تعذر الاتصال بالإنترنت. تحقق من الاتصال وحاول مجددًا.",
    "auth/operation-not-allowed": "تسجيل البريد وكلمة المرور غير مفعّل في Firebase Authentication.",
    "auth/unauthorized-domain": "الدومين الحالي غير مضاف إلى Authorized domains في Firebase."
  };
  return messages[code] || ("تعذر إتمام العملية: " + (error?.message || code || "خطأ غير معروف"));
}
