/* =========================================================================
   Techordia effect engine — ONE system, several layout modes.
   Renders inline SVG into [data-fx] containers and wires parallax + hover.
   Modes: core | network | ownership | lanes | layers | timeline | selector | framework
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

    if (mode === "core") { buildCore(box); return; }

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
      var managed = box.getAttribute("data-variant") === "managed";
      var midX = 440, lx = 150, rx = 730, ys = [150, 270, 390];
      if (!managed) {
        svg.appendChild(el("line", { x1: midX, y1: 70, x2: midX, y2: 470, class: "fx-ring", "stroke-dasharray": "2 8" }));
        svg.appendChild(txt(lx, 96, "YOUR INTERNAL IT", "fx-cap"));
        svg.appendChild(txt(rx, 96, "TECHORDIA", "fx-cap"));
        svg.appendChild(txt(midX, 60, "SHARED VISIBILITY & ESCALATION", "fx-cap"));
      }
      var midNode = node({ x: midX, y: 270, hub: true, r: 30, glyph: ICON.hub, label: managed ? "TECHORDIA" : "Shared layer", sub: managed ? "one accountable owner" : "tickets · reporting · roadmap", depth: 1 });
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
      var svc = [["managed", "Managed IT", ICON.hub], ["projects", "IT Projects", ICON.project]];
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

  /* ---- Techordia "command core" hero (canvas, fully hand-authored) -------
     A Techordia chip wired into a circuit board. Blue signals travel inward
     (requests coming in), teal signals travel outward (work going out), and
     live status chips pop at the pads as jobs complete: threats blocked,
     backups verified, tickets closed. No libraries, theme-aware, HiDPI,
     reduced-motion safe.
     ----------------------------------------------------------------------- */
  function buildCore(box) {
    var canvas = document.createElement("canvas");
    canvas.className = "fx-core";
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", box.getAttribute("data-label") ||
      "The Techordia command core: a circuit board where requests flow in and finished work flows out");
    box.appendChild(canvas);
    var ctx = canvas.getContext("2d");

    // design space is 560x560; everything scales from there -----------------
    var D = 560, CXC = 280, CHIP = 64, CR = 18;   // chip half-size + corner radius
    var TRACES = [
      [[344, 250], [420, 250], [455, 215], [505, 215]],
      [[344, 280], [500, 280]],
      [[344, 310], [410, 310], [445, 345], [505, 345]],
      [[216, 250], [140, 250], [105, 215], [55, 215]],
      [[216, 280], [60, 280]],
      [[216, 310], [150, 310], [115, 345], [55, 345]],
      [[250, 216], [250, 150], [215, 115], [215, 62]],
      [[280, 216], [280, 70]],
      [[310, 216], [310, 150], [345, 115], [345, 58]],
      [[250, 344], [250, 410], [215, 445], [215, 498]],
      [[280, 344], [280, 492]],
      [[310, 344], [310, 410], [345, 445], [345, 502]]
    ].map(function (pts) {
      var segs = [], L = 0;
      for (var i = 1; i < pts.length; i++) {
        var dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1], l = Math.sqrt(dx * dx + dy * dy);
        segs.push({ ax: pts[i - 1][0], ay: pts[i - 1][1], dx: dx, dy: dy, l: l, off: L }); L += l;
      }
      return { pts: pts, segs: segs, L: L, pad: { x: pts[pts.length - 1][0], y: pts[pts.length - 1][1], flash: -1e9 } };
    });
    function pointAt(tr, t) {
      var d = Math.max(0, Math.min(1, t)) * tr.L, segs = tr.segs;
      for (var i = 0; i < segs.length; i++) {
        var s = segs[i];
        if (d <= s.off + s.l || i === segs.length - 1) {
          var k = s.l ? (d - s.off) / s.l : 0;
          return { x: s.ax + s.dx * k, y: s.ay + s.dy * k };
        }
      }
    }

    // the work Techordia quietly gets done, cycled through the status chips
    var MSGS = [
      [ICON.shield, "Threat blocked"],
      [ICON.backup, "Backup verified"],
      [ICON.support, "Ticket closed · 4 min"],
      [ICON.device, "Patches deployed"],
      [ICON.mail, "Phishing quarantined"],
      [ICON.m365, "Microsoft 365 healthy"]
    ];

    var P = {};
    function setPalette() {
      var light = document.documentElement.getAttribute("data-theme") === "light";
      P = light
        ? { grid: "rgba(47,123,246,0.10)", trace: "rgba(47,123,246,0.28)", via: "rgba(47,123,246,0.40)",
            padRing: "rgba(47,123,246,0.50)", padDot: "#0fa39b", glow: "47,123,246", glowA: .10,
            out: [13, 158, 150], inn: [47, 123, 246],
            chipA: "#ffffff", chipB: "#e9f1fd", chipEdge: "rgba(47,123,246,0.38)", chipInner: "rgba(47,123,246,0.14)",
            pin: "rgba(47,123,246,0.45)", bracket: "rgba(12,143,136,0.75)", glyphC: "#2f7bf6",
            label: "#16273f", sub: "#5f728c",
            pillBg: "rgba(255,255,255,0.96)", pillEdge: "rgba(47,123,246,0.25)", pillTx: "#1d3a5f", pillIc: "#0c8f88" }
        : { grid: "rgba(120,170,230,0.07)", trace: "rgba(96,150,220,0.30)", via: "rgba(120,180,240,0.42)",
            padRing: "rgba(130,200,250,0.55)", padDot: "#6fe3da", glow: "50,165,215", glowA: .16,
            out: [111, 227, 218], inn: [111, 182, 255],
            chipA: "#13263f", chipB: "#0b1626", chipEdge: "rgba(125,175,235,0.5)", chipInner: "rgba(125,175,235,0.16)",
            pin: "rgba(110,165,230,0.55)", bracket: "rgba(111,227,218,0.7)", glyphC: "#9fefff",
            label: "#e6f1ff", sub: "#8fa6c4",
            pillBg: "rgba(8,16,30,0.86)", pillEdge: "rgba(120,190,240,0.35)", pillTx: "#cfe8ff", pillIc: "#6fe3da" };
    }
    setPalette();

    var W = 1, H = 1, sc = 1, ox = 0, oy = 0, dpr = 1;
    function resize() {
      var r = box.getBoundingClientRect();
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      canvas.style.width = W + "px"; canvas.style.height = H + "px";
      var M = Math.min(W, H);
      sc = M / D; ox = (W - M) / 2; oy = (H - M) / 2;
      if (!raf) draw(lastNow);
    }

    // pointer parallax: the whole board leans gently toward the cursor ------
    var tiltX = 0, tiltY = 0, curX = 0, curY = 0;
    if (!reduce) {
      box.addEventListener("pointermove", function (e) {
        var r = box.getBoundingClientRect();
        tiltX = ((e.clientX - r.left) / r.width - .5) * 14;
        tiltY = ((e.clientY - r.top) / r.height - .5) * 14;
      });
      box.addEventListener("pointerleave", function () { tiltX = 0; tiltY = 0; });
    }

    function rgb(c, al) { return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + al + ")"; }
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

    // live state -------------------------------------------------------------
    var pulses = [], chips = [], msgIdx = 0, traceIdx = 0;
    var lastSpawn = 0, lastChip = -1e9, coreFlash = -1e9, lastNow = 0;
    var SPEED = 130;                                  // px per second along a trace
    function spawn(t0) {
      traceIdx = (traceIdx + 5) % TRACES.length;      // 5 is coprime with 12 -> visits every trace
      pulses.push({ tr: TRACES[traceIdx], t: t0 || 0, out: Math.random() > 0.35 });
    }

    function pill(cx2, y, icon, label, alpha) {
      ctx.font = "600 12.5px 'Space Grotesk', system-ui, sans-serif";
      ctx.textAlign = "left"; ctx.textBaseline = "middle";
      var tw = ctx.measureText(label).width, w = tw + 44, h = 27;
      var x = Math.max(12, Math.min(D - 12 - w, cx2 - w / 2));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = P.pillBg; rrect(x, y - h / 2, w, h, h / 2); ctx.fill();
      ctx.strokeStyle = P.pillEdge; ctx.lineWidth = 1; ctx.stroke();
      glyph(icon, x + 19, y, 13, P.pillIc);
      ctx.fillStyle = P.pillTx; ctx.fillText(label, x + 31, y + 0.5);
      ctx.globalAlpha = 1;
    }

    function draw(now) {
      lastNow = now;
      ctx.setTransform(dpr * sc, 0, 0, dpr * sc, dpr * (ox + curX * sc), dpr * (oy + curY * sc));
      ctx.clearRect(-ox / sc - 20, -oy / sc - 20, (W / sc) + 40, (H / sc) + 40);
      ctx.lineCap = "round"; ctx.lineJoin = "round";

      // board: faint dot grid + soft glow behind the chip
      ctx.fillStyle = P.grid;
      for (var gx = 28; gx < D; gx += 28) for (var gy = 28; gy < D; gy += 28) {
        if (Math.abs(gx - CXC) < CHIP && Math.abs(gy - CXC) < CHIP) continue;
        ctx.fillRect(gx - 1, gy - 1, 2, 2);
      }
      var flash = Math.max(0, 1 - (now - coreFlash) / 700);
      var breathe = reduce ? 0 : 0.05 * Math.sin(now / 1200);
      var glow = ctx.createRadialGradient(CXC, CXC, CHIP * 0.5, CXC, CXC, 230);
      glow.addColorStop(0, "rgba(" + P.glow + "," + (P.glowA + breathe + flash * 0.14).toFixed(3) + ")");
      glow.addColorStop(1, "rgba(" + P.glow + ",0)");
      ctx.fillStyle = glow; ctx.fillRect(0, 0, D, D);

      // traces, bend vias, endpoint pads
      ctx.strokeStyle = P.trace; ctx.lineWidth = 1.6;
      TRACES.forEach(function (tr) {
        ctx.beginPath(); ctx.moveTo(tr.pts[0][0], tr.pts[0][1]);
        for (var i = 1; i < tr.pts.length; i++) ctx.lineTo(tr.pts[i][0], tr.pts[i][1]);
        ctx.stroke();
      });
      ctx.fillStyle = P.via;
      TRACES.forEach(function (tr) {
        for (var i = 1; i < tr.pts.length - 1; i++) {
          ctx.beginPath(); ctx.arc(tr.pts[i][0], tr.pts[i][1], 2, 0, Math.PI * 2); ctx.fill();
        }
      });
      TRACES.forEach(function (tr) {
        var p = tr.pad, k = Math.max(0, 1 - (now - p.flash) / 900);
        if (k > 0) {
          ctx.beginPath(); ctx.arc(p.x, p.y, 7 + 16 * (1 - k), 0, Math.PI * 2);
          ctx.strokeStyle = rgb(P.out, (0.5 * k).toFixed(3)); ctx.lineWidth = 1.4; ctx.stroke();
        }
        ctx.beginPath(); ctx.arc(p.x, p.y, 6.5, 0, Math.PI * 2);
        ctx.strokeStyle = P.padRing; ctx.lineWidth = 1.3; ctx.stroke();
        ctx.beginPath(); ctx.arc(p.x, p.y, 2.6, 0, Math.PI * 2);
        ctx.fillStyle = k > 0 ? P.padDot : P.via; ctx.fill();
      });

      // travelling signals with fading tails
      pulses.forEach(function (pu) {
        var col = pu.out ? P.out : P.inn;
        var head = pointAt(pu.tr, pu.out ? pu.t : 1 - pu.t);
        for (var k = 1; k <= 4; k++) {
          var bt = pu.t - k * (7 / pu.tr.L);
          if (bt < 0) break;
          var bp = pointAt(pu.tr, pu.out ? bt : 1 - bt);
          ctx.beginPath(); ctx.arc(bp.x, bp.y, 2.1 - k * 0.35, 0, Math.PI * 2);
          ctx.fillStyle = rgb(col, (0.55 - k * 0.12).toFixed(2)); ctx.fill();
        }
        var hg = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, 9);
        hg.addColorStop(0, rgb(col, 0.55)); hg.addColorStop(1, rgb(col, 0));
        ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(head.x, head.y, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = rgb(col, 0.95); ctx.beginPath(); ctx.arc(head.x, head.y, 2.4, 0, Math.PI * 2); ctx.fill();
      });

      // the Techordia chip: pins, body, inner frame, glyph + wordmark
      ctx.fillStyle = P.pin;
      TRACES.forEach(function (tr) {
        var p0 = tr.pts[0], p1 = tr.pts[1];
        var hx = p1[0] === p0[0] ? 0 : (p1[0] > p0[0] ? 1 : -1), hy = p1[1] === p0[1] ? 0 : (p1[1] > p0[1] ? 1 : -1);
        if (hx) ctx.fillRect(p0[0] - (hx < 0 ? 9 : 0), p0[1] - 2.5, 9, 5);
        else ctx.fillRect(p0[0] - 2.5, p0[1] - (hy < 0 ? 9 : 0), 5, 9);
      });
      var body = ctx.createLinearGradient(CXC - CHIP, CXC - CHIP, CXC + CHIP, CXC + CHIP);
      body.addColorStop(0, P.chipA); body.addColorStop(1, P.chipB);
      rrect(CXC - CHIP, CXC - CHIP, CHIP * 2, CHIP * 2, CR);
      ctx.fillStyle = body; ctx.fill();
      ctx.strokeStyle = P.chipEdge; ctx.lineWidth = 1.5; ctx.stroke();
      rrect(CXC - CHIP + 9, CXC - CHIP + 9, CHIP * 2 - 18, CHIP * 2 - 18, CR - 8);
      ctx.strokeStyle = P.chipInner; ctx.lineWidth = 1; ctx.stroke();
      glyph(ICON.hub, CXC, CXC - 18, 30, P.glyphC);
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = "700 14.5px 'Space Grotesk', system-ui, sans-serif";
      ctx.fillStyle = P.label; ctx.fillText("TECHORDIA", CXC, CXC + 14);
      ctx.font = "600 8.5px 'Space Grotesk', system-ui, sans-serif";
      try { ctx.letterSpacing = "2.5px"; } catch (e) {}
      ctx.fillStyle = P.sub; ctx.fillText("IT HANDLED", CXC + 1, CXC + 32);
      try { ctx.letterSpacing = "0px"; } catch (e) {}

      // corner brackets, breathing slowly — the "we're watching" frame
      var ba = 0.55 + (reduce ? 0 : 0.3 * Math.sin(now / 1500));
      ctx.strokeStyle = P.bracket; ctx.lineWidth = 2; ctx.globalAlpha = ba;
      var B = CHIP + 16, K = 13;
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (c) {
        var x = CXC + c[0] * B, y = CXC + c[1] * B;
        ctx.beginPath(); ctx.moveTo(x - c[0] * K, y); ctx.lineTo(x, y); ctx.lineTo(x, y - c[1] * K); ctx.stroke();
      });
      ctx.globalAlpha = 1;

      // status chips: fade in, drift up, fade out
      chips.forEach(function (c) {
        var age = now - c.t0;
        var a = Math.min(1, age / 250) * Math.min(1, Math.max(0, (c.life - age) / 400));
        pill(c.x, c.y - 6 * (age / c.life), c.icon, c.text, a);
      });
    }

    function step(now, dt) {
      if (now - lastSpawn > 620 && pulses.length < 7) { lastSpawn = now; spawn(0); }
      for (var i = pulses.length - 1; i >= 0; i--) {
        var pu = pulses[i];
        pu.t += (dt * SPEED / 1000) / pu.tr.L;
        if (pu.t >= 1) {
          if (pu.out) {
            pu.tr.pad.flash = now;
            if (now - lastChip > 1700 && chips.length < 2) {
              lastChip = now;
              var m = MSGS[msgIdx++ % MSGS.length], p = pu.tr.pad;
              chips.push({ x: p.x, y: p.y < 130 ? p.y + 28 : p.y - 24, icon: m[0], text: m[1], t0: now, life: 3200 });
            }
          } else coreFlash = now;
          pulses.splice(i, 1);
        }
      }
      for (var j = chips.length - 1; j >= 0; j--) if (now - chips[j].t0 > chips[j].life) chips.splice(j, 1);
    }

    var raf = null, running = false, prev = 0;
    function frame(now) {
      var dt = Math.min(50, prev ? now - prev : 16); prev = now;
      curX += (tiltX - curX) * .07; curY += (tiltY - curY) * .07;
      step(now, dt);
      draw(now);
      if (!reduce && !document.hidden) { running = true; raf = requestAnimationFrame(frame); }
      else { running = false; raf = null; }
    }
    function startLoop() { if (!running && !reduce && !document.hidden) { prev = 0; running = true; raf = requestAnimationFrame(frame); } }

    resize();
    if (window.ResizeObserver) { try { new ResizeObserver(resize).observe(box); } catch (e) {} }
    else window.addEventListener("resize", resize);
    try {
      new MutationObserver(function () { setPalette(); if (!raf) draw(lastNow); })
        .observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    } catch (e) {}

    if (reduce) {
      // static composition: a few signals mid-flight and two finished jobs
      [[0, 0.62, true], [4, 0.4, false], [8, 0.78, true], [10, 0.5, false]].forEach(function (s) {
        pulses.push({ tr: TRACES[s[0]], t: s[1], out: s[2] });
      });
      chips.push({ x: TRACES[0].pad.x, y: TRACES[0].pad.y - 24, icon: MSGS[0][0], text: MSGS[0][1], t0: 0, life: 1e9 });
      chips.push({ x: TRACES[9].pad.x, y: TRACES[9].pad.y - 24, icon: MSGS[1][0], text: MSGS[1][1], t0: 0, life: 1e9 });
      draw(0);
      return;
    }
    // pre-seed so the board is alive on first paint
    spawn(0.55); spawn(0.3); spawn(0.1);
    lastChip = -1e9;
    draw(0);
    document.addEventListener("visibilitychange", startLoop);
    startLoop();
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
