(function () {
  var svg = document.getElementById("carSvg");
  var replayBtn = document.getElementById("replayBtn");
  var stage = document.getElementById("carStage");

  var order = [
    "part-chassis",
    "part-engine",
    "part-wheel-left",
    "part-wheel-right",
    "part-body",
    "part-windows"
  ];

  var stepDelay = 450; // ms between onderdelen
  var timers = [];

  function clearTimers() {
    timers.forEach(function (t) {
      window.clearTimeout(t);
    });
    timers = [];
  }

  function playAnimation() {
    clearTimers();
    svg.classList.remove("done");
    svg.classList.add("play");

    order.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.classList.remove("in");
    });

    order.forEach(function (id, index) {
      var timer = window.setTimeout(function () {
        var el = document.getElementById(id);
        if (el) el.classList.add("in");
      }, index * stepDelay);
      timers.push(timer);
    });

    var doneTimer = window.setTimeout(function () {
      svg.classList.add("done");
    }, order.length * stepDelay + 600);
    timers.push(doneTimer);
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
