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

  /* ---- Techordia operations globe (canvas) ------------------------------
     A rotating point-globe (your IT environment) ringed by six LABELLED
     endpoints — Microsoft 365, devices, security, backups, servers, your
     team. Each is joined to the central Techordia core by a distinct,
     directional connector: an animated signal travels endpoint -> core, so
     it reads clearly as "everything reports into Techordia, monitored 24/7."
     Original render (no third-party globe libs). Theme-aware, pointer-
     reactive, reduced-motion safe.
     ----------------------------------------------------------------------- */
  function buildGlobe(box) {
    var canvas = document.createElement("canvas");
    canvas.className = "fx-globe";
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", box.getAttribute("data-label") ||
      "Techordia at the centre, monitoring Microsoft 365, devices, security, backups, servers, and your team as one system");
    box.appendChild(canvas);
    var ctx = canvas.getContext("2d");

    // backdrop sphere points (Fibonacci spiral) --------------------------
    var N = 440, pts = [], golden = Math.PI * (3 - Math.sqrt(5));
    for (var i = 0; i < N; i++) {
      var uy = 1 - (i / (N - 1)) * 2, rr = Math.sqrt(Math.max(0, 1 - uy * uy)), th = golden * i;
      pts.push({ x: Math.cos(th) * rr, y: uy, z: Math.sin(th) * rr, lat: (uy + 1) / 2 });
    }

    // labelled endpoints that feed the core, placed at 1/3/5/7/9/11 o'clock
    var EP = [
      { label: "Microsoft 365", icon: ICON.m365,   ux:  0.5,   uy: -0.866 },
      { label: "Devices",       icon: ICON.device, ux:  1,     uy:  0 },
      { label: "Security",      icon: ICON.shield, ux:  0.5,   uy:  0.866 },
      { label: "Backups",       icon: ICON.backup, ux: -0.5,   uy:  0.866 },
      { label: "Servers",       icon: ICON.vendor, ux: -1,     uy:  0 },
      { label: "Your team",     icon: ICON.user,   ux: -0.5,   uy: -0.866 }
    ];

    var P = {};
    function setPalette() {
      var light = document.documentElement.getAttribute("data-theme") === "light";
      P = light
        ? { a: [27, 95, 214], b: [16, 165, 158], white: .25, dotMax: .5, glow: "40,150,200", line: "30,120,170",
            spark: "16,120,150", rim: "30,98,190", haloA: .08, nodeBg: "rgba(255,255,255,.94)", nodeSt: "rgba(30,98,190,.32)",
            glyph: "#1b5fd6", label: "#33465f", core: "44,150,210", coreGlyph: "#ffffff", pillBg: "rgba(255,255,255,.94)", pillTx: "#125a86" }
        : { a: [79, 150, 255], b: [40, 214, 205], white: .5, dotMax: .6, glow: "50,165,215", line: "110,205,235",
            spark: "175,240,255", rim: "120,170,230", haloA: .15, nodeBg: "rgba(14,28,48,.92)", nodeSt: "rgba(120,180,235,.42)",
            glyph: "#d4ecff", label: "#aebfd6", core: "95,215,238", coreGlyph: "#eaf9ff", pillBg: "rgba(8,16,30,.78)", pillTx: "#8fe9ff" };
    }
    setPalette();

    var W = 1, H = 1, cx = 0, cy = 0, Rg = 0, Re = 0, nodeR = 12, fs = 12, dpr = 1, M = 1;
    function resize() {
      var r = box.getBoundingClientRect();
      W = Math.max(1, r.width); H = Math.max(1, r.height); M = Math.min(W, H);
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      canvas.style.width = W + "px"; canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = W / 2; cy = H / 2; Rg = M * 0.255; Re = M * 0.405;
      nodeR = Math.max(10, Math.min(17, M * 0.034));
      fs = Math.max(8.5, Math.min(12.5, M * 0.026));
    }
    resize();
    if (window.ResizeObserver) { try { new ResizeObserver(resize).observe(box); } catch (e) {} }
    else window.addEventListener("resize", resize);

    // pointer parallax tilt ----------------------------------------------
    var tiltX = -0.40, tiltY = 0, curX = -0.40, curY = 0;
    if (!reduce) {
      box.addEventListener("pointermove", function (e) {
        var r = box.getBoundingClientRect();
        tiltY = ((e.clientX - r.left) / r.width - .5) * 0.5;
        tiltX = -0.40 + ((e.clientY - r.top) / r.height - .5) * 0.4;
      });
      box.addEventListener("pointerleave", function () { tiltX = -0.40; tiltY = 0; });
    }

    function lerpC(c1, c2, t) { return [c1[0] + (c2[0] - c1[0]) * t, c1[1] + (c2[1] - c1[1]) * t, c1[2] + (c2[2] - c1[2]) * t]; }
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

    var ang = 0, proj = new Array(N), order = new Array(N);
    for (var z = 0; z < N; z++) order[z] = z;

    function draw(now) {
      ctx.clearRect(0, 0, W, H);
      // soft halo behind the globe
      var halo = ctx.createRadialGradient(cx, cy, Rg * 0.15, cx, cy, Rg * 1.9);
      halo.addColorStop(0, "rgba(" + P.glow + "," + P.haloA + ")");
      halo.addColorStop(1, "rgba(" + P.glow + ",0)");
      ctx.fillStyle = halo; ctx.fillRect(0, 0, W, H);
      // thin rim around the globe
      ctx.beginPath(); ctx.arc(cx, cy, Rg * 1.05, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(" + P.rim + ",0.16)"; ctx.lineWidth = 1; ctx.stroke();

      // --- rotating backdrop sphere (the environment) ---
      var cosY = Math.cos(ang + curY), sinY = Math.sin(ang + curY);
      var cosX = Math.cos(curX), sinX = Math.sin(curX);
      for (var i = 0; i < N; i++) {
        var p = pts[i];
        var x1 = p.x * cosY + p.z * sinY, z1 = -p.x * sinY + p.z * cosY;
        var y2 = p.y * cosX - z1 * sinX, z2 = p.y * sinX + z1 * cosX;
        proj[i] = { sx: cx + x1 * Rg, sy: cy - y2 * Rg, z: z2, lat: p.lat };
      }
      order.sort(function (m, n) { return proj[m].z - proj[n].z; });
      for (var o = 0; o < N; o++) {
        var pp = proj[order[o]], d = (pp.z + 1) / 2;
        var col = lerpC(lerpC(P.a, P.b, pp.lat), [255, 255, 255], d * d * P.white);
        ctx.beginPath();
        ctx.fillStyle = rgb(col, ((0.07 + 0.42 * d) * P.dotMax).toFixed(3));
        ctx.arc(pp.sx, pp.sy, 0.7 + 1.3 * d, 0, Math.PI * 2); ctx.fill();
      }

      // --- connectors: endpoint -> core, with an inbound travelling signal ---
      for (var e = 0; e < EP.length; e++) {
        var ep = EP[e];
        var nx = cx + ep.ux * Re, ny = cy + ep.uy * Re;            // endpoint node
        var ix = cx + ep.ux * Rg * 0.98, iy = cy + ep.uy * Rg * 0.98; // lands on globe
        var lg = ctx.createLinearGradient(nx, ny, ix, iy);
        lg.addColorStop(0, "rgba(" + P.line + ",0.22)");
        lg.addColorStop(1, "rgba(" + P.line + ",0.70)");
        ctx.strokeStyle = lg; ctx.lineWidth = 1.7; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(nx, ny); ctx.lineTo(ix, iy); ctx.stroke();
        if (!reduce) {
          var t = (now / 2100 + e * 0.16) % 1;          // node(0) -> core(1)
          for (var s = 0; s < 2; s++) {                  // two signals per line
            var ts = (t + s * 0.5) % 1;
            var bx = nx + (ix - nx) * ts, by = ny + (iy - ny) * ts;
            ctx.beginPath();
            ctx.fillStyle = "rgba(" + P.spark + "," + (0.95 * (1 - ts * 0.4)).toFixed(2) + ")";
            ctx.arc(bx, by, 2.1, 0, Math.PI * 2); ctx.fill();
          }
        }
      }

      // --- central Techordia core ---
      if (!reduce) {                                     // live monitoring pulse
        var pr = (now / 1700) % 1;
        ctx.beginPath(); ctx.arc(cx, cy, Rg * 0.18 + pr * Rg * 0.95, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(" + P.core + "," + (0.4 * (1 - pr)).toFixed(3) + ")"; ctx.lineWidth = 1.4; ctx.stroke();
      }
      var cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, nodeR * 2.6);
      cg.addColorStop(0, "rgba(" + P.core + ",0.6)"); cg.addColorStop(1, "rgba(" + P.core + ",0)");
      ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(cx, cy, nodeR * 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.fillStyle = "rgba(" + P.core + ",0.96)"; ctx.arc(cx, cy, nodeR * 1.02, 0, Math.PI * 2); ctx.fill();
      glyph(ICON.hub, cx, cy, nodeR * 1.5, P.coreGlyph);

      // --- endpoints: node + icon + label (drawn on top) ---
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      for (var e2 = 0; e2 < EP.length; e2++) {
        var ep2 = EP[e2], nx2 = cx + ep2.ux * Re, ny2 = cy + ep2.uy * Re;
        ctx.beginPath(); ctx.fillStyle = P.nodeBg; ctx.arc(nx2, ny2, nodeR, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = 1.2; ctx.strokeStyle = P.nodeSt; ctx.stroke();
        glyph(ep2.icon, nx2, ny2, nodeR * 1.28, P.glyph);
        ctx.font = "600 " + fs.toFixed(1) + "px 'Space Grotesk', system-ui, sans-serif";
        ctx.fillStyle = P.label; ctx.fillText(ep2.label, nx2, ny2 + nodeR + 4);
      }

      // --- "TECHORDIA" pill under the core ---
      var lbl = "TECHORDIA";
      ctx.font = "700 " + (fs * 0.9).toFixed(1) + "px 'Space Grotesk', system-ui, sans-serif";
      ctx.textBaseline = "middle";
      var lw = ctx.measureText(lbl).width, ph = fs + 9, py = cy + nodeR * 2.55;
      ctx.fillStyle = P.pillBg; rrect(cx - lw / 2 - 9, py - ph / 2, lw + 18, ph, ph / 2); ctx.fill();
      ctx.fillStyle = P.pillTx; ctx.fillText(lbl, cx, py + 0.5);
    }

    var raf = null, running = false;
    function frame(now) {
      ang += 0.0023; curX += (tiltX - curX) * .06; curY += (tiltY - curY) * .06;
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
