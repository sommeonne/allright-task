import type { APIResponse } from '@playwright/test';

/**
 * What every API client method returns.
 * `json` is the parsed body, or `undefined` when the body is not JSON
 * (restful-booker answers many paths with plain text such as "Created" or "Forbidden").
 */
export type ApiResult<T = unknown> = { status: number; text: string; json: T | undefined };

/** Reads a response without asserting and without throwing on non-2xx or non-JSON bodies. */
export async function toApiResult<T = unknown>(response: APIResponse): Promise<ApiResult<T>> {
  const text = await response.text();
  let json: T | undefined;
  try {
    json = JSON.parse(text) as T;
  } catch {
    json = undefined;
  }
  return { status: response.status(), text, json };
}

/** restful-booker reads the token from a cookie. No token means no header at all. */
export function authHeaders(token?: string): Record<string, string> {
  return token === undefined ? {} : { Cookie: `token=${token}` };
}
