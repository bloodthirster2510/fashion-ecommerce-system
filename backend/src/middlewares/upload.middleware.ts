import type { Response } from 'express';
import multer from 'multer';

export type MulterRequest = Express.Request & {
  fileValidationError?: Error;
};

const storage = multer.memoryStorage();

const fileFilter = (
  req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
    return;
  }

  (req as MulterRequest).fileValidationError = new Error(
    'Only JPEG, PNG, and WEBP images are allowed',
  );
  cb(null, false);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

export const uploadMultiple = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

export const handleMulterError = (error: unknown, res: Response) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File size exceeds 5MB limit' });
    }

    if (error.code === 'LIMIT_PART_COUNT') {
      return res.status(400).json({ message: 'Too many file parts' });
    }

    return res.status(400).json({ message: error.message });
  }

  if (error instanceof Error) {
    return res.status(400).json({ message: error.message });
  }

  return null;
};
