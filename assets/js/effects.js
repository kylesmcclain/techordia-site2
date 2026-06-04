/* =========================================================================
   Techordia effect engine — ONE system, several layout modes.
   Renders inline SVG into [data-fx] containers and wires parallax + hover.
   Modes: globe | network | ownership | lanes | layers | timeline | selector | framework
   ========================================================================= */
(function () {
  "use strict";
  var SVGNS = "http://www.w3.org/2000/svg";
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function el(tag, attrs, kids) {
    var n = document.createElementNS(SVGNS, tag);
    if (attrs) for (var k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    if (kids) (Array.isArray(kids) ? kids : [kids]).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function txt(x, y, s, cls, anchor) {
    var t = el("text", { x: x, y: y, class: cls, "text-anchor": anchor || "middle" });
    t.textContent = s; return t;
  }
  // deterministic pseudo-random so layouts are stable across reloads
  var seed = 9;
  function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }

  /* ---- shared gradient / filter defs injected once ---- */
  function injectDefs() {
    if (document.getElementById("fx-defs")) return;
    var s = el("svg", { id: "fx-defs", width: 0, height: 0, "aria-hidden": "true",
      style: "position:absolute;width:0;height:0;overflow:hidden" });
    var defs = el("defs");
    function lin(id, stops, x2, y2) {
      var g = el("linearGradient", { id: id, x1: "0", y1: "0", x2: x2 || "1", y2: y2 || "1" });
      stops.forEach(function (st) { g.appendChild(el("stop", { offset: st[0], "stop-color": st[1], "stop-opacity": st[2] != null ? st[2] : 1 })); });
      return g;
    }
    defs.appendChild(lin("fxEdge", [["0", "#2f7bf6", .8], ["1", "#18c6c2", .8]]));
    defs.appendChild(lin("fxFlow", [["0", "#6fb6ff"], ["1", "#6fe3da"]]));
    defs.appendChild(lin("fxNode", [["0", "#2f7bf6"], ["1", "#18c6c2"]]));
    defs.appendChild(lin("fxHub", [["0", "#3f8bff"], ["1", "#23d3c9"]]));
    var rg = el("radialGradient", { id: "fxHalo" });
    rg.appendChild(el("stop", { offset: "0", "stop-color": "#23d3c9", "stop-opacity": ".55" }));
    rg.appendChild(el("stop", { offset: "1", "stop-color": "#23d3c9", "stop-opacity": "0" }));
    defs.appendChild(rg);
    s.appendChild(defs);
    document.body.appendChild(s);
  }

  /* ---- node factory (nested groups: parallax > placement > bob) ---- */
  function node(opt) {
    var depth = opt.depth || 2;
    var wrap = el("g", { class: "fx-wrap", "data-depth": depth });
    var pos = el("g", { transform: "translate(" + opt.x + " " + opt.y + ")" });
    var bob = el("g", { class: reduce ? "" : "fx-bob" });
    if (!reduce) {
      bob.style.setProperty("--dur", (5.5 + rnd() * 4).toFixed(2) + "s");
      bob.style.setProperty("--del", (-rnd() * 5).toFixed(2) + "s");
      bob.style.setProperty("--amp", (-(4 + rnd() * 5)).toFixed(1) + "px");
    }
    var g = el("g", { class: "fx-node" + (opt.hub ? " fx-hub" : ""), tabindex: opt.label ? "0" : null,
      role: opt.label ? "img" : null, "aria-label": opt.label || null });
    var r = opt.r || (opt.hub ? 34 : 20);
    g.appendChild(el("circle", { class: "fx-halo", r: r * (opt.hub ? 2.4 : 2) }));
    g.appendChild(el("circle", { class: "fx-dot" + (opt.accent || opt.hub ? " fx-dot--accent" : ""), r: r }));
    if (opt.glyph) {
      var ic = document.createElementNS(SVGNS, "path");
      ic.setAttribute("d", opt.glyph);
      ic.setAttribute("class", "fx-glyph" + (opt.hub ? " fx-glyph--hub" : ""));
      ic.setAttribute("fill", "currentColor");
      ic.setAttribute("transform", "translate(-12 -12) scale(1)");
      g.appendChild(ic);
    }
    if (opt.label) g.appendChild(txt(0, r + 20, opt.label, "fx-label"));
    if (opt.sub) g.appendChild(txt(0, r + 35, opt.sub, "fx-sub"));
    bob.appendChild(g); pos.appendChild(bob); wrap.appendChild(pos);
    wrap._node = g; wrap._cx = opt.x; wrap._cy = opt.y; wrap.id = opt.id ? "n-" + opt.id : null;
    return wrap;
  }
  function edge(x1, y1, x2, y2, flow, soft) {
    var mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    var d = "M" + x1 + " " + y1 + " Q " + mx + " " + (my - 14) + " " + x2 + " " + y2;
    var frag = document.createDocumentFragment();
    var base = el("path", { class: "fx-edge" + (soft ? " fx-edge--soft" : ""), d: d });
    frag.appendChild(base);
    var fl = null;
    if (flow && !reduce) { fl = el("path", { class: "fx-flow", d: d }); fl.style.animationDelay = (-rnd() * 3).toFixed(2) + "s"; frag.appendChild(fl); }
    return { frag: frag, base: base, flow: fl, d: d };
  }
  var ICON = {
    support: "M12 2a7 7 0 0 0-7 7v3a3 3 0 0 0 3 3h1v-7H7V9a5 5 0 0 1 10 0v0h-2v7h2a3 3 0 0 0 3-3V9a7 7 0 0 0-7-7Z",
    m365: "M3 5l9-3v20l-9-3V5Zm10 .5L21 4v16l-8-1.5V5.5Z",
    device: "M3 4h18v12H3V4Zm-1 14h22v2H2v-2Z",
    shield: "M12 2 4 5v6c0 5 3.4 8.9 8 10 4.6-1.1 8-5 8-10V5l-8-3Z",
    backup: "M12 3a9 9 0 1 0 9 9h-2a7 7 0 1 1-2-4.9V10h5V3l-2.3 2.3A9 9 0 0 0 12 3Z",
    vendor: "M4 7h16v3H4V7Zm0 5h7v6H4v-6Zm9 0h7v6h-7v-6ZM2 4h20v2H2V4Z",
    project: "M4 4h7v7H4V4Zm9 0h7v4h-7V4Zm0 6h7v10h-7V10Zm-9 3h7v7H4v-7Z",
    user: "M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-5 0-9 2.5-9 6v2h18v-2c0-3.5-4-6-9-6Z",
    hub: "M12 2 3 7v10l9 5 9-5V7l-9-5Zm0 4.2L17 9v6l-5 2.8L7 15V9l5-2.8Z",
    lock: "M6 10V8a6 6 0 1 1 12 0v2h1v12H5V10h1Zm2 0h8V8a4 4 0 1 0-8 0v2Z",
    mail: "M3 5h18v14H3V5Zm2 2v.4l7 4.6 7-4.6V7H5Zm14 3-7 4.6L5 10v7h14v-7Z"
  };

  function build(box) {
    var mode = box.getAttribute("data-fx");
    var svg, vb;
    function mk(w, h) { vb = [w, h]; svg = el("svg", { viewBox: "0 0 " + w + " " + h, role: "img", "aria-label": box.getAttribute("data-label") || "Techordia operating network" }); box.appendChild(svg); return svg; }

    if (mode === "globe") { buildGlobe(box); return; }

    if (mode === "network" || mode === "ownership") {
      mk(560, 560);
      var cx = 280, cy = 284, R = 196;
      var domains = (mode === "ownership"
        ? [["user", "Users", ICON.user], ["device", "Devices", ICON.device], ["m365", "Microsoft 365", ICON.m365],
           ["shield", "Security", ICON.shield], ["backup", "Backups", ICON.backup], ["vendor", "Vendors", ICON.vendor],
           ["support", "Support", ICON.support]]
        : [["support", "Support", ICON.support], ["m365", "Microsoft 365", ICON.m365], ["device", "Devices", ICON.device],
           ["shield", "Security", ICON.shield], ["backup", "Backups", ICON.backup], ["vendor", "Vendors", ICON.vendor],
           ["project", "Projects", ICON.project]]);
      var n = domains.length, start = -Math.PI / 2;
      if (mode === "ownership") { // managed boundary ring + pulses
        svg.appendChild(el("circle", { cx: cx, cy: cy, r: R + 34, class: "fx-ring", "stroke-dasharray": "2 7" }));
        if (!reduce) for (var p = 0; p < 2; p++) { var pr = el("circle", { cx: cx, cy: cy, r: 60, class: "fx-pulse" }); pr.style.animationDelay = (p * 1.7) + "s"; svg.appendChild(pr); }
        svg.appendChild(txt(cx, cy - R - 46, "MANAGED BY TECHORDIA", "fx-cap"));
      }
      var hub = node({ x: cx, y: cy, hub: true, r: 36, glyph: ICON.hub, label: mode === "network" ? "TECHORDIA" : "Techordia", sub: mode === "network" ? "" : "IT operating center", depth: 1, id: "hub" });
      var nodes = [], edges = [];
      for (var i = 0; i < n; i++) {
        var a = start + (i / n) * Math.PI * 2;
        var x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
        var e = edge(cx, cy, x, y, true, false); svg.appendChild(e.frag);
        var nd = node({ x: x, y: y, r: 19, glyph: domains[i][2], label: domains[i][1], depth: 2 + (i % 3), id: domains[i][0] });
        nodes.push(nd); edges.push(e.base);
        nd._edge = e.base; nd._flow = e.flow;
      }
      svg.appendChild(hub);
      nodes.forEach(function (nd) { svg.appendChild(nd); });
      wireHover(box, svg, hub, nodes);
    }

    else if (mode === "lanes") {
      mk(880, 540);
      var midX = 440, lx = 150, rx = 730, ys = [150, 270, 390];
      svg.appendChild(el("line", { x1: midX, y1: 70, x2: midX, y2: 470, class: "fx-ring", "stroke-dasharray": "2 8" }));
      svg.appendChild(txt(lx, 96, "YOUR INTERNAL IT", "fx-cap"));
      svg.appendChild(txt(rx, 96, "TECHORDIA", "fx-cap"));
      svg.appendChild(txt(midX, 60, "SHARED VISIBILITY & ESCALATION", "fx-cap"));
      var midNode = node({ x: midX, y: 270, hub: true, r: 30, glyph: ICON.hub, label: "Shared layer", sub: "tickets · reporting · roadmap", depth: 1 });
      var leftLabels = [["Day-to-day requests", ICON.user], ["Local knowledge", ICON.device], ["Business context", ICON.project]];
      var rightLabels = [["Monitoring & patching", ICON.support], ["Security & backup", ICON.shield], ["Escalation & projects", ICON.m365]];
      var paths = [];
      for (var j = 0; j < 3; j++) {
        var L = node({ x: lx, y: ys[j], r: 17, glyph: leftLabels[j][1], label: leftLabels[j][0], depth: 2 + j });
        var Rn = node({ x: rx, y: ys[j], r: 17, glyph: rightLabels[j][1], label: rightLabels[j][0], depth: 2 + j });
        var e1 = edge(lx + 22, ys[j], midX - 26, 270, false, true);
        var e2 = edge(midX + 26, 270, rx - 22, ys[j], false, true);
        svg.appendChild(e1.frag); svg.appendChild(e2.frag);
        paths.push(e1.d, e2.d);
        svg.appendChild(L); svg.appendChild(Rn);
      }
      svg.appendChild(midNode);
      if (!reduce) paths.forEach(function (d, idx) {
        for (var k = 0; k < 2; k++) {
          var c = el("circle", { class: "fx-packet" });
          c.style.offsetPath = "path('" + d + "')";
          c.style.setProperty("--pdur", (3.6 + (idx % 2) * 1.2) + "s");
          c.style.setProperty("--pdel", (idx * .5 + k * 1.8) + "s");
          svg.appendChild(c);
        }
      });
    }

    else if (mode === "layers") {
      mk(560, 560);
      var ccx = 280, ccy = 284;
      var rings = [["Access", 210], ["Email", 168], ["Endpoint", 126], ["Identity", 84]];
      rings.forEach(function (rg, idx) {
        svg.appendChild(el("circle", { cx: ccx, cy: ccy, r: rg[1], class: "fx-ring", "stroke-opacity": .9 - idx * .12 }));
        svg.appendChild(txt(ccx, ccy - rg[1] + 17, rg[0].toUpperCase(), "fx-cap"));
      });
      // radar sweep
      if (!reduce) {
        var sweep = el("g", { class: "fx-radar" });
        var grad = el("linearGradient", { id: "fxSweep", x1: "0", y1: "0", x2: "1", y2: "0" });
        grad.appendChild(el("stop", { offset: "0", "stop-color": "#58e0d6", "stop-opacity": ".0" }));
        grad.appendChild(el("stop", { offset: "1", "stop-color": "#58e0d6", "stop-opacity": ".22" }));
        svg.appendChild(el("defs", null, grad));
        sweep.appendChild(el("path", { d: "M" + ccx + " " + ccy + " L" + (ccx + 212) + " " + ccy + " A212 212 0 0 1 " + (ccx + 150) + " " + (ccy + 150) + " Z", fill: "url(#fxSweep)" }));
        sweep.appendChild(el("line", { x1: ccx, y1: ccy, x2: ccx + 212, y2: ccy, class: "fx-scanline" }));
        svg.appendChild(sweep);
      }
      // controls on rings
      var ctrls = [["Identity", ICON.lock, 84, -90], ["Endpoint", ICON.device, 126, 20], ["Email", ICON.mail, 168, 135], ["Access", ICON.user, 210, 220], ["Backup", ICON.backup, 126, 250]];
      var core = node({ x: ccx, y: ccy, hub: true, r: 30, glyph: ICON.shield, label: "Protected core", sub: "your business data", depth: 1 });
      var cnodes = [];
      ctrls.forEach(function (c) {
        var a = c[3] * Math.PI / 180, x = ccx + Math.cos(a) * c[2], y = ccy + Math.sin(a) * c[2];
        var nd = node({ x: x, y: y, r: 16, glyph: c[1], label: c[0], depth: 2 + (cnodes.length % 3) });
        cnodes.push(nd);
      });
      svg.appendChild(core); cnodes.forEach(function (nd) { svg.appendChild(nd); });
    }

    else if (mode === "timeline") {
      mk(900, 420);
      var steps = ["Scope", "Prepare", "Cutover", "Test", "Handoff"];
      var gl = [ICON.project, ICON.support, ICON.m365, ICON.shield, ICON.backup];
      var y = 210, x0 = 110, x1 = 790, span = x1 - x0, len = span;
      svg.appendChild(el("path", { class: "fx-track", d: "M" + x0 + " " + y + " H" + x1 }));
      var prog = el("path", { class: "fx-progress", d: "M" + x0 + " " + y + " H" + x1 });
      prog.style.setProperty("--len", len);
      if (!reduce) svg.appendChild(prog);
      var runner = el("circle", { class: "fx-runner", cx: x0, cy: y });
      if (!reduce) {
        var anim = el("animate", { attributeName: "cx", values: x0 + ";" + x1 + ";" + x1, keyTimes: "0;0.6;1", dur: "5s", repeatCount: "indefinite", calcMode: "spline", keySplines: "0.6 0.05 0.2 1;0 0 1 1" });
        runner.appendChild(anim); svg.appendChild(runner);
      }
      for (var s = 0; s < steps.length; s++) {
        var sx = x0 + (s / (steps.length - 1)) * span;
        var up = s % 2 === 0;
        var ny = up ? y - 78 : y + 78;
        svg.appendChild(el("line", { x1: sx, y1: y, x2: sx, y2: ny, class: "fx-ring" }));
        svg.appendChild(node({ x: sx, y: ny, r: 17, glyph: gl[s], label: steps[s], sub: "0" + (s + 1), depth: 2 + (s % 3) }));
        svg.appendChild(node({ x: sx, y: y, r: 6, accent: true, depth: 1 }));
      }
    }

    else if (mode === "selector") {
      mk(520, 520);
      var sx2 = 260, sy2 = 262, SR = 158;
      var svc = [["managed", "Managed IT", ICON.hub], ["co", "Co-Managed IT", ICON.user], ["cyber", "Cybersecurity", ICON.shield], ["projects", "IT Projects", ICON.project]];
      var hub2 = node({ x: sx2, y: sy2, hub: true, r: 30, glyph: ICON.support, label: "Techordia", depth: 1 });
      var sn = [];
      for (var q = 0; q < svc.length; q++) {
        var a2 = -Math.PI / 2 + (q / svc.length) * Math.PI * 2;
        var x2 = sx2 + Math.cos(a2) * SR, y2 = sy2 + Math.sin(a2) * SR;
        var e3 = edge(sx2, sy2, x2, y2, true); svg.appendChild(e3.frag);
        var nd2 = node({ x: x2, y: y2, r: 22, glyph: svc[q][2], label: svc[q][1], depth: 2 + q, id: svc[q][0] });
        nd2._edge = e3.base; nd2._flow = e3.flow; nd2._key = svc[q][0];
        sn.push(nd2);
      }
      svg.appendChild(hub2); sn.forEach(function (nd) { svg.appendChild(nd); });
      wireHover(box, svg, hub2, sn);
      wireSelector(box, sn);
    }

    else if (mode === "framework") {
      mk(520, 520);
      var fx2 = 260, fy2 = 262;
      var orbit = el("g", { class: reduce ? "" : "fx-orbit" });
      orbit.appendChild(el("circle", { cx: fx2, cy: fy2, r: 150, class: "fx-ring", "stroke-dasharray": "2 9" }));
      [0, 1, 2, 3].forEach(function (i) {
        var a = -Math.PI / 2 + i * Math.PI / 2, x = fx2 + Math.cos(a) * 150, y = fy2 + Math.sin(a) * 150;
        orbit.appendChild(el("circle", { cx: x, cy: y, r: 8, class: "fx-dot fx-dot--accent" }));
      });
      svg.appendChild(orbit);
      var ho = node({ x: fx2, y: fy2, hub: true, r: 34, glyph: ICON.hub, depth: 1 });
      svg.appendChild(ho);
      var badge = el("g");
      badge.appendChild(el("rect", { x: fx2 - 96, y: fy2 + 92, width: 192, height: 40, rx: 12, class: "fx-soon" }));
      badge.appendChild(txt(fx2, fy2 + 117, "FRAMEWORK COMING SOON", "fx-soon-t"));
      svg.appendChild(badge);
    }
  }

  /* ---- Techordia globe via globe.gl (real 3D WebGL Earth) ----------------
     Built on the open-source globe.gl library with public-domain Natural
     Earth country data (dotted continents) and Techordia's own home base in
     Alameda + arcs to client cities, in brand colours. Falls back to the
     canvas globe below if WebGL or the CDN is unavailable.
     ----------------------------------------------------------------------- */
  var _ggl = { loading: false, ready: false, cbs: [] };
  function loadGlobeGL(cb) {
    if (_ggl.ready && window.Globe) return cb(true);
    _ggl.cbs.push(cb);
    if (_ggl.loading) return;
    _ggl.loading = true;
    var s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/globe.gl@2";
    s.async = true;
    s.onload = function () { _ggl.ready = !!window.Globe; _ggl.cbs.splice(0).forEach(function (f) { f(_ggl.ready); }); };
    s.onerror = function () { _ggl.loading = false; _ggl.cbs.splice(0).forEach(function (f) { f(false); }); };
    document.head.appendChild(s);
  }
  var _geo = null;
  function loadCountries() {
    if (_geo) return _geo;
    var urls = [
      "https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_110m_admin_0_countries.geojson",
      "https://cdn.jsdelivr.net/gh/vasturiano/globe.gl@master/example/datasets/ne_110m_admin_0_countries.geojson"
    ];
    _geo = urls.reduce(function (p, url) {
      return p.then(function (g) { return g || fetch(url).then(function (r) { return r.json(); }).catch(function () { return null; }); });
    }, Promise.resolve(null));
    return _geo;
  }

  function buildGlobe(box) {
    loadGlobeGL(function (ok) {
      if (!ok || !window.Globe) { canvasGlobe(box); return; }
      try { initGlobeGL(box); } catch (e) { console.warn("globe.gl init failed", e); canvasGlobe(box); }
    });
  }

  function initGlobeGL(box) {
    function isLight() { return document.documentElement.getAttribute("data-theme") === "light"; }
    var HOME = { lat: 37.77, lng: -122.24, home: true };
    var CITIES = [
      { lat: 40.71, lng: -74.0 }, { lat: 43.7, lng: -79.4 }, { lat: 51.5, lng: -0.12 },
      { lat: 52.52, lng: 13.4 }, { lat: -23.5, lng: -46.6 }, { lat: -33.9, lng: 18.4 },
      { lat: 25.2, lng: 55.3 }, { lat: 19.08, lng: 72.88 }, { lat: 1.35, lng: 103.82 },
      { lat: 35.68, lng: 139.7 }, { lat: -33.87, lng: 151.21 }
    ];
    var arcs = CITIES.map(function (c) { return { startLat: HOME.lat, startLng: HOME.lng, endLat: c.lat, endLng: c.lng }; });
    var sz = Math.max(220, box.clientWidth || box.getBoundingClientRect().width || 460);

    function darkTex() { var t = document.createElement("canvas"); t.width = t.height = 2; var x = t.getContext("2d"); x.fillStyle = isLight() ? "#d3e2f2" : "#0c1e36"; x.fillRect(0, 0, 2, 2); return t.toDataURL(); }

    var world = window.Globe({ rendererConfig: { preserveDrawingBuffer: true, antialias: true, alpha: true }, waitForGlobeReady: false, animateIn: false })(box)
      .width(sz).height(sz)
      .backgroundColor("rgba(0,0,0,0)")
      .globeImageUrl(darkTex())
      .showAtmosphere(true).atmosphereColor(isLight() ? "#2f7bf6" : "#46a6ff").atmosphereAltitude(0.18)
      .arcsData(arcs)
      .arcColor(function () { return ["rgba(56,200,225,0)", "rgba(120,236,236,0.95)", "rgba(56,200,225,0)"]; })
      .arcStroke(0.5).arcAltitudeAutoScale(0.5)
      .arcDashLength(0.4).arcDashGap(0.7).arcDashInitialGap(function () { return Math.random(); }).arcDashAnimateTime(reduce ? 0 : 2600)
      .pointsData([HOME].concat(CITIES)).pointLat("lat").pointLng("lng")
      .pointColor(function (d) { return d.home ? "#aef0ff" : "#6fe3da"; })
      .pointAltitude(0.012).pointRadius(function (d) { return d.home ? 0.62 : 0.34; })
      .ringsData([HOME]).ringLat("lat").ringLng("lng")
      .ringColor(function () { return "#8fe9f2"; })
      .ringMaxRadius(3.6).ringPropagationSpeed(1.7).ringRepeatPeriod(reduce ? 4000 : 1100);

    loadCountries().then(function (geo) {
      if (!geo || !geo.features) return;
      world.hexPolygonsData(geo.features).hexPolygonResolution(3).hexPolygonMargin(0.22)
        .hexPolygonUseDots(true).hexPolygonAltitude(0.007)
        .hexPolygonColor(function () { return isLight() ? "rgba(28,96,188,0.9)" : "rgba(118,208,250,0.95)"; });
    });

    world.pointOfView({ lat: 18, lng: -95, altitude: 1.95 }, 0);
    var ctr = world.controls();
    ctr.enableZoom = false; ctr.enablePan = false; ctr.autoRotate = !reduce; ctr.autoRotateSpeed = 0.38;

    function onResize() { var bw = Math.max(220, box.clientWidth || sz); world.width(bw).height(bw); }
    if (window.ResizeObserver) { try { new ResizeObserver(onResize).observe(box); } catch (e) {} }
    else window.addEventListener("resize", onResize);

    try {
      new MutationObserver(function () {
        var L = isLight();
        world.globeImageUrl(darkTex()).atmosphereColor(L ? "#2f7bf6" : "#46a6ff");
        world.hexPolygonColor(function () { return L ? "rgba(30,98,190,0.85)" : "rgba(108,200,245,0.92)"; });
      }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    } catch (e) {}
  }

  /* ---- canvas globe (fallback when globe.gl/WebGL is unavailable) --------
     A rotating dotted Earth rendered in 2D canvas — hand-authored geography
     and own great-circle maths. Theme-aware, reduced-motion safe.
     ----------------------------------------------------------------------- */
  function canvasGlobe(box) {
    var canvas = document.createElement("canvas");
    canvas.className = "fx-globe";
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", box.getAttribute("data-label") ||
      "A rotating globe with Techordia in Alameda, California and lines reaching out to client locations across the world");
    box.appendChild(canvas);
    var ctx = canvas.getContext("2d");
    var DEG = Math.PI / 180;
    function ll(lat, lng) { var la = lat * DEG, lo = lng * DEG, c = Math.cos(la); return [c * Math.cos(lo), Math.sin(la), c * Math.sin(lo)]; }

    // continent polygons (hand-authored simplified geography, [lat,lng]) --
    // used as a land mask: a dot is drawn wherever the surface falls on land.
    var POLY = [
      /* North America */[[71,-156],[68,-165],[65,-166],[60,-164],[58,-153],[55,-131],[52,-128],[48,-125],[42,-124],[34,-120],[30,-115],[23,-110],[20,-106],[18,-103],[15,-96],[13,-91],[8,-83],[8,-78],[12,-83],[16,-88],[18,-94],[20,-97],[26,-97],[29,-94],[30,-89],[29,-83],[25,-81],[31,-81],[35,-76],[40,-74],[44,-67],[47,-64],[50,-58],[53,-56],[56,-61],[60,-65],[63,-78],[66,-72],[69,-78],[72,-95],[74,-115],[72,-128],[70,-141],[71,-156]],
      /* Greenland */[[60,-45],[64,-40],[70,-22],[76,-19],[81,-25],[82,-38],[78,-58],[72,-55],[66,-52],[60,-45]],
      /* South America */[[12,-71],[10,-62],[5,-52],[0,-49],[-5,-35],[-9,-35],[-15,-39],[-23,-43],[-30,-50],[-35,-54],[-41,-62],[-46,-66],[-52,-69],[-55,-67],[-50,-73],[-42,-73],[-33,-72],[-24,-70],[-16,-74],[-8,-79],[-2,-80],[4,-77],[9,-77],[12,-71]],
      /* Africa + Arabia */[[37,-6],[37,10],[33,12],[31,20],[31,32],[24,35],[15,40],[12,44],[12,51],[6,49],[2,46],[-5,40],[-12,40],[-18,37],[-25,34],[-34,26],[-35,19],[-29,16],[-22,14],[-15,12],[-8,13],[-1,9],[4,8],[5,1],[5,-4],[8,-13],[14,-17],[20,-17],[26,-15],[31,-10],[35,-6],[37,-6]],
      /* Europe */[[36,-6],[38,-9],[43,-9],[47,-4],[49,-1],[51,2],[53,5],[55,8],[58,5],[60,5],[63,8],[66,12],[70,18],[71,26],[67,30],[60,28],[57,22],[55,21],[54,12],[52,3],[49,-1],[47,-2],[44,-1],[43,4],[44,8],[41,17],[40,19],[42,28],[46,30],[45,37],[44,39],[40,28],[38,22],[36,-6]],
      /* Asia */[[40,28],[45,35],[44,50],[37,49],[30,48],[26,56],[25,62],[23,67],[16,73],[8,77],[12,80],[19,85],[22,92],[16,95],[9,99],[10,105],[14,109],[21,108],[23,117],[30,122],[37,122],[40,124],[43,130],[47,138],[52,141],[59,150],[62,160],[66,170],[70,178],[73,140],[77,110],[79,95],[80,75],[75,68],[68,55],[64,48],[57,38],[50,32],[44,30],[40,28]],
      /* Australia */[[-11,131],[-12,137],[-15,141],[-13,143],[-18,146],[-25,153],[-34,151],[-38,146],[-38,140],[-35,137],[-32,131],[-33,123],[-32,116],[-26,114],[-20,117],[-15,124],[-12,130],[-11,131]],
      /* Japan */[[31,131],[34,135],[36,140],[40,142],[42,140],[37,137],[34,132],[31,131]],
      /* UK + Ireland */[[50,-5],[53,-3],[56,-6],[58,-4],[57,-1],[53,1],[51,1],[50,-5]],
      /* New Zealand */[[-35,173],[-39,177],[-42,174],[-46,168],[-44,170],[-40,172],[-35,173]],
      /* Madagascar */[[-12,49],[-16,50],[-23,47],[-25,45],[-20,44],[-14,47],[-12,49]]
    ];
    function pip(lat, lng, poly) {
      var inside = false;
      for (var a = 0, b = poly.length - 1; a < poly.length; b = a++) {
        var yi = poly[a][0], xi = poly[a][1], yj = poly[b][0], xj = poly[b][1];
        if (((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) inside = !inside;
      }
      return inside;
    }
    function onLand(lat, lng) { for (var q = 0; q < POLY.length; q++) if (pip(lat, lng, POLY[q])) return true; return false; }
    // land dot field: one dot per ~2.8 deg of land, evenly spaced toward poles
    var LAND = [];
    for (var dlat = -78; dlat <= 80; dlat += 2.8) {
      var stepLng = 2.8 / Math.max(0.22, Math.cos(dlat * DEG));
      for (var dlng = -180; dlng < 180; dlng += stepLng) if (onLand(dlat, dlng)) LAND.push(ll(dlat, dlng));
    }

    // Techordia home (Alameda, CA) + client locations worldwide ----------
    var HOME = ll(37.77, -122.24);
    var CLIENTS = [
      [40.7, -74.0], [51.5, -0.12], [-23.5, -46.6], [-33.9, 18.4],
      [25.2, 55.3], [1.35, 103.8], [35.7, 139.7], [-33.9, 151.2]
    ].map(function (c) { return ll(c[0], c[1]); });

    var P = {};
    function setPalette() {
      var light = document.documentElement.getAttribute("data-theme") === "light";
      P = light
        ? { grid: "70,120,180", land: "26,95,175", arc: [30, 140, 195], arcHi: [16, 110, 150], glow: "40,150,200",
            rim: "30,98,190", haloA: .08, core: "30,120,180", coreGlyph: "#ffffff", pillBg: "rgba(255,255,255,.95)",
            pillTx: "#125a86", spark: [20, 120, 150], ping: [30, 130, 180] }
        : { grid: "90,140,205", land: "120,190,240", arc: [40, 214, 205], arcHi: [174, 240, 255], glow: "50,165,215",
            rim: "120,170,230", haloA: .15, core: "120,225,245", coreGlyph: "#06121f", pillBg: "rgba(8,16,30,.82)",
            pillTx: "#9fefff", spark: [205, 246, 255], ping: [150, 230, 255] };
    }
    setPalette();

    var W = 1, H = 1, cx = 0, cy = 0, R = 0, nodeR = 12, fs = 12, dpr = 1, M = 1;
    function resize() {
      var r = box.getBoundingClientRect();
      W = Math.max(1, r.width); H = Math.max(1, r.height); M = Math.min(W, H);
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      canvas.style.width = W + "px"; canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = W / 2; cy = H / 2; R = M * 0.38;
      nodeR = Math.max(7, Math.min(12, M * 0.024));
      fs = Math.max(8.5, Math.min(12, M * 0.025));
    }
    resize();
    if (window.ResizeObserver) { try { new ResizeObserver(resize).observe(box); } catch (e) {} }
    else window.addEventListener("resize", resize);

    // pointer parallax tilt ----------------------------------------------
    var tiltX = 0.40, tiltY = 0, curX = 0.40, curY = 0;       // +tilt centres the view on N. America
    if (!reduce) {
      box.addEventListener("pointermove", function (e) {
        var r = box.getBoundingClientRect();
        tiltY = ((e.clientX - r.left) / r.width - .5) * 0.4;
        tiltX = 0.40 + ((e.clientY - r.top) / r.height - .5) * 0.3;
      });
      box.addEventListener("pointerleave", function () { tiltX = 0.40; tiltY = 0; });
    }

    function rgb(c, al) { return "rgba(" + (c[0] | 0) + "," + (c[1] | 0) + "," + (c[2] | 0) + "," + al + ")"; }
    function rrect(x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }
    function glyph(d, x, y, size, color) {
      var s = size / 24;
      ctx.save(); ctx.translate(x - 12 * s, y - 12 * s); ctx.scale(s, s);
      ctx.fillStyle = color; ctx.fill(new Path2D(d)); ctx.restore();
    }
    function slerp(a, b, t) {
      var d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; d = d < -1 ? -1 : d > 1 ? 1 : d;
      var om = Math.acos(d); if (om < 1e-4) return [a[0], a[1], a[2]];
      var s = Math.sin(om), w1 = Math.sin((1 - t) * om) / s, w2 = Math.sin(t * om) / s;
      return [a[0] * w1 + b[0] * w2, a[1] * w1 + b[1] * w2, a[2] * w1 + b[2] * w2];
    }

    var ANG0 = 2.5, ang = 2.5;                  // ANG0 centres Alameda's longitude on the front
    function draw(now) {
      ctx.clearRect(0, 0, W, H);
      var cosY = Math.cos(ang + curY), sinY = Math.sin(ang + curY), cosX = Math.cos(curX), sinX = Math.sin(curX);
      // project a unit vector (optionally lifted by altitude scale) to screen
      function project(v, scale) {
        var x1 = v[0] * cosY + v[2] * sinY, z1 = -v[0] * sinY + v[2] * cosY;
        var y2 = v[1] * cosX - z1 * sinX, z2 = v[1] * sinX + z1 * cosX, s = scale || 1;
        return { sx: cx + x1 * R * s, sy: cy - y2 * R * s, z: z2 };
      }

      // soft halo + solid ocean disc so the planet reads as a body
      var halo = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.7);
      halo.addColorStop(0, "rgba(" + P.glow + "," + P.haloA + ")"); halo.addColorStop(1, "rgba(" + P.glow + ",0)");
      ctx.fillStyle = halo; ctx.fillRect(0, 0, W, H);
      var ocean = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.2, cx, cy, R);
      ocean.addColorStop(0, "rgba(" + P.glow + ",0.10)"); ocean.addColorStop(1, "rgba(" + P.glow + ",0.02)");
      ctx.fillStyle = ocean; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();

      // --- land dots (front hemisphere only -> a solid spinning planet) ---
      ctx.lineCap = "round";
      for (var d = 0; d < LAND.length; d++) {
        var lp = project(LAND[d]);
        if (lp.z <= 0.05) continue;
        var fr = (lp.z + 1) / 2; fr = (fr - 0.5) * 2;            // 0 at limb .. 1 at centre
        ctx.fillStyle = "rgba(" + P.land + "," + (0.16 + 0.76 * fr).toFixed(3) + ")";
        ctx.beginPath(); ctx.arc(lp.sx, lp.sy, 0.6 + 1.1 * fr, 0, Math.PI * 2); ctx.fill();
      }
      // crisp rim
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(" + P.rim + ",0.34)"; ctx.lineWidth = 1.1; ctx.stroke();

      // --- highlighted arcs: Alameda -> each client location ---
      var hp = project(HOME);
      for (var i = 0; i < CLIENTS.length; i++) {
        var cl = CLIENTS[i], SEG = 30, pr = null, prF = 0;
        // build + stroke arc with great-circle + altitude lift
        for (var sIdx = 0; sIdx <= SEG; sIdx++) {
          var t = sIdx / SEG, v = slerp(HOME, cl, t), alt = 1 + 0.16 * Math.sin(Math.PI * t);
          var cur2 = project(v, alt), fF = (cur2.z + 1) / 2;
          if (pr && (fF > 0.34 || prF > 0.34)) {
            var a2 = Math.max(0, Math.min(1, ((fF + prF) / 2 - 0.32) / 0.5));
            ctx.strokeStyle = rgb(P.arc, (0.10 + 0.16 * a2).toFixed(3)); ctx.lineWidth = 5;   // glow
            ctx.beginPath(); ctx.moveTo(pr.sx, pr.sy); ctx.lineTo(cur2.sx, cur2.sy); ctx.stroke();
            ctx.strokeStyle = rgb(P.arcHi, (0.25 + 0.7 * a2).toFixed(3)); ctx.lineWidth = 1.9; // bold core
            ctx.beginPath(); ctx.moveTo(pr.sx, pr.sy); ctx.lineTo(cur2.sx, cur2.sy); ctx.stroke();
          }
          pr = cur2; prF = fF;
        }
        // travelling signal + destination ping
        if (!reduce) {
          var tt = (now / 2600 + i * 0.13) % 1, sv = slerp(HOME, cl, tt), salt = 1 + 0.16 * Math.sin(Math.PI * tt), sp = project(sv, salt);
          if ((sp.z + 1) / 2 > 0.42) { ctx.fillStyle = rgb(P.spark, 0.95); ctx.beginPath(); ctx.arc(sp.sx, sp.sy, 2.3, 0, Math.PI * 2); ctx.fill(); }
        }
        var dp = project(cl), df = (dp.z + 1) / 2;
        if (df > 0.5) {
          var pulse = reduce ? 0.5 : 0.5 + 0.5 * Math.sin(now / 600 + i);
          var gg = ctx.createRadialGradient(dp.sx, dp.sy, 0, dp.sx, dp.sy, 4 + 4 * pulse);
          gg.addColorStop(0, rgb(P.ping, 0.5 * (df - 0.5) * 2)); gg.addColorStop(1, rgb(P.ping, 0));
          ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(dp.sx, dp.sy, 4 + 4 * pulse, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = rgb(P.ping, 0.9 * (df - 0.5) * 2); ctx.beginPath(); ctx.arc(dp.sx, dp.sy, 1.9, 0, Math.PI * 2); ctx.fill();
        }
      }

      // --- Techordia home base (Alameda) ---
      var hf = (hp.z + 1) / 2;
      if (hf > 0.42) {
        if (!reduce) {
          var rp = (now / 1700) % 1;
          ctx.beginPath(); ctx.arc(hp.sx, hp.sy, nodeR * 0.6 + rp * nodeR * 3, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(" + P.core + "," + (0.45 * (1 - rp) * (hf - 0.4)).toFixed(3) + ")"; ctx.lineWidth = 1.4; ctx.stroke();
        }
        var cg = ctx.createRadialGradient(hp.sx, hp.sy, 0, hp.sx, hp.sy, nodeR * 2.8);
        cg.addColorStop(0, "rgba(" + P.core + "," + (0.7 * hf).toFixed(2) + ")"); cg.addColorStop(1, "rgba(" + P.core + ",0)");
        ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(hp.sx, hp.sy, nodeR * 2.8, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.fillStyle = "rgba(" + P.core + ",0.98)"; ctx.arc(hp.sx, hp.sy, nodeR, 0, Math.PI * 2); ctx.fill();
        glyph(ICON.hub, hp.sx, hp.sy, nodeR * 1.4, P.coreGlyph);
        // label pill
        var lbl = "TECHORDIA · ALAMEDA";
        ctx.font = "700 " + (fs * 0.86).toFixed(1) + "px 'Space Grotesk', system-ui, sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        var lw = ctx.measureText(lbl).width, ph = fs + 8, py = hp.sy + nodeR + ph * 0.85;
        ctx.globalAlpha = Math.min(1, (hf - 0.42) * 4);
        ctx.fillStyle = P.pillBg; rrect(hp.sx - lw / 2 - 9, py - ph / 2, lw + 18, ph, ph / 2); ctx.fill();
        ctx.fillStyle = P.pillTx; ctx.fillText(lbl, hp.sx, py + 0.5);
        ctx.globalAlpha = 1;
      }
    }

    var raf = null, running = false;
    function frame(now) {
      ang = ANG0 + 0.22 * Math.sin(now / 9000);   // gentle sway, keeps Alameda framed
      curX += (tiltX - curX) * .06; curY += (tiltY - curY) * .06;
      draw(now || 0);
      if (!reduce && !document.hidden) { running = true; raf = requestAnimationFrame(frame); }
      else { running = false; raf = null; }
    }
    function startLoop() { if (!running && !reduce && !document.hidden) { running = true; raf = requestAnimationFrame(frame); } }
    try {
      new MutationObserver(function () { setPalette(); draw(performance.now ? performance.now() : 0); })
        .observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    } catch (e) {}
    draw(0);                                  // always paint one static frame, even if hidden/backgrounded
    if (!reduce) {
      document.addEventListener("visibilitychange", startLoop);
      startLoop();
    }
  }

  /* ---- hover cross-highlight between hub & nodes ---- */
  function wireHover(box, svg, hub, nodes) {
    if (window.matchMedia && window.matchMedia("(hover: none)").matches) return;
    nodes.forEach(function (nd) {
      var g = nd._node;
      function on() {
        box.classList.add("is-engaged"); g.classList.add("is-hot");
        if (nd._edge) nd._edge.classList.add("is-hot");
      }
      function off() {
        box.classList.remove("is-engaged"); g.classList.remove("is-hot");
        if (nd._edge) nd._edge.classList.remove("is-hot");
      }
      g.addEventListener("mouseenter", on); g.addEventListener("mouseleave", off);
      g.addEventListener("focus", on); g.addEventListener("blur", off);
    });
  }

  /* ---- services: cross-link external cards <-> nodes ---- */
  function wireSelector(box, nodes) {
    var scope = box.closest("[data-fx-scope]") || document;
    var cards = scope.querySelectorAll("[data-fx-target]");
    if (!cards.length) return;
    function setActive(key, on) {
      cards.forEach(function (c) { c.classList.toggle("is-active", on && c.getAttribute("data-fx-target") === key); });
      nodes.forEach(function (nd) {
        var hot = on && nd._key === key;
        nd._node.classList.toggle("is-hot", hot);
        if (nd._edge) nd._edge.classList.toggle("is-hot", hot);
      });
      box.classList.toggle("is-engaged", !!on);
    }
    cards.forEach(function (c) {
      var key = c.getAttribute("data-fx-target");
      c.addEventListener("mouseenter", function () { setActive(key, true); });
      c.addEventListener("mouseleave", function () { setActive(key, false); });
    });
    nodes.forEach(function (nd) {
      nd._node.addEventListener("mouseenter", function () { setActive(nd._key, true); });
      nd._node.addEventListener("mouseleave", function () { setActive(nd._key, false); });
    });
  }

  /* ---- parallax: smooth lerp toward pointer, per container ---- */
  var fields = [];
  function initParallax(box) {
    if (reduce) return;
    var st = { box: box, tx: 0, ty: 0, cx: 0, cy: 0, active: false };
    box.addEventListener("pointermove", function (e) {
      var r = box.getBoundingClientRect();
      st.tx = ((e.clientX - r.left) / r.width - .5) * 2;
      st.ty = ((e.clientY - r.top) / r.height - .5) * 2;
      st.active = true;
    });
    box.addEventListener("pointerleave", function () { st.tx = 0; st.ty = 0; });
    fields.push(st);
  }
  function tick() {
    for (var i = 0; i < fields.length; i++) {
      var s = fields[i];
      s.cx += (s.tx - s.cx) * .08; s.cy += (s.ty - s.cy) * .08;
      if (Math.abs(s.cx) < .0008 && Math.abs(s.cy) < .0008 && !s.active) continue;
      var els = s.box.querySelectorAll("[data-depth]");
      for (var j = 0; j < els.length; j++) {
        var d = +els[j].getAttribute("data-depth") || 1;
        var f = d * 6;
        els[j].style.transform = "translate(" + (s.cx * f).toFixed(2) + "px," + (s.cy * f).toFixed(2) + "px)";
      }
      s.active = false;
    }
    requestAnimationFrame(tick);
  }

  function start() {
    injectDefs();
    var boxes = document.querySelectorAll("[data-fx]");
    boxes.forEach(function (b) { try { build(b); initParallax(b); } catch (err) { console.warn("fx build failed", err); } });
    if (!reduce && boxes.length) requestAnimationFrame(tick);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
