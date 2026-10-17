import { randomBytes } from 'node:crypto';
import { FnosOAuthAdapter, type FnosOAuthSession } from './oauth_adapter.js';
import type { FnosRequestClient } from './request_client.js';

export interface FnosOAuthClientOptions {
  fetch?: typeof fetch;
  /** Persist a refreshed session before the new token is used. */
  saveSession?: (session: FnosOAuthSession) => Promise<void>;
}

/** Calls fnOS business APIs through its Bearer-protected HTTP gateway. */
export class FnosOAuthClient implements FnosRequestClient {
  private currentSession: FnosOAuthSession;
  private readonly fetcher: typeof fetch;
  private readonly saveSession?: (session: FnosOAuthSession) => Promise<void>;
  private refreshPromise: Promise<void> | undefined;
  private refreshStorageFailed = false;

  constructor(readonly adapter: FnosOAuthAdapter, session: FnosOAuthSession, options: FnosOAuthClientOptions = {}) {
    this.currentSession = { ...session };
    this.fetcher = options.fetch ?? fetch;
    this.saveSession = options.saveSession;
  }

  get session(): FnosOAuthSession {
    return { ...this.currentSession };
  }

  async requestPayloadWithResponse(req: string, payload: Record<string, unknown>, timeout = 10000): Promise<any> {
    if (!req) throw new TypeError('req is required');
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new TypeError('payload must be an object');
    if (!Number.isFinite(timeout) || timeout <= 0) throw new TypeError('timeout must be positive');
    const request = { ...payload, req, reqid: `${Date.now()}${randomBytes(6).toString('hex')}` };
    if (this.currentSession.expiresAt <= Math.floor(Date.now() / 1000) + 60) await this.refresh();
    const sentToken = this.currentSession.accessToken;
    let response = await this.send(request, timeout, sentToken);
    if (response.status === 401) {
      if (this.currentSession.accessToken === sentToken) await this.refresh();
      response = await this.send(request, timeout, this.currentSession.accessToken);
    }
    if (!response.ok) throw new Error(`fnOS API request failed (HTTP ${response.status})`);
    try {
      const value: unknown = await response.json();
      return Array.isArray(value) && value.length === 1 ? value[0] : value;
    } catch {
      throw new Error('fnOS API returned invalid JSON');
    }
  }

  private async send(request: Record<string, unknown>, timeout: number, token: string): Promise<Response> {
    const oauth = await import('oauth4webapi');
    const headers = new Headers({ accept: 'application/json', 'content-type': 'application/json' });
    try {
      return await oauth.protectedResourceRequest(
        token, 'POST', new URL('/ogh/ac/w', this.adapter.endpoint),
        headers, JSON.stringify(request), {
          signal: AbortSignal.timeout(timeout),
          [oauth.customFetch]: this.fetcher,
          ...(this.adapter.allowInsecureHttp ? { [oauth.allowInsecureRequests]: true } : {}),
        },
      );
    } catch (error) {
      if (error instanceof oauth.WWWAuthenticateChallengeError) return error.response;
      throw error;
    }
  }

  private async refresh(): Promise<void> {
    if (this.refreshStorageFailed) throw new Error('refreshed session could not be saved; restart authorization');
    if (!this.refreshPromise) {
      this.refreshPromise = (async () => {
        const next = await this.adapter.refresh(this.currentSession);
        if (this.saveSession) {
          try { await this.saveSession(next); }
          catch {
            this.refreshStorageFailed = true;
            throw new Error('refreshed session could not be saved; restart authorization');
          }
        }
        this.currentSession = next;
      })().finally(() => { this.refreshPromise = undefined; });
    }
    await this.refreshPromise;
  }
}
