import type { RequestHandler, Response } from 'express';
import multer from 'multer';

export type MulterRequest = Express.Request & {
  fileValidationError?: Error;
};

const storage = multer.memoryStorage();
const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

const detectImageMimeType = (buffer: Buffer) => {
  if (
    buffer.length >= 8
    && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png';
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 12
    && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
    && buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
};

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
    const detectedMimeType = detectImageMimeType(file.buffer);

    if (
      !detectedMimeType
      || !allowedMimeTypes.includes(detectedMimeType)
      || detectedMimeType !== file.mimetype
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

      const fileValidationError = (req as MulterRequest).fileValidationError;
      if (fileValidationError) {
        handleMulterError(fileValidationError, res);
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
