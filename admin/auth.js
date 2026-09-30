// Eenvoudige login voor de beheerpagina, zonder externe dienst.
// De accounts staan in admin/accounts.js (wachtwoorden alleen als versleutelde
// hash, nooit als leesbare tekst). Nieuwe beheerders en gewijzigde wachtwoorden
// worden in deze browser bewaard; met "Accounts opslaan als bestand" maak je een
// nieuw admin/accounts.js zodat ze ook op andere computers werken.
(function () {
  "use strict";

  var STORE_KEY = "autosite-admins";
  var SESSION_KEY = "autosite-admin-session";
  var SESSION_HOURS = 8;
  var INVITE_DAYS = 14;
  var ITERATIONS = 150000;

  var file = window.SITE_ADMINS || { updated: "", accounts: [] };
  var owner = (file.accounts || []).filter(function (a) {
    return a.role === "owner";
  })[0];

  function norm(email) {
    return String(email || "").trim().toLowerCase();
  }

  function clone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  // --- opslag -----------------------------------------------------------------

  function load() {
    var list = null;
    try {
      var saved = JSON.parse(window.localStorage.getItem(STORE_KEY) || "null");
      if (saved && Array.isArray(saved.accounts) && (saved.updated || "") >= (file.updated || "")) list = saved;
    } catch (e) {
      /* niets opgeslagen */
    }
    list = clone(list || file);
    // de hoofdbeheerder uit het bestand is er altijd
    if (owner && !list.accounts.some(function (a) { return a.role === "owner"; })) list.accounts.unshift(clone(owner));
    return list;
  }

  function store(list) {
    list.updated = new Date().toISOString();
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(list));
    } catch (e) {
      throw new Error("Opslaan in deze browser lukt niet.");
    }
  }

  function find(list, email) {
    email = norm(email);
    return list.accounts.filter(function (a) {
      return a.email === email;
    })[0];
  }

  // --- versleuteling ------------------------------------------------------------

  function hex(buf) {
    return Array.prototype.map
      .call(new Uint8Array(buf), function (b) {
        return ("0" + b.toString(16)).slice(-2);
      })
      .join("");
  }

  function unhex(str) {
    var out = new Uint8Array(str.length / 2);
    for (var i = 0; i < out.length; i++) out[i] = parseInt(str.substr(i * 2, 2), 16);
    return out;
  }

  function randomHex(n) {
    var b = new Uint8Array(n);
    window.crypto.getRandomValues(b);
    return hex(b);
  }

  function needCrypto() {
    if (!window.crypto || !window.crypto.subtle) throw new Error("Deze browser kan niet veilig inloggen. Open de pagina via https:// of als bestand op de computer.");
  }

  async function pbkdf2(password, saltHex, iterations) {
    needCrypto();
    var key = await window.crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    var bits = await window.crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: unhex(saltHex), iterations: iterations }, key, 256);
    return hex(bits);
  }

  async function sha256(text) {
    needCrypto();
    return hex(await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  }

  async function setPassword(account, password) {
    if (String(password || "").length < 8) throw new Error("Kies een wachtwoord van minstens 8 tekens.");
    account.salt = randomHex(16);
    account.iterations = ITERATIONS;
    account.hash = await pbkdf2(password, account.salt, ITERATIONS);
  }

  async function checkPassword(account, password) {
    if (!account || !account.hash || !account.salt) return false;
    return (await pbkdf2(password, account.salt, account.iterations || ITERATIONS)) === account.hash;
  }

  // --- sessie -------------------------------------------------------------------

  function startSession(email) {
    try {
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({ email: norm(email), until: Date.now() + SESSION_HOURS * 3600 * 1000 }));
    } catch (e) {
      /* dan alleen deze keer */
    }
  }

  function current() {
    try {
      var s = JSON.parse(window.sessionStorage.getItem(SESSION_KEY) || "null");
      if (!s || s.until < Date.now()) return null;
      var a = find(load(), s.email);
      return a && a.status === "active" ? { email: a.email, role: a.role } : null;
    } catch (e) {
      return null;
    }
  }

  function pageUrl() {
    return location.href.split(/[?#]/)[0];
  }

  var params = new URLSearchParams(location.search);

  window.AdminAuth = {
    ownerEmail: owner ? owner.email : "",

    current: current,

    async signIn(email, password) {
      var a = find(load(), email);
      var ok = a && a.status === "active" && (await checkPassword(a, password));
      if (!ok) {
        await new Promise(function (r) {
          setTimeout(r, 600);
        });
        throw new Error("E-mailadres of wachtwoord klopt niet.");
      }
      startSession(a.email);
      return { email: a.email, role: a.role };
    },

    signOut() {
      try {
        window.sessionStorage.removeItem(SESSION_KEY);
      } catch (e) {
        /* niets */
      }
    },

    async changePassword(oldPassword, newPassword) {
      var me = current();
      var list = load();
      var a = me && find(list, me.email);
      if (!a || !(await checkPassword(a, oldPassword))) throw new Error("Je huidige wachtwoord klopt niet.");
      await setPassword(a, newPassword);
      store(list);
    },

    // --- uitnodigingen ---

    isInviteLink() {
      return params.has("uitnodiging");
    },

    inviteEmail() {
      return params.get("email") || "";
    },

    async completeInvite(email, password) {
      var list = load();
      var a = find(list, email);
      var code = params.get("uitnodiging") || "";
      var valid = a && a.status === "invited" && a.inviteHash && a.inviteHash === (await sha256(code)) && Date.now() - new Date(a.invitedAt).getTime() < INVITE_DAYS * 86400000;
      if (!valid)
        throw new Error(
          "Deze uitnodiging is niet (meer) geldig op deze computer. Vraag de hoofdbeheerder om een nieuwe uitnodiging, of om het bestand accounts.js bij te werken als de site op een andere computer staat."
        );
      await setPassword(a, password);
      a.status = "active";
      a.activatedAt = new Date().toISOString();
      delete a.inviteHash;
      store(list);
      startSession(a.email);
      history.replaceState(null, "", pageUrl());
      return { email: a.email, role: a.role };
    },

    async listAdmins() {
      return load().accounts.map(function (a) {
        return { email: a.email, role: a.role, status: a.role === "owner" ? "owner" : a.status, invitedAt: a.invitedAt };
      });
    },

    // maakt (of vernieuwt) een uitnodiging en geeft de link + een kant-en-klare mail terug
    async invite(email) {
      var me = current();
      if (!me || me.role !== "owner") throw new Error("Alleen de hoofdbeheerder kan beheerders uitnodigen.");
      email = norm(email);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Dit is geen geldig e-mailadres.");
      var list = load();
      var a = find(list, email);
      if (a && a.role === "owner") throw new Error("Dit is het adres van de hoofdbeheerder zelf.");
      if (!a) {
        a = { email: email, role: "admin" };
        list.accounts.push(a);
      }
      var code = randomHex(16);
      a.status = "invited";
      a.inviteHash = await sha256(code);
      a.invitedAt = new Date().toISOString();
      a.invitedBy = me.email;
      delete a.hash;
      delete a.salt;
      store(list);
      var link = pageUrl() + "?uitnodiging=" + code + "&email=" + encodeURIComponent(email);
      var subject = "Uitnodiging: beheerder van de website “Hoe wordt een auto gemaakt?”";
      var body =
        "Hoi,\n\nJe bent uitgenodigd om de teksten van onze website “Hoe wordt een auto gemaakt?” te beheren.\n\n" +
        "Open deze link en kies je eigen wachtwoord:\n" + link + "\n\n" +
        "Daarna log je in met dit e-mailadres (" + email + ") en je wachtwoord.\nDe link is " + INVITE_DAYS + " dagen geldig.\n\nGroet,\n" + me.email;
      return {
        link: link,
        mailto: "mailto:" + encodeURIComponent(email) + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body),
      };
    },

    async removeAdmin(email) {
      var me = current();
      if (!me || me.role !== "owner") throw new Error("Alleen de hoofdbeheerder kan beheerders verwijderen.");
      var list = load();
      list.accounts = list.accounts.filter(function (a) {
        return a.role === "owner" || a.email !== norm(email);
      });
      store(list);
    },

    // inhoud voor een nieuw admin/accounts.js
    fileText() {
      var list = load();
      list.updated = new Date().toISOString();
      return (
        "// Accounts van de beheerpagina. Wachtwoorden staan hier alleen als hash (niet terug te rekenen naar het wachtwoord).\n" +
        "// Nieuw bestand maken: log in als hoofdbeheerder → Beheerders → “Accounts opslaan als bestand”.\n" +
        "window.SITE_ADMINS = " + JSON.stringify(list, null, 2) + ";\n"
      );
    },
  };
})();
