import type { RequestHandler, Response } from 'express';
import { fromBuffer } from 'file-type';
import multer from 'multer';

export type MulterRequest = Express.Request & {
  fileValidationError?: Error;
};

const storage = multer.memoryStorage();
const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

const getUploadedFiles = (req: Express.Request) => {
  if (req.file) {
    return [req.file];
  }

  if (!req.files) {
    return [];
  }

  if (Array.isArray(req.files)) {
    return req.files;
  }

  return Object.values(req.files).flat();
};

export const validateUploadedImageContent = async (req: Express.Request) => {
  const files = getUploadedFiles(req);

  for (const file of files) {
    let detectedType: Awaited<ReturnType<typeof fromBuffer>>;

    try {
      detectedType = await fromBuffer(file.buffer);
    } catch {
      return new Error('Uploaded image content must match JPEG, PNG, or WEBP');
    }

    if (
      !detectedType ||
      !allowedMimeTypes.includes(detectedType.mime) ||
      detectedType.mime !== file.mimetype
    ) {
      return new Error('Uploaded image content must match JPEG, PNG, or WEBP');
    }
  }

  return null;
};

const fileFilter = (
  req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
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

export const withMulterErrorHandling = (middleware: RequestHandler): RequestHandler => {
  return (req, res, next) => {
    middleware(req, res, async (error?: unknown) => {
      if (error) {
        handleMulterError(error, res);
        return;
      }

      try {
        const contentValidationError = await validateUploadedImageContent(req);
        if (contentValidationError) {
          handleMulterError(contentValidationError, res);
          return;
        }

        next();
      } catch (validationError) {
        next(validationError);
      }
    });
  };
};
