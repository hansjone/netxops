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
.dsh-nx-input:focus-visible{outline:none;border-color:var(--dsw-alias-brand-primary)}
.dsh-nx-inputInvalid{border-color:var(--dsw-alias-label-error)}
.dsh-nx-hint{margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}
.dsh-nx-checkRow{display:flex;align-items:flex-start;gap:10px;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-secondary);cursor:pointer}
.dsh-nx-checkRow input{margin-top:2px;flex:none}
.dsh-nx-invalid{margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-error)}
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
              /* @__PURE__ */ jsx_runtime.jsxs("label", {
                className: "dsh-nx-checkRow",
                htmlFor: "netxops-alarm-push",
                children: [
                  /* @__PURE__ */ jsx_runtime.jsx("input", {
                    id: "netxops-alarm-push",
                    type: "checkbox",
                    checked: state.alarmPushEnabled.text === "true",
                    disabled,
                    onChange: (event) => {
                      props.edit("alarmPushEnabled", event.target.checked ? "true" : "false");
                    }
                  }),
                  /* @__PURE__ */ jsx_runtime.jsx("span", {
                    children: t("alarmPushEnabledHint")
                  })
                ]
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
              /* @__PURE__ */ jsx_runtime.jsxs("label", {
                className: "dsh-nx-checkRow",
                htmlFor: "netxops-alarm-dsh",
                children: [
                  /* @__PURE__ */ jsx_runtime.jsx("input", {
                    id: "netxops-alarm-dsh",
                    type: "checkbox",
                    checked: state.alarmDeliverDsh.text === "true",
                    disabled,
                    onChange: (event) => {
                      props.edit("alarmDeliverDsh", event.target.checked ? "true" : "false");
                    }
                  }),
                  /* @__PURE__ */ jsx_runtime.jsx("span", {
                    children: t("alarmDeliverDshHint")
                  })
                ]
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
                    htmlFor: "netxops-alarm-im",
                    children: t("alarmDeliverIm")
                  }),
                  state.alarmDeliverIm.overridden ? /* @__PURE__ */ jsx_runtime.jsxs("span", {
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
                          props.resetField("alarmDeliverIm");
                        },
                        children: t("reset")
                      })
                    ]
                  }) : null
                ]
              }),
              /* @__PURE__ */ jsx_runtime.jsxs("label", {
                className: "dsh-nx-checkRow",
                htmlFor: "netxops-alarm-im",
                children: [
                  /* @__PURE__ */ jsx_runtime.jsx("input", {
                    id: "netxops-alarm-im",
                    type: "checkbox",
                    checked: state.alarmDeliverIm.text === "true",
                    disabled,
                    onChange: (event) => {
                      props.edit("alarmDeliverIm", event.target.checked ? "true" : "false");
                    }
                  }),
                  /* @__PURE__ */ jsx_runtime.jsx("span", {
                    children: t("alarmDeliverImHint")
                  })
                ]
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime.jsx(ValueField, {
            id: "netxops-im-bot-id",
            label: t("imBotId"),
            hint: t("imBotIdHint"),
            field: state.imBotId,
            overriddenLabel: t("overridden"),
            resetLabel: t("reset"),
            invalidLabel: t("invalid"),
            disabled,
            onEdit: (text) => {
              props.edit("imBotId", text);
            },
            onReset: () => {
              props.resetField("imBotId");
            }
          }),
          /* @__PURE__ */ jsx_runtime.jsx(ValueField, {
            id: "netxops-im-target-id",
            label: t("imTargetId"),
            hint: t("imTargetIdHint"),
            field: state.imTargetId,
            overriddenLabel: t("overridden"),
            resetLabel: t("reset"),
            invalidLabel: t("invalid"),
            disabled,
            onEdit: (text) => {
              props.edit("imTargetId", text);
            },
            onReset: () => {
              props.resetField("imTargetId");
            }
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
  pollTimer;
  pollInFlight = false;
  constructor(scope, ctx) {
    this.scope = scope;
    this.ctx = ctx;
    this.form = new CardForm(scope, [
      textField("apiUrl"),
      textField("lang"),
      booleanField("alarmPushEnabled"),
      booleanFieldPersistFalse("alarmDeliverDsh"),
      booleanField("alarmDeliverIm"),
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
      if (this.alarmPushStatus !== null) {
        this.alarmPushStatus = null;
        this.store.set(this.projection());
      }
      return;
    }
    this.startStatusPoll();
    this.refreshAlarmPushStatus();
  }
  startStatusPoll() {
    if (this.pollTimer !== undefined)
      return;
    this.pollTimer = setInterval(() => {
      this.refreshAlarmPushStatus();
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
  projection() {
    return {
      ...this.form.shell(),
      apiUrl: this.form.field("apiUrl"),
      lang: this.form.field("lang"),
      alarmPushEnabled: this.form.field("alarmPushEnabled"),
      alarmDeliverDsh: this.form.field("alarmDeliverDsh"),
      alarmDeliverIm: this.form.field("alarmDeliverIm"),
      imBotId: this.form.field("imBotId"),
      imTargetId: this.form.field("imTargetId"),
      apiToken: this.form.field(API_TOKEN_FIELD),
      apiTokenConfigured: this.credential.configured,
      apiTokenWritable: this.credential.remoteReady && this.credential.writable,
      apiTokenRemoteReady: this.credential.remoteReady,
      alarmPushStatus: this.alarmPushStatus
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
    return { hooks: { netxopsCard: this.store }, ...this.form.actions() };
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
  description: "UME API endpoint and bearer token for netx__* tools.",
  apiUrl: "API URL",
  apiUrlHint: "netx REST root, e.g. http://127.0.0.1:8890 (also used for alarm subscribe)",
  lang: "Language",
  langHint: "Response language hint (zh / en).",
  alarmPushEnabled: "Key-alarm push",
  alarmPushEnabledHint: "Dial out to netx when a matched key alarm arrives. Choose DSH and/or IM sinks below.",
  alarmPushStatus: "Push link",
  alarmPushPhaseDisabled: "Off",
  alarmPushPhaseIdle: "Idle",
  alarmPushPhaseConnecting: "Connecting…",
  alarmPushPhaseAuthenticating: "Authenticating…",
  alarmPushPhaseConnected: "Connected",
  alarmPushPhaseReconnecting: "Reconnecting…",
  alarmPushPhaseAuthFailed: "Auth failed",
  alarmPushPhaseError: "Error",
  alarmDeliverDsh: "Deliver to DSH session",
  alarmDeliverDshHint: "Open/follow the sticky「Netx 关键告警」session on this Host.",
  alarmDeliverIm: "Deliver to WhatsApp / IM",
  alarmDeliverImHint: "Requires dsh-im-ops. Paste botId + targetId from IM → 投递设置 → 复制调用参数.",
  imBotId: "IM Bot ID",
  imBotIdHint: "Opaque botId from IM delivery settings (not a phone number).",
  imTargetId: "IM Target ID",
  imTargetIdHint: "Opaque targetId alias (e.g. release-alerts). Create the target in IM first.",
  apiToken: "API token",
  apiTokenHint: "Stored as credential NETX_API_TOKEN (never written into settings). Leave blank to keep the current token.",
  apiTokenUnavailable: "This DSH build does not expose remote.credentials. Set the token with scripts/set-netx-token.ps1 (or .sh), then restart is not required if credentials are watched.",
  apiTokenSet: "Configured",
  apiTokenUnset: "Not set",
  overridden: "Overridden",
  reset: "Reset",
  invalid: "Invalid value",
  expand: "Expand",
  collapse: "Collapse",
  unsaved: "Unsaved",
  readOnly: "This document is read-only.",
  saveFailed: "Save failed — drafts kept for correction.",
  discard: "Discard",
  save: "Save",
  saving: "Saving…"
};
var zh = {
  title: "Netx Ops",
  description: "UME API 地址与 Bearer Token，供 netx__* 工具使用。",
  apiUrl: "API 地址",
  apiUrlHint: "netx REST 根地址，例如 http://127.0.0.1:8890（告警订阅复用同一地址）",
  lang: "语言",
  langHint: "响应语言提示（zh / en）。",
  alarmPushEnabled: "关键告警推送",
  alarmPushEnabledHint: "主动连接 netx；匹配到关键告警后按下述开关投递。可只开 DSH、只开 IM，或两者都开。",
  alarmPushStatus: "推送链路",
  alarmPushPhaseDisabled: "未开启",
  alarmPushPhaseIdle: "空闲",
  alarmPushPhaseConnecting: "连接中…",
  alarmPushPhaseAuthenticating: "鉴权中…",
  alarmPushPhaseConnected: "已连接",
  alarmPushPhaseReconnecting: "重连中…",
  alarmPushPhaseAuthFailed: "鉴权失败",
  alarmPushPhaseError: "异常",
  alarmDeliverDsh: "投递到 DSH 会话",
  alarmDeliverDshHint: "在本机打开/续写 sticky「Netx 关键告警」会话。",
  alarmDeliverIm: "投递到 WhatsApp / IM",
  alarmDeliverImHint: "需要已安装 dsh-im-ops。请先在 IM「投递设置」新建目标，再粘贴「复制调用参数」里的 botId / targetId。",
  imBotId: "IM Bot ID",
  imBotIdHint: "来自 IM 投递设置的不透明 botId（不是手机号）。",
  imTargetId: "IM Target ID",
  imTargetIdHint: "投递目标别名（如 release-alerts）。请先在 IM 侧创建目标。",
  apiToken: "API Token",
  apiTokenHint: "写入凭据 NETX_API_TOKEN（不会进 settings）。留空表示保留已有 token。",
  apiTokenUnavailable: "当前 DSH 未提供 remote.credentials。请用 scripts/set-netx-token.ps1（或 .sh）写入 token；若 harness 在监视凭据文件则无需重启。",
  apiTokenSet: "已配置",
  apiTokenUnset: "未设置",
  overridden: "已覆盖",
  reset: "重置",
  invalid: "无效值",
  expand: "展开",
  collapse: "收起",
  unsaved: "未保存",
  readOnly: "当前文档只读。",
  saveFailed: "保存失败，草稿已保留以便修改。",
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
