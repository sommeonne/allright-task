import type { APIRequestContext } from '@playwright/test';
import { type ApiResult, authHeaders, toApiResult } from '@api/http';

export type BookingFilter = {
  firstname?: string;
  lastname?: string;
  checkin?: string;
  checkout?: string;
};

/**
 * One method per restful-booker booking endpoint.
 * Methods never assert and never throw on an error status, so negative tests use them too.
 * Payloads are typed as `object` on purpose: negative tests send invalid bodies.
 */
export class BookingClient {
  constructor(private readonly request: APIRequestContext) {}

  /** POST /booking */
  async create(data: object): Promise<ApiResult> {
    return toApiResult(await this.request.post('/booking', { data }));
  }

  /** GET /booking/{id} */
  async get(id: number): Promise<ApiResult> {
    return toApiResult(await this.request.get(`/booking/${id}`));
  }

  /** GET /booking, optionally filtered by name and dates (YYYY-MM-DD) */
  async list(filter: BookingFilter = {}): Promise<ApiResult> {
    return toApiResult(await this.request.get('/booking', { params: filter }));
  }

  /** PUT /booking/{id} — full update */
  async update(id: number, data: object, token?: string): Promise<ApiResult> {
    return toApiResult(
      await this.request.put(`/booking/${id}`, { data, headers: authHeaders(token) }),
    );
  }

  /** PATCH /booking/{id} — partial update */
  async patch(id: number, data: object, token?: string): Promise<ApiResult> {
    return toApiResult(
      await this.request.patch(`/booking/${id}`, { data, headers: authHeaders(token) }),
    );
  }

  /** DELETE /booking/{id} */
  async delete(id: number, token?: string): Promise<ApiResult> {
    return toApiResult(
      await this.request.delete(`/booking/${id}`, { headers: authHeaders(token) }),
    );
  }
}
