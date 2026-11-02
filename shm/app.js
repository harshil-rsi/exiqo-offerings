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
  function yesNo(v){ return v ? '<span class="yes">Yes</span>' : '<span class="no">—</span>'; }
  function monthYear(iso){
    var m = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    var p = String(iso || "").split("-");
    if (p.length >= 2) { var mi = parseInt(p[1], 10) - 1; if (mi >= 0 && mi < 12) return m[mi] + " " + p[0]; }
    return iso || "";
  }

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
    var byCapStatus = countBy(D.modules || [], "status");
    var byComplexity = countBy(comps, "complexity");

    // ---- hero: the survey thesis + migration soundings ----
    var mods = D.modules || [];
    var order = ["monolith", "hybrid", "in-progress", "service"];
    var sndLabels = { monolith: "In the monolith", hybrid: "Hybrid coupling", "in-progress": "In progress", service: "Extracted" };
    var modBy = countBy(mods, "status");
    var totalCaps = mods.length || 1;
    var monoCount = modBy.monolith || 0;
    var gen = (D.meta && D.meta.generated) || "";

    var figs = [
      [comps.length, "Components surveyed", ""],
      [byCat["backend-service"] || 0, "Backend services", "green"],
      [monoCount + " / " + totalCaps, "Monolith-resident", "purple"],
      [fmt(s.csFiles), "C# files", ""],
    ];
    var soundings = '<div class="soundings"><div class="soundings-bar">';
    order.forEach(function (k) {
      var n = modBy[k] || 0; if (!n) return;
      var pct = (n / totalCaps) * 100;
      soundings += '<div class="soundings-seg" style="flex:' + n + ';background:' + statusColor(k) + '" title="' + esc(sndLabels[k]) + ": " + n + '">' + (n >= 2 ? '<span class="snd-n">' + n + "</span>" : "") + "</div>";
    });
    soundings += "</div><div class=\"soundings-scale\">";
    order.forEach(function (k) {
      var n = modBy[k] || 0; if (!n) return;
      soundings += '<span class="snd-key"><span class="dot" style="background:' + statusColor(k) + '"></span>' + esc(sndLabels[k]) + " <b>" + n + "</b></span>";
    });
    soundings += "</div></div>";

    var h = '<div class="hero">' +
      '<div class="hero-kicker">Surveyed ' + esc(monthYear(gen)) + ' · Strangler-fig decomposition</div>' +
      '<h1 class="hero-title">Most of the platform is <em>still in the monolith</em>.</h1>' +
      '<p class="hero-lede">The NExT platform is an Orleans-based .NET estate that Safe Harbor’s teams are decomposing into independent services. This survey charts every component and shows where each capability lives today — <b>' + monoCount + ' of ' + totalCaps + '</b> core capabilities remain in the monolith, with <b>' + (modBy.hybrid || 0) + '</b> still coupled to the legacy database.</p>' +
      soundings +
      '<div class="hero-figs">' + figs.map(function (f) {
        return '<div class="fig"><div class="fig-num ' + f[2] + '">' + f[0] + '</div><div class="fig-lbl">' + f[1] + "</div></div>";
      }).join("") + "</div>" +
      "</div>";

    var cards = [
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

    h += '<div class="stat-grid">' + cards.map(function (c) {
      return '<div class="stat"><div class="num ' + c[2] + '">' + c[1] + '</div><div class="lbl">' + c[0] + "</div></div>";
    }).join("") + "</div>";

    h += '<div class="two-col">';
    h += '<div class="panel"><h3>Components by category</h3>' + barChart(byCat) + "</div>";
    h += '<div class="panel"><h3>Capability migration status</h3><p class="topic-summary" style="margin:-4px 0 8px">Business capabilities — most are still served by the monolith.</p>' + barChart(byCapStatus, true) + "</div>";
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
        var open = function () { openComponent(card.getAttribute("data-name")); };
        card.addEventListener("click", open);
        card.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
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
    return '<div class="ccard" data-name="' + esc(c.name) + '" tabindex="0" role="button" aria-label="' + esc(c.name) + ' — open profile">' +
      '<div class="top"><h4>' + esc(c.name) + "</h4>" + statusBadge(c.migrationStatus) + "</div>" +
      '<div class="purpose">' + esc(truncate(c.businessPurpose, 140)) + "</div>" +
      '<div class="meta">' + tags + "</div>" +
      '<div class="metrics">' +
        (m.cs ? "<span><b>" + fmt(m.cs) + "</b> cs</span>" : "") +
        (m.ts ? "<span><b>" + fmt(m.ts) + "</b> ts</span>" : "") +
        (m.sql ? "<span><b>" + fmt(m.sql) + "</b> sql</span>" : "") +
        '<span class="cx-tag ' + cxClass(c.complexity) + '">' + esc(titleCase(c.complexity || "")) + "</span>" +
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
    h += '<div class="k">CI pipeline</div><div>' + yesNo(c.hasPipeline) + "</div>";
    h += '<div class="k">Tests</div><div>' + yesNo(c.hasTests) + "</div>";
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
    var h = '<div class="page-head"><h2>Business Modules</h2><p>The platform’s functional modules, each mapped to where it lives today. Note: the source module map is ~6 months stale; statuses below are verified against code wherever evidence allowed.</p></div>';
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
    var mods = D.modules || [];
    var order = ["monolith", "hybrid", "in-progress", "service"];
    var capLabels = { monolith: "Still in the monolith", hybrid: "Hybrid — service + legacy DB", "in-progress": "In progress / moving", service: "Extracted (service)" };
    var modBy = countBy(mods, "status");
    var h = '<div class="page-head"><h2>Monolith → Service Migration</h2><p>' + esc(t.summary || "") + "</p></div>";

    // Headline = business capabilities (the meaningful "what has left the monolith" measure)
    h += '<p class="topic-summary">Headline counts are <b>business capabilities</b> (functional modules) — the meaningful measure of what has left the monolith. The monolith is still the system of record for most of them.</p>';
    h += '<div class="stat-grid">';
    order.forEach(function (k) {
      h += '<div class="stat"><div class="num" style="color:' + statusColor(k) + '">' + (modBy[k] || 0) + '</div><div class="lbl">' + esc(capLabels[k]) + "</div></div>";
    });
    h += "</div>";

    // Capability breakdown grouped by status
    h += '<div class="panel"><h3>Business capabilities by status</h3>';
    order.forEach(function (k) {
      var list = mods.filter(function (m) { return m.status === k; });
      if (!list.length) return;
      h += '<div style="margin:12px 0 4px">' + statusBadge(k) + ' <span class="count-chip">' + list.length + '</span></div>';
      h += '<div class="pill-list">' + list.map(function (m) { return '<span class="pill">' + esc(m.name) + "</span>"; }).join("") + "</div>";
    });
    h += "</div>";

    // Repository-level lens (components)
    var comps = (D.components || []).filter(function (c) { return ["monolith", "service", "hybrid", "in-progress"].indexOf(c.migrationStatus) >= 0; });
    var groups = { monolith: [], hybrid: [], "in-progress": [], service: [] };
    comps.forEach(function (c) { if (groups[c.migrationStatus]) groups[c.migrationStatus].push(c); });
    var repoLabels = { monolith: "Monolith", hybrid: "Hybrid — writes to legacy DB", "in-progress": "In progress", service: "Extracted service repo" };
    h += '<div class="panel"><h3>Service repositories by extraction status</h3>';
    h += '<p class="topic-summary">Repository-level lens: how the ' + comps.length + ' code repositories map onto the monolith. (A capability can still be "in the monolith" even when a partial service repo exists.)</p>';
    order.forEach(function (k) {
      if (!groups[k].length) return;
      h += '<div style="margin:12px 0 4px">' + statusBadge(k) + " " + esc(repoLabels[k]) + ' <span class="count-chip">' + groups[k].length + '</span></div>';
      h += '<div class="pill-list">' + groups[k].map(function (c) { return '<span class="pill" style="cursor:pointer" data-comp="' + esc(c.name) + '">' + esc(c.name) + "</span>"; }).join("") + "</div>";
    });
    h += "</div>";

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
          if (typeof t === "string") return '<span class="pill">' + esc(t) + "</span>";
          var cnt = t.count ? ' <span class="tcount">' + t.count + "</span>" : "";
          var cls = (t.count && t.count <= 1) ? "pill pill-faint" : "pill";
          return '<span class="' + cls + '">' + esc(t.name) + cnt + "</span>";
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
      h += '<div class="panel"><h3>' + esc(m.topic) + '</h3><div class="topic-summary">' + esc(m.summary || "") + "</div>" + techTags(m.keyTechnologies) + '<div class="md">' + renderMarkdown(m.markdown || "") + "</div></div>";
    });
    (D.crossCutting || []).forEach(function (t) {
      var diagram = (t.key === "architecture-patterns" && window.ARCH_SVG) ? '<div class="diagram-panel" style="margin:6px 0 14px">' + window.ARCH_SVG + "</div>" : "";
      h += '<div class="panel"><h3>' + esc(titleCase(t.topic || t.key)) + '</h3><div class="topic-summary">' + esc(t.summary || "") + "</div>" + techTags(t.keyTechnologies) + diagram + '<div class="md">' + renderMarkdown(t.markdown || "") + "</div></div>";
    });
    return h;
  };

  views.risks = function () {
    var rows = [];
    (D.crossCutting || []).forEach(function (t) { (t.risks || []).forEach(function (r) { rows.push(Object.assign({ area: titleCase(t.topic || t.key) }, r)); }); });
    (D.monolith || []).forEach(function (t) { (t.risks || []).forEach(function (r) { rows.push(Object.assign({ area: t.topic }, r)); }); });
    var order = { high: 0, medium: 1, low: 2 };
    function rank(sev) { return order.hasOwnProperty(sev) ? order[sev] : 3; }
    rows.sort(function (a, b) { return rank(a.severity) - rank(b.severity); });
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

  /* ---------------- backlog census ---------------- */
  views.backlog = function () {
    var B = D.backlog;
    if (!B) return '<div class="empty">No backlog census loaded.</div>';
    var t = B.totals || {};

    var h = '<div class="page-head"><h2>Backlog Census</h2><p>' + esc(B.intro || "") + "</p></div>";
    h += asOfLine(B.asOf || "13 August 2026");

    // refresh note (26 Oct 2026) — the census below stays as the 13 Aug baseline
    if (B.refresh) {
      var R = B.refresh;
      h += '<div class="panel refresh-panel"><h3>Refresh as of ' + esc(R.asOf) + ' <span class="tag-new">Refresh</span></h3>';
      h += '<p class="topic-summary">' + esc(R.note) + "</p>";
      h += tblWrap('<table class="grid"><thead><tr><th>Measure</th><th>13 Aug (census)</th><th>' + esc(R.asOf.replace(/ 2026$/, "")) + '</th><th>Change</th></tr></thead><tbody>' +
        (R.deltas || []).map(function (x) {
          return "<tr><td>" + esc(x.metric) + '</td><td class="mono-n">' + esc(x.baseline) + '</td><td class="mono-n"><b>' + esc(x.now) + '</b></td><td class="mono-n">' + esc(x.change) + "</td></tr>";
        }).join("") + "</tbody></table>");
      if (R.points) h += '<ul class="md">' + R.points.map(function (p) { return "<li>" + mdInline(p) + "</li>"; }).join("") + "</ul>";
      h += '<p class="chart-note">Jump to: <a href="#backlog" data-jump="aging-refresh">severity &amp; priority aging</a> · <a href="#backlog" data-jump="curated-refresh">curated, impact-ranked backlog</a> · <a href="#delivery" data-goview="delivery">delivery &amp; releases</a></p>';
      h += "</div>";
      setTimeout(wireJumps, 0);
    }

    // provenance: how the scan was done — this is what buys confidence in the numbers
    if (B.method && B.method.length) {
      h += '<div class="method-strip">' + B.method.map(function (m, i) {
        return '<div class="method-step"><div class="ms-n">STEP ' + (i + 1) + '</div><div class="ms-t">' + esc(m.title) + '</div><div class="ms-d">' + esc(m.detail) + "</div></div>";
      }).join("") + "</div>";
    }

    h += '<div class="stat-grid">' + (B.headline || []).map(function (c) {
      return '<div class="stat"><div class="num ' + esc(c.tone || "") + '">' + esc(c.value) + '</div><div class="lbl">' + esc(c.label) + "</div></div>";
    }).join("") + "</div>";

    // the funnel: nominal count down to the real queue
    if (B.funnel && B.funnel.length) {
      var f0 = B.funnel[0].count || 1;
      h += '<div class="panel"><h3>From 16,129 items to the real queue</h3>';
      h += '<p class="topic-summary">Each step removes a class of item that is counted as backlog but cannot be planned as backlog. Every number below is a filter you can re-run yourself.</p>';
      h += '<div class="funnel">' + B.funnel.map(function (s, i) {
        var pct = (s.count / f0) * 100;
        return '<div class="fn-row"><div class="fn-stage">' + esc(s.stage) + '</div>' +
          '<div class="fn-track"><div class="fn-bar" style="width:' + pct + '%;opacity:' + (1 - i * 0.16) + '"></div>' +
          '<span class="fn-n">' + fmt(s.count) + "</span></div>" +
          '<div class="fn-note">' + mdInline(s.note) + "</div></div>";
      }).join("") + "</div></div>";
    }

    // triage split — the nominal-vs-actionable story
    if (B.triage && B.triage.length) {
      var trTotal = B.triage.reduce(function (a, x) { return a + x.count; }, 0) || 1;
      h += '<div class="panel"><h3>Nominal backlog vs. actionable backlog</h3>';
      h += '<p class="topic-summary">' + esc(B.triageIntro || "") + "</p>";
      h += '<div class="soundings"><div class="soundings-bar">';
      B.triage.forEach(function (x) {
        h += '<div class="soundings-seg" style="flex:' + x.count + ';background:' + esc(x.color) + '" title="' + esc(x.bucket) + ": " + x.count + '"><span class="snd-n">' + fmt(x.count) + "</span></div>";
      });
      h += "</div></div>";
      h += '<div class="seg-legend">' + B.triage.map(function (x) {
        return '<div class="seg-card"><div class="sc-top"><span class="sc-n" style="color:' + esc(x.color) + '">' + fmt(x.count) + '</span><span class="sc-l">' + esc(x.bucket) + " · " + Math.round((x.count / trTotal) * 100) + '%</span></div><div class="sc-r">' + esc(x.rule) + "</div></div>";
      }).join("") + "</div></div>";
    }

    // arrivals vs closures
    if (B.throughput && B.throughput.length) {
      h += '<div class="panel"><h3>Arrivals vs. closures, by month</h3>';
      h += '<p class="topic-summary">' + esc(B.throughputNote || "") + "</p>";
      h += colChart(B.throughput, "created", "closed");
      h += '<div class="chart-legend"><span><i style="background:var(--buoy)"></i>Created</span><span><i style="background:var(--depth)"></i>Closed</span></div>';
      if (B.burndown) h += '<div class="callout"><h4>Burn-down arithmetic</h4><p>' + esc(B.burndown) + "</p></div>";
      h += "</div>";
    }

    h += '<div class="two-col">';
    if (B.aging) h += '<div class="panel"><h3>Age of the live backlog</h3><p class="topic-summary" style="margin:-4px 0 10px">By creation date, oldest bucket last. Age at this scale is not a queue — it is a decision that was never taken.</p>' + seqBars(B.aging) + "</div>";
    if (B.byType) h += '<div class="panel"><h3>Live backlog by type</h3>' + barChart(kvObj(B.byType)) + "</div>";
    h += "</div>";

    h += '<div class="two-col">';
    if (B.staleness) h += '<div class="panel"><h3>Time since last touch</h3><p class="topic-summary" style="margin:-4px 0 10px">How long since anyone changed the item at all.</p>' + seqBars(B.staleness) + "</div>";
    if (B.byState) h += '<div class="panel"><h3>Open items by state</h3>' + barChart(kvObj(B.byState)) + "</div>";
    h += "</div>";

    // area path -> module map
    if (B.areas && B.areas.length) {
      h += '<div class="panel"><h3>Where the work sits — ADO area path mapped to platform module</h3>';
      h += '<p class="topic-summary">Every area path with material open volume, reconciled against the component catalog from the codebase survey. This is the join that makes the backlog actionable.</p>';
      h += '<table class="grid"><thead><tr><th>Area path</th><th>Platform module</th><th>Status</th><th>Open</th><th>Closed 6m</th><th>Read</th></tr></thead><tbody>';
      h += B.areas.map(function (a) {
        return "<tr><td><b>" + esc(a.area) + "</b></td><td>" + esc(a.module || "—") + "</td><td>" + (a.status ? statusBadge(a.status) : "—") +
          '</td><td class="mono-n">' + fmt(a.open) + '</td><td class="mono-n">' + fmt(a.closed6m) + "</td><td>" + esc(a.note || "") + "</td></tr>";
      }).join("") + "</tbody></table></div>";
    }

    // business-risk themes
    if (B.themes && B.themes.length) {
      h += '<div class="panel"><h3>Business-risk themes in the open backlog</h3>';
      h += '<p class="topic-summary">Title-level classification of open work against the risk categories that carry revenue, legal or data-accuracy exposure.</p>';
      h += '<table class="grid"><thead><tr><th>Theme</th><th>Open items</th><th>Why it matters</th><th>Representative items</th></tr></thead><tbody>';
      h += B.themes.map(function (x) {
        return "<tr><td><b>" + esc(x.theme) + '</b></td><td class="mono-n">' + fmt(x.count) + "</td><td>" + esc(x.why || "") + "</td><td>" +
          (x.examples || []).map(function (e) { return '<div class="evidence">' + esc(e) + "</div>"; }).join("") + "</td></tr>";
      }).join("") + "</tbody></table></div>";
    }

    h += '<div class="two-col">';
    if (B.ownership) {
      h += '<div class="panel"><h3>Delivery concentration</h3><p class="topic-summary">' + esc(B.ownership.note || "") + "</p>";
      h += '<table class="grid"><thead><tr><th>Contributor</th><th>Closed (6m)</th><th>Share</th></tr></thead><tbody>' +
        (B.ownership.top || []).map(function (p) {
          return "<tr><td>" + esc(p.name) + '</td><td class="mono-n">' + fmt(p.closed) + '</td><td class="mono-n">' + esc(p.share) + "</td></tr>";
        }).join("") + "</tbody></table></div>";
    }
    if (B.hygiene) {
      h += '<div class="panel"><h3>Backlog hygiene</h3><p class="topic-summary">Fields that determine whether an item can be planned without going back to its author.</p>';
      h += '<table class="grid"><thead><tr><th>Signal</th><th>Count</th><th>Of open</th></tr></thead><tbody>' +
        B.hygiene.map(function (x) {
          return "<tr><td>" + esc(x.metric) + '</td><td class="mono-n">' + fmt(x.value) + '</td><td class="mono-n">' + esc(x.pct || "") + "</td></tr>";
        }).join("") + "</tbody></table></div>";
    }
    h += "</div>";

    if (B.findings && B.findings.length) {
      h += '<div class="panel"><h3>What the census concludes</h3>' + B.findings.map(function (f) {
        return '<div class="finding sev-' + esc(f.severity || "low") + '"><div class="f-rail"></div><div class="f-body"><h5>' + esc(f.title) +
          '</h5><p>' + mdInline(f.detail) + "</p></div></div>";
      }).join("") + "</div>";
    }

    if (B.framework) {
      h += '<div class="panel"><h3>Prioritisation framework we will apply</h3><div class="md">' + renderMarkdown(B.framework) + "</div></div>";
    }
    if (B.caveats) {
      h += '<div class="callout warn"><h4>Limits of this census</h4><p>' + esc(B.caveats) + "</p></div>";
    }
    if (B.agingRefresh) h += agingRefreshSection(B.agingRefresh);
    if (B.curated) h += curatedSection(B.curated);
    return h;
  };

  /* ---------------- backlog refresh (26 Oct 2026): severity / priority aging ---------------- */
  function agingRefreshSection(A) {
    var h = '<div class="section-divider" id="aging-refresh"><span class="tag-new">Refresh · 26 Oct 2026</span><h2>Severity &amp; priority aging</h2></div>';
    h += '<div class="callout"><h4>Two backlogs behind one median</h4><p>' + esc(A.finding) + "</p></div>";
    h += '<div class="panel"><h3>Bugs by severity × age (live bugs, n = 414)</h3><p class="topic-summary">The higher the severity, the younger the item — severity orders the backlog as it should.</p>' + heatTable("Severity", A.columns, A.severity, "magenta") + "</div>";
    h += '<div class="panel"><h3>All live items by priority × age (n = 2,025)</h3><p class="topic-summary">The median ages of P2, P3 and P4 fall within about 65 days of one another: a priority view mostly re-sorts the overall average.</p>' + heatTable("Priority", A.columns, A.priority, "depth") + "</div>";
    h += '<div class="two-col">';
    h += '<div class="panel"><h3>Why severity, not priority</h3><p class="topic-summary">Priority is close to a constant; severity is deliberately set on two in five bugs and orders aging as it should.</p>' +
      '<table class="grid"><tbody>' + A.signal.map(function (x) { return "<tr><td>" + esc(x.metric) + '</td><td class="mono-n"><b>' + esc(x.value) + "</b></td></tr>"; }).join("") + "</tbody></table></div>";
    if (A.vitality) {
      h += '<div class="panel"><h3>Old but active, or old and abandoned?</h3><p class="topic-summary">' + esc(A.vitality.note) + "</p>";
      h += tblWrap('<table class="grid"><thead><tr><th></th><th>Total</th>' + A.vitality.categories.map(function (c) { return "<th>" + esc(c) + "</th>"; }).join("") + "</tr></thead><tbody>" +
        A.vitality.rows.map(function (r) {
          return "<tr><td><b>" + esc(r.key) + '</b></td><td class="mono-n">' + fmt(r.total) + "</td>" + r.cells.map(function (c, i) {
            return '<td class="mono-n' + (i === 3 ? " hot" : "") + '">' + fmt(c) + "</td>";
          }).join("") + "</tr>";
        }).join("") + "</tbody></table>");
      h += "</div>";
    }
    h += "</div>";

    if (A.sla && A.sla.length) {
      h += '<div class="panel"><h3>Proposed severity SLA — and where the backlog stands against it</h3><p class="topic-summary">' + esc(A.slaNote) + "</p>";
      h += tblWrap('<table class="grid"><thead><tr><th>Severity</th><th>Target</th><th>Open now</th><th>Breaching</th><th>&gt; 2× target</th><th>Breaching &amp; unassigned</th><th>Met historically (12m)</th></tr></thead><tbody>' +
        A.sla.map(function (s) {
          return "<tr><td><b>" + esc(s.severity) + "</b></td><td>" + esc(s.target) + '</td><td class="mono-n">' + fmt(s.open) + '</td><td class="mono-n' + (s.breaching ? " hot" : "") + '">' + fmt(s.breaching) +
            (s.pct != null ? " (" + Math.round(s.pct) + "%)" : "") + '</td><td class="mono-n">' + fmt(s.over2x) + '</td><td class="mono-n">' + fmt(s.unassigned) + '</td><td class="mono-n">' + (s.met != null ? Math.round(s.met) + "%" : "—") + "</td></tr>";
        }).join("") + "</tbody></table>");
      h += "</div>";
    }

    if (A.breaches && A.breaches.length) {
      h += '<div class="panel"><h3>The ' + A.breaches.length + ' Sev-2 bugs past the 30-day target</h3><p class="topic-summary">Oldest first. Titles paraphrased; location codes and names removed. Items marked <span class="pill pill-money">money</span> touch billing, payments or posting — each needs a fix date or a recorded downgrade.</p>';
      h += tblWrap('<table class="grid"><thead><tr><th>ID</th><th>Title</th><th>State</th><th>Age (d)</th><th>Days in state</th><th>Squad</th><th>Assigned</th></tr></thead><tbody>' +
        A.breaches.map(function (b) {
          return '<tr><td class="mono-n">#' + b.id + "</td><td>" + esc(b.title) + (b.money ? ' <span class="pill pill-money">money</span>' : "") + "</td><td>" + esc(b.state) +
            '</td><td class="mono-n">' + fmt(b.age) + '</td><td class="mono-n">' + fmt(b.inState) + "</td><td>" + esc(b.squad) + "</td><td>" + yesNo(b.assigned) + "</td></tr>";
        }).join("") + "</tbody></table>");
      h += "</div>";
    }

    h += '<div class="two-col">';
    if (A.resolution && A.resolution.length) {
      h += '<div class="panel"><h3>How fast bugs actually get fixed (closed, last 12 months)</h3><p class="topic-summary">Once work starts it moves quickly; the delay is in getting a bug started. Sev-1 sample is small (27).</p>';
      h += tblWrap('<table class="grid"><thead><tr><th>Severity</th><th>Closed</th><th>Median</th><th>p90</th><th>≤ 7d</th><th>≤ 30d</th><th>Active → closed</th></tr></thead><tbody>' +
        A.resolution.map(function (r) {
          return "<tr><td><b>" + esc(r.key) + '</b></td><td class="mono-n">' + fmt(r.closed) + '</td><td class="mono-n">' + r.median + ' d</td><td class="mono-n">' + r.p90 + ' d</td><td class="mono-n">' +
            Math.round(r.within7d) + '%</td><td class="mono-n">' + Math.round(r.within30d) + '%</td><td class="mono-n">' + r.activeMedian + " d</td></tr>";
        }).join("") + "</tbody></table>");
      h += "</div>";
    }
    h += '<div class="panel"><h3>The working slice: last 90 days + in progress</h3><p class="topic-summary">' + esc(A.workingSlice) + '</p><div class="callout warn"><h4>Stale work in progress</h4><p>' + esc(A.staleWip) + "</p></div></div>";
    h += "</div>";
    return h;
  }

  /* ---------------- backlog refresh (26 Oct 2026): curated, impact-ranked backlog ---------------- */
  function curatedSection(C) {
    var h = '<div class="section-divider" id="curated-refresh"><span class="tag-new">Refresh · 26 Oct 2026</span><h2>Curated, impact-ranked backlog <span class="draft-pill">Draft</span></h2></div>';
    h += '<div class="callout warn"><h4>Draft for product-team validation</h4><p>' + esc(C.status) + "</p></div>";
    h += '<p class="topic-summary">' + esc(C.finding) + "</p>";
    h += '<div class="stat-grid">' + C.headline.map(function (c) {
      return '<div class="stat"><div class="num ' + esc(c.tone || "") + '">' + esc(c.value) + '</div><div class="lbl">' + esc(c.label) + "</div></div>";
    }).join("") + "</div>";

    var total = C.dispositions.reduce(function (a, x) { return a + x.count; }, 0) || 1;
    h += '<div class="panel"><h3>Four dispositions, applied in strict order</h3>';
    h += '<div class="soundings"><div class="soundings-bar">' + C.dispositions.map(function (x) {
      return '<div class="soundings-seg" style="flex:' + x.count + ";background:" + esc(C.dispositionColors[x.disposition] || "#93a6a4") + '" title="' + esc(x.disposition) + ": " + x.count + '"><span class="snd-n">' + fmt(x.count) + "</span></div>";
    }).join("") + "</div></div>";
    h += tblWrap('<table class="grid"><thead><tr><th>Disposition</th><th>Items</th><th>Share</th><th>Bugs</th><th>Money-touching</th><th>Median age (d)</th><th>Avg score</th></tr></thead><tbody>' +
      C.dispositions.map(function (x) {
        return '<tr><td><b style="color:' + esc(C.dispositionColors[x.disposition] || "inherit") + '">' + esc(x.disposition) + '</b></td><td class="mono-n">' + fmt(x.count) + '</td><td class="mono-n">' + Math.round(x.count / total * 100) + '%</td><td class="mono-n">' +
          fmt(x.bugs) + '</td><td class="mono-n">' + fmt(x.money) + '</td><td class="mono-n">' + fmt(x.age) + '</td><td class="mono-n">' + x.score + "</td></tr>";
      }).join("") + "</tbody></table>");
    h += '<p class="chart-note">' + esc(C.rebaselineNote) + "</p></div>";

    h += '<div class="panel"><h3>By transition wave</h3><p class="topic-summary">The revenue path holds 136 of the 152 Do-now items — confirming that the money path moves while the incumbent is fully available.</p>';
    h += tblWrap('<table class="grid"><thead><tr><th>Wave</th><th>Live</th><th>Do now</th><th>Do this quarter</th><th>Re-baseline</th><th>Archive</th></tr></thead><tbody>' +
      C.waves.map(function (w) {
        return "<tr><td><b>" + esc(w.wave) + '</b></td><td class="mono-n">' + fmt(w.total) + '</td><td class="mono-n' + (w.doNow > 50 ? " hot" : "") + '">' + fmt(w.doNow) + '</td><td class="mono-n">' + fmt(w.quarter) +
          '</td><td class="mono-n">' + fmt(w.rebaseline) + '</td><td class="mono-n">' + fmt(w.archive) + "</td></tr>";
      }).join("") + "</tbody></table>");
    h += "</div>";

    h += '<div class="panel"><h3>Top 25 impact-ranked items</h3><p class="topic-summary">' + esc(C.topNote) + "</p>";
    h += tblWrap('<table class="grid top-items"><thead><tr><th>#</th><th>ID</th><th>Item</th><th>Type</th><th>Sev/Pri</th><th>Age (d)</th><th>State</th><th>Area</th><th>Score</th></tr></thead><tbody>' +
      C.top.map(function (t) {
        return '<tr><td class="mono-n">' + t.rank + '</td><td class="mono-n">#' + t.id + "</td><td><b>" + esc(t.title) + '</b><div class="why">' + esc(t.why) + "</div></td><td>" + esc(t.type) +
          '</td><td class="mono-n">' + esc(t.sevpri) + '</td><td class="mono-n">' + fmt(t.age) + "</td><td>" + esc(t.state) + "</td><td><code>" + esc(t.area) + '</code></td><td class="mono-n"><b>' + t.score.toFixed(1) + "</b></td></tr>";
      }).join("") + "</tbody></table>");
    h += "</div>";

    h += '<div class="panel"><h3>Where effort is going vs. where risk is</h3><ul class="md">' + C.focus.map(function (f) { return "<li>" + mdInline(f) + "</li>"; }).join("") + "</ul></div>";

    h += '<div class="panel"><h3>Stale-backlog triage: 677 archive candidates, 15 decisions</h3><p class="topic-summary"><b>Rule.</b> ' + esc(C.archiveRule) + "</p>";
    h += tblWrap('<table class="grid"><thead><tr><th>Cluster</th><th>Items</th><th>Defects</th><th>Median age (y)</th><th>Suggested decision</th></tr></thead><tbody>' +
      C.clusters.map(function (c) {
        return '<tr><td><span class="mono-n" style="color:var(--depth)">' + esc(c.id) + "</span> " + esc(c.name) + '</td><td class="mono-n">' + fmt(c.count) + '</td><td class="mono-n">' + fmt(c.bugs) + '</td><td class="mono-n">' + c.age.toFixed(1) + "</td><td>" + esc(c.decision) + "</td></tr>";
      }).join("") + "</tbody></table>");
    var S = C.saving;
    h += '<div class="callout"><h4>What AI-assisted triage saves — ' + esc(S.saved) + "</h4><p>" + fmt(S.manualDecisions) + " item-by-item decisions (~" + S.manualHours + " product-owner hours) become " + S.clusterDecisions + " cluster decisions (~" + S.aiHours + " hours). " + esc(S.note) + "</p></div>";
    h += "</div>";

    h += '<div class="panel"><h3>What this means for the transition</h3><ol class="md">' + C.implications.map(function (x) { return "<li>" + mdInline(x) + "</li>"; }).join("") + "</ol></div>";
    return h;
  }

  /* ---------------- delivery & releases (26 Oct 2026) ---------------- */
  var deliveryMeasure = "closed";
  views.delivery = function () {
    var V = D.delivery;
    if (!V) return '<div class="empty">No delivery analysis loaded.</div>';
    var h = '<div class="page-head"><h2>Delivery &amp; Releases</h2><p>' + esc(V.intro) + "</p></div>";
    h += '<div class="asof"><span class="dot"></span>Data as of <b>' + esc(V.asOf) + '</b> · Azure DevOps project <code>NeXT</code> · 13,934 work items · 4,488 PRs · 1,684 builds</div>';

    // what was asked
    h += '<div class="panel"><h3>What was asked</h3><p class="topic-summary">Five follow-up asks from the 20 and 27 August client sessions. Three are answered on this page; two live in the refreshed Backlog Census.</p>';
    h += tblWrap('<table class="grid"><thead><tr><th>#</th><th>Ask</th><th>Raised by</th><th>Answered in</th></tr></thead><tbody>' +
      V.asks.map(function (a) {
        var link = a.view === "delivery" ? esc(a.where) : '<a href="#backlog" data-goview="backlog">' + esc(a.where) + "</a>";
        return '<tr><td class="mono-n">' + a.n + "</td><td><b>" + esc(a.ask) + "</b></td><td>" + esc(a.by) + "</td><td>" + link + "</td></tr>";
      }).join("") + "</tbody></table>");
    h += "</div>";

    h += '<div class="callout"><h4>The headline</h4><p>' + esc(V.finding) + "</p></div>";
    h += '<div class="stat-grid">' + V.headline.map(function (c) {
      return '<div class="stat"><div class="num ' + esc(c.tone || "") + '">' + esc(c.value) + '</div><div class="lbl">' + esc(c.label) + "</div></div>";
    }).join("") + "</div>";

    // pipeline access
    h += '<div class="two-col">';
    h += '<div class="panel"><h3>Pipeline access — confirmed</h3>';
    h += tblWrap('<table class="grid"><thead><tr><th>Capability</th><th>Access</th><th>Notes</th></tr></thead><tbody>' +
      V.access.map(function (a) {
        var cls = a.access === "yes" ? "acc-yes" : a.access === "no" ? "acc-no" : "acc-part";
        var lbl = a.access === "yes" ? "Yes" : a.access === "no" ? "No" : "Partial";
        return "<tr><td><b>" + esc(a.capability) + '</b></td><td><span class="acc ' + cls + '">' + lbl + "</span></td><td>" + esc(a.note) + "</td></tr>";
      }).join("") + "</tbody></table>");
    h += '<div class="callout warn"><h4>Build layer readable; release layer is not</h4><p>' + esc(V.accessVerdict) + "</p></div></div>";
    h += '<div class="panel"><h3>Pipeline estate</h3>' + seqBars(V.estate) + '<p class="chart-note">24% of builds in the last 12 months were queued manually. Build success over the last 30 days is 98.7% — CI is not the bottleneck.</p>';
    h += '<h3 style="margin-top:22px">Where the time goes</h3><p class="topic-summary" style="margin:-4px 0 10px">Median days, request to production. Segments do not sum exactly to the total.</p>' + flowBars(V.flow) + "</div>";
    h += "</div>";

    // release cadence
    h += '<div class="panel"><h3>Release cadence — cut to ship, by train</h3><p class="topic-summary">Each bar runs from the first to the last activity on a release branch (the inferred cut and ship dates). The number is the count of develop PRs in the batch.</p>';
    h += releaseTimeline(V.monolith, V.services);
    h += '<ul class="md">' + V.cadenceNotes.map(function (x) { return "<li>" + mdInline(x) + "</li>"; }).join("") + "</ul>";
    h += tblWrap('<table class="grid"><thead><tr><th>Monolith release</th><th>Cut</th><th>Ship (proxy)</th><th>Stabilisation (d)</th><th>Days since prev.</th><th>Develop PRs</th><th>Fix PRs on branch</th><th>Median PR-to-ship (d)</th></tr></thead><tbody>' +
      V.monolith.map(function (r) {
        return "<tr><td><b>" + esc(r.release) + "</b></td><td>" + esc(r.cut || "—") + "</td><td>" + esc(r.ship) + '</td><td class="mono-n' + (r.stab > 60 ? " hot" : "") + '">' + fmt(r.stab) + '</td><td class="mono-n">' + fmt(r.gap) +
          '</td><td class="mono-n' + (r.prs > 120 ? " hot" : "") + '">' + fmt(r.prs) + '</td><td class="mono-n">' + fmt(r.fixPrs) + '</td><td class="mono-n">' + fmt(r.lead) + "</td></tr>";
      }).join("") + "</tbody></table>");
    h += '<p class="chart-note">4.12 first shipped on 8 Dec 2025; its branch saw a second burst of activity in early February, which is when the branch-activity proxy dates it.</p></div>';

    // velocity vs incidents
    h += '<div class="panel" id="velocity-panel"><h3>Shipping velocity vs. production incidents, by month</h3>';
    h += '<p class="topic-summary">' + esc(V.incidentDefinition) + "</p>";
    h += '<div class="seg-toggle" role="group" aria-label="Velocity measure">' + [["closed", "Items closed"], ["prs", "PRs merged"], ["releases", "Release events"]].map(function (m) {
      return '<button type="button" data-measure="' + m[0] + '" class="' + (deliveryMeasure === m[0] ? "on" : "") + '">' + m[1] + "</button>";
    }).join("") + "</div>";
    h += '<div id="dualchart-host">' + dualChart(V.monthly, deliveryMeasure, "incidents") + "</div>";
    h += '<div class="chart-legend"><span><i style="background:var(--depth)"></i><span id="dc-bar-lbl">' + measureLabel(deliveryMeasure) + '</span></span><span><i style="background:var(--magenta)"></i>Production-signal items</span><span><i style="background:var(--depth);opacity:.4"></i>Oct 2026 is partial (to the 26th)</span></div>';
    h += '<p class="chart-note">Each series is scaled to its own maximum; compare shapes, not heights.</p></div>';

    // incident types
    h += '<div class="panel"><h3>Production-signal items by outage type</h3><p class="topic-summary">248 items in 13 months. One type per item, first-matching keyword rule. Darker cells mean more items that month.</p>';
    h += typeHeat(V.monthly, V.typeOrder, V.types) + "</div>";

    // correlation findings
    h += '<div class="panel"><h3>What the correlation work shows</h3>' + V.findings.map(function (f) {
      return '<div class="finding sev-' + esc(f.severity) + '"><div class="f-rail"></div><div class="f-body"><h5>' + esc(f.title) + "</h5><p>" + mdInline(f.detail) + "</p></div></div>";
    }).join("") + "</div>";

    h += '<div class="panel"><h3>Batch size vs. what followed — monolith releases</h3>';
    h += tblWrap('<table class="grid"><thead><tr><th>Release</th><th>Shipped</th><th>Develop PRs</th><th>Prod signal, 14 days</th><th>Prod signal, 30 days</th><th>Hotfixes ≤ 30 days</th></tr></thead><tbody>' +
      V.batch.map(function (b) {
        return "<tr><td><b>" + esc(b.release) + "</b></td><td>" + esc(b.ship) + '</td><td class="mono-n' + (b.prs > 120 ? " hot" : "") + '">' + fmt(b.prs) + '</td><td class="mono-n' + (b.inc14 > 20 ? " hot" : "") + '">' + fmt(b.inc14) +
          '</td><td class="mono-n">' + fmt(b.inc30) + (b.partial ? "*" : "") + '</td><td class="mono-n">' + fmt(b.hotfixes) + "</td></tr>";
      }).join("") + "</tbody></table>");
    h += '<p class="chart-note">*Only 20 days had elapsed at the snapshot, so the 4.16 30-day figure is a lower bound. Pearson 0.81, Spearman 0.48 (n = 8); 0.22 without 4.16.</p></div>';

    h += '<div class="callout warn"><h4>Read these results with care</h4><p>' + esc(V.caveat) + "</p></div>";
    h += '<div class="panel"><h3>What it means</h3><ol class="md">' + V.velocityImplications.map(function (x) { return "<li>" + mdInline(x) + "</li>"; }).join("") + "</ol></div>";

    // root causes
    h += '<div class="section-divider"><h2>Why releases take so long and cost so much</h2></div>';
    h += '<p class="topic-summary">Ten root causes, ranked by business impact. ' + esc(V.reinforce) + "</p>";
    h += '<div class="rc-grid">' + V.rootCauses.map(function (r) {
      return '<details class="rc-card"' + (r.rank <= 3 ? " open" : "") + '><summary><span class="rc-rank">' + r.rank + '</span><span class="rc-title">' + esc(r.title) + '</span><span class="rc-pills"><span class="dim-pill dim-' + esc(r.dimKey) + '">' + esc(r.dimension) +
        '</span><span class="lvl-pill">Impact: <b>' + esc(r.impact) + '</b></span><span class="lvl-pill conf-' + esc(r.confidence) + '">Confidence: <b>' + esc(r.confidence) + "</b></span></span></summary>" +
        '<div class="rc-body"><p class="rc-sum">' + esc(r.summary) + '</p><h6>Evidence</h6><ul>' + r.evidence.map(function (e) { return "<li>" + mdInline(e) + "</li>"; }).join("") + "</ul>" +
        '<h6>Business consequence</h6><p>' + esc(r.consequence) + '</p><h6>Lever</h6><p>' + esc(r.lever) + "</p>" +
        (r.confidenceNote ? '<p class="chart-note">' + esc(r.confidenceNote) + "</p>" : "") + "</div></details>";
    }).join("") + "</div>";

    // business case
    h += '<div class="callout biz-case"><h4>The business case for change</h4><p>' + esc(V.businessCase) + "</p></div>";
    h += '<div class="panel"><h3>The levers, and what they change</h3>';
    h += tblWrap('<table class="grid"><thead><tr><th>Lever</th><th>Addresses</th><th>What changes</th></tr></thead><tbody>' +
      V.levers.map(function (l) { return "<tr><td><b>" + esc(l.lever) + '</b></td><td class="mono-n" style="text-align:left">' + esc(l.addresses) + "</td><td>" + esc(l.change) + "</td></tr>"; }).join("") + "</tbody></table>");
    h += "</div>";
    h += '<div class="panel"><h3>Data that would raise confidence</h3>';
    h += tblWrap('<table class="grid"><thead><tr><th>Gap</th><th>What closes it</th></tr></thead><tbody>' +
      V.dataGaps.map(function (g) { return "<tr><td><b>" + esc(g.gap) + "</b></td><td>" + esc(g.ask) + "</td></tr>"; }).join("") + "</tbody></table>");
    h += "</div>";

    setTimeout(wireDelivery, 0);
    return h;
  };

  function measureLabel(k) { return { closed: "Items closed", prs: "PRs merged", releases: "Release events" }[k] || k; }
  function wireDelivery() {
    var panel = document.getElementById("velocity-panel");
    if (!panel || !D.delivery) return;
    Array.prototype.forEach.call(panel.querySelectorAll("[data-measure]"), function (b) {
      b.addEventListener("click", function () {
        deliveryMeasure = b.getAttribute("data-measure");
        Array.prototype.forEach.call(panel.querySelectorAll("[data-measure]"), function (x) { x.classList.toggle("on", x === b); });
        document.getElementById("dualchart-host").innerHTML = dualChart(D.delivery.monthly, deliveryMeasure, "incidents");
        document.getElementById("dc-bar-lbl").textContent = measureLabel(deliveryMeasure);
      });
    });
    wireJumps();
  }
  function wireJumps() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-goview]"), function (a) {
      if (a._wired) return; a._wired = true;
      a.addEventListener("click", function (e) { e.preventDefault(); EXT.utils.go(a.getAttribute("data-goview")); });
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-jump]"), function (a) {
      if (a._wired) return; a._wired = true;
      a.addEventListener("click", function (e) {
        e.preventDefault();
        var t = document.getElementById(a.getAttribute("data-jump"));
        if (t && t.scrollIntoView) t.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }
  function tblWrap(html) { return '<div class="tbl-scroll">' + html + "</div>"; }
  // heat-style matrix: rows x age buckets, cell shade proportional to the row's share
  function heatTable(firstCol, columns, rows, hue) {
    var rgb = hue === "magenta" ? "224,112,158" : "70,217,198";
    var max = 1;
    rows.forEach(function (r) { if (!/^All/.test(r.key)) r.cells.forEach(function (c) { if (c > max) max = c; }); });
    return tblWrap('<table class="grid heat"><thead><tr><th>' + esc(firstCol) + "</th><th>Total</th>" + columns.map(function (c) { return "<th>" + esc(c) + "</th>"; }).join("") +
      "<th>Median</th><th>p90</th></tr></thead><tbody>" + rows.map(function (r) {
        var all = /^All/.test(r.key);
        return '<tr class="' + (all ? "heat-total" : "") + '"><td><b>' + esc(r.key) + '</b></td><td class="mono-n"><b>' + fmt(r.total) + "</b></td>" + r.cells.map(function (c) {
          var a = all ? 0 : Math.min(0.85, (c / max) * 0.85);
          return '<td class="mono-n heat-cell" style="background:rgba(' + rgb + "," + a.toFixed(2) + ')' + (a > 0.45 ? ";color:#0b1416" : "") + '">' + (c ? fmt(c) : "·") + "</td>";
        }).join("") + '<td class="mono-n">' + (r.median != null ? fmt(r.median) + " d" : "—") + '</td><td class="mono-n">' + (r.p90 != null ? fmt(r.p90) + " d" : "—") + "</td></tr>";
      }).join("") + "</tbody></table>");
  }
  // bars for velocity, line for incidents, each on its own scale
  function dualChart(rows, bk, lk) {
    var bmax = Math.max.apply(null, rows.map(function (r) { return r[bk] || 0; }).concat([1]));
    var lmax = Math.max.apply(null, rows.map(function (r) { return r[lk] || 0; }).concat([1]));
    var n = rows.length;
    var bars = rows.map(function (r) {
      return '<div class="cc-month" title="' + esc(r.month) + (r.partial ? " (to 26th)" : "") + ": " + measureLabel(bk).toLowerCase() + " " + (r[bk] || 0) + ", production-signal items " + (r[lk] || 0) + '">' +
        '<div class="cc-bar b" style="width:62%;height:' + ((r[bk] || 0) / bmax * 100) + "%" + (r.partial ? ";opacity:.4" : "") + '"></div></div>';
    }).join("");
    var pts = rows.map(function (r, i) { return ((i + 0.5) / n * 100).toFixed(2) + "," + (100 - (r[lk] || 0) / lmax * 96).toFixed(2); }).join(" ");
    var line = '<svg class="dc-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points="' + pts + '" fill="none" stroke="var(--magenta)" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>';
    var dots = rows.map(function (r, i) {
      return '<span class="dc-dot" style="left:' + ((i + 0.5) / n * 100) + "%;bottom:" + ((r[lk] || 0) / lmax * 96) + '%"><span class="dc-val">' + (r[lk] || 0) + "</span></span>";
    }).join("");
    var axis = rows.map(function (r) { return '<div class="cc-lbl">' + esc(String(r.month).slice(2)) + "</div>"; }).join("");
    return '<div class="colchart dualchart"><div class="cc-plot">' + bars + line + '<div class="dc-layer">' + dots + '</div></div><div class="cc-axis">' + axis + "</div></div>";
  }
  // month x outage-type heat table
  function typeHeat(monthly, order, totals) {
    var max = 1;
    monthly.forEach(function (m) { order.forEach(function (t) { if ((m.byType[t] || 0) > max) max = m.byType[t]; }); });
    var share = {}; totals.forEach(function (t) { share[t.type] = t; });
    return tblWrap('<table class="grid heat type-heat"><thead><tr><th>Type</th>' + monthly.map(function (m) { return "<th>" + esc(m.month.slice(2).replace("-", "/")) + (m.partial ? "*" : "") + "</th>"; }).join("") +
      "<th>Total</th><th>Share</th></tr></thead><tbody>" + order.map(function (t) {
        return "<tr><td><b>" + esc(t) + "</b></td>" + monthly.map(function (m) {
          var c = m.byType[t] || 0, a = Math.min(0.85, c / max * 0.85);
          return '<td class="mono-n heat-cell" style="background:rgba(224,112,158,' + a.toFixed(2) + ")" + (a > 0.45 ? ";color:#0b1416" : "") + '">' + (c || "·") + "</td>";
        }).join("") + '<td class="mono-n"><b>' + fmt(share[t].count) + '</b></td><td class="mono-n">' + share[t].share + "%</td></tr>";
      }).join("") + "</tbody></table>") + '<p class="chart-note">*October 2026 runs to the 26th. Part of its jump reflects a change in how consistently production items were flagged.</p>';
  }
  // stacked horizontal bars: waiting to start / in development / done, waiting to ship
  function flowBars(rows) {
    var max = Math.max.apply(null, rows.map(function (r) { return r.total || 0; }).concat([1]));
    var segs = [["wait", "Waiting to start", "var(--slate)"], ["dev", "In development", "var(--kelp)"], ["ship", "Done, waiting to ship", "var(--buoy)"]];
    var h = rows.map(function (r) {
      var inner = segs.map(function (s) {
        var v = r[s[0]]; if (!v) return "";
        return '<div class="fb-seg" style="width:' + (v / max * 100) + "%;background:" + s[2] + '" title="' + esc(s[1]) + ": " + v + ' d"></div>';
      }).join("");
      return '<div class="fb-row"><div class="fb-name">' + esc(r.series) + ' <span class="fb-n">n=' + fmt(r.n) + '</span></div><div class="fb-track">' + inner + '</div><div class="fb-total">' + Math.round(r.total) + " d</div></div>";
    }).join("");
    return h + '<div class="chart-legend">' + segs.map(function (s) { return '<span><i style="background:' + s[2] + '"></i>' + s[1] + "</span>"; }).join("") + "</div>";
  }
  // cut-to-ship timeline for both trains
  function releaseTimeline(mono, svc) {
    function d(s) { return new Date(s + "T00:00:00Z").getTime(); }
    var DAY = 86400000;
    var all = mono.concat(svc).map(function (r) { var c = r.cut || null; if (!c && r.ship) c = new Date(d(r.ship) - (r.stab || 0) * DAY).toISOString().slice(0, 10); return Object.assign({}, r, { cutX: c }); });
    var t0 = d("2025-07-01"), t1 = d("2026-11-01"), span = t1 - t0;
    function x(s) { return Math.max(0, Math.min(100, (d(s) - t0) / span * 100)); }
    var months = [];
    for (var y = 2025, m = 7; y < 2026 || (y === 2026 && m <= 10); m++) { if (m > 12) { m = 1; y++; } months.push(y + "-" + (m < 10 ? "0" : "") + m + "-01"); }
    var grid = months.map(function (mm, i) { return '<div class="rt-tick" style="left:' + x(mm) + '%">' + (i % 3 === 0 ? '<span>' + mm.slice(2, 7) + "</span>" : "") + "</div>"; }).join("");
    function rows(list, cls, label) {
      return '<div class="rt-group">' + label + "</div>" + list.map(function (r) {
        var l = x(r.cutX), w = Math.max(0.7, x(r.ship) - l);
        return '<div class="rt-row"><div class="rt-name">' + esc(r.release) + '</div><div class="rt-track">' + grid +
          '<div class="rt-bar ' + cls + (r.prs > 120 ? " big" : "") + '" style="left:' + l + "%;width:" + w + '%" title="' + esc(r.release) + ": cut " + esc(r.cutX) + ", ship " + esc(r.ship) + (r.prs != null ? ", " + r.prs + " develop PRs" : "") + '"></div>' +
          (r.prs != null ? '<span class="rt-lbl" style="left:calc(' + (l + w) + '% + 5px)">' + r.prs + "</span>" : "") + "</div></div>";
      }).join("");
    }
    var sv = all.slice(mono.length);
    return '<div class="rtimeline">' + rows(all.slice(0, mono.length), "mono", "Monolith 4.x") + rows(sv, "svc", "Services 1.x (services web app)") +
      '<div class="rt-row rt-axis"><div class="rt-name"></div><div class="rt-track">' + grid + "</div></div></div>" +
      '<div class="chart-legend"><span><i style="background:var(--violet)"></i>Monolith release branch</span><span><i style="background:var(--sky)"></i>Services release branch</span><span><i style="background:var(--magenta)"></i>Batch over 120 PRs</span></div>';
  }

  /* ---------------- transition plan ---------------- */
  views.transition = function () {
    var T = D.transition;
    if (!T) return '<div class="empty">No transition plan loaded.</div>';

    var h = '<div class="page-head"><h2>Transition Plan — 8 Weeks</h2><p>' + esc(T.intro || "") + "</p></div>";
    h += asOfLine((D.backlog && D.backlog.asOf) || "13 August 2026");

    if (T.headline) {
      h += '<div class="stat-grid">' + T.headline.map(function (c) {
        return '<div class="stat"><div class="num ' + esc(c.tone || "") + '">' + esc(c.value) + '</div><div class="lbl">' + esc(c.label) + "</div></div>";
      }).join("") + "</div>";
    }

    if (T.axis) {
      h += '<div class="panel"><h3>The transition axis — and why</h3>';
      h += '<div class="callout"><h4>' + esc(T.axis.choice) + "</h4><p>" + esc(T.axis.rationale) + "</p></div>";
      if (T.axis.rejected && T.axis.rejected.length) {
        h += '<table class="grid"><thead><tr><th>Alternative considered</th><th>Why we did not take it</th></tr></thead><tbody>' +
          T.axis.rejected.map(function (r) { return "<tr><td><b>" + esc(r.option) + "</b></td><td>" + esc(r.why) + "</td></tr>"; }).join("") +
          "</tbody></table>";
      }
      h += "</div>";
    }

    // wave gantt
    if (T.waves && T.waves.length) {
      h += '<div class="panel"><h3>Wave structure</h3>';
      h += '<p class="topic-summary">Waves are sequenced by production risk &times; backlog volume &times; knowledge concentration — the domains that can hurt the business fastest transition first, while the incumbent team is still fully available.</p>';
      h += '<div class="gantt"><div class="gantt-head"><div>Wave</div>' +
        [1,2,3,4,5,6,7,8].map(function (n) { return "<div>W" + n + "</div>"; }).join("") + "</div>";
      T.waves.forEach(function (w) {
        var left = ((w.startWeek - 1) / 8) * 100;
        var width = ((w.endWeek - w.startWeek + 1) / 8) * 100;
        h += '<div class="gantt-row"><div class="g-name"><b>' + esc(w.name) + "</b><span>" + esc(w.domains.length + " domains") + "</span></div>" +
          '<div class="gantt-track"><div class="gantt-bar" style="left:' + left + "%;width:" + width + "%;background:" + esc(w.color) + '">' +
          esc(w.label || "") + "</div></div></div>";
      });
      h += "</div>";
      h += '<table class="grid" style="margin-top:18px"><thead><tr><th>Wave</th><th>Weeks</th><th>Domains in scope</th><th>ADO area paths</th><th>Why here</th></tr></thead><tbody>';
      h += T.waves.map(function (w) {
        return "<tr><td><b>" + esc(w.name) + "</b></td><td>W" + w.startWeek + "–W" + w.endWeek + "</td><td>" +
          '<div class="pill-list">' + w.domains.map(function (d) { return '<span class="pill">' + esc(d) + "</span>"; }).join("") + "</div></td><td>" +
          (w.areaPaths || []).map(function (a) { return '<div class="evidence">' + esc(a) + "</div>"; }).join("") + "</td><td>" + esc(w.rationale) + "</td></tr>";
      }).join("") + "</tbody></table></div>";
    }

    // weeks
    if (T.weeks && T.weeks.length) {
      h += '<div class="page-head" style="margin-top:26px"><h2>Week by week</h2><p>Each week has one objective, a named ask of the incumbent team, an artefact that outlives the week, and an exit criterion that is either met or not. Click to expand.</p></div>';
      h += '<div class="week-list">' + T.weeks.map(function (w, i) {
        return '<div class="wk' + (i === 0 ? " open" : "") + '" data-wk="' + i + '">' +
          '<div class="wk-head"><span class="wk-n">W' + w.n + '</span><span class="wk-obj">' + esc(w.objective) + '</span><span class="wk-wave">' + esc(w.wave || "") + '</span><span class="wk-chev">&#9656;</span></div>' +
          '<div class="wk-body">' +
            wkBlock("Velotio activities", w.velotio, "") +
            wkBlock("Ask of the incumbent team", w.incumbent, "ask") +
            wkBlock("Artefacts produced", w.artefacts, "") +
            wkBlock("Exit criteria", w.exit, "exit") +
          "</div></div>";
      }).join("") + "</div>";
      setTimeout(wireWeeks, 0);
    }

    // workstreams
    if (T.workstreams && T.workstreams.length) {
      h += '<div class="page-head" style="margin-top:26px"><h2>Parallel workstreams</h2><p>Four tracks run continuously across all eight weeks, independent of which wave is cutting over.</p></div>';
      h += '<div class="lanes">' + T.workstreams.map(function (s, i) {
        return '<div class="lane"><div class="ln-n">WS' + (i + 1) + '</div><h4>' + esc(s.name) + "</h4><p>" + esc(s.purpose) + "</p><ul>" +
          (s.beats || []).map(function (b) { return "<li>" + mdInline(b) + "</li>"; }).join("") + "</ul></div>";
      }).join("") + "</div>";
    }

    // ramp
    if (T.ramp && T.ramp.length) {
      h += '<div class="panel"><h3>Ramp model</h3><p class="topic-summary">' + esc(T.rampNote || "") + "</p>";
      h += '<table class="grid"><thead><tr><th>Role</th><th>Location</th>' + [1,2,3,4,5,6,7,8].map(function (n) { return "<th>W" + n + "</th>"; }).join("") + "<th>Focus</th></tr></thead><tbody>";
      h += T.ramp.map(function (r) {
        return "<tr><td><b>" + esc(r.role) + "</b></td><td>" + esc(r.location) + "</td>" +
          r.byWeek.map(function (n) { return '<td class="mono-n">' + (n || "—") + "</td>"; }).join("") + "<td>" + esc(r.focus) + "</td></tr>";
      }).join("") + "</tbody></table>";
      if (T.rampTotal) h += '<p class="chart-note">' + esc(T.rampTotal) + "</p>";
      h += "</div>";
    }

    // metrics
    if (T.metrics && T.metrics.length) {
      h += '<div class="panel"><h3>Success metrics</h3><p class="topic-summary">Baselines are taken from the backlog census, not from aspiration. Every target is measurable in Azure DevOps or Azure Monitor on the date given.</p>';
      h += '<table class="grid"><thead><tr><th>Metric</th><th>Baseline today</th><th>Target</th><th>Measured by</th></tr></thead><tbody>' +
        T.metrics.map(function (m) {
          return '<tr class="metric-row"><td><b>' + esc(m.metric) + '</b></td><td class="base">' + esc(m.baseline) + '</td><td class="tgt">' + esc(m.target) + "</td><td>" + esc(m.when) + "</td></tr>";
        }).join("") + "</tbody></table></div>";
    }

    // risks
    if (T.risks && T.risks.length) {
      h += '<div class="panel"><h3>Transition risks</h3>';
      h += '<table class="grid"><thead><tr><th>Risk</th><th>Likelihood</th><th>Impact</th><th>Mitigation</th></tr></thead><tbody>' +
        T.risks.map(function (r) {
          return "<tr><td><b>" + esc(r.risk) + '</b></td><td class="lik-' + esc((r.likelihood||"").toLowerCase()) + '">' + esc(r.likelihood) +
            '</td><td class="imp-' + esc((r.impact||"").toLowerCase()) + '">' + esc(r.impact) + "</td><td>" + esc(r.mitigation) + "</td></tr>";
        }).join("") + "</tbody></table></div>";
    }

    h += '<div class="two-col">';
    if (T.dod) h += '<div class="panel"><h3>Definition of done — "we own it"</h3><ul class="md">' + T.dod.map(function (x) { return "<li>" + mdInline(x) + "</li>"; }).join("") + "</ul></div>";
    if (T.outOfScope) h += '<div class="panel"><h3>Explicitly out of scope for the 8 weeks</h3><ul class="md">' + T.outOfScope.map(function (x) { return "<li>" + mdInline(x) + "</li>"; }).join("") + "</ul></div>";
    h += "</div>";

    return h;
  };

  function wkBlock(title, items, cls) {
    items = arr(items).filter(Boolean);
    if (!items.length) return "";
    return '<div class="wk-block ' + cls + '"><h6>' + esc(title) + "</h6><ul>" + items.map(function (x) { return "<li>" + mdInline(x) + "</li>"; }).join("") + "</ul></div>";
  }
  function wireWeeks() {
    Array.prototype.forEach.call(document.querySelectorAll(".wk-head"), function (head) {
      head.addEventListener("click", function () { head.parentNode.classList.toggle("open"); });
    });
  }
  function kvObj(list) { var o = {}; (list || []).forEach(function (x) { o[x.label || x.bucket || x.name] = x.count; }); return o; }
  // bars that keep the given order (age / staleness buckets are sequential, not ranked)
  function seqBars(list) {
    var max = Math.max.apply(null, list.map(function (x) { return x.count; }).concat([1]));
    return list.map(function (x) {
      return '<div class="bar-row"><div class="name">' + esc(x.label) + '</div><div class="bar-track"><div class="bar-fill" style="width:' +
        Math.round((x.count / max) * 100) + '%"></div></div><div class="val">' + fmt(x.count) + "</div></div>";
    }).join("");
  }
  function asOfLine(d) {
    return '<div class="asof"><span class="dot"></span>Backlog data as of <b>' + esc(d) + '</b> · Azure DevOps project <code>NeXT</code> · 16,129 work items</div>';
  }
  function colChart(rows, ka, kb) {
    var max = Math.max.apply(null, rows.map(function (r) { return Math.max(r[ka] || 0, r[kb] || 0); }).concat([1]));
    var plot = rows.map(function (r) {
      return '<div class="cc-month" title="' + esc(r.month) + ": " + (r[ka] || 0) + " created, " + (r[kb] || 0) + ' closed">' +
        '<div class="cc-bar a" style="height:' + ((r[ka] || 0) / max * 100) + '%"></div>' +
        '<div class="cc-bar b" style="height:' + ((r[kb] || 0) / max * 100) + '%"></div></div>';
    }).join("");
    var axis = rows.map(function (r, i) {
      var lbl = (rows.length > 14 && i % 2) ? "" : String(r.month || "").slice(2);
      return '<div class="cc-lbl">' + esc(lbl) + "</div>";
    }).join("");
    return '<div class="colchart"><div class="cc-plot">' + plot + '</div><div class="cc-axis">' + axis + "</div></div>";
  }

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
    return { monolith: "#9b86f0", service: "#5ccb8d", hybrid: "#e0709e", frontend: "#62a8e6", infra: "#82b2bd", "in-progress": "#f3a95e" }[s] || "#93a6a4";
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
  var lastTrigger = null;
  function openDrawer() {
    lastTrigger = document.activeElement;
    drawer.setAttribute("role", "dialog");
    drawer.setAttribute("aria-modal", "true");
    drawer.classList.add("open"); backdrop.classList.add("open");
    var cb = document.getElementById("drawerClose"); if (cb) cb.focus();
  }
  function closeDrawer() {
    drawer.classList.remove("open"); backdrop.classList.remove("open");
    if (lastTrigger && lastTrigger.focus) lastTrigger.focus();
    lastTrigger = null;
  }
  backdrop.addEventListener("click", closeDrawer);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeDrawer(); });
  // focus trap while the drawer is open
  drawer.addEventListener("keydown", function (e) {
    if (e.key !== "Tab" || !drawer.classList.contains("open")) return;
    var f = drawer.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"])');
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  /* ---------------- router ---------------- */
  /* Extension point: deepdive.js registers extra views + post-render hooks here.
     EXT.views[name] returns an HTML string; EXT.after[name] runs once it is in the DOM
     (needed for anything that binds events or drives an animation). */
  var EXT = (window.DISCOVERY_EXT = window.DISCOVERY_EXT || { views: {}, after: {} });
  EXT.utils = { el: el, esc: esc, arr: arr, titleCase: titleCase, renderMarkdown: renderMarkdown, go: function (v) { go(v); } };

  function go(view) {
    var activeBtn = null;
    Array.prototype.forEach.call(nav.querySelectorAll("button"), function (b) {
      var on = b.getAttribute("data-view") === view;
      b.classList.toggle("active", on);
      if (on) activeBtn = b;
    });
    var crumb = document.getElementById("crumb");
    if (crumb && activeBtn) { var lbl = activeBtn.querySelector("span"); crumb.textContent = lbl ? lbl.textContent : "Dashboard"; }
    var render = EXT.views[view] || views[view] || views.overview;
    main.innerHTML = render();
    main.scrollTop = 0; window.scrollTo(0, 0);
    if (typeof EXT.after[view] === "function") { try { EXT.after[view](main); } catch (err) { console.error("[deepdive] " + view, err); } }
    if (location.hash !== "#" + view) history.replaceState(null, "", "#" + view);
  }
  nav.addEventListener("click", function (e) { var b = e.target.closest("button[data-view]"); if (b) go(b.getAttribute("data-view")); });

  /* ---------------- boot ---------------- */
  function boot() {
    if (!D || !D.components) { main.innerHTML = '<div class="empty">data.js not loaded or empty.</div>'; return; }
    var gen = D.meta && D.meta.generated ? esc(D.meta.generated) : "—";
    var foot = document.getElementById("foot");
    foot.innerHTML = "Read-only assessment<br>" + (D.components.length) + " components surveyed<br>Generated " + gen;
    var sd = document.getElementById("surveyDate");
    if (sd) sd.textContent = gen;
    var initial = (location.hash || "#overview").slice(1);
    go((views[initial] || EXT.views[initial]) ? initial : "overview");
  }
  /* Scripts are parsed in order, so extension views registered by deepdive.js
     are not present yet. Wait for DOMContentLoaded so an initial #hash naming
     an extension view resolves instead of falling back to the dashboard. */
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
