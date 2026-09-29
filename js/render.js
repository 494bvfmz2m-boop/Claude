// Bouwt de inhoud van de pagina op uit window.SITE_CONTENT (js/content.js).
// Als de beheerpagina (admin/) in deze browser aangepaste teksten heeft
// opgeslagen, worden die gebruikt zolang ze nieuwer zijn dan content.js.
(function () {
  var STORAGE_KEY = "autosite-content";

  function loadContent() {
    var base = window.SITE_CONTENT;
    try {
      var saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
      if (saved && saved.version === base.version && (saved.updated || "") >= (base.updated || "")) return saved;
    } catch (e) {
      /* geen opgeslagen versie */
    }
    return base;
  }

  // --- kleine hulpfuncties ---------------------------------------------------

  function esc(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function safeUrl(url) {
    return /^https?:\/\//i.test(url || "") ? url : "#";
  }

  var sourceNumber = {};

  // tekst met [[bron-id]] -> veilige HTML met genummerde bronlink
  function rich(text) {
    return esc(text).replace(/\[\[([a-z0-9_-]+)\]\]/gi, function (m, id) {
      var n = sourceNumber[id];
      return n ? '<a class="ref" href="#bron-' + id + '">[' + n + "]</a>" : "";
    });
  }

  function secondsAttr(obj) {
    return obj && typeof obj.seconds === "number" && obj.seconds > 0 ? ' data-seconds="' + obj.seconds + '"' : "";
  }

  function paragraph(p) {
    return '<p class="reveal"' + secondsAttr(p) + ">" + rich(p.text) + "</p>";
  }

  function paragraphs(list) {
    return (list || []).map(paragraph).join("\n");
  }

  function figure(src, fig, extraClass) {
    if (!fig) return "";
    return (
      '<figure class="figure reveal ' + (extraClass || "") + '"' + secondsAttr(fig) + ">" +
      '<img src="img/' + src + '" alt="' + esc(fig.alt) + '" loading="lazy" width="1600" height="900">' +
      (fig.caption ? "<figcaption>" + esc(fig.caption) + "</figcaption>" : "") +
      "</figure>"
    );
  }

  function stats(list) {
    if (!list || !list.length) return "";
    return (
      '<div class="stat-row reveal">' +
      list
        .map(function (s) {
          return '<div class="stat-card"><span class="stat-value">' + esc(s.value) + '</span><span class="stat-label">' + esc(s.label) + "</span></div>";
        })
        .join("") +
      "</div>"
    );
  }

  // --- vaste tekeningen --------------------------------------------------------

  var BODY_SHAPES = [
    "M12 50 V41 Q13 35 24 33 L50 30 L66 17 Q70 14 80 14 H116 Q124 14 130 22 L138 33 Q146 35 146 42 V50 Z",
    "M10 50 V36 Q10 30 20 29 L46 27 L58 13 Q61 10 70 10 H134 Q142 10 144 18 L146 30 Q150 32 150 38 V50 Z",
    "M8 50 V42 Q9 36 20 34 L48 31 L64 19 Q68 16 78 16 H104 Q112 16 118 22 L126 31 L146 33 Q152 35 152 42 V50 Z",
    "M8 50 V42 Q9 36 20 34 L48 31 L62 18 Q66 15 76 15 H140 Q146 15 148 22 L150 34 Q152 36 152 42 V50 Z",
  ];
  var WHEELS =
    '<circle class="w" cx="36" cy="50" r="9"/><circle class="h" cx="36" cy="50" r="3.5"/>' +
    '<circle class="w" cx="124" cy="50" r="9"/><circle class="h" cx="124" cy="50" r="3.5"/>';

  function cylinder(x, y, rot) {
    return (
      '<g transform="translate(' + x + " " + y + ") rotate(" + rot + ')">' +
      '<rect class="cyl" x="-11" y="-44" width="22" height="38" rx="2"/>' +
      '<rect class="pis" x="-9" y="-26" width="18" height="11" rx="1.5"/>' +
      '<line class="rod" x1="0" y1="-15" x2="0" y2="0"/></g>'
    );
  }

  function crank(x, y) {
    return '<circle class="crank" cx="' + x + '" cy="' + y + '" r="9"/><circle class="crank-c" cx="' + x + '" cy="' + y + '" r="2.5"/>';
  }

  var ENGINE_SHAPES = [
    cylinder(60, 62, 0) + crank(60, 62),
    cylinder(60, 62, -35) + cylinder(60, 62, 35) + crank(60, 62),
    cylinder(60, 50, -90) + cylinder(60, 50, 90) + crank(60, 50),
  ];

  var CALLOUT_POS = [
    [50.1, 29.6],
    [45.4, 19.8],
    [52.3, 47.2],
    [66.8, 65.4],
    [58.1, 79.2],
    [29.4, 67.0],
  ];

  function bodyTypes(list) {
    if (!list || !list.length) return "";
    return (
      '<div class="type-grid four">' +
      list
        .map(function (t, i) {
          var d = BODY_SHAPES[i % BODY_SHAPES.length];
          return (
            '<div class="type-card body-type reveal"><svg viewBox="0 0 160 64" aria-hidden="true"><line class="g" x1="4" y1="59.5" x2="156" y2="59.5"/><path class="b" d="' +
            d + '"/>' + WHEELS + "</svg><strong>" + esc(t.name) + "</strong><span>" + esc(t.text) + "</span></div>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function engineTypes(list) {
    if (!list || !list.length) return "";
    return (
      '<div class="type-grid three">' +
      list
        .map(function (t, i) {
          return (
            '<div class="type-card engine-type reveal"><svg viewBox="0 0 120 80" aria-hidden="true">' +
            ENGINE_SHAPES[i % ENGINE_SHAPES.length] + "</svg><strong>" + esc(t.name) + "</strong><span>" + esc(t.text) + "</span></div>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  // --- onderdelen van de pagina -------------------------------------------------

  var FIGURES = {
    ontwerp: "ontwerp-studio.jpg",
    carrosserie: "carrosserie-lassen.jpg",
    motorblok: "motorblok.jpg",
    materialen: "materialen-opengewerkt.jpg",
  };

  function banner(ch, index) {
    var num = String(index + 1).padStart(2, "0");
    return (
      '<header class="chapter-banner" data-banner' + (ch.bannerSeconds > 0 ? ' data-seconds="' + ch.bannerSeconds + '"' : "") + ">" +
      '<img class="banner-img" src="img/banner-' + ch.id + '.jpg" alt="' + esc(ch.bannerAlt) + '" width="1920" height="800"' + (index ? ' loading="lazy"' : "") + ">" +
      '<div class="banner-text"><span class="chapter-num" aria-hidden="true">' + num + "</span>" +
      '<p class="chapter-kicker">' + esc(ch.kicker) + "</p>" +
      '<h2 id="h-' + ch.id + '">' + esc(ch.title) + "</h2></div></header>"
    );
  }

  function chapterBody(ch) {
    var p = ch.paragraphs || [];
    var fig = FIGURES[ch.id];
    switch (ch.id) {
      case "materialen": {
        var dots = (ch.callouts || [])
          .map(function (c, i) {
            var pos = CALLOUT_POS[i];
            return pos ? '<span class="callout" style="left:' + pos[0] + "%;top:" + pos[1] + '%">' + (i + 1) + "</span>" : "";
          })
          .join("");
        var legend = (ch.callouts || [])
          .map(function (c, i) {
            return '<li><span class="callout-n">' + (i + 1) + "</span><strong>" + esc(c.name) + "</strong><span>" + esc(c.text) + "</span></li>";
          })
          .join("");
        var bar = ch.materialBar || {};
        return (
          '<div class="split">' +
          '<div class="prose">' + paragraphs(p) + "</div>" +
          '<div class="aside"><figure class="figure exploded reveal"' + secondsAttr(ch.figure) + '><div class="callout-wrap">' +
          '<img src="img/' + fig + '" alt="' + esc(ch.figure && ch.figure.alt) + '" loading="lazy" width="1200" height="675">' + dots +
          "</div>" + (ch.figure && ch.figure.caption ? "<figcaption>" + esc(ch.figure.caption) + "</figcaption>" : "") + "</figure>" +
          '<ol class="callout-legend reveal">' + legend + "</ol></div>" +
          "</div>" +
          stats(ch.stats) +
          '<div class="material-bar reveal" role="img" aria-label="' + esc(bar.legendMetal + ", " + bar.legendRubber + ", " + bar.legendRest) + '">' +
          '<div class="mb-seg mb-metal" style="flex-basis:62.5%"><span>' + esc(bar.metal) + "</span></div>" +
          '<div class="mb-seg mb-rubber" style="flex-basis:5.5%"></div>' +
          '<div class="mb-seg mb-rest" style="flex-basis:32%"><span>' + esc(bar.rest) + "</span></div></div>" +
          '<p class="mb-legend reveal"><span class="sw mb-metal"></span>' + esc(bar.legendMetal) +
          ' <span class="sw mb-rubber"></span>' + esc(bar.legendRubber) +
          ' <span class="sw mb-rest"></span>' + esc(bar.legendRest) + " " + (bar.source ? rich("[[" + bar.source + "]]") : "") + "</p>"
        );
      }
      case "tijd": {
        var steps = (ch.process || [])
          .map(function (s, i) {
            return '<li class="reveal"><span class="tl-n">' + (i + 1) + "</span><strong>" + esc(s.name) + "</strong><span>" + esc(s.text) + "</span></li>";
          })
          .join("");
        return (
          '<ol class="process-line" aria-label="De stappen om een auto te maken">' + steps + "</ol>" +
          '<div class="split">' +
          '<div class="prose">' + paragraphs(p) + "</div>" +
          '<div class="aside stats-aside">' + stats(ch.stats) + "</div>" +
          "</div>"
        );
      }
      default: {
        var extra = ch.id === "carrosserie" ? bodyTypes(ch.bodyTypes) : ch.id === "motorblok" ? engineTypes(ch.engineTypes) : "";
        return (
          '<div class="split">' +
          '<div class="prose">' + paragraphs(p) + "</div>" +
          '<div class="aside">' + figure(fig, ch.figure) + "</div>" +
          "</div>" + extra
        );
      }
    }
  }

  function chapter(ch, index) {
    return (
      '<section id="' + ch.id + '" class="chapter" aria-labelledby="h-' + ch.id + '">' +
      banner(ch, index) +
      '<div class="chapter-body">' + chapterBody(ch) + "</div></section>"
    );
  }

  function intro(c) {
    var cards = c.chapters
      .map(function (ch, i) {
        return (
          '<a class="chapter-card reveal" href="#' + ch.id + '"><img src="img/banner-' + ch.id + '.jpg" alt="" loading="lazy" width="1920" height="800">' +
          '<span class="card-num">' + String(i + 1).padStart(2, "0") + '</span><span class="card-title">' + esc(ch.title) + '</span><span class="card-go" aria-hidden="true">&rarr;</span></a>'
        );
      })
      .join("");
    return (
      '<section id="intro" class="intro" aria-label="Inleiding">' +
      '<p class="chapter-kicker reveal">' + esc(c.intro.kicker) + "</p>" +
      '<p class="lead reveal"' + secondsAttr(c.intro) + ">" + rich(c.intro.lead) + "</p>" +
      '<nav class="chapter-cards" aria-label="Deelvragen">' + cards + "</nav></section>"
    );
  }

  function highlights(c) {
    var h = c.highlights;
    if (!h || !h.items || !h.items.length) return "";
    return (
      '<section id="cijfers" class="highlights" aria-label="' + esc(h.title) + '">' +
      '<div class="highlights-inner">' +
      '<p class="chapter-kicker reveal">' + esc(h.title) + "</p>" +
      '<div class="highlight-grid">' +
      h.items
        .map(function (it) {
          return (
            '<div class="highlight reveal"><span class="hl-value"><span class="count" data-count="' + esc(it.value) + '">' + esc(it.value) + "</span>" +
            (it.unit ? '<span class="hl-unit">' + esc(it.unit) + "</span>" : "") + "</span>" +
            '<span class="hl-label">' + esc(it.label) + " " + (it.source ? rich("[[" + it.source + "]]") : "") + "</span></div>"
          );
        })
        .join("") +
      "</div></div></section>"
    );
  }

  function conclusion(c) {
    var k = c.conclusion;
    return (
      '<section id="conclusie" class="chapter chapter-conclusie" aria-labelledby="h-conclusie">' +
      '<img class="banner-img" src="img/banner-conclusie.jpg" alt="" width="1920" height="800" loading="lazy">' +
      '<div class="conclusie-inner reveal"' + secondsAttr(k) + '><p class="chapter-kicker">' + esc(k.kicker) + '</p><h2 id="h-conclusie">' + esc(k.title) + "</h2>" +
      "<p>" + rich(k.text) + "</p>" +
      '<a class="hero-cta light" href="#top"><span>' + esc(k.cta || "Terug naar de fabriek") + '</span><span class="cta-arrow" aria-hidden="true">&uarr;</span></a></div></section>'
    );
  }

  function sources(c) {
    return (
      '<section id="bronnen" class="bronnen-section" aria-labelledby="h-bronnen">' +
      '<p class="chapter-kicker">' + esc(c.sourcesKicker) + '</p><h2 id="h-bronnen">' + esc(c.sourcesTitle) + "</h2>" +
      '<ol class="bronlijst">' +
      c.sources
        .map(function (s) {
          return (
            '<li id="bron-' + esc(s.id) + '"><span class="tag">' + esc(s.type) + "</span><br>" +
            esc(s.before) + " <em>" + esc(s.title) + "</em> " + esc(s.after) +
            ' <a href="' + esc(safeUrl(s.url)) + '" target="_blank" rel="noopener">' + esc(s.linkText || s.url) + "</a></li>"
          );
        })
        .join("") +
      "</ol></section>"
    );
  }

  function footer(c) {
    return (
      '<div class="footer-inner">' +
      '<p class="footer-title">' + esc(c.site.title) + "</p>" +
      "<p>" + esc(c.footer && c.footer.text) + "</p>" +
      '<p class="credit">3D-automodel: &ldquo;Car Concept&rdquo; door Eric Chadwick / Darmstadt Graphics Group, via de <a href="https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept" target="_blank" rel="noopener">Khronos glTF Sample Assets</a>, licentie <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>. Het model is voor de animatie in losse onderdelen opgedeeld. ' +
      'Lettertypes: Inter en Barlow Condensed, <a href="https://openfontlicense.org" target="_blank" rel="noopener">SIL Open Font License</a>. Alle afbeeldingen zijn renders uit de eigen 3D-animatie.</p>' +
      "</div>"
    );
  }

  function nav(c) {
    var items = ['<li><a href="#factoryHero">Fabriek</a></li>'];
    c.chapters.forEach(function (ch, i) {
      var short = ch.nav || ch.id.charAt(0).toUpperCase() + ch.id.slice(1);
      items.push('<li><a href="#' + ch.id + '"><b>' + String(i + 1).padStart(2, "0") + "</b> " + esc(short) + "</a></li>");
    });
    items.push('<li><a href="#conclusie">Conclusie</a></li>', '<li><a href="#bronnen">Bronnen</a></li>');
    return items.join("");
  }

  // --- opbouwen ------------------------------------------------------------------

  function render() {
    var c = loadContent();
    window.SiteContent = c;
    sourceNumber = {};
    c.sources.forEach(function (s, i) {
      sourceNumber[s.id] = i + 1;
    });
    document.title = c.site.title;
    document.getElementById("navLinks").innerHTML = nav(c);
    document.getElementById("content").innerHTML =
      intro(c) + highlights(c) + c.chapters.map(chapter).join("") + conclusion(c) + sources(c);
    document.getElementById("siteFooter").innerHTML = footer(c);
    document.querySelectorAll("[data-text]").forEach(function (el) {
      var path = el.getAttribute("data-text").split(".");
      var v = c;
      for (var i = 0; i < path.length && v != null; i++) v = v[path[i]];
      if (typeof v === "string") el.textContent = v;
    });
    document.dispatchEvent(new CustomEvent("site:rendered", { detail: c }));
  }

  render();
  window.renderSite = render;

  // Online teksten (als er een Firebase-project is ingesteld in js/firebase-config.js).
  // Nieuwere teksten worden bewaard in de browser, zodat ze ook zonder internet blijven.
  // Tijdens de rondleiding wachten we met bijwerken tot hij weer bovenaan begint.
  var pending = null;

  function applyContent(c) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
    } catch (e) {
      /* dan alleen voor nu */
    }
    if (document.body.classList.contains("touring")) pending = c;
    else render();
  }

  window.applyPendingContent = function () {
    if (!pending) return false;
    pending = null;
    render();
    return true;
  };

  function fetchRemote() {
    var cfg = window.FIREBASE_CONFIG;
    if (!cfg || !cfg.projectId || !window.fetch) return;
    var host = cfg.emulator ? "http://" + cfg.emulator.firestore : "https://firestore.googleapis.com";
    var url = host + "/v1/projects/" + encodeURIComponent(cfg.projectId) + "/databases/(default)/documents/site/content" + (cfg.apiKey ? "?key=" + encodeURIComponent(cfg.apiKey) : "");
    fetch(url, { cache: "no-store" })
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (doc) {
        var json = doc && doc.fields && doc.fields.json && doc.fields.json.stringValue;
        if (!json) return;
        var c = JSON.parse(json);
        var now = window.SiteContent || {};
        if (c && c.version === window.SITE_CONTENT.version && (c.updated || "") > (now.updated || "")) applyContent(c);
      })
      .catch(function () {
        /* geen internet: dan de teksten die we al hebben */
      });
  }

  fetchRemote();
  window.setInterval(fetchRemote, 2 * 60 * 1000);

  // als de beheerpagina in een ander tabblad opslaat: meteen bijwerken
  window.addEventListener("storage", function (e) {
    if (e.key === STORAGE_KEY) render();
  });
})();
