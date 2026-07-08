# Ke hoach trien khai tinh nang goi y san pham thoi trang

## 1. Muc tieu

Xay dung he thong goi y san pham cho fashion ecommerce theo huong:

```text
Hybrid Fashion Recommendation System
= User behavior
+ Content-based filtering
+ Popularity-based recommendation
+ Cold-start handling
```

Tinh nang nay khong can dung deep learning nang. Huong phu hop cho luan van la ket hop machine learning nhe va rule-based:

- Dung hanh vi nguoi dung de suy luan so thich.
- Dung dac trung san pham de tinh do tuong dong.
- Dung do pho bien de lam fallback.
- Ghi nhan impression/click cua recommendation de do hieu qua that.
- Tra ve ly do goi y ro rang de he thong giai thich duoc, khong phai hop den.

Tieu chi "10/10" cua plan:

```text
Dung huong hoc thuat
+ trien khai duoc trong codebase hien tai
+ co du lieu do luong hieu qua
+ co fallback an toan
+ co kha nang mo rong thanh ML nang hon sau nay
```

## 2. Hien trang he thong

Trang thai cap nhat ngay 2026-07-08:

- Da co `UserProductInteraction`, `RecommendationRequest`, `RecommendationEvent`.
- Da co API personal, similar, cart recommendation va tracking event.
- Da gan vao Home, Product Detail va Cart tren mobile.
- Da tracking `view`, `search`, `favorite`, `add_to_cart`, `purchase`.
- Da co backfill va script danh gia offline/online.
- Da xac thuc event theo recommendation request da phat va chong ghi trung.
- Chua co dataset du lon va chua huan luyen model ML rieng.
- Web frontend khong nam trong dot trien khai hien tai.

## 3. Cac tinh nang can lam

| Tinh nang | Vi tri hien thi | Muc dich |
|---|---|---|
| Theo doi hanh vi nguoi dung | Chay nen | Ghi nhan view, search, favorite, add_to_cart, purchase |
| Goi y danh cho ban | Trang chu, profile | Ca nhan hoa theo so thich nguoi dung |
| San pham tuong tu | Trang chi tiet san pham | Goi y san pham giong san pham dang xem |
| Goi y trong gio hang | Trang gio hang | Cross-sell san pham lien quan, de phase sau |
| Goi y cho nguoi dung moi | Trang chu | Xu ly cold-start khi chua co hanh vi |

MVP nen uu tien hep lai de lam chac:

```text
1. Tracking hanh vi
2. San pham tuong tu
3. Goi y danh cho ban
4. Ghi nhan recommendation impression/click
5. Gan vao Home, Product Detail va Cart mobile
```

Defer sang phase sau:

```text
- Collaborative filtering that su
- Model training rieng
```

## 4. Du lieu can them

Can duy tri 3 nhom du lieu rieng:

```text
UserProductInteraction = nguoi dung da lam gi
RecommendationRequest = he thong da phat danh sach nao
RecommendationEvent = he thong da goi y gi va nguoi dung phan ung ra sao
```

### UserProductInteraction

Model nay dung de tao user preference profile.

```text
UserProductInteraction
- _id
- userId?: ObjectId
- sessionId?: string
- productId?: ObjectId
- actionType
- weight
- source
- metadata
- createdAt
- updatedAt
```

Ghi chu quan trong:

- `productId` khong bat buoc vi `search` co the chi co keyword/filter, khong gan voi 1 san pham cu the.
- `userId` dung cho user da dang nhap.
- `sessionId` dung cho guest; sau khi dang nhap co the merge interaction cu vao account.
- Moi record nen co `createdAt` de ap dung time decay.

Trong do:

```text
actionType = view | search | favorite | add_to_cart | purchase
source = home | product_list | product_detail | search | cart | checkout
```

`metadata` co the luu them:

```text
{
  keyword?: string,
  categoryId?: string,
  brandId?: string,
  orderId?: string,
  cartItemId?: string,
  variantId?: string,
  color?: string,
  size?: string,
  minPrice?: number,
  maxPrice?: number,
  filters?: Record<string, unknown>
}
```

Trong so hanh vi ban dau:

| Hanh vi | Trong so |
|---|---:|
| view | 1 |
| search | 2 |
| favorite | 3 |
| add_to_cart | 5 |
| purchase | 10 |

Ghi chu: cac trong so nay la tham so thiet ke/thuc nghiem, dua tren ly thuyet implicit feedback. Khi co du lieu that, co the dieu chinh bang thuc nghiem.

Nen co co che chong spam:

```text
1 user + 1 product + action=view chi ghi lai sau 30-60 phut
```

Index de can co ngay tu dau:

```text
{ userId: 1, createdAt: -1 }
{ sessionId: 1, createdAt: -1 }
{ productId: 1, actionType: 1, createdAt: -1 }
{ userId: 1, productId: 1, actionType: 1, createdAt: -1 }
```

### RecommendationRequest

Model nay luu batch recommendation da phat de server xac thuc impression/click va
khong tin score/rank do client tu gui len. Ban ghi co TTL 7 ngay; event da xac thuc
van duoc luu lau dai.

```text
RecommendationRequest
- requestId
- userId?: ObjectId
- sessionId?: string
- context
- sourceProductId?: ObjectId
- algorithmVersion
- fallbackUsed
- items: [{ productId, score, rank, reasonCodes }]
- expiresAt
- createdAt
```

### RecommendationEvent

Model nay dung de danh gia recommendation va toi uu sau nay.

```text
RecommendationEvent
- _id
- userId?: ObjectId
- sessionId?: string
- context
- sourceProductId?: ObjectId
- recommendedProductId: ObjectId
- algorithmVersion
- score
- rank
- reasonCodes
- eventType
- requestId
- createdAt
```

Trong do:

```text
context = home | product_detail_similar | cart
eventType = impression | click | add_to_cart | purchase
algorithmVersion = v1_hybrid_rule_based
```

`requestId` giup gom cac san pham duoc tra ve trong cung mot lan goi API, phuc vu tinh CTR/Conversion theo batch.

## 5. Cac diem can ghi nhan hanh vi

### Mobile

- `ProductDetailScreen`: khi mo chi tiet san pham, ghi `view`.
- `StorefrontHeader` / search submit: khi tim kiem, ghi `search`.
- Favorite button: khi them yeu thich, ghi `favorite`.
- Add to cart: khi them gio hang thanh cong, ghi `add_to_cart`.
- Checkout/order success: khi tao don thanh cong, ghi `purchase` cho tung san pham.
- Recommendation section render xong: ghi `RecommendationEvent.impression`.
- Bam vao san pham tu recommendation: ghi `RecommendationEvent.click`.
- Add to cart tu san pham den tu recommendation: ghi `RecommendationEvent.add_to_cart`.

### Web frontend

- `ProductDetailPage`: ghi `view`, `favorite`, `add_to_cart`.
- `ProductListPage` hoac `MainLayout` search form: ghi `search`.
- `CartPage`: dung de hien thi goi y trong gio hang.
- Order success flow: ghi `purchase`.
- Recommendation section: ghi `impression`, `click`, `add_to_cart` tu recommendation.

### Backend

Mot so hanh vi nen ghi o backend de tranh mat event:

- Favorite thanh cong -> ghi `favorite`.
- Add cart thanh cong -> ghi `add_to_cart`.
- Tao order thanh cong -> ghi `purchase` cho tung san pham.
- Neu add cart / purchase co `recommendationRequestId`, ghi them `RecommendationEvent.add_to_cart` hoac `RecommendationEvent.purchase`.

`view` va `search` co the do client gui len vi chi client biet nguoi dung da xem/tim kiem.
`impression` va `click` cung do client gui len, nhung backend phai validate san pham va gioi han spam.

## 6. API can bo sung

Nen tao 2 module:

```text
backend/src/modules/interactions
backend/src/modules/recommendations
```

Hien tai module `ml` trong backend dang rong, nen dat logic recommendation vao module `recommendations` rieng de ro rang.

API tracking:

```http
POST /interactions
```

Body:

```json
{
  "productId": "string | optional",
  "actionType": "view",
  "source": "product_detail",
  "sessionId": "guest-session-id | optional",
  "metadata": {}
}
```

API recommendation event:

```http
POST /recommendations/events
```

Body:

```json
{
  "requestId": "rec-request-id",
  "eventType": "impression",
  "context": "home",
  "sourceProductId": "string | optional",
  "recommendedProductId": "string",
  "rank": 1,
  "sessionId": "guest-session-id | optional"
}
```

API recommendation cho MVP:

```http
GET /recommendations/me?limit=10
GET /recommendations/products/:productId/similar?limit=8
```

Y nghia:

- `/recommendations/me`: goi y ca nhan hoa cho user dang dang nhap.
- `/recommendations/products/:productId/similar`: san pham tuong tu.

API phase sau:

```http
GET /recommendations/cart?limit=8
```

- `/recommendations/cart`: cross-sell dua tren cac san pham trong gio hang.

Response recommendation nen co metadata de giai thich va tracking:

```json
{
  "requestId": "rec_20260708_xxx",
  "algorithmVersion": "v1_hybrid_rule_based",
  "items": [
    {
      "product": {},
      "score": 0.82,
      "rank": 1,
      "reason": "Cung danh muc, hop mau ban hay xem, dang ban chay",
      "reasonCodes": ["same_category", "preferred_color", "popular"]
    }
  ],
  "fallbackUsed": false
}
```

Neu recommendation service loi, API nen fallback ve newest/best-seller va tra `fallbackUsed: true` thay vi lam hong man hinh mobile.

## 7. Thuat toan goi y

Dung cong thuc scoring de de giai thich trong luan van:

```text
score =
  0.40 * contentSimilarity
+ 0.30 * userPreferenceScore
+ 0.20 * popularityScore
+ 0.10 * businessScore
```

Trong do:

| Thanh phan | Y nghia | Cach tinh goi y |
|---|---|---|
| `contentSimilarity` | Do giong nhau giua san pham/so thich user va san pham ung vien | category, gender, brand, color, fitType, price range |
| `userPreferenceScore` | Muc phu hop voi lich su hanh vi user | tong trong so hanh vi theo category/brand/color/price |
| `popularityScore` | Do pho bien | soldQuantity, averageRating, reviewCount |
| `businessScore` | Uu tien nghiep vu | con hang, dang sale, san pham moi |

Tat ca diem nen normalize ve khoang:

```text
0.0 -> 1.0
```

Trong so nen de trong constant/config theo version:

```text
algorithmVersion = v1_hybrid_rule_based
weights = {
  contentSimilarity: 0.40,
  userPreferenceScore: 0.30,
  popularityScore: 0.20,
  businessScore: 0.10
}
```

Moi item nen sinh `reasonCodes` tu cac thanh phan co diem cao nhat:

```text
same_category
same_brand
preferred_color
preferred_price_range
popular
on_sale
new_arrival
```

### Candidate pool va loai tru

Truoc khi tinh score can loc danh sach ung vien:

```text
- Bo san pham het hoac ngung ban (active = false).
- Bo chinh san pham dang xem (trong /similar).
- Bo san pham da mua gan day (mac dinh 30 ngay) cho /me.
- Bo san pham dang nam trong gio cho /cart recommendation.
- Gioi han candidate pool theo category/gender tuong dong de giam chi phi tinh.
```

Dam bao da dang (diversity/freshness):

```text
- Moi category/brand khong qua 40% tong ket qua.
- Uu tien toi thieu 20% san pham moi de khong chi toan best-seller cu.
- Co the xao tron nhe top-N khi score gan nhau de tranh lap y het giua cac lan goi.
```

### Hieu nang va cache

Khong nen moi request quet toan bo catalog. Can co chien luoc:

```text
- Gioi han candidate pool khoang 100-300 san pham.
- Dung filter MongoDB truoc, scoring trong service sau.
- Cache `/recommendations/me` 5-15 phut theo user/session.
- Cache product feature vector theo productId.
- Co the precompute user preference profile neu interaction lon.
- Moi request recommendation tao `requestId` rieng de tracking.
```

Chi so can canh bao:

```text
- Recommendation API p95 latency > 500ms.
- Candidate pool rong.
- Ti le fallbackUsed tang bat thuong.
- Mot category/brand chiem qua nhieu ket qua.
```

## 8. Content-based filtering

Moi san pham duoc bieu dien bang vector dac trung:

```text
category
gender
brand
colors
fitTypes
priceBucket
material
isSale
isNew
```

Vi du:

```text
Ao so mi nu mau trang cong so cotton gia 300k-500k
```

Co the tinh similarity bang rule score don gian:

```text
category match: +0.35
gender match: +0.15
brand match: +0.10
color overlap: +0.15
fitType overlap: +0.10
price bucket close: +0.15
```

MVP nen uu tien cac field da co trong database de tranh phat sinh field moi khi chua can.

Neu muon viet theo huong machine learning nhe:

- Tao vector one-hot/multi-hot tu thuoc tinh san pham.
- Tinh cosine similarity giua vector san pham.
- Lay top N san pham co diem cao nhat.

## 9. User preference score

Tu bang `UserProductInteraction`, tao ho so so thich nguoi dung:

```text
user profile =
  tong trong so category
+ tong trong so brand
+ tong trong so color
+ tong trong so priceBucket
```

Vi du:

```text
User A:
- female: 26 diem
- dress: 18 diem
- black: 12 diem
- price 300k-500k: 20 diem
```

Khi tinh goi y, san pham ung vien nao khop nhieu thuoc tinh voi user profile thi co `userPreferenceScore` cao.

Nen uu tien hanh vi gan day hon bang time decay:

```text
effectiveWeight = actionWeight * decay
```

Vi du decay don gian:

```text
duoi 7 ngay: 1.0
7-30 ngay: 0.7
30-90 ngay: 0.4
tren 90 ngay: 0.2
```

## 10. Popularity score

Dung cho ca user moi va user co it hanh vi.

Goi y cong thuc:

```text
popularityScore =
  0.50 * normalizedSoldQuantity
+ 0.30 * normalizedReviewCount
+ 0.20 * normalizedAverageRating
```

Co the them `createdAt` de uu tien san pham moi:

```text
newnessBoost = san pham moi trong 30 ngay ? 0.1 : 0
```

## 11. Cold-start

### User chua dang nhap

Goi y:

```text
best seller + newest + sale + rating high
```

Guest user co the gan `userId` tam bang deviceId/sessionId, sau khi dang nhap co the merge interaction cu sang account.

### User moi dang nhap nhung chua co hanh vi

Goi y:

```text
popular products
+ newest products
+ products matching profile gender neu co
+ products from categories dang noi bat
```

### San pham moi

Dung content-based filtering vi san pham moi chua co interaction:

```text
category + gender + brand + color + price + style
```

## 12. UI can cap nhat

### Mobile

Trang chu:

- Doi section `Ban cung co the thich` thanh goi y ca nhan hoa tu `/recommendations/me`.
- Neu user chua co data thi hien fallback popular/newest.
- Khi section vao viewport, gui `RecommendationEvent.impression` kem `requestId`.
- Khi bam san pham, gui `RecommendationEvent.click` va truyen `recommendationRequestId` sang Product Detail.

Trang chi tiet san pham:

- Them section `San pham tuong tu`.
- Co the hien reason ngan neu UI phu hop, vi du `Hop gu ban`, `Cung danh muc`, `Dang ban chay`.

Gio hang:

- Them section `Co the ban cung thich`.
- Gio hang nen de phase sau neu MVP can nhanh va chac.

### Web frontend

Neu can dong bo voi mobile:

- HomePage: section goi y ca nhan hoa.
- ProductDetailPage: similar products.
- CartPage: cart recommendations.
- Search submit: tracking `search`.

## 13. Kiem thu va danh gia

### Test ky thuat

- Unit test cho interaction service.
- Unit test cho recommendation scoring.
- Unit test cho RecommendationEvent service.
- Test fallback khi user chua co interaction.
- Test khong tra ve san pham het hang/khong active.
- Test khong goi y lai chinh san pham dang xem.
- Test `search` interaction khong can `productId`.
- Test guest `sessionId` va merge vao user sau login.
- Test API recommendation tra `requestId`, `algorithmVersion`, `reasonCodes`.
- Test latency voi candidate pool lon.

### Danh gia cho luan van

Co the danh gia offline bang:

- Precision@K
- Recall@K
- NDCG@K
- MAP@K
- Coverage
- Diversity
- Novelty/Freshness

Cach danh gia de lam:

```text
1. Lay lich su purchase/favorite/cart cua user.
2. An mot phan hanh vi gan day lam test set.
3. Dung hanh vi cu hon de tao recommendation.
4. Kiem tra top K goi y co trung voi test set khong.
```

So sanh:

```text
Baseline 1: newest-only
Baseline 2: best-seller-only
Baseline 3: content-based only
Proposed: hybrid recommendation v1
```

Danh gia online khi co RecommendationEvent:

```text
CTR = click / impression
AddToCartRate = add_to_cart / impression
ConversionRate = purchase / impression
FallbackRate = fallbackUsed / request
```

## 14. Lo trinh trien khai

### Giai doan 1: Nen tang du lieu

- Tao model `UserProductInteraction`.
- Tao model `RecommendationEvent`.
- Tao service ghi nhan interaction.
- Tao API `POST /interactions`.
- Tao API `POST /recommendations/events`.
- Gan tracking mobile cho `view`, `search`.
- Ghi tu backend cho `favorite`, `add_to_cart`, `purchase`.
- Backfill interaction tu favorite/cart/order hien co.

### Giai doan 2: Goi y san pham tuong tu MVP

- Viet ham tinh content similarity.
- Tao API `/recommendations/products/:productId/similar`.
- Response co `requestId`, `algorithmVersion`, `score`, `rank`, `reasonCodes`.
- Them fallback newest/best-seller neu candidate rong.
- Gan vao ProductDetail mobile.
- Gui `impression` khi section hien thi va `click` khi bam san pham.

### Giai doan 3: Goi y ca nhan hoa MVP

- Tao user preference profile tu interaction.
- Tinh score hybrid.
- Tao API `/recommendations/me`.
- Gan vao Home mobile.
- Thay `catalogApi.getRecommended()` dang newest-only bang API recommendation moi.
- Guest fallback ve popular/newest/sale/rating high.

### Giai doan 4: Danh gia va on dinh MVP

- Viet script tinh Precision@K, Recall@K, NDCG@K, MAP@K, Coverage, Diversity.
- So sanh newest-only, best-seller-only, content-based only va hybrid.
- Do CTR/AddToCartRate bang RecommendationEvent.
- Tune weights v1 neu can.

### Giai doan 5: Goi y gio hang

- Lay san pham trong cart.
- Ket hop san pham trong gio voi similar recommendation va popularity fallback.
- Tao API `/recommendations/cart`.
- Gan vao Cart mobile.

### Giai doan 6: Mo rong ML va viet luan van

- Thu collaborative filtering khi interaction du lon.
- Precompute user profile/product vector neu can.
- Viet phan ly thuyet, thiet ke, thuc nghiem.

## 15. Rollout, bao mat va van hanh

Feature flag:

```text
recommendation.enabled = true | false
recommendation.algorithmVersion = v1_hybrid_rule_based
recommendation.fallbackEnabled = true
```

Fallback:

```text
- API recommendation loi -> tra newest/best-seller.
- Candidate rong -> tra popular/newest/sale.
- Tracking event loi -> khong chan UI.
```

Bao mat va rieng tu:

```text
- Khong luu thong tin nhay cam trong metadata.
- Keyword search can trim, gioi han do dai, co the hash/anonymize neu can.
- Co retention cho interaction/event cu.
- Guest sessionId khong nen chua thong tin ca nhan.
```

Van hanh:

```text
- Log algorithmVersion va fallbackUsed.
- Monitor latency, error rate, fallback rate.
- Co dashboard don gian cho CTR/AddToCartRate/ConversionRate.
```

## 16. Nguon ly thuyet va tham khao

- Content-based filtering: https://developers.google.com/machine-learning/recommendation/content-based/basics
- Collaborative filtering: https://developers.google.com/machine-learning/recommendation/collaborative/basics
- Google Cloud recommendation overview: https://docs.cloud.google.com/bigquery/docs/recommendation-overview
- Hybrid recommender systems: https://link.springer.com/article/10.1023/A%3A1021240730564
- Implicit feedback: https://www.chrisvolinsky.com/publications/17546-collaborative-filtering-for-implicit-feedback-datasets
- Amazon item-to-item recommendation: https://www.amazon.science/the-history-of-amazons-recommendation-algorithm
- Fashion recommender systems survey: https://link.springer.com/article/10.1007/s42979-023-01932-9
- Recommendation evaluation metrics: https://www.shaped.ai/blog/evaluating-recommendation-systems-part-1

## 17. Ket luan

Huong trien khai phu hop nhat cho he thong hien tai la:

```text
Hybrid Recommendation System
= Content-based filtering
+ User behavior scoring
+ Popularity fallback
+ RecommendationEvent tracking
+ Explainable reasonCodes
```

Huong nay co tinh may hoc vua du cho luan van, van de trien khai trong codebase hien tai, do duoc hieu qua bang event that, va phu hop voi bai toan goi y san pham thoi trang.

## 18. Vi tri code cu the va task breakdown

Phan nay bo sung vi tri file cu the trong codebase de bat dau code khong phai do tim.

### 18.1. Backend - Cau truc module can tao

```text
backend/src/modules/
  interactions/
    interaction.service.ts
    interaction.controller.ts
    interaction.route.ts
    interaction.types.ts
    __tests__/
      interaction.service.test.ts
  recommendations/
    recommendation.service.ts
    recommendation.controller.ts
    recommendation.route.ts
    recommendation.types.ts
    __tests__/
      recommendation.service.test.ts

backend/src/database/models/
  user-product-interaction.model.ts
  recommendation-event.model.ts
```

### 18.2. Backend - Cac file can chinh sua

| File | Noi dung chinh sua |
|------|--------------------|
| `backend/src/database/models/index.ts` | Them export `UserProductInteraction` + `RecommendationEvent`. |
| `backend/src/routes/index.ts` | Them `router.use('/interactions', interactionRouter)` + `router.use('/recommendations', recommendationRouter)`. |
| `backend/src/routes/admin.routes.ts` | Them `adminRouter.use('/recommendations', adminRecommendationRouter)` (cho admin preview/debug). |
| `backend/src/modules/catalog/products/product.route.ts` | Them `customerProductRouter.get('/:id/related', getRelatedProducts)` hoac mount recommendation controller. |
| `backend/src/modules/catalog/products/product.service.ts` | Export cac helper `mapProductListItem`, `groupInventoryByProductId`, `repairInventoryReferencesForProduct` de recommendation service reuse. Hoac extract sang `catalog.helpers.ts`. |
| `backend/src/modules/orders/order.service.ts` | Goi `interactionService.recordPurchase` khi tao order thanh cong. |
| `backend/src/modules/favorites/favorite.service.ts` | Goi `interactionService.recordFavorite` khi add favorite. |
| `backend/src/modules/cart/cart.service.ts` | Goi `interactionService.recordAddToCart` khi them gio hang. |

### 18.3. Mobile - Cac file can chinh sua

| File | Noi dung chinh sua |
|------|--------------------|
| `mobile/src/features/catalog/catalogApi.ts` | Them `getRelatedProducts(productId, limit)` goi `GET /products/:id/related`. Xoa `getRecommended` alias sau khi chuyen sang recommendationApi. |
| `mobile/src/features/recommendations/recommendationApi.ts` (moi) | Tao API client cho `/recommendations/me`, `/recommendations/products/:id/similar`. |
| `mobile/src/features/interactions/interactionApi.ts` (moi) | Tao API client `POST /interactions` de gui `view`, `search`, `impression`, `click`. |
| `mobile/src/features/home/HomeScreen.tsx` | Dong 295-304: thay `catalogApi.getRecommended` bang `recommendationApi.getPersonalRecommendations` (neu login) hoac `getBestSellers` (cold start). Gui `impression` khi section render. |
| `mobile/src/features/catalog/ProductDetailScreen.tsx` | Dong 302-312: thay `getProducts({ categoryId, sort: 'newest' })` bang `recommendationApi.getSimilarProducts(product._id)`. Gui `view` khi mo chi tiet. Gui `impression` khi section related render. Truyen `recommendationRequestId` khi bam san pham gợi y. |
| `mobile/src/features/cart/CartScreen.tsx` (neu co) | Them section goi y gio hang. Gui `add_to_cart` interaction. |
| `mobile/src/features/auth/AuthContext.tsx` | Khong can sua, dung `runWithAuth` cho recommendationApi. |

### 18.4. Web frontend - Cac file can chinh sua

| File | Noi dung chinh sua |
|------|--------------------|
| `web_frontend/src/features/catalog/catalog.service.ts` | Them `getRelatedProducts(productId, limit)` goi `GET /products/:id/related`. |
| `web_frontend/src/features/recommendations/recommendation.service.ts` (moi) | Tao service goi `/recommendations/me` qua `requestCustomer`. |
| `web_frontend/src/features/interactions/interaction.service.ts` (moi) | Tao service goi `POST /interactions` + `POST /recommendations/events`. |
| `web_frontend/src/features/home/pages/HomePage.tsx` | Hien chi co slider. Them section "Goi y cho ban" + "San pham ban chay". |
| `web_frontend/src/features/catalog/pages/ProductDetailPage.tsx` | Dong 408 sau `ProductReviews`: them section "San pham lien quan". Gui `view` khi mo page. |

### 18.5. Web admin - Cac file can chinh sua

| File | Noi dung chinh sua |
|------|--------------------|
| `backend/src/routes/admin.routes.ts` | Them `adminRouter.use('/recommendations', adminRecommendationRouter)`. |
| `web_frontend/src/features/admin/modules/recommendations/` (moi, optional) | Trang admin xem truoc goi y theo userId/productId, xem CTR/fallback rate. |

### 18.6. Task breakdown theo thu tu thuc thi

| # | Task | Tang | Uu tien |
|---|------|------|--------|
| 1 | Tao model `user-product-interaction.model.ts` | Backend | High |
| 2 | Tao model `recommendation-event.model.ts` | Backend | High |
| 3 | Export model trong `database/models/index.ts` | Backend | High |
| 4 | Tao module `interactions` (service + controller + route + types) | Backend | High |
| 5 | Tao module `recommendations` (service + controller + route + types) | Backend | High |
| 6 | Export helper `mapProductListItem`, `groupInventoryByProductId` tu `product.service.ts` | Backend | High |
| 7 | Wire route `/interactions` + `/recommendations` vao `routes/index.ts` | Backend | High |
| 8 | Gan tracking `favorite`/`add_to_cart`/`purchase` o backend | Backend | High |
| 9 | Tao API `GET /recommendations/products/:id/similar` | Backend | High |
| 10 | Tao API `GET /recommendations/me` | Backend | High |
| 11 | Tao API `GET /products/:id/related` (shortcut cho similar) | Backend | High |
| 12 | Backfill interaction tu favorite/cart/order cu | Backend | Medium |
| 13 | Viet `interaction.service.test.ts` | Backend | Medium |
| 14 | Viet `recommendation.service.test.ts` | Backend | Medium |
| 15 | Tao `interactionApi.ts` mobile | Mobile | High |
| 16 | Tao `recommendationApi.ts` mobile | Mobile | High |
| 17 | Cap nhat `HomeScreen.tsx` (personal + cold start + impression) | Mobile | High |
| 18 | Cap nhat `ProductDetailScreen.tsx` (similar + view tracking) | Mobile | High |
| 19 | Tao `interaction.service.ts` web | Web | High |
| 20 | Tao `recommendation.service.ts` web | Web | High |
| 21 | Them method `getRelatedProducts` vao `catalog.service.ts` web | Web | High |
| 22 | Cap nhat `HomePage.tsx` web (section goi y) | Web | High |
| 23 | Cap nhat `ProductDetailPage.tsx` web (section related + view tracking) | Web | High |
| 24 | Admin route `/recommendations/preview` | Backend | Medium |
| 25 | Admin UI xem truoc goi y (optional) | Web admin | Low |
| 26 | Tao API `GET /recommendations/cart` | Backend | Low (phase sau) |
| 27 | Lint + typecheck + test toan bo | All | Medium |
| 28 | Ghi AGENTS.md lenh test/lint/typecheck | All | Low |
| 29 | Script danh gia Precision@K, Recall@K, NDCG@K | Backend | Low (luan van) |

### 18.7. Luu y refactor helper

Hien `mapProductListItem`, `groupInventoryByProductId`, `repairInventoryReferencesForProduct` la private trong `product.service.ts`. De recommendation service reuse, co 2 lua chon:

- **(A) Export** cac helper nay truc tiep tu `product.service.ts` (don gian, it rui ro).
- **(B) Extract** sang `catalog.helpers.ts` chung (sach hon, nhung phai cap nhat import o product.service + favorite.service).

Khuyen nghi: lam **(A)** truoc, refactor sang **(B)** sau neu can.

### 18.8. Rui ro va giai phap

| Rui ro | Giai phap |
|--------|-----------|
| Helper `mapProductListItem` private trong product.service -> khong reuse duoc | Export truoc (A), refactor sau (B). |
| User moi chua co du lieu -> goi y rong | Cold start: top ban chay + hang moi + sale + rating cao. |
| Performance: query Favorite + Order + Product nhieu round | Dung `Promise.all` + chi select field can thiet. Gioi han candidate pool 100-300 san pham. Cache `/recommendations/me` 5-15 phut. |
| Trung lap san pham giua related va personal | Loai tru bang `Set` product_id truoc khi map. |
| Taste profile chua du (chi 1 favorite) | Scoring co weight thap cho profile match, weight cao cho sold/rating -> khong bias qua manh. |
| Web HomePage hien qua don gian (chi slider) | Them section nhung giu layout hien co, dat duoi slider. |
| Tracking event loi -> hong UI | Tracking phai fire-and-forget, khong chan UI. Backend phai validate va gioi han spam. |

### 18.9. Pham vi KHONG lam (out of scope cho MVP)

- **Collaborative filtering** (matrix factorization, user-user similarity) — phuc tap, can du lieu lon, deffer sang phase 7.
- **ML model / embedding** — ngoai scope MVP, chi lam rule-based scoring.
- **A/B testing recommendation** — ngoai scope.
- **Goi y trong gio hang** — defer sang phase 5.

### 18.10. Mo rong tuong lai (optional)

1. **Lich su xem (`product_view`)**: endpoint `POST /products/:id/view` -> tang do ca nhan hoa cho ca anonymous user (sessionId).
2. **Collaborative filtering**: khi du du lieu (order + favorite), chuyen sang item-item similarity.
3. **Trending**: goi y theo san pham dang tang luot xem/mua trong 7 ngay.
4. **Admin dashboard chat luong goi y**: thong ke CTR (click-through rate), add-to-cart rate, conversion rate tren san pham goi y.
5. **Cart recommendation**: cross-sell san pham lien quan dua tren san pham trong gio hang.
