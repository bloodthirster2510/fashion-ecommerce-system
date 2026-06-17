import {
  deleteFromCloudinary,
  extractPublicIdFromUrl,
  uploadToCloudinary,
} from '../../utils/cloudinary.util';

const CLOUDINARY_HOST = 'res.cloudinary.com';

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
