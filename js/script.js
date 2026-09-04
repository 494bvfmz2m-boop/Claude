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
  }

  var played = false;
  if ("IntersectionObserver" in window && stage) {
    var observer = new IntersectionObserver(
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
    observer.observe(stage);
  } else {
    playAnimation();
  }

  if (replayBtn) {
    replayBtn.addEventListener("click", playAnimation);
  }
})();
