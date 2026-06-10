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

  // Yelp review drawer and carousel
  var yelpReviewsUrl = "https://www.yelp.com/biz/techordia-alameda";
  var reviewData = [
    {
      initials: "MG",
      tone: "pink",
      name: "Marlene G.",
      meta: "Yelp · Jun 2025",
      quote: "If there were 10 stars I'd give them all. I was locked out of my email for days, and as an attorney that was hugely disruptive. Techordia were immediately available, knowledgeable, and calm under pressure.",
      url: yelpReviewsUrl
    },
    {
      initials: "AB",
      tone: "orange",
      name: "Andy B.",
      meta: "Yelp · Jun 2024",
      quote: "Ben, Wilson and the team have provided outstanding IT services across the 9 years I've worked with them. Anybody looking for a new IT MSP, look no further.",
      url: yelpReviewsUrl
    },
    {
      initials: "KK",
      tone: "purple",
      name: "Kristin K.",
      meta: "Yelp · Jul 2023",
      quote: "We've worked with Techordia for over 5 years. They manage our IT daily and have run multiple large-scale projects. Professional, knowledgeable, and highly recommended.",
      url: yelpReviewsUrl
    },
    {
      initials: "DR",
      tone: "green",
      name: "Darcy R.",
      meta: "Yelp · Jul 2023",
      quote: "Best IT company to work with. Very efficient and knowledgeable, quick to respond, and very friendly. Would highly recommend them.",
      url: yelpReviewsUrl
    },
    {
      initials: "VW",
      tone: "blue",
      name: "Vicki W.",
      meta: "Yelp · Oct 2013",
      quote: "The highest rating for service, professionalism, technical knowledge, and integrity. We've partnered with Techordia since 2010 and have never been disappointed.",
      url: yelpReviewsUrl
    }
  ];
  var googleWordmark = '<span class="google-wordmark yelp-mark" aria-label="Yelp">Yelp</span>';
  var stars = '<span class="google-stars" aria-label="5 out of 5 stars"><span aria-hidden="true">&#9733;&#9733;&#9733;&#9733;&#9733;</span></span>';

  function reviewCardMarkup(item, drawer) {
    var avatar = '<span class="review-avatar review-avatar--' + item.tone + '">' + item.initials + '</span>';
    if (drawer) {
      return '<article class="google-review-drawer__card">' +
        '<div class="google-review-drawer__person">' + avatar +
        '<span><strong>' + item.name + '<span class="review-check" aria-label="Verified source"></span></strong><small>' + item.meta + '</small></span></div>' +
        stars +
        '<p class="google-review-card__quote">' + item.quote + '</p>' +
        '<a class="google-review-card__more" href="' + item.url + '" target="_blank" rel="noopener">Read more</a>' +
        '</article>';
    }
    return "";
  }

  function openReviewDrawer() {
    document.body.classList.add("reviews-open");
    var drawer = document.querySelector(".google-review-drawer");
    if (drawer) drawer.focus();
  }

  function closeReviewDrawer() {
    document.body.classList.remove("reviews-open");
  }

  function mountReviewWidget() {
    if (document.querySelector(".google-float__button")) return;
    var shell = document.createElement("div");
    shell.className = "google-review-widget";
    shell.innerHTML =
      '<button class="google-float__button" type="button" aria-label="Open Techordia Yelp reviews">' +
        googleWordmark +
        '<span class="google-float__rating"><strong>5.0</strong>' + stars + '</span>' +
        '<span class="google-float__count">8 reviews</span>' +
      '</button>' +
      '<div class="google-review-backdrop" aria-hidden="true"></div>' +
      '<button class="google-review-close" type="button" aria-label="Close reviews">&times;</button>' +
      '<aside class="google-review-drawer" tabindex="-1" aria-label="Techordia reviews panel">' +
        '<div class="google-review-drawer__summary">' +
          '<div class="google-summary__score"><strong>5.0</strong>' + stars + '</div>' +
          '<div class="google-review-drawer__count">8 reviews on ' + googleWordmark + '</div>' +
        '</div>' +
        reviewData.map(function (item) { return reviewCardMarkup(item, true); }).join("") +
      '</aside>';
    document.body.appendChild(shell);

    shell.querySelector(".google-float__button").addEventListener("click", openReviewDrawer);
    shell.querySelector(".google-review-backdrop").addEventListener("click", closeReviewDrawer);
    shell.querySelector(".google-review-close").addEventListener("click", closeReviewDrawer);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeReviewDrawer();
    });
  }

  function wireReviewCarousel() {
    var carousel = document.querySelector("[data-review-carousel]");
    if (!carousel) return;
    var track = carousel.querySelector(".google-review-track");
    var prev = carousel.querySelector(".review-arrow--prev");
    var next = carousel.querySelector(".review-arrow--next");
    if (!track || !prev || !next) return;
    function step() {
      var card = track.querySelector(".google-review-card");
      return card ? card.getBoundingClientRect().width + 20 : track.clientWidth;
    }
    prev.addEventListener("click", function () { track.scrollLeft -= step(); });
    next.addEventListener("click", function () { track.scrollLeft += step(); });
  }

  function wireReviewSectionVisibility() {
    var section = document.querySelector(".google-review-section");
    if (!section || typeof window.IntersectionObserver !== "function") return;
    var sectionObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        document.body.classList.toggle("review-section-active", entry.isIntersecting);
      });
    }, { threshold: 0.12 });
    sectionObserver.observe(section);
  }

  mountReviewWidget();
  wireReviewCarousel();
  wireReviewSectionVisibility();

  // contact form: submits to Web3Forms (free), which emails kyle.mcclain@techordia.com
  var form = document.getElementById("review-form");
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
