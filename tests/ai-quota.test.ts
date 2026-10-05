import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../api/middlewares/authMiddleware.ts';
import { aiDailyQuota } from '../api/middlewares/aiQuota.ts';

type ResMock = {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
  status(code: number): ResMock;
  json(payload: unknown): ResMock;
  setHeader(name: string, value: string): void;
};

const makeRes = (): ResMock => {
  const res: ResMock = {
    statusCode: 200,
    headers: {},
    body: undefined,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
  };
  return res;
};

const runQuota = (uid: string | undefined) => {
  const req = { user: uid ? { uid } : undefined } as unknown as AuthenticatedRequest;
  const res = makeRes();
  let nextCalls = 0;
  aiDailyQuota(req, res as unknown as Response, (() => {
    nextCalls += 1;
  }) as NextFunction);
  return { res, nextCalls };
};

test('rejects unauthenticated requests', () => {
  const { res, nextCalls } = runQuota(undefined);
  assert.equal(nextCalls, 0);
  assert.equal(res.statusCode, 401);
});

test('allows requests under the daily budget and reports remaining', () => {
  const first = runQuota('quota-ok-user');
  assert.equal(first.nextCalls, 1);
  assert.equal(first.res.headers['X-AI-Quota-Remaining'], '49');
});

test('blocks the 51st request in the window with 429 and Retry-After', () => {
  const uid = 'quota-limit-user';
  for (let i = 0; i < 50; i++) {
    const attempt = runQuota(uid);
    assert.equal(attempt.nextCalls, 1, `request ${i + 1} should pass`);
  }
  const blocked = runQuota(uid);
  assert.equal(blocked.nextCalls, 0);
  assert.equal(blocked.res.statusCode, 429);
  assert.ok(blocked.res.headers['Retry-After']);
  assert.match(String((blocked.res.body as { error?: string }).error), /Daily AI analysis limit/);
});

test('quotas are tracked per user', () => {
  const other = runQuota('quota-other-user');
  assert.equal(other.nextCalls, 1);
});
