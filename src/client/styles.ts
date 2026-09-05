/** Inject shared Netx Ops card styles once. */

const STYLE_ID = 'dsh-netxops-card-css'

const CSS = `
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
`

export function ensureStyles(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID)) return
  const tag = document.createElement('style')
  tag.id = STYLE_ID
  tag.textContent = CSS
  document.head.appendChild(tag)
}
