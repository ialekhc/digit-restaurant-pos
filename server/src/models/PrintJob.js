import { createPostgresModel } from './base/PostgresModel.js';

export const PRINT_JOB_STATUSES = ['PENDING', 'PROCESSING', 'PRINTED', 'FAILED', 'CANCELLED'];
export const PRINT_DOCUMENT_TYPES = [
  'KITCHEN_PREPARATION_TICKET',
  'BAR_PREPARATION_TICKET',
  'SMOKE_PREPARATION_TICKET',
  'COUNTER_ORDER_BILL',
  'COUNTER_RECEIPT',
  'INITIAL_ORDER',
  'ADDED_ITEMS',
  'CANCELLED_ITEMS',
  'CUSTOMER_RECEIPT',
  'RECEIPT_REPRINT',
  'TEST_PRINT'
];

export const PrintJob = createPostgresModel('PrintJob', {
  collection: 'print_jobs',
  refs: {
    printer: 'Printer',
    order: 'Order',
    payment: 'Payment'
  },
  defaults: {
    printer: null,
    order: null,
    payment: null,
    documentType: 'INITIAL_ORDER',
    station: '',
    payload: {},
    status: 'PENDING',
    attempts: 0,
    errorMessage: '',
    idempotencyKey: '',
    printedAt: null,
    claimedAt: null,
    claimedBy: ''
  },
  unique: [['idempotencyKey']]
});
