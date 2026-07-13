export const RECEIPT_SETTINGS_KEY = 'rms_receipt_settings';

const defaultReceiptSettings = {
  businessName: 'Restaurant RMS',
  address: '',
  phone: '',
  email: '',
  footerText: 'Thank you for dining with us.'
};

const normalizeSettings = (settings = {}) => ({
  ...defaultReceiptSettings,
  ...Object.fromEntries(
    Object.entries(settings || {}).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value])
  )
});

export const getReceiptSettings = () => {
  try {
    const raw = localStorage.getItem(RECEIPT_SETTINGS_KEY);
    if (!raw) return defaultReceiptSettings;
    return normalizeSettings(JSON.parse(raw));
  } catch (_error) {
    return defaultReceiptSettings;
  }
};

export const saveReceiptSettings = (settings) => {
  const normalized = normalizeSettings(settings);
  localStorage.setItem(RECEIPT_SETTINGS_KEY, JSON.stringify(normalized));
  return normalized;
};

export const buildReceiptSettingsFromVendor = (vendor = {}) => {
  return normalizeSettings({
    businessName: vendor.vendorName || defaultReceiptSettings.businessName,
    address: vendor.address || '',
    phone: vendor.phone || '',
    email: vendor.email || ''
  });
};
