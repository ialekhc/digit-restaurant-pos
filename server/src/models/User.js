import { createPostgresModel, hashUserPasswordIfChanged, userMethods } from './base/PostgresModel.js';

export const User = createPostgresModel('User', {
  collection: 'users',
  unique: [['email']],
  defaults: {
    role: 'WAITER',
    phone: '',
    isActive: true,
    ownerUser: null
  },
  preSave: hashUserPasswordIfChanged,
  methods: userMethods
});
