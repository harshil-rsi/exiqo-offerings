/* NExT Platform Codebase Discovery — single-page explorer */
(function () {
  "use strict";
  var D = window.DISCOVERY_DATA || {};
  var main = document.getElementById("main");
  var nav = document.getElementById("nav");
  var drawer = document.getElementById("drawer");
  var backdrop = document.getElementById("backdrop");

  /* ---------------- utilities ---------------- */
  function el(html) { var t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstChild; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function titleCase(s){ return String(s||"").replace(/[-_]/g," ").replace(/\b\w/g, function(c){return c.toUpperCase();}); }
  function arr(x){ return Array.isArray(x) ? x : (x ? [x] : []); }

  /* ---------------- tiny markdown renderer ---------------- */
  function mdInline(s) {
    s = esc(s);
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    return s;
  }
  function renderMarkdown(md) {
    if (!md) return '<p class="empty">No content.</p>';
    var lines = String(md).replace(/\r/g, "").split("\n");
    var out = [], i = 0;
    function flushList(tag, items) { if (items.length) out.push("<" + tag + ">" + items.map(function (x) { return "<li>" + mdInline(x) + "</li>"; }).join("") + "</" + tag + ">"); }
    while (i < lines.length) {
      var line = lines[i];
      // fenced code block (``` or ~~~) — preserve whitespace (ASCII diagrams, code)
      var fence = line.match(/^\s*(```+|~~~+)\s*([\w-]*)\s*$/);
      if (fence) {
        var marker = fence[1].charAt(0);
        var buf = []; i++;
        while (i < lines.length && !new RegExp("^\\s*" + (marker === "`" ? "```+" : "~~~+") + "\\s*$").test(lines[i])) { buf.push(lines[i]); i++; }
        i++; // skip closing fence
        out.push('<pre class="codeblock"><code>' + esc(buf.join("\n")) + "</code></pre>");
        continue;
      }
      // table
      if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
        var header = line.trim().replace(/^\||\|$/g, "").split("|").map(function (c) { return c.trim(); });
        i += 2; var rows = [];
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
          rows.push(lines[i].trim().replace(/^\||\|$/g, "").split("|").map(function (c) { return c.trim(); })); i++;
        }
        var th = "<tr>" + header.map(function (h) { return "<th>" + mdInline(h) + "</th>"; }).join("") + "</tr>";
        var tb = rows.map(function (r) { return "<tr>" + r.map(function (c) { return "<td>" + mdInline(c) + "</td>"; }).join("") + "</tr>"; }).join("");
        out.push("<table>" + th + tb + "</table>");
        continue;
      }
      var h = line.match(/^(#{1,6})\s+(.*)$/);
      if (h) { var lvl = Math.min(h[1].length, 4); out.push("<h" + lvl + ">" + mdInline(h[2]) + "</h" + lvl + ">"); i++; continue; }
      if (/^\s*>/.test(line)) { out.push("<blockquote>" + mdInline(line.replace(/^\s*>\s?/, "")) + "</blockquote>"); i++; continue; }
      if (/^\s*[-*+]\s+/.test(line)) {
        var items = []; while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*+]\s+/, "")); i++; } flushList("ul", items); continue;
      }
      if (/^\s*\d+\.\s+/.test(line)) {
        var oi = []; while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { oi.push(lines[i].replace(/^\s*\d+\.\s+/, "")); i++; } flushList("ol", oi); continue;
      }
      if (/^\s*$/.test(line)) { i++; continue; }
      var para = [line]; i++;
      while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^\s*[-*+#>|]/.test(lines[i]) && !/^\s*\d+\.\s/.test(lines[i])) { para.push(lines[i]); i++; }
      out.push("<p>" + mdInline(para.join(" ")) + "</p>");
    }
    return out.join("\n");
  }

  /* ---------------- badges ---------------- */
  function statusBadge(s) {
    s = (s || "unknown").toLowerCase();
    var cls = "b-" + s.replace(/[^a-z-]/g, "");
    return '<span class="badge ' + cls + '"><span class="dot" style="background:currentColor"></span>' + esc(titleCase(s)) + "</span>";
  }
  function cxClass(c){ return "cx-" + String(c||"medium").replace(/[^a-z-]/g,""); }

  /* ---------------- views ---------------- */
  var views = {};

  views.overview = function () {
    var s = D.stats || {};
    var comps = D.components || [];
    var byCat = countBy(comps, "category");
    var byStatus = countBy(comps, "migrationStatus");
    var byComplexity = countBy(comps, "complexity");

    var cards = [
      ["Components profiled", comps.length, "accent"],
      ["Backend services", byCat["backend-service"] || 0, "green"],
      ["C# files", fmt(s.csFiles), ""],
      ["TypeScript files", fmt(s.tsFiles), "accent"],
      ["SQL scripts", fmt(s.sqlFiles), ""],
      [".csproj projects", fmt(s.csproj), ""],
      ["Solutions (.sln)", fmt(s.sln), ""],
      ["CI/CD pipelines", fmt(s.ymlPipelines), "amber"],
      ["Bicep IaC files", fmt(s.bicepFiles), "purple"],
      ["SSRS reports", fmt(s.rdlReports), ""],
    ];

    var h = '<div class="page-head"><h2>Platform Dashboard</h2><p>' + esc(D.meta && D.meta.intro || "") + "</p></div>";
    h += '<div class="stat-grid">' + cards.map(function (c) {
      return '<div class="stat"><div class="num ' + c[2] + '">' + c[1] + '</div><div class="lbl">' + c[0] + "</div></div>";
    }).join("") + "</div>";

    h += '<div class="two-col">';
    h += '<div class="panel"><h3>Components by category</h3>' + barChart(byCat) + "</div>";
    h += '<div class="panel"><h3>Migration status</h3>' + barChart(byStatus, true) + "</div>";
    h += "</div>";

    h += '<div class="two-col">';
    h += '<div class="panel"><h3>Complexity distribution</h3>' + barChart(byComplexity) + "</div>";
    h += '<div class="panel"><h3>At a glance</h3><div class="md">' + renderMarkdown(D.meta && D.meta.atAGlance || "") + "</div></div>";
    h += "</div>";

    if (D.meta && D.meta.executiveSummary) {
      h += '<div class="panel"><h3>Executive summary</h3><div class="md">' + renderMarkdown(D.meta.executiveSummary) + "</div></div>";
    }
    return h;
  };

  views.architecture = function () {
    var t = findTopic("architecture-patterns") || {};
    var h = '<div class="page-head"><h2>Architecture Overview</h2><p>' + esc(t.summary || "") + "</p></div>";
    if (window.ARCH_SVG) h += '<div class="panel diagram-panel">' + window.ARCH_SVG + "</div>";
    if (t.keyTechnologies) h += techTags(t.keyTechnologies);
    h += '<div class="panel"><div class="md">' + renderMarkdown(t.markdown || "") + "</div></div>";
    var mono = D.monolith || [];
    if (mono.length) {
      h += '<div class="page-head" style="margin-top:28px"><h2>The NExT Monolith</h2><p>The large central codebase everything else evolved from.</p></div>';
      mono.forEach(function (m) {
        h += '<div class="panel"><h3>' + esc(m.topic) + '</h3><div class="topic-summary">' + esc(m.summary || "") + "</div>";
        h += '<div class="md">' + renderMarkdown(m.markdown || "") + "</div></div>";
      });
    }
    return h;
  };

  var compFilters = { q: "", category: "all", status: "all" };
  views.components = function () {
    var h = '<div class="page-head"><h2>Components</h2><p>Every profiled service, frontend, tool and library in the estate. Click a card for the full profile.</p></div>';
    var cats = uniq((D.components || []).map(function (c) { return c.category; }));
    var statuses = uniq((D.components || []).map(function (c) { return c.migrationStatus; }));
    h += '<div class="toolbar">';
    h += '<input type="search" id="compSearch" placeholder="Search components, tech, integrations…" value="' + esc(compFilters.q) + '">';
    h += '<select id="compCat"><option value="all">All categories</option>' + cats.map(function (c) { return '<option value="' + esc(c) + '"' + (compFilters.category === c ? " selected" : "") + ">" + esc(titleCase(c)) + "</option>"; }).join("") + "</select>";
    h += '<select id="compStatus"><option value="all">All statuses</option>' + statuses.map(function (c) { return '<option value="' + esc(c) + '"' + (compFilters.status === c ? " selected" : "") + ">" + esc(titleCase(c)) + "</option>"; }).join("") + "</select>";
    h += '<span class="count-note" id="compCount"></span></div>';
    h += '<div class="card-grid" id="compGrid"></div>';
    setTimeout(wireComponents, 0);
    return h;
  };

  function wireComponents() {
    var grid = document.getElementById("compGrid");
    var search = document.getElementById("compSearch");
    var catSel = document.getElementById("compCat");
    var statSel = document.getElementById("compStatus");
    if (!grid) return;
    function draw() {
      var q = compFilters.q.toLowerCase();
      var list = (D.components || []).filter(function (c) {
        if (compFilters.category !== "all" && c.category !== compFilters.category) return false;
        if (compFilters.status !== "all" && c.migrationStatus !== compFilters.status) return false;
        if (!q) return true;
        var blob = [c.name, c.businessPurpose, (c.frameworks || []).join(" "), (c.externalIntegrations || []).join(" "), (c.dataStores || []).join(" "), (c.primaryLanguages || []).join(" ")].join(" ").toLowerCase();
        return blob.indexOf(q) >= 0;
      });
      document.getElementById("compCount").textContent = list.length + " of " + (D.components || []).length + " components";
      grid.innerHTML = list.length ? list.map(compCard).join("") : '<div class="empty">No components match.</div>';
      Array.prototype.forEach.call(grid.querySelectorAll(".ccard"), function (card) {
        card.addEventListener("click", function () { openComponent(card.getAttribute("data-name")); });
      });
    }
    if (search) search.addEventListener("input", function () { compFilters.q = search.value; draw(); });
    if (catSel) catSel.addEventListener("change", function () { compFilters.category = catSel.value; draw(); });
    if (statSel) statSel.addEventListener("change", function () { compFilters.status = statSel.value; draw(); });
    draw();
  }

  function compCard(c) {
    var m = c.metrics || {};
    var tags = (c.frameworks || []).slice(0, 4).map(function (f) { return '<span class="tag">' + esc(f) + "</span>"; }).join("");
    return '<div class="ccard" data-name="' + esc(c.name) + '">' +
      '<div class="top"><h4>' + esc(c.name) + "</h4>" + statusBadge(c.migrationStatus) + "</div>" +
      '<div class="purpose">' + esc(truncate(c.businessPurpose, 140)) + "</div>" +
      '<div class="meta">' + tags + "</div>" +
      '<div class="metrics">' +
        (m.cs ? "<span><b>" + fmt(m.cs) + "</b> cs</span>" : "") +
        (m.ts ? "<span><b>" + fmt(m.ts) + "</b> ts</span>" : "") +
        (m.sql ? "<span><b>" + fmt(m.sql) + "</b> sql</span>" : "") +
        '<span class="' + cxClass(c.complexity) + '">' + esc(titleCase(c.complexity || "")) + "</span>" +
      "</div></div>";
  }

  function openComponent(name) {
    var c = (D.components || []).find(function (x) { return x.name === name; });
    if (!c) return;
    var m = c.metrics || {};
    var h = '<button class="close" id="drawerClose">×</button>';
    h += "<h3>" + esc(c.name) + "</h3>" + statusBadge(c.migrationStatus) + ' <span class="badge b-' + esc((c.category||"").replace(/[^a-z-]/g,"")) + '">' + esc(titleCase(c.category)) + "</span>";
    h += '<p class="topic-summary" style="margin-top:12px">' + esc(c.businessPurpose) + "</p>";
    h += '<div class="kv">';
    h += '<div class="k">Complexity</div><div class="' + cxClass(c.complexity) + '">' + esc(titleCase(c.complexity)) + "</div>";
    h += '<div class="k">Confidence</div><div>' + esc(titleCase(c.confidence || "—")) + "</div>";
    h += '<div class="k">SQL migrations</div><div>' + esc(c.sqlMigrationTool || "—") + "</div>";
    h += '<div class="k">CI pipeline</div><div>' + (c.hasPipeline ? "✅ yes" : "—") + "</div>";
    h += '<div class="k">Tests</div><div>' + (c.hasTests ? "✅ yes" : "—") + "</div>";
    h += '<div class="k">Code size</div><div>' + (m.cs ? fmt(m.cs) + " C#" : "") + (m.ts ? "  ·  " + fmt(m.ts) + " TS" : "") + (m.sql ? "  ·  " + fmt(m.sql) + " SQL" : "") + (m.csproj ? "  ·  " + fmt(m.csproj) + " proj" : "") + "</div>";
    h += "</div>";
    h += pillSection("Languages", c.primaryLanguages);
    h += pillSection("Frameworks & libraries", c.frameworks);
    h += pillSection("Data stores", c.dataStores);
    h += pillSection("External integrations", c.externalIntegrations);
    h += pillSection("Internal dependencies", c.keyInternalDependencies);
    h += pillSection("Key projects", c.keyProjects);
    if (c.notes) { h += '<div class="section-title">Notes</div><div class="md">' + renderMarkdown(c.notes) + "</div>"; }
    if (c.evidence && c.evidence.length) {
      h += '<div class="section-title">Evidence</div>';
      h += c.evidence.map(function (e) { return '<div class="evidence">' + esc(e) + "</div>"; }).join("");
    }
    drawer.innerHTML = h;
    openDrawer();
    document.getElementById("drawerClose").addEventListener("click", closeDrawer);
  }

  function pillSection(title, items) {
    items = arr(items).filter(Boolean);
    if (!items.length) return "";
    return '<div class="section-title">' + esc(title) + '</div><div class="pill-list">' + items.map(function (i) { return '<span class="pill">' + esc(i) + "</span>"; }).join("") + "</div>";
  }

  views.modules = function () {
    var mods = D.modules || [];
    var h = '<div class="page-head"><h2>Business Modules</h2><p>The functional module map of the platform mapped to where each lives today. Note: the source module map is ~6 months stale; statuses below are verified against code where evidence allowed.</p></div>';
    if (!mods.length) {
      var t = findMono("modules") || findTopic("decomposition-status") || {};
      return h + '<div class="panel"><div class="md">' + renderMarkdown(t.markdown || "No module map captured.") + "</div></div>";
    }
    h += '<div class="panel"><table class="grid"><thead><tr><th>Module</th><th>Status</th><th>Where it lives</th><th>Notes</th></tr></thead><tbody>';
    h += mods.map(function (m) {
      return "<tr><td><b>" + esc(m.name) + "</b></td><td>" + statusBadge(m.status) + "</td><td>" + esc(m.location || "") + "</td><td>" + esc(m.notes || "") + "</td></tr>";
    }).join("");
    h += "</tbody></table></div>";
    var mm = findMono("modules");
    if (mm) h += '<div class="panel"><h3>Monolith module deep-dive</h3><div class="md">' + renderMarkdown(mm.markdown || "") + "</div></div>";
    return h;
  };

  views.migration = function () {
    var t = findTopic("decomposition-status") || {};
    var h = '<div class="page-head"><h2>Monolith → Service Migration</h2><p>' + esc(t.summary || "") + "</p></div>";
    var comps = (D.components || []).filter(function (c) { return ["monolith", "service", "hybrid", "in-progress"].indexOf(c.migrationStatus) >= 0; });
    var groups = { service: [], hybrid: [], "in-progress": [], monolith: [] };
    comps.forEach(function (c) { if (groups[c.migrationStatus]) groups[c.migrationStatus].push(c); });
    var labels = { service: "Extracted services (green)", hybrid: "Hybrid — service logic, legacy DB (red)", "in-progress": "In progress / moving", monolith: "Still in the monolith (purple)" };
    h += '<div class="stat-grid">';
    Object.keys(labels).forEach(function (k) {
      h += '<div class="stat"><div class="num">' + (groups[k].length) + '</div><div class="lbl">' + esc(labels[k]) + "</div></div>";
    });
    h += "</div>";
    Object.keys(labels).forEach(function (k) {
      if (!groups[k].length) return;
      h += '<div class="panel"><h3>' + statusBadge(k) + " &nbsp;" + esc(labels[k]) + '</h3><div class="pill-list">' +
        groups[k].map(function (c) { return '<span class="pill" style="cursor:pointer" data-comp="' + esc(c.name) + '">' + esc(c.name) + "</span>"; }).join("") + "</div></div>";
    });
    h += '<div class="panel"><h3>Decomposition analysis</h3><div class="md">' + renderMarkdown(t.markdown || "") + "</div></div>";
    setTimeout(function () {
      Array.prototype.forEach.call(document.querySelectorAll("[data-comp]"), function (p) {
        p.addEventListener("click", function () { openComponent(p.getAttribute("data-comp")); });
      });
    }, 0);
    return h;
  };

  views.techstack = function () {
    var h = '<div class="page-head"><h2>Technology Stack</h2><p>Aggregated frameworks, languages and tooling observed across the estate.</p></div>';
    var groups = D.techStack || buildTechStack();
    Object.keys(groups).forEach(function (g) {
      if (!groups[g] || !groups[g].length) return;
      h += '<div class="panel tech-group"><h4>' + esc(g) + '</h4><div class="pill-list">' +
        groups[g].map(function (t) {
          var label = typeof t === "string" ? t : (t.name + (t.count ? '  ·  ' + t.count : ""));
          return '<span class="pill">' + esc(label) + "</span>";
        }).join("") + "</div></div>";
    });
    return h;
  };

  views.infrastructure = function () { return topicPage("infrastructure", "Infrastructure & Deployment"); };
  views.data = function () { return topicPage("data-architecture", "Data & Persistence", findMono("data-domain")); };
  views.security = function () { return topicPage("security-identity", "Security & Identity"); };
  views.integrations = function () {
    var t = findTopic("integrations") || {};
    var h = '<div class="page-head"><h2>External Integrations</h2><p>' + esc(t.summary || "") + "</p></div>";
    if (t.keyTechnologies) h += techTags(t.keyTechnologies);
    // integration catalog from components
    var integ = {};
    (D.components || []).forEach(function (c) {
      (c.externalIntegrations || []).forEach(function (i) {
        var key = i.trim(); if (!key || /none|n\/a/i.test(key)) return;
        (integ[key] = integ[key] || []).push(c.name);
      });
    });
    var keys = Object.keys(integ).sort();
    if (keys.length) {
      h += '<div class="panel"><h3>Integration catalog</h3><table class="grid"><thead><tr><th>System / Technology</th><th>Used by</th></tr></thead><tbody>';
      h += keys.map(function (k) { return "<tr><td><b>" + esc(k) + "</b></td><td>" + esc(uniq(integ[k]).join(", ")) + "</td></tr>"; }).join("");
      h += "</tbody></table></div>";
    }
    h += '<div class="panel"><div class="md">' + renderMarkdown(t.markdown || "") + "</div></div>";
    return h;
  };

  views.analyses = function () {
    var h = '<div class="page-head"><h2>Deep-Dive Analyses</h2><p>Full cross-cutting and monolith analysis sections produced during discovery.</p></div>';
    (D.monolith || []).forEach(function (m) {
      h += '<div class="panel"><h3>🏛 ' + esc(m.topic) + '</h3><div class="topic-summary">' + esc(m.summary || "") + "</div>" + techTags(m.keyTechnologies) + '<div class="md">' + renderMarkdown(m.markdown || "") + "</div></div>";
    });
    (D.crossCutting || []).forEach(function (t) {
      h += '<div class="panel"><h3>' + esc(titleCase(t.topic || t.key)) + '</h3><div class="topic-summary">' + esc(t.summary || "") + "</div>" + techTags(t.keyTechnologies) + '<div class="md">' + renderMarkdown(t.markdown || "") + "</div></div>";
    });
    return h;
  };

  views.risks = function () {
    var rows = [];
    (D.crossCutting || []).forEach(function (t) { (t.risks || []).forEach(function (r) { rows.push(Object.assign({ area: titleCase(t.topic || t.key) }, r)); }); });
    (D.monolith || []).forEach(function (t) { (t.risks || []).forEach(function (r) { rows.push(Object.assign({ area: t.topic }, r)); }); });
    var order = { high: 0, medium: 1, low: 2 };
    rows.sort(function (a, b) { return (order[a.severity] || 3) - (order[b.severity] || 3); });
    var h = '<div class="page-head"><h2>Risk &amp; Observation Register</h2><p>Technical risks and notable observations surfaced across the discovery. Severity is an engineering assessment, evidence-gated to what the code shows.</p></div>';
    var counts = countBy(rows, "severity");
    h += '<div class="stat-grid">' +
      '<div class="stat"><div class="num red">' + (counts.high || 0) + '</div><div class="lbl">High</div></div>' +
      '<div class="stat"><div class="num amber">' + (counts.medium || 0) + '</div><div class="lbl">Medium</div></div>' +
      '<div class="stat"><div class="num">' + (counts.low || 0) + '</div><div class="lbl">Low</div></div></div>';
    if (!rows.length) return h + '<div class="empty">No risks captured.</div>';
    h += '<div class="panel"><table class="grid"><thead><tr><th>Severity</th><th>Area</th><th>Risk</th><th>Detail</th></tr></thead><tbody>';
    h += rows.map(function (r) {
      return '<tr><td class="sev-' + esc(r.severity) + '"><b>' + esc((r.severity || "").toUpperCase()) + "</b></td><td>" + esc(r.area) + "</td><td><b>" + esc(r.title) + "</b></td><td>" + esc(r.detail) + "</td></tr>";
    }).join("");
    h += "</tbody></table></div>";
    return h;
  };

  /* ---------------- helpers for views ---------------- */
  function topicPage(key, title, extraMono) {
    var t = findTopic(key) || {};
    var h = '<div class="page-head"><h2>' + esc(title) + '</h2><p>' + esc(t.summary || "") + "</p></div>";
    if (t.keyTechnologies) h += techTags(t.keyTechnologies);
    h += '<div class="panel"><div class="md">' + renderMarkdown(t.markdown || "No analysis captured.") + "</div></div>";
    if (extraMono) h += '<div class="panel"><h3>Monolith: ' + esc(extraMono.topic) + '</h3><div class="md">' + renderMarkdown(extraMono.markdown || "") + "</div></div>";
    if (t.risks && t.risks.length) {
      h += '<div class="panel"><h3>Risks in this area</h3><table class="grid"><thead><tr><th>Severity</th><th>Risk</th><th>Detail</th></tr></thead><tbody>' +
        t.risks.map(function (r) { return '<tr><td class="sev-' + esc(r.severity) + '"><b>' + esc((r.severity || "").toUpperCase()) + "</b></td><td><b>" + esc(r.title) + "</b></td><td>" + esc(r.detail) + "</td></tr>"; }).join("") +
        "</tbody></table></div>";
    }
    return h;
  }
  function findTopic(key) { return (D.crossCutting || []).find(function (t) { return t.key === key || t.topic === key; }); }
  function findMono(frag) { return (D.monolith || []).find(function (m) { return (m.label || m.topic || "").toLowerCase().indexOf(frag) >= 0 || (m._focus || "").indexOf(frag) >= 0; }) || (D.monolith || []).find(function (m){ return (m.topic||"").toLowerCase().indexOf(frag)>=0; }); }
  function techTags(list) { list = arr(list); if (!list.length) return ""; return '<div class="tech-tags">' + list.map(function (t) { return '<span class="pill">' + esc(t) + "</span>"; }).join("") + "</div>"; }
  function countBy(list, key) { var o = {}; (list || []).forEach(function (x) { var k = x[key] || "unknown"; o[k] = (o[k] || 0) + 1; }); return o; }
  function uniq(a) { return a.filter(function (x, i) { return x && a.indexOf(x) === i; }); }
  function fmt(n) { return n == null ? "—" : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function truncate(s, n) { s = String(s || ""); return s.length > n ? s.slice(0, n - 1) + "…" : s; }
  function barChart(obj, status) {
    var entries = Object.keys(obj).map(function (k) { return [k, obj[k]]; }).sort(function (a, b) { return b[1] - a[1]; });
    var max = Math.max.apply(null, entries.map(function (e) { return e[1]; }).concat([1]));
    return entries.map(function (e) {
      var pct = Math.round((e[1] / max) * 100);
      var color = status ? statusColor(e[0]) : "";
      return '<div class="bar-row"><div class="name">' + esc(titleCase(e[0])) + '</div><div class="bar-track"><div class="bar-fill" style="width:' + pct + "%;" + (color ? "background:" + color : "") + '"></div></div><div class="val">' + e[1] + "</div></div>";
    }).join("");
  }
  function statusColor(s) {
    return { monolith: "#a974ff", service: "#2ecc8f", hybrid: "#ff6b6b", frontend: "#4ea1ff", infra: "#38d6d6", "in-progress": "#f5b942" }[s] || "#9fb0cc";
  }
  function buildTechStack() {
    var groups = { Languages: {}, "Backend frameworks": {}, "Frontend & UI": {}, "Data & messaging": {}, "Cloud & DevOps": {}, Integrations: {} };
    function add(g, name) { if (!name) return; groups[g][name] = (groups[g][name] || 0) + 1; }
    (D.components || []).forEach(function (c) {
      (c.primaryLanguages || []).forEach(function (l) { add("Languages", l); });
      (c.frameworks || []).forEach(function (f) {
        if (/angular|kendo|primeng|nx|cordova|signalr|formly/i.test(f)) add("Frontend & UI", f);
        else add("Backend frameworks", f);
      });
      (c.dataStores || []).forEach(function (d) { if (!/none|n\/a/i.test(d)) add("Data & messaging", d); });
      (c.externalIntegrations || []).forEach(function (i) { if (!/none|n\/a/i.test(i)) add("Integrations", i); });
    });
    var out = {};
    Object.keys(groups).forEach(function (g) {
      out[g] = Object.keys(groups[g]).map(function (k) { return { name: k, count: groups[g][k] }; }).sort(function (a, b) { return b.count - a.count; });
    });
    return out;
  }

  /* ---------------- drawer ---------------- */
  function openDrawer() { drawer.classList.add("open"); backdrop.classList.add("open"); }
  function closeDrawer() { drawer.classList.remove("open"); backdrop.classList.remove("open"); }
  backdrop.addEventListener("click", closeDrawer);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeDrawer(); });

  /* ---------------- router ---------------- */
  function go(view) {
    Array.prototype.forEach.call(nav.querySelectorAll("button"), function (b) { b.classList.toggle("active", b.getAttribute("data-view") === view); });
    main.innerHTML = (views[view] || views.overview)();
    main.scrollTop = 0; window.scrollTo(0, 0);
    if (location.hash !== "#" + view) history.replaceState(null, "", "#" + view);
  }
  nav.addEventListener("click", function (e) { var b = e.target.closest("button[data-view]"); if (b) go(b.getAttribute("data-view")); });

  /* ---------------- boot ---------------- */
  function boot() {
    if (!D || !D.components) { main.innerHTML = '<div class="empty">data.js not loaded or empty.</div>'; return; }
    var foot = document.getElementById("foot");
    foot.innerHTML = (D.meta && D.meta.generated ? "Generated " + esc(D.meta.generated) + "<br>" : "") + (D.components.length) + " components · read-only assessment";
    var initial = (location.hash || "#overview").slice(1);
    go(views[initial] ? initial : "overview");
  }
  boot();
})();
