import { createPostgresModel } from './base/PostgresModel.js';

export const CATEGORY_MENU_TYPES = ['FOOD', 'DRINK', 'SMOKE'];

export const Category = createPostgresModel('Category', {
  collection: 'categories',
  defaults: {
    description: '',
    menuType: 'FOOD',
    isActive: true
  },
  unique: [['restaurantId', 'name', 'menuType']]
});
