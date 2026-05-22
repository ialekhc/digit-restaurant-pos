import { PURCHASE_TYPES } from '../config/constants.js';
import { InventoryItem } from '../models/InventoryItem.js';
import { PurchaseEntry } from '../models/PurchaseEntry.js';
import { Supplier } from '../models/Supplier.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { generatePurchaseNumber } from '../utils/serialGenerators.js';

const PURCHASE_PAYMENT_MODES = ['CASH', 'CREDIT', 'CARD', 'ONLINE', 'OTHER'];

export const getPurchases = asyncHandler(async (req, res) => {
  const { type = '', search = '', from = '', to = '', limit = 200 } = req.query;

  const query = {};

  if (type) {
    if (!PURCHASE_TYPES.includes(type)) {
      throw new ApiError(400, `Invalid purchase type. Allowed values: ${PURCHASE_TYPES.join(', ')}`);
    }
    query.type = type;
  }

  if (from || to) {
    query.transactionDate = {};
    if (from) {
      const fromDate = new Date(from);
      if (Number.isNaN(fromDate.getTime())) throw new ApiError(400, 'Invalid "from" date');
      query.transactionDate.$gte = fromDate;
    }
    if (to) {
      const toDate = new Date(to);
      if (Number.isNaN(toDate.getTime())) throw new ApiError(400, 'Invalid "to" date');
      toDate.setHours(23, 59, 59, 999);
      query.transactionDate.$lte = toDate;
    }
  }

  if (search) {
    query.$or = [
      { purchaseNumber: { $regex: search, $options: 'i' } },
      { itemName: { $regex: search, $options: 'i' } },
      { invoiceNumber: { $regex: search, $options: 'i' } },
      { notes: { $regex: search, $options: 'i' } }
    ];
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 200, 1), 1000);

  const data = await PurchaseEntry.find(query)
    .populate('inventoryItem', 'name category unit')
    .populate('supplier', 'name companyName')
    .populate('createdBy', 'name email role')
    .sort({ transactionDate: -1, createdAt: -1 })
    .limit(safeLimit);

  res.json({ data });
});

export const createPurchase = asyncHandler(async (req, res) => {
  const {
    type,
    inventoryItem,
    supplier,
    quantity,
    unitPrice,
    totalAmount,
    paymentMode = 'CASH',
    invoiceNumber = '',
    notes = '',
    transactionDate
  } = req.body;

  if (!PURCHASE_TYPES.includes(type)) {
    throw new ApiError(400, `Invalid purchase type. Allowed values: ${PURCHASE_TYPES.join(', ')}`);
  }

  const numericQuantity = Number(quantity);
  if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) {
    throw new ApiError(400, 'Quantity must be greater than 0');
  }

  if (!PURCHASE_PAYMENT_MODES.includes(paymentMode)) {
    throw new ApiError(400, `Invalid payment mode. Allowed values: ${PURCHASE_PAYMENT_MODES.join(', ')}`);
  }

  const inventoryDoc = await InventoryItem.findById(inventoryItem);
  if (!inventoryDoc) throw new ApiError(404, 'Inventory item not found');

  if (supplier) {
    const supplierDoc = await Supplier.findById(supplier);
    if (!supplierDoc) throw new ApiError(404, 'Supplier not found');
  }

  const previousStock = Number(inventoryDoc.quantity || 0);
  const nextStock = type === 'IN' ? previousStock + numericQuantity : previousStock - numericQuantity;
  if (nextStock < 0) {
    throw new ApiError(400, 'Purchase Out cannot reduce stock below 0');
  }

  const parsedUnitPrice = Number(unitPrice);
  const resolvedUnitPrice =
    Number.isFinite(parsedUnitPrice) && parsedUnitPrice >= 0 ? parsedUnitPrice : Number(inventoryDoc.purchasePrice || 0);

  const parsedTotalAmount = Number(totalAmount);
  const resolvedTotalAmount =
    Number.isFinite(parsedTotalAmount) && parsedTotalAmount >= 0
      ? parsedTotalAmount
      : Number((resolvedUnitPrice * numericQuantity).toFixed(2));

  const parsedTransactionDate = transactionDate ? new Date(transactionDate) : new Date();
  if (Number.isNaN(parsedTransactionDate.getTime())) {
    throw new ApiError(400, 'Invalid transaction date');
  }

  const created = await PurchaseEntry.create({
    purchaseNumber: generatePurchaseNumber(),
    type,
    inventoryItem: inventoryDoc._id,
    supplier: supplier || inventoryDoc.supplier || undefined,
    itemName: inventoryDoc.name,
    category: inventoryDoc.category,
    quantity: numericQuantity,
    unit: inventoryDoc.unit,
    unitPrice: resolvedUnitPrice,
    totalAmount: resolvedTotalAmount,
    paymentMode,
    invoiceNumber,
    notes,
    previousStock,
    nextStock,
    transactionDate: parsedTransactionDate,
    createdBy: req.user._id
  });

  inventoryDoc.quantity = nextStock;
  if (type === 'IN') {
    inventoryDoc.purchasePrice = resolvedUnitPrice;
    if (supplier) inventoryDoc.supplier = supplier;
  }
  await inventoryDoc.save();

  const data = await PurchaseEntry.findById(created._id)
    .populate('inventoryItem', 'name category unit')
    .populate('supplier', 'name companyName')
    .populate('createdBy', 'name email role');

  res.status(201).json({ data });
});
