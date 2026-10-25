import { jsx as e, jsxs as c, Fragment as F } from "react/jsx-runtime";
import { useState as w, useRef as j, useEffect as E, useMemo as H, useCallback as I } from "react";
const Me = "bmad-board", R = {
  backlog: "Backlog",
  ready: "Ready",
  "in-progress": "In progress",
  review: "Review",
  built: "Built",
  done: "Done"
}, be = ["backlog", "ready", "in-progress", "review", "done"], ue = ["backlog", "ready", "in-progress", "review", "built", "done"], De = {
  load: "panel_load",
  detail: "panel_detail",
  setStatus: "panel_set_status",
  run: "panel_run"
}, $e = (n) => `${Me}.${De[n]}`, T = {
  model: "claude-code:sonnet",
  effort: "",
  dontAsk: !1,
  writeStatusBeforeRun: !0,
  pollMs: 2500,
  showDropped: !1,
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
function de(n) {
  const i = n ?? {};
  return {
    ...T,
    ...i,
    rulesV6: { ...T.rulesV6, ...i.rulesV6 ?? {} },
    rulesV7: { ...T.rulesV7, ...i.rulesV7 ?? {} },
    actions: Array.isArray(i.actions) && i.actions.length > 0 ? i.actions : T.actions
  };
}
function me({ story: n }) {
  return /* @__PURE__ */ c("span", { className: `bb-chip bb-col-${n.column}`, title: n.status || "no status", children: [
    R[n.column],
    n.blocked ? " ⛔" : "",
    n.dropped ? " (dropped)" : ""
  ] });
}
function he({ sessions: n }) {
  if (!n.length) return null;
  const i = n.some((v) => v.status === "waiting_for_input" || v.hasPendingPrompt), s = n.some((v) => v.status === "running"), r = i ? "bb-dot bb-dot-wait" : s ? "bb-dot bb-dot-run" : "bb-dot", a = i ? "agent waits for you" : s ? "agent running" : `${n.length} session(s)`;
  return /* @__PURE__ */ e("span", { className: r, title: a, "aria-label": a });
}
function Ee(n) {
  const i = /* @__PURE__ */ new Map();
  for (const r of n.stories) {
    const a = i.get(r.epicId) ?? [];
    a.push(r), i.set(r.epicId, a);
  }
  const s = n.epics.filter((r) => i.has(r.id) || r.total === 0);
  return s.length ? /* @__PURE__ */ e("div", { className: "bb-backlog", children: s.map((r) => {
    const a = i.get(r.id) ?? [], v = !n.collapsed.has(r.id), f = r.total ? Math.round(r.done / r.total * 100) : 0;
    return /* @__PURE__ */ c("section", { className: "bb-epic", children: [
      /* @__PURE__ */ c(
        "header",
        {
          className: "bb-epic-head",
          onClick: () => n.onToggle(r.id),
          onContextMenu: (b) => n.onEpicMenu(b, r),
          children: [
            /* @__PURE__ */ e("span", { className: "bb-caret", children: v ? "▾" : "▸" }),
            /* @__PURE__ */ c("span", { className: "bb-epic-title", children: [
              /* @__PURE__ */ e("span", { className: "bb-epic-num", children: r.num }),
              " ",
              r.title
            ] }),
            r.refined === !1 && /* @__PURE__ */ e("span", { className: "bb-chip bb-chip-warn", title: "epic file says refined: false", children: "unrefined" }),
            r.after.length > 0 && /* @__PURE__ */ c("span", { className: "bb-muted", title: "Epic depends on", children: [
              "after ",
              r.after.join(", ")
            ] }),
            /* @__PURE__ */ e("span", { className: `bb-chip bb-epic-status${r.statusDerived ? " bb-derived" : ""}`, title: r.statusDerived ? "derived from stories" : "recorded", children: r.status || "—" }),
            /* @__PURE__ */ e("span", { className: "bb-progress", title: `${r.done}/${r.total} done`, children: /* @__PURE__ */ e("span", { className: "bb-progress-bar", style: { width: `${f}%` } }) }),
            /* @__PURE__ */ c("span", { className: "bb-count", children: [
              r.done,
              "/",
              r.total
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
            /* @__PURE__ */ e(he, { sessions: n.sessions.filter((C) => C.storyId === b.id) }),
            /* @__PURE__ */ e(me, { story: b })
          ]
        },
        b.id
      )) })
    ] }, r.id);
  }) }) : /* @__PURE__ */ e("div", { className: "bb-empty", children: "Nothing matches the filters." });
}
function Ie(n) {
  const [i, s] = w(null), [r, a] = w(null), v = new Map(n.stories.map((p) => [p.id, p])), f = n.epics.filter((p) => n.stories.some((S) => S.epicId === p.id));
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
          /* @__PURE__ */ e("span", { className: "bb-epic-num", children: p.num }),
          " ",
          p.title,
          /* @__PURE__ */ c("span", { className: "bb-count", children: [
            p.done,
            "/",
            p.total
          ] })
        ] }),
        S && /* @__PURE__ */ e("div", { className: "bb-lane-grid", style: { gridTemplateColumns: b }, children: n.columns.map((u) => {
          const o = C(p.id, u), m = i !== null && i.epicId === p.id && i.from !== u, y = n.stories.filter((l) => l.epicId === p.id && l.column === u);
          return /* @__PURE__ */ e(
            "div",
            {
              className: `bb-cell${m ? " bb-droppable" : ""}${r === o && m ? " bb-over" : ""}`,
              onDragOver: (l) => {
                m && (l.preventDefault(), l.dataTransfer.dropEffect = "move", r !== o && a(o));
              },
              onDragLeave: () => a((l) => l === o ? null : l),
              onDrop: (l) => {
                l.preventDefault();
                const N = i ? v.get(i.id) : void 0;
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
                      /* @__PURE__ */ e(he, { sessions: n.sessions.filter((N) => N.storyId === l.id) })
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
function Re({ x: n, y: i, title: s, items: r, onClose: a }) {
  const v = j(null), [f, b] = w(null), [C, p] = w({ x: n, y: i });
  E(() => {
    const u = (m) => {
      v.current?.contains(m.target) || a();
    }, o = (m) => m.key === "Escape" && a();
    return document.addEventListener("mousedown", u, !0), document.addEventListener("keydown", o), () => {
      document.removeEventListener("mousedown", u, !0), document.removeEventListener("keydown", o);
    };
  }, [a]), E(() => {
    const u = v.current?.getBoundingClientRect();
    u && p({
      x: Math.max(4, Math.min(n, window.innerWidth - u.width - 4)),
      y: Math.max(4, Math.min(i, window.innerHeight - u.height - 4))
    });
  }, [n, i, f]);
  const S = (u) => {
    u.disabled || (a(), u.onSelect?.());
  };
  return /* @__PURE__ */ c("div", { ref: v, className: "bb-menu", style: { left: C.x, top: C.y }, role: "menu", children: [
    s && /* @__PURE__ */ e("div", { className: "bb-menu-title", children: s }),
    r.map(
      (u, o) => u.separator ? /* @__PURE__ */ e("div", { className: "bb-menu-sep" }, o) : /* @__PURE__ */ c("div", { children: [
        /* @__PURE__ */ c(
          "button",
          {
            role: "menuitem",
            className: "bb-menu-item",
            disabled: u.disabled,
            onClick: () => u.children ? b(f === o ? null : o) : S(u),
            children: [
              u.label,
              u.children && /* @__PURE__ */ e("span", { className: "bb-spacer", children: f === o ? "▾" : "▸" })
            ]
          }
        ),
        u.children && f === o && /* @__PURE__ */ e("div", { className: "bb-menu-sub", children: u.children.map((m, y) => /* @__PURE__ */ e("button", { role: "menuitem", className: "bb-menu-item", disabled: m.disabled, onClick: () => S(m), children: m.label }, y)) })
      ] }, o)
    )
  ] });
}
function Ae({ spec: n, onClose: i }) {
  const [s, r] = w(!1);
  return E(() => {
    const a = (v) => {
      v.key === "Escape" && i(), v.key === "Enter" && !(v.target instanceof HTMLTextAreaElement) && (i(), n.run(s));
    };
    return document.addEventListener("keydown", a), () => document.removeEventListener("keydown", a);
  }, [n, s, i]), /* @__PURE__ */ e("div", { className: "bb-modal-backdrop", onMouseDown: i, children: /* @__PURE__ */ c("div", { className: "bb-modal", role: "dialog", "aria-label": n.title, onMouseDown: (a) => a.stopPropagation(), children: [
    /* @__PURE__ */ e("h2", { children: n.title }),
    n.status && /* @__PURE__ */ c("p", { children: [
      "Status → ",
      /* @__PURE__ */ e("code", { children: n.status })
    ] }),
    n.command && /* @__PURE__ */ c(F, { children: [
      /* @__PURE__ */ e("p", { children: "Starts a new agent session with:" }),
      /* @__PURE__ */ e("pre", { className: "bb-cmd", children: n.command })
    ] }),
    n.allowDontAsk && n.command && /* @__PURE__ */ c("label", { className: "bb-check", children: [
      /* @__PURE__ */ e("input", { type: "checkbox", checked: s, onChange: (a) => r(a.target.checked) }),
      " Don't ask again (can be undone in settings)"
    ] }),
    /* @__PURE__ */ c("div", { className: "bb-modal-actions", children: [
      /* @__PURE__ */ e("button", { className: "bb-btn", onClick: i, children: "Cancel" }),
      n.statusOnly && /* @__PURE__ */ e("button", { className: "bb-btn", onClick: () => {
        i(), n.statusOnly?.();
      }, children: "Only change status" }),
      /* @__PURE__ */ e("button", { className: "bb-btn bb-btn-primary", onClick: () => {
        i(), n.run(s);
      }, children: n.confirmLabel })
    ] })
  ] }) });
}
const X = ["claude-code:sonnet", "claude-code:opus", "claude-code:haiku"], Be = ["", "low", "medium", "high", "xhigh", "max"];
function pe({ value: n, onChange: i, className: s }) {
  const r = X.includes(n) ? X : [n, ...X];
  return /* @__PURE__ */ e("select", { className: s ?? "bb-select", value: n, onChange: (a) => i(a.target.value), title: "Model for sessions started from the board", children: r.map((a) => /* @__PURE__ */ e("option", { value: a, children: a }, a)) });
}
function Te({ col: n, rule: i, onChange: s }) {
  return /* @__PURE__ */ c("div", { className: "bb-rule", children: [
    /* @__PURE__ */ e("span", { className: "bb-rule-col", children: R[n] }),
    /* @__PURE__ */ e("input", { className: "bb-input bb-input-sm", value: i.status, placeholder: "status to write", onChange: (r) => s({ ...i, status: r.target.value }) }),
    /* @__PURE__ */ e("input", { className: "bb-input", value: i.command, placeholder: "command (empty = status only)", onChange: (r) => s({ ...i, command: r.target.value }) }),
    /* @__PURE__ */ c("label", { className: "bb-check", title: "Always ask, even with 'don't ask'", children: [
      /* @__PURE__ */ e("input", { type: "checkbox", checked: !!i.forceConfirm, onChange: (r) => s({ ...i, forceConfirm: r.target.checked }) }),
      " ask"
    ] })
  ] });
}
function Pe({ settings: n, version: i, onSave: s, onClose: r }) {
  const [a, v] = w(n), f = (o) => v((m) => ({ ...m, ...o })), b = i === "v7", C = b ? ue : be, p = b ? a.rulesV7 : a.rulesV6, S = (o, m) => f(b ? { rulesV7: { ...a.rulesV7, [o]: m } } : { rulesV6: { ...a.rulesV6, [o]: m } }), u = (o, m) => f({ actions: a.actions.map((y, l) => l === o ? m : y) });
  return /* @__PURE__ */ e("div", { className: "bb-modal-backdrop", onMouseDown: r, children: /* @__PURE__ */ c("div", { className: "bb-modal bb-modal-wide", role: "dialog", "aria-label": "BMAD Board settings", onMouseDown: (o) => o.stopPropagation(), children: [
    /* @__PURE__ */ e("h2", { children: "Settings" }),
    /* @__PURE__ */ c("div", { className: "bb-settings-scroll", children: [
      /* @__PURE__ */ e("h3", { children: "Sessions" }),
      /* @__PURE__ */ c("div", { className: "bb-form", children: [
        /* @__PURE__ */ c("label", { children: [
          "Model ",
          /* @__PURE__ */ e(pe, { value: a.model, onChange: (o) => f({ model: o }) })
        ] }),
        /* @__PURE__ */ c("label", { children: [
          "Effort",
          /* @__PURE__ */ e("select", { className: "bb-select", value: a.effort, onChange: (o) => f({ effort: o.target.value }), children: Be.map((o) => /* @__PURE__ */ e("option", { value: o, children: o || "default" }, o)) })
        ] }),
        /* @__PURE__ */ c("label", { className: "bb-check", children: [
          /* @__PURE__ */ e("input", { type: "checkbox", checked: a.dontAsk, onChange: (o) => f({ dontAsk: o.target.checked }) }),
          " Don't ask before starting a command"
        ] }),
        /* @__PURE__ */ c("label", { className: "bb-check", children: [
          /* @__PURE__ */ e("input", { type: "checkbox", checked: a.writeStatusBeforeRun, onChange: (o) => f({ writeStatusBeforeRun: o.target.checked }) }),
          " Write the status before launching the command"
        ] }),
        /* @__PURE__ */ c("label", { className: "bb-check", children: [
          /* @__PURE__ */ e("input", { type: "checkbox", checked: a.showDropped, onChange: (o) => f({ showDropped: o.target.checked }) }),
          " Show dropped stories (v7)"
        ] }),
        /* @__PURE__ */ c("label", { children: [
          "Poll every (ms)",
          /* @__PURE__ */ e("input", { className: "bb-input bb-input-sm", type: "number", min: 1e3, step: 500, value: a.pollMs, onChange: (o) => f({ pollMs: Math.max(1e3, Number(o.target.value) || T.pollMs) }) })
        ] })
      ] }),
      /* @__PURE__ */ c("h3", { children: [
        "Drop on a column (",
        i === "none" ? "v6" : i,
        ")"
      ] }),
      /* @__PURE__ */ c("p", { className: "bb-muted", children: [
        "Placeholders: ",
        "{key} {ref} {epic} {file} {title}"
      ] }),
      C.map((o) => /* @__PURE__ */ e(Te, { col: o, rule: p[o] ?? { status: "", command: "" }, onChange: (m) => S(o, m) }, o)),
      /* @__PURE__ */ e("h3", { children: "Right-click menu" }),
      a.actions.map((o, m) => /* @__PURE__ */ c("div", { className: "bb-rule", children: [
        /* @__PURE__ */ e("input", { className: "bb-input bb-input-sm", value: o.label, onChange: (y) => u(m, { ...o, label: y.target.value }) }),
        /* @__PURE__ */ c("select", { className: "bb-select", value: o.scope, onChange: (y) => u(m, { ...o, scope: y.target.value }), children: [
          /* @__PURE__ */ e("option", { value: "story", children: "story" }),
          /* @__PURE__ */ e("option", { value: "epic", children: "epic" })
        ] }),
        /* @__PURE__ */ e("input", { className: "bb-input", value: o.v6 ?? "", placeholder: "v6 command", onChange: (y) => u(m, { ...o, v6: y.target.value || void 0 }) }),
        /* @__PURE__ */ e("input", { className: "bb-input", value: o.v7 ?? "", placeholder: "v7 command", onChange: (y) => u(m, { ...o, v7: y.target.value || void 0 }) }),
        /* @__PURE__ */ e("button", { className: "bb-btn", onClick: () => f({ actions: a.actions.filter((y, l) => l !== m) }), "aria-label": "Remove", children: "✕" })
      ] }, o.id + m)),
      /* @__PURE__ */ e("button", { className: "bb-btn", onClick: () => f({ actions: [...a.actions, { id: `custom-${Date.now()}`, label: "New action", scope: "story", v6: "", v7: "" }] }), children: "+ Add action" }),
      /* @__PURE__ */ e("h3", { children: "Banner prompts" }),
      /* @__PURE__ */ c("div", { className: "bb-form", children: [
        /* @__PURE__ */ c("label", { children: [
          "Migrate (v6 → v7) ",
          /* @__PURE__ */ e("textarea", { className: "bb-input", rows: 2, value: a.migratePrompt, onChange: (o) => f({ migratePrompt: o.target.value }) })
        ] }),
        /* @__PURE__ */ c("label", { children: [
          "Start planning ",
          /* @__PURE__ */ e("input", { className: "bb-input", value: a.planPrompt, onChange: (o) => f({ planPrompt: o.target.value }) })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ c("div", { className: "bb-modal-actions", children: [
      /* @__PURE__ */ e("button", { className: "bb-btn", onClick: () => v({ ...T }), children: "Reset to defaults" }),
      /* @__PURE__ */ e("span", { className: "bb-spacer" }),
      /* @__PURE__ */ e("button", { className: "bb-btn", onClick: r, children: "Cancel" }),
      /* @__PURE__ */ e("button", { className: "bb-btn bb-btn-primary", onClick: () => {
        s(a), r();
      }, children: "Save" })
    ] })
  ] }) });
}
function xe(n) {
  const i = (s, r) => n.callBackendTool($e(s), r);
  return {
    load: (s) => i("load", s),
    detail: (s) => i("detail", s),
    setStatus: (s) => i("setStatus", s),
    run: (s) => i("run", s)
  };
}
const V = (n) => n instanceof Error ? n.message : String(n);
function Le({ host: n, client: i, story: s, epic: r, sessions: a, initiative: v, rev: f }) {
  const [b, C] = w(null), [p, S] = w(null), [u, o] = w(null), m = s?.id ?? null;
  if (E(() => {
    if (!m) {
      C(null);
      return;
    }
    let l = !0;
    return i.detail({ storyId: m, initiative: v }).then((N) => {
      l && (C(N), S(null));
    }).catch((N) => l && S(V(N))), () => {
      l = !1;
    };
  }, [i, m, v, f]), E(() => o(null), [m]), !s) return /* @__PURE__ */ e("div", { className: "bb-details bb-empty", children: "Select a story." });
  const y = n.components?.SessionTranscript;
  return /* @__PURE__ */ c("div", { className: "bb-details", children: [
    /* @__PURE__ */ c("h2", { className: "bb-d-title", children: [
      /* @__PURE__ */ e("span", { className: "bb-ref", children: s.ref }),
      " ",
      s.title
    ] }),
    /* @__PURE__ */ c("div", { className: "bb-d-meta", children: [
      /* @__PURE__ */ e(me, { story: s }),
      r && /* @__PURE__ */ c("span", { className: "bb-muted", children: [
        r.num,
        " · ",
        r.title
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
    b && /* @__PURE__ */ c(F, { children: [
      /* @__PURE__ */ e("div", { className: "bb-d-files", children: b.files.map((l) => /* @__PURE__ */ c("button", { className: "bb-link", onClick: () => n.openFile(l.path), children: [
        "Open ",
        l.label.toLowerCase()
      ] }, l.path)) }),
      b.summary && /* @__PURE__ */ e("p", { className: "bb-d-summary", children: b.summary }),
      b.acceptance.length > 0 && /* @__PURE__ */ c(F, { children: [
        /* @__PURE__ */ e("h3", { children: "Acceptance criteria" }),
        /* @__PURE__ */ e("ol", { className: "bb-d-list", children: b.acceptance.map((l, N) => /* @__PURE__ */ e("li", { children: l }, N)) })
      ] }),
      b.tasks.length > 0 && /* @__PURE__ */ c(F, { children: [
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
    a.length === 0 ? /* @__PURE__ */ e("div", { className: "bb-muted", children: "None launched from the board for this story." }) : /* @__PURE__ */ e("ul", { className: "bb-d-sessions", children: a.map((l) => /* @__PURE__ */ c("li", { className: u === l.sessionId ? "bb-selected" : "", onClick: () => o(u === l.sessionId ? null : l.sessionId), children: [
      /* @__PURE__ */ e("span", { className: `bb-dot bb-dot-${l.status === "running" ? "run" : l.status === "waiting_for_input" || l.hasPendingPrompt ? "wait" : "idle"}` }),
      /* @__PURE__ */ e("span", { className: "bb-session-title", children: l.title || l.sessionId.slice(0, 8) }),
      /* @__PURE__ */ e("span", { className: "bb-muted", children: l.hasPendingPrompt ? "needs answer" : l.status })
    ] }, l.sessionId)) }),
    u && y && /* @__PURE__ */ e("div", { className: "bb-transcript", children: /* @__PURE__ */ e(y, { sessionId: u }) })
  ] });
}
const ve = "settings.v1";
function Ve(n) {
  try {
    return de(n.storage.getGlobal(ve));
  } catch {
    return de(void 0);
  }
}
async function Oe(n, i) {
  await n.storage.setGlobal(ve, i);
}
function _e(n, i) {
  const s = (v) => v.replace(/\\/g, "/"), r = s(n).replace(/\/+$/, ""), a = s(i);
  return a.startsWith(r + "/") ? a.slice(r.length + 1) : a;
}
function Fe(n, i) {
  const { story: s, epic: r } = i, a = s ? i.version === "v6" ? s.id : s.ref : "", v = {
    key: a,
    ref: s?.ref ?? "",
    epic: r?.num ?? "",
    file: s ? s.file ? _e(i.projectRoot, s.file) : a : "",
    title: s?.title ?? ""
  };
  return n.replace(/\{(key|ref|epic|file|title)\}/g, (f, b) => v[b] ?? "");
}
const je = (n) => {
  try {
    return n.storage.get("view") === "board" ? "board" : "backlog";
  } catch {
    return "backlog";
  }
};
function Ke({ host: n }) {
  const i = H(() => xe(n), [n]), [s, r] = w(() => Ve(n)), [a, v] = w(null), [f, b] = w(null), [C, p] = w(() => je(n)), [S, u] = w(null), [o, m] = w(""), [y, l] = w(""), [N, fe] = w(void 0), [z, ge] = w(/* @__PURE__ */ new Set()), [P, K] = w(null), [J, Q] = w(null), [Ne, Z] = w(!1), [ee, te] = w(null), [U, ke] = w(!1), W = j(""), A = j(s);
  A.current = s;
  const G = j(N);
  G.current = N;
  const D = I((t) => {
    te(t), window.setTimeout(() => te((d) => d === t ? null : d), 4e3);
  }, []), $ = I(async (t = !1) => {
    try {
      const d = await i.load({ initiative: G.current, since: t ? void 0 : W.current || void 0 });
      if (b(null), d.unchanged) return;
      W.current = d.model.rev, v(d.model);
    } catch (d) {
      b(V(d));
    }
  }, [i]);
  E(() => {
    $(!0);
  }, [$, N]), E(() => {
    const t = window.setInterval(() => {
      document.hidden || $();
    }, s.pollMs), d = () => !document.hidden && void $();
    return document.addEventListener("visibilitychange", d), () => {
      window.clearInterval(t), document.removeEventListener("visibilitychange", d);
    };
  }, [$, s.pollMs]), E(() => {
    n.setPanes?.({ right: { label: "Details", collapsed: U } });
  }, [n, U]), E(() => n.onPaneToggle?.((t) => t === "right" && ke((d) => !d)), [n]), E(() => () => n.setPanes?.(null), [n]);
  const we = (t) => {
    p(t), n.storage.set("view", t).catch(() => {
    });
  }, M = a?.version ?? "none", Y = M === "v7" ? ue : be, B = H(() => new Map((a?.epics ?? []).map((t) => [t.id, t])), [a]), ne = H(
    () => (a?.stories ?? []).filter(
      (t) => (s.showDropped || !t.dropped) && (!o || t.epicId === o) && (!y || t.column === y)
    ),
    [a, s.showDropped, o, y]
  ), x = a?.stories.find((t) => t.id === S) ?? null, ae = I(
    async (t, d, h) => {
      const k = A.current;
      try {
        await i.run({ ownerKey: t, name: d, prompt: h, model: k.model, ...k.effort ? { effortLevel: k.effort } : {} }), D("Session started"), $(!0);
      } catch (g) {
        D(V(g));
      }
    },
    [i, D, $]
  ), q = I(
    async (t, d) => {
      try {
        const h = await i.setStatus({ storyId: t.id, status: d, initiative: G.current });
        return h.epicBumped && D(`Epic moved to ${h.epicBumped}`), await $(!0), !0;
      } catch (h) {
        return D(V(h)), !1;
      }
    },
    [i, D, $]
  ), O = I(
    (t) => {
      r(t), Oe(n, t).catch((d) => D(`Could not save settings: ${V(d)}`));
    },
    [n, D]
  ), le = I(
    (t, d) => ({ version: M, projectRoot: a?.projectRoot ?? n.workspacePath, story: t, epic: d }),
    [M, a?.projectRoot, n.workspacePath]
  ), L = I(
    (t) => {
      const d = A.current, h = t.template ? Fe(t.template, le(t.story, t.epic)) : "", k = t.status && (!h || d.writeStatusBeforeRun && !t.rule?.statusByCommand), g = async () => {
        t.status && t.story && k && !await q(t.story, t.status) || h && await ae(t.ownerKey, t.sessionName, h);
      };
      if (!(!!t.rule?.forceConfirm || !d.dontAsk && !!h)) {
        g();
        return;
      }
      Q({
        title: t.title,
        status: t.status && k ? t.status : void 0,
        command: h || void 0,
        allowDontAsk: !t.rule?.forceConfirm,
        confirmLabel: h ? "Run" : "Move",
        statusOnly: h && t.status && t.story && k ? () => {
          q(t.story, t.status);
        } : void 0,
        run: (Ce) => {
          Ce && !A.current.dontAsk && O({ ...A.current, dontAsk: !0 }), g();
        }
      });
    },
    [le, q, ae, O]
  ), se = I(
    (t, d) => {
      if (t.column === d) return;
      if (!t.movable) return D(t.lockedReason ?? "This story cannot be moved.");
      const h = A.current, g = (M === "v7" ? h.rulesV7 : h.rulesV6)[d];
      if (!g || !g.status && !g.command) return D(`No rule for ${R[d]}. Set one in settings.`);
      L({
        title: `${t.ref} → ${R[d]}`,
        story: t,
        epic: B.get(t.epicId),
        ownerKey: t.id,
        sessionName: `${t.ref} ${t.title}`.slice(0, 80),
        template: g.command,
        status: g.status,
        rule: g
      });
    },
    [M, L, D, B]
  ), ie = I(
    (t, d, h) => {
      const k = M === "v7" ? t.v7 : t.v6;
      if (!k) return;
      const g = d ? `${d.ref} ${d.title}` : `${h?.num ?? ""} ${h?.title ?? ""}`;
      L({
        title: `${t.label}: ${g}`.slice(0, 100),
        story: d,
        epic: h ?? (d ? B.get(d.epicId) : void 0),
        ownerKey: d ? d.id : `epic:${h?.id ?? "board"}`,
        sessionName: `${t.label}: ${g}`.slice(0, 80),
        template: k
      });
    },
    [M, L, B]
  ), ye = (t, d) => {
    const h = t === "migrate" ? s.migratePrompt : s.planPrompt;
    L({ title: d, ownerKey: "board", sessionName: d, template: h });
  }, oe = (t, d) => {
    t.preventDefault(), u(d.id);
    const h = B.get(d.epicId), k = s.actions.filter((g) => g.scope === "story" && (M === "v7" ? g.v7 : g.v6)).map((g) => ({ label: g.label, onSelect: () => ie(g, d, h) }));
    k.push({ separator: !0, label: "" }), k.push({
      label: "Move to",
      disabled: !d.movable,
      children: Y.filter((g) => g !== d.column).map((g) => ({ label: R[g], onSelect: () => se(d, g) }))
    }), d.file && k.push({ label: "Open file", onSelect: () => n.openFile(d.file) }), K({ x: t.clientX, y: t.clientY, title: `${d.ref} ${d.title}`, items: k });
  }, ce = (t, d) => {
    t.preventDefault();
    const h = s.actions.filter((k) => k.scope === "epic" && (M === "v7" ? k.v7 : k.v6)).map((k) => ({ label: k.label, onSelect: () => ie(k, void 0, d) }));
    d.file && h.push({ label: "Open epic file", onSelect: () => n.openFile(d.file) }), h.length && K({ x: t.clientX, y: t.clientY, title: `${d.num} ${d.title}`, items: h });
  }, re = (t) => ge((d) => {
    const h = new Set(d);
    return h.delete(t) || h.add(t), h;
  }), Se = x && a ? a.sessions.filter((t) => t.storyId === x.id) : [], _ = a !== null && a.version === "none";
  return /* @__PURE__ */ c("div", { className: "bb-root", children: [
    /* @__PURE__ */ c("header", { className: "bb-header", children: [
      /* @__PURE__ */ e("div", { className: "bb-tabs", role: "tablist", children: ["backlog", "board"].map((t) => /* @__PURE__ */ e("button", { role: "tab", "aria-selected": C === t, className: `bb-tab${C === t ? " bb-tab-on" : ""}`, onClick: () => we(t), children: t === "backlog" ? "Backlog" : "Board" }, t)) }),
      /* @__PURE__ */ c("select", { className: "bb-select", value: o, onChange: (t) => m(t.target.value), "aria-label": "Epic filter", children: [
        /* @__PURE__ */ e("option", { value: "", children: "All epics" }),
        a?.epics.map((t) => /* @__PURE__ */ c("option", { value: t.id, children: [
          t.num,
          " · ",
          t.title
        ] }, t.id))
      ] }),
      /* @__PURE__ */ c("select", { className: "bb-select", value: y, onChange: (t) => l(t.target.value), "aria-label": "Status filter", children: [
        /* @__PURE__ */ e("option", { value: "", children: "All statuses" }),
        Y.map((t) => /* @__PURE__ */ e("option", { value: t, children: R[t] }, t))
      ] }),
      M === "v7" && a && a.initiatives.length > 0 && /* @__PURE__ */ e(
        "select",
        {
          className: "bb-select",
          value: N ?? a.activeInitiative ?? "",
          onChange: (t) => {
            W.current = "", fe(t.target.value || void 0), u(null);
          },
          "aria-label": "Initiative",
          children: a.initiatives.map((t) => /* @__PURE__ */ e("option", { value: t, children: t }, t))
        }
      ),
      /* @__PURE__ */ e("span", { className: "bb-spacer" }),
      /* @__PURE__ */ e(pe, { value: s.model, onChange: (t) => O({ ...s, model: t }) }),
      /* @__PURE__ */ e("span", { className: "bb-chip", title: "Detected BMAD version", children: M === "none" ? "no BMAD" : M }),
      /* @__PURE__ */ e("button", { className: "bb-btn", onClick: () => {
        $(!0);
      }, title: "Reload from files", children: "↻" }),
      /* @__PURE__ */ e("button", { className: "bb-btn", onClick: () => Z(!0), title: "Settings", children: "⚙" })
    ] }),
    a?.banners.map((t) => /* @__PURE__ */ c("div", { className: `bb-banner bb-banner-${t.kind}`, children: [
      /* @__PURE__ */ e("span", { children: t.message }),
      t.action && /* @__PURE__ */ e("button", { className: "bb-btn", onClick: () => ye(t.action.promptSetting, t.action.label), children: t.action.label })
    ] }, t.id)),
    f && /* @__PURE__ */ e("div", { className: "bb-banner bb-banner-error", children: f }),
    /* @__PURE__ */ c("div", { className: "bb-body", children: [
      /* @__PURE__ */ c("main", { className: "bb-main", children: [
        !a && !f && /* @__PURE__ */ e("div", { className: "bb-empty", children: "Loading…" }),
        a && !_ && C === "backlog" && /* @__PURE__ */ e(
          Ee,
          {
            epics: a.epics.filter((t) => !o || t.id === o),
            stories: ne,
            sessions: a.sessions,
            selectedId: S,
            collapsed: z,
            onToggle: re,
            onSelect: u,
            onStoryMenu: oe,
            onEpicMenu: ce
          }
        ),
        a && !_ && C === "board" && /* @__PURE__ */ e(
          Ie,
          {
            columns: Y,
            epics: a.epics,
            stories: ne,
            sessions: a.sessions,
            selectedId: S,
            collapsed: z,
            onToggle: re,
            onSelect: u,
            onMove: se,
            onStoryMenu: oe,
            onEpicMenu: ce
          }
        ),
        _ && /* @__PURE__ */ e("div", { className: "bb-empty", children: "Nothing to show yet. Use the banner above to start planning." })
      ] }),
      !U && !_ && /* @__PURE__ */ e("aside", { className: "bb-aside", children: /* @__PURE__ */ e(
        Le,
        {
          host: n,
          client: i,
          story: x,
          epic: x ? B.get(x.epicId) ?? null : null,
          sessions: Se,
          initiative: N,
          rev: a?.rev ?? ""
        }
      ) })
    ] }),
    ee && /* @__PURE__ */ e("div", { className: "bb-toast", role: "status", children: ee }),
    P && /* @__PURE__ */ e(Re, { x: P.x, y: P.y, title: P.title, items: P.items, onClose: () => K(null) }),
    J && /* @__PURE__ */ e(Ae, { spec: J, onClose: () => Q(null) }),
    Ne && /* @__PURE__ */ e(Pe, { settings: s, version: M, onSave: O, onClose: () => Z(!1) })
  ] });
}
const Ye = {
  board: { component: Ke }
};
async function qe() {
}
async function He() {
}
export {
  Ke as BoardPanel,
  qe as activate,
  He as deactivate,
  Ye as panels
};
//# sourceMappingURL=index.js.map
