process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'e2e-access-secret-at-least-thirty-two-characters';
process.env.JWT_REFRESH_SECRET = 'e2e-refresh-secret-at-least-thirty-two-characters';
process.env.RATE_LIMIT_STORE = 'memory';
process.env.API_RATE_LIMIT_MAX = '5000';
process.env.AUTH_RATE_LIMIT_MAX = '5000';

process.env.VNPAY_TMN_CODE = 'E2ETMNCODE';
process.env.VNPAY_HASH_SECRET = 'e2e-vnpay-hash-secret';
process.env.VNPAY_PAY_URL = 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
process.env.VNPAY_TRANSACTION_API_URL = 'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction';
process.env.VNPAY_RETURN_URL = 'http://127.0.0.1/api/payments/vnpay/return';
process.env.VNPAY_SERVER_IP = '127.0.0.1';

process.env.GHN_TOKEN = 'e2e-ghn-token';
process.env.GHN_SHOP_ID = '123456';
process.env.GHN_BASE_URL = 'https://dev-online-gateway.ghn.vn/shiip/public-api';
process.env.GHN_WEBHOOK_SECRET = 'e2e-ghn-webhook-secret';
process.env.SHOP_NAME = 'Fashion E2E';
process.env.SHOP_PHONE = '0900000000';
process.env.SHOP_ADDRESS = '123 E2E Street';
process.env.SHOP_DISTRICT_ID = '1572';
process.env.SHOP_WARD_CODE = '550101';

process.env.VIRTUAL_TRY_ON_PROVIDER = 'mock';
process.env.VIRTUAL_TRY_ON_ENABLE_VIDEO = 'true';
process.env.VIRTUAL_TRY_ON_VIDEO_PROVIDER = 'mock';
process.env.VIRTUAL_TRY_ON_MOCK_VIDEO_URL = 'https://cdn.example.com/e2e-try-on.mp4';
process.env.VIRTUAL_TRY_ON_GARMENT_PROCESSING_ENABLED = 'false';
process.env.IMAGE_VALIDATION_PROVIDER = 'mock';
process.env.IMAGE_VALIDATION_FAIL_OPEN = 'false';
