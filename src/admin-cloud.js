// Online deel van de beheerpagina: inloggen, beheerders uitnodigen en de teksten
// opslaan in Firebase. Wordt met `npm run build` gebundeld naar admin/firebase.js.
// De instellingen van het Firebase-project staan in js/firebase-config.js.
import { initializeApp } from "firebase/app";
import {
  getAuth,
  connectAuthEmulator,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  updatePassword,
} from "firebase/auth";
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
} from "firebase/firestore/lite";

// De hoofdbeheerder. Moet gelijk zijn aan het adres in firestore.rules.
const OWNER_EMAIL = "622521@nxt.eu";

const cfg = window.FIREBASE_CONFIG;
let auth = null;
let db = null;

if (cfg && cfg.apiKey && cfg.projectId) {
  const app = initializeApp(cfg);
  auth = getAuth(app);
  auth.languageCode = "nl";
  db = getFirestore(app);
  if (cfg.emulator) {
    connectAuthEmulator(auth, cfg.emulator.auth, { disableWarnings: true });
    const [host, port] = cfg.emulator.firestore.split(":");
    connectFirestoreEmulator(db, host, Number(port));
  }
}

const norm = (email) => String(email || "").trim().toLowerCase();

const MESSAGES = {
  "auth/invalid-credential": "E-mailadres of wachtwoord klopt niet.",
  "auth/wrong-password": "E-mailadres of wachtwoord klopt niet.",
  "auth/user-not-found": "E-mailadres of wachtwoord klopt niet.",
  "auth/invalid-email": "Dit is geen geldig e-mailadres.",
  "auth/missing-password": "Vul je wachtwoord in.",
  "auth/weak-password": "Kies een langer wachtwoord (minstens 8 tekens).",
  "auth/too-many-requests": "Te vaak geprobeerd. Wacht even en probeer het opnieuw.",
  "auth/network-request-failed": "Geen internetverbinding.",
  "auth/invalid-action-code": "Deze uitnodigingslink is al gebruikt of ongeldig. Vraag de hoofdbeheerder om een nieuwe uitnodiging.",
  "auth/expired-action-code": "Deze uitnodigingslink is verlopen. Vraag de hoofdbeheerder om een nieuwe uitnodiging.",
  "auth/unauthorized-continue-uri": "Dit webadres staat nog niet bij de toegestane domeinen in Firebase (Authentication → Settings → Authorized domains).",
  "auth/unauthorized-domain": "Dit webadres staat nog niet bij de toegestane domeinen in Firebase (Authentication → Settings → Authorized domains).",
  "auth/operation-not-allowed": "Zet in Firebase bij Authentication → Sign-in method “E-mail/wachtwoord” én “E-maillink” aan.",
  "auth/requires-recent-login": "Log opnieuw in en probeer het nog eens.",
  "permission-denied": "Geen toestemming. Ben je (nog) beheerder?",
  "unavailable": "Geen verbinding met de online opslag.",
};

function explain(err) {
  const code = (err && err.code) || "";
  const e = new Error(MESSAGES[code] || MESSAGES[code.replace(/^firestore\//, "")] || "Er ging iets mis (" + (code || (err && err.message) || "onbekend") + ").");
  e.code = code;
  return e;
}

async function wrap(fn) {
  try {
    return await fn();
  } catch (err) {
    throw explain(err);
  }
}

function adminUrl() {
  return location.origin + location.pathname;
}

window.AdminCloud = {
  configured: !!auth,
  ownerEmail: OWNER_EMAIL,
  online: /^https?:$/.test(location.protocol),

  onUser(cb) {
    return onAuthStateChanged(auth, cb);
  },

  user() {
    return auth.currentUser;
  },

  // "owner", "admin" of null (geen toegang)
  async access(user) {
    if (!user) return null;
    const email = norm(user.email);
    if (email === OWNER_EMAIL) return "owner";
    try {
      const snap = await getDoc(doc(db, "admins", email));
      return snap.exists() ? "admin" : null;
    } catch (err) {
      if (err && err.code === "permission-denied") return null;
      throw explain(err);
    }
  },

  signIn(email, password) {
    return wrap(() => signInWithEmailAndPassword(auth, norm(email), password));
  },

  signOut() {
    return signOut(auth);
  },

  resetPassword(email) {
    return wrap(() => sendPasswordResetEmail(auth, norm(email), { url: adminUrl() }));
  },

  // --- uitnodigingen ---

  isInviteLink() {
    return isSignInWithEmailLink(auth, location.href);
  },

  inviteEmail() {
    return new URLSearchParams(location.search).get("uitnodiging") || "";
  },

  async completeInvite(email, password) {
    email = norm(email);
    if (String(password || "").length < 8) throw new Error(MESSAGES["auth/weak-password"]);
    const cred = await wrap(() => signInWithEmailLink(auth, email, location.href));
    let snap;
    try {
      snap = await getDoc(doc(db, "admins", email));
    } catch (err) {
      snap = null;
    }
    if (!snap || !snap.exists()) {
      await signOut(auth);
      throw new Error("Er staat geen uitnodiging (meer) voor " + email + ". Vraag de hoofdbeheerder om je opnieuw uit te nodigen.");
    }
    await wrap(() => updatePassword(cred.user, password));
    await wrap(() => updateDoc(doc(db, "admins", email), { status: "active", activatedAt: new Date().toISOString() }));
    history.replaceState(null, "", adminUrl());
    return cred.user;
  },

  async listAdmins() {
    const snap = await wrap(() => getDocs(collection(db, "admins")));
    return snap.docs.map((d) => d.data()).sort((a, b) => String(a.email).localeCompare(String(b.email)));
  },

  async invite(email) {
    email = norm(email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(MESSAGES["auth/invalid-email"]);
    if (email === OWNER_EMAIL) throw new Error("Dit is het adres van de hoofdbeheerder zelf.");
    if (!this.online) throw new Error("Uitnodigen kan alleen als de beheerpagina online staat (niet vanaf een bestand op de computer).");
    const me = norm(auth.currentUser && auth.currentUser.email);
    await wrap(() => setDoc(doc(db, "admins", email), { email, status: "invited", invitedAt: new Date().toISOString(), invitedBy: me }));
    await wrap(() =>
      sendSignInLinkToEmail(auth, email, {
        url: adminUrl() + "?uitnodiging=" + encodeURIComponent(email),
        handleCodeInApp: true,
      })
    );
  },

  removeAdmin(email) {
    return wrap(() => deleteDoc(doc(db, "admins", norm(email))));
  },

  // --- teksten ---

  async loadContent() {
    const snap = await wrap(() => getDoc(doc(db, "site", "content")));
    if (!snap.exists()) return null;
    const d = snap.data();
    return { content: JSON.parse(d.json), updated: d.updated || "", updatedBy: d.updatedBy || "" };
  },

  async saveContent(content) {
    const me = norm(auth.currentUser && auth.currentUser.email);
    await wrap(() => setDoc(doc(db, "site", "content"), { json: JSON.stringify(content), updated: content.updated, updatedBy: me }));
  },
};
