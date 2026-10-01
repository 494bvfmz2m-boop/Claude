// Beheerpagina: alle teksten en tijden van de site aanpassen.
// Werkt op een kopie van window.SITE_CONTENT (js/content.js). "Opslaan" bewaart de
// teksten in deze browser (localStorage); de site gebruikt die dan meteen.
// "Opslaan als content.js" maakt een nieuw bestand, zodat de teksten ook op andere
// computers werken (vervang daarmee js/content.js).
(function () {
  "use strict";

  var STORAGE_KEY = "autosite-content";
  var ID_RE = /^[a-z0-9_-]+$/i;
  var REF_RE = /\[\[([^\]]*)\]\]/g;

  var base = window.SITE_CONTENT;
  var data;
  var fromBrowser = false; // er is een opgeslagen versie (browser of online)
  var auth = window.AdminAuth;
  var access = null; // "owner" of "admin" als je bent ingelogd
  var dirty = false;
  var current = "algemeen";

  var panel = document.getElementById("panel");
  var sideNav = document.getElementById("sideNav");
  var statusEl = document.getElementById("status");
  var sourceEl = document.getElementById("source");
  var toastEl = document.getElementById("toast");

  function clone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  function loadSaved() {
    try {
      var saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
      if (saved && saved.version === base.version && (saved.updated || "") >= (base.updated || "")) return saved;
    } catch (e) {
      /* niets opgeslagen of geen toegang */
    }
    return null;
  }

  // --- kleine DOM-hulp ---------------------------------------------------------

  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null || v === false) return;
        if (k === "class") el.className = v;
        else if (k === "text") el.textContent = v;
        else if (k.slice(0, 2) === "on") el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? "" : v);
      });
    }
    (children || []).forEach(function (c) {
      if (c == null || c === false) return;
      el.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return el;
  }

  var uid = 0;
  function nextId() {
    return "f" + ++uid;
  }

  function toast(msg, kind) {
    toastEl.textContent = msg;
    toastEl.className = "toast show " + (kind || "");
    toastEl.hidden = false;
    window.clearTimeout(toast.t);
    toast.t = window.setTimeout(function () {
      toastEl.className = "toast";
      window.setTimeout(function () {
        toastEl.hidden = true;
      }, 300);
    }, 2800);
  }

  function setDirty(on) {
    dirty = on;
    document.body.classList.toggle("is-dirty", on);
    statusEl.textContent = on ? "Niet opgeslagen wijzigingen" : fromBrowser ? "Alles opgeslagen" : "";
  }

  function changed() {
    setDirty(true);
    refreshWarnings();
    updateEstimate();
  }

  // --- tekst-hulp ----------------------------------------------------------------

  function words(text) {
    var t = String(text || "").replace(REF_RE, "[1]").trim();
    return t ? t.split(/\s+/).length : 0;
  }

  function readSeconds(text) {
    var wps = Math.max(0.5, Number(data.tour.wordsPerSecond) || 2.6);
    return Math.max(1, Math.round(words(text) / wps));
  }

  function sourceIndex() {
    var map = {};
    data.sources.forEach(function (s, i) {
      map[s.id] = i + 1;
    });
    return map;
  }

  function badRefs(text) {
    var map = sourceIndex();
    var bad = [];
    String(text || "").replace(REF_RE, function (m, id) {
      if (!map[id]) bad.push(m);
      return m;
    });
    return bad;
  }

  // --- velden ----------------------------------------------------------------------

  function field(label, input, hint, extraClass) {
    var id = input.id || (input.id = nextId());
    return h("div", { class: "field " + (extraClass || "") }, [
      h("label", { for: id, text: label }),
      input,
      hint ? h("p", { class: "hint", text: hint }) : null,
    ]);
  }

  function textInput(obj, key, label, hint, opts) {
    opts = opts || {};
    var input = h("input", { type: "text", value: obj[key] == null ? "" : obj[key], placeholder: opts.placeholder });
    input.addEventListener("input", function () {
      obj[key] = input.value;
      if (opts.onInput) opts.onInput(input.value);
      changed();
    });
    return field(label, input, hint, opts.wide ? "wide" : "");
  }

  function numberInput(obj, key, label, hint, opts) {
    opts = opts || {};
    var input = h("input", {
      type: "number",
      inputmode: "decimal",
      min: opts.min != null ? opts.min : 0,
      max: opts.max,
      step: opts.step || 1,
      value: obj[key] == null ? "" : obj[key],
      placeholder: opts.placeholder,
    });
    input.addEventListener("input", function () {
      var v = input.value.trim() === "" ? null : Number(input.value);
      if (v != null && !isFinite(v)) return;
      if (v == null && !opts.nullable) return;
      obj[key] = v;
      changed();
    });
    input.id = nextId();
    var wrap = h("div", { class: "num-wrap" }, [input, opts.unit ? h("span", { class: "unit", text: opts.unit }) : null]);
    var f = field(label, wrap, hint, "num " + (opts.cls || ""));
    f.querySelector("label").setAttribute("for", input.id);
    wrap.removeAttribute("id");
    return f;
  }

  function sourceSelect(obj, key, label) {
    var sel = h("select", {}, [h("option", { value: "", text: "— geen bron —" })]);
    data.sources.forEach(function (s, i) {
      sel.appendChild(h("option", { value: s.id, text: "[" + (i + 1) + "] " + (s.linkText || s.id) + " — " + s.title }));
    });
    sel.value = obj[key] || "";
    sel.addEventListener("change", function () {
      obj[key] = sel.value;
      changed();
    });
    return field(label, sel);
  }

  // tekstvak met bronverwijzingen [[id]], woordenteller en (optioneel) eigen tijd
  function richText(obj, key, label, opts) {
    opts = opts || {};
    var ta = h("textarea", { rows: opts.rows || 4 });
    ta.value = obj[key] || "";
    var meta = h("span", { class: "meta" });
    var warn = h("p", { class: "warn", hidden: true });
    var secInput = null;

    function update() {
      var n = words(ta.value);
      meta.textContent = n + " woorden · leestijd ≈ " + readSeconds(ta.value) + " s";
      var bad = badRefs(ta.value);
      warn.hidden = !bad.length;
      warn.textContent = bad.length ? "Onbekende bron: " + bad.join(", ") + " (wordt op de site weggelaten)" : "";
      if (secInput) secInput.placeholder = "auto";
    }
    ta.addEventListener("input", function () {
      obj[key] = ta.value;
      update();
      changed();
    });
    ta.dataset.rich = "1";
    ta._update = update;

    var insert = h("select", { class: "ref-insert", "aria-label": "Bronverwijzing invoegen" }, [h("option", { value: "", text: "+ bron invoegen" })]);
    data.sources.forEach(function (s, i) {
      insert.appendChild(h("option", { value: s.id, text: "[" + (i + 1) + "] " + (s.linkText || s.id) }));
    });
    insert.addEventListener("change", function () {
      if (!insert.value) return;
      var tag = "[[" + insert.value + "]]";
      var a = ta.selectionStart,
        b = ta.selectionEnd;
      if (a == null || document.activeElement !== ta && a === 0 && b === 0) a = b = ta.value.length;
      var before = ta.value.slice(0, a);
      var sep = before && !/\s$/.test(before) ? " " : "";
      ta.value = before + sep + tag + ta.value.slice(b);
      ta.selectionStart = ta.selectionEnd = a + sep.length + tag.length;
      insert.value = "";
      ta.focus();
      ta.dispatchEvent(new Event("input"));
    });

    var row = [];
    if (opts.secondsObj) {
      var so = opts.secondsObj,
        sk = opts.secondsKey || "seconds";
      secInput = h("input", { type: "number", min: 0, step: 1, inputmode: "numeric", value: so[sk] == null ? "" : so[sk], placeholder: "auto", "aria-label": "Tijd in seconden" });
      secInput.addEventListener("input", function () {
        var v = secInput.value.trim() === "" ? null : Number(secInput.value);
        so[sk] = v && v > 0 ? v : null;
        changed();
      });
      row.push(
        h("label", { class: "sec-field", title: "Leeg = automatisch (op basis van het aantal woorden)" }, [
          h("span", { text: "Tijd" }),
          secInput,
          h("span", { class: "unit", text: "s" }),
        ])
      );
    }

    var f = h("div", { class: "field wide rich" }, [
      label ? h("label", { for: (ta.id = nextId()), text: label }) : null,
      ta,
      h("div", { class: "rich-bar" }, [meta, insert].concat(row)),
      warn,
    ]);
    update();
    return f;
  }

  function refreshWarnings() {
    panel.querySelectorAll("textarea[data-rich]").forEach(function (ta) {
      if (ta._update) ta._update();
    });
  }

  // --- blokken ------------------------------------------------------------------------

  function card(title, children, tools) {
    return h("section", { class: "card" }, [
      title || tools ? h("header", { class: "card-head" }, [h("h3", { text: title || "" }), tools ? h("div", { class: "tools" }, tools) : null]) : null,
      h("div", { class: "card-body" }, children),
    ]);
  }

  function iconBtn(label, title, onClick, disabled, cls) {
    return h("button", { type: "button", class: "icon-btn " + (cls || ""), title: title, "aria-label": title, disabled: disabled, onclick: onClick, text: label });
  }

  function moveItem(list, i, d) {
    var j = i + d;
    if (j < 0 || j >= list.length) return;
    var t = list[i];
    list[i] = list[j];
    list[j] = t;
    changed();
    renderPanel();
  }

  function paragraphList(list) {
    var wrap = h("div", { class: "stack" });
    list.forEach(function (p, i) {
      wrap.appendChild(
        card(
          "Alinea " + (i + 1),
          [richText(p, "text", null, { rows: 5, secondsObj: p })],
          [
            iconBtn("↑", "Omhoog", function () {
              moveItem(list, i, -1);
            }, i === 0),
            iconBtn("↓", "Omlaag", function () {
              moveItem(list, i, 1);
            }, i === list.length - 1),
            iconBtn("✕", "Alinea verwijderen", function () {
              if (!window.confirm("Alinea " + (i + 1) + " verwijderen?")) return;
              list.splice(i, 1);
              changed();
              renderPanel();
            }, list.length <= 1, "danger"),
          ]
        )
      );
    });
    wrap.appendChild(
      h("button", {
        type: "button",
        class: "btn add",
        text: "+ Alinea toevoegen",
        onclick: function () {
          list.push({ text: "", seconds: null });
          changed();
          renderPanel();
          var all = panel.querySelectorAll("textarea");
          if (all.length) all[all.length - 1].focus();
        },
      })
    );
    return wrap;
  }

  // vaste lijst (het aantal hoort bij een tekening op de site)
  function pairList(list, title, a, b, hint) {
    var rows = list.map(function (item, i) {
      return h("div", { class: "pair" }, [
        h("span", { class: "pair-n", text: String(i + 1) }),
        textInput(item, a.key, a.label),
        textInput(item, b.key, b.label, null, { wide: true }),
      ]);
    });
    return card(title, [hint ? h("p", { class: "hint top", text: hint }) : null].concat(rows));
  }

  function section(title, intro, children) {
    return [h("div", { class: "panel-head" }, [h("h2", { text: title }), intro ? h("p", { class: "lede", text: intro }) : null])].concat(children);
  }

  // --- onderdelen ---------------------------------------------------------------------

  var SECONDS_HINT = "Leeg laten = automatisch op basis van het aantal woorden. Vul je een getal in, dan blijft de rondleiding precies zo lang op deze tekst staan.";

  var SECTIONS = [
    { id: "algemeen", label: "Algemeen", group: "Site" },
    { id: "rondleiding", label: "Rondleiding & tempo", group: "Site" },
    { id: "animatie", label: "Animatie-teksten", group: "Site" },
    { id: "inleiding", label: "Inleiding", group: "Pagina" },
    { id: "cijfers", label: "In cijfers", group: "Pagina" },
  ];

  function allSections() {
    var list = SECTIONS.slice();
    data.chapters.forEach(function (ch, i) {
      list.push({ id: "ch-" + ch.id, label: String(i + 1).padStart(2, "0") + " " + (ch.nav || ch.id), group: "Deelvragen", chapter: ch, index: i });
    });
    list.push({ id: "conclusie", label: "Conclusie", group: "Afsluiting" }, { id: "bronnen", label: "Bronnen", group: "Afsluiting" }, { id: "voettekst", label: "Voettekst", group: "Afsluiting" });
    if (access) list.push({ id: "beheerders", label: "Beheerders", group: "Account" });
    return list;
  }

  var builders = {
    algemeen: function () {
      return section("Algemeen", "De titel en de teksten bovenin, over de 3D-animatie.", [
        card("Bovenin de site", [
          textInput(data.site, "title", "Titel van de site", "Staat groot over de animatie, in de menubalk en als tabblad-titel.", { wide: true }),
          textInput(data.intro, "kicker", "Kleine tekst boven de titel", null, { wide: true }),
          textInput(data.site, "heroLabel", "Label linksboven in de animatie"),
          textInput(data.site, "heroCta", "Tekst op de knop onder de titel"),
        ]),
      ]);
    },

    rondleiding: function () {
      var t = data.tour;
      return section(
        "Rondleiding & tempo",
        "Met W start de rondleiding: hij wacht tot de auto klaar is en bladert dan scherm voor scherm door de site. Per scherm telt hij de woorden die nieuw in beeld zijn. Per tekst kun je ook een vaste tijd invullen (bij de teksten zelf).",
        [
          card("Leestempo", [
            numberInput(t, "wordsPerSecond", "Leessnelheid", "Lager getal = langer blijven staan. 2,6 is rustig lezen voor bezoekers.", { step: 0.1, min: 0.5, unit: "woorden/s" }),
            numberInput(t, "baseSeconds", "Extra tijd per scherm", "Tijd om te gaan kijken voordat het lezen begint.", { unit: "s" }),
            numberInput(t, "minSeconds", "Minimaal per scherm", null, { unit: "s", min: 1 }),
            numberInput(t, "maxSeconds", "Maximaal per scherm", null, { unit: "s", min: 1 }),
            numberInput(t, "sourcesMaxSeconds", "Maximaal per scherm bij de bronnen", null, { unit: "s", min: 1 }),
          ]),
          card("Begin en einde", [
            numberInput(t, "afterBuildSeconds", "Na de animatie wachten", "Hoe lang de klare auto in beeld blijft voordat hij naar beneden gaat.", { unit: "s" }),
            numberInput(t, "endSeconds", "Onderaan wachten", "Daarna gaat hij terug naar boven en start de animatie opnieuw.", { unit: "s", min: 1 }),
          ]),
          estimateCard(),
        ]
      );
    },

    animatie: function () {
      return section("Animatie-teksten", "De stappen die linksonder in de 3D-animatie verschijnen. Het aantal en de volgorde horen bij de animatie en liggen vast.", [
        card(
          null,
          data.steps.map(function (s, i) {
            return h("div", { class: "pair" }, [
              h("span", { class: "pair-n", text: String(i + 1) }),
              textInput(s, "title", "Titel"),
              textInput(s, "caption", "Onderschrift", null, { wide: true }),
            ]);
          })
        ),
      ]);
    },

    inleiding: function () {
      return section("Inleiding", "De grote tekst direct onder de animatie, met daaronder de kaarten naar de deelvragen (die gebruiken de titels van de deelvragen).", [
        card("Inleidende tekst", [richText(data.intro, "lead", null, { rows: 7, secondsObj: data.intro }), h("p", { class: "hint", text: SECONDS_HINT })]),
      ]);
    },

    cijfers: function () {
      var hl = data.highlights;
      return section("In cijfers", "De vier grote getallen onder de inleiding. Een getal telt op de site vanzelf op.", [
        card("Kopje", [textInput(hl, "title", "Titel boven de getallen")]),
        h(
          "div",
          { class: "grid2" },
          hl.items.map(function (it, i) {
            return card("Getal " + (i + 1), [
              textInput(it, "value", "Getal", "Bijv. 30.000 of 18–35"),
              textInput(it, "unit", "Eenheid", "Bijv. uur, %, kg (mag leeg)"),
              textInput(it, "label", "Omschrijving", null, { wide: true }),
              sourceSelect(it, "source", "Bron"),
            ]);
          })
        ),
      ]);
    },

    conclusie: function () {
      var k = data.conclusion;
      return section("Conclusie", "Het antwoord op de hoofdvraag, onderaan de site.", [
        card("Kop", [textInput(k, "kicker", "Kleine tekst boven de titel"), textInput(k, "title", "Titel"), textInput(k, "cta", "Tekst op de knop", null, { wide: true })]),
        card("Tekst", [richText(k, "text", null, { rows: 9, secondsObj: k }), h("p", { class: "hint", text: SECONDS_HINT })]),
      ]);
    },

    voettekst: function () {
      return section("Voettekst", "Helemaal onderaan de pagina. De vermelding van het 3D-model en de lettertypes staat er altijd onder (verplicht door de licentie).", [
        card(null, [
          h("div", { class: "field wide" }, [
            h("label", { for: "footerText", text: "Tekst" }),
            (function () {
              var ta = h("textarea", { id: "footerText", rows: 3 });
              ta.value = data.footer.text || "";
              ta.addEventListener("input", function () {
                data.footer.text = ta.value;
                changed();
              });
              return ta;
            })(),
          ]),
        ]),
      ]);
    },

    beheerders: function () {
      var owner = access === "owner";
      var listBox = h("div", { class: "admin-list" }, [h("p", { class: "hint", text: "Laden…" })]);
      var parts = [card("Wie mag de teksten aanpassen?", [listBox])];
      if (owner) {
        parts.push(
          card("Accounts bewaren", [
            h("p", { class: "hint top", text: "Gewijzigde wachtwoorden worden in deze browser bewaard. Moeten ze ook op een andere computer werken, sla dan de accounts op als bestand en vervang daarmee admin/accounts.js." }),
            h("button", {
              type: "button",
              class: "btn",
              text: "Accounts opslaan als bestand",
              onclick: function () {
                saveTextFile(auth.fileText(), "accounts.js", "Zet hem in de map admin/ (vervang het oude bestand).");
              },
            }),
          ])
        );
      }
      parts.push(passwordCard());
      loadAdmins(listBox);
      return section("Beheerders", owner ? "Jij bent de hoofdbeheerder." : "Hier kun je je eigen wachtwoord wijzigen.", parts);
    },

    bronnen: function () {
      var map = sourceIndex();
      var list = data.sources;
      var items = list.map(function (s, i) {
        var used = usesOf(s.id);
        var idField = textInput(s, "id", "Code", "Gebruik je in teksten als [[" + s.id + "]]", {
          onInput: function (v) {
            s.id = v.trim();
          },
        });
        idField.querySelector("input").addEventListener("change", function () {
          var old = Object.keys(map).filter(function (k) {
            return map[k] === i + 1;
          })[0];
          if (old && old !== s.id && ID_RE.test(s.id)) {
            if (window.confirm("Ook alle verwijzingen [[" + old + "]] in de teksten veranderen in [[" + s.id + "]]?")) renameRefs(old, s.id);
          }
          renderPanel();
        });
        return card(
          "[" + (i + 1) + "] " + (s.linkText || s.id),
          [
            h("p", { class: "hint top", text: used.length ? "Gebruikt bij: " + used.join(", ") : "Nog nergens naar verwezen." }),
            idField,
            textInput(s, "type", "Soort", "Bijv. Artikel, Website, Video"),
            textInput(s, "before", "Auteur en datum", "Bijv. Groenhuijsen, H. (2020).", { wide: true }),
            textInput(s, "title", "Titel (schuin)", null, { wide: true }),
            textInput(s, "after", "Tekst na de titel", "Bijv. Geraadpleegd via", { wide: true }),
            textInput(s, "url", "Link", "Moet beginnen met https://", { wide: true, placeholder: "https://" }),
            textInput(s, "linkText", "Tekst van de link", "Bijv. de naam van de website"),
          ],
          [
            iconBtn("↑", "Omhoog", function () {
              moveItem(list, i, -1);
            }, i === 0),
            iconBtn("↓", "Omlaag", function () {
              moveItem(list, i, 1);
            }, i === list.length - 1),
            iconBtn("✕", "Bron verwijderen", function () {
              var msg = "Bron [" + (i + 1) + "] verwijderen?";
              if (used.length) msg += "\n\nLet op: er wordt nog naar verwezen bij: " + used.join(", ") + ". Die verwijzingen verdwijnen dan van de site.";
              if (!window.confirm(msg)) return;
              list.splice(i, 1);
              changed();
              renderPanel();
            }, false, "danger"),
          ]
        );
      });
      return section(
        "Bronnen",
        "De nummers [1], [2], … op de site volgen vanzelf de volgorde hieronder. In teksten verwijs je met de code, bijv. [[jvis]].",
        [
          card("Kop", [textInput(data, "sourcesKicker", "Kleine tekst boven de titel"), textInput(data, "sourcesTitle", "Titel")]),
          h("div", { class: "stack" }, items),
          h("button", {
            type: "button",
            class: "btn add",
            text: "+ Bron toevoegen",
            onclick: function () {
              var n = list.length + 1,
                id = "bron" + n;
              while (map[id]) id = "bron" + ++n;
              list.push({ id: id, type: "Website", before: "", title: "", after: "Geraadpleegd via", url: "https://", linkText: "" });
              changed();
              renderPanel();
            },
          }),
        ]
      );
    },
  };

  function chapterBuilder(ch, index) {
    var parts = [
      card("Kop en grote afbeelding", [
        textInput(ch, "kicker", "Kleine tekst boven de titel", "Bijv. Deelvraag " + (index + 1)),
        textInput(ch, "nav", "Korte naam in het menu"),
        textInput(ch, "title", "Titel", "Staat groot op de afbeelding en op de kaart in de inleiding.", { wide: true }),
        numberInput(ch, "bannerSeconds", "Tijd op de grote afbeelding", "Hoe lang de rondleiding op de titel-afbeelding blijft staan.", { unit: "s", nullable: true, placeholder: "auto" }),
        textInput(ch, "bannerAlt", "Beschrijving afbeelding (voor schermlezers)", null, { wide: true }),
      ]),
      h("div", { class: "sub-head" }, [
        h("h3", { text: "Teksten" }),
        h("p", { class: "hint", text: SECONDS_HINT }),
        h("p", { class: "hint", text: "Een code tussen dubbele haken, bijv. [[npo]], wordt op de site een genummerde bronverwijzing zoals [3]. Gebruik “+ bron invoegen” om er een toe te voegen." }),
      ]),
      paragraphList(ch.paragraphs),
    ];
    if (ch.figure) {
      if (!("seconds" in ch.figure)) ch.figure.seconds = null;
      parts.push(
        card("Foto naast de tekst", [
          textInput(ch.figure, "caption", "Onderschrift", null, { wide: true }),
          textInput(ch.figure, "alt", "Beschrijving (voor schermlezers)", null, { wide: true }),
          numberInput(ch.figure, "seconds", "Eigen tijd", "Leeg = automatisch.", { unit: "s", nullable: true, placeholder: "auto" }),
        ])
      );
    }
    if (ch.bodyTypes) parts.push(pairList(ch.bodyTypes, "Soorten carrosserie", { key: "name", label: "Naam" }, { key: "text", label: "Uitleg" }, "Vier kaartjes met een tekening; het aantal ligt vast."));
    if (ch.engineTypes) parts.push(pairList(ch.engineTypes, "Soorten motoren", { key: "name", label: "Naam" }, { key: "text", label: "Uitleg" }, "Drie kaartjes met een tekening; het aantal ligt vast."));
    if (ch.callouts) parts.push(pairList(ch.callouts, "Nummers op de opengewerkte auto", { key: "name", label: "Onderdeel" }, { key: "text", label: "Materiaal" }, "De nummers staan op vaste plekken op de foto."));
    if (ch.process) parts.push(pairList(ch.process, "Tijdlijn", { key: "name", label: "Stap" }, { key: "text", label: "Uitleg" }));
    if (ch.stats) parts.push(pairList(ch.stats, "Getallen", { key: "value", label: "Getal" }, { key: "label", label: "Omschrijving" }));
    if (ch.materialBar) {
      var b = ch.materialBar;
      parts.push(
        card("Balk met materialen", [
          textInput(b, "metal", "Tekst in het metaal-deel", null, { wide: true }),
          textInput(b, "rest", "Tekst in het overige deel"),
          textInput(b, "legendMetal", "Legenda metaal"),
          textInput(b, "legendRubber", "Legenda rubber"),
          textInput(b, "legendRest", "Legenda overig"),
          sourceSelect(b, "source", "Bron"),
        ])
      );
    }
    return section(String(index + 1).padStart(2, "0") + " · " + (ch.nav || ch.title), ch.title, parts);
  }

  function fmtDate(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d)) return "";
    return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short" }) + " " + d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
  }

  function passwordCard() {
    var err = h("p", { class: "warn", hidden: true, role: "alert" });
    var f = h("form", { class: "invite-form" }, [
      inputField("pwOld", "Huidig wachtwoord", "password", "", "current-password"),
      inputField("pwNew", "Nieuw wachtwoord (minstens 8 tekens)", "password", "", "new-password"),
      inputField("pwNew2", "Herhaal nieuw wachtwoord", "password", "", "new-password"),
      err,
      h("div", {}, [h("button", { type: "submit", class: "btn", text: "Wachtwoord wijzigen" })]),
    ]);
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      err.hidden = true;
      if (val("pwNew") !== val("pwNew2")) {
        err.textContent = "De twee nieuwe wachtwoorden zijn niet hetzelfde.";
        err.hidden = false;
        return;
      }
      auth
        .changePassword(val("pwOld"), val("pwNew"))
        .then(function () {
          f.reset();
          toast("Wachtwoord gewijzigd.", "ok");
        })
        .catch(function (e2) {
          err.textContent = e2.message;
          err.hidden = false;
        });
    });
    return card("Je eigen wachtwoord wijzigen", [f]);
  }

  function loadAdmins(box) {
    auth.listAdmins().then(function (rows) {
      box.innerHTML = "";
      rows.forEach(function (a) {
        var badge =
          a.status === "owner"
            ? h("span", { class: "badge owner", text: "Hoofdbeheerder" })
            : a.status === "active"
            ? h("span", { class: "badge ok", text: "Eigen wachtwoord" })
            : h("span", { class: "badge wait", text: "Nog tijdelijk wachtwoord" });
        box.appendChild(h("div", { class: "admin-row" }, [h("span", { class: "admin-email", text: a.email }), badge]));
      });
    });
  }

  // --- geschatte duur van de rondleiding ------------------------------------------

  function estimateSeconds() {
    var t = data.tour;
    var wps = Math.max(0.5, Number(t.wordsPerSecond) || 2.6);
    function block(text, sec) {
      return sec > 0 ? sec : words(text) / wps;
    }
    var total = 35 + (Number(t.afterBuildSeconds) || 0); // animatie
    total += Math.max(t.minSeconds || 0, block(data.intro.lead, data.intro.seconds) + (t.baseSeconds || 0));
    total += Math.max(t.minSeconds || 0, 8);
    data.chapters.forEach(function (ch) {
      total += ch.bannerSeconds > 0 ? ch.bannerSeconds : 6;
      var s = 0;
      ch.paragraphs.forEach(function (p) {
        s += block(p.text, p.seconds);
      });
      if (ch.figure) s += block(ch.figure.caption, ch.figure.seconds);
      ["bodyTypes", "engineTypes", "callouts", "process", "stats"].forEach(function (k) {
        (ch[k] || []).forEach(function (it) {
          s += words((it.name || it.value) + " " + (it.text || it.label)) / wps;
        });
      });
      var screens = Math.max(1, Math.ceil(ch.paragraphs.length / 2));
      total += Math.max(s + screens * (t.baseSeconds || 0), screens * (t.minSeconds || 0));
    });
    total += Math.max(t.minSeconds || 0, block(data.conclusion.text, data.conclusion.seconds) + (t.baseSeconds || 0));
    total += Math.min(data.sources.length * 3, 3 * (t.sourcesMaxSeconds || 14));
    total += (t.endSeconds || 0) + 6;
    return total;
  }

  var estimateEl = null;

  function updateEstimate() {
    if (!estimateEl) return;
    var s = Math.round(estimateSeconds());
    estimateEl.textContent = "≈ " + Math.floor(s / 60) + " min " + String(s % 60).padStart(2, "0") + " s";
  }

  function estimateCard() {
    var out = (estimateEl = h("p", { class: "estimate" }));
    updateEstimate();
    return card("Eén rondje duurt ongeveer", [out, h("p", { class: "hint", text: "Een schatting; de echte tijd hangt ook af van de grootte van het scherm." })]);
  }

  // --- zoeken naar verwijzingen ---------------------------------------------------

  function eachRichText(fn) {
    fn(data.intro.lead, "Inleiding", function (v) {
      data.intro.lead = v;
    });
    data.chapters.forEach(function (ch, ci) {
      ch.paragraphs.forEach(function (p, pi) {
        fn(p.text, String(ci + 1).padStart(2, "0") + " " + (ch.nav || ch.id) + " (alinea " + (pi + 1) + ")", function (v) {
          p.text = v;
        });
      });
    });
    fn(data.conclusion.text, "Conclusie", function (v) {
      data.conclusion.text = v;
    });
  }

  function usesOf(id) {
    var out = [];
    var tag = "[[" + id + "]]";
    eachRichText(function (text, where) {
      if (String(text).indexOf(tag) >= 0) out.push(where);
    });
    data.highlights.items.forEach(function (it, i) {
      if (it.source === id) out.push("In cijfers (getal " + (i + 1) + ")");
    });
    data.chapters.forEach(function (ch) {
      if (ch.materialBar && ch.materialBar.source === id) out.push("Balk met materialen");
    });
    return out;
  }

  function renameRefs(oldId, newId) {
    eachRichText(function (text, where, set) {
      set(String(text).split("[[" + oldId + "]]").join("[[" + newId + "]]"));
    });
    data.highlights.items.forEach(function (it) {
      if (it.source === oldId) it.source = newId;
    });
    data.chapters.forEach(function (ch) {
      if (ch.materialBar && ch.materialBar.source === oldId) ch.materialBar.source = newId;
    });
  }

  function problems() {
    var out = [];
    var seen = {};
    data.sources.forEach(function (s, i) {
      if (!ID_RE.test(s.id || "")) out.push("Bron [" + (i + 1) + "]: de code mag alleen letters, cijfers, - en _ bevatten.");
      else if (seen[s.id]) out.push("Bron [" + (i + 1) + "]: de code “" + s.id + "” komt twee keer voor.");
      seen[s.id] = true;
      if (!/^https?:\/\/\S+\.\S+/i.test(s.url || "")) out.push("Bron [" + (i + 1) + "]: de link moet beginnen met https://");
    });
    eachRichText(function (text, where) {
      var bad = badRefs(text);
      if (bad.length) out.push(where + ": onbekende bron " + bad.join(", "));
    });
    if (!String(data.site.title || "").trim()) out.push("De titel van de site is leeg.");
    return out;
  }

  // --- navigatie en weergave -------------------------------------------------------

  function renderNav() {
    sideNav.innerHTML = "";
    var group = null,
      ul = null;
    allSections().forEach(function (s) {
      if (s.group !== group) {
        group = s.group;
        sideNav.appendChild(h("p", { class: "side-title", text: group }));
        ul = h("ul");
        sideNav.appendChild(ul);
      }
      ul.appendChild(
        h("li", {}, [
          h("a", {
            href: "#" + s.id,
            class: s.id === current ? "active" : "",
            "aria-current": s.id === current ? "page" : null,
            text: s.label,
          }),
        ])
      );
    });
  }

  function renderPanel() {
    var y = window.scrollY;
    estimateEl = null;
    var sec = allSections().filter(function (s) {
      return s.id === current;
    })[0];
    if (!sec) {
      current = "algemeen";
      sec = SECTIONS[0];
    }
    panel.innerHTML = "";
    var nodes = sec.chapter ? chapterBuilder(sec.chapter, sec.index) : builders[sec.id]();
    nodes.forEach(function (n) {
      panel.appendChild(n);
    });
    renderNav();
    window.scrollTo(0, y);
  }

  function go(id) {
    current = id;
    renderPanel();
    window.scrollTo(0, 0);
  }

  window.addEventListener("hashchange", function () {
    var id = location.hash.slice(1);
    if (id && id !== current) go(id);
  });

  // --- opslaan / laden ---------------------------------------------------------------

  function stamp() {
    data.version = base.version;
    data.updated = new Date().toISOString();
  }

  function cacheLocally() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  }

  function save() {
    var p = problems();
    if (p.length && !window.confirm("Let op:\n\n• " + p.join("\n• ") + "\n\nToch opslaan?")) return false;
    stamp();
    if (!cacheLocally()) {
      toast("Opslaan in de browser lukt niet. Gebruik “Opslaan als content.js”.", "error");
      return false;
    }
    fromBrowser = true;
    sourceEl.textContent = "opgeslagen in deze browser";
    setDirty(false);
    toast("Opgeslagen — de site is bijgewerkt (herlaad als hij al open staat).", "ok");
    return true;
  }

  function fileText() {
    return (
      "// Alle teksten van de website. Aanpassen kan het makkelijkst via admin/index.html.\n" +
      "// Bronverwijzingen in teksten staan als [[bron-id]] en worden op de site [1], [2], ... met een link.\n" +
      "window.SITE_CONTENT = " + JSON.stringify(data, null, 2) + ";\n"
    );
  }

  async function saveTextFile(text, name, where) {
    if (window.showSaveFilePicker) {
      try {
        var handle = await window.showSaveFilePicker({
          suggestedName: name,
          types: [{ description: "JavaScript", accept: { "text/javascript": [".js"] } }],
        });
        var w = await handle.createWritable();
        await w.write(text);
        await w.close();
        toast(name + " opgeslagen. " + where, "ok");
        return;
      } catch (e) {
        if (e && e.name === "AbortError") return;
      }
    }
    var a = h("a", { href: URL.createObjectURL(new Blob([text], { type: "text/javascript" })), download: name });
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast(name + " gedownload. " + where, "ok");
  }

  function exportFile() {
    var p = problems();
    if (p.length && !window.confirm("Let op:\n\n• " + p.join("\n• ") + "\n\nToch opslaan?")) return;
    stamp();
    saveTextFile(fileText(), "content.js", "Zet hem in de map js/ (vervang het oude bestand).");
  }

  function importFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var text = String(reader.result);
        var start = text.indexOf("{");
        var end = text.lastIndexOf("}");
        var obj = JSON.parse(text.slice(start, end + 1));
        if (!obj || !obj.site || !Array.isArray(obj.chapters) || !Array.isArray(obj.sources) || !obj.tour) throw new Error("vorm");
        if (!window.confirm("De teksten uit “" + file.name + "” laden? Wat je nu hebt wordt vervangen (pas definitief na Opslaan).")) return;
        data = obj;
        normalize();
        changed();
        renderPanel();
        toast("Geladen. Klik op Opslaan om het te bewaren.", "ok");
      } catch (e) {
        toast("Dit bestand kan niet gelezen worden. Kies een content.js van deze site.", "error");
      }
    };
    reader.readAsText(file);
  }

  function reset() {
    if (!window.confirm("Alle aanpassingen in deze browser weggooien en terug naar de teksten uit js/content.js?")) return;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      /* niets */
    }
    data = clone(base);
    normalize();
    fromBrowser = false;
    sourceEl.textContent = "teksten uit js/content.js";
    setDirty(false);
    renderPanel();
    toast("Teruggezet naar content.js.", "ok");
  }

  // ontbrekende velden aanvullen (bijv. bij een ouder bestand)
  function normalize() {
    data.version = base.version;
    ["site", "tour", "intro", "conclusion", "footer", "highlights"].forEach(function (k) {
      data[k] = Object.assign(clone(base[k] || {}), data[k] || {});
    });
    if (!Array.isArray(data.steps) || data.steps.length !== base.steps.length) data.steps = clone(base.steps);
    ["sourcesTitle", "sourcesKicker"].forEach(function (k) {
      if (data[k] == null) data[k] = base[k];
    });
    data.chapters.forEach(function (ch) {
      if (!Array.isArray(ch.paragraphs) || !ch.paragraphs.length) ch.paragraphs = [{ text: "", seconds: null }];
    });
  }

  document.getElementById("saveBtn").addEventListener("click", save);
  document.getElementById("exportBtn").addEventListener("click", exportFile);
  document.getElementById("resetBtn").addEventListener("click", reset);
  document.getElementById("importInput").addEventListener("change", function (e) {
    if (e.target.files[0]) importFile(e.target.files[0]);
    e.target.value = "";
  });
  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      if (data && !app.hidden) save();
    }
  });
  window.addEventListener("beforeunload", function (e) {
    if (!dirty) return;
    e.preventDefault();
    e.returnValue = "";
  });

  // --- inloggen ----------------------------------------------------------------------

  var gate = document.getElementById("gate");
  var app = document.getElementById("app");
  var userBox = document.getElementById("userBox");

  function showGate(title, lede, body) {
    app.hidden = true;
    document.body.classList.add("gated");
    gate.innerHTML = "";
    gate.appendChild(
      h("div", { class: "gate-card" }, [
        h("div", { class: "gate-brand" }, [h("span", { class: "mark", "aria-hidden": "true" }), h("span", { text: "Beheer" })]),
        h("h1", { text: title }),
        lede ? h("p", { class: "lede", text: lede }) : null,
      ].concat(body || []))
    );
    gate.hidden = false;
    var first = Array.prototype.filter.call(gate.querySelectorAll("input"), function (i) {
      return !i.value;
    })[0];
    if (first) first.focus();
  }

  function gateForm(fields, submitLabel, onSubmit, extra) {
    var err = h("p", { class: "warn", hidden: true, role: "alert" });
    var btn = h("button", { type: "submit", class: "btn primary big", text: submitLabel });
    var form = h("form", { class: "gate-form" }, fields.concat([err, btn], extra || []));
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      err.hidden = true;
      btn.disabled = true;
      var label = btn.textContent;
      btn.textContent = "Even geduld…";
      Promise.resolve()
        .then(onSubmit)
        .catch(function (e2) {
          err.textContent = e2.message;
          err.hidden = false;
        })
        .then(function () {
          btn.disabled = false;
          btn.textContent = label;
        });
    });
    return form;
  }

  function inputField(id, label, type, value, auto) {
    return h("div", { class: "field" }, [h("label", { for: id, text: label }), h("input", { id: id, type: type, value: value || "", autocomplete: auto, required: true })]);
  }

  function val(id) {
    return document.getElementById(id).value;
  }

  function showLogin(msg) {
    var forgot = h("p", { class: "hint center", text: "Eerste keer? Log in met het tijdelijke wachtwoord dat je hebt gekregen." });
    showGate("Inloggen", msg || "Log in om de teksten en tijden van de site aan te passen.", [
      gateForm(
        [inputField("loginEmail", "E-mailadres", "email", "", "username"), inputField("loginPassword", "Wachtwoord", "password", "", "current-password")],
        "Inloggen",
        function () {
          var pw = val("loginPassword");
          return auth.signIn(val("loginEmail"), pw).then(function (user) {
            if (user.mustChange) showFirstPassword(user, pw);
            else enter(user);
          });
        },
        [forgot]
      ),
    ]);
  }

  function showFirstPassword(user, tempPassword) {
    showGate("Kies je eigen wachtwoord", "Je bent voor het eerst ingelogd met een tijdelijk wachtwoord. Kies nu een eigen wachtwoord; daarmee log je voortaan in.", [
      gateForm(
        [
          inputField("firstPw", "Nieuw wachtwoord (minstens 8 tekens)", "password", "", "new-password"),
          inputField("firstPw2", "Herhaal het nieuwe wachtwoord", "password", "", "new-password"),
        ],
        "Wachtwoord opslaan",
        function () {
          if (val("firstPw") !== val("firstPw2")) throw new Error("De twee wachtwoorden zijn niet hetzelfde.");
          return auth.setFirstPassword(user.email, tempPassword, val("firstPw")).then(function (u) {
            toast("Je wachtwoord is opgeslagen. Welkom!", "ok");
            enter(u);
          });
        }
      ),
    ]);
  }

  function enter(user) {
    access = user.role === "owner" ? "owner" : "admin";
    var saved = loadSaved();
    openEditor(saved, saved ? "opgeslagen in deze browser" : "teksten uit js/content.js");
    showUser(user);
  }

  function showUser(user) {
    userBox.innerHTML = "";
    userBox.appendChild(h("span", { class: "user-email", text: user.email, title: access === "owner" ? "Hoofdbeheerder" : "Beheerder" }));
    userBox.appendChild(
      h("button", {
        type: "button",
        class: "btn ghost",
        text: "Uitloggen",
        onclick: function () {
          if (dirty && !window.confirm("Je hebt niet-opgeslagen wijzigingen. Toch uitloggen?")) return;
          setDirty(false);
          auth.signOut();
          access = null;
          userBox.hidden = true;
          showLogin("Je bent uitgelogd.");
        },
      })
    );
    userBox.hidden = false;
  }

  // --- start -------------------------------------------------------------------------

  function openEditor(content, label) {
    data = clone(content || base);
    fromBrowser = !!content;
    normalize();
    sourceEl.textContent = label;
    var start = location.hash.slice(1);
    if (start) current = start;
    gate.hidden = true;
    document.body.classList.remove("gated");
    app.hidden = false;
    renderPanel();
    setDirty(false);
  }

  if (!base) {
    showGate("Fout", "js/content.js niet gevonden. Open deze pagina vanuit de map admin/ van de website.");
    return;
  }
  if (!auth || !auth.ownerEmail) {
    showGate("Fout", "admin/accounts.js of admin/auth.js ontbreekt.");
    return;
  }
  var me = auth.current();
  if (me) enter(me);
  else showLogin();
})();
