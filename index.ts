import type {
  IntegrationOAuthAuthorization,
  IntegrationOAuthMethodRegistration,
} from '@opencode/plugin/promise/integration';

import v1Plugin, { type AuthOAuthResult as V1LoginResult } from '@bergetai/opencode-auth';
import { Credential, Integration, Plugin } from '@opencode/plugin';

type V1Hooks = Awaited<ReturnType<typeof v1Plugin>>;
type V1Method = NonNullable<V1Hooks['auth']>['methods'][number];
type V1OAuthMethod = Extract<V1Method, { type: 'oauth' }>;

const integrationID = Integration.ID.make('berget');
const refreshUrl = () => `${process.env.BERGET_API_URL || 'https://api.berget.ai'}/v1/auth/refresh`;

export default Plugin.define({
  id: 'berget.auth.v2-adapter',
  async setup(ctx) {
    // v1 only uses `client` to persist refreshed tokens; v2 persists what `refresh` returns
    const v1 = await v1Plugin({ client: { auth: { set: async () => ({}) } } } as never);
    const v1Methods = v1.auth?.methods ?? [];
    const oauthMethods = v1Methods.filter((method) => method.type === 'oauth');

    await ctx.integration.transform((editor) => {
      oauthMethods.forEach((method, index) => editor.method.update(toV2Method(method, index)));
    });
  },
});

function toV2Method(v1Method: V1OAuthMethod, index: number): IntegrationOAuthMethodRegistration {
  // v1 methods carry no id; stored credentials reference this, so keep it position-stable
  const methodID = Integration.MethodID.make(`oauth-${index}`);
  return {
    integrationID,
    method: { id: methodID, type: 'oauth', label: v1Method.label },
    authorize: () => authorize(v1Method, methodID),
    refresh,
  };
}

async function authorize(
  v1Method: V1OAuthMethod,
  methodID: Integration.MethodID,
): Promise<IntegrationOAuthAuthorization> {
  const { url, instructions, method, callback } = await v1Method.authorize();
  // Both Berget flows complete on their own (callback server / device polling)
  if (method !== 'auto') throw new Error(`Unsupported authorize method: ${method}`);

  const waitForLogin = callback as () => Promise<V1LoginResult>;
  const credential = waitForLogin().then((result) => toCredential(result, methodID));
  return { url, instructions, mode: 'auto', callback: credential };
}

function toCredential(result: V1LoginResult, methodID: Integration.MethodID): Credential.OAuth {
  if (result.type === 'failed') throw new Error(result.error ?? 'Authentication failed');
  // v1's result type also covers API keys, which its OAuth methods never return
  if (!('refresh' in result)) throw new Error('Authorization did not return OAuth tokens');

  const { access, refresh, expires } = result;
  return Credential.OAuth.make({ type: 'oauth', methodID, access, refresh, expires });
}

// v1 refreshes inside its custom fetch and doesn't export it
async function refresh(credential: Credential.OAuth): Promise<Credential.OAuth> {
  const response = await fetch(refreshUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: credential.refresh }),
  });
  if (!response.ok) throw new Error(`Berget token refresh failed: HTTP ${response.status}`);

  const { token, expires_in, refresh_token } = (await response.json()) as Record<string, unknown>;
  if (typeof token !== 'string' || typeof expires_in !== 'number') {
    throw new Error('Berget token refresh returned an invalid response');
  }

  return Credential.OAuth.make({
    ...credential,
    access: token,
    expires: Date.now() + expires_in * 1000,
    // Berget may rotate the refresh token
    refresh: typeof refresh_token === 'string' ? refresh_token : credential.refresh,
  });
}
