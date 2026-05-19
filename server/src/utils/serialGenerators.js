export const generateOrderNumber = () => {
  const stamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 900 + 100);
  return `ORD-${stamp}-${random}`;
};

export const generateBillNumber = () => {
  const stamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 900 + 100);
  return `BILL-${stamp}-${random}`;
};

export const generatePurchaseNumber = () => {
  const stamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 900 + 100);
  return `PUR-${stamp}-${random}`;
};
