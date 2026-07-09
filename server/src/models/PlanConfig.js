import { createPostgresModel } from './base/PostgresModel.js';

export const PlanConfig = createPostgresModel('PlanConfig', {
  collection: 'plan_configs',
  defaults: {
    activePlanId: 'STANDARD',
    billingCycle: 'monthly',
    addons: [],
    currency: 'NPR',
    profitMargin: '41.6%'
  }
});
