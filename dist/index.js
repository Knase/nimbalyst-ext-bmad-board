import { jsx as e, jsxs as c, Fragment as U } from "react/jsx-runtime";
import { useState as w, useRef as K, useEffect as $, useMemo as j, useCallback as I } from "react";
const De = "bmad-board", R = {
  backlog: "Backlog",
  ready: "Ready",
  "in-progress": "In progress",
  review: "Review",
  built: "Built",
  done: "Done"
}, ue = ["backlog", "ready", "in-progress", "review", "done"], me = ["backlog", "ready", "in-progress", "review", "built", "done"], Ee = {
  load: "panel_load",
  detail: "panel_detail",
  setStatus: "panel_set_status",
  run: "panel_run"
}, $e = (n) => `${De}.${Ee[n]}`, T = {
  model: "claude-code:sonnet",
  effort: "",
  dontAsk: !1,
  writeStatusBeforeRun: !0,
  pollMs: 2500,
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
function be(n) {
  const o = n ?? {};
  return {
    ...T,
    ...o,
    rulesV6: { ...T.rulesV6, ...o.rulesV6 ?? {} },
    rulesV7: { ...T.rulesV7, ...o.rulesV7 ?? {} },
    actions: Array.isArray(o.actions) && o.actions.length > 0 ? o.actions : T.actions
  };
}
function he({ story: n }) {
  return /* @__PURE__ */ c("span", { className: `bb-chip bb-col-${n.column}`, title: n.status || "no status", children: [
    R[n.column],
    n.blocked ? " ⛔" : "",
    n.dropped ? " (dropped)" : ""
  ] });
}
function pe({ sessions: n }) {
  if (!n.length) return null;
  const o = n.some((v) => v.status === "waiting_for_input" || v.hasPendingPrompt), s = n.some((v) => v.status === "running"), d = o ? "bb-dot bb-dot-wait" : s ? "bb-dot bb-dot-run" : "bb-dot", a = o ? "agent waits for you" : s ? "agent running" : `${n.length} session(s)`;
  return /* @__PURE__ */ e("span", { className: d, title: a, "aria-label": a });
}
function Ie(n) {
  const o = /* @__PURE__ */ new Map();
  for (const d of n.stories) {
    const a = o.get(d.epicId) ?? [];
    a.push(d), o.set(d.epicId, a);
  }
  const s = n.epics.filter((d) => o.has(d.id) || d.total === 0 && d.status !== "done");
  return s.length ? /* @__PURE__ */ e("div", { className: "bb-backlog", children: s.map((d) => {
    const a = o.get(d.id) ?? [], v = !n.collapsed.has(d.id), f = d.total ? Math.round(d.done / d.total * 100) : 0;
    return /* @__PURE__ */ c("section", { className: "bb-epic", children: [
      /* @__PURE__ */ c(
        "header",
        {
          className: "bb-epic-head",
          onClick: () => n.onToggle(d.id),
          onContextMenu: (b) => n.onEpicMenu(b, d),
          children: [
            /* @__PURE__ */ e("span", { className: "bb-caret", children: v ? "▾" : "▸" }),
            /* @__PURE__ */ c("span", { className: "bb-epic-title", children: [
              /* @__PURE__ */ e("span", { className: "bb-epic-num", children: d.num.toUpperCase() }),
              " ",
              d.title
            ] }),
            d.refined === !1 && /* @__PURE__ */ e("span", { className: "bb-chip bb-chip-warn", title: "epic file says refined: false", children: "unrefined" }),
            d.after.length > 0 && /* @__PURE__ */ c("span", { className: "bb-muted", title: "Epic depends on", children: [
              "after ",
              d.after.join(", ")
            ] }),
            /* @__PURE__ */ e("span", { className: `bb-chip bb-epic-status${d.statusDerived ? " bb-derived" : ""}`, title: d.statusDerived ? "derived from stories" : "recorded", children: d.status || "—" }),
            /* @__PURE__ */ e("span", { className: "bb-progress", title: `${d.done}/${d.total} done`, children: /* @__PURE__ */ e("span", { className: "bb-progress-bar", style: { width: `${f}%` } }) }),
            /* @__PURE__ */ c("span", { className: "bb-count", children: [
              d.done,
              "/",
              d.total
            ] })
          ]
        }
      ),
      v && /* @__PURE__ */ e("ul", { className: "bb-stories", children: a.map((b) => /* @__PURE__ */ c(
        "li",
        {
          className: `bb-story${n.selectedId === b.id ? " bb-selected" : ""}${b.dropped ? " bb-dropped" : ""}`,
          onClick: () => n.onSelect(b.id),
          onContextMenu: (C) => n.onStoryMenu(C, b),
          children: [
            /* @__PURE__ */ e("span", { className: "bb-ref", children: b.ref }),
            b.type && b.type !== "story" && /* @__PURE__ */ e("span", { className: "bb-chip", children: b.type }),
            /* @__PURE__ */ e("span", { className: "bb-story-title", children: b.title }),
            b.after.length > 0 && /* @__PURE__ */ c("span", { className: "bb-muted", title: "Depends on", children: [
              "⤴ ",
              b.after.join(", ")
            ] }),
            !b.movable && /* @__PURE__ */ e("span", { className: "bb-muted", title: b.lockedReason, children: "🔒" }),
            /* @__PURE__ */ e(pe, { sessions: n.sessions.filter((C) => C.storyId === b.id) }),
            /* @__PURE__ */ e(he, { story: b })
          ]
        },
        b.id
      )) })
    ] }, d.id);
  }) }) : /* @__PURE__ */ e("div", { className: "bb-empty", children: "Nothing matches the filters." });
}
function Re(n) {
  const [o, s] = w(null), [d, a] = w(null), v = new Map(n.stories.map((p) => [p.id, p])), f = n.epics.filter((p) => n.stories.some((S) => S.epicId === p.id));
  if (!f.length) return /* @__PURE__ */ e("div", { className: "bb-empty", children: "Nothing matches the filters." });
  const b = `repeat(${n.columns.length}, minmax(190px, 1fr))`, C = (p, S) => `${p}|${S}`;
  return /* @__PURE__ */ c("div", { className: "bb-board", children: [
    /* @__PURE__ */ e("div", { className: "bb-board-head", style: { gridTemplateColumns: b }, children: n.columns.map((p) => /* @__PURE__ */ c("div", { className: "bb-colhead", children: [
      R[p],
      " ",
      /* @__PURE__ */ e("span", { className: "bb-count", children: n.stories.filter((S) => S.column === p).length })
    ] }, p)) }),
    f.map((p) => {
      const S = !n.collapsed.has(p.id);
      return /* @__PURE__ */ c("section", { className: "bb-lane", children: [
        /* @__PURE__ */ c("header", { className: "bb-lane-head", onClick: () => n.onToggle(p.id), onContextMenu: (u) => n.onEpicMenu(u, p), children: [
          /* @__PURE__ */ e("span", { className: "bb-caret", children: S ? "▾" : "▸" }),
          /* @__PURE__ */ e("span", { className: "bb-epic-num", children: p.num.toUpperCase() }),
          " ",
          p.title,
          /* @__PURE__ */ c("span", { className: "bb-count", children: [
            p.done,
            "/",
            p.total
          ] })
        ] }),
        S && /* @__PURE__ */ e("div", { className: "bb-lane-grid", style: { gridTemplateColumns: b }, children: n.columns.map((u) => {
          const i = C(p.id, u), m = o !== null && o.epicId === p.id && o.from !== u, y = n.stories.filter((l) => l.epicId === p.id && l.column === u);
          return /* @__PURE__ */ e(
            "div",
            {
              className: `bb-cell${m ? " bb-droppable" : ""}${d === i && m ? " bb-over" : ""}`,
              onDragOver: (l) => {
                m && (l.preventDefault(), l.dataTransfer.dropEffect = "move", d !== i && a(i));
              },
              onDragLeave: () => a((l) => l === i ? null : l),
              onDrop: (l) => {
                l.preventDefault();
                const N = o ? v.get(o.id) : void 0;
                a(null), s(null), N && m && n.onMove(N, u);
              },
              children: y.map((l) => /* @__PURE__ */ c(
                "article",
                {
                  className: `bb-card${n.selectedId === l.id ? " bb-selected" : ""}${l.dropped ? " bb-dropped" : ""}${l.movable ? "" : " bb-locked"}`,
                  draggable: l.movable,
                  title: l.movable ? void 0 : l.lockedReason,
                  onDragStart: (N) => {
                    N.dataTransfer.setData("text/plain", l.id), N.dataTransfer.effectAllowed = "move", s({ id: l.id, epicId: l.epicId, from: l.column });
                  },
                  onDragEnd: () => {
                    s(null), a(null);
                  },
                  onClick: () => n.onSelect(l.id),
                  onContextMenu: (N) => n.onStoryMenu(N, l),
                  children: [
                    /* @__PURE__ */ c("div", { className: "bb-card-top", children: [
                      /* @__PURE__ */ e("span", { className: "bb-ref", children: l.ref }),
                      l.type && l.type !== "story" && /* @__PURE__ */ e("span", { className: "bb-chip", children: l.type }),
                      l.risk && /* @__PURE__ */ e("span", { className: "bb-chip bb-chip-warn", children: l.risk }),
                      /* @__PURE__ */ e("span", { className: "bb-spacer" }),
                      /* @__PURE__ */ e(pe, { sessions: n.sessions.filter((N) => N.storyId === l.id) })
                    ] }),
                    /* @__PURE__ */ e("div", { className: "bb-card-title", children: l.title }),
                    (l.blocked || l.after.length > 0 || l.dropped) && /* @__PURE__ */ c("div", { className: "bb-card-foot", children: [
                      l.blocked && /* @__PURE__ */ e("span", { className: "bb-chip bb-chip-err", title: l.blockedReason, children: "blocked" }),
                      l.dropped && /* @__PURE__ */ e("span", { className: "bb-chip", children: "dropped" }),
                      l.after.length > 0 && /* @__PURE__ */ c("span", { className: "bb-muted", title: "Depends on", children: [
                        "⤴ ",
                        l.after.join(", ")
                      ] })
                    ] })
                  ]
                },
                l.id
              ))
            },
            u
          );
        }) })
      ] }, p.id);
    })
  ] });
}
function Ae({ x: n, y: o, title: s, items: d, onClose: a }) {
  const v = K(null), [f, b] = w(null), [C, p] = w({ x: n, y: o });
  $(() => {
    const u = (m) => {
      v.current?.contains(m.target) || a();
    }, i = (m) => m.key === "Escape" && a();
    return document.addEventListener("mousedown", u, !0), document.addEventListener("keydown", i), () => {
      document.removeEventListener("mousedown", u, !0), document.removeEventListener("keydown", i);
    };
  }, [a]), $(() => {
    const u = v.current?.getBoundingClientRect();
    u && p({
      x: Math.max(4, Math.min(n, window.innerWidth - u.width - 4)),
      y: Math.max(4, Math.min(o, window.innerHeight - u.height - 4))
    });
  }, [n, o, f]);
  const S = (u) => {
    u.disabled || (a(), u.onSelect?.());
  };
  return /* @__PURE__ */ c("div", { ref: v, className: "bb-menu", style: { left: C.x, top: C.y }, role: "menu", children: [
    s && /* @__PURE__ */ e("div", { className: "bb-menu-title", children: s }),
    d.map(
      (u, i) => u.separator ? /* @__PURE__ */ e("div", { className: "bb-menu-sep" }, i) : /* @__PURE__ */ c("div", { children: [
        /* @__PURE__ */ c(
          "button",
          {
            role: "menuitem",
            className: "bb-menu-item",
            disabled: u.disabled,
            onClick: () => u.children ? b(f === i ? null : i) : S(u),
            children: [
              u.label,
              u.children && /* @__PURE__ */ e("span", { className: "bb-spacer", children: f === i ? "▾" : "▸" })
            ]
          }
        ),
        u.children && f === i && /* @__PURE__ */ e("div", { className: "bb-menu-sub", children: u.children.map((m, y) => /* @__PURE__ */ e("button", { role: "menuitem", className: "bb-menu-item", disabled: m.disabled, onClick: () => S(m), children: m.label }, y)) })
      ] }, i)
    )
  ] });
}
function Be({ spec: n, onClose: o }) {
  const [s, d] = w(!1);
  return $(() => {
    const a = (v) => {
      v.key === "Escape" && o(), v.key === "Enter" && !(v.target instanceof HTMLTextAreaElement) && (o(), n.run(s));
    };
    return document.addEventListener("keydown", a), () => document.removeEventListener("keydown", a);
  }, [n, s, o]), /* @__PURE__ */ e("div", { className: "bb-modal-backdrop", onMouseDown: o, children: /* @__PURE__ */ c("div", { className: "bb-modal", role: "dialog", "aria-label": n.title, onMouseDown: (a) => a.stopPropagation(), children: [
    /* @__PURE__ */ e("h2", { children: n.title }),
    n.status && /* @__PURE__ */ c("p", { children: [
      "Status → ",
      /* @__PURE__ */ e("code", { children: n.status })
    ] }),
    n.command && /* @__PURE__ */ c(U, { children: [
      /* @__PURE__ */ e("p", { children: "Starts a new agent session with:" }),
      /* @__PURE__ */ e("pre", { className: "bb-cmd", children: n.command })
    ] }),
    n.allowDontAsk && n.command && /* @__PURE__ */ c("label", { className: "bb-check", children: [
      /* @__PURE__ */ e("input", { type: "checkbox", checked: s, onChange: (a) => d(a.target.checked) }),
      " Don't ask again (can be undone in settings)"
    ] }),
    /* @__PURE__ */ c("div", { className: "bb-modal-actions", children: [
      /* @__PURE__ */ e("button", { className: "bb-btn", onClick: o, children: "Cancel" }),
      n.statusOnly && /* @__PURE__ */ e("button", { className: "bb-btn", onClick: () => {
        o(), n.statusOnly?.();
      }, children: "Only change status" }),
      /* @__PURE__ */ e("button", { className: "bb-btn bb-btn-primary", onClick: () => {
        o(), n.run(s);
      }, children: n.confirmLabel })
    ] })
  ] }) });
}
const z = ["claude-code:sonnet", "claude-code:opus", "claude-code:haiku"], Te = ["", "low", "medium", "high", "xhigh", "max"];
function ve({ value: n, onChange: o, className: s }) {
  const d = z.includes(n) ? z : [n, ...z];
  return /* @__PURE__ */ e("select", { className: s ?? "bb-select", value: n, onChange: (a) => o(a.target.value), title: "Model for sessions started from the board", children: d.map((a) => /* @__PURE__ */ e("option", { value: a, children: a }, a)) });
}
function xe({ col: n, rule: o, onChange: s }) {
  return /* @__PURE__ */ c("div", { className: "bb-rule", children: [
    /* @__PURE__ */ e("span", { className: "bb-rule-col", children: R[n] }),
    /* @__PURE__ */ e("input", { className: "bb-input bb-input-sm", value: o.status, placeholder: "status to write", onChange: (d) => s({ ...o, status: d.target.value }) }),
    /* @__PURE__ */ e("input", { className: "bb-input", value: o.command, placeholder: "command (empty = status only)", onChange: (d) => s({ ...o, command: d.target.value }) }),
    /* @__PURE__ */ c("label", { className: "bb-check", title: "Always ask, even with 'don't ask'", children: [
      /* @__PURE__ */ e("input", { type: "checkbox", checked: !!o.forceConfirm, onChange: (d) => s({ ...o, forceConfirm: d.target.checked }) }),
      " ask"
    ] })
  ] });
}
function Pe({ settings: n, version: o, onSave: s, onClose: d }) {
  const [a, v] = w(n), f = (i) => v((m) => ({ ...m, ...i })), b = o === "v7", C = b ? me : ue, p = b ? a.rulesV7 : a.rulesV6, S = (i, m) => f(b ? { rulesV7: { ...a.rulesV7, [i]: m } } : { rulesV6: { ...a.rulesV6, [i]: m } }), u = (i, m) => f({ actions: a.actions.map((y, l) => l === i ? m : y) });
  return /* @__PURE__ */ e("div", { className: "bb-modal-backdrop", onMouseDown: d, children: /* @__PURE__ */ c("div", { className: "bb-modal bb-modal-wide", role: "dialog", "aria-label": "BMAD Board settings", onMouseDown: (i) => i.stopPropagation(), children: [
    /* @__PURE__ */ e("h2", { children: "Settings" }),
    /* @__PURE__ */ c("div", { className: "bb-settings-scroll", children: [
      /* @__PURE__ */ e("h3", { children: "Sessions" }),
      /* @__PURE__ */ c("div", { className: "bb-form", children: [
        /* @__PURE__ */ c("label", { children: [
          "Model ",
          /* @__PURE__ */ e(ve, { value: a.model, onChange: (i) => f({ model: i }) })
        ] }),
        /* @__PURE__ */ c("label", { children: [
          "Effort",
          /* @__PURE__ */ e("select", { className: "bb-select", value: a.effort, onChange: (i) => f({ effort: i.target.value }), children: Te.map((i) => /* @__PURE__ */ e("option", { value: i, children: i || "default" }, i)) })
        ] }),
        /* @__PURE__ */ c("label", { className: "bb-check", children: [
          /* @__PURE__ */ e("input", { type: "checkbox", checked: a.dontAsk, onChange: (i) => f({ dontAsk: i.target.checked }) }),
          " Don't ask before starting a command"
        ] }),
        /* @__PURE__ */ c("label", { className: "bb-check", children: [
          /* @__PURE__ */ e("input", { type: "checkbox", checked: a.writeStatusBeforeRun, onChange: (i) => f({ writeStatusBeforeRun: i.target.checked }) }),
          " Write the status before launching the command"
        ] }),
        /* @__PURE__ */ c("label", { className: "bb-check", children: [
          /* @__PURE__ */ e("input", { type: "checkbox", checked: a.showDropped, onChange: (i) => f({ showDropped: i.target.checked }) }),
          " Show dropped stories (v7)"
        ] }),
        /* @__PURE__ */ c("label", { children: [
          "Poll every (ms)",
          /* @__PURE__ */ e("input", { className: "bb-input bb-input-sm", type: "number", min: 1e3, step: 500, value: a.pollMs, onChange: (i) => f({ pollMs: Math.max(1e3, Number(i.target.value) || T.pollMs) }) })
        ] })
      ] }),
      /* @__PURE__ */ c("h3", { children: [
        "Drop on a column (",
        o === "none" ? "v6" : o,
        ")"
      ] }),
      /* @__PURE__ */ c("p", { className: "bb-muted", children: [
        "Placeholders: ",
        "{key} {ref} {epic} {file} {title}"
      ] }),
      C.map((i) => /* @__PURE__ */ e(xe, { col: i, rule: p[i] ?? { status: "", command: "" }, onChange: (m) => S(i, m) }, i)),
      /* @__PURE__ */ e("h3", { children: "Right-click menu" }),
      a.actions.map((i, m) => /* @__PURE__ */ c("div", { className: "bb-rule", children: [
        /* @__PURE__ */ e("input", { className: "bb-input bb-input-sm", value: i.label, onChange: (y) => u(m, { ...i, label: y.target.value }) }),
        /* @__PURE__ */ c("select", { className: "bb-select", value: i.scope, onChange: (y) => u(m, { ...i, scope: y.target.value }), children: [
          /* @__PURE__ */ e("option", { value: "story", children: "story" }),
          /* @__PURE__ */ e("option", { value: "epic", children: "epic" })
        ] }),
        /* @__PURE__ */ e("input", { className: "bb-input", value: i.v6 ?? "", placeholder: "v6 command", onChange: (y) => u(m, { ...i, v6: y.target.value || void 0 }) }),
        /* @__PURE__ */ e("input", { className: "bb-input", value: i.v7 ?? "", placeholder: "v7 command", onChange: (y) => u(m, { ...i, v7: y.target.value || void 0 }) }),
        /* @__PURE__ */ e("button", { className: "bb-btn", onClick: () => f({ actions: a.actions.filter((y, l) => l !== m) }), "aria-label": "Remove", children: "✕" })
      ] }, i.id + m)),
      /* @__PURE__ */ e("button", { className: "bb-btn", onClick: () => f({ actions: [...a.actions, { id: `custom-${Date.now()}`, label: "New action", scope: "story", v6: "", v7: "" }] }), children: "+ Add action" }),
      /* @__PURE__ */ e("h3", { children: "Banner prompts" }),
      /* @__PURE__ */ c("div", { className: "bb-form", children: [
        /* @__PURE__ */ c("label", { children: [
          "Migrate (v6 → v7) ",
          /* @__PURE__ */ e("textarea", { className: "bb-input", rows: 2, value: a.migratePrompt, onChange: (i) => f({ migratePrompt: i.target.value }) })
        ] }),
        /* @__PURE__ */ c("label", { children: [
          "Start planning ",
          /* @__PURE__ */ e("input", { className: "bb-input", value: a.planPrompt, onChange: (i) => f({ planPrompt: i.target.value }) })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ c("div", { className: "bb-modal-actions", children: [
      /* @__PURE__ */ e("button", { className: "bb-btn", onClick: () => v({ ...T }), children: "Reset to defaults" }),
      /* @__PURE__ */ e("span", { className: "bb-spacer" }),
      /* @__PURE__ */ e("button", { className: "bb-btn", onClick: d, children: "Cancel" }),
      /* @__PURE__ */ e("button", { className: "bb-btn bb-btn-primary", onClick: () => {
        s(a), d();
      }, children: "Save" })
    ] })
  ] }) });
}
function Le(n) {
  const o = (s, d) => n.callBackendTool($e(s), d);
  return {
    load: (s) => o("load", s),
    detail: (s) => o("detail", s),
    setStatus: (s) => o("setStatus", s),
    run: (s) => o("run", s)
  };
}
const O = (n) => n instanceof Error ? n.message : String(n);
function Ve({ host: n, client: o, story: s, epic: d, sessions: a, initiative: v, rev: f }) {
  const [b, C] = w(null), [p, S] = w(null), [u, i] = w(null), m = s?.id ?? null;
  if ($(() => {
    if (!m) {
      C(null);
      return;
    }
    let l = !0;
    return o.detail({ storyId: m, initiative: v }).then((N) => {
      l && (C(N), S(null));
    }).catch((N) => l && S(O(N))), () => {
      l = !1;
    };
  }, [o, m, v, f]), $(() => i(null), [m]), !s) return /* @__PURE__ */ e("div", { className: "bb-details bb-empty", children: "Select a story." });
  const y = n.components?.SessionTranscript;
  return /* @__PURE__ */ c("div", { className: "bb-details", children: [
    /* @__PURE__ */ c("h2", { className: "bb-d-title", children: [
      /* @__PURE__ */ e("span", { className: "bb-ref", children: s.ref }),
      " ",
      s.title
    ] }),
    /* @__PURE__ */ c("div", { className: "bb-d-meta", children: [
      /* @__PURE__ */ e(he, { story: s }),
      d && /* @__PURE__ */ c("span", { className: "bb-muted", children: [
        d.num,
        " · ",
        d.title
      ] }),
      s.after.length > 0 && /* @__PURE__ */ c("span", { className: "bb-muted", children: [
        "after ",
        s.after.join(", ")
      ] })
    ] }),
    s.blocked && s.blockedReason && /* @__PURE__ */ c("div", { className: "bb-note bb-note-err", children: [
      "Blocked: ",
      s.blockedReason
    ] }),
    !s.movable && s.lockedReason && /* @__PURE__ */ e("div", { className: "bb-note", children: s.lockedReason }),
    p && /* @__PURE__ */ e("div", { className: "bb-note bb-note-err", children: p }),
    b && /* @__PURE__ */ c(U, { children: [
      /* @__PURE__ */ e("div", { className: "bb-d-files", children: b.files.map((l) => /* @__PURE__ */ c("button", { className: "bb-link", onClick: () => n.openFile(l.path), children: [
        "Open ",
        l.label.toLowerCase()
      ] }, l.path)) }),
      b.summary && /* @__PURE__ */ e("p", { className: "bb-d-summary", children: b.summary }),
      b.acceptance.length > 0 && /* @__PURE__ */ c(U, { children: [
        /* @__PURE__ */ e("h3", { children: "Acceptance criteria" }),
        /* @__PURE__ */ e("ol", { className: "bb-d-list", children: b.acceptance.map((l, N) => /* @__PURE__ */ e("li", { children: l }, N)) })
      ] }),
      b.tasks.length > 0 && /* @__PURE__ */ c(U, { children: [
        /* @__PURE__ */ c("h3", { children: [
          "Tasks ",
          /* @__PURE__ */ c("span", { className: "bb-count", children: [
            b.tasks.filter((l) => l.checked).length,
            "/",
            b.tasks.length
          ] })
        ] }),
        /* @__PURE__ */ e("ul", { className: "bb-d-tasks", children: b.tasks.map((l, N) => /* @__PURE__ */ c("li", { style: { paddingLeft: l.depth * 16 }, className: l.checked ? "bb-done" : "", children: [
          /* @__PURE__ */ e("span", { "aria-hidden": !0, children: l.checked ? "☑" : "☐" }),
          " ",
          l.text
        ] }, N)) })
      ] }),
      b.sections.map((l, N) => /* @__PURE__ */ c("details", { className: "bb-d-section", children: [
        /* @__PURE__ */ e("summary", { children: l.title }),
        /* @__PURE__ */ e("pre", { children: l.body })
      ] }, N))
    ] }),
    /* @__PURE__ */ c("h3", { children: [
      "Sessions ",
      a.length > 0 && /* @__PURE__ */ e("span", { className: "bb-count", children: a.length })
    ] }),
    a.length === 0 ? /* @__PURE__ */ e("div", { className: "bb-muted", children: "None launched from the board for this story." }) : /* @__PURE__ */ e("ul", { className: "bb-d-sessions", children: a.map((l) => /* @__PURE__ */ c("li", { className: u === l.sessionId ? "bb-selected" : "", onClick: () => i(u === l.sessionId ? null : l.sessionId), children: [
      /* @__PURE__ */ e("span", { className: `bb-dot bb-dot-${l.status === "running" ? "run" : l.status === "waiting_for_input" || l.hasPendingPrompt ? "wait" : "idle"}` }),
      /* @__PURE__ */ e("span", { className: "bb-session-title", children: l.title || l.sessionId.slice(0, 8) }),
      /* @__PURE__ */ e("span", { className: "bb-muted", children: l.hasPendingPrompt ? "needs answer" : l.status })
    ] }, l.sessionId)) }),
    u && y && /* @__PURE__ */ e("div", { className: "bb-transcript", children: /* @__PURE__ */ e(y, { sessionId: u }) })
  ] });
}
const fe = "settings.v1";
function Oe(n) {
  try {
    return be(n.storage.getGlobal(fe));
  } catch {
    return be(void 0);
  }
}
async function _e(n, o) {
  await n.storage.setGlobal(fe, o);
}
function Fe(n, o) {
  const s = (v) => v.replace(/\\/g, "/"), d = s(n).replace(/\/+$/, ""), a = s(o);
  return a.startsWith(d + "/") ? a.slice(d.length + 1) : a;
}
function je(n, o) {
  const { story: s, epic: d } = o, a = s ? o.version === "v6" ? s.id : s.ref : "", v = {
    key: a,
    ref: s?.ref ?? "",
    epic: d?.num ?? "",
    file: s ? s.file ? Fe(o.projectRoot, s.file) : a : "",
    title: s?.title ?? ""
  };
  return n.replace(/\{(key|ref|epic|file|title)\}/g, (f, b) => v[b] ?? "");
}
const Ue = (n) => {
  try {
    return n.storage.get("view") === "board" ? "board" : "backlog";
  } catch {
    return "backlog";
  }
};
function Ke({ host: n }) {
  const o = j(() => Le(n), [n]), [s, d] = w(() => Oe(n)), [a, v] = w(null), [f, b] = w(null), [C, p] = w(() => Ue(n)), [S, u] = w(null), [i, m] = w(""), [y, l] = w(""), [N, ge] = w(void 0), [J, Ne] = w(/* @__PURE__ */ new Set()), [x, W] = w(null), [Q, Z] = w(null), [ke, ee] = w(!1), [te, ne] = w(null), [G, we] = w(!1), Y = K(""), A = K(s);
  A.current = s;
  const q = K(N);
  q.current = N;
  const D = I((t) => {
    ne(t), window.setTimeout(() => ne((r) => r === t ? null : r), 4e3);
  }, []), E = I(async (t = !1) => {
    try {
      const r = await o.load({ initiative: q.current, since: t ? void 0 : Y.current || void 0 });
      if (b(null), r.unchanged) return;
      Y.current = r.model.rev, v(r.model);
    } catch (r) {
      b(O(r));
    }
  }, [o]);
  $(() => {
    E(!0);
  }, [E, N]), $(() => {
    const t = window.setInterval(() => {
      document.hidden || E();
    }, s.pollMs), r = () => !document.hidden && void E();
    return document.addEventListener("visibilitychange", r), () => {
      window.clearInterval(t), document.removeEventListener("visibilitychange", r);
    };
  }, [E, s.pollMs]), $(() => {
    n.setPanes?.({ right: { label: "Details", collapsed: G } });
  }, [n, G]), $(() => n.onPaneToggle?.((t) => t === "right" && we((r) => !r)), [n]), $(() => () => n.setPanes?.(null), [n]);
  const ye = (t) => {
    p(t), n.storage.set("view", t).catch(() => {
    });
  }, M = a?.version ?? "none", H = M === "v7" ? me : ue, B = j(() => new Map((a?.epics ?? []).map((t) => [t.id, t])), [a]), _ = j(
    () => (a?.epics ?? []).filter((t) => s.showDoneEpics || i === t.id || t.status !== "done"),
    [a, s.showDoneEpics, i]
  ), ae = j(() => {
    const t = new Set(_.map((r) => r.id));
    return (a?.stories ?? []).filter(
      (r) => t.has(r.epicId) && (s.showDropped || !r.dropped) && (!i || r.epicId === i) && (!y || r.column === y)
    );
  }, [a, _, s.showDropped, i, y]), P = a?.stories.find((t) => t.id === S) ?? null, se = I(
    async (t, r, h) => {
      const k = A.current;
      try {
        await o.run({ ownerKey: t, name: r, prompt: h, model: k.model, ...k.effort ? { effortLevel: k.effort } : {} }), D("Session started"), E(!0);
      } catch (g) {
        D(O(g));
      }
    },
    [o, D, E]
  ), X = I(
    async (t, r) => {
      try {
        const h = await o.setStatus({ storyId: t.id, status: r, initiative: q.current });
        return h.epicBumped && D(`Epic moved to ${h.epicBumped}`), await E(!0), !0;
      } catch (h) {
        return D(O(h)), !1;
      }
    },
    [o, D, E]
  ), L = I(
    (t) => {
      d(t), _e(n, t).catch((r) => D(`Could not save settings: ${O(r)}`));
    },
    [n, D]
  ), le = I(
    (t, r) => ({ version: M, projectRoot: a?.projectRoot ?? n.workspacePath, story: t, epic: r }),
    [M, a?.projectRoot, n.workspacePath]
  ), V = I(
    (t) => {
      const r = A.current, h = t.template ? je(t.template, le(t.story, t.epic)) : "", k = t.status && (!h || r.writeStatusBeforeRun && !t.rule?.statusByCommand), g = async () => {
        t.status && t.story && k && !await X(t.story, t.status) || h && await se(t.ownerKey, t.sessionName, h);
      };
      if (!(!!t.rule?.forceConfirm || !r.dontAsk && !!h)) {
        g();
        return;
      }
      Z({
        title: t.title,
        status: t.status && k ? t.status : void 0,
        command: h || void 0,
        allowDontAsk: !t.rule?.forceConfirm,
        confirmLabel: h ? "Run" : "Move",
        statusOnly: h && t.status && t.story && k ? () => {
          X(t.story, t.status);
        } : void 0,
        run: (Me) => {
          Me && !A.current.dontAsk && L({ ...A.current, dontAsk: !0 }), g();
        }
      });
    },
    [le, X, se, L]
  ), ie = I(
    (t, r) => {
      if (t.column === r) return;
      if (!t.movable) return D(t.lockedReason ?? "This story cannot be moved.");
      const h = A.current, g = (M === "v7" ? h.rulesV7 : h.rulesV6)[r];
      if (!g || !g.status && !g.command) return D(`No rule for ${R[r]}. Set one in settings.`);
      V({
        title: `${t.ref} → ${R[r]}`,
        story: t,
        epic: B.get(t.epicId),
        ownerKey: t.id,
        sessionName: `${t.ref} ${t.title}`.slice(0, 80),
        template: g.command,
        status: g.status,
        rule: g
      });
    },
    [M, V, D, B]
  ), oe = I(
    (t, r, h) => {
      const k = M === "v7" ? t.v7 : t.v6;
      if (!k) return;
      const g = r ? `${r.ref} ${r.title}` : `${h?.num ?? ""} ${h?.title ?? ""}`;
      V({
        title: `${t.label}: ${g}`.slice(0, 100),
        story: r,
        epic: h ?? (r ? B.get(r.epicId) : void 0),
        ownerKey: r ? r.id : `epic:${h?.id ?? "board"}`,
        sessionName: `${t.label}: ${g}`.slice(0, 80),
        template: k
      });
    },
    [M, V, B]
  ), Se = (t, r) => {
    const h = t === "migrate" ? s.migratePrompt : s.planPrompt;
    V({ title: r, ownerKey: "board", sessionName: r, template: h });
  }, ce = (t, r) => {
    t.preventDefault(), u(r.id);
    const h = B.get(r.epicId), k = s.actions.filter((g) => g.scope === "story" && (M === "v7" ? g.v7 : g.v6)).map((g) => ({ label: g.label, onSelect: () => oe(g, r, h) }));
    k.push({ separator: !0, label: "" }), k.push({
      label: "Move to",
      disabled: !r.movable,
      children: H.filter((g) => g !== r.column).map((g) => ({ label: R[g], onSelect: () => ie(r, g) }))
    }), r.file && k.push({ label: "Open file", onSelect: () => n.openFile(r.file) }), W({ x: t.clientX, y: t.clientY, title: `${r.ref} ${r.title}`, items: k });
  }, re = (t, r) => {
    t.preventDefault();
    const h = s.actions.filter((k) => k.scope === "epic" && (M === "v7" ? k.v7 : k.v6)).map((k) => ({ label: k.label, onSelect: () => oe(k, void 0, r) }));
    r.file && h.push({ label: "Open epic file", onSelect: () => n.openFile(r.file) }), h.length && W({ x: t.clientX, y: t.clientY, title: `${r.num} ${r.title}`, items: h });
  }, de = (t) => Ne((r) => {
    const h = new Set(r);
    return h.delete(t) || h.add(t), h;
  }), Ce = P && a ? a.sessions.filter((t) => t.storyId === P.id) : [], F = a !== null && a.version === "none";
  return /* @__PURE__ */ c("div", { className: "bb-root", children: [
    /* @__PURE__ */ c("header", { className: "bb-header", children: [
      /* @__PURE__ */ e("div", { className: "bb-tabs", role: "tablist", children: ["backlog", "board"].map((t) => /* @__PURE__ */ e("button", { role: "tab", "aria-selected": C === t, className: `bb-tab${C === t ? " bb-tab-on" : ""}`, onClick: () => ye(t), children: t === "backlog" ? "Backlog" : "Board" }, t)) }),
      /* @__PURE__ */ c("select", { className: "bb-select", value: i, onChange: (t) => m(t.target.value), "aria-label": "Epic filter", children: [
        /* @__PURE__ */ e("option", { value: "", children: "All epics" }),
        a?.epics.filter((t) => t.total > 0).map((t) => /* @__PURE__ */ c("option", { value: t.id, children: [
          t.num.toUpperCase(),
          " · ",
          t.title
        ] }, t.id))
      ] }),
      /* @__PURE__ */ c("select", { className: "bb-select", value: y, onChange: (t) => l(t.target.value), "aria-label": "Status filter", children: [
        /* @__PURE__ */ e("option", { value: "", children: "All statuses" }),
        H.map((t) => /* @__PURE__ */ e("option", { value: t, children: R[t] }, t))
      ] }),
      M === "v7" && a && a.initiatives.length > 0 && /* @__PURE__ */ e(
        "select",
        {
          className: "bb-select",
          value: N ?? a.activeInitiative ?? "",
          onChange: (t) => {
            Y.current = "", ge(t.target.value || void 0), u(null);
          },
          "aria-label": "Initiative",
          children: a.initiatives.map((t) => /* @__PURE__ */ e("option", { value: t, children: t }, t))
        }
      ),
      /* @__PURE__ */ c("label", { className: "bb-check", title: "Show epics whose status is done", children: [
        /* @__PURE__ */ e("input", { type: "checkbox", checked: s.showDoneEpics, onChange: (t) => L({ ...s, showDoneEpics: t.target.checked }) }),
        " done epics"
      ] }),
      /* @__PURE__ */ e("span", { className: "bb-spacer" }),
      /* @__PURE__ */ e(ve, { value: s.model, onChange: (t) => L({ ...s, model: t }) }),
      /* @__PURE__ */ e("span", { className: "bb-chip", title: "Detected BMAD version", children: M === "none" ? "no BMAD" : M }),
      /* @__PURE__ */ e("button", { className: "bb-btn", onClick: () => {
        E(!0);
      }, title: "Reload from files", children: "↻" }),
      /* @__PURE__ */ e("button", { className: "bb-btn", onClick: () => ee(!0), title: "Settings", children: "⚙" })
    ] }),
    a?.banners.map((t) => /* @__PURE__ */ c("div", { className: `bb-banner bb-banner-${t.kind}`, children: [
      /* @__PURE__ */ e("span", { children: t.message }),
      t.action && /* @__PURE__ */ e("button", { className: "bb-btn", onClick: () => Se(t.action.promptSetting, t.action.label), children: t.action.label })
    ] }, t.id)),
    f && /* @__PURE__ */ e("div", { className: "bb-banner bb-banner-error", children: f }),
    /* @__PURE__ */ c("div", { className: "bb-body", children: [
      /* @__PURE__ */ c("main", { className: "bb-main", children: [
        !a && !f && /* @__PURE__ */ e("div", { className: "bb-empty", children: "Loading…" }),
        a && !F && C === "backlog" && /* @__PURE__ */ e(
          Ie,
          {
            epics: _.filter((t) => !i || t.id === i),
            stories: ae,
            sessions: a.sessions,
            selectedId: S,
            collapsed: J,
            onToggle: de,
            onSelect: u,
            onStoryMenu: ce,
            onEpicMenu: re
          }
        ),
        a && !F && C === "board" && /* @__PURE__ */ e(
          Re,
          {
            columns: H,
            epics: _,
            stories: ae,
            sessions: a.sessions,
            selectedId: S,
            collapsed: J,
            onToggle: de,
            onSelect: u,
            onMove: ie,
            onStoryMenu: ce,
            onEpicMenu: re
          }
        ),
        F && /* @__PURE__ */ e("div", { className: "bb-empty", children: "Nothing to show yet. Use the banner above to start planning." })
      ] }),
      !G && !F && /* @__PURE__ */ e("aside", { className: "bb-aside", children: /* @__PURE__ */ e(
        Ve,
        {
          host: n,
          client: o,
          story: P,
          epic: P ? B.get(P.epicId) ?? null : null,
          sessions: Ce,
          initiative: N,
          rev: a?.rev ?? ""
        }
      ) })
    ] }),
    te && /* @__PURE__ */ e("div", { className: "bb-toast", role: "status", children: te }),
    x && /* @__PURE__ */ e(Ae, { x: x.x, y: x.y, title: x.title, items: x.items, onClose: () => W(null) }),
    Q && /* @__PURE__ */ e(Be, { spec: Q, onClose: () => Z(null) }),
    ke && /* @__PURE__ */ e(Pe, { settings: s, version: M, onSave: L, onClose: () => ee(!1) })
  ] });
}
const qe = {
  board: { component: Ke }
};
async function He() {
}
async function Xe() {
}
export {
  Ke as BoardPanel,
  He as activate,
  Xe as deactivate,
  qe as panels
};
//# sourceMappingURL=index.js.map
