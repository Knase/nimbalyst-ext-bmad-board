import { jsx as e, jsxs as o, Fragment as Q } from "react/jsx-runtime";
import { useState as k, useRef as K, useEffect as A, useMemo as j, useCallback as B } from "react";
const Ae = "bmad-board", O = {
  backlog: "Backlog",
  ready: "Ready",
  "in-progress": "In progress",
  review: "Review",
  built: "Built",
  done: "Done"
}, ye = ["backlog", "ready", "in-progress", "review", "done"], Ce = ["backlog", "ready", "in-progress", "review", "built", "done"], Be = {
  load: "panel_load",
  detail: "panel_detail",
  setStatus: "panel_set_status",
  run: "panel_run"
}, Le = (n) => `${Ae}.${Be[n]}`, F = {
  model: "claude-code:sonnet",
  effort: "",
  dontAsk: !1,
  writeStatusBeforeRun: !0,
  pollMs: 2500,
  sortOrder: "reverse",
  doneShown: !1,
  colWidths: {},
  overrideEnabled: !1,
  overrideModel: "claude-code:sonnet",
  overrideEffort: "",
  showDropped: !1,
  showDoneEpics: !1,
  rulesV6: {
    backlog: { status: "backlog", command: "" },
    ready: { status: "ready-for-dev", command: "/bmad-create-story {key}", statusByCommand: !0 },
    "in-progress": { status: "in-progress", command: "/bmad-dev-story {file}" },
    review: { status: "review", command: "/bmad-code-review {file}" },
    done: { status: "done", command: "" }
  },
  rulesV7: {
    backlog: { status: "draft", command: "" },
    ready: { status: "ready-for-dev", command: "" },
    "in-progress": { status: "in-progress", command: "/bmad-build {ref}" },
    review: { status: "in-review", command: "/bmad-code-review {ref}" },
    built: { status: "built", command: "" },
    done: { status: "done", command: "", forceConfirm: !0 }
  },
  actions: [
    { id: "dev", label: "Send to Dev", scope: "story", v6: "/bmad-dev-story {file}", v7: "/bmad-build {ref}" },
    { id: "build", label: "Build", scope: "story", v7: "/bmad-build {ref}" },
    { id: "create", label: "Create story", scope: "story", v6: "/bmad-create-story {key}" },
    { id: "review", label: "Code review", scope: "story", v6: "/bmad-code-review {file}", v7: "/bmad-code-review {ref}" },
    { id: "e2e", label: "E2E tests", scope: "story", v6: "/bmad-qa-generate-e2e-tests {key}", v7: "/bmad-qa-generate-e2e-tests {ref}" },
    { id: "retro", label: "Retrospective", scope: "epic", v6: "/bmad-retrospective {epic}", v7: "/bmad-retrospective {epic}" },
    { id: "sprint", label: "Sprint status", scope: "epic", v6: "/bmad-sprint-status", v7: "/bmad-help" }
  ],
  migratePrompt: "Run `bmad migrate method` to migrate this project from the BMAD v6 method module to v7, then summarise what changed and what is left to do by hand.",
  planPrompt: "/bmad-help"
};
function ke(n) {
  const l = n ?? {};
  return {
    ...F,
    ...l,
    rulesV6: { ...F.rulesV6, ...l.rulesV6 ?? {} },
    rulesV7: { ...F.rulesV7, ...l.rulesV7 ?? {} },
    colWidths: { ...l.colWidths ?? {} },
    actions: Array.isArray(l.actions) && l.actions.length > 0 ? l.actions : F.actions
  };
}
function Oe(n, l) {
  return n.overrideEnabled ? { model: n.overrideModel || n.model, effort: n.overrideEffort } : { model: l?.model || n.model, effort: l?.effort || n.effort };
}
function Se({ story: n }) {
  return /* @__PURE__ */ o("span", { className: `bb-chip bb-col-${n.column}`, title: n.status || "no status", children: [
    O[n.column],
    n.blocked ? " ⛔" : "",
    n.dropped ? " (dropped)" : ""
  ] });
}
function Me({ sessions: n }) {
  if (!n.length) return null;
  const l = n.some((g) => g.status === "waiting_for_input" || g.hasPendingPrompt), a = n.some((g) => g.status === "running"), c = l ? "bb-dot bb-dot-wait" : a ? "bb-dot bb-dot-run" : "bb-dot", s = l ? "agent waits for you" : a ? "agent running" : `${n.length} session(s)`;
  return /* @__PURE__ */ e("span", { className: c, title: s, "aria-label": s });
}
function Pe(n) {
  const l = /* @__PURE__ */ new Map();
  for (const c of n.stories) {
    const s = l.get(c.epicId) ?? [];
    s.push(c), l.set(c.epicId, s);
  }
  const a = n.epics.filter((c) => l.has(c.id) || c.total === 0 && c.status !== "done");
  return a.length ? /* @__PURE__ */ e("div", { className: "bb-backlog", children: a.map((c) => {
    const s = l.get(c.id) ?? [], g = !n.collapsed.has(c.id), h = c.total ? Math.round(c.done / c.total * 100) : 0;
    return /* @__PURE__ */ o("section", { className: "bb-epic", children: [
      /* @__PURE__ */ o(
        "header",
        {
          className: "bb-epic-head",
          onClick: () => n.onToggle(c.id),
          onContextMenu: (m) => n.onEpicMenu(m, c),
          children: [
            /* @__PURE__ */ e("span", { className: "bb-caret", children: g ? "▾" : "▸" }),
            /* @__PURE__ */ o("span", { className: "bb-epic-title", children: [
              /* @__PURE__ */ e("span", { className: "bb-epic-num", children: c.num.toUpperCase() }),
              " ",
              c.title
            ] }),
            c.refined === !1 && /* @__PURE__ */ e("span", { className: "bb-chip bb-chip-warn", title: "epic file says refined: false", children: "unrefined" }),
            c.after.length > 0 && /* @__PURE__ */ o("span", { className: "bb-muted", title: "Epic depends on", children: [
              "after ",
              c.after.join(", ")
            ] }),
            /* @__PURE__ */ e("span", { className: `bb-chip bb-epic-status${c.statusDerived ? " bb-derived" : ""}`, title: c.statusDerived ? "derived from stories" : "recorded", children: c.status || "—" }),
            /* @__PURE__ */ e("span", { className: "bb-progress", title: `${c.done}/${c.total} done`, children: /* @__PURE__ */ e("span", { className: "bb-progress-bar", style: { width: `${h}%` } }) }),
            /* @__PURE__ */ o("span", { className: "bb-count", children: [
              c.done,
              "/",
              c.total
            ] })
          ]
        }
      ),
      g && /* @__PURE__ */ e("ul", { className: "bb-stories", children: s.map((m) => /* @__PURE__ */ o(
        "li",
        {
          className: `bb-story${n.selectedId === m.id ? " bb-selected" : ""}${m.dropped ? " bb-dropped" : ""}`,
          onClick: () => n.onSelect(m.id),
          onContextMenu: (y) => n.onStoryMenu(y, m),
          children: [
            /* @__PURE__ */ e("span", { className: "bb-ref", children: m.ref }),
            m.type && m.type !== "story" && /* @__PURE__ */ e("span", { className: "bb-chip", children: m.type }),
            /* @__PURE__ */ e("span", { className: "bb-story-title", children: m.title }),
            m.after.length > 0 && /* @__PURE__ */ o("span", { className: "bb-muted", title: "Depends on", children: [
              "⤴ ",
              m.after.join(", ")
            ] }),
            !m.movable && /* @__PURE__ */ e("span", { className: "bb-muted", title: m.lockedReason, children: "🔒" }),
            /* @__PURE__ */ e(Me, { sessions: n.sessions.filter((y) => y.storyId === m.id) }),
            /* @__PURE__ */ e(Se, { story: m })
          ]
        },
        m.id
      )) })
    ] }, c.id);
  }) }) : /* @__PURE__ */ e("div", { className: "bb-empty", children: "Nothing matches the filters." });
}
function Ve(n) {
  const [l, a] = k(null), [c, s] = k(null), [g, h] = k({}), m = K(null), y = new Map(n.stories.map((d) => [d.id, d])), S = n.epics.filter((d) => n.stories.some((b) => b.epicId === d.id));
  if (!S.length) return /* @__PURE__ */ e("div", { className: "bb-empty", children: "Nothing matches the filters." });
  const D = (d) => g[d] ?? n.widths[d], p = n.columns.map((d) => D(d) ? `${D(d)}px` : "minmax(190px, 1fr)").join(" "), r = (d, b) => {
    d.preventDefault(), d.stopPropagation();
    const w = d.currentTarget.parentElement, L = d.clientX, $ = w.getBoundingClientRect().width;
    let I = $;
    const u = (V) => {
      I = Math.round(Math.min(640, Math.max(120, $ + V.clientX - L))), h((W) => ({ ...W, [b]: I }));
    }, M = () => {
      window.removeEventListener("pointermove", u), window.removeEventListener("pointerup", M), h((V) => {
        const { [b]: W, ...Z } = V;
        return Z;
      }), I !== $ && n.onResize(b, I);
    };
    window.addEventListener("pointermove", u), window.addEventListener("pointerup", M);
  }, f = (d, b) => `${d}|${b}`;
  return /* @__PURE__ */ o("div", { className: "bb-board", children: [
    /* @__PURE__ */ e("div", { className: "bb-board-head", ref: m, style: { gridTemplateColumns: p }, children: n.columns.map((d) => /* @__PURE__ */ o("div", { className: "bb-colhead", children: [
      O[d],
      " ",
      /* @__PURE__ */ e("span", { className: "bb-count", children: n.stories.filter((b) => b.column === d).length }),
      d === "done" && /* @__PURE__ */ e("button", { className: "bb-btn bb-btn-xs", onClick: n.onToggleDone, title: n.showDone ? "Hide done stories" : "Show done stories", children: n.showDone ? "Hide" : "Show" }),
      /* @__PURE__ */ e(
        "span",
        {
          className: "bb-resizer",
          role: "separator",
          "aria-label": `Resize ${O[d]} column`,
          title: "Drag to resize, double-click to reset",
          onPointerDown: (b) => r(b, d),
          onDoubleClick: () => n.onResize(d, null)
        }
      )
    ] }, d)) }),
    S.map((d) => {
      const b = !n.collapsed.has(d.id);
      return /* @__PURE__ */ o("section", { className: "bb-lane", children: [
        /* @__PURE__ */ o("header", { className: "bb-lane-head", onClick: () => n.onToggle(d.id), onContextMenu: (w) => n.onEpicMenu(w, d), children: [
          /* @__PURE__ */ e("span", { className: "bb-caret", children: b ? "▾" : "▸" }),
          /* @__PURE__ */ e("span", { className: "bb-epic-num", children: d.num.toUpperCase() }),
          " ",
          d.title,
          /* @__PURE__ */ o("span", { className: "bb-count", children: [
            d.done,
            "/",
            d.total
          ] })
        ] }),
        b && /* @__PURE__ */ e("div", { className: "bb-lane-grid", style: { gridTemplateColumns: p }, children: n.columns.map((w) => {
          const L = f(d.id, w), $ = l !== null && l.epicId === d.id && l.from !== w, I = n.stories.filter((u) => u.epicId === d.id && u.column === w);
          return /* @__PURE__ */ o(
            "div",
            {
              className: `bb-cell${$ ? " bb-droppable" : ""}${c === L && $ ? " bb-over" : ""}`,
              onDragOver: (u) => {
                $ && (u.preventDefault(), u.dataTransfer.dropEffect = "move", c !== L && s(L));
              },
              onDragLeave: () => s((u) => u === L ? null : u),
              onDrop: (u) => {
                u.preventDefault();
                const M = l ? y.get(l.id) : void 0;
                s(null), a(null), M && $ && n.onMove(M, w);
              },
              children: [
                w === "done" && !n.showDone && I.length > 0 && /* @__PURE__ */ o("button", { className: "bb-hidden-done", onClick: n.onToggleDone, title: "Show done stories", children: [
                  I.length,
                  " done · show"
                ] }),
                (w !== "done" || n.showDone) && I.map((u) => /* @__PURE__ */ o(
                  "article",
                  {
                    className: `bb-card${n.selectedId === u.id ? " bb-selected" : ""}${u.dropped ? " bb-dropped" : ""}${u.movable ? "" : " bb-locked"}`,
                    draggable: u.movable,
                    title: u.movable ? void 0 : u.lockedReason,
                    onDragStart: (M) => {
                      M.dataTransfer.setData("text/plain", u.id), M.dataTransfer.effectAllowed = "move", a({ id: u.id, epicId: u.epicId, from: u.column });
                    },
                    onDragEnd: () => {
                      a(null), s(null);
                    },
                    onClick: () => n.onSelect(u.id),
                    onContextMenu: (M) => n.onStoryMenu(M, u),
                    children: [
                      /* @__PURE__ */ o("div", { className: "bb-card-top", children: [
                        /* @__PURE__ */ e("span", { className: "bb-ref", children: u.ref }),
                        u.type && u.type !== "story" && /* @__PURE__ */ e("span", { className: "bb-chip", children: u.type }),
                        u.risk && /* @__PURE__ */ e("span", { className: "bb-chip bb-chip-warn", children: u.risk }),
                        /* @__PURE__ */ e("span", { className: "bb-spacer" }),
                        /* @__PURE__ */ e(Me, { sessions: n.sessions.filter((M) => M.storyId === u.id) })
                      ] }),
                      /* @__PURE__ */ e("div", { className: "bb-card-title", children: u.title }),
                      (u.blocked || u.after.length > 0 || u.dropped) && /* @__PURE__ */ o("div", { className: "bb-card-foot", children: [
                        u.blocked && /* @__PURE__ */ e("span", { className: "bb-chip bb-chip-err", title: u.blockedReason, children: "blocked" }),
                        u.dropped && /* @__PURE__ */ e("span", { className: "bb-chip", children: "dropped" }),
                        u.after.length > 0 && /* @__PURE__ */ o("span", { className: "bb-muted", title: "Depends on", children: [
                          "⤴ ",
                          u.after.join(", ")
                        ] })
                      ] })
                    ]
                  },
                  u.id
                ))
              ]
            },
            w
          );
        }) })
      ] }, d.id);
    })
  ] });
}
function _e({ x: n, y: l, title: a, items: c, onClose: s }) {
  const g = K(null), [h, m] = k(null), [y, S] = k({ x: n, y: l });
  A(() => {
    const p = (f) => {
      g.current?.contains(f.target) || s();
    }, r = (f) => f.key === "Escape" && s();
    return document.addEventListener("mousedown", p, !0), document.addEventListener("keydown", r), () => {
      document.removeEventListener("mousedown", p, !0), document.removeEventListener("keydown", r);
    };
  }, [s]), A(() => {
    const p = g.current?.getBoundingClientRect();
    p && S({
      x: Math.max(4, Math.min(n, window.innerWidth - p.width - 4)),
      y: Math.max(4, Math.min(l, window.innerHeight - p.height - 4))
    });
  }, [n, l, h]);
  const D = (p) => {
    p.disabled || (s(), p.onSelect?.());
  };
  return /* @__PURE__ */ o("div", { ref: g, className: "bb-menu", style: { left: y.x, top: y.y }, role: "menu", children: [
    a && /* @__PURE__ */ e("div", { className: "bb-menu-title", children: a }),
    c.map(
      (p, r) => p.separator ? /* @__PURE__ */ e("div", { className: "bb-menu-sep" }, r) : /* @__PURE__ */ o("div", { children: [
        /* @__PURE__ */ o(
          "button",
          {
            role: "menuitem",
            className: "bb-menu-item",
            disabled: p.disabled,
            onClick: () => p.children ? m(h === r ? null : r) : D(p),
            children: [
              p.label,
              p.children && /* @__PURE__ */ e("span", { className: "bb-spacer", children: h === r ? "▾" : "▸" })
            ]
          }
        ),
        p.children && h === r && /* @__PURE__ */ e("div", { className: "bb-menu-sub", children: p.children.map((f, d) => /* @__PURE__ */ e("button", { role: "menuitem", className: "bb-menu-item", disabled: f.disabled, onClick: () => D(f), children: f.label }, d)) })
      ] }, r)
    )
  ] });
}
function je({ spec: n, onClose: l }) {
  const [a, c] = k(!1), [s, g] = k(n.model ?? ""), [h, m] = k(n.effort ?? "");
  return A(() => {
    const y = (S) => {
      S.key === "Escape" && l(), S.key === "Enter" && !(S.target instanceof HTMLTextAreaElement) && !(S.target instanceof HTMLSelectElement) && (l(), n.run(a, s, h));
    };
    return document.addEventListener("keydown", y), () => document.removeEventListener("keydown", y);
  }, [n, a, s, h, l]), /* @__PURE__ */ e("div", { className: "bb-modal-backdrop", onMouseDown: l, children: /* @__PURE__ */ o("div", { className: "bb-modal", role: "dialog", "aria-label": n.title, onMouseDown: (y) => y.stopPropagation(), children: [
    /* @__PURE__ */ e("h2", { children: n.title }),
    n.status && /* @__PURE__ */ o("p", { children: [
      "Status → ",
      /* @__PURE__ */ e("code", { children: n.status })
    ] }),
    n.command && /* @__PURE__ */ o(Q, { children: [
      /* @__PURE__ */ e("p", { children: "Starts a new agent session with:" }),
      /* @__PURE__ */ e("pre", { className: "bb-cmd", children: n.command }),
      /* @__PURE__ */ o("div", { className: "bb-row", children: [
        /* @__PURE__ */ o("label", { children: [
          "Model ",
          /* @__PURE__ */ e(X, { value: s, onChange: g })
        ] }),
        /* @__PURE__ */ o("label", { children: [
          "Effort ",
          /* @__PURE__ */ e(G, { value: h, onChange: m })
        ] })
      ] })
    ] }),
    n.allowDontAsk && n.command && /* @__PURE__ */ o("label", { className: "bb-check", children: [
      /* @__PURE__ */ e("input", { type: "checkbox", checked: a, onChange: (y) => c(y.target.checked) }),
      " Don't ask again (can be undone in settings)"
    ] }),
    /* @__PURE__ */ o("div", { className: "bb-modal-actions", children: [
      /* @__PURE__ */ e("button", { className: "bb-btn", onClick: l, children: "Cancel" }),
      n.statusOnly && /* @__PURE__ */ e("button", { className: "bb-btn", onClick: () => {
        l(), n.statusOnly?.();
      }, children: "Only change status" }),
      /* @__PURE__ */ e("button", { className: "bb-btn bb-btn-primary", onClick: () => {
        l(), n.run(a, s, h);
      }, children: n.confirmLabel })
    ] })
  ] }) });
}
const oe = ["claude-code:sonnet", "claude-code:opus", "claude-code:haiku"], Fe = ["", "low", "medium", "high", "xhigh", "max"];
function X({ value: n, onChange: l, className: a, allowDefault: c, title: s }) {
  const g = !n || oe.includes(n) ? oe : [n, ...oe];
  return /* @__PURE__ */ o("select", { className: a ?? "bb-select", value: n, onChange: (h) => l(h.target.value), title: s ?? "Model for sessions started from the board", children: [
    c && /* @__PURE__ */ e("option", { value: "", children: "default" }),
    g.map((h) => /* @__PURE__ */ e("option", { value: h, children: h }, h))
  ] });
}
function G({ value: n, onChange: l, className: a, title: c }) {
  return /* @__PURE__ */ e("select", { className: a ?? "bb-select", value: n, onChange: (s) => l(s.target.value), title: c ?? "Effort for sessions started from the board", children: Fe.map((s) => /* @__PURE__ */ e("option", { value: s, children: s || "default" }, s)) });
}
function We({ col: n, rule: l, onChange: a }) {
  return /* @__PURE__ */ o("div", { className: "bb-rule", children: [
    /* @__PURE__ */ e("span", { className: "bb-rule-col", children: O[n] }),
    /* @__PURE__ */ e("input", { className: "bb-input bb-input-sm", value: l.status, placeholder: "status to write", onChange: (c) => a({ ...l, status: c.target.value }) }),
    /* @__PURE__ */ e("input", { className: "bb-input", value: l.command, placeholder: "command (empty = status only)", onChange: (c) => a({ ...l, command: c.target.value }) }),
    /* @__PURE__ */ e(X, { allowDefault: !0, value: l.model ?? "", onChange: (c) => a({ ...l, model: c }), title: "Model for this step (default = settings)" }),
    /* @__PURE__ */ e(G, { value: l.effort ?? "", onChange: (c) => a({ ...l, effort: c }), title: "Effort for this step" }),
    /* @__PURE__ */ o("label", { className: "bb-check", title: "Always ask, even with 'don't ask'", children: [
      /* @__PURE__ */ e("input", { type: "checkbox", checked: !!l.forceConfirm, onChange: (c) => a({ ...l, forceConfirm: c.target.checked }) }),
      " ask"
    ] })
  ] });
}
function Ue({ settings: n, version: l, onSave: a, onClose: c }) {
  const [s, g] = k(n), h = (r) => g((f) => ({ ...f, ...r })), m = l === "v7", y = m ? Ce : ye, S = m ? s.rulesV7 : s.rulesV6, D = (r, f) => h(m ? { rulesV7: { ...s.rulesV7, [r]: f } } : { rulesV6: { ...s.rulesV6, [r]: f } }), p = (r, f) => h({ actions: s.actions.map((d, b) => b === r ? f : d) });
  return /* @__PURE__ */ e("div", { className: "bb-modal-backdrop", onMouseDown: c, children: /* @__PURE__ */ o("div", { className: "bb-modal bb-modal-wide", role: "dialog", "aria-label": "BMAD Board settings", onMouseDown: (r) => r.stopPropagation(), children: [
    /* @__PURE__ */ e("h2", { children: "Settings" }),
    /* @__PURE__ */ o("div", { className: "bb-settings-scroll", children: [
      /* @__PURE__ */ e("h3", { children: "Sessions" }),
      /* @__PURE__ */ o("div", { className: "bb-form", children: [
        /* @__PURE__ */ o("label", { children: [
          "Default model ",
          /* @__PURE__ */ e(X, { value: s.model, onChange: (r) => h({ model: r }), title: "Used by steps that have no model of their own" })
        ] }),
        /* @__PURE__ */ o("label", { children: [
          "Default effort ",
          /* @__PURE__ */ e(G, { value: s.effort, onChange: (r) => h({ effort: r }) })
        ] }),
        /* @__PURE__ */ o("label", { children: [
          "Order",
          /* @__PURE__ */ o("select", { className: "bb-select", value: s.sortOrder, onChange: (r) => h({ sortOrder: r.target.value }), children: [
            /* @__PURE__ */ e("option", { value: "reverse", children: "newest first (reverse file order)" }),
            /* @__PURE__ */ e("option", { value: "file", children: "file order" })
          ] })
        ] }),
        /* @__PURE__ */ o("label", { className: "bb-check", children: [
          /* @__PURE__ */ e("input", { type: "checkbox", checked: s.dontAsk, onChange: (r) => h({ dontAsk: r.target.checked }) }),
          " Don't ask before starting a command"
        ] }),
        /* @__PURE__ */ o("label", { className: "bb-check", children: [
          /* @__PURE__ */ e("input", { type: "checkbox", checked: s.writeStatusBeforeRun, onChange: (r) => h({ writeStatusBeforeRun: r.target.checked }) }),
          " Write the status before launching the command"
        ] }),
        /* @__PURE__ */ o("label", { className: "bb-check", children: [
          /* @__PURE__ */ e("input", { type: "checkbox", checked: s.showDropped, onChange: (r) => h({ showDropped: r.target.checked }) }),
          " Show dropped stories (v7)"
        ] }),
        /* @__PURE__ */ o("label", { children: [
          "Poll every (ms)",
          /* @__PURE__ */ e("input", { className: "bb-input bb-input-sm", type: "number", min: 1e3, step: 500, value: s.pollMs, onChange: (r) => h({ pollMs: Math.max(1e3, Number(r.target.value) || F.pollMs) }) })
        ] })
      ] }),
      /* @__PURE__ */ o("h3", { children: [
        "Drop on a column (",
        l === "none" ? "v6" : l,
        ")"
      ] }),
      /* @__PURE__ */ o("p", { className: "bb-muted", children: [
        "Placeholders: ",
        "{key} {ref} {epic} {file} {title}",
        ". Model / effort per step; “default” falls back to the defaults above (or to the header, when its override box is ticked)."
      ] }),
      y.map((r) => /* @__PURE__ */ e(We, { col: r, rule: S[r] ?? { status: "", command: "" }, onChange: (f) => D(r, f) }, r)),
      /* @__PURE__ */ e("h3", { children: "Right-click menu" }),
      s.actions.map((r, f) => /* @__PURE__ */ o("div", { className: "bb-rule", children: [
        /* @__PURE__ */ e("input", { className: "bb-input bb-input-sm", value: r.label, onChange: (d) => p(f, { ...r, label: d.target.value }) }),
        /* @__PURE__ */ o("select", { className: "bb-select", value: r.scope, onChange: (d) => p(f, { ...r, scope: d.target.value }), children: [
          /* @__PURE__ */ e("option", { value: "story", children: "story" }),
          /* @__PURE__ */ e("option", { value: "epic", children: "epic" })
        ] }),
        /* @__PURE__ */ e("input", { className: "bb-input", value: r.v6 ?? "", placeholder: "v6 command", onChange: (d) => p(f, { ...r, v6: d.target.value || void 0 }) }),
        /* @__PURE__ */ e("input", { className: "bb-input", value: r.v7 ?? "", placeholder: "v7 command", onChange: (d) => p(f, { ...r, v7: d.target.value || void 0 }) }),
        /* @__PURE__ */ e(X, { allowDefault: !0, value: r.model ?? "", onChange: (d) => p(f, { ...r, model: d }), title: "Model for this action (default = settings)" }),
        /* @__PURE__ */ e(G, { value: r.effort ?? "", onChange: (d) => p(f, { ...r, effort: d }), title: "Effort for this action" }),
        /* @__PURE__ */ e("button", { className: "bb-btn", onClick: () => h({ actions: s.actions.filter((d, b) => b !== f) }), "aria-label": "Remove", children: "✕" })
      ] }, r.id + f)),
      /* @__PURE__ */ e("button", { className: "bb-btn", onClick: () => h({ actions: [...s.actions, { id: `custom-${Date.now()}`, label: "New action", scope: "story", v6: "", v7: "" }] }), children: "+ Add action" }),
      /* @__PURE__ */ e("h3", { children: "Banner prompts" }),
      /* @__PURE__ */ o("div", { className: "bb-form", children: [
        /* @__PURE__ */ o("label", { children: [
          "Migrate (v6 → v7) ",
          /* @__PURE__ */ e("textarea", { className: "bb-input", rows: 2, value: s.migratePrompt, onChange: (r) => h({ migratePrompt: r.target.value }) })
        ] }),
        /* @__PURE__ */ o("label", { children: [
          "Start planning ",
          /* @__PURE__ */ e("input", { className: "bb-input", value: s.planPrompt, onChange: (r) => h({ planPrompt: r.target.value }) })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ o("div", { className: "bb-modal-actions", children: [
      /* @__PURE__ */ e("button", { className: "bb-btn", onClick: () => g({ ...F }), children: "Reset to defaults" }),
      /* @__PURE__ */ e("span", { className: "bb-spacer" }),
      /* @__PURE__ */ e("button", { className: "bb-btn", onClick: c, children: "Cancel" }),
      /* @__PURE__ */ e("button", { className: "bb-btn bb-btn-primary", onClick: () => {
        a(s), c();
      }, children: "Save" })
    ] })
  ] }) });
}
function ze(n) {
  const l = (a, c) => n.callBackendTool(Le(a), c);
  return {
    load: (a) => l("load", a),
    detail: (a) => l("detail", a),
    setStatus: (a) => l("setStatus", a),
    run: (a) => l("run", a)
  };
}
const H = (n) => n instanceof Error ? n.message : String(n);
function He({ host: n, client: l, story: a, epic: c, sessions: s, initiative: g, rev: h }) {
  const [m, y] = k(null), [S, D] = k(null), [p, r] = k(null), f = a?.id ?? null;
  if (A(() => {
    if (!f) {
      y(null);
      return;
    }
    let b = !0;
    return l.detail({ storyId: f, initiative: g }).then((w) => {
      b && (y(w), D(null));
    }).catch((w) => b && D(H(w))), () => {
      b = !1;
    };
  }, [l, f, g, h]), A(() => r(null), [f]), !a) return /* @__PURE__ */ e("div", { className: "bb-details bb-empty", children: "Select a story." });
  const d = n.components?.SessionTranscript;
  return /* @__PURE__ */ o("div", { className: "bb-details", children: [
    /* @__PURE__ */ o("h2", { className: "bb-d-title", children: [
      /* @__PURE__ */ e("span", { className: "bb-ref", children: a.ref }),
      " ",
      a.title
    ] }),
    /* @__PURE__ */ o("div", { className: "bb-d-meta", children: [
      /* @__PURE__ */ e(Se, { story: a }),
      c && /* @__PURE__ */ o("span", { className: "bb-muted", children: [
        c.num,
        " · ",
        c.title
      ] }),
      a.after.length > 0 && /* @__PURE__ */ o("span", { className: "bb-muted", children: [
        "after ",
        a.after.join(", ")
      ] })
    ] }),
    a.blocked && a.blockedReason && /* @__PURE__ */ o("div", { className: "bb-note bb-note-err", children: [
      "Blocked: ",
      a.blockedReason
    ] }),
    !a.movable && a.lockedReason && /* @__PURE__ */ e("div", { className: "bb-note", children: a.lockedReason }),
    S && /* @__PURE__ */ e("div", { className: "bb-note bb-note-err", children: S }),
    m && /* @__PURE__ */ o(Q, { children: [
      /* @__PURE__ */ e("div", { className: "bb-d-files", children: m.files.map((b) => /* @__PURE__ */ o("button", { className: "bb-link", onClick: () => n.openFile(b.path), children: [
        "Open ",
        b.label.toLowerCase()
      ] }, b.path)) }),
      m.summary && /* @__PURE__ */ e("p", { className: "bb-d-summary", children: m.summary }),
      m.acceptance.length > 0 && /* @__PURE__ */ o(Q, { children: [
        /* @__PURE__ */ e("h3", { children: "Acceptance criteria" }),
        /* @__PURE__ */ e("ol", { className: "bb-d-list", children: m.acceptance.map((b, w) => /* @__PURE__ */ e("li", { children: b }, w)) })
      ] }),
      m.tasks.length > 0 && /* @__PURE__ */ o(Q, { children: [
        /* @__PURE__ */ o("h3", { children: [
          "Tasks ",
          /* @__PURE__ */ o("span", { className: "bb-count", children: [
            m.tasks.filter((b) => b.checked).length,
            "/",
            m.tasks.length
          ] })
        ] }),
        /* @__PURE__ */ e("ul", { className: "bb-d-tasks", children: m.tasks.map((b, w) => /* @__PURE__ */ o("li", { style: { paddingLeft: b.depth * 16 }, className: b.checked ? "bb-done" : "", children: [
          /* @__PURE__ */ e("span", { "aria-hidden": !0, children: b.checked ? "☑" : "☐" }),
          " ",
          b.text
        ] }, w)) })
      ] }),
      m.sections.map((b, w) => /* @__PURE__ */ o("details", { className: "bb-d-section", children: [
        /* @__PURE__ */ e("summary", { children: b.title }),
        /* @__PURE__ */ e("pre", { children: b.body })
      ] }, w))
    ] }),
    /* @__PURE__ */ o("h3", { children: [
      "Sessions ",
      s.length > 0 && /* @__PURE__ */ e("span", { className: "bb-count", children: s.length })
    ] }),
    s.length === 0 ? /* @__PURE__ */ e("div", { className: "bb-muted", children: "None launched from the board for this story." }) : /* @__PURE__ */ e("ul", { className: "bb-d-sessions", children: s.map((b) => /* @__PURE__ */ o("li", { className: p === b.sessionId ? "bb-selected" : "", onClick: () => r(p === b.sessionId ? null : b.sessionId), children: [
      /* @__PURE__ */ e("span", { className: `bb-dot bb-dot-${b.status === "running" ? "run" : b.status === "waiting_for_input" || b.hasPendingPrompt ? "wait" : "idle"}` }),
      /* @__PURE__ */ e("span", { className: "bb-session-title", children: b.title || b.sessionId.slice(0, 8) }),
      /* @__PURE__ */ e("span", { className: "bb-muted", children: b.hasPendingPrompt ? "needs answer" : b.status })
    ] }, b.sessionId)) }),
    p && d && /* @__PURE__ */ e("div", { className: "bb-transcript", children: /* @__PURE__ */ e(d, { sessionId: p }) })
  ] });
}
const De = "settings.v1";
function Ke(n) {
  try {
    return ke(n.storage.getGlobal(De));
  } catch {
    return ke(void 0);
  }
}
async function Xe(n, l) {
  await n.storage.setGlobal(De, l);
}
function Ge(n, l) {
  const a = (g) => g.replace(/\\/g, "/"), c = a(n).replace(/\/+$/, ""), s = a(l);
  return s.startsWith(c + "/") ? s.slice(c.length + 1) : s;
}
function Ye(n, l) {
  const { story: a, epic: c } = l, s = a ? l.version === "v6" ? a.id : a.ref : "", g = {
    key: s,
    ref: a?.ref ?? "",
    epic: c?.num ?? "",
    file: a ? a.file ? Ge(l.projectRoot, a.file) : s : "",
    title: a?.title ?? ""
  };
  return n.replace(/\{(key|ref|epic|file|title)\}/g, (h, m) => g[m] ?? "");
}
const qe = (n) => {
  try {
    return n.storage.get("view") === "board" ? "board" : "backlog";
  } catch {
    return "backlog";
  }
};
function Je({ host: n }) {
  const l = j(() => ze(n), [n]), [a, c] = k(() => Ke(n)), [s, g] = k(null), [h, m] = k(null), [y, S] = k(() => qe(n)), [D, p] = k(null), [r, f] = k(""), [d, b] = k(""), [w, L] = k(void 0), [$, I] = k(/* @__PURE__ */ new Set()), [u, M] = k(null), [V, W] = k(null), [Z, ie] = k(!1), [re, ce] = k(null), [ee, Ee] = k(!1), te = K(""), P = K(a);
  P.current = a;
  const ne = K(w);
  ne.current = w;
  const R = B((t) => {
    ce(t), window.setTimeout(() => ce((i) => i === t ? null : i), 4e3);
  }, []), T = B(async (t = !1) => {
    try {
      const i = await l.load({ initiative: ne.current, since: t ? void 0 : te.current || void 0 });
      if (m(null), i.unchanged) return;
      te.current = i.model.rev, g(i.model);
    } catch (i) {
      m(H(i));
    }
  }, [l]);
  A(() => {
    T(!0);
  }, [T, w]), A(() => {
    const t = window.setInterval(() => {
      document.hidden || T();
    }, a.pollMs), i = () => !document.hidden && void T();
    return document.addEventListener("visibilitychange", i), () => {
      window.clearInterval(t), document.removeEventListener("visibilitychange", i);
    };
  }, [T, a.pollMs]), A(() => {
    n.setPanes?.({ right: { label: "Details", collapsed: ee } });
  }, [n, ee]), A(() => n.onPaneToggle?.((t) => t === "right" && Ee((i) => !i)), [n]), A(() => () => n.setPanes?.(null), [n]);
  const $e = (t) => {
    S(t), n.storage.set("view", t).catch(() => {
    });
  }, E = s?.version ?? "none", ae = E === "v7" ? Ce : ye, Y = a.sortOrder === "reverse", de = j(() => Y ? [...s?.epics ?? []].reverse() : s?.epics ?? [], [s, Y]), be = j(() => Y ? [...s?.stories ?? []].reverse() : s?.stories ?? [], [s, Y]), _ = j(() => new Map((s?.epics ?? []).map((t) => [t.id, t])), [s]), q = j(
    () => de.filter((t) => a.showDoneEpics || r === t.id || t.status !== "done"),
    [de, a.showDoneEpics, r]
  ), ue = j(() => {
    const t = new Set(q.map((i) => i.id));
    return be.filter(
      (i) => t.has(i.epicId) && (a.showDropped || !i.dropped) && (!r || i.epicId === r) && (!d || i.column === d)
    );
  }, [be, q, a.showDropped, r, d]), U = s?.stories.find((t) => t.id === D) ?? null, me = B(
    async (t, i, v, C) => {
      try {
        await l.run({ ownerKey: t, name: i, prompt: v, model: C.model, ...C.effort ? { effortLevel: C.effort } : {} }), R("Session started"), T(!0);
      } catch (N) {
        R(H(N));
      }
    },
    [l, R, T]
  ), se = B(
    async (t, i) => {
      try {
        const v = await l.setStatus({ storyId: t.id, status: i, initiative: ne.current });
        return v.epicBumped && R(`Epic moved to ${v.epicBumped}`), await T(!0), !0;
      } catch (v) {
        return R(H(v)), !1;
      }
    },
    [l, R, T]
  ), x = B(
    (t) => {
      c(t), Xe(n, t).catch((i) => R(`Could not save settings: ${H(i)}`));
    },
    [n, R]
  ), he = B(
    (t, i) => ({ version: E, projectRoot: s?.projectRoot ?? n.workspacePath, story: t, epic: i }),
    [E, s?.projectRoot, n.workspacePath]
  ), z = B(
    (t) => {
      const i = P.current, v = t.template ? Ye(t.template, he(t.story, t.epic)) : "", C = t.status && (!v || i.writeStatusBeforeRun && !t.rule?.statusByCommand), N = Oe(i, t.step), we = async (le) => {
        t.status && t.story && C && !await se(t.story, t.status) || v && await me(t.ownerKey, t.sessionName, v, le);
      };
      if (!(!!t.rule?.forceConfirm || !i.dontAsk && !!v)) {
        we(N);
        return;
      }
      W({
        title: t.title,
        status: t.status && C ? t.status : void 0,
        command: v || void 0,
        allowDontAsk: !t.rule?.forceConfirm,
        confirmLabel: v ? "Run" : "Move",
        statusOnly: v && t.status && t.story && C ? () => {
          se(t.story, t.status);
        } : void 0,
        model: N.model,
        effort: N.effort,
        run: (le, Te, xe) => {
          le && !P.current.dontAsk && x({ ...P.current, dontAsk: !0 }), we({ model: Te, effort: xe });
        }
      });
    },
    [he, se, me, x]
  ), pe = B(
    (t, i) => {
      if (t.column === i) return;
      if (!t.movable) return R(t.lockedReason ?? "This story cannot be moved.");
      const v = P.current, N = (E === "v7" ? v.rulesV7 : v.rulesV6)[i];
      if (!N || !N.status && !N.command) return R(`No rule for ${O[i]}. Set one in settings.`);
      z({
        title: `${t.ref} → ${O[i]}`,
        story: t,
        epic: _.get(t.epicId),
        ownerKey: t.id,
        sessionName: `${t.ref} ${t.title}`.slice(0, 80),
        template: N.command,
        status: N.status,
        rule: N,
        step: N
      });
    },
    [E, z, R, _]
  ), fe = B(
    (t, i, v) => {
      const C = E === "v7" ? t.v7 : t.v6;
      if (!C) return;
      const N = i ? `${i.ref} ${i.title}` : `${v?.num ?? ""} ${v?.title ?? ""}`;
      z({
        title: `${t.label}: ${N}`.slice(0, 100),
        story: i,
        epic: v ?? (i ? _.get(i.epicId) : void 0),
        ownerKey: i ? i.id : `epic:${v?.id ?? "board"}`,
        sessionName: `${t.label}: ${N}`.slice(0, 80),
        template: C,
        step: t
      });
    },
    [E, z, _]
  ), Re = (t, i) => {
    const v = t === "migrate" ? a.migratePrompt : a.planPrompt;
    z({ title: i, ownerKey: "board", sessionName: i, template: v });
  }, ve = (t, i) => {
    t.preventDefault(), p(i.id);
    const v = _.get(i.epicId), C = a.actions.filter((N) => N.scope === "story" && (E === "v7" ? N.v7 : N.v6)).map((N) => ({ label: N.label, onSelect: () => fe(N, i, v) }));
    C.push({ separator: !0, label: "" }), C.push({
      label: "Move to",
      disabled: !i.movable,
      children: ae.filter((N) => N !== i.column).map((N) => ({ label: O[N], onSelect: () => pe(i, N) }))
    }), i.file && C.push({ label: "Open file", onSelect: () => n.openFile(i.file) }), M({ x: t.clientX, y: t.clientY, title: `${i.ref} ${i.title}`, items: C });
  }, ge = (t, i) => {
    t.preventDefault();
    const v = a.actions.filter((C) => C.scope === "epic" && (E === "v7" ? C.v7 : C.v6)).map((C) => ({ label: C.label, onSelect: () => fe(C, void 0, i) }));
    i.file && v.push({ label: "Open epic file", onSelect: () => n.openFile(i.file) }), v.length && M({ x: t.clientX, y: t.clientY, title: `${i.num} ${i.title}`, items: v });
  }, Ne = (t) => I((i) => {
    const v = new Set(i);
    return v.delete(t) || v.add(t), v;
  }), Ie = U && s ? s.sessions.filter((t) => t.storyId === U.id) : [], J = s !== null && s.version === "none";
  return /* @__PURE__ */ o("div", { className: "bb-root", children: [
    /* @__PURE__ */ o("header", { className: "bb-header", children: [
      /* @__PURE__ */ e("div", { className: "bb-tabs", role: "tablist", children: ["backlog", "board"].map((t) => /* @__PURE__ */ e("button", { role: "tab", "aria-selected": y === t, className: `bb-tab${y === t ? " bb-tab-on" : ""}`, onClick: () => $e(t), children: t === "backlog" ? "Backlog" : "Board" }, t)) }),
      /* @__PURE__ */ o("select", { className: "bb-select", value: r, onChange: (t) => f(t.target.value), "aria-label": "Epic filter", children: [
        /* @__PURE__ */ e("option", { value: "", children: "All epics" }),
        s?.epics.filter((t) => t.total > 0).map((t) => /* @__PURE__ */ o("option", { value: t.id, children: [
          t.num.toUpperCase(),
          " · ",
          t.title
        ] }, t.id))
      ] }),
      /* @__PURE__ */ o("select", { className: "bb-select", value: d, onChange: (t) => b(t.target.value), "aria-label": "Status filter", children: [
        /* @__PURE__ */ e("option", { value: "", children: "All statuses" }),
        ae.map((t) => /* @__PURE__ */ e("option", { value: t, children: O[t] }, t))
      ] }),
      E === "v7" && s && s.initiatives.length > 0 && /* @__PURE__ */ e(
        "select",
        {
          className: "bb-select",
          value: w ?? s.activeInitiative ?? "",
          onChange: (t) => {
            te.current = "", L(t.target.value || void 0), p(null);
          },
          "aria-label": "Initiative",
          children: s.initiatives.map((t) => /* @__PURE__ */ e("option", { value: t, children: t }, t))
        }
      ),
      /* @__PURE__ */ o("label", { className: "bb-check", title: "Show epics whose status is done", children: [
        /* @__PURE__ */ e("input", { type: "checkbox", checked: a.showDoneEpics, onChange: (t) => x({ ...a, showDoneEpics: t.target.checked }) }),
        " done epics"
      ] }),
      /* @__PURE__ */ e("span", { className: "bb-spacer" }),
      /* @__PURE__ */ o("select", { className: "bb-select", value: a.sortOrder, onChange: (t) => x({ ...a, sortOrder: t.target.value }), "aria-label": "Order", title: "Order of epics and stories", children: [
        /* @__PURE__ */ e("option", { value: "reverse", children: "↓ newest first" }),
        /* @__PURE__ */ e("option", { value: "file", children: "↑ file order" })
      ] }),
      /* @__PURE__ */ o("label", { className: "bb-check", title: "Use the model and effort from this header for every session, instead of the per-step ones from settings", children: [
        /* @__PURE__ */ e("input", { type: "checkbox", checked: a.overrideEnabled, onChange: (t) => x({ ...a, overrideEnabled: t.target.checked }) }),
        " override"
      ] }),
      /* @__PURE__ */ e(X, { value: a.overrideModel, onChange: (t) => x({ ...a, overrideModel: t }), title: "Header model (used when “override” is ticked)" }),
      /* @__PURE__ */ e(G, { value: a.overrideEffort, onChange: (t) => x({ ...a, overrideEffort: t }), title: "Header effort (used when “override” is ticked)" }),
      /* @__PURE__ */ e("span", { className: "bb-chip", title: "Detected BMAD version", children: E === "none" ? "no BMAD" : E }),
      /* @__PURE__ */ e("button", { className: "bb-btn", onClick: () => {
        T(!0);
      }, title: "Reload from files", children: "↻" }),
      /* @__PURE__ */ e("button", { className: "bb-btn", onClick: () => ie(!0), title: "Settings", children: "⚙" })
    ] }),
    s?.banners.map((t) => /* @__PURE__ */ o("div", { className: `bb-banner bb-banner-${t.kind}`, children: [
      /* @__PURE__ */ e("span", { children: t.message }),
      t.action && /* @__PURE__ */ e("button", { className: "bb-btn", onClick: () => Re(t.action.promptSetting, t.action.label), children: t.action.label })
    ] }, t.id)),
    h && /* @__PURE__ */ e("div", { className: "bb-banner bb-banner-error", children: h }),
    /* @__PURE__ */ o("div", { className: "bb-body", children: [
      /* @__PURE__ */ o("main", { className: "bb-main", children: [
        !s && !h && /* @__PURE__ */ e("div", { className: "bb-empty", children: "Loading…" }),
        s && !J && y === "backlog" && /* @__PURE__ */ e(
          Pe,
          {
            epics: q.filter((t) => !r || t.id === r),
            stories: ue,
            sessions: s.sessions,
            selectedId: D,
            collapsed: $,
            onToggle: Ne,
            onSelect: p,
            onStoryMenu: ve,
            onEpicMenu: ge
          }
        ),
        s && !J && y === "board" && /* @__PURE__ */ e(
          Ve,
          {
            columns: ae,
            epics: q,
            stories: ue,
            sessions: s.sessions,
            selectedId: D,
            collapsed: $,
            onToggle: Ne,
            onSelect: p,
            showDone: a.doneShown,
            onToggleDone: () => x({ ...a, doneShown: !a.doneShown }),
            widths: a.colWidths,
            onResize: (t, i) => x({ ...P.current, colWidths: { ...P.current.colWidths, ...i === null ? { [t]: void 0 } : { [t]: i } } }),
            onMove: pe,
            onStoryMenu: ve,
            onEpicMenu: ge
          }
        ),
        J && /* @__PURE__ */ e("div", { className: "bb-empty", children: "Nothing to show yet. Use the banner above to start planning." })
      ] }),
      !ee && !J && /* @__PURE__ */ e("aside", { className: "bb-aside", children: /* @__PURE__ */ e(
        He,
        {
          host: n,
          client: l,
          story: U,
          epic: U ? _.get(U.epicId) ?? null : null,
          sessions: Ie,
          initiative: w,
          rev: s?.rev ?? ""
        }
      ) })
    ] }),
    re && /* @__PURE__ */ e("div", { className: "bb-toast", role: "status", children: re }),
    u && /* @__PURE__ */ e(_e, { x: u.x, y: u.y, title: u.title, items: u.items, onClose: () => M(null) }),
    V && /* @__PURE__ */ e(je, { spec: V, onClose: () => W(null) }),
    Z && /* @__PURE__ */ e(Ue, { settings: a, version: E, onSave: x, onClose: () => ie(!1) })
  ] });
}
const tt = {
  board: { component: Je }
};
async function nt() {
}
async function at() {
}
export {
  Je as BoardPanel,
  nt as activate,
  at as deactivate,
  tt as panels
};
//# sourceMappingURL=index.js.map
