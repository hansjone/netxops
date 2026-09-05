/**
 * Netx Ops Plugins settings card — apiUrl / lang + credential token.
 */

import { useEffect, useRef, useState } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { NetxopsCardFace, NetxopsCardState } from './controller.ts'
import type { NetxopsLocaleKey } from './locales.ts'
import type { CardFieldState } from './card-form.ts'
import { alarmPushTone, type AlarmPushPhase } from './alarm-push-status-view.ts'
import { ensureStyles } from './styles.ts'
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
  phase: AlarmPushPhase
  label: string
}) {
  const tone = alarmPushTone(props.phase)
  const className = tone === 'ok'
    ? 'dsh-nx-status dsh-nx-statusOk'
    : tone === 'warn'
      ? 'dsh-nx-status dsh-nx-statusWarn'
      : tone === 'err'
        ? 'dsh-nx-status dsh-nx-statusErr'
        : 'dsh-nx-status'
  return <span className={className}>{props.label}</span>
}

export type NetxopsCardProps =
  PropsRuntime<'settings.plugin.item'>
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
    <div className="dsh-nx-field">
      <div className="dsh-nx-fieldHead">
        <label className="dsh-nx-label" htmlFor={props.id}>{props.label}</label>
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
        className={props.field.invalid ? 'dsh-nx-input dsh-nx-inputInvalid' : 'dsh-nx-input'}
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

export function NetxopsCard(props: NetxopsCardProps) {
  ensureStyles()
  const { t } = props
  const state: NetxopsCardState = props.useNetxopsCard(snapshot => snapshot)
  const [open, setOpen] = useState(false)
  const saveStarted = useRef(false)

  useEffect(() => {
    if (state.saving) {
      saveStarted.current = true
      return
    }
    if (!saveStarted.current) return
    saveStarted.current = false
    if (!state.dirty && !state.failed) setOpen(false)
  }, [state.dirty, state.failed, state.saving])

  if (!state.available) return null

  const title = t('title' satisfies NetxopsLocaleKey)
  const disabled = !state.writable
  const blocked = !state.dirty || state.invalid || state.saving
  const pushStatus = state.alarmPushStatus
  const showHeaderStatus = pushStatus !== null
    && (pushStatus.enabled || pushStatus.phase !== 'disabled')

  return (
    <li className={open ? 'dsh-nx-card dsh-nx-cardOpen' : 'dsh-nx-card'}>
      <button
        type="button"
        className="dsh-nx-header"
        aria-expanded={open}
        aria-label={`${t(open ? 'collapse' : 'expand')}: ${title}`}
        onClick={() => { setOpen(!open) }}
      >
        <span className="dsh-nx-headText">
          <span className="dsh-nx-name">{title}</span>
          <span className="dsh-nx-desc">{t('description')}</span>
        </span>
        {showHeaderStatus && pushStatus
          ? (
            <StatusBadge
              phase={pushStatus.phase}
              label={t(phaseLocaleKey(pushStatus.phase))}
            />
          )
          : null}
        {state.dirty ? <span className="dsh-nx-pending">{t('unsaved')}</span> : null}
        <span className={open ? 'dsh-nx-chevron dsh-nx-chevronOpen' : 'dsh-nx-chevron'} aria-hidden>▾</span>
      </button>
      {open
        ? (
          <div className="dsh-nx-body">
            {!state.writable ? <p className="dsh-nx-readOnly" role="status">{t('readOnly')}</p> : null}
            <div className="dsh-nx-field">
              <div className="dsh-nx-fieldHead">
                <label className="dsh-nx-label" htmlFor="netxops-api-token">{t('apiToken')}</label>
                <span className="dsh-nx-badges">
                  <span className={state.apiTokenConfigured ? 'dsh-nx-badge' : 'dsh-nx-badgeMuted'}>
                    {state.apiTokenConfigured ? t('apiTokenSet') : t('apiTokenUnset')}
                  </span>
                </span>
              </div>
              <input
                id="netxops-api-token"
                className="dsh-nx-input"
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
            <div className="dsh-nx-field">
              <div className="dsh-nx-fieldHead">
                <label className="dsh-nx-label" htmlFor="netxops-alarm-push">{t('alarmPushEnabled')}</label>
                <span className="dsh-nx-badges">
                  {pushStatus
                    ? (
                      <StatusBadge
                        phase={pushStatus.phase}
                        label={`${t('alarmPushStatus')}: ${t(phaseLocaleKey(pushStatus.phase))}`}
                      />
                    )
                    : null}
                  {state.alarmPushEnabled.overridden
                    ? (
                      <>
                        <span className="dsh-nx-badge">{t('overridden')}</span>
                        <button
                          type="button"
                          className="dsh-nx-reset"
                          disabled={disabled}
                          onClick={() => { props.resetField('alarmPushEnabled') }}
                        >
                          {t('reset')}
                        </button>
                      </>
                    )
                    : null}
                </span>
              </div>
              <label className="dsh-nx-checkRow" htmlFor="netxops-alarm-push">
                <input
                  id="netxops-alarm-push"
                  type="checkbox"
                  checked={state.alarmPushEnabled.text === 'true'}
                  disabled={disabled}
                  onChange={(event) => {
                    props.edit('alarmPushEnabled', event.target.checked ? 'true' : 'false')
                  }}
                />
                <span>{t('alarmPushEnabledHint')}</span>
              </label>
              {pushStatus?.wsUrl
                ? <p className="dsh-nx-hint">{pushStatus.wsUrl}</p>
                : null}
              {pushStatus?.lastError
                ? <p className="dsh-nx-invalid" role="status">{pushStatus.lastError}</p>
                : null}
            </div>
            <div className="dsh-nx-field">
              <div className="dsh-nx-fieldHead">
                <label className="dsh-nx-label" htmlFor="netxops-alarm-dsh">{t('alarmDeliverDsh')}</label>
                {state.alarmDeliverDsh.overridden
                  ? (
                    <span className="dsh-nx-badges">
                      <span className="dsh-nx-badge">{t('overridden')}</span>
                      <button type="button" className="dsh-nx-reset" disabled={disabled} onClick={() => { props.resetField('alarmDeliverDsh') }}>
                        {t('reset')}
                      </button>
                    </span>
                  )
                  : null}
              </div>
              <label className="dsh-nx-checkRow" htmlFor="netxops-alarm-dsh">
                <input
                  id="netxops-alarm-dsh"
                  type="checkbox"
                  checked={state.alarmDeliverDsh.text === 'true'}
                  disabled={disabled}
                  onChange={(event) => {
                    props.edit('alarmDeliverDsh', event.target.checked ? 'true' : 'false')
                  }}
                />
                <span>{t('alarmDeliverDshHint')}</span>
              </label>
            </div>
            <div className="dsh-nx-field">
              <div className="dsh-nx-fieldHead">
                <label className="dsh-nx-label" htmlFor="netxops-alarm-im">{t('alarmDeliverIm')}</label>
                {state.alarmDeliverIm.overridden
                  ? (
                    <span className="dsh-nx-badges">
                      <span className="dsh-nx-badge">{t('overridden')}</span>
                      <button type="button" className="dsh-nx-reset" disabled={disabled} onClick={() => { props.resetField('alarmDeliverIm') }}>
                        {t('reset')}
                      </button>
                    </span>
                  )
                  : null}
              </div>
              <label className="dsh-nx-checkRow" htmlFor="netxops-alarm-im">
                <input
                  id="netxops-alarm-im"
                  type="checkbox"
                  checked={state.alarmDeliverIm.text === 'true'}
                  disabled={disabled}
                  onChange={(event) => {
                    props.edit('alarmDeliverIm', event.target.checked ? 'true' : 'false')
                  }}
                />
                <span>{t('alarmDeliverImHint')}</span>
              </label>
            </div>
            <ValueField
              id="netxops-im-bot-id"
              label={t('imBotId')}
              hint={t('imBotIdHint')}
              field={state.imBotId}
              overriddenLabel={t('overridden')}
              resetLabel={t('reset')}
              invalidLabel={t('invalid')}
              disabled={disabled}
              onEdit={(text) => { props.edit('imBotId', text) }}
              onReset={() => { props.resetField('imBotId') }}
            />
            <ValueField
              id="netxops-im-target-id"
              label={t('imTargetId')}
              hint={t('imTargetIdHint')}
              field={state.imTargetId}
              overriddenLabel={t('overridden')}
              resetLabel={t('reset')}
              invalidLabel={t('invalid')}
              disabled={disabled}
              onEdit={(text) => { props.edit('imTargetId', text) }}
              onReset={() => { props.resetField('imTargetId') }}
            />
            <div className="dsh-nx-footer">
              {state.failed ? <p className="dsh-nx-failed" role="status">{t('saveFailed')}</p> : null}
              <button
                type="button"
                className="dsh-nx-btn dsh-nx-discard"
                disabled={!state.dirty || state.saving}
                onClick={props.discard}
              >
                {t('discard')}
              </button>
              <button
                type="button"
                className="dsh-nx-btn dsh-nx-save"
                disabled={blocked}
                onClick={props.save}
              >
                {t(state.saving ? 'saving' : 'save')}
              </button>
            </div>
          </div>
        )
        : null}
    </li>
  )
}
