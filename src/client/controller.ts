/**
 * Staged form over settings namespace `netxops` + credential NETX_API_TOKEN.
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SettingsScope, SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import {
  CardForm, textField,
  type CardActions, type CardFieldState, type CardShell,
} from './card-form.ts'

export const NETXOPS_NS = 'netxops'
const DEFAULT_TOKEN_REF = 'NETX_API_TOKEN'
const API_TOKEN_FIELD = 'apiToken'

export interface NetxopsSettings {
  apiUrl?: string
  lang?: string
  pythonCommand?: string
  tokenCredentialRef?: string
}

interface CredentialState {
  ref: string
  configured: boolean
  writable: boolean
}

export interface NetxopsCardState extends CardShell {
  apiUrl: CardFieldState
  lang: CardFieldState
  pythonCommand: CardFieldState
  apiToken: CardFieldState
  apiTokenConfigured: boolean
  apiTokenWritable: boolean
}

export interface NetxopsCardFace extends CardActions {
  hooks: {
    netxopsCard: SnapshotStore<NetxopsCardState>
  }
}

export class NetxopsCardController {
  private readonly form: CardForm<NetxopsSettings>
  private readonly store: SnapshotStore<NetxopsCardState>
  private credential: CredentialState = { ref: '', configured: false, writable: true }

  constructor(
    private readonly scope: SettingsScope<NetxopsSettings>,
    private readonly ctx: ClientContext,
  ) {
    this.form = new CardForm(
      scope,
      [textField('apiUrl'), textField('lang'), textField('pythonCommand')],
      [{ field: API_TOKEN_FIELD, write: text => this.writeToken(text) }],
    )
    this.store = this.form.bind(() => this.projection())
    scope.subscribe(() => { void this.readCredential() })
    void this.readCredential()
  }

  private projection(): NetxopsCardState {
    return {
      ...this.form.shell(),
      apiUrl: this.form.field('apiUrl'),
      lang: this.form.field('lang'),
      pythonCommand: this.form.field('pythonCommand'),
      apiToken: this.form.field(API_TOKEN_FIELD),
      apiTokenConfigured: this.credential.configured,
      apiTokenWritable: this.credential.writable,
    }
  }

  private async readCredential(): Promise<void> {
    const ref = refOf(this.scope.getSnapshot())
    if (ref !== this.credential.ref) {
      this.credential = { ref, configured: false, writable: true }
      this.store.set(this.projection())
    }
    const response = await this.ctx.remote.credentials.describe([ref])
    if (!response.ok || ref !== refOf(this.scope.getSnapshot())) return
    const view = response.value[ref]
    const next: CredentialState = {
      ref,
      configured: view?.configured ?? false,
      writable: view?.writable ?? true,
    }
    if (next.configured === this.credential.configured && next.writable === this.credential.writable) return
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
    await this.ctx.remote.credentials.set(refOf(this.scope.getSnapshot()), value)
    await this.readCredential()
    return this.credential.configured
  }
}

function refOf(snapshot: SettingsScopeSnapshot<NetxopsSettings>): string {
  const declared = snapshot.value?.tokenCredentialRef
  return declared !== undefined && declared.length > 0 ? declared : DEFAULT_TOKEN_REF
}
