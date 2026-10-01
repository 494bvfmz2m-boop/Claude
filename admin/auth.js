// Eenvoudige login voor de beheerpagina, zonder externe dienst.
// De accounts staan in admin/accounts.js (wachtwoorden alleen als versleutelde
// hash, nooit als leesbare tekst). Wie met een tijdelijk wachtwoord inlogt, moet
// eerst een eigen wachtwoord kiezen. Gewijzigde wachtwoorden worden in deze browser bewaard; met "Accounts opslaan als bestand" maak je een
// nieuw admin/accounts.js zodat ze ook op andere computers werken.
(function () {
  "use strict";

  var STORE_KEY = "autosite-admins";
  var SESSION_KEY = "autosite-admin-session";
  var SESSION_HOURS = 8;
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
    // accounts uit het bestand die nog niet in deze browser staan, komen erbij
    (file.accounts || []).forEach(function (fa) {
      if (!find(list, fa.email)) list.accounts.push(clone(fa));
    });
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
      return a && a.status === "active" && !a.mustChange ? { email: a.email, role: a.role } : null;
    } catch (e) {
      return null;
    }
  }

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
      // eerste keer met een tijdelijk wachtwoord: eerst een eigen wachtwoord kiezen
      if (a.mustChange) return { email: a.email, role: a.role, mustChange: true };
      startSession(a.email);
      return { email: a.email, role: a.role };
    },

    // eigen wachtwoord kiezen na inloggen met het tijdelijke wachtwoord
    async setFirstPassword(email, tempPassword, newPassword) {
      var list = load();
      var a = find(list, email);
      if (!a || !a.mustChange || !(await checkPassword(a, tempPassword))) throw new Error("Log opnieuw in met je tijdelijke wachtwoord.");
      if (newPassword === tempPassword) throw new Error("Kies een ander wachtwoord dan het tijdelijke.");
      await setPassword(a, newPassword);
      delete a.mustChange;
      a.changedAt = new Date().toISOString();
      store(list);
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

    async listAdmins() {
      return load().accounts.map(function (a) {
        return { email: a.email, role: a.role, status: a.role === "owner" ? "owner" : a.mustChange ? "temp" : "active" };
      });
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
