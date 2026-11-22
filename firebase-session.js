import { firebaseConfig } from "./firebase-config.js";

let sessionPromise;
export function getFirebaseSession({ waitForDatabase = true, timeoutMs = 15000 } = {}) {
  if (sessionPromise) return sessionPromise;
  sessionPromise = (async () => {
    const [appMod, dbMod, authMod] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js"),
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js")
    ]);
    const app = appMod.getApps().find(item => item.name === "[DEFAULT]") || appMod.initializeApp(firebaseConfig);
    const auth = authMod.getAuth(app);
    if (typeof auth.authStateReady === "function") await auth.authStateReady();
    let user = auth.currentUser;
    if (!user) user = (await authMod.signInAnonymously(auth)).user;
    const db = dbMod.getDatabase(app);
    if (waitForDatabase) {
      await new Promise((resolve, reject) => {
        let finished = false;
        let timer;
        const stop = dbMod.onValue(dbMod.ref(db, ".info/connected"), snap => {
          if (snap.val() === true && !finished) {
            finished = true; clearTimeout(timer); stop(); resolve();
          }
        }, error => {
          if (!finished) { finished = true; clearTimeout(timer); stop(); reject(error); }
        });
        timer = setTimeout(() => {
          if (!finished) { finished = true; stop(); reject(new Error("Firebase database connection timed out")); }
        }, timeoutMs);
      });
    }
    localStorage.setItem("arcade_uid", user.uid);
    return { app, auth, db, uid: user.uid, appMod, dbMod, authMod };
  })().catch(error => { sessionPromise = null; throw error; });
  return sessionPromise;
}
