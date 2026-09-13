/**
 * Netx Ops settings section — uds-auth visual language (page header + cards).
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'
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
import { ensureStyles } from './styles.ts'
import { sessionsExportReasonLocaleKey } from './sessions-export-view.ts'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'

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
    return fillTemplate(t('kbStatusError'), { detail: snapshot.errorMessage || 'error' })
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
  PropsRuntime<'settings.section'>
  & PropsLocale<'settings.netxops'>
  & InjectFace<NetxopsCardFace>

function ValueField(props: {
  id: string
  label: string
  hint: string
  field: CardFieldState
  overriddenLabel: string
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
              <span className="dsh-nx-badge">{props.overriddenLabel}</span>
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
        value={props.field.text}
        disabled={props.disabled}
        aria-invalid={props.field.invalid || undefined}
        onChange={(event) => { props.onEdit(event.target.value) }}
      />
      <p className={props.field.invalid ? 'dsh-nx-invalid' : 'dsh-nx-hint'}>
        {props.field.invalid ? props.invalidLabel : props.hint}
      </p>
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

function CapabilityGroupBlock(props: {
  title: string
  inPresetLabel: string
  publicLabel: string
  inPreset: CardFieldState
  published: CardFieldState
  disabled: boolean
  onEditInPreset: (checked: boolean) => void
  onEditPublic: (checked: boolean) => void
}) {
  return (
    <div className="dsh-nx-groupBlock">
      <div className="dsh-nx-groupTitle">{props.title}</div>
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
    </div>
  )
}

function ToggleField(props: {
  id: string
  label: string
  checked: boolean
  disabled: boolean
  overridden: boolean
  overriddenLabel: string
  resetLabel: string
  onToggle: (checked: boolean) => void
  onReset: () => void
  trailing?: ReactNode
  hint?: ReactNode
  error?: ReactNode
}) {
  return (
    <div className="dsh-nx-settings-field">
      <div className="dsh-nx-field-head">
        <label htmlFor={props.id}>{props.label}</label>
        <span className="dsh-nx-badges">
          {props.trailing}
          {props.overridden
            ? (
              <>
                <span className="dsh-nx-badge">{props.overriddenLabel}</span>
                <button type="button" className="dsh-nx-reset" disabled={props.disabled} onClick={props.onReset}>
                  {props.resetLabel}
                </button>
              </>
            )
            : null}
        </span>
      </div>
      <label className="dsh-nx-checkRow" htmlFor={props.id}>
        <input
          id={props.id}
          type="checkbox"
          checked={props.checked}
          disabled={props.disabled}
          aria-label={props.label}
          onChange={(event) => { props.onToggle(event.target.checked) }}
        />
      </label>
      {props.hint}
      {props.error}
    </div>
  )
}

export function NetxopsCard(props: NetxopsCardProps) {
  ensureStyles()
  const { t } = props
  const state: NetxopsCardState = props.useNetxopsCard(snapshot => snapshot)
  const [flash, setFlash] = useState<'ok' | 'err' | null>(null)
  const saveStarted = useRef(false)

  useEffect(() => {
    if (state.saving) {
      saveStarted.current = true
      setFlash(null)
      return
    }
    if (!saveStarted.current) return
    saveStarted.current = false
    if (state.failed) {
      setFlash('err')
      return
    }
    if (!state.dirty) setFlash('ok')
  }, [state.dirty, state.failed, state.saving])

  if (!state.available) {
    return (
      <section className="dsh-nx-settings" aria-label={t('title')}>
        <div className="dsh-nx-settings-empty">{t('sessionsExportUnavailable')}</div>
      </section>
    )
  }

  const disabled = !state.writable
  const blocked = !state.dirty || state.invalid || state.saving
  const pushStatus = state.alarmPushStatus

  return (
    <section className="dsh-nx-settings" aria-label={t('title')}>
      <header>
        <h2>{t('title')}</h2>
        <p className="dsh-nx-settings-intro">{t('description')}</p>
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
            value={state.apiToken.text}
            disabled={!state.apiTokenWritable}
            onChange={(event) => { props.edit('apiToken', event.target.value) }}
          />
          <p className="dsh-nx-hint">
            {state.apiTokenRemoteReady ? t('apiTokenHint') : t('apiTokenUnavailable')}
          </p>
        </div>
        <ValueField
          id="netxops-api-url"
          label={t('apiUrl')}
          hint={t('apiUrlHint')}
          field={state.apiUrl}
          overriddenLabel={t('overridden')}
          resetLabel={t('reset')}
          invalidLabel={t('invalid')}
          disabled={disabled}
          onEdit={(text) => { props.edit('apiUrl', text) }}
          onReset={() => { props.resetField('apiUrl') }}
        />
        <ValueField
          id="netxops-lang"
          label={t('lang')}
          hint={t('langHint')}
          field={state.lang}
          overriddenLabel={t('overridden')}
          resetLabel={t('reset')}
          invalidLabel={t('invalid')}
          disabled={disabled}
          onEdit={(text) => { props.edit('lang', text) }}
          onReset={() => { props.resetField('lang') }}
        />
        <ValueField
          id="netxops-nms-provider"
          label={t('nmsProvider')}
          hint={t('nmsProviderHint')}
          field={state.nmsProvider}
          overriddenLabel={t('overridden')}
          resetLabel={t('reset')}
          invalidLabel={t('invalid')}
          disabled={disabled}
          onEdit={(text) => { props.edit('nmsProvider', text) }}
          onReset={() => { props.resetField('nmsProvider') }}
        />
      </div>

      <div className="dsh-nx-settings-card">
        <h3>{t('sectionCapabilities')}</h3>
        <CapabilityGroupBlock
          title={t('groupOps')}
          inPresetLabel={t('groupInPreset')}
          publicLabel={t('groupPublic')}
          inPreset={state.groupOpsInPreset}
          published={state.groupOpsPublic}
          disabled={disabled}
          onEditInPreset={(checked) => {
            props.edit('groupOpsInPreset', checked ? 'true' : 'false')
          }}
          onEditPublic={(checked) => {
            props.edit('groupOpsPublic', checked ? 'true' : 'false')
          }}
        />
        <CapabilityGroupBlock
          title={t('groupTopology')}
          inPresetLabel={t('groupInPreset')}
          publicLabel={t('groupPublic')}
          inPreset={state.groupTopologyInPreset}
          published={state.groupTopologyPublic}
          disabled={disabled}
          onEditInPreset={(checked) => {
            props.edit('groupTopologyInPreset', checked ? 'true' : 'false')
          }}
          onEditPublic={(checked) => {
            props.edit('groupTopologyPublic', checked ? 'true' : 'false')
          }}
        />
      </div>

      <div className="dsh-nx-settings-card">
        <h3>{t('sectionKnowledge')}</h3>
        <div className="dsh-nx-settings-field">
          <div className="dsh-nx-field-head">
            <label htmlFor="netxops-kb-root">{t('kbRoot')}</label>
            <span className="dsh-nx-badges">
              <StatusBadge
                tone={kbStatusTone(state.kbStatus?.status ?? 'unconfigured')}
                label={kbBadgeLabel(t, state.kbStatus)}
              />
              {state.kbRoot.overridden
                ? (
                  <>
                    <span className="dsh-nx-badge">{t('overridden')}</span>
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
              value={state.kbRoot.text}
              disabled={disabled}
              aria-invalid={state.kbRoot.invalid || undefined}
              onChange={(event) => { props.edit('kbRoot', event.target.value) }}
            />
            <button
              type="button"
              className="dsh-nx-btn"
              disabled={disabled}
              onClick={() => { props.browseKbRoot() }}
            >
              {t('kbBrowse')}
            </button>
          </div>
          <p className={state.kbRoot.invalid ? 'dsh-nx-invalid' : 'dsh-nx-hint'}>
            {state.kbRoot.invalid
              ? t('invalid')
              : state.kbDirectoryPickerReady
                ? t('kbRootHint')
                : t('kbBrowseUnavailable')}
          </p>
          <p className="dsh-nx-hint">{t('kbSaveHint')}</p>
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
          {state.kbStatus?.status === 'configured' && state.kbStatus.realRoot
            ? <p className="dsh-nx-hint">{state.kbStatus.realRoot}</p>
            : null}
        </div>
      </div>

      <div className="dsh-nx-settings-card">
        <h3>{t('sectionAlarms')}</h3>
        <ToggleField
          id="netxops-alarm-push"
          label={t('alarmPushEnabled')}
          checked={state.alarmPushEnabled.text === 'true'}
          disabled={disabled}
          overridden={state.alarmPushEnabled.overridden}
          overriddenLabel={t('overridden')}
          resetLabel={t('reset')}
          onToggle={(checked) => {
            props.edit('alarmPushEnabled', checked ? 'true' : 'false')
          }}
          onReset={() => { props.resetField('alarmPushEnabled') }}
          trailing={pushStatus
            ? (
              <StatusBadge
                phase={pushStatus.phase}
                label={`${t('alarmPushStatus')}: ${t(phaseLocaleKey(pushStatus.phase))}`}
              />
            )
            : null}
          hint={pushStatus?.wsUrl ? <p className="dsh-nx-hint">{pushStatus.wsUrl}</p> : null}
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
          overriddenLabel={t('overridden')}
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
          <span className="dsh-nx-field-label">{t('sessionsExport')}</span>
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

      <div className="dsh-nx-settings-actions">
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
          onClick={() => {
            props.discard()
            setFlash(null)
          }}
        >
          {t('discard')}
        </button>
        {state.dirty && !state.saving
          ? <span className="dsh-nx-settings-msg">{t('unsaved')}</span>
          : null}
        {flash === 'ok' && !state.dirty
          ? <span className="dsh-nx-settings-msg ok">{t('configSaved')}</span>
          : null}
        {(flash === 'err' || state.failed)
          ? <span className="dsh-nx-settings-msg err" role="status">{t('saveFailed')}</span>
          : null}
      </div>
    </section>
  )
}
