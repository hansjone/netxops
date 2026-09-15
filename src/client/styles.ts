/** Inject shared Netx Ops settings-section styles once (uds-auth visual language). */

const STYLE_ID = 'dsh-netxops-settings-css'

const CSS = `
.dsh-nx-settings{box-sizing:border-box;display:flex;flex-direction:column;gap:20px;min-height:0;padding:4px 4px 24px;color:var(--dsw-alias-label-primary,#1f2329)}
.dsh-nx-settings>header{display:flex;flex-direction:column;gap:4px}
.dsh-nx-settings h2{margin:0;font-size:20px;font-weight:600;line-height:28px}
.dsh-nx-settings-intro{margin:0;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-secondary,#646a73)}
.dsh-nx-settings-card{border:1px solid var(--dsw-alias-border-l2,#dee0e3);border-radius:12px;padding:16px;background:var(--dsw-alias-bg-layer-1,transparent)}
.dsh-nx-settings-card h3{margin:0 0 12px;font-size:15px;font-weight:600;line-height:22px}
.dsh-nx-settings-field{display:flex;flex-direction:column;gap:4px;margin-bottom:12px}
.dsh-nx-settings-field:last-child{margin-bottom:0}
.dsh-nx-settings-field>label,.dsh-nx-field-label{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#646a73)}
.dsh-nx-field-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
.dsh-nx-field-head>label,.dsh-nx-field-head>.dsh-nx-field-label{flex:1;min-width:0}
.dsh-nx-settings-field input[type=text],
.dsh-nx-settings-field input[type=password],
.dsh-nx-settings-field input:not([type]),
.dsh-nx-settings-field select{
  box-sizing:border-box;width:100%;padding:8px 10px;border:1px solid var(--dsw-alias-border-l2,#dfe1e5);border-radius:6px;font:inherit;font-size:13px;line-height:20px;background:var(--dsw-alias-bg-module-platform,#f4f5f7);color:inherit
}
.dsh-nx-settings-field input:focus-visible,
.dsh-nx-settings-field select:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#3370ff);outline-offset:1px}
.dsh-nx-settings-field input:disabled,
.dsh-nx-settings-field select:disabled{opacity:.55;cursor:default}
.dsh-nx-inputInvalid{border-color:var(--dsw-alias-state-error-primary,#d54941)!important}
.dsh-nx-hint{margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary,#8f959e)}
.dsh-nx-invalid{margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-state-error-primary,#d54941)}
.dsh-nx-badges{display:inline-flex;align-items:center;gap:8px;flex:none}
.dsh-nx-badge{border-radius:999px;padding:1px 8px;font-size:11px;line-height:17px;white-space:nowrap;font-weight:500;background:var(--dsw-alias-bg-module-platform,#f4f5f7);color:var(--dsw-alias-label-secondary,#646a73)}
.dsh-nx-badgeMuted{border-radius:999px;padding:1px 8px;font-size:11px;line-height:17px;white-space:nowrap;color:var(--dsw-alias-label-tertiary,#8f959e)}
.dsh-nx-status{border-radius:999px;padding:1px 8px;font-size:11px;line-height:17px;font-weight:500;white-space:nowrap;background:var(--dsw-alias-bg-module-platform,#f4f5f7);color:var(--dsw-alias-label-tertiary,#8f959e)}
.dsh-nx-statusOk{color:var(--dsw-alias-state-success-primary,#20a162);background:rgba(32,161,98,.12)}
.dsh-nx-statusWarn{color:var(--dsw-alias-state-warn-primary,#d97706);background:rgba(217,119,6,.12)}
.dsh-nx-statusErr{color:var(--dsw-alias-state-error-primary,#d54941);background:rgba(213,73,65,.12)}
.dsh-nx-reset{border:none;background:none;padding:0;font:inherit;font-size:12px;line-height:1.5;color:var(--dsw-alias-state-business-primary,#3370ff);cursor:pointer}
.dsh-nx-reset:hover:not(:disabled){opacity:.85}
.dsh-nx-reset:disabled{opacity:.4;cursor:default}
.dsh-nx-checkRow{display:flex;align-items:flex-start;gap:10px;margin:0;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-primary,#1f2329);cursor:pointer}
.dsh-nx-checkRow input{margin-top:3px;flex:none}
.dsh-nx-groupBlock{display:flex;flex-direction:column;gap:8px;padding:4px 0 8px}
.dsh-nx-groupBlock+.dsh-nx-groupBlock{border-top:1px solid var(--dsw-alias-border-l1,#eef0f3);padding-top:12px}
.dsh-nx-groupTitle{font-size:13px;font-weight:600;line-height:1.5;color:var(--dsw-alias-label-primary,#1f2329)}
.dsh-nx-groupChecks{display:flex;flex-direction:column;gap:8px;padding-left:2px}
.dsh-nx-imTargetList{display:flex;flex-direction:column;gap:8px;padding:4px 0 2px}
.dsh-nx-pathRow{display:flex;gap:8px;align-items:stretch}
.dsh-nx-pathRow>input{flex:1;min-width:0}
.dsh-nx-pathRow>.dsh-nx-btn{flex:none;align-self:stretch}
.dsh-nx-settings-msg{font-size:12px;color:var(--dsw-alias-label-secondary,#646a73)}
.dsh-nx-settings-msg.ok{color:var(--dsw-alias-state-success-primary,#20a162)}
.dsh-nx-settings-msg.err{color:var(--dsw-alias-state-error-primary,#d54941)}
.dsh-nx-settings-empty{padding:24px;text-align:center;color:var(--dsw-alias-label-tertiary,#8f959e);font-size:13px}
.dsh-nx-btn{appearance:none;display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--dsw-alias-border-l2,#dfe1e5);border-radius:4px;padding:8px 12px;font:inherit;font-size:13px;line-height:20px;cursor:pointer;background:var(--dsw-alias-bg-module-platform,#f4f5f7);color:var(--dsw-alias-label-primary,#1f2329)}
.dsh-nx-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,#f7f8fa)}
.dsh-nx-btn:disabled{opacity:.4;cursor:default}
.dsh-nx-btn-primary{background:var(--dsw-alias-state-business-primary,#3370ff);color:#fff;border-color:transparent}
.dsh-nx-btn-primary:hover:not(:disabled){opacity:.9;background:var(--dsw-alias-state-business-primary,#3370ff)}
.dsh-nx-btn-ghost{background:transparent}
`

export function ensureStyles(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID)) return
  const tag = document.createElement('style')
  tag.id = STYLE_ID
  tag.textContent = CSS
  document.head.appendChild(tag)
}
