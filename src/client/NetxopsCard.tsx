/** Netx Ops settings: connection, publication, knowledge and delivery. */

import type { ReactNode } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { NetxopsCardFace, NetxopsCardState } from './controller.ts'
import type { NetxopsLocaleKey } from './locales.ts'
import type { CardFieldState } from './card-form.ts'
import {
  imCatalogOptionKey,
  type ImDeliveryCatalog,
} from './im-delivery-catalog.ts'
import {
  formatImTargetsJson,
  imTargetKey,
  resolveImTargets,
  setImTargetSelected,
  type ImDeliveryTarget,
} from '../netx/im-targets.ts'
import { alarmPushTone, type AlarmPushPhase } from './alarm-push-status-view.ts'
import { kbStatusTone, type KbSnapshot } from './kb-status-view.ts'
import { toolsMountTone, type ToolsMountView } from './tools-status-view.ts'
import { ensureStyles } from './styles.ts'
import { sessionsExportReasonLocaleKey } from './sessions-export-view.ts'
import { parsePresetIds } from '../netx/capability-groups.ts'
import { parseDisabledTools } from '../netx/mcp-catalog.ts'
import type { McpToolRow } from './mcp-catalog-view.ts'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'

function phaseLocaleKey(phase: AlarmPushPhase): NetxopsLocaleKey {
  switch (phase) {
    case 'disabled': return 'alarmPushPhaseDisabled'
    case 'idle': return 'alarmPushPhaseIdle'
    case 'connecting': return 'alarmPushPhaseConnecting'
    case 'authenticating': return 'alarmPushPhaseAuthenticating'
    case 'connected': return 'alarmPushPhaseConnected'
    case 'reconnecting': return 'alarmPushPhaseReconnecting'
    case 'auth_failed': return 'alarmPushPhaseAuthFailed'
    case 'error': return 'alarmPushPhaseError'
    default: return 'alarmPushPhaseDisabled'
  }
}

function StatusBadge(props: {
  phase?: AlarmPushPhase
  tone?: 'ok' | 'warn' | 'err' | 'neutral'
  label: string
}) {
  const tone = props.tone
    ?? (props.phase !== undefined ? alarmPushTone(props.phase) : 'neutral')
  const className = tone === 'ok'
    ? 'dsh-nx-status dsh-nx-statusOk'
    : tone === 'warn'
      ? 'dsh-nx-status dsh-nx-statusWarn'
      : tone === 'err'
        ? 'dsh-nx-status dsh-nx-statusErr'
        : 'dsh-nx-status'
  return <span className={className}>{props.label}</span>
}

function kbBadgeLabel(
  t: (key: NetxopsLocaleKey) => string,
  snapshot: KbSnapshot | null,
): string {
  if (!snapshot || snapshot.status === 'unconfigured') {
    return t('kbStatusUnconfigured')
  }
  if (snapshot.status === 'error') {
    return t('kbStatusError')
  }
  return fillTemplate(t('kbStatusConfigured'), {
    operator: snapshot.operatorName,
    country: snapshot.country,
    version: snapshot.version,
  })
}

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (
    Object.prototype.hasOwnProperty.call(vars, name) ? vars[name]! : match
  ))
}

function toolsBadgeLabel(
  t: (key: NetxopsLocaleKey) => string,
  view: ToolsMountView | null,
): string {
  if (!view) return t('toolsStatusUnknown')
  if (!view.toolsEnabled) return t('toolsDisabled')
  if (view.error || view.mcpPhase === 'error') {
    return t('toolsStatusError')
  }
  if (view.mcpPhase === 'offline' || view.mcpFromCache) {
    return t('mcpDisconnected')
  }
  if (view.count > 0) {
    return fillTemplate(t('toolsStatusMounted'), {
      count: String(view.count),
    })
  }
  return t('toolsStatusEmpty')
}

function exportStatusMessage(
  t: (key: NetxopsLocaleKey) => string,
  status: NonNullable<NetxopsCardState['sessionsExportStatus']>,
): string {
  const key = sessionsExportReasonLocaleKey(status.reasonCode)
  const template = t(key)
  if (key === 'sessionsExportListFailed') {
    return fillTemplate(template, { detail: status.reason || '' })
  }
  return status.reasonCode ? template : (status.reason || template)
}

function exportErrorMessage(
  t: (key: NetxopsLocaleKey) => string,
  error: NonNullable<NetxopsCardState['sessionsExportError']>,
): string {
  const key = sessionsExportReasonLocaleKey(error.code)
  const template = t(key)
  if (error.code === 'http_failed') {
    const detail = error.detail.trim() === '' ? '' : ` ${error.detail.trim()}`
    return fillTemplate(template, {
      status: error.status !== undefined ? String(error.status) : '',
      detail,
    })
  }
  if (error.code === 'empty_body') return template
  return error.fallback || template
}

export type NetxopsCardProps =
  (PropsRuntime<'settings.section'> | PropsRuntime<'settings.plugin.item'>)
  & PropsLocale<'settings.netxops'>
  & InjectFace<NetxopsCardFace>

function ValueField(props: {
  id: string
  label: string
  hint?: string
  field: CardFieldState
  resetLabel: string
  invalidLabel: string
  disabled: boolean
  onEdit: (text: string) => void
  onReset: () => void
}) {
  return (
    <div className="dsh-nx-settings-field">
      <div className="dsh-nx-field-head">
        <label htmlFor={props.id}>{props.label}</label>
        {props.field.overridden
          ? (
            <span className="dsh-nx-badges">
              <button type="button" className="dsh-nx-reset" disabled={props.disabled} onClick={props.onReset}>
                {props.resetLabel}
              </button>
            </span>
          )
          : null}
      </div>
      <input
        id={props.id}
        className={props.field.invalid ? 'dsh-nx-inputInvalid' : undefined}
        type="text"
        placeholder={props.hint}
        value={props.field.text}
        disabled={props.disabled}
        aria-invalid={props.field.invalid || undefined}
        onChange={(event) => { props.onEdit(event.target.value) }}
      />
      {props.field.invalid ? <p className="dsh-nx-invalid">{props.invalidLabel}</p> : null}
    </div>
  )
}

function SelectField(props: {
  id: string
  label: string
  field: CardFieldState
  options: ReadonlyArray<{ value: string, label: string }>
  resetLabel: string
  invalidLabel: string
  disabled: boolean
  onEdit: (text: string) => void
  onReset: () => void
}) {
  const known = props.options.some((row) => row.value === props.field.text)
  return (
    <div className="dsh-nx-settings-field">
      <div className="dsh-nx-field-head">
        <label htmlFor={props.id}>{props.label}</label>
        {props.field.overridden
          ? (
            <span className="dsh-nx-badges">
              <button type="button" className="dsh-nx-reset" disabled={props.disabled} onClick={props.onReset}>
                {props.resetLabel}
              </button>
            </span>
          )
          : null}
      </div>
      <select
        id={props.id}
        className={props.field.invalid ? 'dsh-nx-inputInvalid' : undefined}
        value={props.field.text}
        disabled={props.disabled}
        aria-invalid={props.field.invalid || undefined}
        onChange={(event) => { props.onEdit(event.target.value) }}
      >
        {!known && props.field.text
          ? <option value={props.field.text}>{props.field.text}</option>
          : null}
        {props.options.map((row) => (
          <option key={row.value} value={row.value}>{row.label}</option>
        ))}
      </select>
      {props.field.invalid ? <p className="dsh-nx-invalid">{props.invalidLabel}</p> : null}
    </div>
  )
}

function ImDeliveryPicker(props: {
  catalog: ImDeliveryCatalog
  targetsJson: string
  legacyBotId: string
  legacyTargetId: string
  disabled: boolean
  labels: {
    target: string
    none: string
    selectedCount: string
    unavailable: string
  }
  onChange: (targets: ImDeliveryTarget[]) => void
}) {
  const options = props.catalog.options
  const selected = resolveImTargets({
    imTargets: props.targetsJson,
    imBotId: props.legacyBotId,
    imTargetId: props.legacyTargetId,
  })
  const selectedKeys = new Set(selected.map((row) => imTargetKey(row.botId, row.targetId)))
  const orphanSelected = selected.filter(
    (row) => !options.some(
      (opt) => imCatalogOptionKey(opt.botId, opt.targetId) === imTargetKey(row.botId, row.targetId),
    ),
  )

  return (
    <div className="dsh-nx-settings-field">
      <div className="dsh-nx-field-head">
        <span className="dsh-nx-field-label">{props.labels.target}</span>
        {selected.length > 0
          ? (
            <span className="dsh-nx-badgeMuted">
              {props.labels.selectedCount.replace('{count}', String(selected.length))}
            </span>
          )
          : null}
      </div>
      {options.length === 0 && orphanSelected.length === 0
        ? (
          <p className="dsh-nx-hint">
            {!props.catalog.available
              ? (props.catalog.reasonCode
                ? props.labels.unavailable
                : (props.catalog.hint || props.labels.unavailable))
              : props.labels.none}
          </p>
        )
        : (
          <div className="dsh-nx-imTargetList">
            {options.map((row) => {
              const key = imCatalogOptionKey(row.botId, row.targetId)
              const checked = selectedKeys.has(key)
              return (
                <label key={key} className="dsh-nx-checkRow">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={props.disabled}
                    onChange={(event) => {
                      props.onChange(setImTargetSelected(
                        selected,
                        { botId: row.botId, targetId: row.targetId },
                        event.target.checked,
                      ))
                    }}
                  />
                  <span>{`${row.name} · ${row.channel || 'im'} · ${row.targetId}`}</span>
                </label>
              )
            })}
            {orphanSelected.map((row) => {
              const key = imTargetKey(row.botId, row.targetId)
              return (
                <label key={`orphan-${key}`} className="dsh-nx-checkRow">
                  <input
                    type="checkbox"
                    checked
                    disabled={props.disabled}
                    onChange={(event) => {
                      props.onChange(setImTargetSelected(selected, row, event.target.checked))
                    }}
                  />
                  <span>{`${row.botId} · ${row.targetId}`}</span>
                </label>
              )
            })}
          </div>
        )}
      {!props.catalog.available && options.length > 0
        ? (
          <p className="dsh-nx-hint">
            {props.catalog.reasonCode
              ? props.labels.unavailable
              : (props.catalog.hint || props.labels.unavailable)}
          </p>
        )
        : null}
    </div>
  )
}

function PresetTargets(props: {
  field: CardFieldState
  state: NetxopsCardState
  disabled: boolean
  onEdit: (value: string) => void
  t: (key: NetxopsLocaleKey) => string
}) {
  const selected = parsePresetIds(props.field.text)
  const rows = props.state.presetCatalog.filter(row => row.id !== 'netxops')
  const unknown = selected.filter(id => !rows.some(row => row.id === id))
  return (
    <details className="dsh-nx-targets">
      <summary>{props.t('selectedPresets')} · {selected.length}</summary>
      {props.state.presetCatalogError ? <p className="dsh-nx-invalid">{props.t('presetCatalogUnavailable')}</p> : null}
      {[...rows, ...unknown.map(id => ({ id, name: undefined, broken: undefined }))].map(row => (
        <label key={row.id} className="dsh-nx-checkRow">
          <input type="checkbox" checked={selected.includes(row.id)} disabled={props.disabled}
            onChange={event => { props.onEdit((event.target.checked
              ? [...selected, row.id] : selected.filter(id => id !== row.id)).join(',')) }} />
          <span>{row.name || row.id}{row.name && row.name !== row.id ? ` (${row.id})` : ''}</span>
          {row.broken ? <span className="dsh-nx-invalid" title={row.broken}>{props.t('presetUnavailable')}</span> : null}
        </label>
      ))}
      {rows.length === 0 && unknown.length === 0 ? <p className="dsh-nx-hint">{props.t('noOtherPresets')}</p> : null}
    </details>
  )
}

function CapabilityGroupBlock(props: {
  title: string
  toolCount?: number
  inPresetLabel: string
  publicLabel: string
  inPreset: CardFieldState
  published: CardFieldState
  disabled: boolean
  onEditInPreset: (checked: boolean) => void
  onEditPublic: (checked: boolean) => void
  targets?: ReactNode
  tools?: McpToolRow[]
  disabledTools?: ReadonlySet<string>
  writeBadge?: string
  emptyLabel?: string
  onToggleTool?: (name: string, enabled: boolean) => void
}) {
  return (
    <div className="dsh-nx-groupBlock" role="group" aria-label={props.title}>
      <div className="dsh-nx-groupTitle">
        <span>{props.title}</span>
        {props.toolCount !== undefined ? <span className="dsh-nx-badgeMuted">{props.toolCount}</span> : null}
      </div>
      <div className="dsh-nx-groupChecks">
        <label className="dsh-nx-checkRow">
          <input
            type="checkbox"
            checked={props.inPreset.text === 'true'}
            disabled={props.disabled}
            onChange={(event) => { props.onEditInPreset(event.target.checked) }}
          />
          <span>{props.inPresetLabel}</span>
        </label>
        <label className="dsh-nx-checkRow">
          <input
            type="checkbox"
            checked={props.published.text === 'true'}
            disabled={props.disabled}
            onChange={(event) => { props.onEditPublic(event.target.checked) }}
          />
          <span>{props.publicLabel}</span>
        </label>
      </div>
      {props.targets}
      {props.tools
        ? (
          <details className="dsh-nx-toolList">
            <summary>{props.toolCount ?? props.tools.length}</summary>
            {props.tools.length === 0
              ? <p className="dsh-nx-hint">{props.emptyLabel ?? ''}</p>
              : (
                <div className="dsh-nx-toolRows">
                  {props.tools.map((tool) => {
                    const enabled = !(props.disabledTools?.has(tool.name) ?? false)
                    const desc = tool.description.trim()
                    const short = desc.length > 72 ? `${desc.slice(0, 72)}…` : desc
                    return (
                      <label key={tool.name} className="dsh-nx-checkRow dsh-nx-toolRow">
                        <input
                          type="checkbox"
                          checked={enabled}
                          disabled={props.disabled}
                          onChange={(event) => { props.onToggleTool?.(tool.name, event.target.checked) }}
                        />
                        <span className="dsh-nx-toolMeta">
                          <span className="dsh-nx-toolName">
                            {tool.name}
                            {tool.readOnlyHint !== true
                              ? <span className="dsh-nx-badgeMuted">{props.writeBadge ?? ''}</span>
                              : null}
                          </span>
                          {short ? <span className="dsh-nx-hint">{short}</span> : null}
                        </span>
                      </label>
                    )
                  })}
                </div>
              )}
          </details>
        )
        : null}
    </div>
  )
}

function ToggleField(props: {
  id: string
  label: string
  checked: boolean
  disabled: boolean
  overridden: boolean
  resetLabel: string
  onToggle: (checked: boolean) => void
  onReset: () => void
  trailing?: ReactNode
  error?: ReactNode
}) {
  return (
    <div className="dsh-nx-settings-field dsh-nx-toggleField">
      <div className="dsh-nx-field-head">
        <label htmlFor={props.id}>{props.label}</label>
        <span className="dsh-nx-badges">
          {props.trailing}
          {props.overridden
            ? (
              <button type="button" className="dsh-nx-reset" disabled={props.disabled} onClick={props.onReset}>
                {props.resetLabel}
              </button>
            )
            : null}
        </span>
        <input
          id={props.id}
          type="checkbox"
          checked={props.checked}
          disabled={props.disabled}
          aria-label={props.label}
          onChange={(event) => { props.onToggle(event.target.checked) }}
        />
      </div>
      {props.error}
    </div>
  )
}

export function NetxopsCard(props: NetxopsCardProps) {
  ensureStyles()
  const { t } = props
  const state: NetxopsCardState = props.useNetxopsCard(snapshot => snapshot)

  if (!state.available) {
    return (
      <section className="dsh-nx-settings" aria-label={t('title')}>
        <h2>{t('title')}</h2>
        <div className="dsh-nx-settings-empty" role="status">{t('settingsUnavailable')}</div>
      </section>
    )
  }

  const disabled = !state.writable
  const blocked = !state.dirty || state.invalid || state.saving
  const pushStatus = state.alarmPushStatus
  const publicationDisabled = disabled || state.toolsEnabled.text !== 'true'
  const targets = (field: string, value: CardFieldState) => (
    <PresetTargets field={value} state={state} disabled={publicationDisabled} t={t}
      onEdit={text => { props.edit(field, text) }} />
  )

  return (
    <section className="dsh-nx-settings" aria-label={t('title')}>
      <header>
        <h2>{t('title')}</h2>
      </header>

      {!state.writable
        ? <p className="dsh-nx-hint" role="status">{t('readOnly')}</p>
        : null}

      <div className="dsh-nx-settings-card">
        <h3>{t('sectionConnection')}</h3>
        <div className="dsh-nx-settings-field">
          <div className="dsh-nx-field-head">
            <label htmlFor="netxops-api-token">{t('apiToken')}</label>
            <span className="dsh-nx-badges">
              <span className={state.apiTokenConfigured ? 'dsh-nx-badge' : 'dsh-nx-badgeMuted'}>
                {state.apiTokenConfigured ? t('apiTokenSet') : t('apiTokenUnset')}
              </span>
            </span>
          </div>
          <input
            id="netxops-api-token"
            type="password"
            autoComplete="off"
            placeholder={t('apiTokenHint')}
            value={state.apiToken.text}
            disabled={!state.apiTokenWritable}
            onChange={(event) => { props.edit('apiToken', event.target.value) }}
          />
          {!state.apiTokenRemoteReady ? <p className="dsh-nx-invalid">{t('apiTokenUnavailable')}</p> : null}
        </div>
        <ValueField
          id="netxops-api-url"
          label={t('apiUrl')}
          hint={t('apiUrlHint')}
          field={state.apiUrl}
          resetLabel={t('reset')}
          invalidLabel={t('apiUrlInvalid')}
          disabled={disabled}
          onEdit={(text) => { props.edit('apiUrl', text) }}
          onReset={() => { props.resetField('apiUrl') }}
        />
        <div className="dsh-nx-fieldGrid">
          <SelectField
            id="netxops-lang"
            label={t('lang')}
            field={state.lang}
            options={[
              { value: 'zh', label: t('languageChinese') },
              { value: 'en', label: t('languageEnglish') },
            ]}
            resetLabel={t('reset')}
            invalidLabel={t('invalid')}
            disabled={disabled}
            onEdit={(text) => { props.edit('lang', text) }}
            onReset={() => { props.resetField('lang') }}
          />
          <SelectField
            id="netxops-nms-provider"
            label={t('nmsProvider')}
            field={state.nmsProvider}
            options={[{ value: 'zte-ume', label: 'ZTE UME' }]}
            resetLabel={t('reset')}
            invalidLabel={t('invalid')}
            disabled={disabled}
            onEdit={(text) => { props.edit('nmsProvider', text) }}
            onReset={() => { props.resetField('nmsProvider') }}
          />
        </div>
      </div>

      <div className="dsh-nx-settings-card">
        <div className="dsh-nx-card-head">
          <h3>{t('sectionLanguage')}</h3>
          <span className="dsh-nx-hint">{t('languageScope')}</span>
        </div>
        <div className="dsh-nx-fieldGrid">
          <SelectField
            id="netxops-thinking-language"
            label={t('thinkingLanguage')}
            field={state.thinkingLanguage}
            options={[
              { value: 'auto', label: t('languageAuto') },
              { value: 'zh-CN', label: t('languageChinese') },
              { value: 'en', label: t('languageEnglish') },
            ]}
            resetLabel={t('reset')}
            invalidLabel={t('invalid')}
            disabled={disabled}
            onEdit={(text) => { props.edit('thinkingLanguage', text) }}
            onReset={() => { props.resetField('thinkingLanguage') }}
          />
          <SelectField
            id="netxops-reply-language"
            label={t('replyLanguage')}
            field={state.replyLanguage}
            options={[
              { value: 'follow-user', label: t('languageFollowUser') },
              { value: 'zh', label: t('languageChinese') },
              { value: 'en', label: t('languageEnglish') },
            ]}
            resetLabel={t('reset')}
            invalidLabel={t('invalid')}
            disabled={disabled}
            onEdit={(text) => { props.edit('replyLanguage', text) }}
            onReset={() => { props.resetField('replyLanguage') }}
          />
        </div>
      </div>

      <div className="dsh-nx-settings-card">
        <div className="dsh-nx-card-head">
          <h3>{t('sectionCapabilities')}</h3>
          <span className="dsh-nx-badges">
            <StatusBadge tone={toolsMountTone(state.toolsStatus)} label={toolsBadgeLabel(t, state.toolsStatus)} />
            <button
              type="button"
              className="dsh-nx-btn"
              disabled={disabled || state.mcpRefreshBusy}
              onClick={() => { props.refreshMcpCatalog() }}
            >
              {state.mcpRefreshBusy ? t('mcpRefreshing') : t('mcpRefresh')}
            </button>
          </span>
        </div>
        <ToggleField id="netxops-tools-enabled" label={t('toolsEnabled')}
          checked={state.toolsEnabled.text === 'true'} disabled={disabled}
          overridden={state.toolsEnabled.overridden} resetLabel={t('reset')}
          onToggle={checked => { props.edit('toolsEnabled', String(checked)) }}
          onReset={() => { props.resetField('toolsEnabled') }}
          error={(state.toolsStatus?.error || state.toolsStatus?.mcpError || state.mcpCatalog?.error)
            ? (
              <p className="dsh-nx-invalid" role="status">
                {state.toolsStatus?.error || state.toolsStatus?.mcpError || state.mcpCatalog?.error}
                {(state.toolsStatus?.mcpFromCache || state.mcpCatalog?.fromCache)
                  ? ` · ${t('mcpDisconnected')}`
                  : ''}
              </p>
            )
            : null} />
        <ToggleField id="netxops-readonly-only" label={t('readOnlyOnly')}
          checked={state.readOnlyOnly.text === 'true'} disabled={publicationDisabled}
          overridden={state.readOnlyOnly.overridden} resetLabel={t('reset')}
          onToggle={checked => { props.edit('readOnlyOnly', String(checked)) }}
          onReset={() => { props.resetField('readOnlyOnly') }} />
        {(() => {
          const catalogTools = state.mcpCatalog?.tools ?? []
          const byGroup = {
            ops: catalogTools.filter((tool) => tool.group === 'ops'),
            topology: catalogTools.filter((tool) => tool.group === 'topology'),
            bizMonitor: catalogTools.filter((tool) => tool.group === 'bizMonitor'),
          }
          const disabledSet = new Set(parseDisabledTools(state.disabledTools.text))
          const toolProps = {
            disabledTools: disabledSet,
            writeBadge: t('toolWriteBadge'),
            emptyLabel: t('toolListEmpty'),
            onToggleTool: (name: string, enabled: boolean) => { props.setToolEnabled(name, enabled) },
          }
          return (
            <>
              <CapabilityGroupBlock
                title={t('groupOps')}
                toolCount={byGroup.ops.length}
                tools={byGroup.ops}
                targets={targets('groupOpsPresets', state.groupOpsPresets)}
                inPresetLabel={t('groupInPreset')}
                publicLabel={t('groupPublic')}
                inPreset={state.groupOpsInPreset}
                published={state.groupOpsPublic}
                disabled={publicationDisabled}
                onEditInPreset={(checked) => {
                  props.edit('groupOpsInPreset', checked ? 'true' : 'false')
                }}
                onEditPublic={(checked) => {
                  props.edit('groupOpsPublic', checked ? 'true' : 'false')
                }}
                {...toolProps}
              />
              <CapabilityGroupBlock
                title={t('groupTopology')}
                toolCount={byGroup.topology.length}
                tools={byGroup.topology}
                targets={targets('groupTopologyPresets', state.groupTopologyPresets)}
                inPresetLabel={t('groupInPreset')}
                publicLabel={t('groupPublic')}
                inPreset={state.groupTopologyInPreset}
                published={state.groupTopologyPublic}
                disabled={publicationDisabled}
                onEditInPreset={(checked) => {
                  props.edit('groupTopologyInPreset', checked ? 'true' : 'false')
                }}
                onEditPublic={(checked) => {
                  props.edit('groupTopologyPublic', checked ? 'true' : 'false')
                }}
                {...toolProps}
              />
              <CapabilityGroupBlock
                title={t('groupBizMonitor')}
                toolCount={byGroup.bizMonitor.length}
                tools={byGroup.bizMonitor}
                targets={targets('groupBizMonitorPresets', state.groupBizMonitorPresets)}
                inPresetLabel={t('groupInPreset')}
                publicLabel={t('groupPublic')}
                inPreset={state.groupBizMonitorInPreset}
                published={state.groupBizMonitorPublic}
                disabled={publicationDisabled}
                onEditInPreset={(checked) => {
                  props.edit('groupBizMonitorInPreset', checked ? 'true' : 'false')
                }}
                onEditPublic={(checked) => {
                  props.edit('groupBizMonitorPublic', checked ? 'true' : 'false')
                }}
                {...toolProps}
              />
            </>
          )
        })()}
        {state.toolsStatus && state.toolsStatus.mounts.length > 0 ? (
          <details className="dsh-nx-diagnostics"><summary>{t('mountDetails')}</summary>
            <p className="dsh-nx-hint">{t('mountStatusHint')}</p>
            {state.toolsStatus.mounts.map((mount, index) => (
              <p key={`${mount.source}:${index}`} className={mount.error ? 'dsh-nx-invalid' : 'dsh-nx-hint'}>
                {mount.source} · {mount.count} · {mount.groups.join(', ') || '—'}{mount.error ? ` · ${mount.error}` : ''}
              </p>
            ))}
          </details>
        ) : null}
      </div>

      <div className="dsh-nx-settings-card">
        <div className="dsh-nx-card-head">
          <h3>{t('sectionKnowledge')}</h3>
          <StatusBadge tone={kbStatusTone(state.kbStatus?.status ?? 'unconfigured')} label={kbBadgeLabel(t, state.kbStatus)} />
        </div>
        <div className="dsh-nx-settings-field">
          <div className="dsh-nx-field-head">
            <label htmlFor="netxops-kb-root">{t('kbRoot')}</label>
            <span className="dsh-nx-badges">
              {state.kbRoot.overridden
                ? (
                  <>
                    <button
                      type="button"
                      className="dsh-nx-reset"
                      disabled={disabled}
                      onClick={() => { props.resetField('kbRoot') }}
                    >
                      {t('reset')}
                    </button>
                  </>
                )
                : null}
            </span>
          </div>
          <div className="dsh-nx-pathRow">
            <input
              id="netxops-kb-root"
              className={state.kbRoot.invalid ? 'dsh-nx-inputInvalid' : undefined}
              type="text"
              placeholder={t('kbRootHint')}
              value={state.kbRoot.text}
              disabled={disabled}
              aria-invalid={state.kbRoot.invalid || undefined}
              onChange={(event) => { props.edit('kbRoot', event.target.value) }}
            />
            <button
              type="button"
              className="dsh-nx-btn"
              disabled={disabled || !state.kbDirectoryPickerReady}
              title={!state.kbDirectoryPickerReady ? t('kbBrowseUnavailable') : undefined}
              onClick={() => { props.browseKbRoot() }}
            >
              {t('kbBrowse')}
            </button>
          </div>
          {state.kbRoot.invalid ? <p className="dsh-nx-invalid">{t('invalid')}</p> : null}
          {state.kbUiError
            ? (
              <p className="dsh-nx-invalid" role="status">
                {fillTemplate(t('kbBrowseFailed'), { detail: state.kbUiError })}
              </p>
            )
            : null}
          {state.kbStatus?.status === 'error' && state.kbStatus.errorMessage
            ? <p className="dsh-nx-invalid" role="status">{state.kbStatus.errorMessage}</p>
            : null}
          {state.kbStatus?.status === 'configured' && state.kbStatus.realRoot && state.kbStatus.realRoot !== state.kbRoot.text
            ? <p className="dsh-nx-hint">{state.kbStatus.realRoot}</p>
            : null}
        </div>
        <CapabilityGroupBlock
          title={t('groupKb')}
          targets={targets('groupKbPresets', state.groupKbPresets)}
          inPresetLabel={t('groupInPreset')}
          publicLabel={t('groupPublic')}
          inPreset={state.groupKbInPreset}
          published={state.groupKbPublic}
          disabled={publicationDisabled}
          onEditInPreset={(checked) => {
            props.edit('groupKbInPreset', checked ? 'true' : 'false')
          }}
          onEditPublic={(checked) => {
            props.edit('groupKbPublic', checked ? 'true' : 'false')
          }}
        />
      </div>

      <div className="dsh-nx-settings-card">
        <h3>{t('sectionAlarms')}</h3>
        <ToggleField
          id="netxops-alarm-push"
          label={t('alarmPushEnabled')}
          checked={state.alarmPushEnabled.text === 'true'}
          disabled={disabled}
          overridden={state.alarmPushEnabled.overridden}
          resetLabel={t('reset')}
          onToggle={(checked) => {
            props.edit('alarmPushEnabled', checked ? 'true' : 'false')
          }}
          onReset={() => { props.resetField('alarmPushEnabled') }}
          trailing={pushStatus
            ? (
              <StatusBadge
                phase={pushStatus.phase}
                label={t(phaseLocaleKey(pushStatus.phase))}
              />
            )
            : null}
          error={pushStatus?.lastError
            ? <p className="dsh-nx-invalid" role="status">{pushStatus.lastError}</p>
            : null}
        />
        <ToggleField
          id="netxops-alarm-dsh"
          label={t('alarmDeliverDsh')}
          checked={state.alarmDeliverDsh.text === 'true'}
          disabled={disabled}
          overridden={state.alarmDeliverDsh.overridden}
          resetLabel={t('reset')}
          onToggle={(checked) => {
            props.edit('alarmDeliverDsh', checked ? 'true' : 'false')
          }}
          onReset={() => { props.resetField('alarmDeliverDsh') }}
        />
        <ImDeliveryPicker
          catalog={state.imDeliveryCatalog}
          targetsJson={state.imTargets.text}
          legacyBotId={state.imBotId.text}
          legacyTargetId={state.imTargetId.text}
          disabled={disabled}
          labels={{
            target: t('alarmDeliverIm'),
            none: t('imTargetNone'),
            selectedCount: t('imTargetSelectedCount'),
            unavailable: t('imCatalogUnavailable'),
          }}
          onChange={(targets) => {
            props.edit('imTargets', formatImTargetsJson(targets))
            const first = targets[0]
            props.edit('imBotId', first?.botId ?? '')
            props.edit('imTargetId', first?.targetId ?? '')
            props.edit('alarmDeliverIm', targets.length > 0 ? 'true' : 'false')
          }}
        />
      </div>

      <div className="dsh-nx-settings-card">
        <h3>{t('sectionExport')}</h3>
        <div className="dsh-nx-settings-field">
          {state.sessionsExportStatus === null
            ? <p className="dsh-nx-hint">{t('sessionsExportUnavailable')}</p>
            : state.sessionsExportStatus.available
              ? (
                <p className="dsh-nx-hint">
                  {t('sessionsExportCount').replace(
                    '{count}',
                    String(state.sessionsExportStatus.sessionCount),
                  )}
                </p>
              )
              : (
                <p className="dsh-nx-hint">
                  {exportStatusMessage(t, state.sessionsExportStatus)}
                </p>
              )}
          {state.sessionsExportError
            ? (
              <p className="dsh-nx-invalid" role="status">
                {exportErrorMessage(t, state.sessionsExportError)}
              </p>
            )
            : null}
          {state.sessionsExportLastFile && !state.sessionsExportBusy && !state.sessionsExportError
            ? (
              <p className="dsh-nx-hint" role="status">
                {t('sessionsExportDone').replace('{file}', state.sessionsExportLastFile)}
              </p>
            )
            : null}
          <div className="dsh-nx-settings-actions">
            <button
              type="button"
              className="dsh-nx-btn"
              disabled={
                state.sessionsExportBusy
                || state.sessionsExportStatus?.available !== true
              }
              onClick={() => { props.exportAllSessions() }}
            >
              {t(state.sessionsExportBusy ? 'sessionsExportBusy' : 'sessionsExportButton')}
            </button>
          </div>
        </div>
      </div>

      {state.dirty || state.saving || state.failed ? <div className="dsh-nx-settings-actions">
        <button
          type="button"
          className="dsh-nx-btn dsh-nx-btn-primary"
          disabled={blocked}
          onClick={props.save}
        >
          {t(state.saving ? 'saving' : 'save')}
        </button>
        <button
          type="button"
          className="dsh-nx-btn dsh-nx-btn-ghost"
          disabled={!state.dirty || state.saving}
          onClick={props.discard}
        >
          {t('discard')}
        </button>
        {state.dirty && !state.saving
          ? <span className="dsh-nx-settings-msg">{t('unsaved')}</span>
          : null}
        {state.failed
          ? <span className="dsh-nx-settings-msg err" role="status">{t('saveFailed')}</span>
          : null}
      </div> : null}
    </section>
  )
}
