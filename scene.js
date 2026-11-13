/* Le Garage Nomade – hand-coded pixel-art scene of Toulouse (320x180 logical pixels). */
(function () {
  'use strict';

  var W = 320, H = 180;
  var canvas = document.getElementById('scene');
  if (!canvas || !canvas.getContext) return;
  var out = canvas.getContext('2d');
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var INK = '#140d18';
  var TEAL = '#1d7b80', TEAL_D = '#12525a', TEAL_L = '#3aa3a3';
  var MUSTARD = '#f2c12e', MUSTARD_D = '#c8941a';
  var CREAM = '#f3e6cc', CREAM_D = '#cdbb98';

  /* ---------- drawing helpers ---------- */
  var g;
  function layer(w, h) {
    var c = document.createElement('canvas');
    c.width = w || W; c.height = h || H;
    return c;
  }
  function use(c) { g = c.getContext('2d'); return g; }
  function R(x, y, w, h, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); }
  function P(x, y, c) { R(x, y, 1, 1, c); }
  function disc(cx, cy, r, c, topHalf) {
    for (var dy = -r; dy <= (topHalf ? 0 : r); dy++) {
      var hw = Math.floor(Math.sqrt((r + 0.5) * (r + 0.5) - dy * dy));
      R(cx - hw, cy + dy, hw * 2 + 1, 1, c);
    }
  }
  function dither(x, y, w, h, c, parity) {
    g.fillStyle = c;
    for (var j = 0; j < h; j++) {
      for (var i = 0; i < w; i++) {
        if (((x + i + y + j) & 1) === (parity || 0)) g.fillRect(x + i, y + j, 1, 1);
      }
    }
  }
  function ditherDisc(cx, cy, r, c, parity) {
    g.fillStyle = c;
    for (var dy = -r; dy <= r; dy++) {
      var hw = Math.floor(Math.sqrt((r + 0.5) * (r + 0.5) - dy * dy));
      for (var dx = -hw; dx <= hw; dx++) {
        if (((cx + dx + cy + dy) & 1) === (parity || 0)) g.fillRect(cx + dx, cy + dy, 1, 1);
      }
    }
  }
  function poly(pts, c) {
    var minY = Infinity, maxY = -Infinity, i;
    for (i = 0; i < pts.length; i++) {
      minY = Math.min(minY, pts[i][1]);
      maxY = Math.max(maxY, pts[i][1]);
    }
    g.fillStyle = c;
    for (var y = Math.floor(minY); y < maxY; y++) {
      var yc = y + 0.5, xs = [];
      for (i = 0; i < pts.length; i++) {
        var a = pts[i], b = pts[(i + 1) % pts.length];
        if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) {
          xs.push(a[0] + (yc - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
        }
      }
      xs.sort(function (p, q) { return p - q; });
      for (var k = 0; k + 1 < xs.length; k += 2) {
        var x0 = Math.round(xs[k]), x1 = Math.round(xs[k + 1]);
        if (x1 > x0) g.fillRect(x0, y, x1 - x0, 1);
      }
    }
  }
  function rng(seed) {
    return function () {
      seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash(a, b) {
    var h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  // Adds a 1px outline around every opaque pixel of a canvas.
  function outline(c, col) {
    var cx = c.getContext('2d'), w = c.width, h = c.height;
    var d = cx.getImageData(0, 0, w, h).data;
    function on(x, y) { return x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 0; }
    cx.fillStyle = col;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        if (!on(x, y) && (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1))) cx.fillRect(x, y, 1, 1);
      }
    }
  }
  // Builds an outlined sprite from string rows; '.' is transparent.
  function sprite(rows, pal) {
    var c = layer(rows[0].length + 2, rows.length + 2);
    use(c);
    for (var y = 0; y < rows.length; y++) {
      for (var x = 0; x < rows[y].length; x++) {
        var ch = rows[y][x];
        if (ch !== '.') P(x + 1, y + 1, pal[ch]);
      }
    }
    outline(c, INK);
    return c;
  }

  // 6px-tall pixel font for the van lettering
  var FONT = {
    A: ['.##.', '#..#', '#..#', '####', '#..#', '#..#'],
    D: ['###.', '#..#', '#..#', '#..#', '#..#', '###.'],
    E: ['###', '#..', '##.', '#..', '#..', '###'],
    G: ['.###', '#...', '#...', '#.##', '#..#', '.###'],
    L: ['#..', '#..', '#..', '#..', '#..', '###'],
    M: ['#...#', '##.##', '#.#.#', '#...#', '#...#', '#...#'],
    N: ['#..#', '##.#', '#.##', '#..#', '#..#', '#..#'],
    O: ['.##.', '#..#', '#..#', '#..#', '#..#', '.##.'],
    R: ['###.', '#..#', '#..#', '###.', '#.#.', '#..#'],
    ' ': ['..', '..', '..', '..', '..', '..']
  };
  function textWidth(s) {
    var w = -1;
    for (var i = 0; i < s.length; i++) w += FONT[s[i]][0].length + 1;
    return w;
  }
  function text(s, x, y, c, width) {
    // Optional width: spread the letters so the line spans exactly that many pixels
    var glyphs = 0, gaps = s.length - 1, extra = 0, i;
    if (width) {
      for (i = 0; i < s.length; i++) glyphs += FONT[s[i]][0].length;
      extra = width - glyphs - gaps;
    }
    for (i = 0; i < s.length; i++) {
      var gl = FONT[s[i]];
      for (var r = 0; r < gl.length; r++) {
        for (var k = 0; k < gl[r].length; k++) if (gl[r][k] === '#') P(x + k, y + r, c);
      }
      x += gl[0].length + 1;
      if (extra > 0 && i < gaps) x += Math.floor(extra * (i + 1) / gaps) - Math.floor(extra * i / gaps);
    }
  }
  // Text with a solid 1px outline, like a vinyl decal.
  function decal(s, x, y, c, width) {
    for (var dy = -1; dy <= 1; dy++) {
      for (var dx = -1; dx <= 1; dx++) if (dx || dy) text(s, x + dx, y + dy, INK, width);
    }
    text(s, x, y, c, width);
  }

  /* ---------- static layers ---------- */
  var SUN = { x: 212, y: 86, r: 14 };
  var HORIZON = 101, WATER = 113, QUAY = 127;

  function buildSky() {
    var c = layer(); use(c);
    var bands = ['#1f1636', '#2e1a45', '#45204f', '#642858', '#86305d', '#a8395f',
                 '#c9465f', '#e2585c', '#ef7349', '#f69445', '#fbb54f'];
    var n = bands.length, i, y0, y1;
    for (i = 0; i < n; i++) {
      y0 = Math.round(i * HORIZON / n);
      y1 = i === n - 1 ? H : Math.round((i + 1) * HORIZON / n);
      R(0, y0, W, y1 - y0, bands[i]);
    }
    for (i = 0; i < n - 1; i++) {
      y1 = Math.round((i + 1) * HORIZON / n);
      dither(0, y1 - 1, W, 1, bands[i + 1], 0);
    }
    ditherDisc(SUN.x, SUN.y, SUN.r + 5, '#fcc865', 0);
    disc(SUN.x, SUN.y, SUN.r + 1, '#ffd27e');
    disc(SUN.x, SUN.y, SUN.r - 3, '#ffe7a8');
    return c;
  }

  function tower(cx, baseY, tiers, spire) {
    var y = baseY;
    tiers.forEach(function (t) {
      var x0 = cx - t.w / 2, top = y - t.h;
      R(x0, top, t.w, t.h, '#cd7356');
      R(x0, top, 1, t.h, '#a3523f');
      R(x0 + t.w - 1, top, 1, t.h, '#eb9b72');
      R(x0 - 1, top, t.w + 2, 1, '#f0ac82');
      var n = t.w >= 10 ? 3 : 2;
      for (var k = 1; k <= n; k++) {
        var ox = Math.round(x0 + k * t.w / (n + 1)) - 1;
        R(ox, top + 3, 1, t.h - 4, '#5a2232');
        P(ox, top + 2, '#7a3540');
      }
      y = top;
    });
    if (spire) {
      for (var i = 0; i < spire; i++) {
        var w = i < spire / 3 ? 4 : 2;
        R(cx - w / 2, y - 1 - i, w, 1, i < spire / 3 ? '#8f88a3' : '#a7a0b8');
      }
      P(cx - 1, y - spire - 2, INK);
      R(cx - 2, y - spire - 3, 3, 1, INK);
      P(cx - 1, y - spire - 4, INK);
    } else {
      for (var p = -1; p <= 1; p++) R(cx - 1 + p * (tiers[tiers.length - 1].w / 2), y - 2, 1, 2, '#cd7356');
    }
  }

  function buildCity() {
    var c = layer(); use(c);
    var r = rng(7), x, w, h, i;

    // Distant rooftops
    for (x = -4; x < W; x += w) {
      w = 6 + Math.floor(r() * 10); h = 4 + Math.floor(r() * 11);
      R(x, HORIZON - 8 - h, w, h + 8, '#8a3f5c');
      if (r() < 0.4) R(x + 2, HORIZON - 10 - h, 1, 2, '#8a3f5c');
    }

    // Dôme de la Grave
    R(162, 88, 28, 13, '#c97a5e');
    R(162, 87, 28, 1, '#e8a580');
    R(169, 79, 14, 9, '#d58a68');
    for (i = 171; i < 182; i += 3) R(i, 80, 1, 8, '#b06248');
    R(168, 78, 16, 1, '#ecb08a');
    disc(176, 78, 8, '#6f6585', true);
    disc(177, 77, 5, '#9a8fae', true);
    R(174, 66, 4, 5, '#d58a68');
    R(173, 66, 6, 1, '#ecb08a');
    P(175, 65, '#6f6585'); P(176, 65, '#6f6585');
    P(176, 63, INK); R(175, 64, 1, 1, INK); P(176, 64, INK);

    // Jacobins tower (flat top with pinnacles), backlit by the sun
    tower(224, 96, [{ w: 8, h: 12 }, { w: 6, h: 10 }, { w: 6, h: 8 }], 0);

    // Basilique Saint-Sernin: nave + octagonal bell tower
    R(232, 90, 40, 11, '#c86a50');
    poly([[230, 90], [252, 82], [274, 90]], '#8e3a2c');
    tower(252, 90, [{ w: 14, h: 12 }, { w: 12, h: 10 }, { w: 10, h: 9 }, { w: 8, h: 8 }, { w: 6, h: 7 }], 15);

    // Far-bank brick buildings along the Garonne
    var walls = ['#c0634f', '#cf7259', '#b45844', '#d98466'];
    for (x = -4; x < W; x += w) {
      w = 10 + Math.floor(r() * 14); h = 6 + Math.floor(r() * 9);
      var top = HORIZON - h;
      R(x, top, w, h, walls[Math.floor(r() * walls.length)]);
      R(x - 1, top - 1, w + 2, 1, '#7c3127');
      R(x, top - 2, w, 1, '#9c4232');
      R(x + w - 1, top, 1, h, '#97463a');
      for (var wy = top + 2; wy < HORIZON - 3; wy += 4) {
        for (var wx = x + 2; wx < x + w - 2; wx += 3) {
          R(wx, wy, 1, 2, r() < 0.3 ? '#ffcf6e' : '#6b2a3a');
        }
      }
    }

    // Garonne
    var water = ['#7a3a5c', '#6a3358', '#5a2c52', '#4b264c', '#3e2146'];
    for (i = 0; i < water.length; i++) {
      var wy0 = WATER + i * 3;
      R(0, wy0, W, i === water.length - 1 ? QUAY - wy0 + 2 : 3, water[i]);
      if (i) dither(0, wy0, W, 1, water[i - 1], 0);
    }
    R(0, HORIZON, W, WATER - HORIZON, '#5a2c52');

    // Pont Neuf: brick arches with round openings over each pier
    R(0, 96, W, WATER - 96, '#b8563d');
    R(0, 95, W, 1, '#df8a66');
    R(0, 99, W, 1, '#8e3d2e');
    for (x = -6; x < W; x += 31) {
      var aw = 12;
      for (var y = 103; y < WATER; y++) {
        var t = (WATER - y) / (WATER - 103);
        var hw = Math.round(aw * Math.sqrt(Math.max(0, 1 - t * t)));
        var ac = x + aw;
        R(ac - hw, y, hw * 2, 1, '#2d1c3c');
        P(ac - hw - 1, y, '#d6714f');
        P(ac + hw, y, '#d6714f');
      }
      var pc = x + 27;
      disc(pc, 104, 2, '#d6714f');
      disc(pc, 104, 1, '#2d1c3c');
    }
    // Bridge reflection
    for (i = 0; i < 4; i++) {
      for (x = 0; x < W; x += 2 + Math.floor(r() * 3)) {
        if (r() < 0.6) R(x, WATER + 1 + i * 2, 1 + Math.floor(r() * 3), 1, '#8a3f45');
      }
    }
    return c;
  }

  var LAMP_X = 186;

  function buildFront() {
    var c = layer(); use(c);
    var r = rng(21), x, y, i;

    // Quay parapet
    R(0, QUAY, W, 9, '#a34c3a');
    R(0, QUAY - 1, W, 2, '#d98868');
    for (y = QUAY + 2; y < QUAY + 9; y += 2) {
      R(0, y, W, 1, '#8a3e30');
      for (x = (y / 2) % 2 ? 0 : 3; x < W; x += 6) P(x, y + 1, '#8a3e30');
    }

    // Cobblestones, rows growing with perspective
    var ROAD = QUAY + 9;
    R(0, ROAD, W, H - ROAD, '#4b3138');
    var rowH = 3, sw = 7, row = 0;
    for (y = ROAD; y < H; y += rowH + 1, rowH += 0.5, sw += 1.2, row++) {
      var hh = Math.floor(rowH);
      R(0, y, W, 1, '#33212a');
      var off = row % 2 ? Math.floor(sw / 2) : 0;
      for (x = -off; x < W; x += Math.floor(sw)) {
        R(x, y + 1, 1, hh, '#33212a');
        R(x + 1, y + 1, Math.floor(sw) - 2, 1, '#5e4047');
        if (r() < 0.3) R(x + 2, y + 2, Math.floor(sw) - 4, Math.max(1, hh - 2), '#553a41');
      }
    }

    // Warm light pool under the lamp
    for (i = -2; i <= 2; i++) {
      var pw = Math.round(18 * Math.sqrt(1 - (i * i) / 9));
      dither(LAMP_X - pw, 165 + i, pw * 2 + 1, 1, '#7a5148', 0);
    }

    // Near-left brick building
    R(0, 6, 40, ROAD - 6, '#c96a4f');
    for (y = 8; y < ROAD; y += 3) {
      for (x = (y % 2) * 3; x < 38; x += 6) R(x, y, 2, 1, '#b65c45');
    }
    R(0, 4, 42, 2, '#e19a78');
    R(0, 6, 42, 1, '#9c4a38');
    R(38, 6, 2, ROAD - 6, '#8f4434');
    for (var f = 0; f < 3; f++) {
      var fy = 14 + f * 30;
      for (var col = 0; col < 2; col++) {
        var fx = 5 + col * 18;
        R(fx - 3, fy, 2, 15, '#5f8c86');
        R(fx + 9, fy, 2, 15, '#5f8c86');
        R(fx - 1, fy, 10, 15, '#3b2340');
        R(fx - 1, fy - 1, 10, 1, '#e19a78');
        if (hash(f, col) < 0.5) {
          R(fx, fy + 1, 8, 13, '#f2b45a');
          R(fx + 4, fy + 1, 1, 13, '#c98a3c');
          R(fx, fy + 7, 8, 1, '#c98a3c');
        } else {
          R(fx + 4, fy, 1, 15, '#2a1830');
        }
      }
      if (f === 1) {
        R(1, fy + 15, 37, 1, INK);
        for (x = 2; x < 38; x += 3) R(x, fy + 11, 1, 4, INK);
        R(1, fy + 10, 37, 1, INK);
      }
    }
    // Ground-floor arcade
    for (y = 0; y < 26; y++) {
      var aw = y < 10 ? Math.round(13 * Math.sqrt(1 - Math.pow((10 - y) / 10, 2))) : 13;
      R(19 - aw, 104 + y, aw * 2, 1, '#2a1620');
      P(18 - aw, 104 + y, '#e19a78');
    }
    ditherDisc(19, 112, 4, '#f7b24a', 0);
    R(18, 110, 2, 3, '#ffe7a8');

    // Plane tree on the right
    R(298, 66, 5, ROAD - 66, '#6b5a4a');
    for (i = 0; i < 18; i++) R(298 + Math.floor(r() * 4), 70 + Math.floor(r() * (ROAD - 74)), 2, 2, '#a8977a');
    R(292, 84, 7, 2, '#6b5a4a');
    var blobs = [[304, 44, 20], [282, 58, 13], [316, 66, 14], [292, 34, 12], [298, 70, 11]];
    blobs.forEach(function (b) { disc(b[0], b[1], b[2], '#2c3a32'); });
    blobs.forEach(function (b) { disc(b[0] - 2, b[1] - 3, b[2] - 4, '#3a5440'); });
    blobs.forEach(function (b) { ditherDisc(b[0] - 3, b[1] - 5, b[2] - 8, '#4f7350', 1); });

    // Street lamp
    R(LAMP_X, 104, 1, 60, INK);
    R(LAMP_X - 1, 160, 3, 4, INK);
    R(LAMP_X - 1, 128, 3, 1, INK);
    ditherDisc(LAMP_X, 101, 5, '#ffd27a', 0);
    R(LAMP_X - 3, 97, 7, 1, INK);
    R(LAMP_X - 2, 96, 5, 1, INK);
    P(LAMP_X, 95, INK);
    R(LAMP_X - 2, 98, 5, 6, INK);
    R(LAMP_X - 1, 99, 3, 4, '#ffe7a8');
    return c;
  }

  var VO = 2; // van canvas padding (room for the outline)

  function buildVan() {
    var c = layer(112, 40); use(c);
    function V(x, y, w, h, col) { R(x + VO, y + VO, w, h, col); }
    function VP(pts, col) { poly(pts.map(function (p) { return [p[0] + VO, p[1] + VO]; }), col); }

    VP([[3, 0], [81, 0], [84, 2], [94, 15], [103, 18], [105, 21], [105, 34], [0, 34], [0, 3]], TEAL);
    g.globalCompositeOperation = 'source-atop';
    V(0, 0, 110, 5, CREAM);
    V(0, 5, 110, 1, CREAM_D);
    V(0, 6, 110, 1, TEAL_L);
    V(0, 29, 110, 6, TEAL_D);
    V(0, 21, 110, 3, MUSTARD);
    V(0, 24, 110, 1, MUSTARD_D);
    VP([[76, 7], [86, 7], [95, 18], [76, 18]], TEAL_D);
    VP([[77, 8], [85, 8], [93, 17], [77, 17]], '#8fc9d3');
    VP([[80, 8], [83, 8], [88, 17], [85, 17]], '#c3e6ea');
    V(55, 6, 1, 23, TEAL_D);
    V(73, 6, 1, 23, TEAL_D);
    V(75, 6, 1, 23, TEAL_D);
    V(70, 18, 2, 1, INK);
    V(78, 19, 3, 1, INK);
    V(0, 25, 2, 3, '#d6453a');
    V(0, 28, 2, 1, '#8e2a20');
    V(103, 22, 2, 3, '#fff2b0');
    // Both lines share one font size and are justified to the same width
    var lw = textWidth('LE GARAGE');
    decal('LE GARAGE', 2 + VO, 7 + VO, CREAM);
    decal('NOMADE', 2 + VO, 14 + VO, MUSTARD, lw);
    disc(22 + VO, 34 + VO, 9, INK, true);
    disc(86 + VO, 34 + VO, 9, INK, true);
    g.globalCompositeOperation = 'source-over';
    V(98, 30, 9, 4, MUSTARD);
    V(98, 33, 9, 1, MUSTARD_D);
    V(-1, 30, 5, 4, MUSTARD);
    V(-1, 33, 5, 1, MUSTARD_D);
    V(94, 12, 2, 4, TEAL_D);
    outline(c, INK);
    return c;
  }

  // The sliding door is cut from the finished van so it matches exactly.
  function buildDoor(van) {
    var c = layer(19, 23); use(c);
    g.drawImage(van, 55 + VO, 6 + VO, 19, 23, 0, 0, 19, 23);
    R(0, 0, 1, 23, INK);
    R(18, 0, 1, 23, INK);
    return c;
  }

  function drawInterior(x, y) {
    R(x + 56, y + 6, 17, 23, '#2a1a22');
    R(x + 57, y + 7, 15, 12, '#c9b48a');
    for (var py = 9; py < 18; py += 2) for (var px = 58; px < 72; px += 2) P(x + px, y + py, '#a8946c');
    R(x + 57, y + 7, 15, 1, '#fff2b0');
    // wrench, hammer, screwdriver, pliers
    R(x + 59, y + 9, 1, 7, '#d4dbdc'); P(x + 58, y + 9, '#d4dbdc'); P(x + 60, y + 9, '#d4dbdc');
    R(x + 63, y + 10, 1, 6, '#8a5a3a'); R(x + 62, y + 9, 3, 2, '#9aa0a8');
    R(x + 67, y + 9, 1, 3, '#d4dbdc'); R(x + 67, y + 12, 1, 4, '#d6453a');
    P(x + 69, y + 9, '#d4dbdc'); P(x + 71, y + 9, '#d4dbdc');
    R(x + 70, y + 10, 1, 2, '#d4dbdc'); R(x + 69, y + 12, 1, 4, '#3a7bd5'); R(x + 71, y + 12, 1, 4, '#3a7bd5');
    R(x + 56, y + 19, 17, 1, '#7a4a2a');
    R(x + 57, y + 20, 8, 8, MUSTARD);
    R(x + 57, y + 22, 8, 1, MUSTARD_D); R(x + 57, y + 25, 8, 1, MUSTARD_D);
    R(x + 60, y + 21, 2, 1, INK); R(x + 60, y + 24, 2, 1, INK);
    R(x + 66, y + 23, 6, 5, '#c0392b'); R(x + 66, y + 23, 6, 1, '#e0574a');
    R(x + 68, y + 21, 2, 1, INK); P(x + 67, y + 22, INK); P(x + 70, y + 22, INK);
  }

  function drawWheel(cx, cy, angle) {
    disc(cx, cy, 7, '#17121a');
    disc(cx, cy, 4, '#7d7f86');
    disc(cx, cy, 2, '#c9ccd2');
    P(cx - 4, cy - 5, '#3a3440'); P(cx - 5, cy - 4, '#3a3440');
    for (var k = 0; k < 4; k++) {
      var a = angle + k * Math.PI / 2;
      P(cx + Math.round(Math.cos(a) * 3), cy + Math.round(Math.sin(a) * 3), '#3d3f45');
    }
  }

  var MECH_PAL = {
    c: MUSTARD, C: MUSTARD_D, h: '#4a2a1a', s: '#f0b48a', S: '#c98560', e: INK,
    b: '#e8e0d0', O: TEAL, o: TEAL_D, y: '#0d3d42', B: '#3a2418', w: '#d4dbdc'
  };
  var MECH_TOP = [
    '....cccc....',
    '...cccccc...',
    '...ccccccc..',
    '...CCCCCCCCC',
    '...hhsssss..',
    '...hssssess.',
    '...hsssssss.',
    '...hssssss..',
    '....Sssss...',
    '.....sSs....',
    '...bOOOOOb..',
    '..bbOOOOObb.',
    '..bbOOyOObb.',
    '..bbOOOOObb.',
    '..ssOOOOOss.',
    '..ss.OOO.ss.',
    '....oooooo..'
  ];
  var MECH_WAVE_TOP = MECH_TOP.slice(0, 10).concat([
    '...bOOOOObss',
    '..bbOOOOObs.',
    '..bbOOyOOb..',
    '..bbOOOOO...',
    '..ssOOOOO...',
    '..ss.OOO....',
    '....oooooo..'
  ]);
  var LEGS_STAND = [
    '....OOOOOO..',
    '....OO..OO..',
    '....OO..OO..',
    '....OO..OO..',
    '....OO..OO..',
    '....OO..OO..',
    '...BBB..BBBB'
  ];
  var LEGS_STEP = [
    '....OOOOOO..',
    '...OO...OO..',
    '...OO....OO.',
    '..OO.....OO.',
    '..OO......OO',
    '..OO......OO',
    '.BBB......BBB'.slice(0, 12)
  ];

  /* ---------- assemble ---------- */
  var sky = buildSky(), city = buildCity(), front = buildFront();
  var van = buildVan(), door = buildDoor(van);
  var mech = {
    stand: sprite(MECH_TOP.concat(LEGS_STAND), MECH_PAL),
    step: sprite(MECH_TOP.concat(LEGS_STEP), MECH_PAL),
    wave: sprite(MECH_WAVE_TOP.concat(LEGS_STAND), MECH_PAL)
  };
  var buf = layer();

  var r0 = rng(99), i;
  var stars = [];
  for (i = 0; i < 28; i++) stars.push({ x: Math.floor(r0() * W), y: 1 + Math.floor(r0() * 26), p: r0() * 10 });
  var clouds = [];
  for (i = 0; i < 6; i++) {
    clouds.push({ x: r0() * (W + 80), y: 22 + Math.floor(r0() * 40), w: 14 + Math.floor(r0() * 22), v: 1 + r0() * 2.5 });
  }
  var sparkles = [];
  for (i = 0; i < 45; i++) {
    sparkles.push({
      x: r0() * W, y: WATER + 2 + Math.floor(r0() * (QUAY - WATER - 3)),
      l: 1 + Math.floor(r0() * 4), v: 2 + r0() * 5, p: r0() * 3,
      c: ['#f0773a', '#ffb070', '#e2566b'][Math.floor(r0() * 3)]
    });
  }

  var PARK_X = 44, VAN_Y = 121, DRIVE_START = 0.4, DRIVE_TIME = 3;

  function vanX(t) {
    var p = Math.min(1, Math.max(0, (t - DRIVE_START) / DRIVE_TIME));
    return Math.round(-120 + (PARK_X + 120) * (1 - Math.pow(1 - p, 3)));
  }

  function drawCloud(x, y, w) {
    R(x + 4, y - 2, w - 10, 1, '#ffb38a');
    R(x, y - 1, w, 2, '#e8786e');
    R(x + 3, y + 1, w - 4, 1, '#b4506a');
    R(x + 6, y - 3, Math.floor(w / 3), 1, '#ffb38a');
  }

  function drawMechanic(t, vx) {
    var appear = 4.9;
    if (t < appear) return;
    var walk = Math.min(1, (t - appear) / 2);
    var mx = Math.round(vx + 62 + walk * 50), my = VAN_Y + 19;
    var frame = mech.stand, waving = false;
    if (walk < 1) {
      frame = Math.floor(t * 7) % 2 ? mech.step : mech.stand;
    } else if ((t - appear) % 4 > 2.6) {
      waving = Math.floor(t * 6) % 2 === 0;
      frame = waving ? mech.wave : mech.stand;
    }
    g.drawImage(frame, mx - 1, my - 1);
    // Toolbox in the back hand
    R(mx - 2, my + 16, 6, 4, '#c0392b');
    R(mx - 2, my + 16, 6, 1, '#e0574a');
    R(mx - 2, my + 19, 6, 1, '#8e2a20');
    // Wrench in the front hand
    if (waving) {
      R(mx + 11, my + 6, 1, 4, '#d4dbdc');
      P(mx + 10, my + 5, '#d4dbdc'); P(mx + 12, my + 5, '#d4dbdc');
    } else {
      R(mx + 10, my + 16, 1, 3, '#d4dbdc');
      P(mx + 9, my + 19, '#d4dbdc'); P(mx + 11, my + 19, '#d4dbdc');
    }
  }

  function draw(t) {
    use(buf);
    g.drawImage(sky, 0, 0);

    var tick = Math.floor(t * 2);
    stars.forEach(function (s, k) {
      if (hash(k, tick + Math.floor(s.p)) > 0.15) P(s.x, s.y, s.y < 12 ? '#f3d6e6' : '#d9a3c0');
    });
    clouds.forEach(function (c) {
      var x = Math.round(((c.x + t * c.v) % (W + 80)) - 40);
      drawCloud(x, c.y, c.w);
    });
    var bx = Math.round(((t * 14) % (W + 80)) - 40), flap = Math.floor(t * 4) % 2;
    [[0, 0], [-7, 3], [-12, -2]].forEach(function (b) {
      var x = bx + b[0], y = 34 + b[1];
      if (flap) { P(x - 1, y - 1, INK); P(x, y, INK); P(x + 1, y - 1, INK); }
      else { R(x - 1, y, 3, 1, INK); }
    });

    g.drawImage(city, 0, 0);

    var st = Math.floor(t * 4);
    for (var y = WATER + 2, k = 0; y < QUAY - 1; y += 2, k++) {
      var hw = Math.round((5 + hash(k, st) * 6) * (1 - (y - WATER) / 22));
      if (hw > 0) R(SUN.x - hw, y, hw * 2, 1, k % 2 ? '#f59a4f' : '#ffcf7a');
    }
    sparkles.forEach(function (s) {
      if ((Math.floor(t * 3 + s.p) % 3) === 0) return;
      var x = Math.round(((s.x + t * s.v) % (W + 10)) - 5);
      R(x, s.y, s.l, 1, s.c);
    });

    g.drawImage(front, 0, 0);

    var vx = vanX(t);
    var moving = t > DRIVE_START && t < DRIVE_START + DRIVE_TIME;
    var bounce = moving && Math.floor(t * 10) % 2 ? 1 : 0;

    R(vx + 3, VAN_Y + 41, 102, 2, '#2c1c22');
    dither(vx + 1, VAN_Y + 43, 106, 1, '#2c1c22', 0);

    if (moving) dither(vx + 107, VAN_Y + 21, 14, 4, '#ffe9a8', 0);

    function drawVanBody() {
      g.drawImage(van, vx - VO, VAN_Y - VO + bounce);
      var open = Math.min(1, Math.max(0, (t - 3.9) / 0.8));
      if (open > 0) {
        drawInterior(vx, VAN_Y + bounce);
        g.drawImage(door, vx + 55 - Math.round(13 * open), VAN_Y + 6 + bounce);
      }
      var ang = (vx + 120) / 7;
      drawWheel(vx + 22, VAN_Y + 34, ang);
      drawWheel(vx + 86, VAN_Y + 34, ang);
    }

    if (game.state === 'off') {
      drawVanBody();
      drawMechanic(t, vx);
    } else {
      drawGame(t, drawVanBody);
    }
  }

  /* ---------- mini-game: collect car parts ---------- */
  var GAME_TIME = 40, VAN_FEET = VAN_Y + 41;
  var BLOCK = { x0: PARK_X - 4, x1: PARK_X + 112, y0: VAN_Y + 29, y1: VAN_Y + 45 };
  var BOUNDS = { x0: 7, x1: W - 7, y0: QUAY + 15, y1: H - 9 };
  var PART_PAL = {
    t: '#17121a', r: '#9aa0a8', h: '#d4dbdc', w: '#f3e6cc', g: '#7d7f86', c: '#c0392b',
    C: '#e0574a', y: MUSTARD, B: '#2c2c34', n: '#d6453a', G: '#ffd447', D: '#c8941a'
  };
  var PARTS = [
    { name: 'pneu', rows: ['..ttt..', '.ttttt.', 'ttrrrtt', 'ttrhrtt', 'ttrrrtt', '.ttttt.', '..ttt..'] },
    { name: 'bougie', rows: ['.h.', 'hhh', 'www', 'www', 'www', 'ggg', '.g.', '.g.'] },
    { name: 'bidon', rows: ['.hh...', 'ccccc.', 'cyyCcc', 'cyyccc', 'cccccc', 'cccccc'] },
    { name: 'batterie', rows: ['.n...h.', 'BBBBBBB', 'ByyyyyB', 'BBBBBBB', 'BBBBBBB'] },
    { name: 'engrenage', rows: ['...r...', '.rrrrr.', '.rr.rr.', 'rr...rr', '.rr.rr.', '.rrrrr.', '...r...'] }
  ];
  var GOLD_WRENCH = { name: 'cle', bonus: true, rows: ['G.G....', 'GGG....', '.GD....', '..GD...', '...GD..', '....GGG', '....G.G'] };
  PARTS.concat([GOLD_WRENCH]).forEach(function (p) { p.img = sprite(p.rows, PART_PAL); });

  var game = { state: 'off', score: 0, time: 0, parts: [], fx: [], spawnIn: 0, keys: {}, target: null };
  var player = { x: 0, y: 0, dir: 1, moving: false, walk: 0 };

  var ui = {
    start: document.getElementById('game-start'),
    hud: document.getElementById('game-hud'),
    score: document.getElementById('game-score'),
    time: document.getElementById('game-time'),
    hint: document.getElementById('game-hint'),
    over: document.getElementById('game-over'),
    result: document.getElementById('game-result'),
    again: document.getElementById('game-again'),
    quit: document.getElementById('game-quit')
  };

  function readRecord() {
    try { return parseInt(localStorage.getItem('garageNomadeRecord'), 10) || 0; } catch (e) { return 0; }
  }
  function saveRecord(v) {
    try { localStorage.setItem('garageNomadeRecord', String(v)); } catch (e) { /* storage disabled */ }
  }

  function blocked(x, y) {
    return x + 5 > BLOCK.x0 && x - 5 < BLOCK.x1 && y > BLOCK.y0 && y < BLOCK.y1;
  }

  function spawnPart() {
    var type = Math.random() < 0.1 ? GOLD_WRENCH : PARTS[Math.floor(Math.random() * PARTS.length)];
    for (var tries = 0; tries < 30; tries++) {
      var x = BOUNDS.x0 + 4 + Math.random() * (BOUNDS.x1 - BOUNDS.x0 - 8);
      var y = BOUNDS.y0 + 2 + Math.random() * (BOUNDS.y1 - BOUNDS.y0 - 2);
      // Keep parts out of the van's footprint and away from the player
      if (x > PARK_X - 8 && x < PARK_X + 116) continue;
      if (Math.abs(x - player.x) < 24 && Math.abs(y - player.y) < 12) continue;
      game.parts.push({ type: type, x: Math.round(x), y: Math.round(y), age: 0, life: type.bonus ? 4 : 6.5 });
      return;
    }
  }

  function startGame() {
    game.state = 'play';
    game.score = 0;
    game.time = GAME_TIME;
    game.parts = [];
    game.fx = [];
    game.spawnIn = 0.3;
    game.keys = {};
    game.target = null;
    player.x = PARK_X + 118; player.y = VAN_FEET + 2; player.dir = 1;
    ui.start.hidden = true;
    ui.over.hidden = true;
    ui.hud.hidden = false;
    ui.hint.hidden = false;
    ui.score.textContent = '0';
    ui.time.textContent = String(GAME_TIME);
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    canvas.parentElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    ensureLoop();
  }

  function endGame() {
    game.state = 'over';
    var record = readRecord(), isNew = game.score > record;
    if (isNew) saveRecord(game.score);
    ui.result.textContent = 'Pièces ramassées : ' + game.score + ' — ' +
      (isNew ? 'Nouveau record !' : 'Record : ' + record);
    ui.hud.hidden = true;
    ui.over.hidden = false;
    ui.again.focus();
  }

  function quitGame() {
    game.state = 'off';
    game.parts = [];
    ui.over.hidden = true;
    ui.hud.hidden = true;
    ui.start.hidden = false;
    ui.start.focus();
  }

  function updateGame(dt) {
    game.time -= dt;
    if (game.time <= 0) { game.time = 0; endGame(); return; }
    ui.time.textContent = String(Math.ceil(game.time));
    if (GAME_TIME - game.time > 3) ui.hint.hidden = true;

    var k = game.keys, dx = 0, dy = 0;
    if (k.ArrowLeft) dx -= 1;
    if (k.ArrowRight) dx += 1;
    if (k.ArrowUp) dy -= 1;
    if (k.ArrowDown) dy += 1;
    if (!dx && !dy && game.target) {
      var tx = game.target.x - player.x, ty = game.target.y - player.y;
      if (Math.abs(tx) > 1.5) dx = tx > 0 ? 1 : -1;
      if (Math.abs(ty) > 1.5) dy = ty > 0 ? 1 : -1;
    }
    player.moving = !!(dx || dy);
    if (player.moving) {
      var speed = 62 * dt / (dx && dy ? Math.SQRT2 : 1);
      if (dx) player.dir = dx;
      var nx = Math.min(BOUNDS.x1, Math.max(BOUNDS.x0, player.x + dx * speed));
      if (!blocked(nx, player.y)) player.x = nx;
      var ny = Math.min(BOUNDS.y1, Math.max(BOUNDS.y0, player.y + dy * speed * 0.7));
      if (!blocked(player.x, ny)) player.y = ny;
      player.walk += dt;
    }

    game.spawnIn -= dt;
    if (game.spawnIn <= 0 && game.parts.length < 5) {
      spawnPart();
      game.spawnIn = 0.8 + Math.random() * 0.7;
    }

    game.parts = game.parts.filter(function (p) {
      p.age += dt;
      if (Math.abs(p.x - player.x) < 8 && Math.abs(p.y - player.y) < 6) {
        game.score += 1;
        if (p.type.bonus) game.time += 5;
        ui.score.textContent = String(game.score);
        for (var i = 0; i < 6; i++) {
          var a = i * Math.PI / 3;
          game.fx.push({ x: p.x, y: p.y - 4, vx: Math.cos(a) * 30, vy: Math.sin(a) * 30 - 10, age: 0, c: p.type.bonus ? '#ffd447' : '#fff2b0' });
        }
        return false;
      }
      return p.age < p.life;
    });
    game.fx = game.fx.filter(function (f) { f.age += dt; return f.age < 0.4; });
  }

  function drawPlayer() {
    var spr = player.moving && Math.floor(player.walk * 8) % 2 ? mech.step : mech.stand;
    var x = Math.round(player.x) - 7, y = Math.round(player.y) - 25;
    R(x + 3, y + 25, 9, 1, '#2c1c22');
    if (player.dir < 0) {
      g.save();
      g.translate(x + spr.width, y);
      g.scale(-1, 1);
      g.drawImage(spr, 0, 0);
      g.restore();
    } else {
      g.drawImage(spr, x, y);
    }
  }

  function drawPart(p, t) {
    var left = p.life - p.age;
    if (left < 1.5 && Math.floor(t * 8) % 2) return;
    var img = p.type.img, bob = Math.floor(t * 3 + p.x) % 2;
    var x = p.x - Math.floor(img.width / 2), y = p.y - img.height - 1 - bob;
    R(p.x - 3, p.y, 7, 1, '#2c1c22');
    g.drawImage(img, x, y);
    if (p.type.bonus && Math.floor(t * 4) % 2) P(x + img.width - 1, y, '#fff7d6');
  }

  function drawGame(t, drawVanBody) {
    var items = [{ y: VAN_FEET, fn: drawVanBody }, { y: player.y, fn: drawPlayer }];
    game.parts.forEach(function (p) { items.push({ y: p.y, fn: function () { drawPart(p, t); } }); });
    items.sort(function (a, b) { return a.y - b.y; });
    items.forEach(function (it) { it.fn(); });
    game.fx.forEach(function (f) {
      P(Math.round(f.x + f.vx * f.age), Math.round(f.y + f.vy * f.age), f.c);
    });
  }

  function toLogical(e) {
    var r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
  }

  var ARROWS = { ArrowLeft: 1, ArrowRight: 1, ArrowUp: 1, ArrowDown: 1 };
  document.addEventListener('keydown', function (e) {
    if (game.state !== 'play') {
      if (game.state === 'over' && e.key === 'Escape') quitGame();
      return;
    }
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (ARROWS[e.key]) { game.keys[e.key] = true; e.preventDefault(); }
    if (e.key === 'Escape') quitGame();
  });
  document.addEventListener('keyup', function (e) { if (ARROWS[e.key]) game.keys[e.key] = false; });
  window.addEventListener('blur', function () { game.keys = {}; });

  canvas.addEventListener('pointerdown', function (e) {
    if (game.state !== 'play') return;
    game.target = toLogical(e);
    canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  canvas.addEventListener('pointermove', function (e) { if (game.target) game.target = toLogical(e); });
  ['pointerup', 'pointercancel'].forEach(function (n) {
    canvas.addEventListener(n, function () { game.target = null; });
  });

  if (ui.start) {
    ui.start.addEventListener('click', startGame);
    ui.again.addEventListener('click', startGame);
    ui.quit.addEventListener('click', quitGame);
  }

  /* ---------- crisp integer scaling ---------- */
  var scale = 1;
  function blit() {
    out.imageSmoothingEnabled = false;
    out.drawImage(buf, 0, 0, W * scale, H * scale);
  }
  function fit() {
    var host = canvas.parentElement.parentElement;
    var cs = getComputedStyle(host);
    var avail = host.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 8;
    var dpr = window.devicePixelRatio || 1;
    scale = Math.max(1, Math.floor(avail * dpr / W));
    canvas.width = W * scale;
    canvas.height = H * scale;
    canvas.style.width = (W * scale / dpr) + 'px';
    blit();
  }

  var start = null, lastStep = -1, lastNow = null, running = false;
  function frame(now) {
    if (start === null) start = now;
    var dt = lastNow === null ? 0 : Math.min(0.1, (now - lastNow) / 1000);
    lastNow = now;
    var t = reduceMotion ? 12 : (now - start) / 1000;
    if (ui.start && ui.start.hidden && game.state === 'off' && t > 7.2) ui.start.hidden = false;
    if (game.state === 'play' && !document.hidden) updateGame(dt);
    var fps = game.state === 'off' ? 15 : 30;
    var step = Math.floor((now - start) / 1000 * fps);
    if (step !== lastStep) { lastStep = step; draw(t); blit(); }
    if (!reduceMotion || game.state !== 'off') {
      requestAnimationFrame(frame);
    } else {
      running = false;
    }
  }
  function ensureLoop() {
    if (running) return;
    running = true;
    lastNow = null;
    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', fit);
  draw(reduceMotion ? 12 : 0);
  fit();
  ensureLoop();
})();
