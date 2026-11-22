import { firebaseConfig } from "./firebase-config.js";

let sessionPromise = null;
const withTimeout = (promise, ms, label) => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error(label + " timed out")), ms))
]);

export function getFirebaseSession({ waitForDatabase = true, timeoutMs = 20000 } = {}) {
  if (sessionPromise) return sessionPromise;
  sessionPromise = (async () => {
    const [appMod, dbMod, authMod] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js"),
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js")
    ]);

    const app = appMod.getApps().find(item => item.name === "[DEFAULT]") || appMod.initializeApp(firebaseConfig);
    const auth = authMod.getAuth(app);

    // Wait for Firebase Auth to restore its persisted user before creating a guest account.
    if (typeof auth.authStateReady === "function") {
      await withTimeout(auth.authStateReady(), timeoutMs, "Firebase Auth");
    } else {
      await withTimeout(new Promise((resolve, reject) => {
        let unsubscribe = () => {};
        unsubscribe = authMod.onAuthStateChanged(auth, () => {
          unsubscribe();
          resolve();
        }, error => {
          unsubscribe();
          reject(error);
        });
      }), timeoutMs, "Firebase Auth");
    }

    let user = auth.currentUser;
    if (!user) user = (await withTimeout(authMod.signInAnonymously(auth), timeoutMs, "Anonymous sign-in")).user;

    const db = dbMod.getDatabase(app, firebaseConfig.databaseURL);
    if (waitForDatabase) {
      await withTimeout(new Promise((resolve, reject) => {
        let finished = false;
        let unsubscribe = () => {};
        const finish = (error) => {
          if (finished) return;
          finished = true;
          clearTimeout(timer);
          unsubscribe();
          error ? reject(error) : resolve();
        };
        const timer = setTimeout(() => finish(new Error("Firebase Realtime Database connection timed out")), timeoutMs);
        unsubscribe = dbMod.onValue(dbMod.ref(db, ".info/connected"), snap => {
          if (snap.val() === true) finish();
        }, finish);
      }), timeoutMs + 1000, "Firebase Realtime Database");
    }

    localStorage.setItem("arcade_uid", user.uid);
    return { app, auth, db, uid: user.uid, appMod, dbMod, authMod };
  })().catch(error => {
    sessionPromise = null;
    throw error;
  });
  return sessionPromise;
}
