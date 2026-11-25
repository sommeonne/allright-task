import type { APIRequestContext } from '@playwright/test';
import { type ApiResult, toApiResult } from '@api/http';

export class AuthClient {
  constructor(private readonly request: APIRequestContext) {}

  /** POST /auth */
  async createToken(username: string, password: string): Promise<ApiResult> {
    return toApiResult(await this.request.post('/auth', { data: { username, password } }));
  }
}
