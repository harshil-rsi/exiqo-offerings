/* ============================================================
   NExT Platform — Deep Dive
   Three views registered onto the explorer's extension point:
     #monoservices  the monolith decomposed into functional sub-services
     #anatomy       per-service layer architecture + animated call chains
     #dataflows     animated end-to-end runtime data-flow simulation
   Data: window.DEEP_DATA (deepdive-data.js), produced by the discovery swarm.
   ============================================================ */
(function () {
  "use strict";

  var D = window.DEEP_DATA || {};
  var EXT = (window.DISCOVERY_EXT = window.DISCOVERY_EXT || { views: {}, after: {} });
  var U = EXT.utils || {};

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function arr(x) { return Array.isArray(x) ? x : (x ? [x] : []); }
  function q(sel, root) { return (root || document).querySelector(sel); }
  function qa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function titleize(s) { return String(s || "").replace(/[-_]/g, " ").replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }
  function name(x) { return typeof x === "string" ? x : (x && (x.name || x.table || x.label)) || ""; }

  var STATUS_LABEL = {
    monolith: "In monolith", hybrid: "Hybrid", "partially-extracted": "Partly extracted",
    extracted: "Extracted", scaffold: "Scaffold", tool: "Tool/library"
  };
  function chip(status) {
    return '<span class="dd-chip st-' + esc(status || "monolith") + '">' +
      esc(STATUS_LABEL[status] || titleize(status)) + "</span>";
  }
  function diffBar(n) {
    var h = '<span class="diffbar" title="Extraction difficulty ' + (n || 0) + ' of 5">';
    for (var i = 1; i <= 5; i++) h += '<i class="' + (i <= (n || 0) ? "on" : "") + '"></i>';
    return h + "</span>";
  }
  function verbs(vs) {
    return arr(vs).map(function (v) { return '<span class="verb v-' + esc(v) + '">' + esc(v) + "</span>"; }).join("");
  }
  function risks(list) {
    if (!arr(list).length) return '<p class="dd-note">No risks recorded for this component.</p>';
    return arr(list).map(function (r) {
      return '<div class="risk-item ' + esc(r.severity || "low") + '">' +
        '<div class="rt">' + esc(r.title || "") + "</div>" +
        '<div class="rd">' + esc(r.detail || "") + "</div>" +
        (r.evidence ? '<div class="re">' + esc(r.evidence) + "</div>" : "") + "</div>";
    }).join("");
  }
  function panel(title, body, sub) {
    return '<div class="panel"><h3>' + esc(title) + "</h3>" +
      (sub ? '<p class="dd-note" style="margin:-8px 0 12px">' + esc(sub) + "</p>" : "") + body + "</div>";
  }

  /* ============================================================
     VIEW 1 — Inside the Monolith
     ============================================================ */
  EXT.views.monoservices = function () {
    var doms = arr(D.domains), s = D.stats || {};
    var h = "";

    h += '<p class="dd-lede">The component catalogue lists the monolith as <strong>one</strong> component. ' +
      'It is not one thing — it is <strong>' + doms.length + ' functional sub-services</strong> sharing a single ' +
      '<code>SafeHarborDbContext</code>, four API hosts and one deployment unit. This is that decomposition, ' +
      'derived from all <strong>' + (s.monolithControllers || 0) + ' controllers</strong> in the code rather than from the module map — shown alongside the <strong>' + arr(D.services).length + ' satellite services</strong>, so the whole estate is one list.</p>';

    h += '<div class="stat-grid">' +
      stat(doms.length, "Sub-services", "accent") +
      stat(s.monolithControllers || 0, "Controllers mapped") +
      stat(s.distinctMonolithTables || 0, "Distinct tables") +
      stat(s.pureMonolith || 0, "Pure monolith", "purple") +
      stat(s.hybridDomains || 0, "Hybrid", "red") +
      stat(s.partiallyExtracted || 0, "Partly extracted", "amber") +
      "</div>";

    h += '<div class="dd-toolbar">' +
      '<div class="dd-seg" id="ddScope">' +
      '<button data-scope="mono" class="on">Monolith sub-services (' + doms.length + ')</button>' +
      '<button data-scope="sat">Satellite services (' + arr(D.services).length + ')</button>' +
      '<button data-scope="all">All ' + (doms.length + arr(D.services).length) + '</button></div>' +
      '<div class="dd-seg" id="ddSort">' +
      '<button data-sort="difficulty" class="on">By extraction difficulty</button>' +
      '<button data-sort="size">By size</button>' +
      '<button data-sort="status">By status</button>' +
      '<button data-sort="name">A–Z</button></div>' +
      '<span class="spacer"></span>' +
      '<span class="dd-note" style="border:0;padding:0">Click any sub-service for its layer anatomy</span></div>';

    h += '<div class="dd-grid" id="ddGrid">' + doms.map(card).join("") + "</div>";

    var rec = D.reconciliation;
    if (rec) {
      var orphans = arr(rec.orphans), dups = arr(rec.duplicates);
      h += panel("Coverage reconciliation",
        '<dl class="dd-kv">' +
        "<dt>Controllers</dt><dd>" + rec.totalControllers + " enumerated across the four API hosts</dd>" +
        "<dt>Assigned</dt><dd>" + rec.assigned + " mapped to a sub-service</dd>" +
        "<dt>Unassigned</dt><dd>" + orphans.length + (orphans.length ? " — " + orphans.map(function (o) {
          return esc(o.controller) + " (" + esc(o.note || "").replace(/\.$/, "") + ")";
        }).join("; ") : "") + "</dd>" +
        "<dt>Cross-domain</dt><dd>" + dups.length + " controllers legitimately serve more than one domain — " +
        "they are counted once per domain they appear in, which is why per-domain controller counts sum above " +
        rec.totalControllers + ".</dd></dl>",
        "Every controller in the monolith was enumerated and reconciled against the decomposition.");
    }
    return h;
  };

  function stat(num, label, cls) {
    return '<div class="stat"><div class="num ' + (cls || "") + '">' + esc(num) + '</div><div class="lbl">' + esc(label) + "</div></div>";
  }

  function card(d) {
    var railColor = { monolith: "var(--violet)", hybrid: "var(--magenta)",
      "partially-extracted": "var(--buoy)", extracted: "var(--kelp)" }[d.status] || "var(--line-2)";
    var p = d.persistence || {};
    return '<div class="dd-card" tabindex="0" data-domain="' + esc(d.slug) + '">' +
      '<span class="rail" style="background:' + railColor + '"></span>' +
      '<div class="hd"><h4>' + esc(d.name) + "</h4>" + chip(d.status) + "</div>" +
      '<p class="one">' + esc(d.oneLiner || "") + "</p>" +
      '<div class="metrics">' +
      metric(arr(d.api).length, "Controllers") +
      metric(arr(p.tables).length, "Tables") +
      metric(arr(d.orchestration).length, "Orchestrators") +
      '<div class="metric"><span class="v">' + diffBar(d.difficulty) + '</span><span class="k">Difficulty</span></div>' +
      "</div></div>";
  }
  function metric(v, k) {
    return '<div class="metric"><span class="v">' + esc(v) + '</span><span class="k">' + esc(k) + "</span></div>";
  }

  function svcCard(sv) {
    var railColor = { extracted: "var(--kelp)", hybrid: "var(--magenta)",
      scaffold: "var(--foam-tick)", tool: "var(--slate)" }[sv.status] || "var(--line-2)";
    var p = sv.persistence || {};
    return '<div class="dd-card" tabindex="0" data-svc="' + esc(sv.repo) + '">' +
      '<span class="rail" style="background:' + railColor + '"></span>' +
      '<div class="hd"><h4>' + esc(sv.name || sv.repo) + "</h4>" + chip(sv.status) + "</div>" +
      '<p class="one">' + esc(sv.oneLiner || sv.headline || "") + "</p>" +
      '<div class="metrics">' +
      metric(arr(sv.api).length, "Endpoints") +
      metric(arr(p.tables).length, "Tables") +
      metric(p.ownsDb ? "Own" : "—", "Database") +
      metric(p.writesToMonolithDb ? "Yes" : "No", "Legacy DB write") +
      "</div></div>";
  }

  function renderScope(scope, mode) {
    var order = { monolith: 0, hybrid: 1, "partially-extracted": 2, extracted: 3 };
    function sortList(list, isSvc) {
      return list.slice().sort(function (a, z) {
        if (mode === "name") return String(a.name).localeCompare(String(z.name));
        if (mode === "size") return arr(z.api).length - arr(a.api).length;
        if (mode === "status") return (order[a.status] || 0) - (order[z.status] || 0);
        if (isSvc) return arr(z.api).length - arr(a.api).length;
        return (z.difficulty || 0) - (a.difficulty || 0) || arr(z.api).length - arr(a.api).length;
      });
    }
    var out = "";
    if (scope !== "sat") out += sortList(arr(D.domains), false).map(card).join("");
    if (scope !== "mono") out += sortList(arr(D.services), true).map(svcCard).join("");
    return out;
  }

  EXT.after.monoservices = function (root) {
    var grid = q("#ddGrid", root);
    var scopeSeg = q("#ddScope", root), sortSeg = q("#ddSort", root);
    var scope = "mono", mode = "difficulty";

    function bindCards() {
      qa(".dd-card", grid).forEach(function (c) {
        var dm = c.getAttribute("data-domain"), sv = c.getAttribute("data-svc");
        function open() { openAnatomy(dm ? "mono:" + dm : "svc:" + sv); }
        c.addEventListener("click", open);
        c.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
        });
      });
    }
    function repaint() { grid.innerHTML = renderScope(scope, mode); bindCards(); }

    if (grid) bindCards();
    if (scopeSeg) scopeSeg.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-scope]"); if (!b) return;
      qa("button", scopeSeg).forEach(function (x) { x.classList.remove("on"); });
      b.classList.add("on"); scope = b.getAttribute("data-scope"); repaint();
    });
    if (sortSeg) sortSeg.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-sort]"); if (!b) return;
      qa("button", sortSeg).forEach(function (x) { x.classList.remove("on"); });
      b.classList.add("on"); mode = b.getAttribute("data-sort"); repaint();
    });
  };

  /* ============================================================
     VIEW 2 — Service Anatomy
     ============================================================ */
  var anatomyKey = null;

  function openAnatomy(key) { anatomyKey = key; if (U.go) U.go("anatomy"); }

  function allSubjects() {
    var out = [];
    arr(D.domains).forEach(function (d) { out.push({ key: "mono:" + d.slug, group: "Inside the monolith", label: d.name, obj: d, kind: "mono" }); });
    arr(D.services).forEach(function (s) { out.push({ key: "svc:" + s.repo, group: "Satellite services", label: s.name || s.repo, obj: s, kind: "svc" }); });
    return out;
  }
  function findSubject(key) {
    var all = allSubjects();
    for (var i = 0; i < all.length; i++) if (all[i].key === key) return all[i];
    return all[0] || null;
  }

  EXT.views.anatomy = function () {
    var subs = allSubjects();
    if (!subs.length) return '<div class="empty">No deep-dive data loaded.</div>';
    var cur = findSubject(anatomyKey || subs[0].key);
    anatomyKey = cur.key;
    var o = cur.obj, isMono = cur.kind === "mono";

    var groups = {};
    subs.forEach(function (s) { (groups[s.group] = groups[s.group] || []).push(s); });
    var options = Object.keys(groups).map(function (g) {
      return "<optgroup label=\"" + esc(g) + "\">" + groups[g].map(function (s) {
        return '<option value="' + esc(s.key) + '"' + (s.key === cur.key ? " selected" : "") + ">" + esc(s.label) + "</option>";
      }).join("") + "</optgroup>";
    }).join("");

    var h = "";
    h += '<p class="dd-lede">How one service is actually built: the layers a request passes through, the code in each, ' +
      'and how a write reaches the database. <strong>' + esc(o.headline || o.oneLiner || "") + "</strong></p>";

    h += '<div class="dd-toolbar">' +
      '<select class="dd-select" id="ddSubject">' + options + "</select>" +
      chip(o.status) +
      (isMono ? '<span class="dd-note" style="border:0;padding:0">Extraction difficulty ' + diffBar(o.difficulty) + "</span>" : "") +
      '<span class="spacer"></span>' +
      '<button class="dd-btn primary" id="ddTrace">▸ Trace a request through the layers</button></div>';

    h += '<div class="dd-two-wide">';

    /* ---- left: the layer stack ---- */
    h += '<div class="panel"><h3>Layer architecture</h3>' +
      '<p class="dd-note" style="margin:-8px 0 12px">' +
      (isMono ? "Inside the monolith every layer below is shared with 19 other sub-services and one DbContext."
              : "The satellite template: each layer is a separate project in the service repo.") + "</p>" +
      '<div class="dd-layers" id="ddLayers">' + layerStack(o, isMono) + "</div></div>";

    /* ---- right: call chains + write paths ---- */
    var chains = arr(o.callChains);
    h += "<div>";
    if (chains.length) {
      h += '<div class="panel"><h3>Call chains</h3>' +
        '<div class="dd-seg" id="ddChainPick" style="margin-bottom:12px">' +
        chains.map(function (c, i) {
          return '<button data-chain="' + i + '"' + (i === 0 ? ' class="on"' : "") + ">" +
            esc((c.kind || "").toUpperCase() || "STEP") + " " + (i + 1) + "</button>";
        }).join("") + "</div>" +
        '<div id="ddChainLabel" class="dd-note" style="margin-bottom:10px">' + esc(chains[0].label || "") + "</div>" +
        '<div class="chain-steps" id="ddChainSteps">' + chainSteps(chains[0]) + "</div></div>";
    }
    h += "</div></div>";

    /* ---- write paths ---- */
    var writes = arr(o.writes);
    if (writes.length) {
      h += panel("How writes reach the database",
        '<table class="dd-table"><thead><tr><th>Path</th><th>Mechanism</th><th>Transactional</th><th>Dual write</th></tr></thead><tbody>' +
        writes.map(function (w) {
          if (typeof w === "string") return "<tr><td colspan=4>" + esc(w) + "</td></tr>";
          return "<tr><td>" + esc(w.path || "") + '</td><td><span class="mono">' + esc(w.mechanism || "") + "</span></td>" +
            "<td>" + boolCell(w.transactional) + "</td><td>" + boolCell(w.dualWrite, true) + "</td></tr>" +
            (w.notes ? '<tr><td colspan="4" class="dd-note" style="border:0;padding:0 0 8px 0">' + esc(w.notes) + "</td></tr>" : "");
        }).join("") + "</tbody></table>",
        "Every write path found in this component's code.");
    }

    /* ---- API surface ---- */
    var api = arr(o.api);
    if (api.length) {
      h += panel(isMono ? "API surface — what the SPAs call" : "API surface",
        '<table class="dd-table"><thead><tr><th>Controller</th><th>Route</th><th>Verbs</th>' +
        (isMono ? "<th>Host</th>" : "<th>Purpose</th>") + "</tr></thead><tbody>" +
        api.map(function (a) {
          return "<tr><td><span class=\"mono\">" + esc(a.controller || a.route || "") + "</span></td>" +
            '<td><span class="mono">' + esc(a.route || "") + "</span></td>" +
            "<td>" + verbs(a.verbs) + "</td>" +
            "<td>" + esc(isMono ? (a.host || "") : (a.purpose || a.authz || "")) + "</td></tr>";
        }).join("") + "</tbody></table>",
        api.length + " endpoint groups. These are the interaction points a client reaches through the YARP front door.");
    }

    /* ---- clients / callers ---- */
    var clients = arr(o.clients).length ? arr(o.clients) : arr(o.callers);
    if (clients.length) {
      h += panel("Who calls this",
        '<table class="dd-table"><thead><tr><th>Caller</th><th>Via</th><th>Route prefix</th></tr></thead><tbody>' +
        clients.map(function (c) {
          if (typeof c === "string") return "<tr><td colspan=3>" + esc(c) + "</td></tr>";
          return "<tr><td>" + esc(c.app || c.who || "") + "</td><td>" + esc(c.via || "") +
            '</td><td><span class="mono">' + esc(c.routePrefix || "") + "</span></td></tr>";
        }).join("") + "</tbody></table>");
    }

    /* ---- coupling + risks ---- */
    h += '<div class="dd-two">';
    var cp = o.coupling || {};
    if (isMono) {
      h += panel("Extraction difficulty",
        '<dl class="dd-kv">' +
        "<dt>Rating</dt><dd>" + diffBar(o.difficulty) + " &nbsp;" + (o.difficulty || "?") + " of 5</dd>" +
        (arr(cp.sharedTablesWith).length ? "<dt>Shared&nbsp;with</dt><dd>" + arr(cp.sharedTablesWith).map(function (x) { return esc(name(x) || x); }).join(", ") + "</dd>" : "") +
        (cp.notes ? "<dt>Why</dt><dd>" + esc(cp.notes) + "</dd>" : "") + "</dl>");
    } else {
      var pers = o.persistence || {};
      h += panel("Persistence",
        '<dl class="dd-kv">' +
        "<dt>Owns DB</dt><dd>" + (pers.ownsDb ? "Yes — " + esc(pers.dbName || "own database") : "No") + "</dd>" +
        (pers.migrationTool ? "<dt>Migrations</dt><dd>" + esc(pers.migrationTool) + "</dd>" : "") +
        (pers.writesToMonolithDb ? '<dt>Legacy&nbsp;DB</dt><dd style="color:var(--magenta)">Writes directly into the monolith database</dd>' : "") +
        (arr(pers.tables).length ? "<dt>Tables</dt><dd>" + arr(pers.tables).length + "</dd>" : "") + "</dl>");
    }
    h += panel("Risks", risks(o.risks)) + "</div>";

    return h;
  };

  function boolCell(v, danger) {
    if (v === true) return danger ? '<span style="color:var(--magenta)">Yes</span>' : '<span style="color:var(--kelp)">Yes</span>';
    if (v === false) return '<span style="color:var(--foam-faint)">No</span>';
    return '<span style="color:var(--foam-tick)">—</span>';
  }

  var LAYER_DEFS = [
    { id: "client", label: "Clients", tier: "client" },
    { id: "gateway", label: "Gateway — FrontdoorService (YARP)", tier: "gateway" },
    { id: "api", label: "API — controllers", tier: "api" },
    { id: "orchestration", label: "Orchestration — services, mediators, grains", tier: "orchestration" },
    { id: "domain", label: "Domain model", tier: "domain" },
    { id: "data-access", label: "Data access — repositories & data managers", tier: "data" },
    { id: "store", label: "Persistence", tier: "store" }
  ];

  function layerStack(o, isMono) {
    var p = o.persistence || {};
    var content = {
      client: arr(o.clients).length ? arr(o.clients).map(function (c) { return c.app || c.who || String(c); })
        : arr(o.callers).map(function (c) { return c.who || c.app || String(c); }),
      gateway: ["FrontdoorService — YARP reverse proxy", "Route table in Azure App Configuration", "No token validation at the edge"],
      api: arr(o.api).map(function (a) { return a.controller || a.route; }),
      orchestration: arr(o.orchestration).map(function (x) { return x.name + (x.kind ? "  ·  " + x.kind : ""); }),
      domain: arr(o.domain).map(function (x) { return x.name; }),
      "data-access": arr(o.dataAccess).map(function (x) { return x.name + (x.kind ? "  ·  " + x.kind : ""); }),
      store: arr(p.tables).map(name).concat(arr(p.storedProcs).map(name).map(function (s) { return s + " (proc)"; }))
    };
    return LAYER_DEFS.map(function (L) {
      var items = arr(content[L.id]).filter(Boolean);
      if (L.id === "domain" && !items.length && !isMono) return "";
      var body = items.length
        ? items.slice(0, 90).map(function (t) {
            /* the swarm writes rich descriptions into these names; show a readable
               head and keep the full text on hover so nothing is lost */
            var full = String(t), short = full.length > 76 ? full.slice(0, 75).replace(/[\s(,;:-]+$/, "") + "…" : full;
            return '<span class="node' + (L.id === "store" ? " write" : "") + '" title="' + esc(full) + '">' + esc(short) + "</span>";
          }).join("") + (items.length > 90 ? '<span class="node">+' + (items.length - 90) + " more</span>" : "")
        : '<span class="dd-note" style="border:0;padding:0">Not present in this component.</span>';
      return '<div class="dd-layer tier-' + L.tier + '" data-layer="' + L.id + '">' +
        '<div class="lay-hd"><span class="lay-name">' + esc(L.label) + "</span>" +
        '<span class="lay-count">' + (items.length || "—") + "</span></div>" +
        '<div class="lay-items">' + body + "</div></div>";
    }).join("");
  }

  /* map a chain step's declared layer onto a stack band */
  function bandFor(layer) {
    var s = String(layer || "").toLowerCase();
    if (/client|spa|ui|browser|kiosk|pos-ui/.test(s)) return "client";
    if (/gateway|frontdoor|yarp|proxy/.test(s)) return "gateway";
    if (/controller|^api|endpoint|hub/.test(s)) return "api";
    if (/orchestr|mediator|handler|grain|service|command|dispatch|shared-pkg/.test(s)) return "orchestration";
    if (/domain|entity|aggregate|state-machine|rule/.test(s)) return "domain";
    if (/data-access|repositor|datamanager|data manager|dapper|gateway-table/.test(s)) return "data-access";
    if (/db|sql|store|cosmos|persist|table/.test(s)) return "store";
    return "orchestration";
  }

  function chainSteps(chain) {
    return arr(chain && chain.steps).map(function (s, i) {
      return '<div class="chain-step" data-step="' + i + '" data-band="' + bandFor(s.layer) + '">' +
        '<span class="idx">' + (i + 1) + "</span>" +
        '<span class="lay">' + esc(s.layer || "") + "</span>" +
        "<span><span class=\"sym\">" + esc(s.symbol || "") + "</span>" +
        (s.file ? '<span class="fil">' + esc(s.file) + "</span>" : "") + "</span></div>";
    }).join("");
  }

  EXT.after.anatomy = function (root) {
    var sel = q("#ddSubject", root);
    if (sel) sel.addEventListener("change", function () { anatomyKey = sel.value; if (U.go) U.go("anatomy"); });

    var cur = findSubject(anatomyKey);
    var chains = arr(cur && cur.obj.callChains);
    var layers = q("#ddLayers", root);
    var stepsBox = q("#ddChainSteps", root);
    var activeChain = 0, timer = null;

    function highlight(band) {
      qa(".dd-layer", layers).forEach(function (L) {
        L.classList.toggle("active", L.getAttribute("data-layer") === band);
        L.classList.toggle("dim", band && L.getAttribute("data-layer") !== band);
      });
    }
    function clearHighlight() {
      qa(".dd-layer", layers).forEach(function (L) { L.classList.remove("active", "dim"); });
    }
    function selectStep(i) {
      if (!stepsBox) return;
      qa(".chain-step", stepsBox).forEach(function (s, j) { s.classList.toggle("on", j === i); });
      var node = qa(".chain-step", stepsBox)[i];
      if (node) { highlight(node.getAttribute("data-band")); node.scrollIntoView({ block: "nearest", behavior: "smooth" }); }
    }
    function stopTrace() { if (timer) { clearInterval(timer); timer = null; } }

    function bindSteps() {
      qa(".chain-step", stepsBox).forEach(function (s, i) {
        s.addEventListener("click", function () { stopTrace(); selectStep(i); });
        s.addEventListener("mouseenter", function () { if (!timer) highlight(s.getAttribute("data-band")); });
      });
    }
    if (stepsBox) bindSteps();

    var pick = q("#ddChainPick", root);
    if (pick) pick.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-chain]"); if (!b) return;
      stopTrace(); clearHighlight();
      qa("button", pick).forEach(function (x) { x.classList.remove("on"); });
      b.classList.add("on");
      activeChain = parseInt(b.getAttribute("data-chain"), 10);
      stepsBox.innerHTML = chainSteps(chains[activeChain]);
      var lbl = q("#ddChainLabel", root);
      if (lbl) lbl.textContent = chains[activeChain].label || "";
      bindSteps();
    });

    var trace = q("#ddTrace", root);
    if (trace) trace.addEventListener("click", function () {
      stopTrace();
      var steps = qa(".chain-step", stepsBox);
      if (!steps.length) {
        /* no chain recorded — sweep the layer stack instead */
        var bands = LAYER_DEFS.map(function (l) { return l.id; }), k = 0;
        timer = setInterval(function () {
          if (k >= bands.length) { stopTrace(); clearHighlight(); return; }
          highlight(bands[k++]);
        }, 520);
        return;
      }
      var i = 0;
      selectStep(0);
      timer = setInterval(function () {
        i++;
        if (i >= steps.length) { stopTrace(); setTimeout(clearHighlight, 900); return; }
        selectStep(i);
      }, 900);
    });
  };


  /* ============================================================
     VIEW 4 — Clients & Edges: who calls in, and what else touches the DB
     ============================================================ */
  function backendChip(kind) {
    if (kind === "monolith-host") return '<span class="dd-chip st-monolith">Monolith</span>';
    if (kind === "satellite") return '<span class="dd-chip st-extracted">Satellite</span>';
    return '<span class="dd-chip st-external">External</span>';
  }

  EXT.views.clients = function () {
    var integ = arr(D.integration), K = D.kernel;
    /* biggest surfaces first - they carry the coupling that matters */
    var fes = arr(D.frontends).slice().sort(function (a, b) {
      return (b.dataServiceCount || 0) - (a.dataServiceCount || 0) ||
             arr(b.backends).length - arr(a.backends).length;
    });
    var h = "";

    h += '<p class="dd-lede">Every client reaches the platform through <strong>one YARP front door</strong> that ' +
      'validates no tokens and whose route table lives in Azure App Configuration, not the repo. This is what each ' +
      'client calls, plus the utility tier that reaches the legacy database without going through any service at all.</p>';

    /* ---- the clients ---- */
    fes.forEach(function (fe) {
      var backs = arr(fe.backends);
      var mono = backs.filter(function (b) { return b.kind === "monolith-host"; });
      var sat = backs.filter(function (b) { return b.kind === "satellite"; });
      var body = "";
      body += '<dl class="dd-kv" style="margin-bottom:12px">' +
        "<dt>Stack</dt><dd>" + esc(fe.tech || "") + "</dd>" +
        (fe.apiBase && fe.apiBase.mechanism ? "<dt>API base</dt><dd>" + esc(fe.apiBase.mechanism) +
          (fe.apiBase.file ? ' <span class="mono" style="color:var(--foam-tick)">' + esc(fe.apiBase.file) + "</span>" : "") + "</dd>" : "") +
        (fe.auth && fe.auth.mechanism ? "<dt>Auth</dt><dd>" + esc(fe.auth.mechanism) + "</dd>" : "") +
        "</dl>";

      body += '<table class="dd-table"><thead><tr><th>Backend</th><th>Kind</th><th>Route prefixes</th><th class="num">Calls</th></tr></thead><tbody>' +
        backs.map(function (b) {
          var pre = arr(b.routePrefixes);
          return "<tr><td>" + esc(b.backend || "") + "</td>" +
            "<td>" + backendChip(b.kind) + "</td>" +
            '<td><span class="mono">' + esc(pre.slice(0, 6).join("  ·  ")) +
            (pre.length > 6 ? '</span><span class="dd-note" style="border:0;padding:0"> +' + (pre.length - 6) + " more" : "") + "</span></td>" +
            '<td class="num">' + esc(b.callCount == null ? "—" : b.callCount) + "</td></tr>";
        }).join("") + "</tbody></table>";

      if (arr(fe.realtime).length) {
        body += '<p class="dd-note" style="margin-top:12px"><b style="color:var(--foam)">Real-time:</b> ' +
          arr(fe.realtime).map(function (r) {
            return esc((r.hub || "") + (r.hostedIn ? " → " + r.hostedIn : ""));
          }).join(" · ") + "</p>";
      }
      if (arr(fe.monolithCoupling).length) {
        body += '<div style="margin-top:12px">' + arr(fe.monolithCoupling).slice(0, 6).map(function (c) {
          return '<div class="risk-item medium"><div class="rt">' + esc(c.area || "") + "</div>" +
            '<div class="rd">' + esc(c.why || "") + "</div></div>";
        }).join("") + "</div>";
      }
      h += panel(fe.name + "  —  " + mono.length + " monolith host" + (mono.length === 1 ? "" : "s") + ", " + sat.length + " satellite" + (sat.length === 1 ? "" : "s"),
        body, fe.headline || fe.oneLiner);
    });

    /* ---- integration tier ---- */
    if (integ.length) {
      var rows = "";
      integ.forEach(function (grp) {
        arr(grp.components).forEach(function (c) {
          var stores = arr(c.dataStores);
          var touchesMono = stores.some(function (d) {
            return /safeharbor|next/i.test(String(d.store || "")) && /write|ddl/i.test(String(d.direction || ""));
          });
          rows += "<tr><td><span class=\"mono\">" + esc(c.name || "") + "</span></td>" +
            "<td>" + esc(c.kind || "") + "</td>" +
            "<td>" + esc(c.framework || "") + "</td>" +
            "<td>" + esc(c.liveness || "") + "</td>" +
            "<td>" + (touchesMono ? '<span style="color:var(--magenta)">writes legacy DB</span>' : esc(stores.map(function (d) { return d.store; }).filter(Boolean).slice(0, 2).join(", ") || "—")) + "</td></tr>";
        });
      });
      h += panel("The integration tier nobody owns",
        '<table class="dd-table"><thead><tr><th>Component</th><th>Shape</th><th>Runtime</th><th>Liveness</th><th>Data contact</th></tr></thead><tbody>' +
        rows + "</tbody></table>" +
        '<p class="dd-note" style="margin-top:12px">' +
        arr(integ).map(function (g) { return esc(g.headline || ""); }).join("<br><br>") + "</p>",
        "These sit in no service catalogue, yet several write directly into the monolith database.");
    }

    /* ---- shared kernel ---- */
    if (K) {
      var pkgs = arr(K.packages), matrix = arr(K.versionMatrix);
      h += panel("The shared kernel — " + pkgs.length + " NuGet packages every satellite is built on",
        (K.transactionStory ? '<p class="dd-note" style="margin-bottom:12px"><b style="color:var(--foam)">Transactions:</b> ' + esc(K.transactionStory) + "</p>" : "") +
        '<table class="dd-table"><thead><tr><th>Package</th><th>Provides</th><th class="num">Versions live</th><th>Spread</th></tr></thead><tbody>' +
        matrix.map(function (m) {
          var vs = arr(m.versions);
          return "<tr><td><span class=\"mono\">" + esc(m.package || "") + "</span></td>" +
            "<td>" + esc((pkgs.filter(function (p) { return p.name === m.package; })[0] || {}).purpose || "") + "</td>" +
            '<td class="num">' + vs.length + "</td>" +
            "<td>" + esc(m.spread || "") + "</td></tr>";
        }).join("") + "</tbody></table>",
        "A change here is estate-wide, and the estate is not on one version of it.");
    }
    return h;
  };

  /* ============================================================
     VIEW 3 — Animated data-flow simulation
     ============================================================ */
  var flowSlug = null;
  var TIER_COLOR = {
    client: "var(--sky)", gateway: "var(--slate)", api: "var(--depth)",
    orchestration: "var(--violet)", domain: "var(--kelp)", data: "var(--buoy)",
    store: "var(--magenta)", external: "var(--foam-tick)"
  };
  var KIND_COLOR = {
    request: "#46d9c6", response: "#82b2bd", write: "#e0709e",
    read: "#62a8e6", event: "#f3a95e", async: "#9b86f0"
  };

  EXT.views.dataflows = function () {
    var flows = arr(D.flows);
    if (!flows.length) return '<div class="empty">No flow traces available.</div>';
    var f = flows.filter(function (x) { return x.slug === flowSlug; })[0] || flows[0];
    flowSlug = f.slug;

    var h = "";
    h += '<p class="dd-lede">Eight runtime journeys traced end to end through the real code — client, gateway, ' +
      'monolith, satellite service and database. Press play to watch a request move through the system. ' +
      'Every step names the symbol and file that does the work.</p>';

    h += '<div class="dd-toolbar">' +
      '<select class="dd-select" id="ddFlow">' + flows.map(function (x) {
        return '<option value="' + esc(x.slug) + '"' + (x.slug === f.slug ? " selected" : "") + ">" + esc(x.title) + "</option>";
      }).join("") + "</select>" +
      '<button class="dd-btn primary" id="fPlay">▶ Play</button>' +
      '<button class="dd-btn" id="fPrev">◂ Step</button>' +
      '<button class="dd-btn" id="fNext">Step ▸</button>' +
      '<button class="dd-btn" id="fReset">↻ Reset</button>' +
      '<div class="dd-seg" id="fSpeed">' +
      '<button data-sp="1600">0.5×</button><button data-sp="1000" class="on">1×</button>' +
      '<button data-sp="520">2×</button><button data-sp="260">4×</button></div>' +
      '<span class="spacer"></span>' +
      '<span class="dd-note" style="border:0;padding:0"><span id="fCount">0</span> / ' + arr(f.steps).length + " steps</span></div>";

    h += '<div class="dd-two-wide">';
    h += '<div class="seq-wrap"><div class="seq-hscroll">' +
      '<div class="seq-head" id="seqHead"></div>' +
      '<div class="seq-scroll" id="seqBody"></div></div>' +
      '<div class="seq-legend">' +
      Object.keys(KIND_COLOR).map(function (k) {
        return '<i style="color:' + KIND_COLOR[k] + '">' + esc(titleize(k)) + "</i>";
      }).join("") + "</div></div>";

    h += '<div style="display:flex;flex-direction:column;gap:13px">' +
      '<div class="step-panel" id="stepPanel"><p class="dd-note" style="border:0;padding:0">Press play, or step through manually.</p></div>' +
      '<div class="panel" style="margin:0"><h3>What this flow tells you</h3>' +
      '<p class="dd-note" style="border:0;padding:0;color:var(--foam-dim);line-height:1.55">' + esc(f.summary || "") + "</p></div></div>";
    h += "</div>";

    if (arr(f.dualWrites).length) {
      h += panel("Dual writes on this path",
        arr(f.dualWrites).map(function (w) {
          if (typeof w === "string") return '<div class="risk-item high"><div class="rd">' + esc(w) + "</div></div>";
          return '<div class="risk-item high"><div class="rt">' + esc(w.what || "") + "</div>" +
            '<div class="rd">' + esc(w.risk || "") + "</div>" +
            (w.where ? '<div class="re">' + esc(w.where) + "</div>" : "") + "</div>";
        }).join(""),
        "Two or more stores written without a shared transaction — the correctness hazard on this journey.");
    }

    h += '<div class="dd-two">';
    if (arr(f.boundaryCrossings).length) {
      h += panel("Monolith boundary crossings",
        arr(f.boundaryCrossings).map(function (b) {
          if (typeof b === "string") return '<div class="risk-item">' + '<div class="rd">' + esc(b) + "</div></div>";
          return '<div class="risk-item medium">' +
            (b.at || b.boundary ? '<div class="rt">' + esc([b.at, b.boundary].filter(Boolean).join(" · ")) + "</div>" : "") +
            '<div class="rd">' + esc(b.detail || b.what || b.where || "") + "</div>" +
            (b.file ? '<div class="re">' + esc(b.file) + "</div>" : "") + "</div>";
        }).join(""),
        "Where this journey leaves or re-enters the monolith.");
    }
    if (arr(f.failureModes).length) {
      h += panel("Failure modes",
        "<ul>" + arr(f.failureModes).map(function (b) {
          if (typeof b === "string") return "<li>" + esc(b) + "</li>";
          return "<li><b>" + esc(b.mode || b.what || b.title || "") + "</b>" +
            (b.detail || b.impact ? " — " + esc(b.detail || b.impact) : "") + "</li>";
        }).join("") + "</ul>");
    }
    h += "</div>";

    if (arr(f.unknowns).length) {
      h += panel("Not knowable from the repository",
        "<ul>" + arr(f.unknowns).map(function (b) { return "<li>" + esc(typeof b === "string" ? b : (b.unknown || b.what || b.detail || "")) + "</li>"; }).join("") + "</ul>",
        "Runtime configuration lives in Azure App Configuration, so these could not be confirmed from code.");
    }
    return h;
  };

  EXT.after.dataflows = function (root) {
    var flows = arr(D.flows);
    var f = flows.filter(function (x) { return x.slug === flowSlug; })[0] || flows[0];
    if (!f) return;

    var actors = arr(f.actors), steps = arr(f.steps);
    var idx = -1, playing = false, timer = null, speed = 1000;

    var scroll = q("#seqBody", root);
    var head = q("#seqHead", root);
    var panelBox = q("#stepPanel", root);
    var counter = q("#fCount", root);
    var playBtn = q("#fPlay", root);

    /* ---------- build the sequence diagram ---------- */
    var COL = Math.max(132, Math.min(200, 1240 / Math.max(actors.length, 1)));
    var PAD = 26, HEAD = 62, ROW = 62;
    var W = PAD * 2 + COL * actors.length;
    var H = HEAD + ROW * steps.length + 40;
    var xOf = {};
    actors.forEach(function (a, i) { xOf[a.id] = PAD + COL * i + COL / 2; });

    var NS = "http://www.w3.org/2000/svg";
    function mk(tag, attrs) {
      var e = document.createElementNS(NS, tag);
      for (var k in attrs) e.setAttribute(k, attrs[k]);
      return e;
    }
    var BODY_H = H - HEAD;
    var hsvg = mk("svg", { class: "seq-svg", width: W, height: HEAD, viewBox: "0 0 " + W + " " + HEAD });
    var svg = mk("svg", { class: "seq-svg", width: W, height: BODY_H, viewBox: "0 0 " + W + " " + BODY_H });

    /* actor headers live in the pinned SVG; lifelines run down the scrolling one */
    actors.forEach(function (a, i) {
      var x = xOf[a.id];
      svg.appendChild(mk("line", { class: "lifeline", x1: x, x2: x, y1: 0, y2: BODY_H - 16 }));
      var bw = COL - 16;
      var g = mk("g", {});
      g.appendChild(mk("rect", { class: "actor-box", x: x - bw / 2, y: 12, width: bw, height: 38, rx: 4 }));
      g.appendChild(mk("rect", { x: x - bw / 2, y: 12, width: 2.5, height: 38, fill: TIER_COLOR[a.tier] || "var(--line-2)" }));
      /* wrap the label onto two lines */
      var words = String(a.label || a.id).split(/\s+/), l1 = "", l2 = "";
      words.forEach(function (w) {
        if ((l1 + " " + w).trim().length <= Math.floor(bw / 5.6) && !l2) l1 = (l1 + " " + w).trim();
        else l2 = (l2 + " " + w).trim();
      });
      if (l2.length > Math.floor(bw / 5.2)) l2 = l2.slice(0, Math.floor(bw / 5.2) - 1) + "…";
      var t1 = mk("text", { class: "actor-lbl", x: x, y: l2 ? 28 : 34, "text-anchor": "middle" });
      t1.textContent = l1;
      g.appendChild(t1);
      if (l2) {
        var t2 = mk("text", { class: "actor-lbl", x: x, y: 40, "text-anchor": "middle" });
        t2.textContent = l2;
        g.appendChild(t2);
      }
      var t3 = mk("text", { class: "mnum", x: x, y: 58, "text-anchor": "middle" });
      t3.textContent = String(a.tier || "").toUpperCase();
      t3.setAttribute("fill", TIER_COLOR[a.tier] || "var(--foam-tick)");
      g.appendChild(t3);
      hsvg.appendChild(g);
    });

    /* arrow marker per kind */
    var defs = mk("defs", {});
    Object.keys(KIND_COLOR).forEach(function (k) {
      var m = mk("marker", { id: "ah-" + k, viewBox: "0 0 8 8", refX: 7, refY: 4, markerWidth: 6, markerHeight: 6, orient: "auto" });
      m.appendChild(mk("path", { d: "M0,0 L8,4 L0,8 z", fill: KIND_COLOR[k] }));
      defs.appendChild(m);
    });
    svg.appendChild(defs);
    hsvg.appendChild(defs.cloneNode(true));

    /* messages */
    var msgEls = [];
    steps.forEach(function (s, i) {
      var y = ROW * i + 26;
      var col = KIND_COLOR[s.kind] || KIND_COLOR.request;
      var x1 = xOf[s.from], x2 = xOf[s.to];
      var g = mk("g", { class: "msg", "data-i": i });
      if (x1 == null || x2 == null) { msgEls.push(g); svg.appendChild(g); return; }

      if (s.from === s.to) {
        var r = 30;
        g.appendChild(mk("path", {
          class: "mline selfloop", d: "M" + x1 + "," + (y - 10) + " c " + r + ",-6 " + r + ",34 0,28",
          stroke: col, "stroke-width": 1.5, "marker-end": "url(#ah-" + (s.kind || "request") + ")"
        }));
      } else {
        g.appendChild(mk("line", {
          class: "mline", x1: x1, y1: y, x2: x2, y2: y, stroke: col, "stroke-width": 1.5,
          "marker-end": "url(#ah-" + (s.kind || "request") + ")"
        }));
      }
      var num = mk("text", { class: "mnum", x: Math.min(x1, x2) + (s.from === s.to ? 38 : Math.abs(x2 - x1) / 2), y: y - 16, "text-anchor": "middle" });
      num.textContent = String(s.n || i + 1);
      g.appendChild(num);

      var lbl = mk("text", {
        class: "mlabel", x: s.from === s.to ? x1 + 40 : (x1 + x2) / 2,
        y: y - 6, "text-anchor": "middle"
      });
      var short = String(s.action || "").split(/[;.]\s/)[0];
      var maxc = Math.max(24, Math.floor(Math.abs(x2 - x1 || COL) / 5.4));
      lbl.textContent = short.length > maxc ? short.slice(0, maxc - 1) + "…" : short;
      g.appendChild(lbl);

      var dot = mk("circle", { class: "packet", cx: x1, cy: y, r: 4.5, fill: col, opacity: 0 });
      g.appendChild(dot);
      g._dot = dot; g._x1 = x1; g._x2 = x2; g._y = y;

      msgEls.push(g);
      svg.appendChild(g);
    });

    if (head) { head.innerHTML = ""; head.appendChild(hsvg); }
    if (scroll) { scroll.innerHTML = ""; scroll.appendChild(svg); }

    /* ---------- animation ---------- */
    function animatePacket(g) {
      if (!g || !g._dot || g._x1 == null) return;
      var dot = g._dot, x1 = g._x1, x2 = g._x2, y = g._y;
      if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      var dur = Math.min(620, Math.max(240, speed * 0.55)), t0 = null;
      dot.setAttribute("opacity", "1");
      function frame(ts) {
        if (t0 === null) t0 = ts;
        var p = Math.min(1, (ts - t0) / dur);
        var e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        if (x1 === x2) {
          dot.setAttribute("cx", x1 + Math.sin(e * Math.PI) * 30);
          dot.setAttribute("cy", y - 10 + e * 28);
        } else {
          dot.setAttribute("cx", x1 + (x2 - x1) * e);
          dot.setAttribute("cy", y);
        }
        if (p < 1) requestAnimationFrame(frame);
        else dot.setAttribute("opacity", "0");
      }
      requestAnimationFrame(frame);
    }

    function render(i) {
      msgEls.forEach(function (g, j) {
        g.classList.toggle("shown", j <= i);
        g.classList.toggle("current", j === i);
      });
      if (counter) counter.textContent = String(Math.max(0, i + 1));
      var s = steps[i];
      if (!s) {
        if (panelBox) panelBox.innerHTML = '<p class="dd-note" style="border:0;padding:0">Press play, or step through manually.</p>';
        return;
      }
      var from = actors.filter(function (a) { return a.id === s.from; })[0] || { label: s.from };
      var to = actors.filter(function (a) { return a.id === s.to; })[0] || { label: s.to };
      if (panelBox) {
        panelBox.innerHTML =
          '<div class="sp-hd"><span class="sp-n">Step ' + (s.n || i + 1) + "</span>" +
          '<span class="dd-chip k-' + esc(s.kind || "request") + '" style="border-color:currentColor">' + esc(s.kind || "") + "</span>" +
          '<span class="sp-route"><b>' + esc(from.label) + "</b> → <b>" + esc(to.label) + "</b></span></div>" +
          '<p class="sp-act">' + esc(s.action || "") + "</p>" +
          (s.symbol ? '<div class="sp-sym">' + esc(s.symbol) + "</div>" : "") +
          (s.file ? '<div class="sp-file">' + esc(s.file) + "</div>" : "") +
          (s.notes ? '<p class="sp-note">' + esc(s.notes) + "</p>" : "");
      }
      var g = msgEls[i];
      if (g && scroll) {
        var target = ROW * i - scroll.clientHeight / 2 + 60;
        scroll.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
        animatePacket(g);
      }
    }

    function stop() {
      playing = false;
      if (timer) { clearInterval(timer); timer = null; }
      if (playBtn) playBtn.textContent = "▶ Play";
    }
    function play() {
      if (playing) { stop(); return; }
      if (idx >= steps.length - 1) idx = -1;
      playing = true;
      if (playBtn) playBtn.textContent = "❚❚ Pause";
      tick();
      timer = setInterval(tick, speed);
    }
    function tick() {
      idx++;
      if (idx >= steps.length) { stop(); idx = steps.length - 1; return; }
      render(idx);
    }

    if (playBtn) playBtn.addEventListener("click", play);
    var nx = q("#fNext", root); if (nx) nx.addEventListener("click", function () { stop(); if (idx < steps.length - 1) render(++idx); });
    var pv = q("#fPrev", root); if (pv) pv.addEventListener("click", function () { stop(); if (idx > 0) render(--idx); });
    var rs = q("#fReset", root); if (rs) rs.addEventListener("click", function () { stop(); idx = -1; render(-1); if (scroll) scroll.scrollTo({ top: 0, behavior: "smooth" }); });

    var sp = q("#fSpeed", root);
    if (sp) sp.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-sp]"); if (!b) return;
      qa("button", sp).forEach(function (x) { x.classList.remove("on"); });
      b.classList.add("on");
      speed = parseInt(b.getAttribute("data-sp"), 10);
      if (playing) { clearInterval(timer); timer = setInterval(tick, speed); }
    });

    var fsel = q("#ddFlow", root);
    if (fsel) fsel.addEventListener("change", function () { stop(); flowSlug = fsel.value; if (U.go) U.go("dataflows"); });

    render(-1);
  };
})();
