import { deleteFromCloudinary, uploadToCloudinary } from '../../../utils/cloudinary.util';
import { cleanupReviewImages, uploadReviewImages } from '../review-images';

jest.mock('../../../utils/cloudinary.util', () => ({
  uploadToCloudinary: jest.fn(),
  deleteFromCloudinary: jest.fn(),
}));

const mockedUpload = uploadToCloudinary as jest.MockedFunction<typeof uploadToCloudinary>;
const mockedDelete = deleteFromCloudinary as jest.MockedFunction<typeof deleteFromCloudinary>;

const file = (name: string): Express.Multer.File => ({
  fieldname: 'images',
  originalname: name,
  encoding: '7bit',
  mimetype: 'image/jpeg',
  size: 1024,
  buffer: Buffer.from([0xff, 0xd8, 0xff]),
  destination: '',
  filename: name,
  path: '',
  stream: undefined as never,
});

describe('review image storage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('stores Cloudinary metadata and a thumbnail URL', async () => {
    mockedUpload.mockResolvedValue({
      public_id: 'fashion-ecommerce/reviews/review-1/photo',
      secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/photo.jpg',
      url: 'http://res.cloudinary.com/demo/image/upload/v1/photo.jpg',
      width: 1200,
      height: 900,
      format: 'jpg',
      bytes: 1000,
    });

    const result = await uploadReviewImages('review-1', [file('photo.jpg')]);

    expect(mockedUpload).toHaveBeenCalledWith(
      expect.any(Buffer),
      'photo.jpg',
      'fashion-ecommerce/reviews/review-1',
    );
    expect(result[0]).toEqual(expect.objectContaining({
      publicId: 'fashion-ecommerce/reviews/review-1/photo',
      mimeType: 'image/jpeg',
      size: 1000,
      thumbnailUrl: expect.stringContaining('/upload/c_fill,w_320,h_320,q_auto,f_auto/'),
    }));
  });

  it('cleans images already uploaded when a later upload fails', async () => {
    mockedUpload
      .mockResolvedValueOnce({
        public_id: 'first', secure_url: 'https://example.com/first.jpg', url: '',
        width: 100, height: 100, format: 'jpg', bytes: 100,
      })
      .mockRejectedValueOnce(new Error('upload failed'));

    await expect(uploadReviewImages('review-1', [file('first.jpg'), file('second.jpg')]))
      .rejects.toThrow('upload failed');
    expect(mockedDelete).toHaveBeenCalledWith('first');
  });

  it('ignores legacy images without a Cloudinary public id during cleanup', async () => {
    await cleanupReviewImages([{ publicId: null }, { publicId: 'owned-image' }]);
    expect(mockedDelete).toHaveBeenCalledTimes(1);
    expect(mockedDelete).toHaveBeenCalledWith('owned-image');
  });
});
