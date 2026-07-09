# Ma tran system prompt cho phong phoi do ao

Tai lieu nay mo ta cach backend tao final prompt truoc khi gui sang provider AI/Comfy.
Prompt nguoi dung khong duoc gui thang sang provider. Backend chi dung prompt hop le
nhu mot phan boi canh va boc lai bang system prompt an toan.

## 1. Dau vao tao prompt

| Dau vao | Nguon | Vai tro |
|---|---|---|
| `selectedItems[].role` | Mobile builder | Xac dinh loai mon: `top`, `bottom`, `dress`, `shoes`, `outerwear`, `accessory` |
| `selectedItems[].nameSnapshot` | Product catalog | Mo ta mon can giu dung |
| `selectedItems[].colorSnapshot` | Product catalog | Giu mau sac catalog |
| `selectedItems[].size` | Product variant | Bo sung ngu canh fit |
| `outfitMode` | Mobile builder | Chon recipe: `single`, `top_bottom`, `full_set` |
| `contextPreset` | Mobile builder | Boi canh: giu nen cu, di lam, di choi, du lich, tiec... |
| `contextPrompt` | User input da validate | Chi dung lam boi canh them, khong thay rule he thong |

## 2. Lop prompt co dinh

Tat ca truong hop deu co cac yeu cau:

- Giu nguyen danh tinh nguoi, mat, toc, bieu cam, pose, dang nguoi, ti le co the va mau da.
- Chi thay doi mon thoi trang da chon.
- Giu cac vung co the thay duoc neu khong bi quan ao che mot cach tu nhien.
- Giu dung loai mon, mau, chat lieu, pattern, form, logo/hoa tiet co san tren anh catalog.
- Neu anh catalog co nguoi mau, quan ao khac, props, hanger, label hoac nen, chi lay dung role duoc chon.

## 3. Ma tran theo role

| Role | Trong tam prompt | Loi can chan |
|---|---|---|
| `top` | Co ao, vai, tay ao, nguc, nach ao, duong suon, lai ao, print placement | Doi quan/giay khi chi thu ao, co ao sai, ao dinh vao da |
| `bottom` | Lung quan/vay, hong, rise, day quan, ong quan, inseam, cuff, lai | Doi ao/giay khi chi thu quan, nhan doi quan, sai waistband |
| `dress` | Mot mon lien than, co, vai, eo, do roi vay, lai vay | Bien dress thanh ao + quan/vay roi, them quan neu khong chon |
| `shoes` | Hai chiec dung trai/phai, dung chan, dung ti le, bong do va tiep xuc mat dat | Chan tran, chi co mot chiec, giay bay, sai chan |
| `outerwear` | Layer ngoai, ve ao khoac, co, vai, tay, khuy/khoa, do mo va do ru | Ao khoac bi tron voi ao trong, layer nguoc, doi quan/giay |
| `accessory` | Ti le, huong, day deo, tiep xuc tay/co the, che khuat va bong do | Phu kien bay, qua to/nho, che mat, che mat hang chinh |

## 4. Ma tran theo mode

### `single`

- Neu chon `top`: chi thay ao, giu quan/vay, giay, phu kien va nen.
- Neu chon `bottom`: chi thay quan/vay, giu ao, giay, phu kien va nen.
- Neu chon `dress`: xem dress la mon lien than chinh, khong bien thanh hai mon.
- Neu chon `shoes`: chi thay giay/dep, giu trang phuc phia tren mat ca chan.
- Neu chon `outerwear`: chi them/thay layer ngoai, giu ao trong neu hop ly.
- Neu chon `accessory`: chi them phu kien, giu toan bo quan ao.

### `top_bottom`

- Ghep ao va quan/vay thanh outfit hai mon.
- Xu ly vung eo: tucked, untucked, cropped hoac layered phai tu nhien.
- Khong tao trung waistband, khong bien thanh jumpsuit neu user chon hai mon rieng.
- Giu giay, phu kien, mat, toc, tay va nen neu khong duoc chon.

### `full_set`

- Phoi tat ca mon da chon thanh mot bo do day du.
- Ton trong thu tu doc: vai/than tren -> eo -> chan -> ban chan -> phu kien.
- Neu co `dress`: dress la mon than chinh, khong them quan/vay neu khong chon.
- Neu co `outerwear`: ao khoac nam ngoai top/dress, layer tay/co hop ly.
- Neu co `shoes`: giay phai nam tren chan, dung ti le va cham dat.
- Neu co `accessory`: dat tu nhien, khong che mat hoac che chi tiet san pham quan trong.

## 5. Boi canh

| Preset | Huong dan |
|---|---|
| `none` | Giu nen, anh sang, goc may va chi thay quan ao |
| `work` | Van phong hien dai, lich su, business-casual |
| `casual` | Duong pho/sinh hoat hang ngay, anh sang tu nhien |
| `party` | Su kien buoi toi, anh sang dep, phong cach trang nhã |
| `travel` | Ngoai troi/du lich, thoang, nang tu nhien |
| `sport` | Nang dong, the thao, dung chuyen dong vua phai |
| `date` | Cafe/an toi, anh sang am, portrait doi thuong |
| `custom` | Dung prompt user da pass policy lam boi canh |

## 6. Negative prompt

Negative prompt gom hai lop:

- Lop chung: nude, noi dung nhay cam, doi mat/danh tinh/dang nguoi, tay chan loi, watermark, text, blur, sai mau/sai loai mon.
- Lop theo role: chan loi rieng cua ao, quan, dress, giay, ao khoac va phu kien.

## 7. File code lien quan

| File | Vai tro |
|---|---|
| `backend/src/modules/virtual-try-on/providers/virtual-try-on-prompt.ts` | Build final prompt va negative prompt |
| `backend/src/modules/virtual-try-on/providers/comfy-virtual-try-on.provider.ts` | Boc prompt thanh yeu cau 2x2 grid portrait cho Comfy |
| `backend/src/modules/virtual-try-on/prompt-policy/` | Validate prompt nguoi dung truoc khi tao job |
| `backend/src/modules/virtual-try-on/virtual-try-on.service.ts` | Goi prompt builder khi xu ly job |
