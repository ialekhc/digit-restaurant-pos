import { createPostgresModel } from './base/PostgresModel.js';

export const PRINTER_PURPOSES = ['KITCHEN', 'BAR', 'SMOKE', 'COUNTER'];
export const PRINTER_CONNECTION_TYPES = ['SYSTEM', 'NETWORK', 'QZ_TRAY', 'BROWSER'];

export const Printer = createPostgresModel('Printer', {
  collection: 'printers',
  defaults: {
    name: '',
    purpose: 'KITCHEN',
    printerSystemName: '',
    connectionType: 'SYSTEM',
    ipAddress: '',
    port: '',
    paperWidthMm: 58,
    copies: 1,
    isActive: true,
    lastStatus: 'NOT_CONFIGURED',
    lastError: ''
  },
  unique: [['restaurantId', 'purpose']]
});
