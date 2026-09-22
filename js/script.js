(function () {
  var svg = document.getElementById("carSvg");
  var replayBtn = document.getElementById("replayBtn");
  var stage = document.getElementById("carStage");
  var robotArm = document.getElementById("robotArm");
  var sparkBurst = document.getElementById("sparkBurst");
  var doneBadge = document.getElementById("doneBadge");
  var stepLabel = document.getElementById("stepLabel");
  var dots = document.querySelectorAll("#progressDots .dot");

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

  function playAnimation() {
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
    });
  }

  var played = false;
  if ("IntersectionObserver" in window && stage) {
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
})();
