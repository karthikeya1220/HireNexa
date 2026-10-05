import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSameUser, isAdminUser, canModifyResource } from '../api/utils/auth-helpers.ts';

test('isSameUser matches equal ids only', () => {
  assert.equal(isSameUser('a', 'a'), true);
  assert.equal(isSameUser('a', 'b'), false);
  assert.equal(isSameUser(undefined, 'a'), false);
  assert.equal(isSameUser('a', undefined), false);
  assert.equal(isSameUser(undefined, undefined), false);
});

test('isAdminUser only accepts the admin role', () => {
  assert.equal(isAdminUser('admin'), true);
  assert.equal(isAdminUser('recruiter'), false);
  assert.equal(isAdminUser('user'), false);
  assert.equal(isAdminUser(undefined), false);
  assert.equal(isAdminUser(''), false);
});

test('canModifyResource allows admins and the owner, nobody else', () => {
  assert.equal(canModifyResource('u1', 'u2', 'admin'), true);
  assert.equal(canModifyResource('u1', 'u1', 'user'), true);
  assert.equal(canModifyResource('u1', 'u2', 'recruiter'), false);
  assert.equal(canModifyResource('u1', undefined, 'user'), false);
  assert.equal(canModifyResource(undefined, undefined, undefined), false);
});
