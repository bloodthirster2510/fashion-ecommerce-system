import crypto from 'crypto';

type CloudinaryUploadResult = {
  publicId: string;
  secureUrl: string;
};

type CloudinaryApiResponse = {
  public_id?: string;
  secure_url?: string;
  error?: {
    message?: string;
  };
};

type CloudinaryDestroyResponse = {
  result?: string;
  error?: {
    message?: string;
  };
};

const getRequiredEnv = (key: string): string => {
  const value = process.env[key]?.trim();
  if (!value) {
    throw { status: 500, message: `${key} chua duoc cau hinh` };
  }
  return value;
};

const getCloudinaryConfig = () => ({
  cloudName: getRequiredEnv('CLOUDINARY_CLOUD_NAME'),
  apiKey: getRequiredEnv('CLOUDINARY_API_KEY'),
  apiSecret: getRequiredEnv('CLOUDINARY_API_SECRET'),
});

const signParams = (params: Record<string, string>, apiSecret: string): string => {
  const payload = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

  return crypto.createHash('sha1').update(`${payload}${apiSecret}`).digest('hex');
};

const postCloudinaryForm = async <T>(
  endpoint: string,
  params: Record<string, string>,
  fileDataUri?: string,
): Promise<T> => {
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
  const signedParams = {
    ...params,
    timestamp: Math.floor(Date.now() / 1000).toString(),
  };
  const formData = new FormData();

  if (fileDataUri) {
    formData.append('file', fileDataUri);
  }

  for (const [key, value] of Object.entries(signedParams)) {
    formData.append(key, value);
  }

  formData.append('api_key', apiKey);
  formData.append('signature', signParams(signedParams, apiSecret));

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/${endpoint}`, {
    method: 'POST',
    body: formData,
  });
  const result = (await response.json()) as T & { error?: { message?: string } };

  if (!response.ok) {
    throw {
      status: 502,
      message: result.error?.message || 'Khong the ket noi Cloudinary',
    };
  }

  return result as T;
};

export const getAvatarFolder = () => process.env.CLOUDINARY_AVATAR_FOLDER?.trim() || 'fashion-system/avatars';

export const uploadImageToCloudinary = async (options: {
  fileDataUri: string;
  folder: string;
  publicId: string;
}): Promise<CloudinaryUploadResult> => {
  const result = await postCloudinaryForm<CloudinaryApiResponse>('upload', {
    folder: options.folder,
    public_id: options.publicId,
    overwrite: 'true',
    invalidate: 'true',
  }, options.fileDataUri);

  if (!result.public_id || !result.secure_url) {
    throw { status: 502, message: 'Cloudinary khong tra ve URL anh' };
  }

  return {
    publicId: result.public_id,
    secureUrl: result.secure_url,
  };
};

export const deleteImageFromCloudinary = async (publicId?: string | null) => {
  if (!publicId) return;

  const result = await postCloudinaryForm<CloudinaryDestroyResponse>('destroy', {
    public_id: publicId,
    invalidate: 'true',
  });

  if (result.error) {
    throw { status: 502, message: result.error.message || 'Khong the xoa anh tren Cloudinary' };
  }
};
