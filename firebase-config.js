// ضع بيانات مشروع Firebase الخاص بك هنا بعد إنشاء تطبيق Web.
// لا تضع أبدًا مفاتيح حسابات خاصة أو كلمات مرور في هذا الملف.
export const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  databaseURL: "https://YOUR_DATABASE_NAME-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT_ID",
  appId: "YOUR_FIREBASE_APP_ID"
};
export const firebaseReady = !Object.values(firebaseConfig).some(v => String(v).includes("YOUR_"));
