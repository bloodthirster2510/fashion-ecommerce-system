import type { Request } from 'express';
import { validateUploadedImageContent, withMulterErrorHandling, type MulterRequest } from '../upload.middleware';

const pngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);
const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00]);
const webpBuffer = Buffer.from('RIFF\x04\x00\x00\x00WEBPVP8 ', 'binary');

const createFile = (buffer: Buffer, mimetype: string) =>
  ({
    buffer,
    mimetype,
    originalname: 'image.png',
  }) as Express.Multer.File;

describe('upload middleware image sniffing', () => {
  it('accepts uploaded files when the content signature matches the MIME type', async () => {
    const req = {
      files: {
        image: [createFile(pngBuffer, 'image/png')],
        variants: [createFile(jpegBuffer, 'image/jpeg')],
        thumbnail: [createFile(webpBuffer, 'image/webp')],
      },
    } as unknown as Request;

    await expect(validateUploadedImageContent(req)).resolves.toBeNull();
  });

  it('rejects files whose content does not match the declared image MIME type', async () => {
    const req = {
      file: createFile(Buffer.from('not-an-image'), 'image/png'),
    } as unknown as Request;

    await expect(validateUploadedImageContent(req)).resolves.toMatchObject({
      message: 'Uploaded image content must match JPEG, PNG, or WEBP',
    });
  });

  it('rejects image files with mismatched signatures', async () => {
    const req = {
      file: createFile(jpegBuffer, 'image/png'),
    } as unknown as Request;

    await expect(validateUploadedImageContent(req)).resolves.toMatchObject({
      message: 'Uploaded image content must match JPEG, PNG, or WEBP',
    });
  });

  it('returns the file-filter validation error before calling the route handler', () => {
    const wrapped = withMulterErrorHandling((req, _res, next) => {
      (req as MulterRequest).fileValidationError = new Error('Only JPEG, PNG, and WEBP images are allowed');
      next();
    });
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const next = jest.fn();

    wrapped({} as Request, { status } as never, next);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ message: 'Only JPEG, PNG, and WEBP images are allowed' });
    expect(next).not.toHaveBeenCalled();
  });
});

