(function () {
  var svg = document.getElementById("carSvg");
  var replayBtn = document.getElementById("replayBtn");
  var stage = document.getElementById("carStage");
  var factoryStage = document.getElementById("factoryStage");
  var factoryHero = document.getElementById("factoryHero");
  var robotArm = document.getElementById("robotArm");
  var sparkBurst = document.getElementById("sparkBurst");
  var doneBadge = document.getElementById("doneBadge");
  var stepLabel = document.getElementById("stepLabel");
  var dots = document.querySelectorAll("#progressDots .dot");

  // Wie wil weten wanneer de auto af is (auto-scroll wacht hierop).
  var buildDoneWaiters = [];

  function onBuildDone(fn) {
    buildDoneWaiters.push(fn);
  }

  function notifyBuildDone() {
    var waiters = buildDoneWaiters;
    buildDoneWaiters = [];
    waiters.forEach(function (fn) {
      fn();
    });
  }

  // --- 3D-fabriek (met de SVG-animatie als reserve) ---

  var use3D = false;
  var hudStep = document.getElementById("hudStep");
  var hudTitle = document.getElementById("hudTitle");
  var hudText = document.getElementById("hudText");
  var hudProgress = document.getElementById("hudProgress");
  var factoryLoading = document.getElementById("factoryLoading");

  function showHudStep(idx, total, step) {
    var done = idx >= total;
    hudStep.textContent = done ? "Klaar" : "Stap " + (idx + 1) + " / " + total;
    hudTitle.textContent = step.title;
    hudText.textContent = step.caption;
    var caption = hudTitle.parentNode;
    caption.classList.remove("swap");
    void caption.offsetWidth;
    caption.classList.add("swap");
    var bars = hudProgress.children;
    for (var i = 0; i < bars.length; i++) bars[i].classList.toggle("on", i <= idx);
    hudProgress.classList.toggle("done", done);
  }

  function useSvgFallback() {
    use3D = false;
    showFallbackSection();
    if (factoryHero) factoryHero.hidden = true;
    if (factoryStage) factoryStage.hidden = true;
    stage.hidden = false;
    playAnimation();
  }

  if (factoryStage && window.Car3D) {
    factoryHero.hidden = false;
    factoryStage.hidden = false;
    for (var i = 0; i < window.Car3D.steps.length; i++) hudProgress.appendChild(document.createElement("span"));
    use3D = window.Car3D.init(factoryStage, {
      onReady: function () {
        factoryLoading.classList.add("gone");
      },
      onStep: showHudStep,
      onDone: notifyBuildDone,
      onError: useSvgFallback,
    });
    if (use3D) {
      stage.hidden = true;
      // de 3D-fabriek bovenaan vervangt de 2D-sectie; "Animatie" in het menu springt ernaartoe
      var animSection = document.getElementById("animatie");
      if (animSection) animSection.hidden = true;
      var animLink = document.querySelector('.site-nav a[href="#animatie"]');
      if (animLink) animLink.setAttribute("href", "#factoryHero");
    } else {
      factoryHero.hidden = true;
      factoryStage.hidden = true;
      showFallbackSection();
    }
  } else {
    showFallbackSection();
  }

  function showFallbackSection() {
    var animSection = document.getElementById("animatie");
    if (animSection) animSection.hidden = false;
    var animLink = document.querySelector('.site-nav a[href="#factoryHero"]');
    if (animLink) animLink.setAttribute("href", "#animatie");
  }

  // --- SVG-animatie (reserve voor computers zonder WebGL) ---

  var timers = [];

  function clearTimers() {
    timers.forEach(function (t) {
      window.clearTimeout(t);
    });
    timers = [];
  }

  function at(ms, fn) {
    timers.push(window.setTimeout(fn, ms));
  }

  function setPart(id, on) {
    var el = document.getElementById(id);
    if (el) el.classList.toggle("in", on);
  }

  function setDots(count) {
    dots.forEach(function (dot, index) {
      dot.classList.toggle("dot-active", index < count);
    });
  }

  function setArm(classes) {
    // SVG elements need setAttribute for class changes; className is read-only there.
    robotArm.setAttribute("class", classes);
  }

  function resetStage() {
    clearTimers();
    svg.classList.remove("play", "done");
    ["part-chassis", "part-engine", "part-wheel-left", "part-wheel-right", "part-body", "part-windows"].forEach(function (id) {
      setPart(id, false);
    });
    setArm("robot-arm");
    sparkBurst.classList.remove("show");
    doneBadge.classList.remove("show");
    setDots(0);
    stepLabel.textContent = "Klaar om te bouwen…";
  }

  function playSvgAnimation() {
    resetStage();
    svg.classList.add("play");

    at(50, function () {
      stepLabel.textContent = "1. Chassis plaatsen";
      setPart("part-chassis", true);
      setDots(1);
    });

    at(600, function () {
      stepLabel.textContent = "2. Motorblok monteren";
      setPart("part-engine", true);
      setDots(2);
    });

    at(1150, function () {
      stepLabel.textContent = "3. Wielen monteren";
      setPart("part-wheel-left", true);
      setPart("part-wheel-right", true);
      setDots(3);
    });

    at(1800, function () {
      stepLabel.textContent = "4. Carrosserie plaatsen";
      setArm("robot-arm arm-in");
    });

    at(2250, function () {
      setArm("robot-arm arm-in arm-grab");
    });

    at(2500, function () {
      setArm("robot-arm arm-in arm-grab arm-lower");
      setPart("part-body", true);
      sparkBurst.classList.add("show");
      setDots(4);
    });

    at(2820, function () {
      setArm("robot-arm arm-in arm-lower");
      sparkBurst.classList.remove("show");
    });

    at(3050, function () {
      setArm("robot-arm arm-out");
    });

    at(3250, function () {
      stepLabel.textContent = "5. Ramen plaatsen";
      setPart("part-windows", true);
      setDots(5);
    });

    at(3750, function () {
      svg.classList.add("done");
      doneBadge.classList.add("show");
      stepLabel.textContent = "Klaar! De auto is compleet.";
      notifyBuildDone();
    });
  }

  function playAnimation() {
    if (use3D) {
      window.Car3D.play();
    } else {
      playSvgAnimation();
    }
  }

  // De 3D-fabriek start meteen en speelt in een lus; de 2D-reserve start zodra hij in beeld komt.
  var played = false;
  if (use3D) {
    played = true;
    playAnimation();
  } else if ("IntersectionObserver" in window && stage) {
    var carObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting && !played) {
            played = true;
            playAnimation();
          }
        });
      },
      { threshold: 0.4 }
    );
    carObserver.observe(stage);
  } else {
    playAnimation();
  }

  if (replayBtn) {
    replayBtn.addEventListener("click", playAnimation);
  }

  // Actieve link in het menu bijhouden
  var navLinks = document.querySelectorAll(".site-nav ul a");
  var tracked = document.querySelectorAll("#factoryHero, #animatie, main .chapter, #bronnen");
  if ("IntersectionObserver" in window && navLinks.length) {
    var navObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var id = entry.target.getAttribute("id");
          navLinks.forEach(function (link) {
            link.classList.toggle("active", link.getAttribute("href") === "#" + id);
          });
        });
      },
      { rootMargin: "-40% 0px -55% 0px" }
    );
    tracked.forEach(function (el) {
      navObserver.observe(el);
    });
  }

  // Knop "naar boven"
  var toTop = document.getElementById("toTop");
  if (toTop) {
    window.addEventListener(
      "scroll",
      function () {
        toTop.classList.toggle("visible", window.scrollY > 600);
      },
      { passive: true }
    );
    toTop.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // ---------------------------------------------------------------------------
  // Rondleiding voor een scherm of beamer op de markt. W zet hem aan/uit.
  //
  // Hij wacht bovenaan tot de auto klaar is en bladert dan scherm voor scherm
  // door de pagina: eerst het grote beeld met het kopje, daarna per stuk tekst
  // dat op het scherm past. Hoe lang hij blijft staan hangt af van hoeveel nieuwe
  // tekst er in beeld is. Onderaan gaat hij terug naar boven en begint alles
  // opnieuw. Tijdens de rondleiding: pijltje rechts/spatie = verder,
  // pijltje links = terug.
  // ---------------------------------------------------------------------------

  var WORDS_PER_SECOND = 2.6; // rustig leestempo voor voorbijgangers
  var BASE_SECONDS = 4;
  var MIN_SECONDS = 7;
  var MAX_SECONDS = 60;
  var BANNER_SECONDS = 6;
  var SOURCES_MAX_SECONDS = 14;

  var autoScrollIndicator = document.getElementById("autoScrollIndicator");
  var autoScrollText = document.getElementById("autoScrollText");
  var tourTimer = document.getElementById("tourTimer");
  var tourPanel = document.getElementById("tourPanel");
  var tourCount = document.getElementById("tourCount");
  var tourLabel = document.getElementById("tourLabel");
  var tourBar = document.getElementById("tourBar");
  var siteNav = document.getElementById("siteNav");
  var tourActive = false;
  var tourToken = 0;
  var indicatorHideTimer = null;
  var skipWait = null;
  var goBack = false;

  function showAutoScrollMessage(text) {
    if (!autoScrollIndicator || !autoScrollText) return;
    autoScrollText.textContent = text;
    autoScrollIndicator.classList.add("show");
    window.clearTimeout(indicatorHideTimer);
    indicatorHideTimer = window.setTimeout(function () {
      autoScrollIndicator.classList.remove("show");
    }, 2600);
  }

  function Stopped() {}

  function check(token) {
    if (!tourActive || token !== tourToken) throw new Stopped();
  }

  function navHeight() {
    return siteNav ? siteNav.offsetHeight : 0;
  }

  function maxScroll() {
    return document.documentElement.scrollHeight - window.innerHeight;
  }

  function jumpTo(y) {
    try {
      window.scrollTo({ top: y, left: 0, behavior: "instant" });
    } catch (e) {
      window.scrollTo(0, y);
    }
  }

  // eigen scrollanimatie (met kommagetallen, zodat er geen kleine stapjes wegvallen)
  function scrollToY(target, duration, token) {
    return new Promise(function (resolve, reject) {
      var from = null;
      var to = 0;
      var start = null;
      function step(ts) {
        if (!tourActive || token !== tourToken) {
          reject(new Stopped());
          return;
        }
        if (start === null) {
          jumpTo(window.scrollY);
          from = window.scrollY;
          to = Math.max(0, Math.min(target, maxScroll()));
          start = ts;
        }
        var k = Math.abs(to - from) < 2 ? 1 : Math.min(1, (ts - start) / duration);
        var e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        jumpTo(from + (to - from) * e);
        if (k < 1) window.requestAnimationFrame(step);
        else resolve();
      }
      window.requestAnimationFrame(step);
    });
  }

  // wachten met aftelteller; pijltje rechts slaat over, pijltje links gaat terug
  function countdown(ms, label, token) {
    return new Promise(function (resolve, reject) {
      var start = performance.now();
      var done = false;
      if (tourPanel) tourPanel.hidden = false;
      if (tourLabel) tourLabel.textContent = label;
      if (tourTimer) {
        tourTimer.style.transition = "none";
        tourTimer.style.width = "0%";
        tourTimer.classList.add("show");
        void tourTimer.offsetWidth;
        tourTimer.style.transition = "width " + ms + "ms linear";
        tourTimer.style.width = "100%";
      }
      function finish(back) {
        if (done) return;
        done = true;
        skipWait = null;
        window.clearInterval(tick);
        if (tourTimer) {
          tourTimer.classList.remove("show");
          tourTimer.style.transition = "none";
          tourTimer.style.width = "0%";
        }
        if (!tourActive || token !== tourToken) reject(new Stopped());
        else resolve(back ? "back" : "next");
      }
      function update() {
        var left = Math.max(0, ms - (performance.now() - start));
        if (tourCount) tourCount.textContent = Math.ceil(left / 1000);
        if (tourBar) tourBar.style.strokeDashoffset = String(138.2 * (1 - left / ms));
        if (left <= 0 || !tourActive || token !== tourToken) finish(false);
      }
      var tick = window.setInterval(update, 200);
      update();
      skipWait = finish;
    });
  }

  function words(el) {
    var t = (el.textContent || "").trim();
    return t ? t.split(/\s+/).length : 0;
  }

  // blokken waarvan we bijhouden of ze al in beeld zijn geweest
  var BLOCKS = ".chapter-banner, .intro h1, .intro .lead, .chapter-cards, .prose p, .figure, .callout-legend li, " +
    ".stat-row, .body-type, .engine-type, .material-bar, .mb-legend, .process-line li, .conclusie-inner, " +
    ".bronnen-section h2, .bronlijst li, .animation-section";

  function absRect(el) {
    var r = el.getBoundingClientRect();
    return { top: r.top + window.scrollY, bottom: r.bottom + window.scrollY };
  }

  // bereken de stops (scrollposities) per onderdeel van de pagina
  function pagesFor(section) {
    var nav = navHeight();
    var view = window.innerHeight - nav;
    var box = absRect(section);
    var blocks = Array.prototype.slice.call(section.querySelectorAll(BLOCKS)).filter(function (b) {
      return b.offsetParent !== null;
    });
    var pages = [];
    var pos = box.top - nav;
    var guard = 0;
    while (guard++ < 40) {
      pages.push(pos);
      var bottom = pos + nav + view;
      if (box.bottom <= bottom + 4) break;
      var next = null;
      blocks.forEach(function (b) {
        var r = absRect(b);
        if (r.bottom > bottom + 2 && r.top > pos + nav + 4) {
          var y = r.top - nav - 18;
          if (next === null || y < next) next = y;
        }
      });
      if (next === null || next <= pos + 40) next = pos + view * 0.85;
      // laatste stuk: niet verder dan nodig om de onderkant van de sectie te laten zien
      next = Math.min(next, box.bottom - window.innerHeight);
      if (next <= pos + 40) break;
      pos = next;
    }
    return pages.map(function (y) {
      return Math.max(0, Math.min(y, maxScroll()));
    });
  }

  function newWordsInView(section, seen) {
    var nav = navHeight();
    var top = window.scrollY + nav;
    var bottom = window.scrollY + window.innerHeight;
    var count = 0;
    section.querySelectorAll(BLOCKS).forEach(function (b) {
      if (seen.has(b) || b.offsetParent === null) return;
      var r = absRect(b);
      if (r.top >= top - 4 && r.bottom <= bottom + 4) {
        seen.add(b);
        if (!b.classList.contains("chapter-banner")) count += words(b);
      }
    });
    return count;
  }

  function readMs(n, section) {
    var sec = BASE_SECONDS + n / WORDS_PER_SECOND;
    var max = section.id === "bronnen" ? SOURCES_MAX_SECONDS : MAX_SECONDS;
    return Math.round(Math.max(MIN_SECONDS, Math.min(max, sec)) * 1000);
  }

  function sectionLabel(section) {
    var h = section.querySelector("h1, h2");
    return h ? h.textContent.replace(/\s+/g, " ").trim() : "";
  }

  function waitForBuild(token) {
    return new Promise(function (resolve, reject) {
      if (!use3D) {
        resolve();
        return;
      }
      var finished = false;
      var finish = function () {
        if (finished) return;
        finished = true;
        if (tourActive && token === tourToken) resolve();
        else reject(new Stopped());
      };
      onBuildDone(function () {
        window.setTimeout(finish, 3000);
      });
      window.setTimeout(finish, 60000);
      // pijltje rechts werkt ook hier
      skipWait = function () {
        skipWait = null;
        finish();
      };
    });
  }

  async function tour(token) {
    try {
      while (true) {
        // 1. bovenaan: animatie opnieuw en wachten tot de auto af is
        await scrollToY(0, 1600, token);
        check(token);
        buildDoneWaiters = [];
        playAnimation();
        if (tourPanel) tourPanel.hidden = true;
        await waitForBuild(token);
        check(token);

        // 2. alle onderdelen, scherm voor scherm
        var sections = Array.prototype.slice.call(document.querySelectorAll("#animatie, main .intro, main .chapter, main .bronnen-section")).filter(function (el) {
          return !el.hidden && el.offsetParent !== null;
        });
        var stops = [];
        sections.forEach(function (section) {
          pagesFor(section).forEach(function (y, i) {
            stops.push({ section: section, y: y, first: i === 0 });
          });
        });
        var seen = new Set();
        for (var i = 0; i < stops.length; i++) {
          var stop = stops[i];
          if (tourCount) tourCount.textContent = "";
          if (tourBar) tourBar.style.strokeDashoffset = "0";
          if (tourPanel) tourPanel.setAttribute("data-stop", String(i));
          await scrollToY(stop.y, 1500, token);
          check(token);
          var n = newWordsInView(stop.section, seen);
          var isBanner = stop.first && stop.section.classList.contains("chapter") && !stop.section.classList.contains("chapter-conclusie");
          var ms = isBanner && n < 25 ? BANNER_SECONDS * 1000 : readMs(n, stop.section);
          var result = await countdown(ms, sectionLabel(stop.section), token);
          if (result === "back") i = Math.max(-1, i - 2);
        }

        // 3. onderaan even blijven staan en dan opnieuw
        await countdown(4000, "Terug naar het begin", token);
      }
    } catch (e) {
      if (!(e instanceof Stopped)) throw e;
    }
  }

  function setAutoScroll(on) {
    tourActive = on;
    tourToken++;
    if (skipWait) skipWait(false);
    document.body.classList.toggle("touring", on);
    // tijdens de rondleiding scrollen we zelf; de CSS smooth-scroll zou elke stap vertragen
    document.documentElement.style.scrollBehavior = on ? "auto" : "";
    if (on) {
      showAutoScrollMessage("Rondleiding aan — W stopt, → volgende, ← terug");
      tour(tourToken);
    } else {
      if (tourPanel) tourPanel.hidden = true;
      showAutoScrollMessage("Rondleiding uit");
    }
  }

  document.addEventListener("keydown", function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var key = e.key ? e.key.toLowerCase() : "";
    if (key === "w") {
      setAutoScroll(!tourActive);
    } else if (tourActive && (key === "arrowright" || key === " " || key === "pagedown")) {
      e.preventDefault();
      if (skipWait) skipWait(false);
    } else if (tourActive && (key === "arrowleft" || key === "pageup")) {
      e.preventDefault();
      if (skipWait) skipWait(true);
    }
  });
})();
