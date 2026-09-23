import type {
  IntegrationOAuthAuthorization,
  IntegrationOAuthMethodRegistration,
} from '@opencode/plugin/promise/integration';

import BergetAuthPlugin, { type AuthOAuthResult } from '@bergetai/opencode-auth';
import { Credential, Integration, Plugin } from '@opencode/plugin';

type Hooks = Awaited<ReturnType<typeof BergetAuthPlugin>>;
type OAuthMethod = Extract<NonNullable<Hooks['auth']>['methods'][number], { type: 'oauth' }>;

const integrationID = Integration.ID.make('berget');
const apiUrl = () => process.env.BERGET_API_URL || 'https://api.berget.ai';

function toCredential(methodID: Integration.MethodID, result: AuthOAuthResult): Credential.OAuth {
  if (result.type === 'failed') throw new Error(result.error ?? 'Authentication failed');
  if (!('refresh' in result)) throw new Error('Authorization did not return OAuth tokens');
  const { access, refresh, expires } = result;
  return Credential.OAuth.make({ type: 'oauth', methodID, access, refresh, expires });
}

// Both Berget flows complete on their own (callback server / device polling)
function toAuthorization(
  methodID: Integration.MethodID,
  result: Awaited<ReturnType<OAuthMethod['authorize']>>,
): IntegrationOAuthAuthorization {
  if (result.method !== 'auto') throw new Error(`Unsupported authorize method: ${result.method}`);
  const callback = result.callback as () => Promise<AuthOAuthResult>;
  const { url, instructions } = result;
  return { url, instructions, mode: 'auto', callback: callback().then((r) => toCredential(methodID, r)) };
}

// v1 refreshes inside its custom fetch and doesn't export it
async function refresh(credential: Credential.OAuth): Promise<Credential.OAuth> {
  const response = await fetch(`${apiUrl()}/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: credential.refresh }),
  });
  if (!response.ok) throw new Error(`Berget token refresh failed: HTTP ${response.status}`);
  const data = (await response.json()) as { token?: unknown; expires_in?: unknown; refresh_token?: unknown };
  if (typeof data.token !== 'string' || typeof data.expires_in !== 'number') {
    throw new Error('Berget token refresh returned an invalid response');
  }
  return Credential.OAuth.make({
    ...credential,
    access: data.token,
    expires: Date.now() + data.expires_in * 1000,
    refresh: typeof data.refresh_token === 'string' ? data.refresh_token : credential.refresh,
  });
}

function oauthMethod(method: OAuthMethod, index: number): IntegrationOAuthMethodRegistration {
  // v1 methods carry no id; stored credentials reference this, so keep it position-stable
  const methodID = Integration.MethodID.make(`oauth-${index}`);
  return {
    integrationID,
    method: { id: methodID, type: 'oauth', label: method.label },
    authorize: async () => toAuthorization(methodID, await method.authorize()),
    refresh,
  };
}

export default Plugin.define({
  id: 'berget.auth.v2-adapter',
  async setup(ctx) {
    // v1 only uses `client` to persist refreshed tokens; v2 persists what `refresh` returns
    const hooks = await BergetAuthPlugin({ client: { auth: { set: async () => ({}) } } } as never);
    const methods = (hooks.auth?.methods ?? []).filter((m): m is OAuthMethod => m.type === 'oauth');
    await ctx.integration.transform((editor) => {
      methods.forEach((method, index) => editor.method.update(oauthMethod(method, index)));
    });
  },
});
