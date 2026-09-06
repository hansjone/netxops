/**
 * Staged form over settings namespace `netxops` + optional credential NETX_API_TOKEN.
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type { SettingsScope, SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { SnapshotStore } from './snapshot-store.ts'
import {
  CardForm, textField, booleanField, booleanFieldPersistFalse,
  type CardActions, type CardFieldState, type CardShell,
} from './card-form.ts'
import {
  fetchAlarmPushStatus,
  type AlarmPushRpcCall,
  type AlarmPushStatus,
} from './alarm-push-status-view.ts'
import {
  EMPTY_IM_DELIVERY_CATALOG,
  fetchImDeliveryCatalog,
  type ImDeliveryCatalog,
} from './im-delivery-catalog.ts'
import {
  downloadAllSessionsExport,
  fetchSessionsExportStatus,
  type SessionsExportStatus,
} from './sessions-export-view.ts'

export const NETXOPS_NS = 'netxops'
const DEFAULT_TOKEN_REF = 'NETX_API_TOKEN'
const API_TOKEN_FIELD = 'apiToken'
const STATUS_POLL_MS = 2_000

export interface NetxopsSettings {
  apiUrl?: string
  lang?: string
  tokenCredentialRef?: string
  alarmPushEnabled?: boolean
  alarmDeliverDsh?: boolean
  alarmDeliverIm?: boolean
  /** JSON array of `{ botId, targetId }` — multi WhatsApp / IM sinks. */
  imTargets?: string
  imBotId?: string
  imTargetId?: string
  groupOpsInPreset?: boolean
  groupOpsPublic?: boolean
  groupTopologyInPreset?: boolean
  groupTopologyPublic?: boolean
  nmsProvider?: string
}

interface CredentialState {
  ref: string
  configured: boolean
  writable: boolean
  remoteReady: boolean
}

export interface NetxopsCardState extends CardShell {
  apiUrl: CardFieldState
  lang: CardFieldState
  groupOpsInPreset: CardFieldState
  groupOpsPublic: CardFieldState
  groupTopologyInPreset: CardFieldState
  groupTopologyPublic: CardFieldState
  nmsProvider: CardFieldState
  alarmPushEnabled: CardFieldState
  alarmDeliverDsh: CardFieldState
  alarmDeliverIm: CardFieldState
  imTargets: CardFieldState
  imBotId: CardFieldState
  imTargetId: CardFieldState
  apiToken: CardFieldState
  apiTokenConfigured: boolean
  apiTokenWritable: boolean
  apiTokenRemoteReady: boolean
  /** Host WSS status when Connection RPC is available; otherwise null. */
  alarmPushStatus: AlarmPushStatus | null
  /** Saved IM delivery targets for the picker (soft-depends on dsh-im-ops). */
  imDeliveryCatalog: ImDeliveryCatalog
  /** Bulk session-export readiness from Host RPC; null when RPC is absent. */
  sessionsExportStatus: SessionsExportStatus | null
  /** In-flight bulk export download. */
  sessionsExportBusy: boolean
  /** Last bulk export error message, if any. */
  sessionsExportError: string | null
  /** Last successful download filename. */
  sessionsExportLastFile: string | null
}

export interface NetxopsCardFace extends CardActions {
  hooks: {
    netxopsCard: SnapshotStore<NetxopsCardState>
  }
  /** Download every durable session on this Host as one ZIP. */
  exportAllSessions: () => void
}

type CredentialsRemote = {
  describe: (refs: string[]) => Promise<{ ok: boolean; value?: Record<string, { configured?: boolean; writable?: boolean } | undefined> }>
  set: (ref: string, value: string) => Promise<unknown>
}

export class NetxopsCardController {
  private readonly form: CardForm<NetxopsSettings>
  private readonly store: SnapshotStore<NetxopsCardState>
  private credential: CredentialState = {
    ref: '',
    configured: false,
    writable: false,
    remoteReady: false,
  }
  private rpcCall: AlarmPushRpcCall | undefined
  private alarmPushStatus: AlarmPushStatus | null = null
  private imDeliveryCatalog: ImDeliveryCatalog = { ...EMPTY_IM_DELIVERY_CATALOG }
  private sessionsExportStatus: SessionsExportStatus | null = null
  private sessionsExportBusy = false
  private sessionsExportError: string | null = null
  private sessionsExportLastFile: string | null = null
  private pollTimer: ReturnType<typeof setInterval> | undefined
  private pollInFlight = false
  private catalogInFlight = false
  private exportStatusInFlight = false
  private exportInFlight: Promise<void> | undefined

  constructor(
    private readonly scope: SettingsScope<NetxopsSettings>,
    private readonly ctx: ClientContext,
  ) {
    this.form = new CardForm(
      scope,
      [
        textField('apiUrl'),
        textField('lang'),
        textField('nmsProvider'),
        booleanFieldPersistFalse('groupOpsInPreset'),
        booleanField('groupOpsPublic'),
        booleanField('groupTopologyInPreset'),
        booleanField('groupTopologyPublic'),
        booleanField('alarmPushEnabled'),
        booleanFieldPersistFalse('alarmDeliverDsh'),
        booleanField('alarmDeliverIm'),
        textField('imTargets'),
        textField('imBotId'),
        textField('imTargetId'),
      ],
      [{ field: API_TOKEN_FIELD, write: text => this.writeToken(text) }],
    )
    this.store = this.form.bind(() => this.projection())
    scope.subscribe(() => { void this.readCredential() })
    void this.readCredential()
  }

  /** Toggle when soft-injected `remote.credentials` arrives / leaves. */
  setCredentialsAvailable(ready: boolean): void {
    if (this.credential.remoteReady === ready) return
    this.credential = {
      ...this.credential,
      remoteReady: ready,
      writable: ready,
    }
    this.store.set(this.projection())
    if (ready) void this.readCredential()
  }

  /**
   * Soft-inject Host Connection RPC used to read alarm-push WSS status.
   * @param call - `ctx.connection.rpc.call`, or undefined when connection leaves.
   */
  setAlarmPushRpc(call: AlarmPushRpcCall | undefined): void {
    this.rpcCall = call
    if (call === undefined) {
      this.stopStatusPoll()
      let changed = false
      if (this.alarmPushStatus !== null) {
        this.alarmPushStatus = null
        changed = true
      }
      if (this.imDeliveryCatalog.options.length > 0 || this.imDeliveryCatalog.available !== true) {
        this.imDeliveryCatalog = { ...EMPTY_IM_DELIVERY_CATALOG }
        changed = true
      }
      if (this.sessionsExportStatus !== null) {
        this.sessionsExportStatus = null
        changed = true
      }
      if (changed) this.store.set(this.projection())
      return
    }
    this.startStatusPoll()
    void this.refreshAlarmPushStatus()
    void this.refreshImDeliveryCatalog()
    void this.refreshSessionsExportStatus()
  }

  private startStatusPoll(): void {
    if (this.pollTimer !== undefined) return
    this.pollTimer = setInterval(() => {
      void this.refreshAlarmPushStatus()
      void this.refreshImDeliveryCatalog()
      void this.refreshSessionsExportStatus()
    }, STATUS_POLL_MS)
  }

  private stopStatusPoll(): void {
    if (this.pollTimer === undefined) return
    clearInterval(this.pollTimer)
    this.pollTimer = undefined
  }

  private async refreshAlarmPushStatus(): Promise<void> {
    const call = this.rpcCall
    if (call === undefined || this.pollInFlight) return
    this.pollInFlight = true
    try {
      const next = await fetchAlarmPushStatus(call)
      const prev = this.alarmPushStatus
      if (
        prev
        && prev.phase === next.phase
        && prev.enabled === next.enabled
        && prev.wsUrl === next.wsUrl
        && prev.detail === next.detail
        && prev.lastError === next.lastError
        && prev.lastConnectedAt === next.lastConnectedAt
      ) return
      this.alarmPushStatus = next
      this.store.set(this.projection())
    } catch {
      // Keep last good snapshot; next poll retries.
    } finally {
      this.pollInFlight = false
    }
  }

  private async refreshImDeliveryCatalog(): Promise<void> {
    const call = this.rpcCall
    if (call === undefined || this.catalogInFlight) return
    this.catalogInFlight = true
    try {
      const next = await fetchImDeliveryCatalog(call)
      const prev = this.imDeliveryCatalog
      const sameOptions = prev.options.length === next.options.length
        && prev.options.every((row, index) => {
          const other = next.options[index]
          return other
            && row.botId === other.botId
            && row.targetId === other.targetId
            && row.name === other.name
            && row.channel === other.channel
        })
      if (
        prev.available === next.available
        && prev.hint === next.hint
        && sameOptions
      ) return
      this.imDeliveryCatalog = next
      this.store.set(this.projection())
    } catch {
      // Keep last good snapshot; next poll retries.
    } finally {
      this.catalogInFlight = false
    }
  }

  private async refreshSessionsExportStatus(): Promise<void> {
    const call = this.rpcCall
    if (call === undefined || this.exportStatusInFlight) return
    this.exportStatusInFlight = true
    try {
      const next = await fetchSessionsExportStatus(call)
      const prev = this.sessionsExportStatus
      if (
        prev
        && prev.available === next.available
        && prev.sessionCount === next.sessionCount
        && prev.supportsRawArtifacts === next.supportsRawArtifacts
        && prev.reason === next.reason
      ) return
      this.sessionsExportStatus = next
      this.store.set(this.projection())
    } catch {
      // Keep last good snapshot; next poll retries.
    } finally {
      this.exportStatusInFlight = false
    }
  }

  /**
   * Download every durable session as one ZIP through the browser download manager.
   */
  exportAllSessions(): void {
    if (this.exportInFlight !== undefined || this.sessionsExportBusy) return
    if (this.sessionsExportStatus?.available !== true) return
    this.sessionsExportBusy = true
    this.sessionsExportError = null
    this.store.set(this.projection())
    this.exportInFlight = downloadAllSessionsExport()
      .then((result) => {
        this.sessionsExportLastFile = result.filename
        this.sessionsExportError = null
      })
      .catch((error: unknown) => {
        this.sessionsExportError = error instanceof Error ? error.message : String(error)
      })
      .finally(() => {
        this.sessionsExportBusy = false
        this.exportInFlight = undefined
        this.store.set(this.projection())
        void this.refreshSessionsExportStatus()
      })
  }

  private projection(): NetxopsCardState {
    return {
      ...this.form.shell(),
      apiUrl: this.form.field('apiUrl'),
      lang: this.form.field('lang'),
      nmsProvider: this.form.field('nmsProvider'),
      groupOpsInPreset: this.form.field('groupOpsInPreset'),
      groupOpsPublic: this.form.field('groupOpsPublic'),
      groupTopologyInPreset: this.form.field('groupTopologyInPreset'),
      groupTopologyPublic: this.form.field('groupTopologyPublic'),
      alarmPushEnabled: this.form.field('alarmPushEnabled'),
      alarmDeliverDsh: this.form.field('alarmDeliverDsh'),
      alarmDeliverIm: this.form.field('alarmDeliverIm'),
      imTargets: this.form.field('imTargets'),
      imBotId: this.form.field('imBotId'),
      imTargetId: this.form.field('imTargetId'),
      apiToken: this.form.field(API_TOKEN_FIELD),
      apiTokenConfigured: this.credential.configured,
      apiTokenWritable: this.credential.remoteReady && this.credential.writable,
      apiTokenRemoteReady: this.credential.remoteReady,
      alarmPushStatus: this.alarmPushStatus,
      imDeliveryCatalog: this.imDeliveryCatalog,
      sessionsExportStatus: this.sessionsExportStatus,
      sessionsExportBusy: this.sessionsExportBusy,
      sessionsExportError: this.sessionsExportError,
      sessionsExportLastFile: this.sessionsExportLastFile,
    }
  }

  private credentials(): CredentialsRemote | undefined {
    return this.ctx.get('remote.credentials') as CredentialsRemote | undefined
  }

  private async readCredential(): Promise<void> {
    const ref = refOf(this.scope.getSnapshot())
    const api = this.credentials()
    if (api === undefined) {
      if (ref !== this.credential.ref || this.credential.remoteReady) {
        this.credential = {
          ref,
          configured: false,
          writable: false,
          remoteReady: false,
        }
        this.store.set(this.projection())
      }
      return
    }
    if (ref !== this.credential.ref) {
      this.credential = { ref, configured: false, writable: true, remoteReady: true }
      this.store.set(this.projection())
    }
    const response = await api.describe([ref])
    if (!response.ok || ref !== refOf(this.scope.getSnapshot())) return
    const view = response.value?.[ref]
    const next: CredentialState = {
      ref,
      configured: view?.configured ?? false,
      writable: view?.writable ?? true,
      remoteReady: true,
    }
    if (
      next.configured === this.credential.configured
      && next.writable === this.credential.writable
      && next.remoteReady === this.credential.remoteReady
    ) return
    this.credential = next
    this.store.set(this.projection())
  }

  refreshCredential(ref: string): void {
    if (ref !== this.credential.ref) return
    void this.readCredential()
  }

  inject(): NetxopsCardFace {
    return {
      hooks: { netxopsCard: this.store },
      ...this.form.actions(),
      exportAllSessions: () => { this.exportAllSessions() },
    }
  }

  private async writeToken(value: string): Promise<boolean> {
    const api = this.credentials()
    if (api === undefined) return false
    await api.set(refOf(this.scope.getSnapshot()), value)
    await this.readCredential()
    return this.credential.configured
  }
}

function refOf(snapshot: SettingsScopeSnapshot<NetxopsSettings>): string {
  const declared = snapshot.value?.tokenCredentialRef
  return declared !== undefined && declared.length > 0 ? declared : DEFAULT_TOKEN_REF
}
