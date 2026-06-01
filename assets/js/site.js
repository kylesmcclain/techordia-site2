/* Techordia — site interactions (nav, reveal-on-scroll, year, contact form) */
(function () {
  "use strict";

  // mobile nav
  var toggle = document.querySelector(".navtoggle");
  var nav = document.querySelector(".mainnav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
    });
  }

  // reveal on scroll
  var items = document.querySelectorAll(".reveal");
  if (items.length && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.16, rootMargin: "0px 0px -8% 0px" });
    items.forEach(function (it) { io.observe(it); });
  } else {
    items.forEach(function (it) { it.classList.add("in"); });
  }

  // footer year
  var y = document.getElementById("yr");
  if (y) y.textContent = new Date().getFullYear();

  // contact form (front-end only on GitHub Pages)
  var form = document.getElementById("review-form");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var s = document.getElementById("form-status");
      if (s) {
        s.textContent = "Thanks — we’ve noted your request. For the fastest response, call 877-925-4785 to lock in your IT Risk & Reliability Review.";
        s.style.color = "#10a59e";
      }
      form.reset();
    });
  }
})();
