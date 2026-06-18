import type { Request } from 'express';
import { detectImageMimeType, validateUploadedImageContent } from '../upload.middleware';

const pngBuffer = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d,
]);
const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00]);
const webpBuffer = Buffer.from('RIFF____WEBPVP8 ', 'ascii');

const createFile = (buffer: Buffer, mimetype: string) =>
  ({
    buffer,
    mimetype,
    originalname: 'image.png',
  }) as Express.Multer.File;

describe('upload middleware image sniffing', () => {
  it('detects supported image signatures', () => {
    expect(detectImageMimeType(jpegBuffer)).toBe('image/jpeg');
    expect(detectImageMimeType(pngBuffer)).toBe('image/png');
    expect(detectImageMimeType(webpBuffer)).toBe('image/webp');
  });

  it('accepts uploaded files when the content signature matches the MIME type', () => {
    const req = {
      files: {
        image: [createFile(pngBuffer, 'image/png')],
        variants: [createFile(jpegBuffer, 'image/jpeg')],
      },
    } as unknown as Request;

    expect(validateUploadedImageContent(req)).toBeNull();
  });

  it('rejects files whose content does not match the declared image MIME type', () => {
    const req = {
      file: createFile(Buffer.from('not-an-image'), 'image/png'),
    } as unknown as Request;

    expect(validateUploadedImageContent(req)).toMatchObject({
      message: 'Uploaded image content must match JPEG, PNG, or WEBP',
    });
  });

  it('rejects image files with mismatched signatures', () => {
    const req = {
      file: createFile(jpegBuffer, 'image/png'),
    } as unknown as Request;

    expect(validateUploadedImageContent(req)).toMatchObject({
      message: 'Uploaded image content must match JPEG, PNG, or WEBP',
    });
  });
});

