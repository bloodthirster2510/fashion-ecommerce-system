import {
  deleteFromCloudinary,
  extractPublicIdFromUrl,
  uploadToCloudinary,
} from '../../utils/cloudinary.util';

const CLOUDINARY_HOST = 'res.cloudinary.com';
const DEFAULT_ALLOWED_IMAGE_HOSTS = [CLOUDINARY_HOST];

export class CatalogImageUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CatalogImageUrlError';
  }
}

const parseCsv = (value?: string) =>
  (value ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

export const getAllowedCatalogImageHosts = () => {
  const configuredHosts = parseCsv(process.env.CATALOG_IMAGE_ALLOWED_HOSTS);
  return configuredHosts.length ? configuredHosts : DEFAULT_ALLOWED_IMAGE_HOSTS;
};

export const normalizeCatalogImageUrl = (imageUrl: string) => {
  const trimmedUrl = imageUrl.trim();
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(trimmedUrl);
  } catch {
    throw new CatalogImageUrlError('Image URL is invalid');
  }

  if (parsedUrl.protocol !== 'https:') {
    throw new CatalogImageUrlError('Image URL must use https');
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  if (!getAllowedCatalogImageHosts().includes(hostname)) {
    throw new CatalogImageUrlError('Image URL host is not allowed');
  }

  return parsedUrl.toString();
};

export const uploadCatalogImage = async (
  file: Express.Multer.File,
  folder: 'categories' | 'brands',
) => {
  const result = await uploadToCloudinary(
    file.buffer,
    file.originalname,
    `fashion-ecommerce/catalog/${folder}`,
  );

  return result.secure_url;
};

export const deleteCatalogImage = async (imageUrl?: string | null) => {
  if (!imageUrl) {
    return;
  }

  try {
    const url = new URL(imageUrl);

    if (url.hostname !== CLOUDINARY_HOST) {
      return;
    }

    await deleteFromCloudinary(extractPublicIdFromUrl(imageUrl));
  } catch (error) {
    console.warn('Failed to delete catalog image from Cloudinary:', error);
  }
};
