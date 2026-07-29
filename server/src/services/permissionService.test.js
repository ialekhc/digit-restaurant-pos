import assert from 'node:assert/strict';
import test from 'node:test';
import { PERMISSIONS, ROLES } from '../config/constants.js';
import { hasPermission, resolveUserAccess } from './permissionService.js';

test('waiters can cancel orders by default', () => {
  const waiter = { role: ROLES.WAITER };

  assert.equal(hasPermission(waiter, PERMISSIONS.ORDER_CANCEL), true);
  assert.ok(resolveUserAccess(waiter).permissions.includes(PERMISSIONS.ORDER_CANCEL));
});

test('an explicit denial can still prevent a waiter from cancelling orders', () => {
  const waiter = {
    role: ROLES.WAITER,
    deniedPermissions: [PERMISSIONS.ORDER_CANCEL]
  };

  assert.equal(hasPermission(waiter, PERMISSIONS.ORDER_CANCEL), false);
});
