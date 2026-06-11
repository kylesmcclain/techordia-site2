/* Techordia — site interactions (nav, reveal-on-scroll, year, contact form) */
(function () {
  "use strict";

  // color mode
  var themeKey = "techordia-theme";
  var root = document.documentElement;
  var themeButton = null;
  var savedTheme = null;
  try {
    savedTheme = window.localStorage.getItem(themeKey);
  } catch (err) {
    savedTheme = null;
  }
  var activeTheme = savedTheme === "light" || savedTheme === "dark" ? savedTheme : "dark";
  function applyTheme(theme) {
    activeTheme = theme;
    root.setAttribute("data-theme", theme);
    if (themeButton) {
      var next = theme === "light" ? "dark" : "light";
      themeButton.setAttribute("aria-label", "Switch to " + next + " mode");
      themeButton.setAttribute("title", "Switch to " + next + " mode");
      themeButton.setAttribute("aria-pressed", String(theme === "light"));
    }
  }
  applyTheme(activeTheme);

  var headerRow = document.querySelector(".masthead__row");
  var navToggle = document.querySelector(".navtoggle");
  if (headerRow) {
    themeButton = document.createElement("button");
    themeButton.type = "button";
    themeButton.className = "theme-toggle";
    themeButton.innerHTML = '<span class="theme-toggle__sun" aria-hidden="true"></span><span class="theme-toggle__moon" aria-hidden="true"></span>';
    themeButton.addEventListener("click", function () {
      var nextTheme = activeTheme === "light" ? "dark" : "light";
      applyTheme(nextTheme);
      try {
        window.localStorage.setItem(themeKey, nextTheme);
      } catch (err) {}
    });
    headerRow.insertBefore(themeButton, navToggle || null);
    applyTheme(activeTheme);
  }

  // mobile nav
  var toggle = navToggle;
  var nav = document.querySelector(".mainnav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
    });
  }

  // services dropdown: click/touch + keyboard support (hover still works on desktop)
  var svcItem = document.querySelector(".mainnav .navitem");
  var svcBtn = svcItem && svcItem.querySelector("button");
  if (svcItem && svcBtn) {
    var openSvc = function () { svcItem.classList.add("is-open"); svcBtn.setAttribute("aria-expanded", "true"); };
    var closeSvc = function () { svcItem.classList.remove("is-open"); svcBtn.setAttribute("aria-expanded", "false"); };
    svcBtn.addEventListener("click", function (e) {
      e.preventDefault();
      if (svcItem.classList.contains("is-open")) { closeSvc(); } else { openSvc(); }
    });
    document.addEventListener("click", function (e) {
      if (svcItem.classList.contains("is-open") && !svcItem.contains(e.target)) { closeSvc(); }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && svcItem.classList.contains("is-open")) { closeSvc(); svcBtn.focus(); }
    });
    svcItem.addEventListener("focusout", function (e) {
      if (!svcItem.contains(e.relatedTarget)) { closeSvc(); }
    });
    // close the menu (and the mobile nav) when a service link is chosen,
    // so same-page anchor jumps don't leave the menu hanging open
    svcItem.querySelectorAll(".dropdown a").forEach(function (a) {
      a.addEventListener("click", function () {
        closeSvc();
        if (nav && nav.classList.contains("is-open")) {
          nav.classList.remove("is-open");
          if (toggle) { toggle.setAttribute("aria-expanded", "false"); }
        }
      });
    });
  }

  // reveal on scroll
  var items = document.querySelectorAll(".reveal");
  var showRevealItems = function () {
    items.forEach(function (it) { it.classList.add("in"); });
  };
  if (items.length && typeof window.IntersectionObserver === "function") {
    try {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
        });
      }, { threshold: 0.06, rootMargin: "0px 0px 6% 0px" });
      items.forEach(function (it) { io.observe(it); });
    } catch (err) {
      showRevealItems();
    }
  } else {
    showRevealItems();
  }

  // land cleanly on #anchors from other pages: jump instantly instead of letting
  // the CSS smooth-scroll animate the initial hash, which late layout shifts
  // (fonts, fx canvases) can knock off target
  function jumpToHash() {
    if (!location.hash || location.hash.length < 2) return;
    var target = null;
    try { target = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch (err) { target = null; }
    if (!target) return;
    // show the landing section right away; a deep link shouldn't wait on reveal animations
    if (target.classList.contains("reveal")) { target.classList.add("in"); }
    target.querySelectorAll(".reveal").forEach(function (el) { el.classList.add("in"); });
    target.scrollIntoView({ behavior: "instant", block: "start" });
  }
  jumpToHash();
  window.addEventListener("load", jumpToHash);

  // footer year
  var y = document.getElementById("yr");
  if (y) y.textContent = new Date().getFullYear();

  // reviews carousel (homepage section)
  function wireReviewCarousel() {
    var carousel = document.querySelector("[data-review-carousel]");
    if (!carousel) return;
    var track = carousel.querySelector(".reviews__track");
    var prev = carousel.querySelector(".reviews__arrow--prev");
    var next = carousel.querySelector(".reviews__arrow--next");
    if (!track || !prev || !next) return;
    function step() {
      var card = track.querySelector(".review-card");
      return card ? card.getBoundingClientRect().width + 20 : track.clientWidth;
    }
    prev.addEventListener("click", function () { track.scrollLeft -= step(); });
    next.addEventListener("click", function () { track.scrollLeft += step(); });
  }
  wireReviewCarousel();

  // contact form: submits to Web3Forms (free), which emails kyle.mcclain@techordia.com
  var form = document.getElementById("contact-form");
  if (form) {
    var endpoint = "https://api.web3forms.com/submit";
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var s = document.getElementById("form-status");
      var btn = form.querySelector('button[type="submit"]');
      var honey = form.querySelector('[name="botcheck"]');
      if (honey && honey.checked) { return; } // bot trap
      if (!form.reportValidity()) { return; }
      if (s) { s.style.color = "var(--slate-mute)"; s.textContent = "Sending…"; }
      if (btn) { btn.disabled = true; }
      fetch(endpoint, {
        method: "POST",
        headers: { "Accept": "application/json" },
        body: new FormData(form)
      })
        .then(function (r) { return r.json().catch(function () { return {}; }); })
        .then(function (res) {
          var ok = res && (res.success === true || res.success === "true");
          if (s) {
            s.textContent = ok
              ? "Thanks! Your request is on its way to our team. For the fastest response, call 877-925-4785."
              : "Thanks! We’ve noted your request. If you don’t hear back shortly, please call 877-925-4785.";
            s.style.color = "#10a59e";
          }
          form.reset();
        })
        .catch(function () {
          if (s) {
            s.textContent = "Sorry, we couldn’t send that. Please call 877-925-4785 or email kyle.mcclain@techordia.com.";
            s.style.color = "#e2574c";
          }
        })
        .then(function () { if (btn) { btn.disabled = false; } });
    });
  }
})();
