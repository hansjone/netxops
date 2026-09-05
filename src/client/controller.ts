/**
 * Staged form over settings namespace `netxops` + optional credential NETX_API_TOKEN.
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type { SettingsScope, SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { SnapshotStore } from './snapshot-store.ts'
import {
  CardForm, textField, booleanField,
  type CardActions, type CardFieldState, type CardShell,
} from './card-form.ts'
import {
  fetchAlarmPushStatus,
  type AlarmPushRpcCall,
  type AlarmPushStatus,
} from './alarm-push-status-view.ts'

export const NETXOPS_NS = 'netxops'
const DEFAULT_TOKEN_REF = 'NETX_API_TOKEN'
const API_TOKEN_FIELD = 'apiToken'
const STATUS_POLL_MS = 2_000

export interface NetxopsSettings {
  apiUrl?: string
  lang?: string
  tokenCredentialRef?: string
  alarmPushEnabled?: boolean
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
  alarmPushEnabled: CardFieldState
  apiToken: CardFieldState
  apiTokenConfigured: boolean
  apiTokenWritable: boolean
  apiTokenRemoteReady: boolean
  /** Host WSS status when Connection RPC is available; otherwise null. */
  alarmPushStatus: AlarmPushStatus | null
}

export interface NetxopsCardFace extends CardActions {
  hooks: {
    netxopsCard: SnapshotStore<NetxopsCardState>
  }
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
  private pollTimer: ReturnType<typeof setInterval> | undefined
  private pollInFlight = false

  constructor(
    private readonly scope: SettingsScope<NetxopsSettings>,
    private readonly ctx: ClientContext,
  ) {
    this.form = new CardForm(
      scope,
      [textField('apiUrl'), textField('lang'), booleanField('alarmPushEnabled')],
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
      if (this.alarmPushStatus !== null) {
        this.alarmPushStatus = null
        this.store.set(this.projection())
      }
      return
    }
    this.startStatusPoll()
    void this.refreshAlarmPushStatus()
  }

  private startStatusPoll(): void {
    if (this.pollTimer !== undefined) return
    this.pollTimer = setInterval(() => { void this.refreshAlarmPushStatus() }, STATUS_POLL_MS)
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

  private projection(): NetxopsCardState {
    return {
      ...this.form.shell(),
      apiUrl: this.form.field('apiUrl'),
      lang: this.form.field('lang'),
      alarmPushEnabled: this.form.field('alarmPushEnabled'),
      apiToken: this.form.field(API_TOKEN_FIELD),
      apiTokenConfigured: this.credential.configured,
      apiTokenWritable: this.credential.remoteReady && this.credential.writable,
      apiTokenRemoteReady: this.credential.remoteReady,
      alarmPushStatus: this.alarmPushStatus,
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
    return { hooks: { netxopsCard: this.store }, ...this.form.actions() }
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
