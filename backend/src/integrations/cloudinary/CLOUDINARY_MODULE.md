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
  - Saves Cloudinary URLs into `product_image` and `version[].version_image`.
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
- `version_images`: zero or more version image files.

The version image files are mapped by array index:

```text
version_images[0] -> version[0].version_image
version_images[1] -> version[1].version_image
```

If no version image file is uploaded, the API uses the `version_image` URL already provided in the `version` JSON payload.

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

Optional versions field:

```json
[
  {
    "sku": "TSHIRT-BLACK-M",
    "color": "Black",
    "fitType": "Regular",
    "size_spec": [
      {
        "size": "M",
        "shoulder": 42,
        "chest": 96,
        "length": 68,
        "weight": 0.4,
        "stock_quantity": 10
      }
    ],
    "version_image": "https://existing-image-url.example/black.png",
    "price": 199000,
    "discount": 0
  }
]
```

When using `multipart/form-data`, send `version` as a JSON string.

Example form-data:

```text
category_id: 665000000000000000000001
name: Basic T-shirt
brand_id: 665000000000000000000002
description: A basic t-shirt for daily wear
version: [{"sku":"TSHIRT-BLACK-M","color":"Black","fitType":"Regular","size_spec":[{"size":"M","shoulder":42,"chest":96,"length":68,"weight":0.4}],"version_image":"https://fallback.example/black.png","price":199000,"discount":0}]
product_image: <file>
version_images: <file for version[0]>
```

## Update Product Request

Endpoint:

```text
PUT /products/update/:id
Content-Type: multipart/form-data
```

Supported behavior:

- Uploading `product_image` replaces the old main image.
- Sending `version` replaces the product `version` array.
- Uploading `version_images` replaces `version[index].version_image` by index.
- When replacing versions, old version images are deleted from Cloudinary.

If you upload `version_images`, you must also send `version` data so the backend can map files to the correct version records.

## Delete Product Behavior

Endpoint:

```text
DELETE /products/delete/:id
```

The controller deletes these Cloudinary assets before soft-deleting the product:

- `product_image`
- every `version[].version_image`

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
fashion-ecommerce/products/versions
```

Main product images are uploaded to `fashion-ecommerce/products`.
Version images are uploaded to `fashion-ecommerce/products/versions`.

## Notes

- The backend stores only Cloudinary URLs in MongoDB.
- File validation happens before controller logic.
- Invalid file types return `400`.
- Files larger than `5MB` return `400`.
- Tests mock Cloudinary uploads, so CI does not call the real Cloudinary API.
