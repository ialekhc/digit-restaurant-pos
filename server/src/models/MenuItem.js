import { createPostgresModel } from './base/PostgresModel.js';

export const MENU_TYPES = ['FOOD', 'DRINK', 'SMOKE'];

export const MenuItem = createPostgresModel('MenuItem', {
  collection: 'menu_items',
  refs: {
    category: 'Category'
  },
  defaults: {
    description: '',
    image: '',
    preparationTime: 10,
    isAvailable: true,
    menuType: 'FOOD',
    kitchenSection: 'FOOD'
  },
  unique: [['name', 'category', 'menuType']]
});
