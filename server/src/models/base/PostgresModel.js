import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { pool } from '../../config/postgres.js';

const registry = new Map();

const generateId = () => crypto.randomBytes(12).toString('hex');

const clone = (value) => JSON.parse(JSON.stringify(value ?? null));

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date) && !(value instanceof RegExp);

const getPath = (source, path) => {
  const parts = String(path).split('.');
  const walk = (value, index) => {
    if (index >= parts.length) return value;
    if (Array.isArray(value)) return value.flatMap((item) => walk(item, index)).filter((item) => typeof item !== 'undefined');
    if (value == null) return undefined;
    return walk(value[parts[index]], index + 1);
  };
  return walk(source, 0);
};

const setPath = (target, path, value) => {
  const parts = String(path).split('.');
  let cursor = target;
  parts.slice(0, -1).forEach((part) => {
    if (!isPlainObject(cursor[part])) cursor[part] = {};
    cursor = cursor[part];
  });
  cursor[parts.at(-1)] = value;
};

const setPopulatePath = (target, path, value) => {
  const parts = String(path).split('.');
  const walk = (current, index, nextValue) => {
    if (index === parts.length - 1) {
      current[parts[index]] = nextValue;
      return;
    }

    const key = parts[index];
    if (Array.isArray(current[key]) && Array.isArray(nextValue)) {
      current[key].forEach((item, itemIndex) => walk(item, index + 1, nextValue[itemIndex]));
      return;
    }

    if (current[key]) walk(current[key], index + 1, nextValue);
  };
  walk(target, 0, value);
};

const unsetPath = (target, path) => {
  const parts = String(path).split('.');
  let cursor = target;
  parts.slice(0, -1).forEach((part) => {
    cursor = cursor?.[part];
  });
  if (cursor) delete cursor[parts.at(-1)];
};

const normalizeComparable = (value) => {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed) && /^\d{4}-\d{2}-\d{2}T?/.test(value)) return parsed;
  }
  return value;
};

const equals = (left, right) => {
  if (left && typeof left === 'object' && '_id' in left) return equals(left._id, right);
  if (right && typeof right === 'object' && '_id' in right) return equals(left, right._id);
  return String(left) === String(right);
};

const matchValue = (actual, expected, root) => {
  if (Array.isArray(actual)) return actual.some((item) => matchValue(item, expected, root));
  if (expected instanceof RegExp) return expected.test(String(actual ?? ''));

  if (isPlainObject(expected)) {
    if ('$exists' in expected) return expected.$exists ? typeof actual !== 'undefined' : typeof actual === 'undefined';
    if ('$in' in expected) return expected.$in.some((item) => equals(actual, item));
    if ('$nin' in expected) return !expected.$nin.some((item) => equals(actual, item));
    if ('$ne' in expected) return !equals(actual, expected.$ne);
    if ('$regex' in expected) {
      const flags = expected.$options || undefined;
      return new RegExp(expected.$regex, flags).test(String(actual ?? ''));
    }
    if ('$gte' in expected && normalizeComparable(actual) < normalizeComparable(expected.$gte)) return false;
    if ('$gt' in expected && normalizeComparable(actual) <= normalizeComparable(expected.$gt)) return false;
    if ('$lte' in expected && normalizeComparable(actual) > normalizeComparable(expected.$lte)) return false;
    if ('$lt' in expected && normalizeComparable(actual) >= normalizeComparable(expected.$lt)) return false;
    if ('$lte' in expected || '$lt' in expected || '$gte' in expected || '$gt' in expected) return true;
  }

  return equals(actual, expected);
};

const matchExpr = (doc, expr) => {
  if (!expr?.$lte) return true;
  const [leftPath, rightPath] = expr.$lte;
  const left = typeof leftPath === 'string' && leftPath.startsWith('$') ? getPath(doc, leftPath.slice(1)) : leftPath;
  const right = typeof rightPath === 'string' && rightPath.startsWith('$') ? getPath(doc, rightPath.slice(1)) : rightPath;
  return Number(left || 0) <= Number(right || 0);
};

export const matchesQuery = (doc, query = {}) => {
  if (!query || Object.keys(query).length === 0) return true;
  return Object.entries(query).every(([key, expected]) => {
    if (key === '$or') return expected.some((branch) => matchesQuery(doc, branch));
    if (key === '$and') return expected.every((branch) => matchesQuery(doc, branch));
    if (key === '$expr') return matchExpr(doc, expected);
    return matchValue(getPath(doc, key), expected, doc);
  });
};

const compareValues = (left, right) => {
  const a = normalizeComparable(left);
  const b = normalizeComparable(right);
  if (a > b) return 1;
  if (a < b) return -1;
  return 0;
};

const projectDoc = (doc, selection) => {
  if (!selection) return doc;
  const fields = Array.isArray(selection) ? selection : String(selection).split(/\s+/).filter(Boolean);
  if (!fields.length) return doc;
  const isExclude = fields.every((field) => field.startsWith('-'));
  const data = clone(doc);

  if (isExclude) {
    fields.forEach((field) => unsetPath(data, field.slice(1)));
    return data;
  }

  const projected = { _id: data._id };
  fields.forEach((field) => {
    if (field === '_id') return;
    const value = getPath(data, field);
    if (typeof value !== 'undefined') setPath(projected, field, value);
  });
  return projected;
};

const applyUpdate = (doc, update = {}) => {
  const next = doc;
  const operatorKeys = Object.keys(update).filter((key) => key.startsWith('$'));
  if (!operatorKeys.length) {
    Object.entries(update).forEach(([key, value]) => {
      setPath(next, key, value);
    });
    return next;
  }

  Object.entries(update.$set || {}).forEach(([key, value]) => setPath(next, key, value));
  Object.entries(update.$inc || {}).forEach(([key, value]) => {
    setPath(next, key, Number(getPath(next, key) || 0) + Number(value || 0));
  });
  Object.keys(update.$unset || {}).forEach((key) => unsetPath(next, key));
  return next;
};

const dehydrateRefs = (data, refs) => {
  Object.keys(refs).forEach((path) => {
    const value = getPath(data, path);
    if (Array.isArray(value)) {
      setPopulatePath(
        data,
        path,
        value.map((item) => (item && typeof item === 'object' && item._id ? item._id : item))
      );
    } else if (value && typeof value === 'object' && value._id) {
      setPath(data, path, value._id);
    }
  });
  return data;
};

const attachArrayHelpers = (array) => {
  Object.defineProperty(array, 'id', {
    enumerable: false,
    configurable: true,
    value(id) {
      return this.find((item) => equals(item?._id, id));
    }
  });

  array.forEach((item) => {
    if (isPlainObject(item)) {
      if (!item._id) item._id = generateId();
      Object.defineProperty(item, 'deleteOne', {
        enumerable: false,
        configurable: true,
        value() {
          const index = array.findIndex((row) => equals(row?._id, item._id));
          if (index >= 0) array.splice(index, 1);
        }
      });
      hydrateNested(item);
    }
  });
};

const hydrateNested = (value) => {
  if (!value || typeof value !== 'object') return;
  Object.values(value).forEach((child) => {
    if (Array.isArray(child)) attachArrayHelpers(child);
    else if (isPlainObject(child)) hydrateNested(child);
  });
};

const normalizeNewDocument = (doc) => {
  const now = new Date().toISOString();
  const next = clone(doc) || {};
  next._id = next._id || generateId();
  next.createdAt = next.createdAt || now;
  next.updatedAt = next.updatedAt || now;
  hydrateNested(next);
  return next;
};

class PostgresDocument {
  constructor(model, data) {
    Object.defineProperty(this, '$model', { enumerable: false, value: model });
    Object.defineProperty(this, '$original', { enumerable: false, writable: true, value: clone(data) });
    Object.assign(this, clone(data));
    hydrateNested(this);
  }

  get id() {
    return this._id;
  }

  isModified(path) {
    if (!path) return JSON.stringify(this.toJSON()) !== JSON.stringify(this.$original);
    return JSON.stringify(getPath(this.toJSON(), path)) !== JSON.stringify(getPath(this.$original, path));
  }

  toJSON() {
    const data = {};
    Object.keys(this).forEach((key) => {
      data[key] = this[key];
    });
    return data;
  }

  toObject() {
    return this.toJSON();
  }

  async save() {
    await this.$model.saveDocument(this);
    this.$original = clone(this.toJSON());
    return this;
  }

  async deleteOne() {
    await this.$model.deleteById(this._id);
  }
}

class Query {
  constructor(model, { type, query = {}, id = null, update = null, options = {} }) {
    this.model = model;
    this.type = type;
    this.query = query;
    this.id = id;
    this.update = update;
    this.options = options;
    this.populates = [];
    this.selection = null;
    this.sortSpec = null;
    this.limitCount = null;
  }

  populate(path, select) {
    if (typeof path === 'object') this.populates.push(path);
    else this.populates.push({ path, select });
    return this;
  }

  select(selection) {
    this.selection = selection;
    return this;
  }

  sort(sortSpec) {
    this.sortSpec = sortSpec;
    return this;
  }

  limit(count) {
    this.limitCount = Number(count);
    return this;
  }

  async exec() {
    let result;
    if (this.type === 'find') result = await this.model.runFind(this.query);
    if (this.type === 'findOne') {
      const rows = this.applySort(await this.model.runFind(this.query));
      result = rows[0] || null;
    }
    if (this.type === 'findById') result = await this.model.runFindById(this.id);
    if (this.type === 'findByIdAndUpdate') result = await this.model.runFindByIdAndUpdate(this.id, this.update, this.options);

    if (Array.isArray(result)) {
      result = this.applySort(result);
      if (Number.isFinite(this.limitCount)) result = result.slice(0, this.limitCount);
      result = await Promise.all(result.map((doc) => this.applyPopulateAndSelect(doc)));
      return result;
    }

    return this.applyPopulateAndSelect(result);
  }

  applySort(rows) {
    if (!this.sortSpec) return rows;
    const entries = Object.entries(this.sortSpec);
    return [...rows].sort((left, right) => {
      for (const [path, direction] of entries) {
        const comparison = compareValues(getPath(left, path), getPath(right, path));
        if (comparison !== 0) return Number(direction) < 0 ? -comparison : comparison;
      }
      return 0;
    });
  }

  async applyPopulateAndSelect(doc) {
    if (!doc) return null;
    let data = doc;
    if (this.selection && !String(this.selection).trim().startsWith('-')) {
      const populateRoots = this.populates.map((populate) => populate.path.split('.')[0]);
      data = this.model.hydrate(projectDoc(data, `${this.selection} ${populateRoots.join(' ')}`));
    }
    for (const populate of this.populates) {
      data = await this.model.populateDocument(data, populate);
    }
    if (this.selection && String(this.selection).trim().startsWith('-')) {
      data = this.model.hydrate(projectDoc(data, this.selection));
    }
    return data;
  }

  then(resolve, reject) {
    return this.exec().then(resolve, reject);
  }

  catch(reject) {
    return this.exec().catch(reject);
  }
}

export const createPostgresModel = (name, options = {}) => {
  const collection = options.collection || name.toLowerCase();

  const model = {
    modelName: name,
    collection,
    refs: options.refs || {},
    unique: options.unique || [],
    defaults: options.defaults || {},
    preSave: options.preSave,
    methods: options.methods || {},

    hydrate(data) {
      if (!data) return null;
      const doc = new PostgresDocument(model, data);
      Object.entries(model.methods).forEach(([key, value]) => {
        Object.defineProperty(doc, key, { enumerable: false, configurable: true, value: value.bind(doc) });
      });
      return doc;
    },

    applyDefaults(data) {
      const next = data;
      Object.entries(model.defaults).forEach(([path, value]) => {
        if (typeof getPath(next, path) === 'undefined') {
          setPath(next, path, typeof value === 'function' ? value() : clone(value));
        }
      });
      return next;
    },

    async allRaw() {
      const { rows } = await pool.query(
        'SELECT data FROM app_documents WHERE collection = $1 ORDER BY created_at ASC',
        [collection]
      );
      return rows.map((row) => row.data);
    },

    async runFind(query = {}) {
      return (await model.allRaw()).filter((doc) => matchesQuery(doc, query)).map((doc) => model.hydrate(doc));
    },

    async runFindById(id) {
      if (!id) return null;
      const { rows } = await pool.query('SELECT data FROM app_documents WHERE collection = $1 AND id = $2', [
        collection,
        String(id)
      ]);
      return model.hydrate(rows[0]?.data);
    },

    async runFindByIdAndUpdate(id, update, options = {}) {
      const doc = await model.runFindById(id);
      if (!doc) return null;
      applyUpdate(doc, update);
      await doc.save();
      return options.new === false ? null : doc;
    },

    async saveDocument(document) {
      if (model.preSave) await model.preSave(document);
      const data = clone(document.toJSON ? document.toJSON() : document);
      model.applyDefaults(data);
      dehydrateRefs(data, model.refs);
      data.updatedAt = new Date().toISOString();
      hydrateNested(data);
      await model.ensureUnique(data);
      await pool.query(
        `INSERT INTO app_documents (collection, id, data, created_at, updated_at)
         VALUES ($1, $2, $3, COALESCE($4::timestamptz, NOW()), NOW())
         ON CONFLICT (collection, id)
         DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        [collection, String(data._id), data, data.createdAt]
      );
      Object.assign(document, data);
      hydrateNested(document);
      return document;
    },

    async ensureUnique(data) {
      for (const paths of model.unique) {
        const existing = (await model.allRaw()).find((row) => {
          if (equals(row._id, data._id)) return false;
          return paths.every((path) => equals(getPath(row, path), getPath(data, path)));
        });
        if (existing) {
          const error = new Error(`Duplicate value for unique fields: ${paths.join(', ')}`);
          error.code = 11000;
          throw error;
        }
      }
    },

    async deleteById(id) {
      await pool.query('DELETE FROM app_documents WHERE collection = $1 AND id = $2', [collection, String(id)]);
    },

    async create(payload) {
      if (Array.isArray(payload)) return Promise.all(payload.map((item) => model.create(item)));
      const doc = model.hydrate(model.applyDefaults(normalizeNewDocument(payload)));
      await doc.save();
      return doc;
    },

    async insertMany(rows) {
      return Promise.all(rows.map((row) => model.create(row)));
    },

    find(query = {}) {
      return new Query(model, { type: 'find', query });
    },

    findOne(query = {}) {
      return new Query(model, { type: 'findOne', query });
    },

    findById(id) {
      return new Query(model, { type: 'findById', id });
    },

    findByIdAndUpdate(id, update, options = {}) {
      return new Query(model, { type: 'findByIdAndUpdate', id, update, options });
    },

    async findByIdAndDelete(id) {
      const doc = await model.runFindById(id);
      if (doc) await model.deleteById(id);
      return doc;
    },

    async deleteMany(query = {}) {
      const docs = await model.runFind(query);
      await Promise.all(docs.map((doc) => model.deleteById(doc._id)));
      return { deletedCount: docs.length };
    },

    async countDocuments(query = {}) {
      return (await model.runFind(query)).length;
    },

    async updateMany(query = {}, update = {}) {
      const docs = await model.runFind(query);
      await Promise.all(
        docs.map(async (doc) => {
          applyUpdate(doc, update);
          await doc.save();
        })
      );
      return { matchedCount: docs.length, modifiedCount: docs.length };
    },

    async populateDocument(document, populate) {
      if (!document) return document;
      if (Array.isArray(populate)) {
        let populatedDocument = document;
        for (const populateItem of populate) {
          populatedDocument = await model.populateDocument(populatedDocument, populateItem);
        }
        return populatedDocument;
      }

      const data = document.toJSON ? document.toJSON() : clone(document);
      const path = populate.path;
      if (!path) return model.hydrate(data);

      const refModelName = model.refs[path] || model.refs[path.split('.')[0]];
      const refModel = registry.get(refModelName);
      if (!refModel) return model.hydrate(data);

      const populateValue = async (value) => {
        if (!value) return value;
        const populated = await refModel.runFindById(value._id || value);
        if (!populated) return value;
        const projected = populate.select ? projectDoc(populated, populate.select) : populated;
        let hydrated = refModel.hydrate(projected);
        if (populate.populate) {
          const nestedPopulates = Array.isArray(populate.populate) ? populate.populate : [populate.populate];
          for (const nestedPopulate of nestedPopulates) {
            hydrated = await refModel.populateDocument(hydrated, nestedPopulate);
          }
        }
        return hydrated;
      };

      const current = getPath(data, path);
      if (Array.isArray(current)) {
        const values = await Promise.all(current.map((item) => populateValue(item)));
        setPopulatePath(data, path, values);
      } else {
        setPath(data, path, await populateValue(current));
      }
      return model.hydrate(data);
    }
  };

  registry.set(name, model);
  return model;
};

export const userMethods = {
  comparePassword(plainPassword) {
    return bcrypt.compare(plainPassword, this.password);
  }
};

export const hashUserPasswordIfChanged = async (user) => {
  if (user.email) user.email = String(user.email).trim().toLowerCase();
  if (!user.password) return;
  if (String(user.password).startsWith('$2')) return;
  user.password = await bcrypt.hash(user.password, 10);
};
