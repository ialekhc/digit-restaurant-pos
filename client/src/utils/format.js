export const currency = (value = 0) => {
  return new Intl.NumberFormat('en-NP', {
    style: 'currency',
    currency: 'NPR',
    minimumFractionDigits: 2
  }).format(Number(value || 0));
};

export const formatDateTime = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleString();
};

export const formatDate = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleDateString();
};
