import multer from 'multer';
import crypto from 'node:crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = process.env.UPLOAD_DIR || path.resolve(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${allowedImageTypes.get(file.mimetype)}`)
});

const allowedImageTypes = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif']
]);

const fileFilter = (_req, file, cb) => {
  if (allowedImageTypes.has(file.mimetype)) {
    cb(null, true);
  } else {
    const error = new Error('Only JPEG, PNG, WebP, and GIF images are allowed');
    error.statusCode = 400;
    cb(error);
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
});
