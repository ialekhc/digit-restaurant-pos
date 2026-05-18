import { Router } from 'express';
import {
  bestSellingItemsReport,
  dailySalesReport,
  dashboardReport,
  lowStockReport,
  monthlySalesReport,
  superAdminOverviewReport
} from '../controllers/reportController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { featureGate } from '../middleware/featureGate.js';
import { ROLES } from '../config/constants.js';
import { FEATURE_KEYS } from '../config/planCatalog.js';

const router = Router();

router.use(authenticate);

router.get(
  '/dashboard',
  authorize(ROLES.ADMIN, ROLES.MANAGER, ROLES.CASHIER),
  featureGate(FEATURE_KEYS.BASIC_REPORTS),
  dashboardReport
);
router.get(
  '/daily-sales',
  authorize(ROLES.ADMIN, ROLES.MANAGER, ROLES.CASHIER),
  featureGate(FEATURE_KEYS.BASIC_REPORTS),
  dailySalesReport
);
router.get(
  '/monthly-sales',
  authorize(ROLES.ADMIN, ROLES.MANAGER, ROLES.CASHIER),
  featureGate(FEATURE_KEYS.ADVANCED_SALES_REPORTS),
  monthlySalesReport
);
router.get(
  '/best-selling-items',
  authorize(ROLES.ADMIN, ROLES.MANAGER, ROLES.CASHIER),
  featureGate(FEATURE_KEYS.ADVANCED_SALES_REPORTS),
  bestSellingItemsReport
);
router.get(
  '/low-stock',
  authorize(ROLES.ADMIN, ROLES.MANAGER, ROLES.CASHIER),
  featureGate(FEATURE_KEYS.LOW_STOCK_ALERTS),
  lowStockReport
);
router.get('/super-admin', authorize(ROLES.SUPER_ADMIN), superAdminOverviewReport);

export default router;
