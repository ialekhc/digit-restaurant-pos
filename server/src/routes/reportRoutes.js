import { Router } from 'express';
import {
  bestSellingItemsReport,
  dailySalesReport,
  dashboardReport,
  lowStockReport,
  monthlySalesReport,
  superAdminOverviewReport,
  weeklySalesReport,
  yearlySalesReport
} from '../controllers/reportController.js';
import { authenticate } from '../middleware/auth.js';
import { featureGate } from '../middleware/featureGate.js';
import { FEATURE_KEYS } from '../config/planCatalog.js';
import { PERMISSIONS } from '../config/constants.js';
import { requireAnyPermission, requirePermission } from '../middleware/permissions.js';

const router = Router();

router.use(authenticate);

const salesReportAccess = requireAnyPermission([
  PERMISSIONS.REPORT_OWN_SHIFT,
  PERMISSIONS.REPORT_BRANCH_SALES,
  PERMISSIONS.REPORT_RESTAURANT_SALES
]);

router.get('/dashboard', salesReportAccess, featureGate(FEATURE_KEYS.BASIC_REPORTS), dashboardReport);
router.get('/daily-sales', salesReportAccess, featureGate(FEATURE_KEYS.BASIC_REPORTS), dailySalesReport);
router.get('/monthly-sales', salesReportAccess, featureGate(FEATURE_KEYS.ADVANCED_SALES_REPORTS), monthlySalesReport);
router.get('/weekly-sales', salesReportAccess, featureGate(FEATURE_KEYS.ADVANCED_SALES_REPORTS), weeklySalesReport);
router.get('/yearly-sales', salesReportAccess, featureGate(FEATURE_KEYS.ADVANCED_SALES_REPORTS), yearlySalesReport);
router.get('/best-selling-items', salesReportAccess, featureGate(FEATURE_KEYS.ADVANCED_SALES_REPORTS), bestSellingItemsReport);
router.get('/low-stock', requirePermission(PERMISSIONS.INVENTORY_VIEW), featureGate(FEATURE_KEYS.LOW_STOCK_ALERTS), lowStockReport);
router.get('/super-admin', requirePermission(PERMISSIONS.PLATFORM_VIEW), superAdminOverviewReport);

export default router;
