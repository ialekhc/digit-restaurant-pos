import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from '../config/db.js';
import { pool } from '../config/postgres.js';
import { User } from '../models/User.js';
import { Category } from '../models/Category.js';
import { MenuItem } from '../models/MenuItem.js';
import { Table } from '../models/Table.js';
import { Supplier } from '../models/Supplier.js';
import { InventoryItem } from '../models/InventoryItem.js';
import { Customer } from '../models/Customer.js';
import { Order } from '../models/Order.js';
import { Payment } from '../models/Payment.js';
import { PlanConfig } from '../models/PlanConfig.js';
import { Vendor } from '../models/Vendor.js';
import { ROLES } from '../config/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const seed = async () => {
  await connectDB();

  await Promise.all([
    Payment.deleteMany({}),
    Order.deleteMany({}),
    PlanConfig.deleteMany({}),
    Vendor.deleteMany({}),
    User.deleteMany({}),
    Category.deleteMany({}),
    MenuItem.deleteMany({}),
    Table.deleteMany({}),
    Supplier.deleteMany({}),
    InventoryItem.deleteMany({}),
    Customer.deleteMany({})
  ]);

  const users = await User.create([
    {
      name: 'Platform Super Admin',
      email: 'superadmin@restaurant.local',
      password: 'SuperAdmin@12345',
      role: ROLES.SUPER_ADMIN,
      phone: '+10000000000'
    },
    {
      name: 'System Admin',
      email: 'admin@restaurant.local',
      password: 'Admin@12345',
      role: ROLES.ADMIN,
      phone: '+10000000001'
    },
    {
      name: 'Floor Manager',
      email: 'manager@restaurant.local',
      password: 'Manager@12345',
      role: ROLES.MANAGER,
      phone: '+10000000002'
    },
    {
      name: 'Main Cashier',
      email: 'cashier@restaurant.local',
      password: 'Cashier@12345',
      role: ROLES.CASHIER,
      phone: '+10000000003'
    },
    {
      name: 'Lead Waiter',
      email: 'waiter@restaurant.local',
      password: 'Waiter@12345',
      role: ROLES.WAITER,
      phone: '+10000000004'
    },
    {
      name: 'Kitchen Staff',
      email: 'kitchen@restaurant.local',
      password: 'Kitchen@12345',
      role: ROLES.KITCHEN,
      phone: '+10000000005'
    },
    {
      name: 'Lead Barista',
      email: 'barista@restaurant.local',
      password: 'Barista@12345',
      role: ROLES.BARISTA,
      phone: '+10000000007'
    },
    {
      name: 'Inventory Lead',
      email: 'inventory@restaurant.local',
      password: 'Inventory@12345',
      role: ROLES.INVENTORY_MANAGER,
      phone: '+10000000006'
    }
  ]);

  const vendorOwnerUsers = await User.create([
    {
      name: 'Himalayan Bites Owner',
      email: 'vendor.himalayan@restaurant.local',
      password: 'Vendor@12345',
      role: ROLES.RESTAURANT_OWNER,
      phone: '+9779801100001',
      isActive: true
    },
    {
      name: 'Everest Grill Owner',
      email: 'vendor.everest@restaurant.local',
      password: 'Vendor@12345',
      role: ROLES.RESTAURANT_OWNER,
      phone: '+9779801100002',
      isActive: true
    },
    {
      name: 'Terai Cafe Owner',
      email: 'vendor.terai@restaurant.local',
      password: 'Vendor@12345',
      role: ROLES.RESTAURANT_OWNER,
      phone: '+9779801100003',
      isActive: false
    }
  ]);

  await PlanConfig.create({
    activePlanId: 'STANDARD',
    billingCycle: 'monthly',
    addons: [],
    currency: 'NPR',
    profitMargin: '41.6%'
  });

  const now = Date.now();
  const vendors = await Vendor.insertMany([
    {
      vendorName: 'Himalayan Bites',
      contactPerson: 'Rita Adhikari',
      email: 'owner@himalayanbites.local',
      phone: '+9779801000001',
      address: 'Kathmandu',
      isActive: true,
      subscription: {
        planId: 'STANDARD',
        billingCycle: 'monthly',
        amount: 2499,
        addons: ['QR Menu System'],
        status: 'ACTIVE',
        startsOn: new Date(now - 1000 * 60 * 60 * 24 * 90),
        nextBillingDate: new Date(now + 1000 * 60 * 60 * 24 * 15)
      },
      paymentHistory: [
        {
          amount: 2499,
          paymentMethod: 'ONLINE',
          paymentDate: new Date(now - 1000 * 60 * 60 * 24 * 60),
          reference: 'TXN-HB-1001',
          note: 'Monthly subscription'
        },
        {
          amount: 2998,
          paymentMethod: 'ONLINE',
          paymentDate: new Date(now - 1000 * 60 * 60 * 24 * 30),
          reference: 'TXN-HB-1002',
          note: 'Plan + addon'
        }
      ],
      totalPaid: 5497,
      lastPaymentDate: new Date(now - 1000 * 60 * 60 * 24 * 30),
      loginUser: vendorOwnerUsers[0]._id,
      loginEmail: vendorOwnerUsers[0].email,
      loginEnabled: vendorOwnerUsers[0].isActive,
      createdBy: users[0]._id
    },
    {
      vendorName: 'Everest Grill House',
      contactPerson: 'Suman Thapa',
      email: 'admin@everestgrill.local',
      phone: '+9779801000002',
      address: 'Pokhara',
      isActive: true,
      subscription: {
        planId: 'PREMIUM',
        billingCycle: 'monthly',
        amount: 3999,
        addons: ['Online Ordering System', 'WhatsApp Notification'],
        status: 'ACTIVE',
        startsOn: new Date(now - 1000 * 60 * 60 * 24 * 65),
        nextBillingDate: new Date(now + 1000 * 60 * 60 * 24 * 8)
      },
      paymentHistory: [
        {
          amount: 5697,
          paymentMethod: 'ONLINE',
          paymentDate: new Date(now - 1000 * 60 * 60 * 24 * 35),
          reference: 'TXN-EG-1001',
          note: 'Premium plan and addons'
        }
      ],
      totalPaid: 5697,
      lastPaymentDate: new Date(now - 1000 * 60 * 60 * 24 * 35),
      loginUser: vendorOwnerUsers[1]._id,
      loginEmail: vendorOwnerUsers[1].email,
      loginEnabled: vendorOwnerUsers[1].isActive,
      createdBy: users[0]._id
    },
    {
      vendorName: 'Terai Cafe',
      contactPerson: 'Aashish Yadav',
      email: 'ops@teraicafe.local',
      phone: '+9779801000003',
      address: 'Biratnagar',
      isActive: false,
      subscription: {
        planId: 'STARTER',
        billingCycle: 'monthly',
        amount: 1499,
        addons: [],
        status: 'PAUSED',
        startsOn: new Date(now - 1000 * 60 * 60 * 24 * 120),
        nextBillingDate: new Date(now + 1000 * 60 * 60 * 24 * 20)
      },
      paymentHistory: [
        {
          amount: 1499,
          paymentMethod: 'CASH',
          paymentDate: new Date(now - 1000 * 60 * 60 * 24 * 95),
          reference: 'REC-TC-1001',
          note: 'Initial subscription'
        }
      ],
      totalPaid: 1499,
      lastPaymentDate: new Date(now - 1000 * 60 * 60 * 24 * 95),
      loginUser: vendorOwnerUsers[2]._id,
      loginEmail: vendorOwnerUsers[2].email,
      loginEnabled: vendorOwnerUsers[2].isActive,
      createdBy: users[0]._id
    }
  ]);

  await Promise.all(
    vendors.map(async (vendor, index) => {
      const owner = vendorOwnerUsers[index];
      if (!owner) return;
      owner.restaurantId = vendor._id;
      owner.ownerUser = owner._id;
      await owner.save();
    })
  );

  const categories = await Category.insertMany([
    { name: 'Appetizers', description: 'Starter dishes' },
    { name: 'Main Course', description: 'Main dishes' },
    { name: 'Beverages', description: 'Drinks and juices' },
    { name: 'Desserts', description: 'Sweet items' }
  ]);

  const categoryMap = new Map(categories.map((c) => [c.name, c._id]));

  const menuItems = await MenuItem.insertMany([
    {
      name: 'Garlic Bread',
      category: categoryMap.get('Appetizers'),
      description: 'Freshly baked bread with garlic butter',
      price: 4.5,
      preparationTime: 8,
      isAvailable: true
    },
    {
      name: 'Chicken Biryani',
      category: categoryMap.get('Main Course'),
      description: 'Aromatic rice with tender chicken',
      price: 12.0,
      preparationTime: 18,
      isAvailable: true
    },
    {
      name: 'Veg Burger',
      category: categoryMap.get('Main Course'),
      description: 'Grilled vegetable patty burger',
      price: 7.0,
      preparationTime: 12,
      isAvailable: true
    },
    {
      name: 'Lemon Mint Cooler',
      category: categoryMap.get('Beverages'),
      description: 'Refreshing mint and lemon drink',
      price: 3.5,
      preparationTime: 3,
      isAvailable: true
    },
    {
      name: 'Paneer Tikka',
      category: categoryMap.get('Appetizers'),
      description: 'Char-grilled paneer cubes with spices',
      price: 8.0,
      preparationTime: 14,
      isAvailable: true
    },
    {
      name: 'Momo Platter',
      category: categoryMap.get('Main Course'),
      description: 'Steamed momo with chutney',
      price: 6.5,
      preparationTime: 15,
      isAvailable: true
    },
    {
      name: 'Cold Coffee',
      category: categoryMap.get('Beverages'),
      description: 'Chilled coffee with cream',
      price: 4.0,
      preparationTime: 5,
      isAvailable: true
    },
    {
      name: 'Gulab Jamun',
      category: categoryMap.get('Desserts'),
      description: 'Warm gulab jamun with syrup',
      price: 3.0,
      preparationTime: 4,
      isAvailable: true
    }
  ]);

  const tableRows = Array.from({ length: 12 }, (_, i) => ({
    tableNumber: `T-${i + 1}`,
    seatingCapacity: i < 4 ? 2 : i < 8 ? 4 : 6,
    status: i === 0 ? 'OCCUPIED' : i === 1 ? 'RESERVED' : i === 2 ? 'CLEANING' : 'AVAILABLE'
  }));

  const tables = await Table.insertMany(tableRows);

  const suppliers = await Supplier.insertMany([
    {
      name: 'Ramesh Foods Supply',
      phone: '+9779800000011',
      email: 'orders@rameshfoods.local',
      address: 'Kathmandu',
      companyName: 'Ramesh Foods Pvt. Ltd.'
    },
    {
      name: 'Fresh Valley Produce',
      phone: '+9779800000022',
      email: 'sales@freshvalley.local',
      address: 'Lalitpur',
      companyName: 'Fresh Valley'
    },
    {
      name: 'Himalayan Dairy Traders',
      phone: '+9779800000033',
      email: 'dispatch@himalayandairy.local',
      address: 'Bhaktapur',
      companyName: 'Himalayan Dairy'
    }
  ]);

  await InventoryItem.insertMany([
    {
      name: 'Rice',
      category: 'Dry Goods',
      quantity: 40,
      unit: 'kg',
      minimumStockLevel: 20,
      supplier: suppliers[0]._id,
      purchasePrice: 1.2
    },
    {
      name: 'Chicken',
      category: 'Meat',
      quantity: 8,
      unit: 'kg',
      minimumStockLevel: 10,
      supplier: suppliers[0]._id,
      purchasePrice: 4.6
    },
    {
      name: 'Mint Leaves',
      category: 'Vegetables',
      quantity: 2,
      unit: 'kg',
      minimumStockLevel: 3,
      supplier: suppliers[1]._id,
      purchasePrice: 2.2
    },
    {
      name: 'Cooking Oil',
      category: 'Dry Goods',
      quantity: 15,
      unit: 'ltr',
      minimumStockLevel: 8,
      supplier: suppliers[0]._id,
      purchasePrice: 2.8
    },
    {
      name: 'Paneer',
      category: 'Dairy',
      quantity: 6,
      unit: 'kg',
      minimumStockLevel: 5,
      supplier: suppliers[2]._id,
      purchasePrice: 5.0
    }
  ]);

  const customers = await Customer.insertMany([
    {
      name: 'Aarav Shrestha',
      phone: '+9779812345678',
      email: 'aarav@example.local',
      address: 'Kathmandu',
      loyaltyPoints: 25
    },
    {
      name: 'Sita Lama',
      phone: '+9779899988877',
      email: 'sita@example.local',
      address: 'Bhaktapur',
      loyaltyPoints: 10
    },
    {
      name: 'Nabin KC',
      phone: '+9779800012345',
      email: 'nabin@example.local',
      address: 'Pokhara',
      loyaltyPoints: 40
    },
    {
      name: 'Prakriti Rai',
      phone: '+9779844411122',
      email: 'prakriti@example.local',
      address: 'Kathmandu',
      loyaltyPoints: 15
    }
  ]);

  const menuMap = new Map(menuItems.map((item) => [item.name, item]));
  const userByRole = new Map(users.map((user) => [user.role, user]));

  const makeOrderItem = (name, quantity, notes = '') => {
    const item = menuMap.get(name);
    return {
      menuItem: item._id,
      name: item.name,
      price: item.price,
      quantity,
      notes
    };
  };

  const orderDocs = await Order.insertMany([
    {
      orderNumber: 'ORD-1001',
      orderType: 'DINE_IN',
      table: tables[0]._id,
      customer: customers[0]._id,
      items: [makeOrderItem('Garlic Bread', 2), makeOrderItem('Chicken Biryani', 1)],
      subtotal: 21.0,
      discount: 1.0,
      total: 20.0,
      status: 'COMPLETED',
      createdBy: userByRole.get(ROLES.WAITER)._id,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6)
    },
    {
      orderNumber: 'ORD-1002',
      orderType: 'DINE_IN',
      table: tables[1]._id,
      customer: customers[1]._id,
      items: [makeOrderItem('Veg Burger', 2), makeOrderItem('Cold Coffee', 2)],
      subtotal: 22.0,
      discount: 0,
      total: 22.0,
      status: 'READY',
      createdBy: userByRole.get(ROLES.WAITER)._id,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2)
    },
    {
      orderNumber: 'ORD-1003',
      orderType: 'TAKEAWAY',
      customer: customers[2]._id,
      items: [makeOrderItem('Momo Platter', 1), makeOrderItem('Lemon Mint Cooler', 1)],
      subtotal: 10.0,
      discount: 0,
      total: 10.0,
      status: 'PREPARING',
      createdBy: userByRole.get(ROLES.CASHIER)._id,
      createdAt: new Date(Date.now() - 1000 * 60 * 40)
    },
    {
      orderNumber: 'ORD-1004',
      orderType: 'DELIVERY',
      customer: customers[3]._id,
      items: [makeOrderItem('Paneer Tikka', 1), makeOrderItem('Gulab Jamun', 2)],
      subtotal: 14.0,
      discount: 2.0,
      total: 12.0,
      status: 'PENDING',
      createdBy: userByRole.get(ROLES.MANAGER)._id,
      createdAt: new Date(Date.now() - 1000 * 60 * 20)
    },
    {
      orderNumber: 'ORD-1005',
      orderType: 'DINE_IN',
      table: tables[2]._id,
      customer: customers[0]._id,
      items: [makeOrderItem('Chicken Biryani', 1)],
      subtotal: 12.0,
      discount: 0,
      total: 12.0,
      status: 'CANCELLED',
      cancelledReason: 'Customer changed plan',
      createdBy: userByRole.get(ROLES.WAITER)._id,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24)
    }
  ]);

  const orderByNumber = new Map(orderDocs.map((order) => [order.orderNumber, order]));

  await Payment.insertMany([
    {
      order: orderByNumber.get('ORD-1001')._id,
      billNumber: 'BILL-1001',
      paymentMethod: 'CASH',
      amountPaid: 25.0,
      changeAmount: 5.0,
      paymentStatus: 'PAID',
      paidBy: userByRole.get(ROLES.CASHIER)._id,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5)
    },
    {
      order: orderByNumber.get('ORD-1002')._id,
      billNumber: 'BILL-1002',
      paymentMethod: 'CARD',
      amountPaid: 22.0,
      changeAmount: 0,
      paymentStatus: 'PAID',
      paidBy: userByRole.get(ROLES.CASHIER)._id,
      createdAt: new Date(Date.now() - 1000 * 60 * 90)
    }
  ]);

  console.log('Seed completed successfully');
  console.log('Super Admin login: superadmin@restaurant.local / SuperAdmin@12345');
  console.log('Admin login: admin@restaurant.local / Admin@12345');
  console.log('Vendor owner login template: vendor.<name>@restaurant.local / Vendor@12345');
  console.log(
    'Vendor owner logins:',
    vendorOwnerUsers.map((u) => `${u.email} (${u.isActive ? 'Active' : 'Inactive'})`).join(', ')
  );
  console.log('Created users:', users.map((u) => `${u.role}:${u.email}`).join(', '));
  console.log('Dummy data counts:', {
    categories: categories.length,
    menuItems: menuItems.length,
    tables: tables.length,
    suppliers: suppliers.length,
    customers: customers.length,
    orders: orderDocs.length,
    payments: 2,
    vendors: vendors.length
  });

  await pool.end();
};

seed().catch(async (error) => {
  console.error('Seed failed', error);
  await pool.end();
  process.exit(1);
});
