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
    var animSection = document.getElementById("animatie");
    if (animSection) animSection.hidden = false;
    var animLink = document.querySelector('.site-nav a[href="#factoryHero"]');
    if (animLink) animLink.setAttribute("href", "#animatie");
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
    }
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

  // Secties rustig laten verschijnen bij scrollen
  var sections = document.querySelectorAll("main .section");
  if ("IntersectionObserver" in window && sections.length) {
    var sectionObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("reveal");
            sectionObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -60px 0px" }
    );
    sections.forEach(function (section) {
      sectionObserver.observe(section);
    });
  } else {
    sections.forEach(function (section) {
      section.classList.add("reveal");
    });
  }

  // Actieve link in de navigatie bijhouden
  var navLinks = document.querySelectorAll(".site-nav a");
  var trackedSections = document.querySelectorAll("main .section[id]");
  if ("IntersectionObserver" in window && navLinks.length && trackedSections.length) {
    var navObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var id = entry.target.getAttribute("id");
            navLinks.forEach(function (link) {
              link.classList.toggle("active", link.getAttribute("href") === "#" + id);
            });
          }
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    trackedSections.forEach(function (section) {
      navObserver.observe(section);
    });
  }

  // Knop "naar boven"
  var toTop = document.getElementById("toTop");
  if (toTop) {
    window.addEventListener("scroll", function () {
      toTop.classList.toggle("visible", window.scrollY > 500);
    });
    toTop.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // Rondleiding voor onbemande presentatie (markt/beamer): W zet hem aan/uit.
  // Bovenaan wacht hij tot de auto klaar is, daarna scrolt hij van kopje naar kopje
  // en blijft hij bij elk kopje staan zodat mensen kunnen lezen. Lange stukken
  // tekst loopt hij rustig door. Onderaan gaat hij terug naar boven en begint de
  // animatie opnieuw.
  var autoScrollIndicator = document.getElementById("autoScrollIndicator");
  var autoScrollText = document.getElementById("autoScrollText");
  var tourTimer = document.getElementById("tourTimer");
  var siteNav = document.getElementById("siteNav");
  var tourActive = false;
  var tourToken = 0;
  var indicatorHideTimer = null;

  var READ_MIN = 6; // seconden
  var READ_MAX = 15;
  var WORDS_PER_SECOND = 4.5;
  var READ_SCROLL_SPEED = 38; // px per seconde door lange secties heen

  function showAutoScrollMessage(text) {
    if (!autoScrollIndicator || !autoScrollText) return;
    autoScrollText.textContent = text;
    autoScrollIndicator.classList.add("show");
    window.clearTimeout(indicatorHideTimer);
    indicatorHideTimer = window.setTimeout(function () {
      autoScrollIndicator.classList.remove("show");
    }, 2600);
  }

  function stillRunning(token) {
    return tourActive && token === tourToken;
  }

  function wait(ms, token) {
    return new Promise(function (resolve, reject) {
      window.setTimeout(function () {
        if (stillRunning(token)) resolve();
        else reject("stopped");
      }, ms);
    });
  }

  // Eigen scrollanimatie met een kommagetal als positie: stapjes kleiner dan
  // één pixel gaan zo niet verloren (dat liet de oude versie vastlopen).
  function scrollToY(target, duration, token, linear) {
    return new Promise(function (resolve, reject) {
      var from = null;
      var to = 0;
      var start = null;
      function step(ts) {
        if (!stillRunning(token)) {
          reject("stopped");
          return;
        }
        if (start === null) {
          // eventuele lopende (soepele) scroll stoppen en pas nu het startpunt bepalen
          try {
            window.scrollTo({ top: window.scrollY, behavior: "instant" });
          } catch (e) {
            window.scrollTo(0, window.scrollY);
          }
          from = window.scrollY;
          var maxScroll = document.documentElement.scrollHeight - window.innerHeight;
          to = Math.max(0, Math.min(target, maxScroll));
          start = ts;
        }
        var k = Math.abs(to - from) < 2 ? 1 : Math.min(1, (ts - start) / duration);
        var e = linear ? k : k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        window.scrollTo(0, from + (to - from) * e);
        if (k < 1) window.requestAnimationFrame(step);
        else resolve();
      }
      window.requestAnimationFrame(step);
    });
  }

  function runTimerBar(ms) {
    if (!tourTimer) return;
    tourTimer.style.transition = "none";
    tourTimer.style.width = "0%";
    tourTimer.classList.add("show");
    void tourTimer.offsetWidth;
    tourTimer.style.transition = "width " + ms + "ms linear";
    tourTimer.style.width = "100%";
  }

  function hideTimerBar() {
    if (!tourTimer) return;
    tourTimer.classList.remove("show");
    tourTimer.style.transition = "none";
    tourTimer.style.width = "0%";
  }

  function readingTime(el) {
    var words = (el.textContent || "").trim().split(/\s+/).length;
    return Math.max(READ_MIN, Math.min(READ_MAX, 3 + words / WORDS_PER_SECOND)) * 1000;
  }

  function sectionTop(el) {
    var navH = siteNav ? siteNav.offsetHeight : 0;
    return el.getBoundingClientRect().top + window.scrollY - navH - 14;
  }

  function waitForBuild(token) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var finish = function () {
        if (done) return;
        done = true;
        if (stillRunning(token)) resolve();
        else reject("stopped");
      };
      onBuildDone(function () {
        window.setTimeout(finish, 3000);
      });
      window.setTimeout(finish, 60000);
    });
  }

  function tour(token) {
    var stops = Array.prototype.slice.call(document.querySelectorAll("main .section")).filter(function (el) {
      return !el.hidden;
    });
    var chain = scrollToY(0, 1600, token)
      .then(function () {
        buildDoneWaiters = [];
        playAnimation();
        return waitForBuild(token);
      });
    stops.forEach(function (el) {
      chain = chain
        .then(function () {
          el.classList.add("reveal");
          return scrollToY(sectionTop(el), 1800, token);
        })
        .then(function () {
          var ms = readingTime(el);
          runTimerBar(ms);
          return wait(ms, token);
        })
        .then(function () {
          hideTimerBar();
          // lange sectie: rustig doorlezen tot de onderkant in beeld is
          var bottom = el.getBoundingClientRect().bottom + window.scrollY - window.innerHeight + 30;
          var distance = bottom - window.scrollY;
          if (distance > 40) {
            return scrollToY(bottom, (distance / READ_SCROLL_SPEED) * 1000, token, true).then(function () {
              return wait(1500, token);
            });
          }
        });
    });
    chain
      .then(function () {
        return scrollToY(document.documentElement.scrollHeight, 1500, token);
      })
      .then(function () {
        return wait(3000, token);
      })
      .then(function () {
        if (stillRunning(token)) tour(token);
      })
      .catch(function () {
        hideTimerBar();
      });
  }

  function setAutoScroll(on) {
    tourActive = on;
    tourToken++;
    hideTimerBar();
    // tijdens de rondleiding scrollen we zelf; de CSS smooth-scroll zou elke stap vertragen
    document.documentElement.style.scrollBehavior = on ? "auto" : "";
    if (on) {
      showAutoScrollMessage("Rondleiding aan — druk op W om te stoppen");
      tour(tourToken);
    } else {
      showAutoScrollMessage("Rondleiding uit");
    }
  }

  document.addEventListener("keydown", function (e) {
    var key = e.key ? e.key.toLowerCase() : "";
    if (key === "w" && !e.ctrlKey && !e.metaKey && !e.altKey) {
      setAutoScroll(!tourActive);
    }
  });
})();
