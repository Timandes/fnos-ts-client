import { randomBytes } from 'node:crypto';

export const FNOS_OAUTH_CLIENT_ID = 'YJNMPJUGA9';
export const FNOS_OAUTH_SCOPES = [
  'trim.user.all', 'trim.file.read', 'trim.file.write', 'trim.download.all',
  'trim.appcenter.all', 'trim.photo.all', 'trim.baidu_netdisk.all',
  'trim.system.all', 'trim.log.all', 'trim.storage.all', 'trim.docker.all',
] as const;

export interface FnosOAuthSession {
  accessToken: string;
  refreshToken: string;
  /** Unix timestamp in seconds. */
  expiresAt: number;
}

export interface FnosPendingAuthorization {
  url: string;
  codeVerifier: string;
  /** Unix timestamp in milliseconds. */
  expiresAt: number;
}

export interface FnosOAuthAdapterOptions {
  endpoint: string;
  deviceId?: string;
  deviceName?: string;
  deviceModel?: string;
  deviceOs?: string;
  clientId?: string;
  scopes?: readonly string[];
  allowInsecureHttp?: boolean;
  fetch?: typeof fetch;
}

interface FnosTokenEnvelope {
  code?: number;
  msg?: string;
  data?: {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    expires_at?: number;
  };
}

/** fnOS-specific OAuth endpoints, parameters, and token envelopes. */
export class FnosOAuthAdapter {
  readonly endpoint: URL;
  readonly clientId: string;
  readonly deviceId: string;
  readonly deviceName: string;
  readonly deviceModel: string;
  readonly deviceOs: string;
  readonly scopes: readonly string[];
  readonly allowInsecureHttp: boolean;
  private readonly fetcher: typeof fetch;

  constructor(options: FnosOAuthAdapterOptions) {
    const endpoint = new URL(options.endpoint);
    if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash || endpoint.pathname !== '/') {
      throw new TypeError('endpoint must be an origin without credentials, path, query, or hash');
    }
    if (endpoint.protocol !== 'https:' && !(endpoint.protocol === 'http:' && options.allowInsecureHttp)) {
      throw new TypeError('HTTPS is required unless allowInsecureHttp is true');
    }
    this.endpoint = endpoint;
    this.allowInsecureHttp = options.allowInsecureHttp === true;
    this.clientId = options.clientId ?? FNOS_OAUTH_CLIENT_ID;
    this.deviceId = options.deviceId ?? `fnos-ts-client-${randomBytes(8).toString('hex')}`;
    this.deviceName = options.deviceName ?? 'fnos-ts-client';
    this.deviceModel = options.deviceModel ?? 'CLI';
    this.deviceOs = options.deviceOs ?? (process.platform === 'darwin' ? 'macOS' : process.platform === 'win32' ? 'Windows' : 'Linux');
    this.scopes = options.scopes ?? FNOS_OAUTH_SCOPES;
    this.fetcher = options.fetch ?? fetch;
  }

  async createAuthorizationRequest(): Promise<FnosPendingAuthorization> {
    const oauth = await import('oauth4webapi');
    const codeVerifier = oauth.generateRandomCodeVerifier();
    const codeChallenge = await oauth.calculatePKCECodeChallenge(codeVerifier);
    const url = new URL('/signin', this.endpoint);
    url.searchParams.set('client_id', this.clientId);
    url.searchParams.set('scope', this.scopes.join(' '));
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('device_id', this.deviceId);
    url.searchParams.set('device_name', this.deviceName);
    url.searchParams.set('device_model', this.deviceModel);
    return { url: url.href.replace(/\+/g, '%20'), codeVerifier, expiresAt: Date.now() + 5 * 60 * 1000 };
  }

  async exchangeCode(code: string, pending: FnosPendingAuthorization): Promise<FnosOAuthSession> {
    if (!code.trim()) throw new TypeError('authorization code is required');
    if (Date.now() >= pending.expiresAt) throw new Error('authorization code expired; restart authorization');
    return this.requestToken('/oauthapi/third-part/token', {
      client_id: this.clientId,
      code: code.trim(),
      code_verifier: pending.codeVerifier,
      device_id: this.deviceId,
      device_name: this.deviceName,
      device_model: this.deviceModel,
      device_os: this.deviceOs,
    });
  }

  async refresh(session: FnosOAuthSession): Promise<FnosOAuthSession> {
    if (!session.refreshToken) throw new Error('refresh token is unavailable; restart authorization');
    return this.requestToken('/oauthapi/refresh', {
      client_id: this.clientId,
      device_id: this.deviceId,
      refresh_token: session.refreshToken,
    }, session.refreshToken);
  }

  private async requestToken(path: string, body: Record<string, string>, oldRefreshToken?: string): Promise<FnosOAuthSession> {
    const response = await this.fetcher(new URL(path, this.endpoint), {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify(body),
      redirect: 'manual',
    });
    let envelope: FnosTokenEnvelope;
    try {
      envelope = await response.json() as FnosTokenEnvelope;
    } catch {
      throw new Error(`fnOS OAuth endpoint returned invalid JSON (HTTP ${response.status})`);
    }
    if (!response.ok || !envelope.data || typeof envelope.data.access_token !== 'string') {
      throw new Error(`fnOS OAuth request failed (HTTP ${response.status}, code ${String(envelope.code ?? 'unknown')})`);
    }
    const refreshToken = envelope.data.refresh_token ?? oldRefreshToken;
    if (!refreshToken) throw new Error('fnOS OAuth response did not include a refresh token');
    const rawExpiry = envelope.data.expires_at;
    const expiresAt = typeof rawExpiry === 'number' && Number.isFinite(rawExpiry)
      ? (rawExpiry > 1e12 ? Math.floor(rawExpiry / 1000) : Math.floor(rawExpiry))
      : Math.floor(Date.now() / 1000) + (envelope.data.expires_in ?? 0);
    if (expiresAt <= Math.floor(Date.now() / 1000)) throw new Error('fnOS OAuth response has no valid expiry');
    return { accessToken: envelope.data.access_token, refreshToken, expiresAt };
  }
}
