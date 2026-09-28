(function () {
  var svg = document.getElementById("carSvg");
  var replayBtn = document.getElementById("replayBtn");
  var stage = document.getElementById("carStage");
  var factoryStage = document.getElementById("factoryStage");
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
    if (factoryStage) factoryStage.hidden = true;
    stage.hidden = false;
    playAnimation();
  }

  if (factoryStage && window.Car3D) {
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
    } else {
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

  var played = false;
  var animTarget = use3D ? factoryStage : stage;
  if ("IntersectionObserver" in window && animTarget) {
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
    carObserver.observe(animTarget);
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

  // Auto-scroll voor onbemande presentatie (markt/beamer): W toggelt aan/uit.
  // Scrolt rustig naar beneden; onderaan gaat hij terug naar boven, bouwt de
  // auto opnieuw en wacht tot die af is voordat hij weer gaat scrollen.
  var autoScrollIndicator = document.getElementById("autoScrollIndicator");
  var autoScrollText = document.getElementById("autoScrollText");
  var autoScrollActive = false;
  var autoScrollRAF = null;
  var autoScrollLastTs = null;
  var autoScrollGen = 0;
  var indicatorHideTimer = null;
  var PX_PER_SECOND = 42;

  function showAutoScrollMessage(text) {
    if (!autoScrollIndicator || !autoScrollText) return;
    autoScrollText.textContent = text;
    autoScrollIndicator.classList.add("show");
    window.clearTimeout(indicatorHideTimer);
    indicatorHideTimer = window.setTimeout(function () {
      autoScrollIndicator.classList.remove("show");
    }, 2600);
  }

  function startScrolling(gen) {
    if (!autoScrollActive || gen !== autoScrollGen) return;
    if (autoScrollRAF) window.cancelAnimationFrame(autoScrollRAF);
    autoScrollLastTs = null;
    autoScrollRAF = window.requestAnimationFrame(autoScrollTick);
  }

  function restartFromTop(gen) {
    if (!autoScrollActive || gen !== autoScrollGen) return;
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    buildDoneWaiters = [];
    playAnimation();
    var resumed = false;
    var resume = function () {
      if (resumed) return;
      resumed = true;
      startScrolling(gen);
    };
    onBuildDone(function () {
      window.setTimeout(resume, 3000);
    });
    window.setTimeout(resume, 45000);
  }

  function autoScrollTick(ts) {
    autoScrollRAF = null;
    if (!autoScrollActive) return;
    if (autoScrollLastTs === null) autoScrollLastTs = ts;
    var dt = ts - autoScrollLastTs;
    autoScrollLastTs = ts;
    var maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    var next = window.scrollY + (PX_PER_SECOND * dt) / 1000;

    if (maxScroll <= 0 || next >= maxScroll - 1) {
      window.scrollTo({ top: Math.max(maxScroll, 0), left: 0, behavior: "instant" });
      var gen = autoScrollGen;
      window.setTimeout(function () {
        restartFromTop(gen);
      }, 2200);
      return;
    }

    window.scrollTo({ top: next, left: 0, behavior: "instant" });
    autoScrollRAF = window.requestAnimationFrame(autoScrollTick);
  }

  function setAutoScroll(on) {
    autoScrollActive = on;
    autoScrollGen++;
    if (autoScrollRAF) window.cancelAnimationFrame(autoScrollRAF);
    autoScrollRAF = null;
    if (on) {
      showAutoScrollMessage("Auto-scroll aan — druk op W om te stoppen");
      startScrolling(autoScrollGen);
    } else {
      showAutoScrollMessage("Auto-scroll uit");
    }
  }

  document.addEventListener("keydown", function (e) {
    var key = e.key ? e.key.toLowerCase() : "";
    if (key === "w" && !e.ctrlKey && !e.metaKey && !e.altKey) {
      setAutoScroll(!autoScrollActive);
    }
  });
})();
