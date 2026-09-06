window.__ModuleLoader__.load({
  id: "dsh-netxops",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __hasOwnProp = Object.prototype.hasOwnProperty;
function __accessProp(key) {
  return this[key];
}
var __toCommonJS = (from) => {
  var entry = (__moduleCache ??= new WeakMap).get(from), desc;
  if (entry)
    return entry;
  entry = __defProp({}, "__esModule", { value: true });
  if (from && typeof from === "object" || typeof from === "function") {
    for (var key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(entry, key))
        __defProp(entry, key, {
          get: __accessProp.bind(from, key),
          enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
        });
  }
  __moduleCache.set(from, entry);
  return entry;
};
var __moduleCache;
var __returnValue = (v) => v;
function __exportSetter(name, newValue) {
  this[name] = __returnValue.bind(null, newValue);
}
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: __exportSetter.bind(all, name)
    });
};

// src/client/index.ts
var exports_client = {};
__export(exports_client, {
  inject: () => inject,
  apply: () => apply
});
module.exports = __toCommonJS(exports_client);

// src/client/NetxopsCard.tsx
var import_react = require("react");

// src/client/alarm-push-status-view.ts
var NETXOPS_RPC_CHANNEL = "/netxops";
var ALARM_PUSH_STATUS_ENDPOINT = "alarm-push.status";
var EMPTY = {
  phase: "disabled",
  enabled: false,
  wsUrl: "",
  detail: "",
  updatedAt: 0,
  lastConnectedAt: null,
  lastError: null
};
function asAlarmPushStatus(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return { ...EMPTY };
  const row = value;
  const phase = typeof row.phase === "string" ? row.phase : "disabled";
  return {
    phase,
    enabled: row.enabled === true,
    wsUrl: typeof row.wsUrl === "string" ? row.wsUrl : "",
    detail: typeof row.detail === "string" ? row.detail : "",
    updatedAt: typeof row.updatedAt === "number" ? row.updatedAt : 0,
    lastConnectedAt: typeof row.lastConnectedAt === "number" ? row.lastConnectedAt : null,
    lastError: typeof row.lastError === "string" ? row.lastError : null
  };
}
async function fetchAlarmPushStatus(call, signal) {
  const result = await call(NETXOPS_RPC_CHANNEL, ALARM_PUSH_STATUS_ENDPOINT, {}, signal);
  if (result !== null && typeof result === "object" && result.ok === true) {
    return asAlarmPushStatus(result.value);
  }
  if (result !== null && typeof result === "object" && result.ok === false) {
    return {
      ...EMPTY,
      phase: "error",
      enabled: true,
      detail: "rpc_error",
      lastError: String(result.error?.message ?? "rpc failed")
    };
  }
  return asAlarmPushStatus(result);
}
function alarmPushTone(phase) {
  switch (phase) {
    case "connected":
      return "ok";
    case "connecting":
    case "authenticating":
    case "reconnecting":
      return "warn";
    case "auth_failed":
    case "error":
      return "err";
    default:
      return "mute";
  }
}

// src/client/im-delivery-catalog.ts
var IM_DELIVERY_CATALOG_ENDPOINT = "im-delivery.catalog";
var EMPTY_IM_DELIVERY_CATALOG = {
  available: true,
  options: [],
  hint: "",
  loading: false
};
function asImDeliveryCatalog(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { ...EMPTY_IM_DELIVERY_CATALOG, available: false };
  }
  const row = value;
  const raw = Array.isArray(row.options) ? row.options : [];
  const options = [];
  for (const entry of raw) {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry))
      continue;
    const item = entry;
    const botId = typeof item.botId === "string" ? item.botId.trim() : "";
    const targetId = typeof item.targetId === "string" ? item.targetId.trim() : "";
    if (!botId || !targetId)
      continue;
    options.push({
      botId,
      targetId,
      name: typeof item.name === "string" && item.name.trim() ? item.name.trim() : targetId,
      kind: typeof item.kind === "string" ? item.kind : "",
      channel: typeof item.channel === "string" ? item.channel : "im"
    });
  }
  return {
    available: row.available !== false,
    options,
    hint: typeof row.hint === "string" ? row.hint : "",
    loading: false
  };
}
async function fetchImDeliveryCatalog(call, signal) {
  const result = await call(NETXOPS_RPC_CHANNEL, IM_DELIVERY_CATALOG_ENDPOINT, {}, signal);
  if (result !== null && typeof result === "object" && result.ok === true) {
    return asImDeliveryCatalog(result.value);
  }
  if (result !== null && typeof result === "object" && result.ok === false) {
    return {
      ...EMPTY_IM_DELIVERY_CATALOG,
      available: false,
      hint: String(result.error?.message ?? "rpc failed")
    };
  }
  return asImDeliveryCatalog(result);
}
function imCatalogOptionKey(botId, targetId) {
  return `${botId}::${targetId}`;
}

// src/netx/im-targets.ts
function imTargetKey(botId, targetId) {
  return `${botId}::${targetId}`;
}
function normalizeImTarget(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input))
    return null;
  const row = input;
  const botId = typeof row.botId === "string" ? row.botId.trim() : "";
  const targetId = typeof row.targetId === "string" ? row.targetId.trim() : "";
  if (!botId || !targetId)
    return null;
  return { botId, targetId };
}
function parseImTargetsJson(text) {
  const trimmed = text.trim();
  if (!trimmed)
    return [];
  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed))
    return [];
  const out = [];
  const seen = new Set;
  for (const entry of parsed) {
    const target = normalizeImTarget(entry);
    if (!target)
      continue;
    const key = imTargetKey(target.botId, target.targetId);
    if (seen.has(key))
      continue;
    seen.add(key);
    out.push(target);
  }
  return out;
}
function formatImTargetsJson(targets) {
  const seen = new Set;
  const rows = [];
  for (const entry of targets) {
    const target = normalizeImTarget(entry);
    if (!target)
      continue;
    const key = imTargetKey(target.botId, target.targetId);
    if (seen.has(key))
      continue;
    seen.add(key);
    rows.push(target);
  }
  return rows.length === 0 ? "" : JSON.stringify(rows);
}
function resolveImTargets(settings) {
  const fromList = parseImTargetsJson(typeof settings.imTargets === "string" ? settings.imTargets : "");
  if (fromList.length > 0)
    return fromList;
  const legacy = normalizeImTarget({
    botId: settings.imBotId,
    targetId: settings.imTargetId
  });
  return legacy ? [legacy] : [];
}
function setImTargetSelected(current, target, selected) {
  const key = imTargetKey(target.botId, target.targetId);
  const without = current.filter((row) => imTargetKey(row.botId, row.targetId) !== key);
  if (!selected)
    return without;
  const normalized = normalizeImTarget(target);
  return normalized ? [...without, normalized] : without;
}

// src/client/styles.ts
var STYLE_ID = "dsh-netxops-card-css";
var CSS = `
.dsh-nx-card{list-style:none;border:.5px solid var(--dsw-alias-border-l4);border-radius:16px;background:var(--dsw-alias-bg-layer-3);transition:border-color .16s,background .16s}
.dsh-nx-card:hover{border-color:var(--dsw-alias-label-dimmed)}
.dsh-nx-cardOpen{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-label-dimmed)}
.dsh-nx-header{width:100%;appearance:none;border:0;background:none;font:inherit;color:inherit;text-align:left;cursor:pointer;display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:12px}
.dsh-nx-header:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.dsh-nx-headText{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
.dsh-nx-name{font-size:15px;font-weight:600;line-height:1.4;color:var(--dsw-alias-label-primary)}
.dsh-nx-desc{font-size:13px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}
.dsh-nx-pending{flex:none;border-radius:999px;padding:1px 8px;font-size:11px;line-height:17px;font-weight:500;white-space:nowrap;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary)}
.dsh-nx-status{flex:none;border-radius:999px;padding:1px 8px;font-size:11px;line-height:17px;font-weight:500;white-space:nowrap;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-tertiary)}
.dsh-nx-statusOk{color:var(--dsw-alias-label-primary);background:color-mix(in srgb, var(--dsw-alias-label-primary) 12%, transparent)}
.dsh-nx-statusWarn{color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-module-platform)}
.dsh-nx-statusErr{color:var(--dsw-alias-label-error);background:color-mix(in srgb, var(--dsw-alias-label-error) 12%, transparent)}
.dsh-nx-chevron{flex:none;color:var(--dsw-alias-label-tertiary);transition:transform .16s}
.dsh-nx-chevronOpen{transform:rotate(180deg)}
.dsh-nx-body{border-top:.5px solid var(--dsw-alias-border-l2);margin:0 16px;padding-bottom:8px}
.dsh-nx-readOnly{margin:12px 0 0;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}
.dsh-nx-field{display:flex;flex-direction:column;gap:6px;padding:12px 0}
.dsh-nx-field+.dsh-nx-field{border-top:.5px solid var(--dsw-alias-border-l2)}
.dsh-nx-fieldHead{display:flex;align-items:center;gap:8px}
.dsh-nx-label{flex:1;min-width:0;font-size:13px;font-weight:500;line-height:1.5;color:var(--dsw-alias-label-primary)}
.dsh-nx-badges{display:inline-flex;align-items:center;gap:8px}
.dsh-nx-badge{border-radius:999px;padding:1px 8px;font-size:11px;line-height:17px;white-space:nowrap;font-weight:500;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary)}
.dsh-nx-badgeMuted{border-radius:999px;padding:1px 8px;font-size:11px;line-height:17px;white-space:nowrap;color:var(--dsw-alias-label-tertiary)}
.dsh-nx-reset{border:none;background:none;padding:0;font:inherit;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-secondary);cursor:pointer}
.dsh-nx-reset:hover:not(:disabled){color:var(--dsw-alias-label-primary)}
.dsh-nx-input{height:34px;padding:0 12px;border:.5px solid var(--dsw-alias-border-l4);border-radius:8px;background:var(--dsw-alias-bg-layer-3);font:inherit;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-primary)}
.dsh-nx-select{appearance:auto;cursor:pointer}
.dsh-nx-input:focus-visible{outline:none;border-color:var(--dsw-alias-brand-primary)}
.dsh-nx-inputInvalid{border-color:var(--dsw-alias-label-error)}
.dsh-nx-hint{margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}
.dsh-nx-checkRow{display:flex;align-items:flex-start;gap:10px;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-secondary);cursor:pointer}
.dsh-nx-checkRow input{margin-top:2px;flex:none}
.dsh-nx-groupBlock{display:flex;flex-direction:column;gap:8px;padding:8px 0 4px}
.dsh-nx-groupTitle{font-size:12px;font-weight:600;line-height:1.5;color:var(--dsw-alias-label-primary)}
.dsh-nx-groupChecks{display:flex;flex-direction:column;gap:6px;padding-left:2px}
.dsh-nx-imTargetList{display:flex;flex-direction:column;gap:8px;padding:4px 0 2px}
.dsh-nx-invalid{margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-error)}
.dsh-nx-exportRow{display:flex;align-items:center;gap:8px;padding-top:4px}
.dsh-nx-export{border-color:var(--dsw-alias-border-l2);background:none;color:var(--dsw-alias-label-primary)}
.dsh-nx-export:hover:not(:disabled){border-color:var(--dsw-alias-label-dimmed)}
.dsh-nx-footer{display:flex;align-items:center;justify-content:flex-end;gap:8px;padding:12px 0 4px;border-top:.5px solid var(--dsw-alias-border-l2)}
.dsh-nx-failed{flex:1;min-width:0;margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-error)}
.dsh-nx-btn{appearance:none;border:1px solid transparent;border-radius:8px;padding:5px 14px;font:inherit;font-size:13px;line-height:1.5;cursor:pointer}
.dsh-nx-discard{border-color:var(--dsw-alias-border-l2);background:none;color:var(--dsw-alias-label-secondary)}
.dsh-nx-discard:hover:not(:disabled){color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-dimmed)}
.dsh-nx-save{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}
.dsh-nx-btn:disabled{opacity:.4;cursor:default}
`;
function ensureStyles() {
  if (typeof document === "undefined")
    return;
  if (document.getElementById(STYLE_ID))
    return;
  const tag = document.createElement("style");
  tag.id = STYLE_ID;
  tag.textContent = CSS;
  document.head.appendChild(tag);
}

// src/client/NetxopsCard.tsx
var jsx_runtime = require("react/jsx-runtime");
function phaseLocaleKey(phase) {
  switch (phase) {
    case "disabled":
      return "alarmPushPhaseDisabled";
    case "idle":
      return "alarmPushPhaseIdle";
    case "connecting":
      return "alarmPushPhaseConnecting";
    case "authenticating":
      return "alarmPushPhaseAuthenticating";
    case "connected":
      return "alarmPushPhaseConnected";
    case "reconnecting":
      return "alarmPushPhaseReconnecting";
    case "auth_failed":
      return "alarmPushPhaseAuthFailed";
    case "error":
      return "alarmPushPhaseError";
    default:
      return "alarmPushPhaseDisabled";
  }
}
function StatusBadge(props) {
  const tone = alarmPushTone(props.phase);
  const className = tone === "ok" ? "dsh-nx-status dsh-nx-statusOk" : tone === "warn" ? "dsh-nx-status dsh-nx-statusWarn" : tone === "err" ? "dsh-nx-status dsh-nx-statusErr" : "dsh-nx-status";
  return /* @__PURE__ */ jsx_runtime.jsx("span", {
    className,
    children: props.label
  });
}
function ValueField(props) {
  return /* @__PURE__ */ jsx_runtime.jsxs("div", {
    className: "dsh-nx-field",
    children: [
      /* @__PURE__ */ jsx_runtime.jsxs("div", {
        className: "dsh-nx-fieldHead",
        children: [
          /* @__PURE__ */ jsx_runtime.jsx("label", {
            className: "dsh-nx-label",
            htmlFor: props.id,
            children: props.label
          }),
          props.field.overridden ? /* @__PURE__ */ jsx_runtime.jsxs("span", {
            className: "dsh-nx-badges",
            children: [
              /* @__PURE__ */ jsx_runtime.jsx("span", {
                className: "dsh-nx-badge",
                children: props.overriddenLabel
              }),
              /* @__PURE__ */ jsx_runtime.jsx("button", {
                type: "button",
                className: "dsh-nx-reset",
                disabled: props.disabled,
                onClick: props.onReset,
                children: props.resetLabel
              })
            ]
          }) : null
        ]
      }),
      /* @__PURE__ */ jsx_runtime.jsx("input", {
        id: props.id,
        className: props.field.invalid ? "dsh-nx-input dsh-nx-inputInvalid" : "dsh-nx-input",
        type: "text",
        value: props.field.text,
        disabled: props.disabled,
        "aria-invalid": props.field.invalid || undefined,
        onChange: (event) => {
          props.onEdit(event.target.value);
        }
      }),
      /* @__PURE__ */ jsx_runtime.jsx("p", {
        className: props.field.invalid ? "dsh-nx-invalid" : "dsh-nx-hint",
        children: props.field.invalid ? props.invalidLabel : props.hint
      })
    ]
  });
}
function ImDeliveryPicker(props) {
  const options = props.catalog.options;
  const selected = resolveImTargets({
    imTargets: props.targetsJson,
    imBotId: props.legacyBotId,
    imTargetId: props.legacyTargetId
  });
  const selectedKeys = new Set(selected.map((row) => imTargetKey(row.botId, row.targetId)));
  const orphanSelected = selected.filter((row) => !options.some((opt) => imCatalogOptionKey(opt.botId, opt.targetId) === imTargetKey(row.botId, row.targetId)));
  return /* @__PURE__ */ jsx_runtime.jsxs("div", {
    className: "dsh-nx-field",
    children: [
      /* @__PURE__ */ jsx_runtime.jsxs("div", {
        className: "dsh-nx-fieldHead",
        children: [
          /* @__PURE__ */ jsx_runtime.jsx("span", {
            className: "dsh-nx-label",
            children: props.labels.target
          }),
          selected.length > 0 ? /* @__PURE__ */ jsx_runtime.jsx("span", {
            className: "dsh-nx-badgeMuted",
            children: props.labels.selectedCount.replace("{count}", String(selected.length))
          }) : null
        ]
      }),
      options.length === 0 && orphanSelected.length === 0 ? /* @__PURE__ */ jsx_runtime.jsx("p", {
        className: "dsh-nx-hint",
        children: !props.catalog.available ? props.catalog.hint || props.labels.unavailable : props.labels.none
      }) : /* @__PURE__ */ jsx_runtime.jsxs("div", {
        className: "dsh-nx-imTargetList",
        children: [
          options.map((row) => {
            const key = imCatalogOptionKey(row.botId, row.targetId);
            const checked = selectedKeys.has(key);
            return /* @__PURE__ */ jsx_runtime.jsxs("label", {
              className: "dsh-nx-checkRow",
              children: [
                /* @__PURE__ */ jsx_runtime.jsx("input", {
                  type: "checkbox",
                  checked,
                  disabled: props.disabled,
                  onChange: (event) => {
                    props.onChange(setImTargetSelected(selected, { botId: row.botId, targetId: row.targetId }, event.target.checked));
                  }
                }),
                /* @__PURE__ */ jsx_runtime.jsx("span", {
                  children: `${row.name} · ${row.channel || "im"} · ${row.targetId}`
                })
              ]
            }, key);
          }),
          orphanSelected.map((row) => {
            const key = imTargetKey(row.botId, row.targetId);
            return /* @__PURE__ */ jsx_runtime.jsxs("label", {
              className: "dsh-nx-checkRow",
              children: [
                /* @__PURE__ */ jsx_runtime.jsx("input", {
                  type: "checkbox",
                  checked: true,
                  disabled: props.disabled,
                  onChange: (event) => {
                    props.onChange(setImTargetSelected(selected, row, event.target.checked));
                  }
                }),
                /* @__PURE__ */ jsx_runtime.jsx("span", {
                  children: `${row.botId} · ${row.targetId}`
                })
              ]
            }, `orphan-${key}`);
          })
        ]
      }),
      !props.catalog.available && options.length > 0 ? /* @__PURE__ */ jsx_runtime.jsx("p", {
        className: "dsh-nx-hint",
        children: props.catalog.hint || props.labels.unavailable
      }) : null
    ]
  });
}
function CapabilityGroupBlock(props) {
  return /* @__PURE__ */ jsx_runtime.jsxs("div", {
    className: "dsh-nx-groupBlock",
    children: [
      /* @__PURE__ */ jsx_runtime.jsx("div", {
        className: "dsh-nx-groupTitle",
        children: props.title
      }),
      /* @__PURE__ */ jsx_runtime.jsxs("div", {
        className: "dsh-nx-groupChecks",
        children: [
          /* @__PURE__ */ jsx_runtime.jsxs("label", {
            className: "dsh-nx-checkRow",
            children: [
              /* @__PURE__ */ jsx_runtime.jsx("input", {
                type: "checkbox",
                checked: props.inPreset.text === "true",
                disabled: props.disabled,
                onChange: (event) => {
                  props.onEditInPreset(event.target.checked);
                }
              }),
              /* @__PURE__ */ jsx_runtime.jsx("span", {
                children: props.inPresetLabel
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime.jsxs("label", {
            className: "dsh-nx-checkRow",
            children: [
              /* @__PURE__ */ jsx_runtime.jsx("input", {
                type: "checkbox",
                checked: props.published.text === "true",
                disabled: props.disabled,
                onChange: (event) => {
                  props.onEditPublic(event.target.checked);
                }
              }),
              /* @__PURE__ */ jsx_runtime.jsx("span", {
                children: props.publicLabel
              })
            ]
          })
        ]
      })
    ]
  });
}
function NetxopsCard(props) {
  ensureStyles();
  const { t } = props;
  const state = props.useNetxopsCard((snapshot) => snapshot);
  const [open, setOpen] = import_react.useState(false);
  const saveStarted = import_react.useRef(false);
  import_react.useEffect(() => {
    if (state.saving) {
      saveStarted.current = true;
      return;
    }
    if (!saveStarted.current)
      return;
    saveStarted.current = false;
    if (!state.dirty && !state.failed)
      setOpen(false);
  }, [state.dirty, state.failed, state.saving]);
  if (!state.available)
    return null;
  const title = t("title");
  const disabled = !state.writable;
  const blocked = !state.dirty || state.invalid || state.saving;
  const pushStatus = state.alarmPushStatus;
  const showHeaderStatus = pushStatus !== null && (pushStatus.enabled || pushStatus.phase !== "disabled");
  return /* @__PURE__ */ jsx_runtime.jsxs("li", {
    className: open ? "dsh-nx-card dsh-nx-cardOpen" : "dsh-nx-card",
    children: [
      /* @__PURE__ */ jsx_runtime.jsxs("button", {
        type: "button",
        className: "dsh-nx-header",
        "aria-expanded": open,
        "aria-label": `${t(open ? "collapse" : "expand")}: ${title}`,
        onClick: () => {
          setOpen(!open);
        },
        children: [
          /* @__PURE__ */ jsx_runtime.jsxs("span", {
            className: "dsh-nx-headText",
            children: [
              /* @__PURE__ */ jsx_runtime.jsx("span", {
                className: "dsh-nx-name",
                children: title
              }),
              /* @__PURE__ */ jsx_runtime.jsx("span", {
                className: "dsh-nx-desc",
                children: t("description")
              })
            ]
          }),
          showHeaderStatus && pushStatus ? /* @__PURE__ */ jsx_runtime.jsx(StatusBadge, {
            phase: pushStatus.phase,
            label: t(phaseLocaleKey(pushStatus.phase))
          }) : null,
          state.dirty ? /* @__PURE__ */ jsx_runtime.jsx("span", {
            className: "dsh-nx-pending",
            children: t("unsaved")
          }) : null,
          /* @__PURE__ */ jsx_runtime.jsx("span", {
            className: open ? "dsh-nx-chevron dsh-nx-chevronOpen" : "dsh-nx-chevron",
            "aria-hidden": true,
            children: "▾"
          })
        ]
      }),
      open ? /* @__PURE__ */ jsx_runtime.jsxs("div", {
        className: "dsh-nx-body",
        children: [
          !state.writable ? /* @__PURE__ */ jsx_runtime.jsx("p", {
            className: "dsh-nx-readOnly",
            role: "status",
            children: t("readOnly")
          }) : null,
          /* @__PURE__ */ jsx_runtime.jsxs("div", {
            className: "dsh-nx-field",
            children: [
              /* @__PURE__ */ jsx_runtime.jsxs("div", {
                className: "dsh-nx-fieldHead",
                children: [
                  /* @__PURE__ */ jsx_runtime.jsx("label", {
                    className: "dsh-nx-label",
                    htmlFor: "netxops-api-token",
                    children: t("apiToken")
                  }),
                  /* @__PURE__ */ jsx_runtime.jsx("span", {
                    className: "dsh-nx-badges",
                    children: /* @__PURE__ */ jsx_runtime.jsx("span", {
                      className: state.apiTokenConfigured ? "dsh-nx-badge" : "dsh-nx-badgeMuted",
                      children: state.apiTokenConfigured ? t("apiTokenSet") : t("apiTokenUnset")
                    })
                  })
                ]
              }),
              /* @__PURE__ */ jsx_runtime.jsx("input", {
                id: "netxops-api-token",
                className: "dsh-nx-input",
                type: "password",
                autoComplete: "off",
                value: state.apiToken.text,
                disabled: !state.apiTokenWritable,
                onChange: (event) => {
                  props.edit("apiToken", event.target.value);
                }
              }),
              /* @__PURE__ */ jsx_runtime.jsx("p", {
                className: "dsh-nx-hint",
                children: state.apiTokenRemoteReady ? t("apiTokenHint") : t("apiTokenUnavailable")
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime.jsx(ValueField, {
            id: "netxops-api-url",
            label: t("apiUrl"),
            hint: t("apiUrlHint"),
            field: state.apiUrl,
            overriddenLabel: t("overridden"),
            resetLabel: t("reset"),
            invalidLabel: t("invalid"),
            disabled,
            onEdit: (text) => {
              props.edit("apiUrl", text);
            },
            onReset: () => {
              props.resetField("apiUrl");
            }
          }),
          /* @__PURE__ */ jsx_runtime.jsx(ValueField, {
            id: "netxops-lang",
            label: t("lang"),
            hint: t("langHint"),
            field: state.lang,
            overriddenLabel: t("overridden"),
            resetLabel: t("reset"),
            invalidLabel: t("invalid"),
            disabled,
            onEdit: (text) => {
              props.edit("lang", text);
            },
            onReset: () => {
              props.resetField("lang");
            }
          }),
          /* @__PURE__ */ jsx_runtime.jsx(ValueField, {
            id: "netxops-nms-provider",
            label: t("nmsProvider"),
            hint: t("nmsProviderHint"),
            field: state.nmsProvider,
            overriddenLabel: t("overridden"),
            resetLabel: t("reset"),
            invalidLabel: t("invalid"),
            disabled,
            onEdit: (text) => {
              props.edit("nmsProvider", text);
            },
            onReset: () => {
              props.resetField("nmsProvider");
            }
          }),
          /* @__PURE__ */ jsx_runtime.jsxs("div", {
            className: "dsh-nx-field",
            children: [
              /* @__PURE__ */ jsx_runtime.jsx("div", {
                className: "dsh-nx-fieldHead",
                children: /* @__PURE__ */ jsx_runtime.jsx("span", {
                  className: "dsh-nx-label",
                  children: t("capabilityGroups")
                })
              }),
              /* @__PURE__ */ jsx_runtime.jsx(CapabilityGroupBlock, {
                title: t("groupOps"),
                inPresetLabel: t("groupInPreset"),
                publicLabel: t("groupPublic"),
                inPreset: state.groupOpsInPreset,
                published: state.groupOpsPublic,
                disabled,
                onEditInPreset: (checked) => {
                  props.edit("groupOpsInPreset", checked ? "true" : "false");
                },
                onEditPublic: (checked) => {
                  props.edit("groupOpsPublic", checked ? "true" : "false");
                }
              }),
              /* @__PURE__ */ jsx_runtime.jsx(CapabilityGroupBlock, {
                title: t("groupTopology"),
                inPresetLabel: t("groupInPreset"),
                publicLabel: t("groupPublic"),
                inPreset: state.groupTopologyInPreset,
                published: state.groupTopologyPublic,
                disabled,
                onEditInPreset: (checked) => {
                  props.edit("groupTopologyInPreset", checked ? "true" : "false");
                },
                onEditPublic: (checked) => {
                  props.edit("groupTopologyPublic", checked ? "true" : "false");
                }
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime.jsxs("div", {
            className: "dsh-nx-field",
            children: [
              /* @__PURE__ */ jsx_runtime.jsxs("div", {
                className: "dsh-nx-fieldHead",
                children: [
                  /* @__PURE__ */ jsx_runtime.jsx("label", {
                    className: "dsh-nx-label",
                    htmlFor: "netxops-alarm-push",
                    children: t("alarmPushEnabled")
                  }),
                  /* @__PURE__ */ jsx_runtime.jsxs("span", {
                    className: "dsh-nx-badges",
                    children: [
                      pushStatus ? /* @__PURE__ */ jsx_runtime.jsx(StatusBadge, {
                        phase: pushStatus.phase,
                        label: `${t("alarmPushStatus")}: ${t(phaseLocaleKey(pushStatus.phase))}`
                      }) : null,
                      state.alarmPushEnabled.overridden ? /* @__PURE__ */ jsx_runtime.jsxs(jsx_runtime.Fragment, {
                        children: [
                          /* @__PURE__ */ jsx_runtime.jsx("span", {
                            className: "dsh-nx-badge",
                            children: t("overridden")
                          }),
                          /* @__PURE__ */ jsx_runtime.jsx("button", {
                            type: "button",
                            className: "dsh-nx-reset",
                            disabled,
                            onClick: () => {
                              props.resetField("alarmPushEnabled");
                            },
                            children: t("reset")
                          })
                        ]
                      }) : null
                    ]
                  })
                ]
              }),
              /* @__PURE__ */ jsx_runtime.jsx("label", {
                className: "dsh-nx-checkRow",
                htmlFor: "netxops-alarm-push",
                children: /* @__PURE__ */ jsx_runtime.jsx("input", {
                  id: "netxops-alarm-push",
                  type: "checkbox",
                  checked: state.alarmPushEnabled.text === "true",
                  disabled,
                  "aria-label": t("alarmPushEnabled"),
                  onChange: (event) => {
                    props.edit("alarmPushEnabled", event.target.checked ? "true" : "false");
                  }
                })
              }),
              pushStatus?.wsUrl ? /* @__PURE__ */ jsx_runtime.jsx("p", {
                className: "dsh-nx-hint",
                children: pushStatus.wsUrl
              }) : null,
              pushStatus?.lastError ? /* @__PURE__ */ jsx_runtime.jsx("p", {
                className: "dsh-nx-invalid",
                role: "status",
                children: pushStatus.lastError
              }) : null
            ]
          }),
          /* @__PURE__ */ jsx_runtime.jsxs("div", {
            className: "dsh-nx-field",
            children: [
              /* @__PURE__ */ jsx_runtime.jsxs("div", {
                className: "dsh-nx-fieldHead",
                children: [
                  /* @__PURE__ */ jsx_runtime.jsx("label", {
                    className: "dsh-nx-label",
                    htmlFor: "netxops-alarm-dsh",
                    children: t("alarmDeliverDsh")
                  }),
                  state.alarmDeliverDsh.overridden ? /* @__PURE__ */ jsx_runtime.jsxs("span", {
                    className: "dsh-nx-badges",
                    children: [
                      /* @__PURE__ */ jsx_runtime.jsx("span", {
                        className: "dsh-nx-badge",
                        children: t("overridden")
                      }),
                      /* @__PURE__ */ jsx_runtime.jsx("button", {
                        type: "button",
                        className: "dsh-nx-reset",
                        disabled,
                        onClick: () => {
                          props.resetField("alarmDeliverDsh");
                        },
                        children: t("reset")
                      })
                    ]
                  }) : null
                ]
              }),
              /* @__PURE__ */ jsx_runtime.jsx("label", {
                className: "dsh-nx-checkRow",
                htmlFor: "netxops-alarm-dsh",
                children: /* @__PURE__ */ jsx_runtime.jsx("input", {
                  id: "netxops-alarm-dsh",
                  type: "checkbox",
                  checked: state.alarmDeliverDsh.text === "true",
                  disabled,
                  "aria-label": t("alarmDeliverDsh"),
                  onChange: (event) => {
                    props.edit("alarmDeliverDsh", event.target.checked ? "true" : "false");
                  }
                })
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime.jsx(ImDeliveryPicker, {
            catalog: state.imDeliveryCatalog,
            targetsJson: state.imTargets.text,
            legacyBotId: state.imBotId.text,
            legacyTargetId: state.imTargetId.text,
            disabled,
            labels: {
              target: t("alarmDeliverIm"),
              none: t("imTargetNone"),
              selectedCount: t("imTargetSelectedCount"),
              unavailable: t("imCatalogUnavailable")
            },
            onChange: (targets) => {
              props.edit("imTargets", formatImTargetsJson(targets));
              const first = targets[0];
              props.edit("imBotId", first?.botId ?? "");
              props.edit("imTargetId", first?.targetId ?? "");
              props.edit("alarmDeliverIm", targets.length > 0 ? "true" : "false");
            }
          }),
          /* @__PURE__ */ jsx_runtime.jsxs("div", {
            className: "dsh-nx-field",
            children: [
              /* @__PURE__ */ jsx_runtime.jsx("div", {
                className: "dsh-nx-fieldHead",
                children: /* @__PURE__ */ jsx_runtime.jsx("span", {
                  className: "dsh-nx-label",
                  children: t("sessionsExport")
                })
              }),
              state.sessionsExportStatus === null ? /* @__PURE__ */ jsx_runtime.jsx("p", {
                className: "dsh-nx-hint",
                children: t("sessionsExportUnavailable")
              }) : state.sessionsExportStatus.available ? /* @__PURE__ */ jsx_runtime.jsx("p", {
                className: "dsh-nx-hint",
                children: t("sessionsExportCount").replace("{count}", String(state.sessionsExportStatus.sessionCount))
              }) : /* @__PURE__ */ jsx_runtime.jsx("p", {
                className: "dsh-nx-invalid",
                role: "status",
                children: state.sessionsExportStatus.reason || t("sessionsExportUnavailable")
              }),
              state.sessionsExportError ? /* @__PURE__ */ jsx_runtime.jsx("p", {
                className: "dsh-nx-invalid",
                role: "status",
                children: state.sessionsExportError
              }) : null,
              state.sessionsExportLastFile && !state.sessionsExportBusy && !state.sessionsExportError ? /* @__PURE__ */ jsx_runtime.jsx("p", {
                className: "dsh-nx-hint",
                role: "status",
                children: t("sessionsExportDone").replace("{file}", state.sessionsExportLastFile)
              }) : null,
              /* @__PURE__ */ jsx_runtime.jsx("div", {
                className: "dsh-nx-exportRow",
                children: /* @__PURE__ */ jsx_runtime.jsx("button", {
                  type: "button",
                  className: "dsh-nx-btn dsh-nx-export",
                  disabled: state.sessionsExportBusy || state.sessionsExportStatus?.available !== true,
                  onClick: () => {
                    props.exportAllSessions();
                  },
                  children: t(state.sessionsExportBusy ? "sessionsExportBusy" : "sessionsExportButton")
                })
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime.jsxs("div", {
            className: "dsh-nx-footer",
            children: [
              state.failed ? /* @__PURE__ */ jsx_runtime.jsx("p", {
                className: "dsh-nx-failed",
                role: "status",
                children: t("saveFailed")
              }) : null,
              /* @__PURE__ */ jsx_runtime.jsx("button", {
                type: "button",
                className: "dsh-nx-btn dsh-nx-discard",
                disabled: !state.dirty || state.saving,
                onClick: props.discard,
                children: t("discard")
              }),
              /* @__PURE__ */ jsx_runtime.jsx("button", {
                type: "button",
                className: "dsh-nx-btn dsh-nx-save",
                disabled: blocked,
                onClick: props.save,
                children: t(state.saving ? "saving" : "save")
              })
            ]
          })
        ]
      }) : null
    ]
  });
}

// src/client/snapshot-store.ts
function createSnapshotStore(init) {
  let state = init;
  const listeners = new Set;
  return {
    getSnapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    set: (next) => {
      state = next;
      for (const listener of [...listeners])
        listener();
    }
  };
}

// src/client/card-form.ts
function textField(field) {
  return {
    field,
    format: (value) => typeof value === "string" ? value : "",
    parse: (text) => {
      const trimmed = text.trim();
      return trimmed === "" ? { kind: "clear" } : { kind: "set", value: trimmed };
    }
  };
}
function booleanField(field) {
  return {
    field,
    format: (value) => value === true ? "true" : "false",
    parse: (text) => {
      const normalized = text.trim().toLowerCase();
      if (normalized === "true" || normalized === "1" || normalized === "yes") {
        return { kind: "set", value: true };
      }
      if (normalized === "false" || normalized === "0" || normalized === "no" || normalized === "") {
        return { kind: "clear" };
      }
      return;
    }
  };
}
function booleanFieldPersistFalse(field) {
  return {
    field,
    format: (value) => value === true ? "true" : "false",
    parse: (text) => {
      const normalized = text.trim().toLowerCase();
      if (normalized === "true" || normalized === "1" || normalized === "yes") {
        return { kind: "set", value: true };
      }
      if (normalized === "false" || normalized === "0" || normalized === "no" || normalized === "") {
        return { kind: "set", value: false };
      }
      return;
    }
  };
}

class CardForm {
  scope;
  specs;
  secretSpecs;
  staged = new Map;
  listeners = new Set;
  saving = false;
  failed = false;
  constructor(scope, specs, secrets = []) {
    this.scope = scope;
    this.specs = new Map(specs.map((spec) => [spec.field, spec]));
    this.secretSpecs = new Map(secrets.map((spec) => [spec.field, spec]));
    scope.subscribe(() => {
      this.publish();
    });
  }
  bind(project) {
    const store = createSnapshotStore(project());
    this.listeners.add(() => {
      store.set(project());
    });
    return store;
  }
  shell() {
    const snapshot = this.scope.getSnapshot();
    const plan = this.plan();
    return {
      available: snapshot.status === "ready",
      writable: snapshot.writable,
      dirty: plan.length > 0,
      invalid: plan.some((item) => item.run === undefined),
      saving: this.saving,
      failed: this.failed
    };
  }
  field(field) {
    const staged = this.staged.get(field);
    if (this.secretSpecs.has(field)) {
      return { text: staged?.text ?? "", overridden: false, invalid: false };
    }
    const spec = this.spec(field);
    if (staged === undefined) {
      return { text: spec.format(this.sectionValue(field)), overridden: this.stored(field), invalid: false };
    }
    const write = staged.clear ? { kind: "clear" } : spec.parse(staged.text);
    return {
      text: staged.text,
      overridden: write?.kind === "set",
      invalid: write === undefined
    };
  }
  actions() {
    return {
      edit: (field, text) => {
        this.stage(field, { text, clear: false });
      },
      resetField: (field) => {
        this.stage(field, { text: this.spec(field).format(this.baseValue(field)), clear: true });
      },
      save: () => {
        this.save();
      },
      discard: () => {
        if (this.staged.size === 0 && !this.failed)
          return;
        this.staged.clear();
        this.failed = false;
        this.publish();
      }
    };
  }
  async save() {
    const plan = this.plan();
    const writes = plan.flatMap((item) => item.run === undefined ? [] : [item.run]);
    if (plan.length === 0 || this.saving || writes.length !== plan.length)
      return;
    this.saving = true;
    this.failed = false;
    this.publish();
    let landed = true;
    for (const write of writes) {
      landed = await write() && landed;
    }
    if (landed)
      this.staged.clear();
    this.saving = false;
    this.failed = !landed;
    this.publish();
  }
  plan() {
    const plan = [];
    for (const [field, staged] of this.staged) {
      const secret = this.secretSpecs.get(field);
      if (secret !== undefined) {
        const value = staged.text.trim();
        if (value !== "")
          plan.push({ field, run: () => secret.write(value) });
        continue;
      }
      const spec = this.spec(field);
      if (staged.clear) {
        if (this.stored(field))
          plan.push({ field, run: () => this.clear(field) });
        continue;
      }
      if (staged.text === spec.format(this.sectionValue(field)))
        continue;
      const write = spec.parse(staged.text);
      if (write === undefined)
        plan.push({ field, run: undefined });
      else if (write.kind === "clear")
        plan.push({ field, run: () => this.clear(field) });
      else
        plan.push({ field, run: () => this.store(field, write.value) });
    }
    return plan;
  }
  async clear(field) {
    await this.scope.unset(field);
    return !this.stored(field);
  }
  async store(field, value) {
    await this.scope.set(field, value);
    return this.userLayer()?.[field] === value;
  }
  stage(field, edit) {
    this.staged.set(field, edit);
    this.failed = false;
    this.publish();
  }
  spec(field) {
    const spec = this.specs.get(field);
    if (spec === undefined)
      throw new Error(`netxops card has no field ${field}`);
    return spec;
  }
  snapshotOf() {
    return this.scope.getSnapshot();
  }
  sectionValue(field) {
    return this.snapshotOf().value?.[field];
  }
  baseValue(field) {
    return this.snapshotOf().base?.[field];
  }
  userLayer() {
    return this.snapshotOf().user;
  }
  stored(field) {
    const user = this.userLayer();
    return user !== undefined && Object.hasOwn(user, field);
  }
  publish() {
    for (const listener of this.listeners)
      listener();
  }
}

// src/session-export-shared.ts
var NETXOPS_SESSIONS_EXPORT_PATH = "/api/netxops.sessions.export";

// src/client/sessions-export-view.ts
var SESSIONS_EXPORT_STATUS_ENDPOINT = "sessions.export.status";
var EMPTY_STATUS = {
  available: false,
  sessionCount: 0,
  supportsRawArtifacts: false,
  reason: "RPC unavailable"
};
function asSessionsExportStatus(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { ...EMPTY_STATUS };
  }
  const row = value;
  return {
    available: row.available === true,
    sessionCount: typeof row.sessionCount === "number" ? row.sessionCount : 0,
    supportsRawArtifacts: row.supportsRawArtifacts === true,
    reason: typeof row.reason === "string" ? row.reason : undefined
  };
}
async function fetchSessionsExportStatus(call, signal) {
  const result = await call(NETXOPS_RPC_CHANNEL, SESSIONS_EXPORT_STATUS_ENDPOINT, {}, signal);
  if (result !== null && typeof result === "object" && result.ok === true) {
    return asSessionsExportStatus(result.value);
  }
  if (result !== null && typeof result === "object" && result.ok === false) {
    return {
      ...EMPTY_STATUS,
      reason: String(result.error?.message ?? "rpc failed")
    };
  }
  return asSessionsExportStatus(result);
}
function hostBase() {
  const origin = globalThis.location?.origin;
  return origin !== undefined && origin !== "null" ? origin : "http://dsh.internal";
}
function saveBlobDownload(blob, filename) {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.rel = "noopener";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    globalThis.setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
    }, 60000);
  }
}
async function downloadAllSessionsExport(fetcher = fetch, save = saveBlobDownload) {
  const url = new URL(NETXOPS_SESSIONS_EXPORT_PATH, hostBase());
  const response = await fetcher(url, {
    method: "GET",
    credentials: "include"
  });
  if (!response.ok) {
    const fromHeader = response.headers.get("x-netxops-export-error") ?? "";
    const detail = fromHeader || await response.text().catch(() => "");
    throw new Error(`Export failed: HTTP ${response.status}${detail === "" ? "" : ` ${detail}`}`);
  }
  const disposition = response.headers.get("content-disposition") ?? "";
  const matched = /filename="([^"]+)"/i.exec(disposition);
  const filename = matched?.[1] && matched[1].length > 0 ? matched[1] : "dsh-sessions-export.zip";
  const countHeader = response.headers.get("x-netxops-session-count");
  const sessionCount = countHeader !== null && countHeader !== "" ? Number.parseInt(countHeader, 10) : 0;
  const blob = await response.blob();
  if (blob.size <= 0) {
    throw new Error("Export failed: empty ZIP body");
  }
  save(blob, filename);
  return {
    filename,
    sessionCount: Number.isFinite(sessionCount) ? sessionCount : 0,
    bytes: blob.size
  };
}

// src/client/controller.ts
var NETXOPS_NS = "netxops";
var DEFAULT_TOKEN_REF = "NETX_API_TOKEN";
var API_TOKEN_FIELD = "apiToken";
var STATUS_POLL_MS = 2000;

class NetxopsCardController {
  scope;
  ctx;
  form;
  store;
  credential = {
    ref: "",
    configured: false,
    writable: false,
    remoteReady: false
  };
  rpcCall;
  alarmPushStatus = null;
  imDeliveryCatalog = { ...EMPTY_IM_DELIVERY_CATALOG };
  sessionsExportStatus = null;
  sessionsExportBusy = false;
  sessionsExportError = null;
  sessionsExportLastFile = null;
  pollTimer;
  pollInFlight = false;
  catalogInFlight = false;
  exportStatusInFlight = false;
  exportInFlight;
  constructor(scope, ctx) {
    this.scope = scope;
    this.ctx = ctx;
    this.form = new CardForm(scope, [
      textField("apiUrl"),
      textField("lang"),
      textField("nmsProvider"),
      booleanFieldPersistFalse("groupOpsInPreset"),
      booleanField("groupOpsPublic"),
      booleanField("groupTopologyInPreset"),
      booleanField("groupTopologyPublic"),
      booleanField("alarmPushEnabled"),
      booleanFieldPersistFalse("alarmDeliverDsh"),
      booleanField("alarmDeliverIm"),
      textField("imTargets"),
      textField("imBotId"),
      textField("imTargetId")
    ], [{ field: API_TOKEN_FIELD, write: (text) => this.writeToken(text) }]);
    this.store = this.form.bind(() => this.projection());
    scope.subscribe(() => {
      this.readCredential();
    });
    this.readCredential();
  }
  setCredentialsAvailable(ready) {
    if (this.credential.remoteReady === ready)
      return;
    this.credential = {
      ...this.credential,
      remoteReady: ready,
      writable: ready
    };
    this.store.set(this.projection());
    if (ready)
      this.readCredential();
  }
  setAlarmPushRpc(call) {
    this.rpcCall = call;
    if (call === undefined) {
      this.stopStatusPoll();
      let changed = false;
      if (this.alarmPushStatus !== null) {
        this.alarmPushStatus = null;
        changed = true;
      }
      if (this.imDeliveryCatalog.options.length > 0 || this.imDeliveryCatalog.available !== true) {
        this.imDeliveryCatalog = { ...EMPTY_IM_DELIVERY_CATALOG };
        changed = true;
      }
      if (this.sessionsExportStatus !== null) {
        this.sessionsExportStatus = null;
        changed = true;
      }
      if (changed)
        this.store.set(this.projection());
      return;
    }
    this.startStatusPoll();
    this.refreshAlarmPushStatus();
    this.refreshImDeliveryCatalog();
    this.refreshSessionsExportStatus();
  }
  startStatusPoll() {
    if (this.pollTimer !== undefined)
      return;
    this.pollTimer = setInterval(() => {
      this.refreshAlarmPushStatus();
      this.refreshImDeliveryCatalog();
      this.refreshSessionsExportStatus();
    }, STATUS_POLL_MS);
  }
  stopStatusPoll() {
    if (this.pollTimer === undefined)
      return;
    clearInterval(this.pollTimer);
    this.pollTimer = undefined;
  }
  async refreshAlarmPushStatus() {
    const call = this.rpcCall;
    if (call === undefined || this.pollInFlight)
      return;
    this.pollInFlight = true;
    try {
      const next = await fetchAlarmPushStatus(call);
      const prev = this.alarmPushStatus;
      if (prev && prev.phase === next.phase && prev.enabled === next.enabled && prev.wsUrl === next.wsUrl && prev.detail === next.detail && prev.lastError === next.lastError && prev.lastConnectedAt === next.lastConnectedAt)
        return;
      this.alarmPushStatus = next;
      this.store.set(this.projection());
    } catch {} finally {
      this.pollInFlight = false;
    }
  }
  async refreshImDeliveryCatalog() {
    const call = this.rpcCall;
    if (call === undefined || this.catalogInFlight)
      return;
    this.catalogInFlight = true;
    try {
      const next = await fetchImDeliveryCatalog(call);
      const prev = this.imDeliveryCatalog;
      const sameOptions = prev.options.length === next.options.length && prev.options.every((row, index) => {
        const other = next.options[index];
        return other && row.botId === other.botId && row.targetId === other.targetId && row.name === other.name && row.channel === other.channel;
      });
      if (prev.available === next.available && prev.hint === next.hint && sameOptions)
        return;
      this.imDeliveryCatalog = next;
      this.store.set(this.projection());
    } catch {} finally {
      this.catalogInFlight = false;
    }
  }
  async refreshSessionsExportStatus() {
    const call = this.rpcCall;
    if (call === undefined || this.exportStatusInFlight)
      return;
    this.exportStatusInFlight = true;
    try {
      const next = await fetchSessionsExportStatus(call);
      const prev = this.sessionsExportStatus;
      if (prev && prev.available === next.available && prev.sessionCount === next.sessionCount && prev.supportsRawArtifacts === next.supportsRawArtifacts && prev.reason === next.reason)
        return;
      this.sessionsExportStatus = next;
      this.store.set(this.projection());
    } catch {} finally {
      this.exportStatusInFlight = false;
    }
  }
  exportAllSessions() {
    if (this.exportInFlight !== undefined || this.sessionsExportBusy)
      return;
    if (this.sessionsExportStatus?.available !== true)
      return;
    this.sessionsExportBusy = true;
    this.sessionsExportError = null;
    this.store.set(this.projection());
    this.exportInFlight = downloadAllSessionsExport().then((result) => {
      this.sessionsExportLastFile = result.filename;
      this.sessionsExportError = null;
    }).catch((error) => {
      this.sessionsExportError = error instanceof Error ? error.message : String(error);
    }).finally(() => {
      this.sessionsExportBusy = false;
      this.exportInFlight = undefined;
      this.store.set(this.projection());
      this.refreshSessionsExportStatus();
    });
  }
  projection() {
    return {
      ...this.form.shell(),
      apiUrl: this.form.field("apiUrl"),
      lang: this.form.field("lang"),
      nmsProvider: this.form.field("nmsProvider"),
      groupOpsInPreset: this.form.field("groupOpsInPreset"),
      groupOpsPublic: this.form.field("groupOpsPublic"),
      groupTopologyInPreset: this.form.field("groupTopologyInPreset"),
      groupTopologyPublic: this.form.field("groupTopologyPublic"),
      alarmPushEnabled: this.form.field("alarmPushEnabled"),
      alarmDeliverDsh: this.form.field("alarmDeliverDsh"),
      alarmDeliverIm: this.form.field("alarmDeliverIm"),
      imTargets: this.form.field("imTargets"),
      imBotId: this.form.field("imBotId"),
      imTargetId: this.form.field("imTargetId"),
      apiToken: this.form.field(API_TOKEN_FIELD),
      apiTokenConfigured: this.credential.configured,
      apiTokenWritable: this.credential.remoteReady && this.credential.writable,
      apiTokenRemoteReady: this.credential.remoteReady,
      alarmPushStatus: this.alarmPushStatus,
      imDeliveryCatalog: this.imDeliveryCatalog,
      sessionsExportStatus: this.sessionsExportStatus,
      sessionsExportBusy: this.sessionsExportBusy,
      sessionsExportError: this.sessionsExportError,
      sessionsExportLastFile: this.sessionsExportLastFile
    };
  }
  credentials() {
    return this.ctx.get("remote.credentials");
  }
  async readCredential() {
    const ref = refOf(this.scope.getSnapshot());
    const api = this.credentials();
    if (api === undefined) {
      if (ref !== this.credential.ref || this.credential.remoteReady) {
        this.credential = {
          ref,
          configured: false,
          writable: false,
          remoteReady: false
        };
        this.store.set(this.projection());
      }
      return;
    }
    if (ref !== this.credential.ref) {
      this.credential = { ref, configured: false, writable: true, remoteReady: true };
      this.store.set(this.projection());
    }
    const response = await api.describe([ref]);
    if (!response.ok || ref !== refOf(this.scope.getSnapshot()))
      return;
    const view = response.value?.[ref];
    const next = {
      ref,
      configured: view?.configured ?? false,
      writable: view?.writable ?? true,
      remoteReady: true
    };
    if (next.configured === this.credential.configured && next.writable === this.credential.writable && next.remoteReady === this.credential.remoteReady)
      return;
    this.credential = next;
    this.store.set(this.projection());
  }
  refreshCredential(ref) {
    if (ref !== this.credential.ref)
      return;
    this.readCredential();
  }
  inject() {
    return {
      hooks: { netxopsCard: this.store },
      ...this.form.actions(),
      exportAllSessions: () => {
        this.exportAllSessions();
      }
    };
  }
  async writeToken(value) {
    const api = this.credentials();
    if (api === undefined)
      return false;
    await api.set(refOf(this.scope.getSnapshot()), value);
    await this.readCredential();
    return this.credential.configured;
  }
}
function refOf(snapshot) {
  const declared = snapshot.value?.tokenCredentialRef;
  return declared !== undefined && declared.length > 0 ? declared : DEFAULT_TOKEN_REF;
}

// src/client/locales.ts
var en = {
  title: "Netx Ops",
  description: "API, token, capabilities, and alarm delivery.",
  apiUrl: "API URL",
  apiUrlHint: "e.g. http://127.0.0.1:8890",
  lang: "Language",
  langHint: "zh / en",
  capabilityGroups: "Capability groups",
  nmsProvider: "NMS provider",
  nmsProviderHint: "zte-ume",
  groupOps: "ops",
  groupTopology: "topology",
  groupInPreset: "In Netx Ops preset",
  groupPublic: "Publish to other presets",
  alarmPushEnabled: "Key-alarm push",
  alarmPushStatus: "Status",
  alarmPushPhaseDisabled: "Off",
  alarmPushPhaseIdle: "Idle",
  alarmPushPhaseConnecting: "Connecting…",
  alarmPushPhaseAuthenticating: "Authenticating…",
  alarmPushPhaseConnected: "Connected",
  alarmPushPhaseReconnecting: "Reconnecting…",
  alarmPushPhaseAuthFailed: "Auth failed",
  alarmPushPhaseError: "Error",
  alarmDeliverDsh: "Deliver to DSH session",
  alarmDeliverIm: "Deliver to WhatsApp / IM",
  imTargetNone: "No delivery targets yet — create one in IM delivery settings.",
  imTargetSelectedCount: "{count} selected",
  imCatalogUnavailable: "Cannot load IM targets (install/update dsh-im-ops).",
  apiToken: "API token",
  apiTokenHint: "Stored as NETX_API_TOKEN. Leave blank to keep current.",
  apiTokenUnavailable: "remote.credentials unavailable — set NETX_API_TOKEN via script.",
  apiTokenSet: "Configured",
  apiTokenUnset: "Not set",
  sessionsExport: "Export all sessions",
  sessionsExportCount: "{count} sessions",
  sessionsExportUnavailable: "Export unavailable",
  sessionsExportButton: "Download ZIP",
  sessionsExportBusy: "Preparing…",
  sessionsExportDone: "Downloaded: {file}",
  overridden: "Overridden",
  reset: "Reset",
  invalid: "Invalid",
  expand: "Expand",
  collapse: "Collapse",
  unsaved: "Unsaved",
  readOnly: "Read-only",
  saveFailed: "Save failed",
  discard: "Discard",
  save: "Save",
  saving: "Saving…"
};
var zh = {
  title: "Netx Ops",
  description: "API、Token、能力组与告警投递。",
  apiUrl: "API 地址",
  apiUrlHint: "例如 http://127.0.0.1:8890",
  lang: "语言",
  langHint: "zh / en",
  capabilityGroups: "能力组",
  nmsProvider: "NMS provider",
  nmsProviderHint: "zte-ume",
  groupOps: "ops",
  groupTopology: "topology",
  groupInPreset: "在 Netx Ops 预设中启用",
  groupPublic: "对其他预设公开",
  alarmPushEnabled: "关键告警推送",
  alarmPushStatus: "状态",
  alarmPushPhaseDisabled: "未开启",
  alarmPushPhaseIdle: "空闲",
  alarmPushPhaseConnecting: "连接中…",
  alarmPushPhaseAuthenticating: "鉴权中…",
  alarmPushPhaseConnected: "已连接",
  alarmPushPhaseReconnecting: "重连中…",
  alarmPushPhaseAuthFailed: "鉴权失败",
  alarmPushPhaseError: "异常",
  alarmDeliverDsh: "投递到 DSH 会话",
  alarmDeliverIm: "投递到 WhatsApp / IM",
  imTargetNone: "暂无投递目标 — 请先在 IM「投递设置」新建。",
  imTargetSelectedCount: "已选 {count} 个",
  imCatalogUnavailable: "无法加载投递目标（请安装/更新 dsh-im-ops）。",
  apiToken: "API Token",
  apiTokenHint: "写入凭据 NETX_API_TOKEN；留空表示保留已有。",
  apiTokenUnavailable: "未提供 remote.credentials — 请用脚本写入 NETX_API_TOKEN。",
  apiTokenSet: "已配置",
  apiTokenUnset: "未设置",
  sessionsExport: "导出全部会话",
  sessionsExportCount: "{count} 个会话",
  sessionsExportUnavailable: "无法导出",
  sessionsExportButton: "下载 ZIP",
  sessionsExportBusy: "准备中…",
  sessionsExportDone: "已下载：{file}",
  overridden: "已覆盖",
  reset: "重置",
  invalid: "无效",
  expand: "展开",
  collapse: "收起",
  unsaved: "未保存",
  readOnly: "只读",
  saveFailed: "保存失败",
  discard: "丢弃",
  save: "保存",
  saving: "保存中…"
};

// src/client/index.ts
var LOCALE_NS = "settings.netxops";
var inject = [
  "slots",
  "locale",
  "remote",
  "settingsScope"
];
function apply(ctx) {
  ctx.effect(() => ctx.locale.register(LOCALE_NS, { zh, en }), "netxops: locales");
  const card = new NetxopsCardController(ctx.settingsScope.bind({ namespace: NETXOPS_NS }), ctx);
  ctx.inject(["remote.credentials"], (credCtx) => {
    card.setCredentialsAvailable(true);
    credCtx.effect(() => {
      const off = credCtx.remote.$on("credentials/reference-updated", (ref) => {
        card.refreshCredential(String(ref));
      });
      return () => {
        off();
        card.setCredentialsAvailable(false);
      };
    }, "netxops: credential invalidations");
  });
  ctx.inject(["connection"], (connCtx) => {
    const call = connCtx.connection?.rpc?.call?.bind(connCtx.connection.rpc);
    if (typeof call !== "function") {
      connCtx.logger.warn("netxops: connection.rpc.call unavailable — alarm status UI disabled");
      return;
    }
    card.setAlarmPushRpc(call);
    connCtx.effect(() => () => {
      card.setAlarmPushRpc(undefined);
    }, "netxops: clear alarm-push rpc");
  });
  ctx.slots.inject("settings.plugin.item", () => ctx.slots.register({
    name: "settings.plugin.item",
    key: NETXOPS_NS,
    locale: LOCALE_NS,
    inject: () => card.inject()
  }, NetxopsCard));
}

    return module.exports;
  }
});
