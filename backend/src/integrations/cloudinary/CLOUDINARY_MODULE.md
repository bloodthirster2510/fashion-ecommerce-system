# Cloudinary Module

This backend uses Cloudinary to store product images uploaded through the catalog product APIs.

## Files

- `src/integrations/cloudinary/cloudinary.ts`
  - Configures the Cloudinary SDK from environment variables.
- `src/utils/cloudinary.util.ts`
  - Uploads a file buffer to Cloudinary.
  - Deletes an uploaded asset by `public_id`.
  - Extracts `public_id` from a Cloudinary URL.
- `src/middlewares/upload.middleware.ts`
  - Uses Multer memory storage.
  - Accepts only `image/jpeg`, `image/png`, and `image/webp`.
  - Limits each file to `5MB`.
- `src/modules/catalog/products/product.route.ts`
  - Applies upload middleware to product create/update routes.
- `src/modules/catalog/products/product.controller.ts`
  - Uploads files to Cloudinary.
  - Saves the uploaded main image URL into `product_image`.
  - Uses image URLs provided in `variant[].colors[].image` for color images.
  - Deletes old Cloudinary images when replacing or deleting product images.

## Environment Variables

Set these values in `backend/.env`:

```env
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

The example keys are listed in `backend/.env.example`.

## Upload Middleware

Product image upload uses:

```ts
upload.fields([
  { name: 'product_image', maxCount: 1 },
  { name: 'version_images', maxCount: 20 },
])
```

Accepted form-data fields:

- `product_image`: one main product image file.
- `version_images`: kept for backward compatibility with old clients, but rejected by the current catalog design.

Color images are not uploaded by index anymore. Provide image URLs in each `variant[].colors[].image`.

## Create Product Request

Endpoint:

```text
POST /products/create
Content-Type: multipart/form-data
```

Required text fields:

- `category_id`
- `name`
- `brand_id`
- `description`

Required image source:

- upload `product_image`, or
- send `product_image` as an existing URL.

Optional `variant` field:

```json
[
  {
    "fitTypeId": "665000000000000000000010",
    "price": 199000,
    "discount": 0,
    "sizeMeasurements": [
      {
        "size": "M",
        "measurements": [
          { "key": "shoulder", "value": 42 },
          { "key": "chest", "value": 96 },
          { "key": "length", "value": 68 }
        ]
      }
    ],
    "colors": [
      {
        "color": "Black",
        "colorCode": "#000000",
        "image": "https://existing-image-url.example/black.png"
      }
    ]
  }
]
```

When using `multipart/form-data`, send `variant` as a JSON string.

Example form-data:

```text
category_id: 665000000000000000000001
name: Basic T-shirt
brand_id: 665000000000000000000002
description: A basic t-shirt for daily wear
variant: [{"fitTypeId":"665000000000000000000010","price":199000,"discount":0,"sizeMeasurements":[{"size":"M","measurements":[{"key":"shoulder","value":42},{"key":"chest","value":96},{"key":"length","value":68}]}],"colors":[{"color":"Black","colorCode":"#000000","image":"https://fallback.example/black.png"}]}]
product_image: <file>
```

## Update Product Request

Endpoint:

```text
PUT /products/update/:id
Content-Type: multipart/form-data
```

Supported behavior:

- Uploading `product_image` replaces the old main image.
- Sending `variant` replaces the product `variant` array.
- Sending old `version` JSON is accepted as a compatibility alias for `variant`.
- Uploading `version_images` returns `400`; provide color image URLs in `variant[].colors[].image`.

## Delete Product Behavior

Endpoint:

```text
DELETE /products/delete/:id
```

The controller deletes these Cloudinary assets before soft-deleting the product:

- `product_image`
- every `variant[].colors[].image`

The product document is not removed from MongoDB. The service sets:

```json
{
  "isActive": false
}
```

## Cloudinary Folders

Current folders:

```text
fashion-ecommerce/products
```

Main product images are uploaded to `fashion-ecommerce/products`.

## Notes

- The backend stores only Cloudinary URLs in MongoDB.
- File validation happens before controller logic.
- Invalid file types return `400`.
- Files larger than `5MB` return `400`.
- Tests mock Cloudinary uploads, so CI does not call the real Cloudinary API.
