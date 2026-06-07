export type LocationProvince = {
  code: string;
  name: string;
  type: 'province' | 'municipality';
};

export type LocationWard = {
  code: string;
  name: string;
  type: 'ward' | 'commune' | 'special_zone';
  provinceCode: string;
};

export const LOCATION_DATA_VERSION = '2025-07-01';

export const LOCATION_DATA_SOURCE = {
  name: 'Công văn 1027/CTK-CSCL của Cục Thống kê',
  issuedAt: '2025-06-25',
  effectiveFrom: LOCATION_DATA_VERSION,
  url: 'https://www.nso.gov.vn/du-lieu-va-so-lieu-thong-ke/2025/07/cong-van-so-1027-ctk-cscl-ngay-25-6-2025-cua-cuc-thong-ke-ve-viec-thong-bao-ma-so-va-ten-don-vi-hanh-chinh-cap-xa-moi/',
};

export const provinces2025: LocationProvince[] = [
  {
    "code": "01",
    "name": "Thành phố Hà Nội",
    "type": "municipality"
  },
  {
    "code": "04",
    "name": "Tỉnh Cao Bằng",
    "type": "province"
  },
  {
    "code": "08",
    "name": "Tỉnh Tuyên Quang",
    "type": "province"
  },
  {
    "code": "11",
    "name": "Tỉnh Điện Biên",
    "type": "province"
  },
  {
    "code": "12",
    "name": "Tỉnh Lai Châu",
    "type": "province"
  },
  {
    "code": "14",
    "name": "Tỉnh Sơn La",
    "type": "province"
  },
  {
    "code": "15",
    "name": "Tỉnh Lào Cai",
    "type": "province"
  },
  {
    "code": "19",
    "name": "Tỉnh Thái Nguyên",
    "type": "province"
  },
  {
    "code": "20",
    "name": "Tỉnh Lạng Sơn",
    "type": "province"
  },
  {
    "code": "22",
    "name": "Tỉnh Quảng Ninh",
    "type": "province"
  },
  {
    "code": "24",
    "name": "Tỉnh Bắc Ninh",
    "type": "province"
  },
  {
    "code": "25",
    "name": "Tỉnh Phú Thọ",
    "type": "province"
  },
  {
    "code": "31",
    "name": "Thành phố Hải Phòng",
    "type": "municipality"
  },
  {
    "code": "33",
    "name": "Tỉnh Hưng Yên",
    "type": "province"
  },
  {
    "code": "37",
    "name": "Tỉnh Ninh Bình",
    "type": "province"
  },
  {
    "code": "38",
    "name": "Tỉnh Thanh Hóa",
    "type": "province"
  },
  {
    "code": "40",
    "name": "Tỉnh Nghệ An",
    "type": "province"
  },
  {
    "code": "42",
    "name": "Tỉnh Hà Tĩnh",
    "type": "province"
  },
  {
    "code": "44",
    "name": "Tỉnh Quảng Trị",
    "type": "province"
  },
  {
    "code": "46",
    "name": "Thành phố Huế",
    "type": "municipality"
  },
  {
    "code": "48",
    "name": "Thành phố Đà Nẵng",
    "type": "municipality"
  },
  {
    "code": "51",
    "name": "Tỉnh Quảng Ngãi",
    "type": "province"
  },
  {
    "code": "52",
    "name": "Tỉnh Gia Lai",
    "type": "province"
  },
  {
    "code": "56",
    "name": "Tỉnh Khánh Hòa",
    "type": "province"
  },
  {
    "code": "66",
    "name": "Tỉnh Đắk Lắk",
    "type": "province"
  },
  {
    "code": "68",
    "name": "Tỉnh Lâm Đồng",
    "type": "province"
  },
  {
    "code": "75",
    "name": "Tỉnh Đồng Nai",
    "type": "province"
  },
  {
    "code": "79",
    "name": "Thành phố Hồ Chí Minh",
    "type": "municipality"
  },
  {
    "code": "80",
    "name": "Tỉnh Tây Ninh",
    "type": "province"
  },
  {
    "code": "82",
    "name": "Tỉnh Đồng Tháp",
    "type": "province"
  },
  {
    "code": "86",
    "name": "Tỉnh Vĩnh Long",
    "type": "province"
  },
  {
    "code": "91",
    "name": "Tỉnh An Giang",
    "type": "province"
  },
  {
    "code": "92",
    "name": "Thành phố Cần Thơ",
    "type": "municipality"
  },
  {
    "code": "96",
    "name": "Tỉnh Cà Mau",
    "type": "province"
  }
];

export const wards2025: LocationWard[] = [
  {
    "code": "00070",
    "name": "Phường Hoàn Kiếm",
    "type": "ward",
    "provinceCode": "01"
  },
  {
    "code": "00082",
    "name": "Phường Cửa Nam",
    "type": "ward",
    "provinceCode": "01"
  },
  {
    "code": "00004",
    "name": "Phường Ba Đình",
    "type": "ward",
    "provinceCode": "01"
  },
  {
    "code": "00008",
    "name": "Phường Ngọc Hà",
    "type": "ward",
    "provinceCode": "01"
  },
  {
    "code": "00025",
    "name": "Phường Giảng Võ",
    "type": "ward",
    "provinceCode": "01"
  },
  {
    "code": "00256",
    "name": "Phường Hai Bà Trưng",
    "type": "ward",
    "provinceCode": "01"
  },
  {
    "code": "00283",
    "name": "Phường Vĩnh Tuy",
    "type": "ward",
    "provinceCode": "01"
  },
  {
    "code": "00292",
    "name": "Phường Bạch Mai",
    "type": "ward",
    "provinceCode": "01"
  },
  {
    "code": "00235",
    "name": "Phường Đống Đa",
    "type": "ward",
    "provinceCode": "01"
  },
  {
    "code": "00229",
    "name": "Phường Kim Liên",
    "type": "ward",
    "provinceCode": "01"
  },
  {
    "code": "00226",
    "name": "Phường Văn Miếu - Quốc Tử Giám",
    "type": "ward",
    "provinceCode": "01"
  },
  {
    "code": "00199",
    "name": "Phường Láng",
    "type": "ward",
    "provinceCode": "01"
  },
  {
    "code": "00190",
    "name": "Phường Ô Chợ Dừa",
    "type": "ward",
    "provinceCode": "01"
  },
  {
    "code": "00097",
    "name": "Phường Hồng Hà",
    "type": "ward",
    "provinceCode": "01"
  },
  {
    "code": "00328",
    "name": "Phường Lĩnh Nam",
    "type": "ward",
    "provinceCode": "01"
  },
  {
    "code": "00331",
    "name": "Phường Hoàng Mai",
    "type": "ward",
    "provinceCode": "01"
  },
  {
    "code": "00301",
    "name": "Phường Vĩnh Hưng",
    "type": "ward",
    "provinceCode": "01"
  },
  {
    "code": "00322",
    "name": "Phường Tương Mai",
    "type": "ward",
    "provinceCode": "01"
  },
  {
    "code": "00316",
    "name": "Phường Định Công",
    "type": "ward",
    "provinceCode": "01"
  },
  {
    "code": "00337",
    "name": "Phường Hoàng Liệt",
    "type": "ward",
    "provinceCode": "01"
  },
  {
    "code": "00340",
    "name": "Phường Yên Sở",
    "type": "ward",
    "provinceCode": "01"
  },
  {
    "code": "00367",
    "name": "Phường Thanh Xuân",
    "type": "ward",
    "provinceCode": "01"
  },
  {
    "code": "00364",
    "name": "Phường Khương Đình",
    "type": "ward",
    "provinceCode": "01"
  },
  {
    "code": "00352",
    "name": "Phường Phương Liệt",
    "type": "ward",
    "provinceCode": "01"
  },
  {
    "code": "00166",
    "name": "Phường Cầu Giấy",
    "type": "ward",
    "provinceCode": "01"
  },
  {
    "code": "00160",
    "name": "Phường Nghĩa Đô",
    "type": "ward",
    "provinceCode": "01"
  },
  {
    "code": "00175",
    "name": "Phường Yên Hòa",
    "type": "ward",
    "provinceCode": "01"
  },
  {
    "code": "00103",
    "name": "Phường Tây Hồ",
    "type": "ward",
    "provinceCode": "01"
  },
  {
    "code": "00091",
    "name": "Phường Phú Thượng",
    "type": "ward",
    "provinceCode": "01"
  },
  {
    "code": "00613",
    "name": "Phường Tây Tựu",
    "type": "ward",
    "provinceCode": "01"
  },
  {
    "code": "00619",
    "name": "Phường Phú Diễn",
    "type": "ward",
    "provinceCode": "01"
  },
  {
    "code": "00611",
    "name": "Phường Xuân Đỉnh",
    "type": "ward",
    "provinceCode": "01"
  },
  {
    "code": "00602",
    "name": "Phường Đông Ngạc",
    "type": "ward",
    "provinceCode": "01"
  },
  {
    "code": "00598",
    "name": "Phường Thượng Cát",
    "type": "ward",
    "provinceCode": "01"
  },
  {
    "code": "00592",
    "name": "Phường Từ Liêm",
    "type": "ward",
    "provinceCode": "01"
  },
  {
    "code": "00622",
    "name": "Phường Xuân Phương",
    "type": "ward",
    "provinceCode": "01"
  },
  {
    "code": "00634",
    "name": "Phường Tây Mỗ",
    "type": "ward",
    "provinceCode": "01"
  },
  {
    "code": "00637",
    "name": "Phường Đại Mỗ",
    "type": "ward",
    "provinceCode": "01"
  },
  {
    "code": "00145",
    "name": "Phường Long Biên",
    "type": "ward",
    "provinceCode": "01"
  },
  {
    "code": "00118",
    "name": "Phường Bồ Đề",
    "type": "ward",
    "provinceCode": "01"
  },
  {
    "code": "00127",
    "name": "Phường Việt Hưng",
    "type": "ward",
    "provinceCode": "01"
  },
  {
    "code": "00136",
    "name": "Phường Phúc Lợi",
    "type": "ward",
    "provinceCode": "01"
  },
  {
    "code": "09556",
    "name": "Phường Hà Đông",
    "type": "ward",
    "provinceCode": "01"
  },
  {
    "code": "09886",
    "name": "Phường Dương Nội",
    "type": "ward",
    "provinceCode": "01"
  },
  {
    "code": "09562",
    "name": "Phường Yên Nghĩa",
    "type": "ward",
    "provinceCode": "01"
  },
  {
    "code": "09568",
    "name": "Phường Phú Lương",
    "type": "ward",
    "provinceCode": "01"
  },
  {
    "code": "09552",
    "name": "Phường Kiến Hưng",
    "type": "ward",
    "provinceCode": "01"
  },
  {
    "code": "00640",
    "name": "Xã Thanh Trì",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "00664",
    "name": "Xã Đại Thanh",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "00685",
    "name": "Xã Nam Phù",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "00679",
    "name": "Xã Ngọc Hồi",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "00643",
    "name": "Phường Thanh Liệt",
    "type": "ward",
    "provinceCode": "01"
  },
  {
    "code": "10231",
    "name": "Xã Thượng Phúc",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "10183",
    "name": "Xã Thường Tín",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "10237",
    "name": "Xã Chương Dương",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "10210",
    "name": "Xã Hồng Vân",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "10273",
    "name": "Xã Phú Xuyên",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "10279",
    "name": "Xã Phượng Dực",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "10330",
    "name": "Xã Chuyên Mỹ",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "10342",
    "name": "Xã Đại Xuyên",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "10114",
    "name": "Xã Thanh Oai",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "10126",
    "name": "Xã Bình Minh",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "10144",
    "name": "Xã Tam Hưng",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "10180",
    "name": "Xã Dân Hòa",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "10354",
    "name": "Xã Vân Đình",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "10369",
    "name": "Xã Ứng Thiên",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "10417",
    "name": "Xã Hòa Xá",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "10402",
    "name": "Xã Ứng Hòa",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "10441",
    "name": "Xã Mỹ Đức",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "10465",
    "name": "Xã Hồng Sơn",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "10459",
    "name": "Xã Phúc Sơn",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "10489",
    "name": "Xã Hương Sơn",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "10015",
    "name": "Phường Chương Mỹ",
    "type": "ward",
    "provinceCode": "01"
  },
  {
    "code": "10030",
    "name": "Xã Phú Nghĩa",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "10045",
    "name": "Xã Xuân Mai",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "10081",
    "name": "Xã Trần Phú",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "10096",
    "name": "Xã Hòa Phú",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "10072",
    "name": "Xã Quảng Bị",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "09661",
    "name": "Xã Minh Châu",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "09619",
    "name": "Xã Quảng Oai",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "09664",
    "name": "Xã Vật Lại",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "09634",
    "name": "Xã Cổ Đô",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "09676",
    "name": "Xã Bất Bạt",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "09694",
    "name": "Xã Suối Hai",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "09700",
    "name": "Xã Ba Vì",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "09706",
    "name": "Xã Yên Bài",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "09574",
    "name": "Phường Sơn Tây",
    "type": "ward",
    "provinceCode": "01"
  },
  {
    "code": "09604",
    "name": "Phường Tùng Thiện",
    "type": "ward",
    "provinceCode": "01"
  },
  {
    "code": "09616",
    "name": "Xã Đoài Phương",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "09715",
    "name": "Xã Phúc Thọ",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "09739",
    "name": "Xã Phúc Lộc",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "09772",
    "name": "Xã Hát Môn",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "09955",
    "name": "Xã Thạch Thất",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "09982",
    "name": "Xã Hạ Bằng",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "10003",
    "name": "Xã Tây Phương",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "09988",
    "name": "Xã Hòa Lạc",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "04930",
    "name": "Xã Yên Xuân",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "09895",
    "name": "Xã Quốc Oai",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "09931",
    "name": "Xã Hưng Đạo",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "09910",
    "name": "Xã Kiều Phú",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "09952",
    "name": "Xã Phú Cát",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "09832",
    "name": "Xã Hoài Đức",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "09856",
    "name": "Xã Dương Hòa",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "09871",
    "name": "Xã Sơn Đồng",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "09877",
    "name": "Xã An Khánh",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "09784",
    "name": "Xã Đan Phượng",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "09817",
    "name": "Xã Ô Diên",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "09787",
    "name": "Xã Liên Minh",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "00565",
    "name": "Xã Gia Lâm",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "00562",
    "name": "Xã Thuận An",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "00577",
    "name": "Xã Bát Tràng",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "00541",
    "name": "Xã Phù Đổng",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "00475",
    "name": "Xã Thư Lâm",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "00454",
    "name": "Xã Đông Anh",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "00466",
    "name": "Xã Phúc Thịnh",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "00493",
    "name": "Xã Thiên Lộc",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "00508",
    "name": "Xã Vĩnh Thanh",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "09022",
    "name": "Xã Mê Linh",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "08980",
    "name": "Xã Yên Lãng",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "08995",
    "name": "Xã Tiến Thắng",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "08974",
    "name": "Xã Quang Minh",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "00376",
    "name": "Xã Sóc Sơn",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "00430",
    "name": "Xã Đa Phúc",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "00433",
    "name": "Xã Nội Bài",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "00385",
    "name": "Xã Trung Giã",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "00382",
    "name": "Xã Kim Anh",
    "type": "commune",
    "provinceCode": "01"
  },
  {
    "code": "01273",
    "name": "Phường Thục Phán",
    "type": "ward",
    "provinceCode": "04"
  },
  {
    "code": "01279",
    "name": "Phường Nùng Trí Cao",
    "type": "ward",
    "provinceCode": "04"
  },
  {
    "code": "01288",
    "name": "Phường Tân Giang",
    "type": "ward",
    "provinceCode": "04"
  },
  {
    "code": "01304",
    "name": "Xã Quảng Lâm",
    "type": "commune",
    "provinceCode": "04"
  },
  {
    "code": "01297",
    "name": "Xã Nam Quang",
    "type": "commune",
    "provinceCode": "04"
  },
  {
    "code": "01294",
    "name": "Xã Lý Bôn",
    "type": "commune",
    "provinceCode": "04"
  },
  {
    "code": "01290",
    "name": "Xã Bảo Lâm",
    "type": "commune",
    "provinceCode": "04"
  },
  {
    "code": "01318",
    "name": "Xã Yên Thổ",
    "type": "commune",
    "provinceCode": "04"
  },
  {
    "code": "01360",
    "name": "Xã Sơn Lộ",
    "type": "commune",
    "provinceCode": "04"
  },
  {
    "code": "01351",
    "name": "Xã Hưng Đạo",
    "type": "commune",
    "provinceCode": "04"
  },
  {
    "code": "01321",
    "name": "Xã Bảo Lạc",
    "type": "commune",
    "provinceCode": "04"
  },
  {
    "code": "01324",
    "name": "Xã Cốc Pàng",
    "type": "commune",
    "provinceCode": "04"
  },
  {
    "code": "01327",
    "name": "Xã Cô Ba",
    "type": "commune",
    "provinceCode": "04"
  },
  {
    "code": "01336",
    "name": "Xã Khánh Xuân",
    "type": "commune",
    "provinceCode": "04"
  },
  {
    "code": "01339",
    "name": "Xã Xuân Trường",
    "type": "commune",
    "provinceCode": "04"
  },
  {
    "code": "01354",
    "name": "Xã Huy Giáp",
    "type": "commune",
    "provinceCode": "04"
  },
  {
    "code": "01738",
    "name": "Xã Ca Thành",
    "type": "commune",
    "provinceCode": "04"
  },
  {
    "code": "01768",
    "name": "Xã Phan Thanh",
    "type": "commune",
    "provinceCode": "04"
  },
  {
    "code": "01777",
    "name": "Xã Thành Công",
    "type": "commune",
    "provinceCode": "04"
  },
  {
    "code": "01729",
    "name": "Xã Tĩnh Túc",
    "type": "commune",
    "provinceCode": "04"
  },
  {
    "code": "01774",
    "name": "Xã Tam Kim",
    "type": "commune",
    "provinceCode": "04"
  },
  {
    "code": "01726",
    "name": "Xã Nguyên Bình",
    "type": "commune",
    "provinceCode": "04"
  },
  {
    "code": "01747",
    "name": "Xã Minh Tâm",
    "type": "commune",
    "provinceCode": "04"
  },
  {
    "code": "01387",
    "name": "Xã Thanh Long",
    "type": "commune",
    "provinceCode": "04"
  },
  {
    "code": "01366",
    "name": "Xã Cần Yên",
    "type": "commune",
    "provinceCode": "04"
  },
  {
    "code": "01363",
    "name": "Xã Thông Nông",
    "type": "commune",
    "provinceCode": "04"
  },
  {
    "code": "01392",
    "name": "Xã Trường Hà",
    "type": "commune",
    "provinceCode": "04"
  },
  {
    "code": "01438",
    "name": "Xã Hà Quảng",
    "type": "commune",
    "provinceCode": "04"
  },
  {
    "code": "01393",
    "name": "Xã Lũng Nặm",
    "type": "commune",
    "provinceCode": "04"
  },
  {
    "code": "01414",
    "name": "Xã Tổng Cọt",
    "type": "commune",
    "provinceCode": "04"
  },
  {
    "code": "01660",
    "name": "Xã Nam Tuấn",
    "type": "commune",
    "provinceCode": "04"
  },
  {
    "code": "01654",
    "name": "Xã Hòa An",
    "type": "commune",
    "provinceCode": "04"
  },
  {
    "code": "01708",
    "name": "Xã Bạch Đằng",
    "type": "commune",
    "provinceCode": "04"
  },
  {
    "code": "01699",
    "name": "Xã Nguyễn Huệ",
    "type": "commune",
    "provinceCode": "04"
  },
  {
    "code": "01795",
    "name": "Xã Minh Khai",
    "type": "commune",
    "provinceCode": "04"
  },
  {
    "code": "01789",
    "name": "Xã Canh Tân",
    "type": "commune",
    "provinceCode": "04"
  },
  {
    "code": "01792",
    "name": "Xã Kim Đồng",
    "type": "commune",
    "provinceCode": "04"
  },
  {
    "code": "01807",
    "name": "Xã Thạch An",
    "type": "commune",
    "provinceCode": "04"
  },
  {
    "code": "01786",
    "name": "Xã Đông Khê",
    "type": "commune",
    "provinceCode": "04"
  },
  {
    "code": "01822",
    "name": "Xã Đức Long",
    "type": "commune",
    "provinceCode": "04"
  },
  {
    "code": "01648",
    "name": "Xã Phục Hòa",
    "type": "commune",
    "provinceCode": "04"
  },
  {
    "code": "01636",
    "name": "Xã Bế Văn Đàn",
    "type": "commune",
    "provinceCode": "04"
  },
  {
    "code": "01594",
    "name": "Xã Độc Lập",
    "type": "commune",
    "provinceCode": "04"
  },
  {
    "code": "01576",
    "name": "Xã Quảng Uyên",
    "type": "commune",
    "provinceCode": "04"
  },
  {
    "code": "01618",
    "name": "Xã Hạnh Phúc",
    "type": "commune",
    "provinceCode": "04"
  },
  {
    "code": "01456",
    "name": "Xã Quang Hán",
    "type": "commune",
    "provinceCode": "04"
  },
  {
    "code": "01447",
    "name": "Xã Trà Lĩnh",
    "type": "commune",
    "provinceCode": "04"
  },
  {
    "code": "01465",
    "name": "Xã Quang Trung",
    "type": "commune",
    "provinceCode": "04"
  },
  {
    "code": "01525",
    "name": "Xã Đoài Dương",
    "type": "commune",
    "provinceCode": "04"
  },
  {
    "code": "01477",
    "name": "Xã Trùng Khánh",
    "type": "commune",
    "provinceCode": "04"
  },
  {
    "code": "01501",
    "name": "Xã Đàm Thủy",
    "type": "commune",
    "provinceCode": "04"
  },
  {
    "code": "01489",
    "name": "Xã Đình Phong",
    "type": "commune",
    "provinceCode": "04"
  },
  {
    "code": "01537",
    "name": "Xã Lý Quốc",
    "type": "commune",
    "provinceCode": "04"
  },
  {
    "code": "01558",
    "name": "Xã Hạ Lang",
    "type": "commune",
    "provinceCode": "04"
  },
  {
    "code": "01561",
    "name": "Xã Vinh Quý",
    "type": "commune",
    "provinceCode": "04"
  },
  {
    "code": "01552",
    "name": "Xã Quang Long",
    "type": "commune",
    "provinceCode": "04"
  },
  {
    "code": "02269",
    "name": "Xã Thượng Lâm",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "02266",
    "name": "Xã Lâm Bình",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "02302",
    "name": "Xã Minh Quang",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "02296",
    "name": "Xã Bình An",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "02245",
    "name": "Xã Côn Lôn",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "02248",
    "name": "Xã Yên Hoa",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "02239",
    "name": "Xã Thượng Nông",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "02260",
    "name": "Xã Hồng Thái",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "02221",
    "name": "Xã Nà Hang",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "02308",
    "name": "Xã Tân Mỹ",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "02317",
    "name": "Xã Yên Lập",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "02320",
    "name": "Xã Tân An",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "02287",
    "name": "Xã Chiêm Hóa",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "02353",
    "name": "Xã Hòa An",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "02332",
    "name": "Xã Kiên Đài",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "02359",
    "name": "Xã Tri Phú",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "02350",
    "name": "Xã Kim Bình",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "02365",
    "name": "Xã Yên Nguyên",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "02305",
    "name": "Xã Trung Hà",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "02398",
    "name": "Xã Yên Phú",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "02380",
    "name": "Xã Bạch Xa",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "02392",
    "name": "Xã Phù Lưu",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "02374",
    "name": "Xã Hàm Yên",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "02404",
    "name": "Xã Bình Xa",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "02407",
    "name": "Xã Thái Sơn",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "02419",
    "name": "Xã Thái Hòa",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "02425",
    "name": "Xã Hùng Đức",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "02455",
    "name": "Xã Hùng Lợi",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "02458",
    "name": "Xã Trung Sơn",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "02494",
    "name": "Xã Thái Bình",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "02470",
    "name": "Xã Tân Long",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "02449",
    "name": "Xã Xuân Vân",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "02434",
    "name": "Xã Lực Hành",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "02473",
    "name": "Xã Yên Sơn",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "02530",
    "name": "Xã Nhữ Khê",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "02437",
    "name": "Xã Kiến Thiết",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "02545",
    "name": "Xã Tân Trào",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "02554",
    "name": "Xã Minh Thanh",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "02536",
    "name": "Xã Sơn Dương",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "02548",
    "name": "Xã Bình Ca",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "02578",
    "name": "Xã Tân Thanh",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "02620",
    "name": "Xã Sơn Thủy",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "02611",
    "name": "Xã Phú Lương",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "02623",
    "name": "Xã Trường Sinh",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "02608",
    "name": "Xã Hồng Sơn",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "02572",
    "name": "Xã Đông Thọ",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "02509",
    "name": "Phường Mỹ Lâm",
    "type": "ward",
    "provinceCode": "08"
  },
  {
    "code": "02215",
    "name": "Phường Minh Xuân",
    "type": "ward",
    "provinceCode": "08"
  },
  {
    "code": "02212",
    "name": "Phường Nông Tiến",
    "type": "ward",
    "provinceCode": "08"
  },
  {
    "code": "02512",
    "name": "Phường An Tường",
    "type": "ward",
    "provinceCode": "08"
  },
  {
    "code": "02524",
    "name": "Phường Bình Thuận",
    "type": "ward",
    "provinceCode": "08"
  },
  {
    "code": "00715",
    "name": "Xã Lũng Cú",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "00721",
    "name": "Xã Đồng Văn",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "00733",
    "name": "Xã Sà Phìn",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "00745",
    "name": "Xã Phố Bảng",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "00763",
    "name": "Xã Lũng Phìn",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "00787",
    "name": "Xã Sủng Máng",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "00778",
    "name": "Xã Sơn Vĩ",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "00769",
    "name": "Xã Mèo Vạc",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "00802",
    "name": "Xã Khâu Vai",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "00817",
    "name": "Xã Niêm Sơn",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "00808",
    "name": "Xã Tát Ngà",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "00829",
    "name": "Xã Thắng Mố",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "00832",
    "name": "Xã Bạch Đích",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "00820",
    "name": "Xã Yên Minh",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "00847",
    "name": "Xã Mậu Duệ",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "00859",
    "name": "Xã Ngọc Long",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "00871",
    "name": "Xã Du Già",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "00865",
    "name": "Xã Đường Thượng",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "00901",
    "name": "Xã Lùng Tám",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "00883",
    "name": "Xã Cán Tỷ",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "00889",
    "name": "Xã Nghĩa Thuận",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "00874",
    "name": "Xã Quản Bạ",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "00892",
    "name": "Xã Tùng Vài",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "01006",
    "name": "Xã Yên Cường",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "01012",
    "name": "Xã Đường Hồng",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "00991",
    "name": "Xã Bắc Mê",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "00985",
    "name": "Xã Giáp Trung",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "00982",
    "name": "Xã Minh Sơn",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "00994",
    "name": "Xã Minh Ngọc",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "00700",
    "name": "Xã Ngọc Đường",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "00694",
    "name": "Phường Hà Giang 1",
    "type": "ward",
    "provinceCode": "08"
  },
  {
    "code": "00691",
    "name": "Phường Hà Giang 2",
    "type": "ward",
    "provinceCode": "08"
  },
  {
    "code": "00937",
    "name": "Xã Lao Chải",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "00928",
    "name": "Xã Thanh Thủy",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "00919",
    "name": "Xã Minh Tân",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "00922",
    "name": "Xã Thuận Hòa",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "00925",
    "name": "Xã Tùng Bá",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "00706",
    "name": "Xã Phú Linh",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "00970",
    "name": "Xã Linh Hồ",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "00976",
    "name": "Xã Bạch Ngọc",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "00913",
    "name": "Xã Vị Xuyên",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "00967",
    "name": "Xã Việt Lâm",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "00952",
    "name": "Xã Cao Bồ",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "00958",
    "name": "Xã Thượng Sơn",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "01171",
    "name": "Xã Tân Quang",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "01165",
    "name": "Xã Đồng Tâm",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "01192",
    "name": "Xã Liên Hiệp",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "01180",
    "name": "Xã Bằng Hành",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "01153",
    "name": "Xã Bắc Quang",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "01201",
    "name": "Xã Hùng An",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "01156",
    "name": "Xã Vĩnh Tuy",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "01216",
    "name": "Xã Đồng Yên",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "01261",
    "name": "Xã Tiên Yên",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "01255",
    "name": "Xã Xuân Giang",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "01246",
    "name": "Xã Bằng Lang",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "01234",
    "name": "Xã Yên Thành",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "01237",
    "name": "Xã Quang Bình",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "01243",
    "name": "Xã Tân Trịnh",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "01225",
    "name": "Xã Tiên Nguyên",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "01090",
    "name": "Xã Thông Nguyên",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "01084",
    "name": "Xã Hồ Thầu",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "01075",
    "name": "Xã Nậm Dịch",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "01051",
    "name": "Xã Tân Tiến",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "01021",
    "name": "Xã Hoàng Su Phì",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "01033",
    "name": "Xã Thàng Tín",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "01024",
    "name": "Xã Bản Máy",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "01057",
    "name": "Xã Pờ Ly Ngài",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "01108",
    "name": "Xã Xín Mần",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "01096",
    "name": "Xã Pà Vầy Sủ",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "01141",
    "name": "Xã Nấm Dẩn",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "01117",
    "name": "Xã Trung Thịnh",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "01144",
    "name": "Xã Quảng Nguyên",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "01147",
    "name": "Xã Khuôn Lùng",
    "type": "commune",
    "provinceCode": "08"
  },
  {
    "code": "03325",
    "name": "Xã Mường Phăng",
    "type": "commune",
    "provinceCode": "11"
  },
  {
    "code": "03127",
    "name": "Phường Điện Biên Phủ",
    "type": "ward",
    "provinceCode": "11"
  },
  {
    "code": "03334",
    "name": "Phường Mường Thanh",
    "type": "ward",
    "provinceCode": "11"
  },
  {
    "code": "03151",
    "name": "Phường Mường Lay",
    "type": "ward",
    "provinceCode": "11"
  },
  {
    "code": "03328",
    "name": "Xã Thanh Nưa",
    "type": "commune",
    "provinceCode": "11"
  },
  {
    "code": "03352",
    "name": "Xã Thanh An",
    "type": "commune",
    "provinceCode": "11"
  },
  {
    "code": "03349",
    "name": "Xã Thanh Yên",
    "type": "commune",
    "provinceCode": "11"
  },
  {
    "code": "03356",
    "name": "Xã Sam Mứn",
    "type": "commune",
    "provinceCode": "11"
  },
  {
    "code": "03358",
    "name": "Xã Núa Ngam",
    "type": "commune",
    "provinceCode": "11"
  },
  {
    "code": "03368",
    "name": "Xã Mường Nhà",
    "type": "commune",
    "provinceCode": "11"
  },
  {
    "code": "03253",
    "name": "Xã Tuần Giáo",
    "type": "commune",
    "provinceCode": "11"
  },
  {
    "code": "03295",
    "name": "Xã Quài Tở",
    "type": "commune",
    "provinceCode": "11"
  },
  {
    "code": "03268",
    "name": "Xã Mường Mùn",
    "type": "commune",
    "provinceCode": "11"
  },
  {
    "code": "03260",
    "name": "Xã Pú Nhung",
    "type": "commune",
    "provinceCode": "11"
  },
  {
    "code": "03283",
    "name": "Xã Chiềng Sinh",
    "type": "commune",
    "provinceCode": "11"
  },
  {
    "code": "03217",
    "name": "Xã Tủa Chùa",
    "type": "commune",
    "provinceCode": "11"
  },
  {
    "code": "03226",
    "name": "Xã Sín Chải",
    "type": "commune",
    "provinceCode": "11"
  },
  {
    "code": "03241",
    "name": "Xã Sính Phình",
    "type": "commune",
    "provinceCode": "11"
  },
  {
    "code": "03220",
    "name": "Xã Tủa Thàng",
    "type": "commune",
    "provinceCode": "11"
  },
  {
    "code": "03244",
    "name": "Xã Sáng Nhè",
    "type": "commune",
    "provinceCode": "11"
  },
  {
    "code": "03172",
    "name": "Xã Na Sang",
    "type": "commune",
    "provinceCode": "11"
  },
  {
    "code": "03181",
    "name": "Xã Mường Tùng",
    "type": "commune",
    "provinceCode": "11"
  },
  {
    "code": "03193",
    "name": "Xã Pa Ham",
    "type": "commune",
    "provinceCode": "11"
  },
  {
    "code": "03194",
    "name": "Xã Nậm Nèn",
    "type": "commune",
    "provinceCode": "11"
  },
  {
    "code": "03202",
    "name": "Xã Mường Pồn",
    "type": "commune",
    "provinceCode": "11"
  },
  {
    "code": "03203",
    "name": "Xã Na Son",
    "type": "commune",
    "provinceCode": "11"
  },
  {
    "code": "03208",
    "name": "Xã Xa Dung",
    "type": "commune",
    "provinceCode": "11"
  },
  {
    "code": "03370",
    "name": "Xã Pu Nhi",
    "type": "commune",
    "provinceCode": "11"
  },
  {
    "code": "03214",
    "name": "Xã Mường Luân",
    "type": "commune",
    "provinceCode": "11"
  },
  {
    "code": "03385",
    "name": "Xã Tìa Dình",
    "type": "commune",
    "provinceCode": "11"
  },
  {
    "code": "03382",
    "name": "Xã Phình Giàng",
    "type": "commune",
    "provinceCode": "11"
  },
  {
    "code": "03166",
    "name": "Xã Mường Chà",
    "type": "commune",
    "provinceCode": "11"
  },
  {
    "code": "03169",
    "name": "Xã Nà Hỳ",
    "type": "commune",
    "provinceCode": "11"
  },
  {
    "code": "03176",
    "name": "Xã Nà Bủng",
    "type": "commune",
    "provinceCode": "11"
  },
  {
    "code": "03175",
    "name": "Xã Chà Tở",
    "type": "commune",
    "provinceCode": "11"
  },
  {
    "code": "03199",
    "name": "Xã Si Pa Phìn",
    "type": "commune",
    "provinceCode": "11"
  },
  {
    "code": "03160",
    "name": "Xã Mường Nhé",
    "type": "commune",
    "provinceCode": "11"
  },
  {
    "code": "03158",
    "name": "Xã Sín Thầu",
    "type": "commune",
    "provinceCode": "11"
  },
  {
    "code": "03163",
    "name": "Xã Mường Toong",
    "type": "commune",
    "provinceCode": "11"
  },
  {
    "code": "03162",
    "name": "Xã Nậm Kè",
    "type": "commune",
    "provinceCode": "11"
  },
  {
    "code": "03164",
    "name": "Xã Quảng Lâm",
    "type": "commune",
    "provinceCode": "11"
  },
  {
    "code": "03256",
    "name": "Xã Mường Ảng",
    "type": "commune",
    "provinceCode": "11"
  },
  {
    "code": "03316",
    "name": "Xã Nà Tấu",
    "type": "commune",
    "provinceCode": "11"
  },
  {
    "code": "03301",
    "name": "Xã Búng Lao",
    "type": "commune",
    "provinceCode": "11"
  },
  {
    "code": "03313",
    "name": "Xã Mường Lạn",
    "type": "commune",
    "provinceCode": "11"
  },
  {
    "code": "03637",
    "name": "Xã Mường Kim",
    "type": "commune",
    "provinceCode": "12"
  },
  {
    "code": "03640",
    "name": "Xã Khoen On",
    "type": "commune",
    "provinceCode": "12"
  },
  {
    "code": "03595",
    "name": "Xã Than Uyên",
    "type": "commune",
    "provinceCode": "12"
  },
  {
    "code": "03618",
    "name": "Xã Mường Than",
    "type": "commune",
    "provinceCode": "12"
  },
  {
    "code": "03616",
    "name": "Xã Pắc Ta",
    "type": "commune",
    "provinceCode": "12"
  },
  {
    "code": "03613",
    "name": "Xã Nậm Sỏ",
    "type": "commune",
    "provinceCode": "12"
  },
  {
    "code": "03598",
    "name": "Xã Tân Uyên",
    "type": "commune",
    "provinceCode": "12"
  },
  {
    "code": "03601",
    "name": "Xã Mường Khoa",
    "type": "commune",
    "provinceCode": "12"
  },
  {
    "code": "03424",
    "name": "Xã Bản Bo",
    "type": "commune",
    "provinceCode": "12"
  },
  {
    "code": "03390",
    "name": "Xã Bình Lư",
    "type": "commune",
    "provinceCode": "12"
  },
  {
    "code": "03405",
    "name": "Xã Tả Lèng",
    "type": "commune",
    "provinceCode": "12"
  },
  {
    "code": "03430",
    "name": "Xã Khun Há",
    "type": "commune",
    "provinceCode": "12"
  },
  {
    "code": "03408",
    "name": "Phường Tân Phong",
    "type": "ward",
    "provinceCode": "12"
  },
  {
    "code": "03388",
    "name": "Phường Đoàn Kết",
    "type": "ward",
    "provinceCode": "12"
  },
  {
    "code": "03394",
    "name": "Xã Sin Suối Hồ",
    "type": "commune",
    "provinceCode": "12"
  },
  {
    "code": "03549",
    "name": "Xã Phong Thổ",
    "type": "commune",
    "provinceCode": "12"
  },
  {
    "code": "03562",
    "name": "Xã Sì Lở Lầu",
    "type": "commune",
    "provinceCode": "12"
  },
  {
    "code": "03571",
    "name": "Xã Dào San",
    "type": "commune",
    "provinceCode": "12"
  },
  {
    "code": "03583",
    "name": "Xã Khổng Lào",
    "type": "commune",
    "provinceCode": "12"
  },
  {
    "code": "03529",
    "name": "Xã Tủa Sín Chải",
    "type": "commune",
    "provinceCode": "12"
  },
  {
    "code": "03478",
    "name": "Xã Sìn Hồ",
    "type": "commune",
    "provinceCode": "12"
  },
  {
    "code": "03508",
    "name": "Xã Hồng Thu",
    "type": "commune",
    "provinceCode": "12"
  },
  {
    "code": "03517",
    "name": "Xã Nậm Tăm",
    "type": "commune",
    "provinceCode": "12"
  },
  {
    "code": "03532",
    "name": "Xã Pu Sam Cáp",
    "type": "commune",
    "provinceCode": "12"
  },
  {
    "code": "03544",
    "name": "Xã Nậm Cuổi",
    "type": "commune",
    "provinceCode": "12"
  },
  {
    "code": "03538",
    "name": "Xã Nậm Mạ",
    "type": "commune",
    "provinceCode": "12"
  },
  {
    "code": "03487",
    "name": "Xã Lê Lợi",
    "type": "commune",
    "provinceCode": "12"
  },
  {
    "code": "03434",
    "name": "Xã Nậm Hàng",
    "type": "commune",
    "provinceCode": "12"
  },
  {
    "code": "03472",
    "name": "Xã Mường Mô",
    "type": "commune",
    "provinceCode": "12"
  },
  {
    "code": "03460",
    "name": "Xã Hua Bum",
    "type": "commune",
    "provinceCode": "12"
  },
  {
    "code": "03503",
    "name": "Xã Pa Tần",
    "type": "commune",
    "provinceCode": "12"
  },
  {
    "code": "03466",
    "name": "Xã Bum Nưa",
    "type": "commune",
    "provinceCode": "12"
  },
  {
    "code": "03433",
    "name": "Xã Bum Tở",
    "type": "commune",
    "provinceCode": "12"
  },
  {
    "code": "03445",
    "name": "Xã Mường Tè",
    "type": "commune",
    "provinceCode": "12"
  },
  {
    "code": "03439",
    "name": "Xã Thu Lũm",
    "type": "commune",
    "provinceCode": "12"
  },
  {
    "code": "03442",
    "name": "Xã Pa Ủ",
    "type": "commune",
    "provinceCode": "12"
  },
  {
    "code": "03463",
    "name": "Xã Tà Tổng",
    "type": "commune",
    "provinceCode": "12"
  },
  {
    "code": "03451",
    "name": "Xã Mù Cả",
    "type": "commune",
    "provinceCode": "12"
  },
  {
    "code": "03646",
    "name": "Phường Tô Hiệu",
    "type": "ward",
    "provinceCode": "14"
  },
  {
    "code": "03664",
    "name": "Phường Chiềng An",
    "type": "ward",
    "provinceCode": "14"
  },
  {
    "code": "03670",
    "name": "Phường Chiềng Cơi",
    "type": "ward",
    "provinceCode": "14"
  },
  {
    "code": "03679",
    "name": "Phường Chiềng Sinh",
    "type": "ward",
    "provinceCode": "14"
  },
  {
    "code": "03980",
    "name": "Phường Mộc Châu",
    "type": "ward",
    "provinceCode": "14"
  },
  {
    "code": "03979",
    "name": "Phường Mộc Sơn",
    "type": "ward",
    "provinceCode": "14"
  },
  {
    "code": "04033",
    "name": "Phường Vân Sơn",
    "type": "ward",
    "provinceCode": "14"
  },
  {
    "code": "03982",
    "name": "Phường Thảo Nguyên",
    "type": "ward",
    "provinceCode": "14"
  },
  {
    "code": "04000",
    "name": "Xã Đoàn Kết",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "04045",
    "name": "Xã Lóng Sập",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "03985",
    "name": "Xã Chiềng Sơn",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "04048",
    "name": "Xã Vân Hồ",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "04006",
    "name": "Xã Song Khủa",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "04018",
    "name": "Xã Tô Múa",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "04057",
    "name": "Xã Xuân Nha",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "03703",
    "name": "Xã Quỳnh Nhai",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "03688",
    "name": "Xã Mường Chiên",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "03694",
    "name": "Xã Mường Giôn",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "03712",
    "name": "Xã Mường Sại",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "03721",
    "name": "Xã Thuận Châu",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "03754",
    "name": "Xã Chiềng La",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "03784",
    "name": "Xã Nậm Lầu",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "03799",
    "name": "Xã Muổi Nọi",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "03757",
    "name": "Xã Mường Khiêng",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "03781",
    "name": "Xã Co Mạ",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "03724",
    "name": "Xã Bình Thuận",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "03727",
    "name": "Xã Mường É",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "03763",
    "name": "Xã Long Hẹ",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "03808",
    "name": "Xã Mường La",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "03814",
    "name": "Xã Chiềng Lao",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "03847",
    "name": "Xã Mường Bú",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "03850",
    "name": "Xã Chiềng Hoa",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "03856",
    "name": "Xã Bắc Yên",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "03868",
    "name": "Xã Tà Xùa",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "03880",
    "name": "Xã Tạ Khoa",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "03862",
    "name": "Xã Xím Vàng",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "03871",
    "name": "Xã Pắc Ngà",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "03892",
    "name": "Xã Chiềng Sại",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "03910",
    "name": "Xã Phù Yên",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "03922",
    "name": "Xã Gia Phù",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "03958",
    "name": "Xã Tường Hạ",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "03907",
    "name": "Xã Mường Cơi",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "03943",
    "name": "Xã Mường Bang",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "03970",
    "name": "Xã Tân Phong",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "03961",
    "name": "Xã Kim Bon",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "04075",
    "name": "Xã Yên Châu",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "04078",
    "name": "Xã Chiềng Hặc",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "04096",
    "name": "Xã Lóng Phiêng",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "04087",
    "name": "Xã Yên Sơn",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "04132",
    "name": "Xã Chiềng Mai",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "04105",
    "name": "Xã Mai Sơn",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "04159",
    "name": "Xã Phiêng Pằn",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "04123",
    "name": "Xã Chiềng Mung",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "04144",
    "name": "Xã Phiêng Cằm",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "04117",
    "name": "Xã Mường Chanh",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "04136",
    "name": "Xã Tà Hộc",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "04108",
    "name": "Xã Chiềng Sung",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "04171",
    "name": "Xã Bó Sinh",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "04222",
    "name": "Xã Chiềng Khương",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "04219",
    "name": "Xã Mường Hung",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "04204",
    "name": "Xã Chiềng Khoong",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "04183",
    "name": "Xã Mường Lầm",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "04186",
    "name": "Xã Nậm Ty",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "04168",
    "name": "Xã Sông Mã",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "04210",
    "name": "Xã Huổi Một",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "04195",
    "name": "Xã Chiềng Sơ",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "04231",
    "name": "Xã Sốp Cộp",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "04228",
    "name": "Xã Púng Bánh",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "03997",
    "name": "Xã Tân Yên",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "03760",
    "name": "Xã Mường Bám",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "03820",
    "name": "Xã Ngọc Chiến",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "03901",
    "name": "Xã Suối Tọ",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "04099",
    "name": "Xã Phiêng Khoài",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "04246",
    "name": "Xã Mường Lạn",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "04240",
    "name": "Xã Mường Lèo",
    "type": "commune",
    "provinceCode": "14"
  },
  {
    "code": "04465",
    "name": "Xã Khao Mang",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "04456",
    "name": "Xã Mù Cang Chải",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "04492",
    "name": "Xã Púng Luông",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "04630",
    "name": "Xã Tú Lệ",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "04606",
    "name": "Xã Trạm Tấu",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "04585",
    "name": "Xã Hạnh Phúc",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "04609",
    "name": "Xã Phình Hồ",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "04288",
    "name": "Phường Nghĩa Lộ",
    "type": "ward",
    "provinceCode": "15"
  },
  {
    "code": "04663",
    "name": "Phường Trung Tâm",
    "type": "ward",
    "provinceCode": "15"
  },
  {
    "code": "04681",
    "name": "Phường Cầu Thia",
    "type": "ward",
    "provinceCode": "15"
  },
  {
    "code": "04660",
    "name": "Xã Liên Sơn",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "04636",
    "name": "Xã Gia Hội",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "04651",
    "name": "Xã Sơn Lương",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "04705",
    "name": "Xã Thượng Bằng La",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "04699",
    "name": "Xã Chấn Thịnh",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "04711",
    "name": "Xã Nghĩa Tâm",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "04672",
    "name": "Xã Văn Chấn",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "04402",
    "name": "Xã Phong Dụ Hạ",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "04387",
    "name": "Xã Châu Quế",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "04381",
    "name": "Xã Lâm Giang",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "04399",
    "name": "Xã Đông Cuông",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "04429",
    "name": "Xã Tân Hợp",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "04375",
    "name": "Xã Mậu A",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "04441",
    "name": "Xã Xuân Ái",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "04450",
    "name": "Xã Mỏ Vàng",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "04309",
    "name": "Xã Lâm Thượng",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "04303",
    "name": "Xã Lục Yên",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "04336",
    "name": "Xã Tân Lĩnh",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "04342",
    "name": "Xã Khánh Hòa",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "04363",
    "name": "Xã Phúc Lợi",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "04345",
    "name": "Xã Mường Lai",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "04726",
    "name": "Xã Cảm Nhân",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "04744",
    "name": "Xã Yên Thành",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "04717",
    "name": "Xã Thác Bà",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "04714",
    "name": "Xã Yên Bình",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "04750",
    "name": "Xã Bảo Ái",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "04279",
    "name": "Phường Văn Phú",
    "type": "ward",
    "provinceCode": "15"
  },
  {
    "code": "04252",
    "name": "Phường Yên Bái",
    "type": "ward",
    "provinceCode": "15"
  },
  {
    "code": "04273",
    "name": "Phường Nam Cường",
    "type": "ward",
    "provinceCode": "15"
  },
  {
    "code": "04543",
    "name": "Phường Âu Lâu",
    "type": "ward",
    "provinceCode": "15"
  },
  {
    "code": "04498",
    "name": "Xã Trấn Yên",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "04576",
    "name": "Xã Hưng Khánh",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "04537",
    "name": "Xã Lương Thịnh",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "04564",
    "name": "Xã Việt Hồng",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "04531",
    "name": "Xã Quy Mông",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "02902",
    "name": "Xã Phong Hải",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "02926",
    "name": "Xã Xuân Quang",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "02905",
    "name": "Xã Bảo Thắng",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "02908",
    "name": "Xã Tằng Loỏng",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "02923",
    "name": "Xã Gia Phú",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "02746",
    "name": "Xã Cốc San",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "02680",
    "name": "Xã Hợp Thành",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "02671",
    "name": "Phường Cam Đường",
    "type": "ward",
    "provinceCode": "15"
  },
  {
    "code": "02647",
    "name": "Phường Lào Cai",
    "type": "ward",
    "provinceCode": "15"
  },
  {
    "code": "02728",
    "name": "Xã Mường Hum",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "02707",
    "name": "Xã Dền Sáng",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "02701",
    "name": "Xã Y Tý",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "02686",
    "name": "Xã A Mú Sung",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "02695",
    "name": "Xã Trịnh Tường",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "02725",
    "name": "Xã Bản Xèo",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "02683",
    "name": "Xã Bát Xát",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "02953",
    "name": "Xã Nghĩa Đô",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "02968",
    "name": "Xã Thượng Hà",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "02947",
    "name": "Xã Bảo Yên",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "02962",
    "name": "Xã Xuân Hòa",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "02998",
    "name": "Xã Phúc Khánh",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "02989",
    "name": "Xã Bảo Hà",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "03061",
    "name": "Xã Võ Lao",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "03103",
    "name": "Xã Khánh Yên",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "03082",
    "name": "Xã Văn Bàn",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "03106",
    "name": "Xã Dương Quỳ",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "03091",
    "name": "Xã Chiềng Ken",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "03121",
    "name": "Xã Minh Lương",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "03076",
    "name": "Xã Nậm Chày",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "03043",
    "name": "Xã Mường Bo",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "03046",
    "name": "Xã Bản Hồ",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "03013",
    "name": "Xã Tả Phìn",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "03037",
    "name": "Xã Tả Van",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "03006",
    "name": "Phường Sa Pa",
    "type": "ward",
    "provinceCode": "15"
  },
  {
    "code": "02896",
    "name": "Xã Cốc Lầu",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "02890",
    "name": "Xã Bảo Nhai",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "02869",
    "name": "Xã Bản Liền",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "02839",
    "name": "Xã Bắc Hà",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "02842",
    "name": "Xã Tả Củ Tỷ",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "02848",
    "name": "Xã Lùng Phình",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "02752",
    "name": "Xã Pha Long",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "02761",
    "name": "Xã Mường Khương",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "02788",
    "name": "Xã Bản Lầu",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "02782",
    "name": "Xã Cao Sơn",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "02809",
    "name": "Xã Si Ma Cai",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "02824",
    "name": "Xã Sín Chéng",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "04474",
    "name": "Xã Lao Chải",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "04489",
    "name": "Xã Chế Tạo",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "04462",
    "name": "Xã Nậm Có",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "04603",
    "name": "Xã Tà Xi Láng",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "04423",
    "name": "Xã Phong Dụ Thượng",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "04693",
    "name": "Xã Cát Thịnh",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "03085",
    "name": "Xã Nậm Xé",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "03004",
    "name": "Xã Ngũ Chỉ Sơn",
    "type": "commune",
    "provinceCode": "15"
  },
  {
    "code": "05443",
    "name": "Phường Phan Đình Phùng",
    "type": "ward",
    "provinceCode": "19"
  },
  {
    "code": "05710",
    "name": "Phường Linh Sơn",
    "type": "ward",
    "provinceCode": "19"
  },
  {
    "code": "05500",
    "name": "Phường Tích Lương",
    "type": "ward",
    "provinceCode": "19"
  },
  {
    "code": "05467",
    "name": "Phường Gia Sàng",
    "type": "ward",
    "provinceCode": "19"
  },
  {
    "code": "05455",
    "name": "Phường Quyết Thắng",
    "type": "ward",
    "provinceCode": "19"
  },
  {
    "code": "05482",
    "name": "Phường Quan Triều",
    "type": "ward",
    "provinceCode": "19"
  },
  {
    "code": "05503",
    "name": "Xã Tân Cương",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "05488",
    "name": "Xã Đại Phúc",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "05830",
    "name": "Xã Đại Từ",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "05776",
    "name": "Xã Đức Lương",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "05800",
    "name": "Xã Phú Thịnh",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "05818",
    "name": "Xã La Bằng",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "05788",
    "name": "Xã Phú Lạc",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "05809",
    "name": "Xã An Khánh",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "05851",
    "name": "Xã Quân Chu",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "05845",
    "name": "Xã Vạn Phú",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "05773",
    "name": "Xã Phú Xuyên",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "05860",
    "name": "Phường Phổ Yên",
    "type": "ward",
    "provinceCode": "19"
  },
  {
    "code": "05890",
    "name": "Phường Vạn Xuân",
    "type": "ward",
    "provinceCode": "19"
  },
  {
    "code": "05899",
    "name": "Phường Trung Thành",
    "type": "ward",
    "provinceCode": "19"
  },
  {
    "code": "05857",
    "name": "Phường Phúc Thuận",
    "type": "ward",
    "provinceCode": "19"
  },
  {
    "code": "05881",
    "name": "Xã Thành Công",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "05908",
    "name": "Xã Phú Bình",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "05923",
    "name": "Xã Tân Thành",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "05941",
    "name": "Xã Điềm Thụy",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "05953",
    "name": "Xã Kha Sơn",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "05917",
    "name": "Xã Tân Khánh",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "05692",
    "name": "Xã Đồng Hỷ",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "05674",
    "name": "Xã Quang Sơn",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "05662",
    "name": "Xã Trại Cau",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "05707",
    "name": "Xã Nam Hòa",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "05680",
    "name": "Xã Văn Hán",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "05665",
    "name": "Xã Văn Lăng",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "05518",
    "name": "Phường Sông Công",
    "type": "ward",
    "provinceCode": "19"
  },
  {
    "code": "05533",
    "name": "Phường Bá Xuyên",
    "type": "ward",
    "provinceCode": "19"
  },
  {
    "code": "05528",
    "name": "Phường Bách Quang",
    "type": "ward",
    "provinceCode": "19"
  },
  {
    "code": "05611",
    "name": "Xã Phú Lương",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "05641",
    "name": "Xã Vô Tranh",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "05620",
    "name": "Xã Yên Trạch",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "05632",
    "name": "Xã Hợp Thành",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "05569",
    "name": "Xã Định Hóa",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "05587",
    "name": "Xã Bình Yên",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "05581",
    "name": "Xã Trung Hội",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "05563",
    "name": "Xã Phượng Tiến",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "05602",
    "name": "Xã Phú Đình",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "05605",
    "name": "Xã Bình Thành",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "05551",
    "name": "Xã Kim Phượng",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "05542",
    "name": "Xã Lam Vỹ",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "05716",
    "name": "Xã Võ Nhai",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "05719",
    "name": "Xã Sảng Mộc",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "05755",
    "name": "Xã Dân Tiến",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "05722",
    "name": "Xã Nghinh Tường",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "05725",
    "name": "Xã Thần Sa",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "05740",
    "name": "Xã La Hiên",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "05746",
    "name": "Xã Tràng Xá",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "01864",
    "name": "Xã Bằng Thành",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "01882",
    "name": "Xã Nghiên Loan",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "01879",
    "name": "Xã Cao Minh",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "01906",
    "name": "Xã Ba Bể",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "01912",
    "name": "Xã Chợ Rã",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "01894",
    "name": "Xã Phúc Lộc",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "01921",
    "name": "Xã Thượng Minh",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "01933",
    "name": "Xã Đồng Phúc",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "02116",
    "name": "Xã Yên Bình",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "01942",
    "name": "Xã Bằng Vân",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "01954",
    "name": "Xã Ngân Sơn",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "01936",
    "name": "Xã Nà Phặc",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "01960",
    "name": "Xã Hiệp Lực",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "02026",
    "name": "Xã Nam Cường",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "02038",
    "name": "Xã Quảng Bạch",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "02044",
    "name": "Xã Yên Thịnh",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "02020",
    "name": "Xã Chợ Đồn",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "02083",
    "name": "Xã Yên Phong",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "02071",
    "name": "Xã Nghĩa Tá",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "01969",
    "name": "Xã Phủ Thông",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "02008",
    "name": "Xã Cẩm Giàng",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "01981",
    "name": "Xã Vĩnh Thông",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "02014",
    "name": "Xã Bạch Thông",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "01849",
    "name": "Xã Phong Quang",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "01840",
    "name": "Phường Đức Xuân",
    "type": "ward",
    "provinceCode": "19"
  },
  {
    "code": "01843",
    "name": "Phường Bắc Kạn",
    "type": "ward",
    "provinceCode": "19"
  },
  {
    "code": "02143",
    "name": "Xã Văn Lang",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "02152",
    "name": "Xã Cường Lợi",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "02155",
    "name": "Xã Na Rì",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "02176",
    "name": "Xã Trần Phú",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "02185",
    "name": "Xã Côn Minh",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "02191",
    "name": "Xã Xuân Dương",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "02104",
    "name": "Xã Tân Kỳ",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "02101",
    "name": "Xã Thanh Mai",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "02107",
    "name": "Xã Thanh Thịnh",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "02086",
    "name": "Xã Chợ Mới",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "01957",
    "name": "Xã Thượng Quan",
    "type": "commune",
    "provinceCode": "19"
  },
  {
    "code": "06040",
    "name": "Xã Thất Khê",
    "type": "commune",
    "provinceCode": "20"
  },
  {
    "code": "06001",
    "name": "Xã Đoàn Kết",
    "type": "commune",
    "provinceCode": "20"
  },
  {
    "code": "06019",
    "name": "Xã Tân Tiến",
    "type": "commune",
    "provinceCode": "20"
  },
  {
    "code": "06046",
    "name": "Xã Tràng Định",
    "type": "commune",
    "provinceCode": "20"
  },
  {
    "code": "06004",
    "name": "Xã Quốc Khánh",
    "type": "commune",
    "provinceCode": "20"
  },
  {
    "code": "06037",
    "name": "Xã Kháng Chiến",
    "type": "commune",
    "provinceCode": "20"
  },
  {
    "code": "06058",
    "name": "Xã Quốc Việt",
    "type": "commune",
    "provinceCode": "20"
  },
  {
    "code": "06112",
    "name": "Xã Bình Gia",
    "type": "commune",
    "provinceCode": "20"
  },
  {
    "code": "06115",
    "name": "Xã Tân Văn",
    "type": "commune",
    "provinceCode": "20"
  },
  {
    "code": "06079",
    "name": "Xã Hồng Phong",
    "type": "commune",
    "provinceCode": "20"
  },
  {
    "code": "06073",
    "name": "Xã Hoa Thám",
    "type": "commune",
    "provinceCode": "20"
  },
  {
    "code": "06076",
    "name": "Xã Quý Hòa",
    "type": "commune",
    "provinceCode": "20"
  },
  {
    "code": "06085",
    "name": "Xã Thiện Hòa",
    "type": "commune",
    "provinceCode": "20"
  },
  {
    "code": "06091",
    "name": "Xã Thiện Thuật",
    "type": "commune",
    "provinceCode": "20"
  },
  {
    "code": "06103",
    "name": "Xã Thiện Long",
    "type": "commune",
    "provinceCode": "20"
  },
  {
    "code": "06325",
    "name": "Xã Bắc Sơn",
    "type": "commune",
    "provinceCode": "20"
  },
  {
    "code": "06349",
    "name": "Xã Hưng Vũ",
    "type": "commune",
    "provinceCode": "20"
  },
  {
    "code": "06367",
    "name": "Xã Vũ Lăng",
    "type": "commune",
    "provinceCode": "20"
  },
  {
    "code": "06376",
    "name": "Xã Nhất Hòa",
    "type": "commune",
    "provinceCode": "20"
  },
  {
    "code": "06364",
    "name": "Xã Vũ Lễ",
    "type": "commune",
    "provinceCode": "20"
  },
  {
    "code": "06337",
    "name": "Xã Tân Tri",
    "type": "commune",
    "provinceCode": "20"
  },
  {
    "code": "06253",
    "name": "Xã Văn Quan",
    "type": "commune",
    "provinceCode": "20"
  },
  {
    "code": "06280",
    "name": "Xã Điềm He",
    "type": "commune",
    "provinceCode": "20"
  },
  {
    "code": "06313",
    "name": "Xã Tri Lễ",
    "type": "commune",
    "provinceCode": "20"
  },
  {
    "code": "06298",
    "name": "Xã Yên Phúc",
    "type": "commune",
    "provinceCode": "20"
  },
  {
    "code": "06316",
    "name": "Xã Tân Đoàn",
    "type": "commune",
    "provinceCode": "20"
  },
  {
    "code": "06286",
    "name": "Xã Khánh Khê",
    "type": "commune",
    "provinceCode": "20"
  },
  {
    "code": "06124",
    "name": "Xã Na Sầm",
    "type": "commune",
    "provinceCode": "20"
  },
  {
    "code": "06154",
    "name": "Xã Văn Lãng",
    "type": "commune",
    "provinceCode": "20"
  },
  {
    "code": "06151",
    "name": "Xã Hội Hoan",
    "type": "commune",
    "provinceCode": "20"
  },
  {
    "code": "06148",
    "name": "Xã Thụy Hùng",
    "type": "commune",
    "provinceCode": "20"
  },
  {
    "code": "06172",
    "name": "Xã Hoàng Văn Thụ",
    "type": "commune",
    "provinceCode": "20"
  },
  {
    "code": "06529",
    "name": "Xã Lộc Bình",
    "type": "commune",
    "provinceCode": "20"
  },
  {
    "code": "06541",
    "name": "Xã Mẫu Sơn",
    "type": "commune",
    "provinceCode": "20"
  },
  {
    "code": "06526",
    "name": "Xã Na Dương",
    "type": "commune",
    "provinceCode": "20"
  },
  {
    "code": "06601",
    "name": "Xã Lợi Bác",
    "type": "commune",
    "provinceCode": "20"
  },
  {
    "code": "06577",
    "name": "Xã Thống Nhất",
    "type": "commune",
    "provinceCode": "20"
  },
  {
    "code": "06607",
    "name": "Xã Xuân Dương",
    "type": "commune",
    "provinceCode": "20"
  },
  {
    "code": "06565",
    "name": "Xã Khuất Xá",
    "type": "commune",
    "provinceCode": "20"
  },
  {
    "code": "06613",
    "name": "Xã Đình Lập",
    "type": "commune",
    "provinceCode": "20"
  },
  {
    "code": "06637",
    "name": "Xã Châu Sơn",
    "type": "commune",
    "provinceCode": "20"
  },
  {
    "code": "06625",
    "name": "Xã Kiên Mộc",
    "type": "commune",
    "provinceCode": "20"
  },
  {
    "code": "06616",
    "name": "Xã Thái Bình",
    "type": "commune",
    "provinceCode": "20"
  },
  {
    "code": "06385",
    "name": "Xã Hữu Lũng",
    "type": "commune",
    "provinceCode": "20"
  },
  {
    "code": "06457",
    "name": "Xã Tuấn Sơn",
    "type": "commune",
    "provinceCode": "20"
  },
  {
    "code": "06445",
    "name": "Xã Tân Thành",
    "type": "commune",
    "provinceCode": "20"
  },
  {
    "code": "06415",
    "name": "Xã Vân Nham",
    "type": "commune",
    "provinceCode": "20"
  },
  {
    "code": "06436",
    "name": "Xã Thiện Tân",
    "type": "commune",
    "provinceCode": "20"
  },
  {
    "code": "06391",
    "name": "Xã Yên Bình",
    "type": "commune",
    "provinceCode": "20"
  },
  {
    "code": "06400",
    "name": "Xã Hữu Liên",
    "type": "commune",
    "provinceCode": "20"
  },
  {
    "code": "06427",
    "name": "Xã Cai Kinh",
    "type": "commune",
    "provinceCode": "20"
  },
  {
    "code": "06463",
    "name": "Xã Chi Lăng",
    "type": "commune",
    "provinceCode": "20"
  },
  {
    "code": "06496",
    "name": "Xã Nhân Lý",
    "type": "commune",
    "provinceCode": "20"
  },
  {
    "code": "06481",
    "name": "Xã Chiến Thắng",
    "type": "commune",
    "provinceCode": "20"
  },
  {
    "code": "06517",
    "name": "Xã Quan Sơn",
    "type": "commune",
    "provinceCode": "20"
  },
  {
    "code": "06475",
    "name": "Xã Bằng Mạc",
    "type": "commune",
    "provinceCode": "20"
  },
  {
    "code": "06505",
    "name": "Xã Vạn Linh",
    "type": "commune",
    "provinceCode": "20"
  },
  {
    "code": "06184",
    "name": "Xã Đồng Đăng",
    "type": "commune",
    "provinceCode": "20"
  },
  {
    "code": "06211",
    "name": "Xã Cao Lộc",
    "type": "commune",
    "provinceCode": "20"
  },
  {
    "code": "06220",
    "name": "Xã Công Sơn",
    "type": "commune",
    "provinceCode": "20"
  },
  {
    "code": "06196",
    "name": "Xã Ba Sơn",
    "type": "commune",
    "provinceCode": "20"
  },
  {
    "code": "05986",
    "name": "Phường Tam Thanh",
    "type": "ward",
    "provinceCode": "20"
  },
  {
    "code": "05983",
    "name": "Phường Lương Văn Tri",
    "type": "ward",
    "provinceCode": "20"
  },
  {
    "code": "06187",
    "name": "Phường Kỳ Lừa",
    "type": "ward",
    "provinceCode": "20"
  },
  {
    "code": "05977",
    "name": "Phường Đông Kinh",
    "type": "ward",
    "provinceCode": "20"
  },
  {
    "code": "07090",
    "name": "Phường An Sinh",
    "type": "ward",
    "provinceCode": "22"
  },
  {
    "code": "07093",
    "name": "Phường Đông Triều",
    "type": "ward",
    "provinceCode": "22"
  },
  {
    "code": "07081",
    "name": "Phường Bình Khê",
    "type": "ward",
    "provinceCode": "22"
  },
  {
    "code": "07069",
    "name": "Phường Mạo Khê",
    "type": "ward",
    "provinceCode": "22"
  },
  {
    "code": "07114",
    "name": "Phường Hoàng Quế",
    "type": "ward",
    "provinceCode": "22"
  },
  {
    "code": "06832",
    "name": "Phường Yên Tử",
    "type": "ward",
    "provinceCode": "22"
  },
  {
    "code": "06820",
    "name": "Phường Vàng Danh",
    "type": "ward",
    "provinceCode": "22"
  },
  {
    "code": "06811",
    "name": "Phường Uông Bí",
    "type": "ward",
    "provinceCode": "22"
  },
  {
    "code": "07135",
    "name": "Phường Đông Mai",
    "type": "ward",
    "provinceCode": "22"
  },
  {
    "code": "07147",
    "name": "Phường Hiệp Hòa",
    "type": "ward",
    "provinceCode": "22"
  },
  {
    "code": "07132",
    "name": "Phường Quảng Yên",
    "type": "ward",
    "provinceCode": "22"
  },
  {
    "code": "07168",
    "name": "Phường Hà An",
    "type": "ward",
    "provinceCode": "22"
  },
  {
    "code": "07183",
    "name": "Phường Phong Cốc",
    "type": "ward",
    "provinceCode": "22"
  },
  {
    "code": "07180",
    "name": "Phường Liên Hòa",
    "type": "ward",
    "provinceCode": "22"
  },
  {
    "code": "06706",
    "name": "Phường Tuần Châu",
    "type": "ward",
    "provinceCode": "22"
  },
  {
    "code": "06661",
    "name": "Phường Việt Hưng",
    "type": "ward",
    "provinceCode": "22"
  },
  {
    "code": "06673",
    "name": "Phường Bãi Cháy",
    "type": "ward",
    "provinceCode": "22"
  },
  {
    "code": "06652",
    "name": "Phường Hà Tu",
    "type": "ward",
    "provinceCode": "22"
  },
  {
    "code": "06676",
    "name": "Phường Hà Lầm",
    "type": "ward",
    "provinceCode": "22"
  },
  {
    "code": "06658",
    "name": "Phường Cao Xanh",
    "type": "ward",
    "provinceCode": "22"
  },
  {
    "code": "06685",
    "name": "Phường Hồng Gai",
    "type": "ward",
    "provinceCode": "22"
  },
  {
    "code": "06688",
    "name": "Phường Hạ Long",
    "type": "ward",
    "provinceCode": "22"
  },
  {
    "code": "07030",
    "name": "Phường Hoành Bồ",
    "type": "ward",
    "provinceCode": "22"
  },
  {
    "code": "07054",
    "name": "Xã Quảng La",
    "type": "commune",
    "provinceCode": "22"
  },
  {
    "code": "07060",
    "name": "Xã Thống Nhất",
    "type": "commune",
    "provinceCode": "22"
  },
  {
    "code": "06760",
    "name": "Phường Mông Dương",
    "type": "ward",
    "provinceCode": "22"
  },
  {
    "code": "06778",
    "name": "Phường Quang Hanh",
    "type": "ward",
    "provinceCode": "22"
  },
  {
    "code": "06793",
    "name": "Phường Cẩm Phả",
    "type": "ward",
    "provinceCode": "22"
  },
  {
    "code": "06781",
    "name": "Phường Cửa Ông",
    "type": "ward",
    "provinceCode": "22"
  },
  {
    "code": "06799",
    "name": "Xã Hải Hòa",
    "type": "commune",
    "provinceCode": "22"
  },
  {
    "code": "06862",
    "name": "Xã Tiên Yên",
    "type": "commune",
    "provinceCode": "22"
  },
  {
    "code": "06874",
    "name": "Xã Điền Xá",
    "type": "commune",
    "provinceCode": "22"
  },
  {
    "code": "06877",
    "name": "Xã Đông Ngũ",
    "type": "commune",
    "provinceCode": "22"
  },
  {
    "code": "06886",
    "name": "Xã Hải Lạng",
    "type": "commune",
    "provinceCode": "22"
  },
  {
    "code": "06985",
    "name": "Xã Lương Minh",
    "type": "commune",
    "provinceCode": "22"
  },
  {
    "code": "06979",
    "name": "Xã Kỳ Thượng",
    "type": "commune",
    "provinceCode": "22"
  },
  {
    "code": "06970",
    "name": "Xã Ba Chẽ",
    "type": "commune",
    "provinceCode": "22"
  },
  {
    "code": "06913",
    "name": "Xã Quảng Tân",
    "type": "commune",
    "provinceCode": "22"
  },
  {
    "code": "06895",
    "name": "Xã Đầm Hà",
    "type": "commune",
    "provinceCode": "22"
  },
  {
    "code": "06922",
    "name": "Xã Quảng Hà",
    "type": "commune",
    "provinceCode": "22"
  },
  {
    "code": "06946",
    "name": "Xã Đường Hoa",
    "type": "commune",
    "provinceCode": "22"
  },
  {
    "code": "06931",
    "name": "Xã Quảng Đức",
    "type": "commune",
    "provinceCode": "22"
  },
  {
    "code": "06841",
    "name": "Xã Hoành Mô",
    "type": "commune",
    "provinceCode": "22"
  },
  {
    "code": "06856",
    "name": "Xã Lục Hồn",
    "type": "commune",
    "provinceCode": "22"
  },
  {
    "code": "06838",
    "name": "Xã Bình Liêu",
    "type": "commune",
    "provinceCode": "22"
  },
  {
    "code": "06724",
    "name": "Xã Hải Sơn",
    "type": "commune",
    "provinceCode": "22"
  },
  {
    "code": "06733",
    "name": "Xã Hải Ninh",
    "type": "commune",
    "provinceCode": "22"
  },
  {
    "code": "06757",
    "name": "Xã Vĩnh Thực",
    "type": "commune",
    "provinceCode": "22"
  },
  {
    "code": "06712",
    "name": "Phường Móng Cái 1",
    "type": "ward",
    "provinceCode": "22"
  },
  {
    "code": "06709",
    "name": "Phường Móng Cái 2",
    "type": "ward",
    "provinceCode": "22"
  },
  {
    "code": "06736",
    "name": "Phường Móng Cái 3",
    "type": "ward",
    "provinceCode": "22"
  },
  {
    "code": "06994",
    "name": "Đặc khu Vân Đồn",
    "type": "special_zone",
    "provinceCode": "22"
  },
  {
    "code": "07192",
    "name": "Đặc khu Cô Tô",
    "type": "special_zone",
    "provinceCode": "22"
  },
  {
    "code": "06967",
    "name": "Xã Cái Chiên",
    "type": "commune",
    "provinceCode": "22"
  },
  {
    "code": "07627",
    "name": "Xã Đại Sơn",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "07615",
    "name": "Xã Sơn Động",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "07616",
    "name": "Xã Tây Yên Tử",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "07672",
    "name": "Xã Dương Hưu",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "07642",
    "name": "Xã Yên Định",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "07654",
    "name": "Xã An Lạc",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "07621",
    "name": "Xã Vân Sơn",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "07573",
    "name": "Xã Biển Động",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "07582",
    "name": "Xã Lục Ngạn",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "07594",
    "name": "Xã Đèo Gia",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "07543",
    "name": "Xã Sơn Hải",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "07531",
    "name": "Xã Tân Sơn",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "07537",
    "name": "Xã Biên Sơn",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "07534",
    "name": "Xã Sa Lý",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "07603",
    "name": "Xã Nam Dương",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "07552",
    "name": "Xã Kiên Lao",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "07525",
    "name": "Phường Chũ",
    "type": "ward",
    "provinceCode": "24"
  },
  {
    "code": "07612",
    "name": "Phường Phượng Sơn",
    "type": "ward",
    "provinceCode": "24"
  },
  {
    "code": "07492",
    "name": "Xã Lục Sơn",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "07489",
    "name": "Xã Trường Sơn",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "07519",
    "name": "Xã Cẩm Lý",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "07450",
    "name": "Xã Đông Phú",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "07486",
    "name": "Xã Nghĩa Phương",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "07444",
    "name": "Xã Lục Nam",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "07498",
    "name": "Xã Bắc Lũng",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "07462",
    "name": "Xã Bảo Đài",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "07375",
    "name": "Xã Lạng Giang",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "07420",
    "name": "Xã Mỹ Thái",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "07399",
    "name": "Xã Kép",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "07432",
    "name": "Xã Tân Dĩnh",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "07381",
    "name": "Xã Tiên Lục",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "07288",
    "name": "Xã Yên Thế",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "07294",
    "name": "Xã Bố Hạ",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "07282",
    "name": "Xã Đồng Kỳ",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "07246",
    "name": "Xã Xuân Lương",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "07264",
    "name": "Xã Tam Tiến",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "07339",
    "name": "Xã Tân Yên",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "07351",
    "name": "Xã Ngọc Thiện",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "07306",
    "name": "Xã Nhã Nam",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "07330",
    "name": "Xã Phúc Hòa",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "07333",
    "name": "Xã Quang Trung",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "07864",
    "name": "Xã Hợp Thịnh",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "07840",
    "name": "Xã Hiệp Hòa",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "07822",
    "name": "Xã Hoàng Vân",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "07870",
    "name": "Xã Xuân Cẩm",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "07774",
    "name": "Phường Tự Lạn",
    "type": "ward",
    "provinceCode": "24"
  },
  {
    "code": "07777",
    "name": "Phường Việt Yên",
    "type": "ward",
    "provinceCode": "24"
  },
  {
    "code": "07795",
    "name": "Phường Nếnh",
    "type": "ward",
    "provinceCode": "24"
  },
  {
    "code": "07798",
    "name": "Phường Vân Hà",
    "type": "ward",
    "provinceCode": "24"
  },
  {
    "code": "07735",
    "name": "Xã Đồng Việt",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "07210",
    "name": "Phường Bắc Giang",
    "type": "ward",
    "provinceCode": "24"
  },
  {
    "code": "07228",
    "name": "Phường Đa Mai",
    "type": "ward",
    "provinceCode": "24"
  },
  {
    "code": "07696",
    "name": "Phường Tiền Phong",
    "type": "ward",
    "provinceCode": "24"
  },
  {
    "code": "07682",
    "name": "Phường Tân An",
    "type": "ward",
    "provinceCode": "24"
  },
  {
    "code": "07681",
    "name": "Phường Yên Dũng",
    "type": "ward",
    "provinceCode": "24"
  },
  {
    "code": "07699",
    "name": "Phường Tân Tiến",
    "type": "ward",
    "provinceCode": "24"
  },
  {
    "code": "07738",
    "name": "Phường Cảnh Thụy",
    "type": "ward",
    "provinceCode": "24"
  },
  {
    "code": "09187",
    "name": "Phường Kinh Bắc",
    "type": "ward",
    "provinceCode": "24"
  },
  {
    "code": "09190",
    "name": "Phường Võ Cường",
    "type": "ward",
    "provinceCode": "24"
  },
  {
    "code": "09169",
    "name": "Phường Vũ Ninh",
    "type": "ward",
    "provinceCode": "24"
  },
  {
    "code": "09325",
    "name": "Phường Hạp Lĩnh",
    "type": "ward",
    "provinceCode": "24"
  },
  {
    "code": "09286",
    "name": "Phường Nam Sơn",
    "type": "ward",
    "provinceCode": "24"
  },
  {
    "code": "09367",
    "name": "Phường Từ Sơn",
    "type": "ward",
    "provinceCode": "24"
  },
  {
    "code": "09370",
    "name": "Phường Tam Sơn",
    "type": "ward",
    "provinceCode": "24"
  },
  {
    "code": "09385",
    "name": "Phường Đồng Nguyên",
    "type": "ward",
    "provinceCode": "24"
  },
  {
    "code": "09379",
    "name": "Phường Phù Khê",
    "type": "ward",
    "provinceCode": "24"
  },
  {
    "code": "09400",
    "name": "Phường Thuận Thành",
    "type": "ward",
    "provinceCode": "24"
  },
  {
    "code": "09409",
    "name": "Phường Mão Điền",
    "type": "ward",
    "provinceCode": "24"
  },
  {
    "code": "09430",
    "name": "Phường Trạm Lộ",
    "type": "ward",
    "provinceCode": "24"
  },
  {
    "code": "09427",
    "name": "Phường Trí Quả",
    "type": "ward",
    "provinceCode": "24"
  },
  {
    "code": "09433",
    "name": "Phường Song Liễu",
    "type": "ward",
    "provinceCode": "24"
  },
  {
    "code": "09445",
    "name": "Phường Ninh Xá",
    "type": "ward",
    "provinceCode": "24"
  },
  {
    "code": "09247",
    "name": "Phường Quế Võ",
    "type": "ward",
    "provinceCode": "24"
  },
  {
    "code": "09265",
    "name": "Phường Phương Liễu",
    "type": "ward",
    "provinceCode": "24"
  },
  {
    "code": "09253",
    "name": "Phường Nhân Hòa",
    "type": "ward",
    "provinceCode": "24"
  },
  {
    "code": "09301",
    "name": "Phường Đào Viên",
    "type": "ward",
    "provinceCode": "24"
  },
  {
    "code": "09295",
    "name": "Phường Bồng Lai",
    "type": "ward",
    "provinceCode": "24"
  },
  {
    "code": "09313",
    "name": "Xã Chi Lăng",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "09292",
    "name": "Xã Phù Lãng",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "09193",
    "name": "Xã Yên Phong",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "09238",
    "name": "Xã Văn Môn",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "09202",
    "name": "Xã Tam Giang",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "09205",
    "name": "Xã Yên Trung",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "09208",
    "name": "Xã Tam Đa",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "09319",
    "name": "Xã Tiên Du",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "09334",
    "name": "Xã Liên Bão",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "09343",
    "name": "Xã Tân Chi",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "09340",
    "name": "Xã Đại Đồng",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "09349",
    "name": "Xã Phật Tích",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "09454",
    "name": "Xã Gia Bình",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "09475",
    "name": "Xã Nhân Thắng",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "09469",
    "name": "Xã Đại Lai",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "09466",
    "name": "Xã Cao Đức",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "09487",
    "name": "Xã Đông Cứu",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "09496",
    "name": "Xã Lương Tài",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "09529",
    "name": "Xã Lâm Thao",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "09523",
    "name": "Xã Trung Chính",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "09499",
    "name": "Xã Trung Kênh",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "07663",
    "name": "Xã Tuấn Đạo",
    "type": "commune",
    "provinceCode": "24"
  },
  {
    "code": "07900",
    "name": "Phường Việt Trì",
    "type": "ward",
    "provinceCode": "25"
  },
  {
    "code": "07894",
    "name": "Phường Nông Trang",
    "type": "ward",
    "provinceCode": "25"
  },
  {
    "code": "07909",
    "name": "Phường Thanh Miếu",
    "type": "ward",
    "provinceCode": "25"
  },
  {
    "code": "07918",
    "name": "Phường Vân Phú",
    "type": "ward",
    "provinceCode": "25"
  },
  {
    "code": "08515",
    "name": "Xã Hy Cương",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08494",
    "name": "Xã Lâm Thao",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08500",
    "name": "Xã Xuân Lũng",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08521",
    "name": "Xã Phùng Nguyên",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08527",
    "name": "Xã Bản Nguyên",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "07954",
    "name": "Phường Phong Châu",
    "type": "ward",
    "provinceCode": "25"
  },
  {
    "code": "07942",
    "name": "Phường Phú Thọ",
    "type": "ward",
    "provinceCode": "25"
  },
  {
    "code": "07948",
    "name": "Phường Âu Cơ",
    "type": "ward",
    "provinceCode": "25"
  },
  {
    "code": "08230",
    "name": "Xã Phù Ninh",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08254",
    "name": "Xã Dân Chủ",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08236",
    "name": "Xã Phú Mỹ",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08245",
    "name": "Xã Trạm Thản",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08275",
    "name": "Xã Bình Phú",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08152",
    "name": "Xã Thanh Ba",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08173",
    "name": "Xã Quảng Yên",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08203",
    "name": "Xã Hoàng Cương",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08209",
    "name": "Xã Đông Thành",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08218",
    "name": "Xã Chí Tiên",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08227",
    "name": "Xã Liên Minh",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "07969",
    "name": "Xã Đoan Hùng",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08023",
    "name": "Xã Tây Cốc",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08038",
    "name": "Xã Chân Mộng",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "07999",
    "name": "Xã Chí Đám",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "07996",
    "name": "Xã Bằng Luân",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08053",
    "name": "Xã Hạ Hòa",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08071",
    "name": "Xã Đan Thượng",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08113",
    "name": "Xã Yên Kỳ",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08143",
    "name": "Xã Vĩnh Chân",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08134",
    "name": "Xã Văn Lang",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08110",
    "name": "Xã Hiền Lương",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08341",
    "name": "Xã Cẩm Khê",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08398",
    "name": "Xã Phú Khê",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08416",
    "name": "Xã Hùng Việt",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08431",
    "name": "Xã Đồng Lương",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08344",
    "name": "Xã Tiên Lương",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08377",
    "name": "Xã Vân Bán",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08434",
    "name": "Xã Tam Nông",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08479",
    "name": "Xã Thọ Văn",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08467",
    "name": "Xã Vạn Xuân",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08443",
    "name": "Xã Hiền Quan",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08674",
    "name": "Xã Thanh Thủy",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08662",
    "name": "Xã Đào Xá",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08686",
    "name": "Xã Tu Vũ",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08542",
    "name": "Xã Thanh Sơn",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08584",
    "name": "Xã Võ Miếu",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08611",
    "name": "Xã Văn Miếu",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08614",
    "name": "Xã Cự Đồng",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08632",
    "name": "Xã Hương Cần",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08656",
    "name": "Xã Yên Sơn",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08635",
    "name": "Xã Khả Cửu",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08566",
    "name": "Xã Tân Sơn",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08593",
    "name": "Xã Minh Đài",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08560",
    "name": "Xã Lai Đồng",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08545",
    "name": "Xã Thu Cúc",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08590",
    "name": "Xã Xuân Đài",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08620",
    "name": "Xã Long Cốc",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08290",
    "name": "Xã Yên Lập",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08323",
    "name": "Xã Thượng Long",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08296",
    "name": "Xã Sơn Lương",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08305",
    "name": "Xã Xuân Viên",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08338",
    "name": "Xã Minh Hòa",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08311",
    "name": "Xã Trung Sơn",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08824",
    "name": "Xã Tam Sơn",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08848",
    "name": "Xã Sông Lô",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08782",
    "name": "Xã Hải Lựu",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08773",
    "name": "Xã Yên Lãng",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08761",
    "name": "Xã Lập Thạch",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08842",
    "name": "Xã Tiên Lữ",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08788",
    "name": "Xã Thái Hòa",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08812",
    "name": "Xã Liên Hòa",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08770",
    "name": "Xã Hợp Lý",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08866",
    "name": "Xã Sơn Đông",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08911",
    "name": "Xã Tam Đảo",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08923",
    "name": "Xã Đại Đình",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08914",
    "name": "Xã Đạo Trù",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08869",
    "name": "Xã Tam Dương",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08905",
    "name": "Xã Hội Thịnh",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08896",
    "name": "Xã Hoàng An",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08872",
    "name": "Xã Tam Dương Bắc",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "09076",
    "name": "Xã Vĩnh Tường",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "09112",
    "name": "Xã Thổ Tang",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "09100",
    "name": "Xã Vĩnh Hưng",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "09079",
    "name": "Xã Vĩnh An",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "09154",
    "name": "Xã Vĩnh Phú",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "09106",
    "name": "Xã Vĩnh Thành",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "09025",
    "name": "Xã Yên Lạc",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "09040",
    "name": "Xã Tề Lỗ",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "09064",
    "name": "Xã Liên Châu",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "09043",
    "name": "Xã Tam Hồng",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "09052",
    "name": "Xã Nguyệt Đức",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08935",
    "name": "Xã Bình Nguyên",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08971",
    "name": "Xã Xuân Lãng",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08950",
    "name": "Xã Bình Xuyên",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08944",
    "name": "Xã Bình Tuyền",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "08716",
    "name": "Phường Vĩnh Phúc",
    "type": "ward",
    "provinceCode": "25"
  },
  {
    "code": "08707",
    "name": "Phường Vĩnh Yên",
    "type": "ward",
    "provinceCode": "25"
  },
  {
    "code": "08740",
    "name": "Phường Phúc Yên",
    "type": "ward",
    "provinceCode": "25"
  },
  {
    "code": "08746",
    "name": "Phường Xuân Hòa",
    "type": "ward",
    "provinceCode": "25"
  },
  {
    "code": "05089",
    "name": "Xã Cao Phong",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "05116",
    "name": "Xã Mường Thàng",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "05092",
    "name": "Xã Thung Nai",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "04831",
    "name": "Xã Đà Bắc",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "04876",
    "name": "Xã Cao Sơn",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "04846",
    "name": "Xã Đức Nhàn",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "04873",
    "name": "Xã Quy Đức",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "04849",
    "name": "Xã Tân Pheo",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "04891",
    "name": "Xã Tiền Phong",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "04978",
    "name": "Xã Kim Bôi",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "05014",
    "name": "Xã Mường Động",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "05086",
    "name": "Xã Dũng Tiến",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "05068",
    "name": "Xã Hợp Kim",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "04990",
    "name": "Xã Nật Sơn",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "05266",
    "name": "Xã Lạc Sơn",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "05287",
    "name": "Xã Mường Vang",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "05347",
    "name": "Xã Đại Đồng",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "05329",
    "name": "Xã Ngọc Sơn",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "05290",
    "name": "Xã Nhân Nghĩa",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "05323",
    "name": "Xã Quyết Thắng",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "05293",
    "name": "Xã Thượng Cốc",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "05305",
    "name": "Xã Yên Phú",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "05392",
    "name": "Xã Lạc Thủy",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "05425",
    "name": "Xã An Bình",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "05395",
    "name": "Xã An Nghĩa",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "04924",
    "name": "Xã Lương Sơn",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "05047",
    "name": "Xã Cao Dương",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "04960",
    "name": "Xã Liên Sơn",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "05200",
    "name": "Xã Mai Châu",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "05245",
    "name": "Xã Bao La",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "05251",
    "name": "Xã Mai Hạ",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "05212",
    "name": "Xã Pà Cò",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "05206",
    "name": "Xã Tân Mai",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "05128",
    "name": "Xã Tân Lạc",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "05158",
    "name": "Xã Mường Bi",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "05134",
    "name": "Xã Mường Hoa",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "05191",
    "name": "Xã Toàn Thắng",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "05152",
    "name": "Xã Vân Sơn",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "05353",
    "name": "Xã Yên Thủy",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "05362",
    "name": "Xã Lạc Lương",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "05386",
    "name": "Xã Yên Trị",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "04897",
    "name": "Xã Thịnh Minh",
    "type": "commune",
    "provinceCode": "25"
  },
  {
    "code": "04795",
    "name": "Phường Hòa Bình",
    "type": "ward",
    "provinceCode": "25"
  },
  {
    "code": "04894",
    "name": "Phường Kỳ Sơn",
    "type": "ward",
    "provinceCode": "25"
  },
  {
    "code": "04792",
    "name": "Phường Tân Hòa",
    "type": "ward",
    "provinceCode": "25"
  },
  {
    "code": "04828",
    "name": "Phường Thống Nhất",
    "type": "ward",
    "provinceCode": "25"
  },
  {
    "code": "11560",
    "name": "Phường Thủy Nguyên",
    "type": "ward",
    "provinceCode": "31"
  },
  {
    "code": "11557",
    "name": "Phường Thiên Hương",
    "type": "ward",
    "provinceCode": "31"
  },
  {
    "code": "11533",
    "name": "Phường Hòa Bình",
    "type": "ward",
    "provinceCode": "31"
  },
  {
    "code": "11542",
    "name": "Phường Nam Triệu",
    "type": "ward",
    "provinceCode": "31"
  },
  {
    "code": "11473",
    "name": "Phường Bạch Đằng",
    "type": "ward",
    "provinceCode": "31"
  },
  {
    "code": "11488",
    "name": "Phường Lưu Kiếm",
    "type": "ward",
    "provinceCode": "31"
  },
  {
    "code": "11506",
    "name": "Phường Lê Ích Mộc",
    "type": "ward",
    "provinceCode": "31"
  },
  {
    "code": "11311",
    "name": "Phường Hồng Bàng",
    "type": "ward",
    "provinceCode": "31"
  },
  {
    "code": "11602",
    "name": "Phường Hồng An",
    "type": "ward",
    "provinceCode": "31"
  },
  {
    "code": "11329",
    "name": "Phường Ngô Quyền",
    "type": "ward",
    "provinceCode": "31"
  },
  {
    "code": "11359",
    "name": "Phường Gia Viên",
    "type": "ward",
    "provinceCode": "31"
  },
  {
    "code": "11383",
    "name": "Phường Lê Chân",
    "type": "ward",
    "provinceCode": "31"
  },
  {
    "code": "11407",
    "name": "Phường An Biên",
    "type": "ward",
    "provinceCode": "31"
  },
  {
    "code": "11413",
    "name": "Phường Hải An",
    "type": "ward",
    "provinceCode": "31"
  },
  {
    "code": "11411",
    "name": "Phường Đông Hải",
    "type": "ward",
    "provinceCode": "31"
  },
  {
    "code": "11443",
    "name": "Phường Kiến An",
    "type": "ward",
    "provinceCode": "31"
  },
  {
    "code": "11446",
    "name": "Phường Phù Liễn",
    "type": "ward",
    "provinceCode": "31"
  },
  {
    "code": "11737",
    "name": "Phường Nam Đồ Sơn",
    "type": "ward",
    "provinceCode": "31"
  },
  {
    "code": "11455",
    "name": "Phường Đồ Sơn",
    "type": "ward",
    "provinceCode": "31"
  },
  {
    "code": "11689",
    "name": "Phường Hưng Đạo",
    "type": "ward",
    "provinceCode": "31"
  },
  {
    "code": "11692",
    "name": "Phường Dương Kinh",
    "type": "ward",
    "provinceCode": "31"
  },
  {
    "code": "11581",
    "name": "Phường An Dương",
    "type": "ward",
    "provinceCode": "31"
  },
  {
    "code": "11617",
    "name": "Phường An Hải",
    "type": "ward",
    "provinceCode": "31"
  },
  {
    "code": "11593",
    "name": "Phường An Phong",
    "type": "ward",
    "provinceCode": "31"
  },
  {
    "code": "11674",
    "name": "Xã An Hưng",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "11668",
    "name": "Xã An Khánh",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "11647",
    "name": "Xã An Quang",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "11635",
    "name": "Xã An Trường",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "11629",
    "name": "Xã An Lão",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "11680",
    "name": "Xã Kiến Thụy",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "11725",
    "name": "Xã Kiến Minh",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "11749",
    "name": "Xã Kiến Hải",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "11728",
    "name": "Xã Kiến Hưng",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "11713",
    "name": "Xã Nghi Dương",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "11761",
    "name": "Xã Quyết Thắng",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "11755",
    "name": "Xã Tiên Lãng",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "11779",
    "name": "Xã Tân Minh",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "11791",
    "name": "Xã Tiên Minh",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "11806",
    "name": "Xã Chấn Hưng",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "11809",
    "name": "Xã Hùng Thắng",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "11824",
    "name": "Xã Vĩnh Bảo",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "11911",
    "name": "Xã Nguyễn Bỉnh Khiêm",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "11887",
    "name": "Xã Vĩnh Am",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "11875",
    "name": "Xã Vĩnh Hải",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "11848",
    "name": "Xã Vĩnh Hòa",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "11836",
    "name": "Xã Vĩnh Thịnh",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "11842",
    "name": "Xã Vĩnh Thuận",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "11503",
    "name": "Xã Việt Khê",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "11914",
    "name": "Đặc khu Cát Hải",
    "type": "special_zone",
    "provinceCode": "31"
  },
  {
    "code": "11948",
    "name": "Đặc khu Bạch Long Vĩ",
    "type": "special_zone",
    "provinceCode": "31"
  },
  {
    "code": "10525",
    "name": "Phường Hải Dương",
    "type": "ward",
    "provinceCode": "31"
  },
  {
    "code": "10532",
    "name": "Phường Lê Thanh Nghị",
    "type": "ward",
    "provinceCode": "31"
  },
  {
    "code": "10543",
    "name": "Phường Việt Hòa",
    "type": "ward",
    "provinceCode": "31"
  },
  {
    "code": "10507",
    "name": "Phường Thành Đông",
    "type": "ward",
    "provinceCode": "31"
  },
  {
    "code": "10837",
    "name": "Phường Nam Đồng",
    "type": "ward",
    "provinceCode": "31"
  },
  {
    "code": "10537",
    "name": "Phường Tân Hưng",
    "type": "ward",
    "provinceCode": "31"
  },
  {
    "code": "11002",
    "name": "Phường Thạch Khôi",
    "type": "ward",
    "provinceCode": "31"
  },
  {
    "code": "10891",
    "name": "Phường Tứ Minh",
    "type": "ward",
    "provinceCode": "31"
  },
  {
    "code": "10660",
    "name": "Phường Ái Quốc",
    "type": "ward",
    "provinceCode": "31"
  },
  {
    "code": "10549",
    "name": "Phường Chu Văn An",
    "type": "ward",
    "provinceCode": "31"
  },
  {
    "code": "10546",
    "name": "Phường Chí Linh",
    "type": "ward",
    "provinceCode": "31"
  },
  {
    "code": "10570",
    "name": "Phường Trần Hưng Đạo",
    "type": "ward",
    "provinceCode": "31"
  },
  {
    "code": "10552",
    "name": "Phường Nguyễn Trãi",
    "type": "ward",
    "provinceCode": "31"
  },
  {
    "code": "10573",
    "name": "Phường Trần Nhân Tông",
    "type": "ward",
    "provinceCode": "31"
  },
  {
    "code": "10603",
    "name": "Phường Lê Đại Hành",
    "type": "ward",
    "provinceCode": "31"
  },
  {
    "code": "10675",
    "name": "Phường Kinh Môn",
    "type": "ward",
    "provinceCode": "31"
  },
  {
    "code": "10744",
    "name": "Phường Nguyễn Đại Năng",
    "type": "ward",
    "provinceCode": "31"
  },
  {
    "code": "10729",
    "name": "Phường Trần Liễu",
    "type": "ward",
    "provinceCode": "31"
  },
  {
    "code": "10678",
    "name": "Phường Bắc An Phụ",
    "type": "ward",
    "provinceCode": "31"
  },
  {
    "code": "10726",
    "name": "Phường Phạm Sư Mạnh",
    "type": "ward",
    "provinceCode": "31"
  },
  {
    "code": "10714",
    "name": "Phường Nhị Chiểu",
    "type": "ward",
    "provinceCode": "31"
  },
  {
    "code": "10705",
    "name": "Xã Nam An Phụ",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "10606",
    "name": "Xã Nam Sách",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "10642",
    "name": "Xã Thái Tân",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "10615",
    "name": "Xã Hợp Tiến",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "10633",
    "name": "Xã Trần Phú",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "10645",
    "name": "Xã An Phú",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "10813",
    "name": "Xã Thanh Hà",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "10846",
    "name": "Xã Hà Tây",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "10816",
    "name": "Xã Hà Bắc",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "10843",
    "name": "Xã Hà Nam",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "10882",
    "name": "Xã Hà Đông",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "10888",
    "name": "Xã Cẩm Giang",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "10909",
    "name": "Xã Tuệ Tĩnh",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "10930",
    "name": "Xã Mao Điền",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "10903",
    "name": "Xã Cẩm Giàng",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "10945",
    "name": "Xã Kẻ Sặt",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "10966",
    "name": "Xã Bình Giang",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "10972",
    "name": "Xã Đường An",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "10993",
    "name": "Xã Thượng Hồng",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "10999",
    "name": "Xã Gia Lộc",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "11020",
    "name": "Xã Yết Kiêu",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "11050",
    "name": "Xã Gia Phúc",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "11065",
    "name": "Xã Trường Tân",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "11074",
    "name": "Xã Tứ Kỳ",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "11113",
    "name": "Xã Tân Kỳ",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "11086",
    "name": "Xã Đại Sơn",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "11131",
    "name": "Xã Chí Minh",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "11140",
    "name": "Xã Lạc Phượng",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "11146",
    "name": "Xã Nguyên Giáp",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "11203",
    "name": "Xã Ninh Giang",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "11164",
    "name": "Xã Vĩnh Lại",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "11224",
    "name": "Xã Khúc Thừa Dụ",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "11167",
    "name": "Xã Tân An",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "11218",
    "name": "Xã Hồng Châu",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "11239",
    "name": "Xã Thanh Miện",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "11254",
    "name": "Xã Bắc Thanh Miện",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "11257",
    "name": "Xã Hải Hưng",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "11242",
    "name": "Xã Nguyễn Lương Bằng",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "11284",
    "name": "Xã Nam Thanh Miện",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "10750",
    "name": "Xã Phú Thái",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "10756",
    "name": "Xã Lai Khê",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "10792",
    "name": "Xã An Thành",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "10804",
    "name": "Xã Kim Thành",
    "type": "commune",
    "provinceCode": "31"
  },
  {
    "code": "11953",
    "name": "Phường Phố Hiến",
    "type": "ward",
    "provinceCode": "33"
  },
  {
    "code": "11983",
    "name": "Phường Sơn Nam",
    "type": "ward",
    "provinceCode": "33"
  },
  {
    "code": "11980",
    "name": "Phường Hồng Châu",
    "type": "ward",
    "provinceCode": "33"
  },
  {
    "code": "12103",
    "name": "Phường Mỹ Hào",
    "type": "ward",
    "provinceCode": "33"
  },
  {
    "code": "12133",
    "name": "Phường Đường Hào",
    "type": "ward",
    "provinceCode": "33"
  },
  {
    "code": "12127",
    "name": "Phường Thượng Hồng",
    "type": "ward",
    "provinceCode": "33"
  },
  {
    "code": "11977",
    "name": "Xã Tân Hưng",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12337",
    "name": "Xã Hoàng Hoa Thám",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12364",
    "name": "Xã Tiên Lữ",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12361",
    "name": "Xã Tiên Hoa",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12391",
    "name": "Xã Quang Hưng",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12406",
    "name": "Xã Đoàn Đào",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12424",
    "name": "Xã Tiên Tiến",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12427",
    "name": "Xã Tống Trân",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12280",
    "name": "Xã Lương Bằng",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12286",
    "name": "Xã Nghĩa Dân",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12322",
    "name": "Xã Hiệp Cường",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12313",
    "name": "Xã Đức Hợp",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12142",
    "name": "Xã Ân Thi",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12166",
    "name": "Xã Xuân Trúc",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12148",
    "name": "Xã Phạm Ngũ Lão",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12184",
    "name": "Xã Nguyễn Trãi",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12196",
    "name": "Xã Hồng Quang",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12205",
    "name": "Xã Khoái Châu",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12223",
    "name": "Xã Triệu Việt Vương",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12238",
    "name": "Xã Việt Tiến",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12271",
    "name": "Xã Chí Minh",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12247",
    "name": "Xã Châu Ninh",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12073",
    "name": "Xã Yên Mỹ",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12091",
    "name": "Xã Việt Yên",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12070",
    "name": "Xã Hoàn Long",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12064",
    "name": "Xã Nguyễn Văn Linh",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12004",
    "name": "Xã Như Quỳnh",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "11992",
    "name": "Xã Lạc Đạo",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "11995",
    "name": "Xã Đại Đồng",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12031",
    "name": "Xã Nghĩa Trụ",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12025",
    "name": "Xã Phụng Công",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12019",
    "name": "Xã Văn Giang",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12049",
    "name": "Xã Mễ Sở",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "13225",
    "name": "Phường Thái Bình",
    "type": "ward",
    "provinceCode": "33"
  },
  {
    "code": "12454",
    "name": "Phường Trần Lãm",
    "type": "ward",
    "provinceCode": "33"
  },
  {
    "code": "12452",
    "name": "Phường Trần Hưng Đạo",
    "type": "ward",
    "provinceCode": "33"
  },
  {
    "code": "12817",
    "name": "Phường Trà Lý",
    "type": "ward",
    "provinceCode": "33"
  },
  {
    "code": "12466",
    "name": "Phường Vũ Phúc",
    "type": "ward",
    "provinceCode": "33"
  },
  {
    "code": "12826",
    "name": "Xã Thái Thụy",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12862",
    "name": "Xã Đông Thụy Anh",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12859",
    "name": "Xã Bắc Thụy Anh",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12865",
    "name": "Xã Thụy Anh",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12904",
    "name": "Xã Nam Thụy Anh",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12916",
    "name": "Xã Bắc Thái Ninh",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12922",
    "name": "Xã Thái Ninh",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12943",
    "name": "Xã Đông Thái Ninh",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12961",
    "name": "Xã Nam Thái Ninh",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12919",
    "name": "Xã Tây Thái Ninh",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12850",
    "name": "Xã Tây Thụy Anh",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12970",
    "name": "Xã Tiền Hải",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "13039",
    "name": "Xã Tây Tiền Hải",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "13021",
    "name": "Xã Ái Quốc",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "13003",
    "name": "Xã Đồng Châu",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12988",
    "name": "Xã Đông Tiền Hải",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "13057",
    "name": "Xã Nam Cường",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "13066",
    "name": "Xã Hưng Phú",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "13063",
    "name": "Xã Nam Tiền Hải",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12472",
    "name": "Xã Quỳnh Phụ",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12511",
    "name": "Xã Minh Thọ",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12532",
    "name": "Xã Nguyễn Du",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12577",
    "name": "Xã Quỳnh An",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12517",
    "name": "Xã Ngọc Lâm",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12526",
    "name": "Xã Đồng Bằng",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12499",
    "name": "Xã A Sào",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12523",
    "name": "Xã Phụ Dực",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12583",
    "name": "Xã Tân Tiến",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12586",
    "name": "Xã Hưng Hà",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12634",
    "name": "Xã Tiên La",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12676",
    "name": "Xã Lê Quý Đôn",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12685",
    "name": "Xã Hồng Minh",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12631",
    "name": "Xã Thần Khê",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12619",
    "name": "Xã Diên Hà",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12595",
    "name": "Xã Ngự Thiên",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12613",
    "name": "Xã Long Hưng",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12688",
    "name": "Xã Đông Hưng",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12700",
    "name": "Xã Bắc Tiên Hưng",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12736",
    "name": "Xã Đông Tiên Hưng",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12775",
    "name": "Xã Nam Đông Hưng",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12745",
    "name": "Xã Bắc Đông Quan",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12694",
    "name": "Xã Bắc Đông Hưng",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12793",
    "name": "Xã Đông Quan",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12763",
    "name": "Xã Nam Tiên Hưng",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "12754",
    "name": "Xã Tiên Hưng",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "13120",
    "name": "Xã Lê Lợi",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "13075",
    "name": "Xã Kiến Xương",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "13132",
    "name": "Xã Quang Lịch",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "13141",
    "name": "Xã Vũ Quý",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "13183",
    "name": "Xã Bình Thanh",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "13186",
    "name": "Xã Bình Định",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "13159",
    "name": "Xã Hồng Vũ",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "13096",
    "name": "Xã Bình Nguyên",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "13093",
    "name": "Xã Trà Giang",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "13192",
    "name": "Xã Vũ Thư",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "13222",
    "name": "Xã Thư Trì",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "13246",
    "name": "Xã Tân Thuận",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "13264",
    "name": "Xã Thư Vũ",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "13279",
    "name": "Xã Vũ Tiên",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "13219",
    "name": "Xã Vạn Xuân",
    "type": "commune",
    "provinceCode": "33"
  },
  {
    "code": "14464",
    "name": "Xã Gia Viễn",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "14500",
    "name": "Xã Đại Hoàng",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "14482",
    "name": "Xã Gia Hưng",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "14524",
    "name": "Xã Gia Phong",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "14488",
    "name": "Xã Gia Vân",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "14494",
    "name": "Xã Gia Trấn",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "14428",
    "name": "Xã Nho Quan",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "14389",
    "name": "Xã Gia Lâm",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "14401",
    "name": "Xã Gia Tường",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "14407",
    "name": "Xã Phú Sơn",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "14404",
    "name": "Xã Cúc Phương",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "14458",
    "name": "Xã Phú Long",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "14434",
    "name": "Xã Thanh Sơn",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "14452",
    "name": "Xã Quỳnh Lưu",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "14560",
    "name": "Xã Yên Khánh",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "14611",
    "name": "Xã Khánh Nhạc",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "14563",
    "name": "Xã Khánh Thiện",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "14614",
    "name": "Xã Khánh Hội",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "14608",
    "name": "Xã Khánh Trung",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "14701",
    "name": "Xã Yên Mô",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "14728",
    "name": "Xã Yên Từ",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "14743",
    "name": "Xã Yên Mạc",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "14746",
    "name": "Xã Đồng Thái",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "14653",
    "name": "Xã Chất Bình",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "14638",
    "name": "Xã Kim Sơn",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "14647",
    "name": "Xã Quang Thiện",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "14620",
    "name": "Xã Phát Diệm",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "14674",
    "name": "Xã Lai Thành",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "14677",
    "name": "Xã Định Hóa",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "14623",
    "name": "Xã Bình Minh",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "14698",
    "name": "Xã Kim Đông",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "13504",
    "name": "Xã Bình Lục",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "13501",
    "name": "Xã Bình Mỹ",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "13540",
    "name": "Xã Bình An",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "13531",
    "name": "Xã Bình Giang",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "13558",
    "name": "Xã Bình Sơn",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "13456",
    "name": "Xã Liêm Hà",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "13474",
    "name": "Xã Tân Thanh",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "13483",
    "name": "Xã Thanh Bình",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "13489",
    "name": "Xã Thanh Lâm",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "13495",
    "name": "Xã Thanh Liêm",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "13573",
    "name": "Xã Lý Nhân",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "13591",
    "name": "Xã Nam Xang",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "13579",
    "name": "Xã Bắc Lý",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "13597",
    "name": "Xã Vĩnh Trụ",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "13594",
    "name": "Xã Trần Thương",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "13609",
    "name": "Xã Nhân Hà",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "13627",
    "name": "Xã Nam Lý",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "13966",
    "name": "Xã Nam Trực",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "14011",
    "name": "Xã Nam Minh",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "14014",
    "name": "Xã Nam Đồng",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "14005",
    "name": "Xã Nam Ninh",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "13987",
    "name": "Xã Nam Hồng",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "13750",
    "name": "Xã Minh Tân",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "13753",
    "name": "Xã Hiển Khánh",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "13741",
    "name": "Xã Vụ Bản",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "13786",
    "name": "Xã Liên Minh",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "13795",
    "name": "Xã Ý Yên",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "13879",
    "name": "Xã Yên Đồng",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "13870",
    "name": "Xã Yên Cường",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "13864",
    "name": "Xã Vạn Thắng",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "13834",
    "name": "Xã Vũ Dương",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "13807",
    "name": "Xã Tân Minh",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "13822",
    "name": "Xã Phong Doanh",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "14026",
    "name": "Xã Cổ Lễ",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "14038",
    "name": "Xã Ninh Giang",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "14056",
    "name": "Xã Cát Thành",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "14053",
    "name": "Xã Trực Ninh",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "14062",
    "name": "Xã Quang Hưng",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "14071",
    "name": "Xã Minh Thái",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "14077",
    "name": "Xã Ninh Cường",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "14089",
    "name": "Xã Xuân Trường",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "14122",
    "name": "Xã Xuân Hưng",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "14104",
    "name": "Xã Xuân Giang",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "14095",
    "name": "Xã Xuân Hồng",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "14215",
    "name": "Xã Hải Hậu",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "14236",
    "name": "Xã Hải Anh",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "14218",
    "name": "Xã Hải Tiến",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "14248",
    "name": "Xã Hải Hưng",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "14281",
    "name": "Xã Hải An",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "14287",
    "name": "Xã Hải Quang",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "14308",
    "name": "Xã Hải Xuân",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "14221",
    "name": "Xã Hải Thịnh",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "14161",
    "name": "Xã Giao Minh",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "14182",
    "name": "Xã Giao Hòa",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "14167",
    "name": "Xã Giao Thủy",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "14203",
    "name": "Xã Giao Phúc",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "14179",
    "name": "Xã Giao Hưng",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "14194",
    "name": "Xã Giao Bình",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "14212",
    "name": "Xã Giao Ninh",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "13900",
    "name": "Xã Đồng Thịnh",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "13891",
    "name": "Xã Nghĩa Hưng",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "13918",
    "name": "Xã Nghĩa Sơn",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "13927",
    "name": "Xã Hồng Phong",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "13939",
    "name": "Xã Quỹ Nhất",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "13957",
    "name": "Xã Nghĩa Lâm",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "13894",
    "name": "Xã Rạng Đông",
    "type": "commune",
    "provinceCode": "37"
  },
  {
    "code": "14533",
    "name": "Phường Tây Hoa Lư",
    "type": "ward",
    "provinceCode": "37"
  },
  {
    "code": "14329",
    "name": "Phường Hoa Lư",
    "type": "ward",
    "provinceCode": "37"
  },
  {
    "code": "14359",
    "name": "Phường Nam Hoa Lư",
    "type": "ward",
    "provinceCode": "37"
  },
  {
    "code": "14566",
    "name": "Phường Đông Hoa Lư",
    "type": "ward",
    "provinceCode": "37"
  },
  {
    "code": "14362",
    "name": "Phường Tam Điệp",
    "type": "ward",
    "provinceCode": "37"
  },
  {
    "code": "14371",
    "name": "Phường Yên Sơn",
    "type": "ward",
    "provinceCode": "37"
  },
  {
    "code": "14365",
    "name": "Phường Trung Sơn",
    "type": "ward",
    "provinceCode": "37"
  },
  {
    "code": "14725",
    "name": "Phường Yên Thắng",
    "type": "ward",
    "provinceCode": "37"
  },
  {
    "code": "13366",
    "name": "Phường Hà Nam",
    "type": "ward",
    "provinceCode": "37"
  },
  {
    "code": "13285",
    "name": "Phường Phủ Lý",
    "type": "ward",
    "provinceCode": "37"
  },
  {
    "code": "13291",
    "name": "Phường Phù Vân",
    "type": "ward",
    "provinceCode": "37"
  },
  {
    "code": "13318",
    "name": "Phường Châu Sơn",
    "type": "ward",
    "provinceCode": "37"
  },
  {
    "code": "13444",
    "name": "Phường Liêm Tuyền",
    "type": "ward",
    "provinceCode": "37"
  },
  {
    "code": "13324",
    "name": "Phường Duy Tiên",
    "type": "ward",
    "provinceCode": "37"
  },
  {
    "code": "13330",
    "name": "Phường Duy Tân",
    "type": "ward",
    "provinceCode": "37"
  },
  {
    "code": "13348",
    "name": "Phường Đồng Văn",
    "type": "ward",
    "provinceCode": "37"
  },
  {
    "code": "13336",
    "name": "Phường Duy Hà",
    "type": "ward",
    "provinceCode": "37"
  },
  {
    "code": "13363",
    "name": "Phường Tiên Sơn",
    "type": "ward",
    "provinceCode": "37"
  },
  {
    "code": "13393",
    "name": "Phường Lê Hồ",
    "type": "ward",
    "provinceCode": "37"
  },
  {
    "code": "13396",
    "name": "Phường Nguyễn Úy",
    "type": "ward",
    "provinceCode": "37"
  },
  {
    "code": "13435",
    "name": "Phường Lý Thường Kiệt",
    "type": "ward",
    "provinceCode": "37"
  },
  {
    "code": "13402",
    "name": "Phường Kim Thanh",
    "type": "ward",
    "provinceCode": "37"
  },
  {
    "code": "13420",
    "name": "Phường Tam Chúc",
    "type": "ward",
    "provinceCode": "37"
  },
  {
    "code": "13384",
    "name": "Phường Kim Bảng",
    "type": "ward",
    "provinceCode": "37"
  },
  {
    "code": "13669",
    "name": "Phường Nam Định",
    "type": "ward",
    "provinceCode": "37"
  },
  {
    "code": "13684",
    "name": "Phường Thiên Trường",
    "type": "ward",
    "provinceCode": "37"
  },
  {
    "code": "13693",
    "name": "Phường Đông A",
    "type": "ward",
    "provinceCode": "37"
  },
  {
    "code": "13972",
    "name": "Phường Vị Khê",
    "type": "ward",
    "provinceCode": "37"
  },
  {
    "code": "13699",
    "name": "Phường Thành Nam",
    "type": "ward",
    "provinceCode": "37"
  },
  {
    "code": "13777",
    "name": "Phường Trường Thi",
    "type": "ward",
    "provinceCode": "37"
  },
  {
    "code": "13984",
    "name": "Phường Hồng Quang",
    "type": "ward",
    "provinceCode": "37"
  },
  {
    "code": "13708",
    "name": "Phường Mỹ Lộc",
    "type": "ward",
    "provinceCode": "37"
  },
  {
    "code": "14797",
    "name": "Phường Hạc Thành",
    "type": "ward",
    "provinceCode": "38"
  },
  {
    "code": "16522",
    "name": "Phường Quảng Phú",
    "type": "ward",
    "provinceCode": "38"
  },
  {
    "code": "16417",
    "name": "Phường Đông Quang",
    "type": "ward",
    "provinceCode": "38"
  },
  {
    "code": "16378",
    "name": "Phường Đông Sơn",
    "type": "ward",
    "provinceCode": "38"
  },
  {
    "code": "15853",
    "name": "Phường Đông Tiến",
    "type": "ward",
    "provinceCode": "38"
  },
  {
    "code": "14758",
    "name": "Phường Hàm Rồng",
    "type": "ward",
    "provinceCode": "38"
  },
  {
    "code": "15925",
    "name": "Phường Nguyệt Viên",
    "type": "ward",
    "provinceCode": "38"
  },
  {
    "code": "16531",
    "name": "Phường Sầm Sơn",
    "type": "ward",
    "provinceCode": "38"
  },
  {
    "code": "16516",
    "name": "Phường Nam Sầm Sơn",
    "type": "ward",
    "provinceCode": "38"
  },
  {
    "code": "14812",
    "name": "Phường Bỉm Sơn",
    "type": "ward",
    "provinceCode": "38"
  },
  {
    "code": "14818",
    "name": "Phường Quang Trung",
    "type": "ward",
    "provinceCode": "38"
  },
  {
    "code": "16576",
    "name": "Phường Ngọc Sơn",
    "type": "ward",
    "provinceCode": "38"
  },
  {
    "code": "16594",
    "name": "Phường Tân Dân",
    "type": "ward",
    "provinceCode": "38"
  },
  {
    "code": "16597",
    "name": "Phường Hải Lĩnh",
    "type": "ward",
    "provinceCode": "38"
  },
  {
    "code": "16561",
    "name": "Phường Tĩnh Gia",
    "type": "ward",
    "provinceCode": "38"
  },
  {
    "code": "16609",
    "name": "Phường Đào Duy Từ",
    "type": "ward",
    "provinceCode": "38"
  },
  {
    "code": "16645",
    "name": "Phường Hải Bình",
    "type": "ward",
    "provinceCode": "38"
  },
  {
    "code": "16624",
    "name": "Phường Trúc Lâm",
    "type": "ward",
    "provinceCode": "38"
  },
  {
    "code": "16654",
    "name": "Phường Nghi Sơn",
    "type": "ward",
    "provinceCode": "38"
  },
  {
    "code": "16591",
    "name": "Xã Các Sơn",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "16636",
    "name": "Xã Trường Lâm",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15271",
    "name": "Xã Hà Trung",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15316",
    "name": "Xã Tống Sơn",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15274",
    "name": "Xã Hà Long",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15286",
    "name": "Xã Hoạt Giang",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15298",
    "name": "Xã Lĩnh Toại",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "16021",
    "name": "Xã Triệu Lộc",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "16033",
    "name": "Xã Đông Thành",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "16012",
    "name": "Xã Hậu Lộc",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "16072",
    "name": "Xã Hoa Lộc",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "16078",
    "name": "Xã Vạn Lộc",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "16093",
    "name": "Xã Nga Sơn",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "16114",
    "name": "Xã Nga Thắng",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "16138",
    "name": "Xã Hồ Vương",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "16108",
    "name": "Xã Tân Tiến",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "16144",
    "name": "Xã Nga An",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "16171",
    "name": "Xã Ba Đình",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15865",
    "name": "Xã Hoằng Hóa",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15991",
    "name": "Xã Hoằng Tiến",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "16000",
    "name": "Xã Hoằng Thanh",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15961",
    "name": "Xã Hoằng Lộc",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15976",
    "name": "Xã Hoằng Châu",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15910",
    "name": "Xã Hoằng Sơn",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15889",
    "name": "Xã Hoằng Phú",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15880",
    "name": "Xã Hoằng Giang",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "16438",
    "name": "Xã Lưu Vệ",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "16480",
    "name": "Xã Quảng Yên",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "16498",
    "name": "Xã Quảng Ngọc",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "16540",
    "name": "Xã Quảng Ninh",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "16543",
    "name": "Xã Quảng Bình",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "16549",
    "name": "Xã Tiên Trang",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "16489",
    "name": "Xã Quảng Chính",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "16279",
    "name": "Xã Nông Cống",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "16309",
    "name": "Xã Thắng Lợi",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "16297",
    "name": "Xã Trung Chính",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "16348",
    "name": "Xã Trường Văn",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "16342",
    "name": "Xã Thăng Bình",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "16363",
    "name": "Xã Tượng Lĩnh",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "16369",
    "name": "Xã Công Chính",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15772",
    "name": "Xã Thiệu Hóa",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15796",
    "name": "Xã Thiệu Quang",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15778",
    "name": "Xã Thiệu Tiến",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15820",
    "name": "Xã Thiệu Toán",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15835",
    "name": "Xã Thiệu Trung",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15469",
    "name": "Xã Yên Định",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15421",
    "name": "Xã Yên Trường",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15409",
    "name": "Xã Yên Phú",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15412",
    "name": "Xã Quý Lộc",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15442",
    "name": "Xã Yên Ninh",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15457",
    "name": "Xã Định Tân",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15448",
    "name": "Xã Định Hòa",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15499",
    "name": "Xã Thọ Xuân",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15505",
    "name": "Xã Thọ Long",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15520",
    "name": "Xã Xuân Hòa",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15553",
    "name": "Xã Sao Vàng",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15544",
    "name": "Xã Lam Sơn",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15568",
    "name": "Xã Thọ Lập",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15574",
    "name": "Xã Xuân Tín",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15592",
    "name": "Xã Xuân Lập",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15349",
    "name": "Xã Vĩnh Lộc",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15361",
    "name": "Xã Tây Đô",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15382",
    "name": "Xã Biện Thượng",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15664",
    "name": "Xã Triệu Sơn",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15667",
    "name": "Xã Thọ Bình",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15754",
    "name": "Xã Thọ Ngọc",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15763",
    "name": "Xã Thọ Phú",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15682",
    "name": "Xã Hợp Tiến",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15766",
    "name": "Xã An Nông",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15715",
    "name": "Xã Tân Ninh",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15724",
    "name": "Xã Đồng Tiến",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "14866",
    "name": "Xã Mường Chanh",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "14860",
    "name": "Xã Quang Chiểu",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "14848",
    "name": "Xã Tam Chung",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "14845",
    "name": "Xã Mường Lát",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "14863",
    "name": "Xã Pù Nhi",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "14864",
    "name": "Xã Nhi Sơn",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "14854",
    "name": "Xã Mường Lý",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "14857",
    "name": "Xã Trung Lý",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "14869",
    "name": "Xã Hồi Xuân",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "14902",
    "name": "Xã Nam Xuân",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "14908",
    "name": "Xã Thiên Phủ",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "14896",
    "name": "Xã Hiền Kiệt",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "14890",
    "name": "Xã Phú Xuân",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "14878",
    "name": "Xã Phú Lệ",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "14872",
    "name": "Xã Trung Thành",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "14875",
    "name": "Xã Trung Sơn",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15013",
    "name": "Xã Na Mèo",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15010",
    "name": "Xã Sơn Thủy",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15022",
    "name": "Xã Sơn Điện",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15025",
    "name": "Xã Mường Mìn",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15007",
    "name": "Xã Tam Thanh",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15019",
    "name": "Xã Tam Lư",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15016",
    "name": "Xã Quan Sơn",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15001",
    "name": "Xã Trung Hạ",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15055",
    "name": "Xã Linh Sơn",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15058",
    "name": "Xã Đồng Lương",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15049",
    "name": "Xã Văn Phú",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15043",
    "name": "Xã Giao An",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15031",
    "name": "Xã Yên Khương",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15034",
    "name": "Xã Yên Thắng",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "14974",
    "name": "Xã Văn Nho",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "14980",
    "name": "Xã Thiết Ống",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "14923",
    "name": "Xã Bá Thước",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "14959",
    "name": "Xã Cổ Lũng",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "14956",
    "name": "Xã Pù Luông",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "14950",
    "name": "Xã Điền Lư",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "14932",
    "name": "Xã Điền Quang",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "14953",
    "name": "Xã Quý Lương",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15061",
    "name": "Xã Ngọc Lặc",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15085",
    "name": "Xã Thạch Lập",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15091",
    "name": "Xã Ngọc Liên",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15124",
    "name": "Xã Minh Sơn",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15106",
    "name": "Xã Nguyệt Ấn",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15112",
    "name": "Xã Kiên Thọ",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15142",
    "name": "Xã Cẩm Thạch",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15127",
    "name": "Xã Cẩm Thủy",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15148",
    "name": "Xã Cẩm Tú",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15163",
    "name": "Xã Cẩm Vân",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15178",
    "name": "Xã Cẩm Tân",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15187",
    "name": "Xã Kim Tân",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15190",
    "name": "Xã Vân Du",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15250",
    "name": "Xã Ngọc Trạo",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15211",
    "name": "Xã Thạch Bình",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15229",
    "name": "Xã Thành Vinh",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15199",
    "name": "Xã Thạch Quảng",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "16174",
    "name": "Xã Như Xuân",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "16225",
    "name": "Xã Thượng Ninh",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "16177",
    "name": "Xã Xuân Bình",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "16186",
    "name": "Xã Hóa Quỳ",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "16222",
    "name": "Xã Thanh Quân",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "16213",
    "name": "Xã Thanh Phong",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "16234",
    "name": "Xã Xuân Du",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "16249",
    "name": "Xã Mậu Lâm",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "16228",
    "name": "Xã Như Thanh",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "16264",
    "name": "Xã Yên Thọ",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "16258",
    "name": "Xã Xuân Thái",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "16273",
    "name": "Xã Thanh Kỳ",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15607",
    "name": "Xã Bát Mọt",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15610",
    "name": "Xã Yên Nhân",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15628",
    "name": "Xã Lương Sơn",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15646",
    "name": "Xã Thường Xuân",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15634",
    "name": "Xã Luận Thành",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15661",
    "name": "Xã Tân Thành",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15622",
    "name": "Xã Vạn Xuân",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15643",
    "name": "Xã Thắng Lộc",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "15658",
    "name": "Xã Xuân Chinh",
    "type": "commune",
    "provinceCode": "38"
  },
  {
    "code": "17329",
    "name": "Xã Anh Sơn",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17380",
    "name": "Xã Yên Xuân",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17344",
    "name": "Xã Nhân Hòa",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17365",
    "name": "Xã Anh Sơn Đông",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17357",
    "name": "Xã Vĩnh Tường",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17335",
    "name": "Xã Thành Bình Thọ",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17254",
    "name": "Xã Con Cuông",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17263",
    "name": "Xã Môn Sơn",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17239",
    "name": "Xã Mậu Thạch",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17242",
    "name": "Xã Cam Phục",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17248",
    "name": "Xã Châu Khê",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17230",
    "name": "Xã Bình Chuẩn",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17464",
    "name": "Xã Diễn Châu",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17416",
    "name": "Xã Đức Châu",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17443",
    "name": "Xã Quảng Châu",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17419",
    "name": "Xã Hải Châu",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17488",
    "name": "Xã Tân Châu",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17479",
    "name": "Xã An Châu",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17476",
    "name": "Xã Minh Châu",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17395",
    "name": "Xã Hùng Châu",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17662",
    "name": "Xã Đô Lương",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17623",
    "name": "Xã Bạch Ngọc",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17677",
    "name": "Xã Văn Hiến",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17707",
    "name": "Xã Bạch Hà",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17689",
    "name": "Xã Thuần Trung",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17641",
    "name": "Xã Lương Sơn",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17110",
    "name": "Phường Hoàng Mai",
    "type": "ward",
    "provinceCode": "40"
  },
  {
    "code": "17128",
    "name": "Phường Tân Mai",
    "type": "ward",
    "provinceCode": "40"
  },
  {
    "code": "17125",
    "name": "Phường Quỳnh Mai",
    "type": "ward",
    "provinceCode": "40"
  },
  {
    "code": "18001",
    "name": "Xã Hưng Nguyên",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "18007",
    "name": "Xã Yên Trung",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "18028",
    "name": "Xã Hưng Nguyên Nam",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "18040",
    "name": "Xã Lam Thành",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "16813",
    "name": "Xã Mường Xén",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "16849",
    "name": "Xã Hữu Kiệm",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "16837",
    "name": "Xã Nậm Cắn",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "16855",
    "name": "Xã Chiêu Lưu",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "16834",
    "name": "Xã Na Loi",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "16858",
    "name": "Xã Mường Típ",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "16870",
    "name": "Xã Na Ngoi",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "16816",
    "name": "Xã Mỹ Lý",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "16819",
    "name": "Xã Bắc Lý",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "16822",
    "name": "Xã Keng Đu",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "16828",
    "name": "Xã Huồi Tụ",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "16831",
    "name": "Xã Mường Lống",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17950",
    "name": "Xã Vạn An",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17935",
    "name": "Xã Nam Đàn",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17944",
    "name": "Xã Đại Huệ",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17989",
    "name": "Xã Thiên Nhẫn",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17971",
    "name": "Xã Kim Liên",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "16941",
    "name": "Xã Nghĩa Đàn",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "16969",
    "name": "Xã Nghĩa Thọ",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "16951",
    "name": "Xã Nghĩa Lâm",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "16975",
    "name": "Xã Nghĩa Mai",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "16972",
    "name": "Xã Nghĩa Hưng",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17032",
    "name": "Xã Nghĩa Khánh",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17029",
    "name": "Xã Nghĩa Lộc",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17827",
    "name": "Xã Nghi Lộc",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17857",
    "name": "Xã Phúc Lộc",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17878",
    "name": "Xã Đông Lộc",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17866",
    "name": "Xã Trung Lộc",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17842",
    "name": "Xã Thần Lĩnh",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17833",
    "name": "Xã Hải Lộc",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17854",
    "name": "Xã Văn Kiều",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "16738",
    "name": "Xã Quế Phong",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "16750",
    "name": "Xã Tiền Phong",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "16756",
    "name": "Xã Tri Lễ",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "16774",
    "name": "Xã Mường Quàng",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "16744",
    "name": "Xã Thông Thụ",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "16777",
    "name": "Xã Quỳ Châu",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "16792",
    "name": "Xã Châu Tiến",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "16801",
    "name": "Xã Hùng Chân",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "16804",
    "name": "Xã Châu Bình",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17035",
    "name": "Xã Quỳ Hợp",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17059",
    "name": "Xã Tam Hợp",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17056",
    "name": "Xã Châu Lộc",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17044",
    "name": "Xã Châu Hồng",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17077",
    "name": "Xã Mường Ham",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17089",
    "name": "Xã Mường Chọng",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17071",
    "name": "Xã Minh Hợp",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17179",
    "name": "Xã Quỳnh Lưu",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17143",
    "name": "Xã Quỳnh Văn",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17176",
    "name": "Xã Quỳnh Anh",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17149",
    "name": "Xã Quỳnh Tam",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17212",
    "name": "Xã Quỳnh Phú",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17170",
    "name": "Xã Quỳnh Sơn",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17224",
    "name": "Xã Quỳnh Thắng",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17266",
    "name": "Xã Tân Kỳ",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17272",
    "name": "Xã Tân Phú",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17305",
    "name": "Xã Tân An",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17284",
    "name": "Xã Nghĩa Đồng",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17278",
    "name": "Xã Giai Xuân",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17326",
    "name": "Xã Nghĩa Hành",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17287",
    "name": "Xã Tiên Đồng",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "16939",
    "name": "Phường Thái Hòa",
    "type": "ward",
    "provinceCode": "40"
  },
  {
    "code": "17011",
    "name": "Phường Tây Hiếu",
    "type": "ward",
    "provinceCode": "40"
  },
  {
    "code": "17017",
    "name": "Xã Đông Hiếu",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17728",
    "name": "Xã Cát Ngạn",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17743",
    "name": "Xã Tam Đồng",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17722",
    "name": "Xã Hạnh Lâm",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17759",
    "name": "Xã Sơn Lâm",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17770",
    "name": "Xã Hoa Quân",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17791",
    "name": "Xã Kim Bảng",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17818",
    "name": "Xã Bích Hào",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17713",
    "name": "Xã Đại Đồng",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17779",
    "name": "Xã Xuân Lâm",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "16933",
    "name": "Xã Tam Quang",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "16936",
    "name": "Xã Tam Thái",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "16876",
    "name": "Xã Tương Dương",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "16906",
    "name": "Xã Lượng Minh",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "16912",
    "name": "Xã Yên Na",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "16909",
    "name": "Xã Yên Hòa",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "16903",
    "name": "Xã Nga My",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "16885",
    "name": "Xã Hữu Khuông",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "16882",
    "name": "Xã Nhôn Mai",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "16690",
    "name": "Phường Trường Vinh",
    "type": "ward",
    "provinceCode": "40"
  },
  {
    "code": "16681",
    "name": "Phường Thành Vinh",
    "type": "ward",
    "provinceCode": "40"
  },
  {
    "code": "17920",
    "name": "Phường Vinh Hưng",
    "type": "ward",
    "provinceCode": "40"
  },
  {
    "code": "16702",
    "name": "Phường Vinh Phú",
    "type": "ward",
    "provinceCode": "40"
  },
  {
    "code": "16708",
    "name": "Phường Vinh Lộc",
    "type": "ward",
    "provinceCode": "40"
  },
  {
    "code": "16732",
    "name": "Phường Cửa Lò",
    "type": "ward",
    "provinceCode": "40"
  },
  {
    "code": "17506",
    "name": "Xã Yên Thành",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17569",
    "name": "Xã Quan Thành",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17605",
    "name": "Xã Hợp Minh",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17611",
    "name": "Xã Vân Tụ",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17560",
    "name": "Xã Vân Du",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17521",
    "name": "Xã Quang Đồng",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17524",
    "name": "Xã Giai Lạc",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17515",
    "name": "Xã Bình Minh",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "17530",
    "name": "Xã Đông Thành",
    "type": "commune",
    "provinceCode": "40"
  },
  {
    "code": "18754",
    "name": "Phường Sông Trí",
    "type": "ward",
    "provinceCode": "42"
  },
  {
    "code": "18781",
    "name": "Phường Hải Ninh",
    "type": "ward",
    "provinceCode": "42"
  },
  {
    "code": "18832",
    "name": "Phường Hoành Sơn",
    "type": "ward",
    "provinceCode": "42"
  },
  {
    "code": "18823",
    "name": "Phường Vũng Áng",
    "type": "ward",
    "provinceCode": "42"
  },
  {
    "code": "18766",
    "name": "Xã Kỳ Xuân",
    "type": "commune",
    "provinceCode": "42"
  },
  {
    "code": "18775",
    "name": "Xã Kỳ Anh",
    "type": "commune",
    "provinceCode": "42"
  },
  {
    "code": "18814",
    "name": "Xã Kỳ Hoa",
    "type": "commune",
    "provinceCode": "42"
  },
  {
    "code": "18787",
    "name": "Xã Kỳ Văn",
    "type": "commune",
    "provinceCode": "42"
  },
  {
    "code": "18790",
    "name": "Xã Kỳ Khang",
    "type": "commune",
    "provinceCode": "42"
  },
  {
    "code": "18838",
    "name": "Xã Kỳ Lạc",
    "type": "commune",
    "provinceCode": "42"
  },
  {
    "code": "18844",
    "name": "Xã Kỳ Thượng",
    "type": "commune",
    "provinceCode": "42"
  },
  {
    "code": "18673",
    "name": "Xã Cẩm Xuyên",
    "type": "commune",
    "provinceCode": "42"
  },
  {
    "code": "18676",
    "name": "Xã Thiên Cầm",
    "type": "commune",
    "provinceCode": "42"
  },
  {
    "code": "18739",
    "name": "Xã Cẩm Duệ",
    "type": "commune",
    "provinceCode": "42"
  },
  {
    "code": "18736",
    "name": "Xã Cẩm Hưng",
    "type": "commune",
    "provinceCode": "42"
  },
  {
    "code": "18748",
    "name": "Xã Cẩm Lạc",
    "type": "commune",
    "provinceCode": "42"
  },
  {
    "code": "18742",
    "name": "Xã Cẩm Trung",
    "type": "commune",
    "provinceCode": "42"
  },
  {
    "code": "18682",
    "name": "Xã Yên Hòa",
    "type": "commune",
    "provinceCode": "42"
  },
  {
    "code": "18073",
    "name": "Phường Thành Sen",
    "type": "ward",
    "provinceCode": "42"
  },
  {
    "code": "18100",
    "name": "Phường Trần Phú",
    "type": "ward",
    "provinceCode": "42"
  },
  {
    "code": "18652",
    "name": "Phường Hà Huy Tập",
    "type": "ward",
    "provinceCode": "42"
  },
  {
    "code": "18628",
    "name": "Xã Thạch Lạc",
    "type": "commune",
    "provinceCode": "42"
  },
  {
    "code": "18619",
    "name": "Xã Đồng Tiến",
    "type": "commune",
    "provinceCode": "42"
  },
  {
    "code": "18604",
    "name": "Xã Thạch Khê",
    "type": "commune",
    "provinceCode": "42"
  },
  {
    "code": "18685",
    "name": "Xã Cẩm Bình",
    "type": "commune",
    "provinceCode": "42"
  },
  {
    "code": "18562",
    "name": "Xã Thạch Hà",
    "type": "commune",
    "provinceCode": "42"
  },
  {
    "code": "18634",
    "name": "Xã Toàn Lưu",
    "type": "commune",
    "provinceCode": "42"
  },
  {
    "code": "18601",
    "name": "Xã Việt Xuyên",
    "type": "commune",
    "provinceCode": "42"
  },
  {
    "code": "18586",
    "name": "Xã Đông Kinh",
    "type": "commune",
    "provinceCode": "42"
  },
  {
    "code": "18667",
    "name": "Xã Thạch Xuân",
    "type": "commune",
    "provinceCode": "42"
  },
  {
    "code": "18568",
    "name": "Xã Lộc Hà",
    "type": "commune",
    "provinceCode": "42"
  },
  {
    "code": "18409",
    "name": "Xã Hồng Lộc",
    "type": "commune",
    "provinceCode": "42"
  },
  {
    "code": "18583",
    "name": "Xã Mai Phụ",
    "type": "commune",
    "provinceCode": "42"
  },
  {
    "code": "18406",
    "name": "Xã Can Lộc",
    "type": "commune",
    "provinceCode": "42"
  },
  {
    "code": "18418",
    "name": "Xã Tùng Lộc",
    "type": "commune",
    "provinceCode": "42"
  },
  {
    "code": "18466",
    "name": "Xã Gia Hanh",
    "type": "commune",
    "provinceCode": "42"
  },
  {
    "code": "18436",
    "name": "Xã Trường Lưu",
    "type": "commune",
    "provinceCode": "42"
  },
  {
    "code": "18481",
    "name": "Xã Xuân Lộc",
    "type": "commune",
    "provinceCode": "42"
  },
  {
    "code": "18484",
    "name": "Xã Đồng Lộc",
    "type": "commune",
    "provinceCode": "42"
  },
  {
    "code": "18115",
    "name": "Phường Bắc Hồng Lĩnh",
    "type": "ward",
    "provinceCode": "42"
  },
  {
    "code": "18118",
    "name": "Phường Nam Hồng Lĩnh",
    "type": "ward",
    "provinceCode": "42"
  },
  {
    "code": "18373",
    "name": "Xã Tiên Điền",
    "type": "commune",
    "provinceCode": "42"
  },
  {
    "code": "18352",
    "name": "Xã Nghi Xuân",
    "type": "commune",
    "provinceCode": "42"
  },
  {
    "code": "18394",
    "name": "Xã Cổ Đạm",
    "type": "commune",
    "provinceCode": "42"
  },
  {
    "code": "18364",
    "name": "Xã Đan Hải",
    "type": "commune",
    "provinceCode": "42"
  },
  {
    "code": "18229",
    "name": "Xã Đức Thọ",
    "type": "commune",
    "provinceCode": "42"
  },
  {
    "code": "18262",
    "name": "Xã Đức Quang",
    "type": "commune",
    "provinceCode": "42"
  },
  {
    "code": "18304",
    "name": "Xã Đức Đồng",
    "type": "commune",
    "provinceCode": "42"
  },
  {
    "code": "18277",
    "name": "Xã Đức Thịnh",
    "type": "commune",
    "provinceCode": "42"
  },
  {
    "code": "18244",
    "name": "Xã Đức Minh",
    "type": "commune",
    "provinceCode": "42"
  },
  {
    "code": "18133",
    "name": "Xã Hương Sơn",
    "type": "commune",
    "provinceCode": "42"
  },
  {
    "code": "18172",
    "name": "Xã Sơn Tây",
    "type": "commune",
    "provinceCode": "42"
  },
  {
    "code": "18202",
    "name": "Xã Tứ Mỹ",
    "type": "commune",
    "provinceCode": "42"
  },
  {
    "code": "18184",
    "name": "Xã Sơn Giang",
    "type": "commune",
    "provinceCode": "42"
  },
  {
    "code": "18163",
    "name": "Xã Sơn Tiến",
    "type": "commune",
    "provinceCode": "42"
  },
  {
    "code": "18160",
    "name": "Xã Sơn Hồng",
    "type": "commune",
    "provinceCode": "42"
  },
  {
    "code": "18223",
    "name": "Xã Kim Hoa",
    "type": "commune",
    "provinceCode": "42"
  },
  {
    "code": "18313",
    "name": "Xã Vũ Quang",
    "type": "commune",
    "provinceCode": "42"
  },
  {
    "code": "18322",
    "name": "Xã Mai Hoa",
    "type": "commune",
    "provinceCode": "42"
  },
  {
    "code": "18328",
    "name": "Xã Thượng Đức",
    "type": "commune",
    "provinceCode": "42"
  },
  {
    "code": "18496",
    "name": "Xã Hương Khê",
    "type": "commune",
    "provinceCode": "42"
  },
  {
    "code": "18532",
    "name": "Xã Hương Phố",
    "type": "commune",
    "provinceCode": "42"
  },
  {
    "code": "18550",
    "name": "Xã Hương Đô",
    "type": "commune",
    "provinceCode": "42"
  },
  {
    "code": "18502",
    "name": "Xã Hà Linh",
    "type": "commune",
    "provinceCode": "42"
  },
  {
    "code": "18523",
    "name": "Xã Hương Bình",
    "type": "commune",
    "provinceCode": "42"
  },
  {
    "code": "18547",
    "name": "Xã Phúc Trạch",
    "type": "commune",
    "provinceCode": "42"
  },
  {
    "code": "18544",
    "name": "Xã Hương Xuân",
    "type": "commune",
    "provinceCode": "42"
  },
  {
    "code": "18196",
    "name": "Xã Sơn Kim 1",
    "type": "commune",
    "provinceCode": "42"
  },
  {
    "code": "18199",
    "name": "Xã Sơn Kim 2",
    "type": "commune",
    "provinceCode": "42"
  },
  {
    "code": "18880",
    "name": "Phường Đồng Hới",
    "type": "ward",
    "provinceCode": "44"
  },
  {
    "code": "18859",
    "name": "Phường Đồng Thuận",
    "type": "ward",
    "provinceCode": "44"
  },
  {
    "code": "18871",
    "name": "Phường Đồng Sơn",
    "type": "ward",
    "provinceCode": "44"
  },
  {
    "code": "19093",
    "name": "Xã Nam Gianh",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "19075",
    "name": "Xã Nam Ba Đồn",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "19009",
    "name": "Phường Ba Đồn",
    "type": "ward",
    "provinceCode": "44"
  },
  {
    "code": "19066",
    "name": "Phường Bắc Gianh",
    "type": "ward",
    "provinceCode": "44"
  },
  {
    "code": "18904",
    "name": "Xã Dân Hóa",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "18922",
    "name": "Xã Kim Điền",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "18943",
    "name": "Xã Kim Phú",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "18901",
    "name": "Xã Minh Hóa",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "18919",
    "name": "Xã Tân Thành",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "18958",
    "name": "Xã Tuyên Lâm",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "18952",
    "name": "Xã Tuyên Sơn",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "18949",
    "name": "Xã Đồng Lê",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "18985",
    "name": "Xã Tuyên Phú",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "18991",
    "name": "Xã Tuyên Bình",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "18997",
    "name": "Xã Tuyên Hóa",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "19051",
    "name": "Xã Tân Gianh",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "19030",
    "name": "Xã Trung Thuần",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "19057",
    "name": "Xã Quảng Trạch",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "19033",
    "name": "Xã Hòa Trạch",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "19021",
    "name": "Xã Phú Trạch",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "19147",
    "name": "Xã Thượng Trạch",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "19138",
    "name": "Xã Phong Nha",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "19126",
    "name": "Xã Bắc Trạch",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "19159",
    "name": "Xã Đông Trạch",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "19111",
    "name": "Xã Hoàn Lão",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "19141",
    "name": "Xã Bố Trạch",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "19198",
    "name": "Xã Nam Trạch",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "19207",
    "name": "Xã Quảng Ninh",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "19225",
    "name": "Xã Ninh Châu",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "19237",
    "name": "Xã Trường Ninh",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "19204",
    "name": "Xã Trường Sơn",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "19249",
    "name": "Xã Lệ Thủy",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "19255",
    "name": "Xã Cam Hồng",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "19288",
    "name": "Xã Sen Ngư",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "19291",
    "name": "Xã Tân Mỹ",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "19309",
    "name": "Xã Trường Phú",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "19246",
    "name": "Xã Lệ Ninh",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "19318",
    "name": "Xã Kim Ngân",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "19333",
    "name": "Phường Đông Hà",
    "type": "ward",
    "provinceCode": "44"
  },
  {
    "code": "19351",
    "name": "Phường Nam Đông Hà",
    "type": "ward",
    "provinceCode": "44"
  },
  {
    "code": "19360",
    "name": "Phường Quảng Trị",
    "type": "ward",
    "provinceCode": "44"
  },
  {
    "code": "19363",
    "name": "Xã Vĩnh Linh",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "19414",
    "name": "Xã Cửa Tùng",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "19372",
    "name": "Xã Vĩnh Hoàng",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "19405",
    "name": "Xã Vĩnh Thủy",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "19366",
    "name": "Xã Bến Quan",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "19537",
    "name": "Xã Cồn Tiên",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "19496",
    "name": "Xã Cửa Việt",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "19495",
    "name": "Xã Gio Linh",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "19501",
    "name": "Xã Bến Hải",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "19435",
    "name": "Xã Hướng Lập",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "19441",
    "name": "Xã Hướng Phùng",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "19429",
    "name": "Xã Khe Sanh",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "19462",
    "name": "Xã Tân Lập",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "19432",
    "name": "Xã Lao Bảo",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "19489",
    "name": "Xã Lìa",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "19483",
    "name": "Xã A Dơi",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "19594",
    "name": "Xã La Lay",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "19588",
    "name": "Xã Tà Rụt",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "19564",
    "name": "Xã Đakrông",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "19567",
    "name": "Xã Ba Lòng",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "19555",
    "name": "Xã Hướng Hiệp",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "19597",
    "name": "Xã Cam Lộ",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "19603",
    "name": "Xã Hiếu Giang",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "19624",
    "name": "Xã Triệu Phong",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "19669",
    "name": "Xã Ái Tử",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "19645",
    "name": "Xã Triệu Bình",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "19654",
    "name": "Xã Triệu Cơ",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "19639",
    "name": "Xã Nam Cửa Việt",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "19681",
    "name": "Xã Diên Sanh",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "19741",
    "name": "Xã Mỹ Thủy",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "19702",
    "name": "Xã Hải Lăng",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "19699",
    "name": "Xã Vĩnh Định",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "19735",
    "name": "Xã Nam Hải Lăng",
    "type": "commune",
    "provinceCode": "44"
  },
  {
    "code": "19742",
    "name": "Đặc khu Cồn Cỏ",
    "type": "special_zone",
    "provinceCode": "44"
  },
  {
    "code": "19900",
    "name": "Phường Thuận An",
    "type": "ward",
    "provinceCode": "46"
  },
  {
    "code": "20014",
    "name": "Phường Hóa Châu",
    "type": "ward",
    "provinceCode": "46"
  },
  {
    "code": "19930",
    "name": "Phường Mỹ Thượng",
    "type": "ward",
    "provinceCode": "46"
  },
  {
    "code": "19777",
    "name": "Phường Vỹ Dạ",
    "type": "ward",
    "provinceCode": "46"
  },
  {
    "code": "19789",
    "name": "Phường Thuận Hóa",
    "type": "ward",
    "provinceCode": "46"
  },
  {
    "code": "19815",
    "name": "Phường An Cựu",
    "type": "ward",
    "provinceCode": "46"
  },
  {
    "code": "19813",
    "name": "Phường Thủy Xuân",
    "type": "ward",
    "provinceCode": "46"
  },
  {
    "code": "19774",
    "name": "Phường Kim Long",
    "type": "ward",
    "provinceCode": "46"
  },
  {
    "code": "19804",
    "name": "Phường Hương An",
    "type": "ward",
    "provinceCode": "46"
  },
  {
    "code": "19753",
    "name": "Phường Phú Xuân",
    "type": "ward",
    "provinceCode": "46"
  },
  {
    "code": "19996",
    "name": "Phường Hương Trà",
    "type": "ward",
    "provinceCode": "46"
  },
  {
    "code": "20017",
    "name": "Phường Kim Trà",
    "type": "ward",
    "provinceCode": "46"
  },
  {
    "code": "19969",
    "name": "Phường Thanh Thủy",
    "type": "ward",
    "provinceCode": "46"
  },
  {
    "code": "19975",
    "name": "Phường Hương Thủy",
    "type": "ward",
    "provinceCode": "46"
  },
  {
    "code": "19960",
    "name": "Phường Phú Bài",
    "type": "ward",
    "provinceCode": "46"
  },
  {
    "code": "19819",
    "name": "Phường Phong Điền",
    "type": "ward",
    "provinceCode": "46"
  },
  {
    "code": "19858",
    "name": "Phường Phong Thái",
    "type": "ward",
    "provinceCode": "46"
  },
  {
    "code": "19831",
    "name": "Phường Phong Dinh",
    "type": "ward",
    "provinceCode": "46"
  },
  {
    "code": "19828",
    "name": "Phường Phong Phú",
    "type": "ward",
    "provinceCode": "46"
  },
  {
    "code": "19873",
    "name": "Phường Phong Quảng",
    "type": "ward",
    "provinceCode": "46"
  },
  {
    "code": "19885",
    "name": "Xã Đan Điền",
    "type": "commune",
    "provinceCode": "46"
  },
  {
    "code": "19867",
    "name": "Xã Quảng Điền",
    "type": "commune",
    "provinceCode": "46"
  },
  {
    "code": "19945",
    "name": "Xã Phú Vinh",
    "type": "commune",
    "provinceCode": "46"
  },
  {
    "code": "19918",
    "name": "Xã Phú Hồ",
    "type": "commune",
    "provinceCode": "46"
  },
  {
    "code": "19942",
    "name": "Xã Phú Vang",
    "type": "commune",
    "provinceCode": "46"
  },
  {
    "code": "20122",
    "name": "Xã Vinh Lộc",
    "type": "commune",
    "provinceCode": "46"
  },
  {
    "code": "20131",
    "name": "Xã Hưng Lộc",
    "type": "commune",
    "provinceCode": "46"
  },
  {
    "code": "20140",
    "name": "Xã Lộc An",
    "type": "commune",
    "provinceCode": "46"
  },
  {
    "code": "20107",
    "name": "Xã Phú Lộc",
    "type": "commune",
    "provinceCode": "46"
  },
  {
    "code": "20137",
    "name": "Xã Chân Mây - Lăng Cô",
    "type": "commune",
    "provinceCode": "46"
  },
  {
    "code": "20182",
    "name": "Xã Long Quảng",
    "type": "commune",
    "provinceCode": "46"
  },
  {
    "code": "20179",
    "name": "Xã Nam Đông",
    "type": "commune",
    "provinceCode": "46"
  },
  {
    "code": "20161",
    "name": "Xã Khe Tre",
    "type": "commune",
    "provinceCode": "46"
  },
  {
    "code": "20035",
    "name": "Xã Bình Điền",
    "type": "commune",
    "provinceCode": "46"
  },
  {
    "code": "20056",
    "name": "Xã A Lưới 1",
    "type": "commune",
    "provinceCode": "46"
  },
  {
    "code": "20044",
    "name": "Xã A Lưới 2",
    "type": "commune",
    "provinceCode": "46"
  },
  {
    "code": "20071",
    "name": "Xã A Lưới 3",
    "type": "commune",
    "provinceCode": "46"
  },
  {
    "code": "20101",
    "name": "Xã A Lưới 4",
    "type": "commune",
    "provinceCode": "46"
  },
  {
    "code": "20050",
    "name": "Xã A Lưới 5",
    "type": "commune",
    "provinceCode": "46"
  },
  {
    "code": "19909",
    "name": "Phường Dương Nỗ",
    "type": "ward",
    "provinceCode": "46"
  },
  {
    "code": "20242",
    "name": "Phường Hải Châu",
    "type": "ward",
    "provinceCode": "48"
  },
  {
    "code": "20257",
    "name": "Phường Hòa Cường",
    "type": "ward",
    "provinceCode": "48"
  },
  {
    "code": "20209",
    "name": "Phường Thanh Khê",
    "type": "ward",
    "provinceCode": "48"
  },
  {
    "code": "20305",
    "name": "Phường An Khê",
    "type": "ward",
    "provinceCode": "48"
  },
  {
    "code": "20275",
    "name": "Phường An Hải",
    "type": "ward",
    "provinceCode": "48"
  },
  {
    "code": "20263",
    "name": "Phường Sơn Trà",
    "type": "ward",
    "provinceCode": "48"
  },
  {
    "code": "20285",
    "name": "Phường Ngũ Hành Sơn",
    "type": "ward",
    "provinceCode": "48"
  },
  {
    "code": "20200",
    "name": "Phường Hòa Khánh",
    "type": "ward",
    "provinceCode": "48"
  },
  {
    "code": "20194",
    "name": "Phường Hải Vân",
    "type": "ward",
    "provinceCode": "48"
  },
  {
    "code": "20197",
    "name": "Phường Liên Chiểu",
    "type": "ward",
    "provinceCode": "48"
  },
  {
    "code": "20260",
    "name": "Phường Cẩm Lệ",
    "type": "ward",
    "provinceCode": "48"
  },
  {
    "code": "20314",
    "name": "Phường Hòa Xuân",
    "type": "ward",
    "provinceCode": "48"
  },
  {
    "code": "20320",
    "name": "Xã Hòa Vang",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20332",
    "name": "Xã Hòa Tiến",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20308",
    "name": "Xã Bà Nà",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20333",
    "name": "Đặc khu Hoàng Sa",
    "type": "special_zone",
    "provinceCode": "48"
  },
  {
    "code": "20965",
    "name": "Xã Núi Thành",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "21004",
    "name": "Xã Tam Mỹ",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20984",
    "name": "Xã Tam Anh",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20977",
    "name": "Xã Đức Phú",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20971",
    "name": "Xã Tam Xuân",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20992",
    "name": "Xã Tam Hải",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20341",
    "name": "Phường Tam Kỳ",
    "type": "ward",
    "provinceCode": "48"
  },
  {
    "code": "20356",
    "name": "Phường Quảng Phú",
    "type": "ward",
    "provinceCode": "48"
  },
  {
    "code": "20350",
    "name": "Phường Hương Trà",
    "type": "ward",
    "provinceCode": "48"
  },
  {
    "code": "20335",
    "name": "Phường Bàn Thạch",
    "type": "ward",
    "provinceCode": "48"
  },
  {
    "code": "20380",
    "name": "Xã Tây Hồ",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20364",
    "name": "Xã Chiên Đàn",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20392",
    "name": "Xã Phú Ninh",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20875",
    "name": "Xã Lãnh Ngọc",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20854",
    "name": "Xã Tiên Phước",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20878",
    "name": "Xã Thạnh Bình",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20857",
    "name": "Xã Sơn Cẩm Hà",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20908",
    "name": "Xã Trà Liên",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20929",
    "name": "Xã Trà Giáp",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20923",
    "name": "Xã Trà Tân",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20920",
    "name": "Xã Trà Đốc",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20900",
    "name": "Xã Trà My",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20944",
    "name": "Xã Nam Trà My",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20941",
    "name": "Xã Trà Tập",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20959",
    "name": "Xã Trà Vân",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20950",
    "name": "Xã Trà Linh",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20938",
    "name": "Xã Trà Leng",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20791",
    "name": "Xã Thăng Bình",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20794",
    "name": "Xã Thăng An",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20836",
    "name": "Xã Thăng Trường",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20848",
    "name": "Xã Thăng Điền",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20827",
    "name": "Xã Thăng Phú",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20818",
    "name": "Xã Đồng Dương",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20662",
    "name": "Xã Quế Sơn Trung",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20641",
    "name": "Xã Quế Sơn",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20650",
    "name": "Xã Xuân Phú",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20656",
    "name": "Xã Nông Sơn",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20669",
    "name": "Xã Quế Phước",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20635",
    "name": "Xã Duy Nghĩa",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20599",
    "name": "Xã Nam Phước",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20623",
    "name": "Xã Duy Xuyên",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20611",
    "name": "Xã Thu Bồn",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20551",
    "name": "Phường Điện Bàn",
    "type": "ward",
    "provinceCode": "48"
  },
  {
    "code": "20579",
    "name": "Phường Điện Bàn Đông",
    "type": "ward",
    "provinceCode": "48"
  },
  {
    "code": "20575",
    "name": "Phường An Thắng",
    "type": "ward",
    "provinceCode": "48"
  },
  {
    "code": "20557",
    "name": "Phường Điện Bàn Bắc",
    "type": "ward",
    "provinceCode": "48"
  },
  {
    "code": "20569",
    "name": "Xã Điện Bàn Tây",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20587",
    "name": "Xã Gò Nổi",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20410",
    "name": "Phường Hội An",
    "type": "ward",
    "provinceCode": "48"
  },
  {
    "code": "20413",
    "name": "Phường Hội An Đông",
    "type": "ward",
    "provinceCode": "48"
  },
  {
    "code": "20401",
    "name": "Phường Hội An Tây",
    "type": "ward",
    "provinceCode": "48"
  },
  {
    "code": "20434",
    "name": "Xã Tân Hiệp",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20500",
    "name": "Xã Đại Lộc",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20515",
    "name": "Xã Hà Nha",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20506",
    "name": "Xã Thượng Đức",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20539",
    "name": "Xã Vu Gia",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20542",
    "name": "Xã Phú Thuận",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20695",
    "name": "Xã Thạnh Mỹ",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20710",
    "name": "Xã Bến Giằng",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20707",
    "name": "Xã Nam Giang",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20716",
    "name": "Xã Đắc Pring",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20704",
    "name": "Xã La Dêê",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20698",
    "name": "Xã La Êê",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20485",
    "name": "Xã Sông Vàng",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20476",
    "name": "Xã Sông Kôn",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20467",
    "name": "Xã Đông Giang",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20494",
    "name": "Xã Bến Hiên",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20458",
    "name": "Xã Avương",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20455",
    "name": "Xã Tây Giang",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20443",
    "name": "Xã Hùng Sơn",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20779",
    "name": "Xã Hiệp Đức",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20767",
    "name": "Xã Việt An",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20770",
    "name": "Xã Phước Trà",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20722",
    "name": "Xã Khâm Đức",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20734",
    "name": "Xã Phước Năng",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20740",
    "name": "Xã Phước Chánh",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20752",
    "name": "Xã Phước Thành",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "20728",
    "name": "Xã Phước Hiệp",
    "type": "commune",
    "provinceCode": "48"
  },
  {
    "code": "21211",
    "name": "Xã Tịnh Khê",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "21172",
    "name": "Phường Trương Quang Trọng",
    "type": "ward",
    "provinceCode": "51"
  },
  {
    "code": "21034",
    "name": "Xã An Phú",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "21025",
    "name": "Phường Cẩm Thành",
    "type": "ward",
    "provinceCode": "51"
  },
  {
    "code": "21028",
    "name": "Phường Nghĩa Lộ",
    "type": "ward",
    "provinceCode": "51"
  },
  {
    "code": "21451",
    "name": "Phường Trà Câu",
    "type": "ward",
    "provinceCode": "51"
  },
  {
    "code": "21457",
    "name": "Xã Nguyễn Nghiêm",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "21439",
    "name": "Phường Đức Phổ",
    "type": "ward",
    "provinceCode": "51"
  },
  {
    "code": "21472",
    "name": "Xã Khánh Cường",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "21478",
    "name": "Phường Sa Huỳnh",
    "type": "ward",
    "provinceCode": "51"
  },
  {
    "code": "21085",
    "name": "Xã Bình Minh",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "21100",
    "name": "Xã Bình Chương",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "21040",
    "name": "Xã Bình Sơn",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "21061",
    "name": "Xã Vạn Tường",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "21109",
    "name": "Xã Đông Sơn",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "21196",
    "name": "Xã Trường Giang",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "21205",
    "name": "Xã Ba Gia",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "21220",
    "name": "Xã Sơn Tịnh",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "21181",
    "name": "Xã Thọ Phong",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "21235",
    "name": "Xã Tư Nghĩa",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "21238",
    "name": "Xã Vệ Giang",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "21250",
    "name": "Xã Nghĩa Giang",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "21244",
    "name": "Xã Trà Giang",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "21364",
    "name": "Xã Nghĩa Hành",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "21385",
    "name": "Xã Đình Cương",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "21388",
    "name": "Xã Thiện Tín",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "21370",
    "name": "Xã Phước Giang",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "21409",
    "name": "Xã Long Phụng",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "21421",
    "name": "Xã Mỏ Cày",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "21400",
    "name": "Xã Mộ Đức",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "21433",
    "name": "Xã Lân Phong",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "21115",
    "name": "Xã Trà Bồng",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "21127",
    "name": "Xã Đông Trà Bồng",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "21154",
    "name": "Xã Tây Trà",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "21124",
    "name": "Xã Thanh Bồng",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "21136",
    "name": "Xã Cà Đam",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "21157",
    "name": "Xã Tây Trà Bồng",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "21292",
    "name": "Xã Sơn Hạ",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "21307",
    "name": "Xã Sơn Linh",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "21289",
    "name": "Xã Sơn Hà",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "21319",
    "name": "Xã Sơn Thủy",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "21325",
    "name": "Xã Sơn Kỳ",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "21340",
    "name": "Xã Sơn Tây",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "21334",
    "name": "Xã Sơn Tây Thượng",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "21343",
    "name": "Xã Sơn Tây Hạ",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "21361",
    "name": "Xã Minh Long",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "21349",
    "name": "Xã Sơn Mai",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "21529",
    "name": "Xã Ba Vì",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "21523",
    "name": "Xã Ba Tô",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "21499",
    "name": "Xã Ba Dinh",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "21484",
    "name": "Xã Ba Tơ",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "21490",
    "name": "Xã Ba Vinh",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "21496",
    "name": "Xã Ba Động",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "21520",
    "name": "Xã Đặng Thùy Trâm",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "21538",
    "name": "Xã Ba Xa",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "21548",
    "name": "Đặc khu Lý Sơn",
    "type": "special_zone",
    "provinceCode": "51"
  },
  {
    "code": "23293",
    "name": "Phường Kon Tum",
    "type": "ward",
    "provinceCode": "51"
  },
  {
    "code": "23284",
    "name": "Phường Đăk Cấm",
    "type": "ward",
    "provinceCode": "51"
  },
  {
    "code": "23302",
    "name": "Phường Đăk Bla",
    "type": "ward",
    "provinceCode": "51"
  },
  {
    "code": "23317",
    "name": "Xã Ngọk Bay",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "23326",
    "name": "Xã Ia Chim",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "23332",
    "name": "Xã Đăk Rơ Wa",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "23504",
    "name": "Xã Đăk Pxi",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "23512",
    "name": "Xã Đăk Mar",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "23510",
    "name": "Xã Đăk Ui",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "23515",
    "name": "Xã Ngọk Réo",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "23500",
    "name": "Xã Đăk Hà",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "23428",
    "name": "Xã Ngọk Tụ",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "23401",
    "name": "Xã Đăk Tô",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "23430",
    "name": "Xã Kon Đào",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "23416",
    "name": "Xã Đăk Sao",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "23419",
    "name": "Xã Đăk Tờ Kan",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "23425",
    "name": "Xã Tu Mơ Rông",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "23446",
    "name": "Xã Măng Ri",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "23377",
    "name": "Xã Bờ Y",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "23392",
    "name": "Xã Sa Loong",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "23383",
    "name": "Xã Dục Nông",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "23356",
    "name": "Xã Xốp",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "23365",
    "name": "Xã Ngọc Linh",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "23344",
    "name": "Xã Đăk Plô",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "23341",
    "name": "Xã Đăk Pék",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "23374",
    "name": "Xã Đăk Môn",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "23527",
    "name": "Xã Sa Thầy",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "23534",
    "name": "Xã Sa Bình",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "23548",
    "name": "Xã Ya Ly",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "23538",
    "name": "Xã Ia Tơi",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "23485",
    "name": "Xã Đăk Kôi",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "23497",
    "name": "Xã Kon Braih",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "23479",
    "name": "Xã Đăk Rve",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "23473",
    "name": "Xã Măng Đen",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "23455",
    "name": "Xã Măng Bút",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "23476",
    "name": "Xã Kon Plông",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "23368",
    "name": "Xã Đăk Long",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "23530",
    "name": "Xã Rờ Kơi",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "23536",
    "name": "Xã Mô Rai",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "23535",
    "name": "Xã Ia Đal",
    "type": "commune",
    "provinceCode": "51"
  },
  {
    "code": "21583",
    "name": "Phường Quy Nhơn",
    "type": "ward",
    "provinceCode": "52"
  },
  {
    "code": "21601",
    "name": "Phường Quy Nhơn Đông",
    "type": "ward",
    "provinceCode": "52"
  },
  {
    "code": "21589",
    "name": "Phường Quy Nhơn Tây",
    "type": "ward",
    "provinceCode": "52"
  },
  {
    "code": "21592",
    "name": "Phường Quy Nhơn Nam",
    "type": "ward",
    "provinceCode": "52"
  },
  {
    "code": "21553",
    "name": "Phường Quy Nhơn Bắc",
    "type": "ward",
    "provinceCode": "52"
  },
  {
    "code": "21907",
    "name": "Phường Bình Định",
    "type": "ward",
    "provinceCode": "52"
  },
  {
    "code": "21910",
    "name": "Phường An Nhơn",
    "type": "ward",
    "provinceCode": "52"
  },
  {
    "code": "21934",
    "name": "Phường An Nhơn Đông",
    "type": "ward",
    "provinceCode": "52"
  },
  {
    "code": "21943",
    "name": "Phường An Nhơn Nam",
    "type": "ward",
    "provinceCode": "52"
  },
  {
    "code": "21925",
    "name": "Phường An Nhơn Bắc",
    "type": "ward",
    "provinceCode": "52"
  },
  {
    "code": "21940",
    "name": "Xã An Nhơn Tây",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "21640",
    "name": "Phường Bồng Sơn",
    "type": "ward",
    "provinceCode": "52"
  },
  {
    "code": "21664",
    "name": "Phường Hoài Nhơn",
    "type": "ward",
    "provinceCode": "52"
  },
  {
    "code": "21637",
    "name": "Phường Tam Quan",
    "type": "ward",
    "provinceCode": "52"
  },
  {
    "code": "21670",
    "name": "Phường Hoài Nhơn Đông",
    "type": "ward",
    "provinceCode": "52"
  },
  {
    "code": "21661",
    "name": "Phường Hoài Nhơn Tây",
    "type": "ward",
    "provinceCode": "52"
  },
  {
    "code": "21673",
    "name": "Phường Hoài Nhơn Nam",
    "type": "ward",
    "provinceCode": "52"
  },
  {
    "code": "21655",
    "name": "Phường Hoài Nhơn Bắc",
    "type": "ward",
    "provinceCode": "52"
  },
  {
    "code": "21853",
    "name": "Xã Phù Cát",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "21892",
    "name": "Xã Xuân An",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "21901",
    "name": "Xã Ngô Mây",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "21880",
    "name": "Xã Cát Tiến",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "21859",
    "name": "Xã Đề Gi",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "21871",
    "name": "Xã Hòa Hội",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "21868",
    "name": "Xã Hội Sơn",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "21730",
    "name": "Xã Phù Mỹ",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "21769",
    "name": "Xã An Lương",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "21733",
    "name": "Xã Bình Dương",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "21751",
    "name": "Xã Phù Mỹ Đông",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "21757",
    "name": "Xã Phù Mỹ Tây",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "21775",
    "name": "Xã Phù Mỹ Nam",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "21739",
    "name": "Xã Phù Mỹ Bắc",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "21952",
    "name": "Xã Tuy Phước",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "21970",
    "name": "Xã Tuy Phước Đông",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "21985",
    "name": "Xã Tuy Phước Tây",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "21964",
    "name": "Xã Tuy Phước Bắc",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "21808",
    "name": "Xã Tây Sơn",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "21820",
    "name": "Xã Bình Khê",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "21835",
    "name": "Xã Bình Phú",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "21817",
    "name": "Xã Bình Hiệp",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "21829",
    "name": "Xã Bình An",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "21688",
    "name": "Xã Hoài Ân",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "21715",
    "name": "Xã Ân Tường",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "21727",
    "name": "Xã Kim Sơn",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "21703",
    "name": "Xã Vạn Đức",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "21697",
    "name": "Xã Ân Hảo",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "21994",
    "name": "Xã Vân Canh",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "22006",
    "name": "Xã Canh Vinh",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "21997",
    "name": "Xã Canh Liên",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "21786",
    "name": "Xã Vĩnh Thạnh",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "21796",
    "name": "Xã Vĩnh Thịnh",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "21805",
    "name": "Xã Vĩnh Quang",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "21787",
    "name": "Xã Vĩnh Sơn",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "21628",
    "name": "Xã An Hòa",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "21609",
    "name": "Xã An Lão",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "21616",
    "name": "Xã An Vinh",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "21622",
    "name": "Xã An Toàn",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "23575",
    "name": "Phường Pleiku",
    "type": "ward",
    "provinceCode": "52"
  },
  {
    "code": "23586",
    "name": "Phường Hội Phú",
    "type": "ward",
    "provinceCode": "52"
  },
  {
    "code": "23584",
    "name": "Phường Thống Nhất",
    "type": "ward",
    "provinceCode": "52"
  },
  {
    "code": "23563",
    "name": "Phường Diên Hồng",
    "type": "ward",
    "provinceCode": "52"
  },
  {
    "code": "23602",
    "name": "Phường An Phú",
    "type": "ward",
    "provinceCode": "52"
  },
  {
    "code": "23590",
    "name": "Xã Biển Hồ",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "23611",
    "name": "Xã Gào",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "23734",
    "name": "Xã Ia Ly",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "23722",
    "name": "Xã Chư Păh",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "23728",
    "name": "Xã Ia Khươl",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "23749",
    "name": "Xã Ia Phí",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "23887",
    "name": "Xã Chư Prông",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "23896",
    "name": "Xã Bàu Cạn",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "23911",
    "name": "Xã Ia Boòng",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "23935",
    "name": "Xã Ia Lâu",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "23926",
    "name": "Xã Ia Pia",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "23908",
    "name": "Xã Ia Tôr",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "23941",
    "name": "Xã Chư Sê",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "23947",
    "name": "Xã Bờ Ngoong",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "23977",
    "name": "Xã Ia Ko",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "23954",
    "name": "Xã Al Bá",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "23942",
    "name": "Xã Chư Pưh",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "23986",
    "name": "Xã Ia Le",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "23971",
    "name": "Xã Ia Hrú",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "23617",
    "name": "Phường An Khê",
    "type": "ward",
    "provinceCode": "52"
  },
  {
    "code": "23614",
    "name": "Phường An Bình",
    "type": "ward",
    "provinceCode": "52"
  },
  {
    "code": "23629",
    "name": "Xã Cửu An",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "23995",
    "name": "Xã Đak Pơ",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "24007",
    "name": "Xã Ya Hội",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "23638",
    "name": "Xã Kbang",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "23674",
    "name": "Xã Kông Bơ La",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "23668",
    "name": "Xã Tơ Tung",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "23647",
    "name": "Xã Sơn Lang",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "23644",
    "name": "Xã Đak Rong",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "23824",
    "name": "Xã Kông Chro",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "23833",
    "name": "Xã Ya Ma",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "23830",
    "name": "Xã Chư Krey",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "23839",
    "name": "Xã SRó",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "23842",
    "name": "Xã Đăk Song",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "23851",
    "name": "Xã Chơ Long",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "24044",
    "name": "Phường Ayun Pa",
    "type": "ward",
    "provinceCode": "52"
  },
  {
    "code": "24065",
    "name": "Xã Ia Rbol",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "24073",
    "name": "Xã Ia Sao",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "24043",
    "name": "Xã Phú Thiện",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "24049",
    "name": "Xã Chư A Thai",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "24061",
    "name": "Xã Ia Hiao",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "24013",
    "name": "Xã Pờ Tó",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "24022",
    "name": "Xã Ia Pa",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "24028",
    "name": "Xã Ia Tul",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "24076",
    "name": "Xã Phú Túc",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "24100",
    "name": "Xã Ia Dreh",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "24112",
    "name": "Xã Ia Rsai",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "24109",
    "name": "Xã Uar",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "23677",
    "name": "Xã Đak Đoa",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "23701",
    "name": "Xã Kon Gang",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "23710",
    "name": "Xã Ia Băng",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "23714",
    "name": "Xã KDang",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "23683",
    "name": "Xã Đak Sơmei",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "23794",
    "name": "Xã Mang Yang",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "23812",
    "name": "Xã Lơ Pang",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "23818",
    "name": "Xã Kon Chiêng",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "23799",
    "name": "Xã Hra",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "23798",
    "name": "Xã Ayun",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "23764",
    "name": "Xã Ia Grai",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "23776",
    "name": "Xã Ia Krái",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "23767",
    "name": "Xã Ia Hrung",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "23857",
    "name": "Xã Đức Cơ",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "23869",
    "name": "Xã Ia Dơk",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "23866",
    "name": "Xã Ia Krêl",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "21607",
    "name": "Xã Nhơn Châu",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "23917",
    "name": "Xã Ia Púch",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "23737",
    "name": "Xã Ia Mơ",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "23881",
    "name": "Xã Ia Pnôn",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "23884",
    "name": "Xã Ia Nan",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "23872",
    "name": "Xã Ia Dom",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "23788",
    "name": "Xã Ia Chia",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "23782",
    "name": "Xã Ia O",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "23650",
    "name": "Xã Krong",
    "type": "commune",
    "provinceCode": "52"
  },
  {
    "code": "22366",
    "name": "Phường Nha Trang",
    "type": "ward",
    "provinceCode": "56"
  },
  {
    "code": "22333",
    "name": "Phường Bắc Nha Trang",
    "type": "ward",
    "provinceCode": "56"
  },
  {
    "code": "22390",
    "name": "Phường Tây Nha Trang",
    "type": "ward",
    "provinceCode": "56"
  },
  {
    "code": "22402",
    "name": "Phường Nam Nha Trang",
    "type": "ward",
    "provinceCode": "56"
  },
  {
    "code": "22411",
    "name": "Phường Bắc Cam Ranh",
    "type": "ward",
    "provinceCode": "56"
  },
  {
    "code": "22420",
    "name": "Phường Cam Ranh",
    "type": "ward",
    "provinceCode": "56"
  },
  {
    "code": "22432",
    "name": "Phường Cam Linh",
    "type": "ward",
    "provinceCode": "56"
  },
  {
    "code": "22423",
    "name": "Phường Ba Ngòi",
    "type": "ward",
    "provinceCode": "56"
  },
  {
    "code": "22480",
    "name": "Xã Nam Cam Ranh",
    "type": "commune",
    "provinceCode": "56"
  },
  {
    "code": "22546",
    "name": "Xã Bắc Ninh Hòa",
    "type": "commune",
    "provinceCode": "56"
  },
  {
    "code": "22528",
    "name": "Phường Ninh Hòa",
    "type": "ward",
    "provinceCode": "56"
  },
  {
    "code": "22576",
    "name": "Xã Tân Định",
    "type": "commune",
    "provinceCode": "56"
  },
  {
    "code": "22561",
    "name": "Phường Đông Ninh Hòa",
    "type": "ward",
    "provinceCode": "56"
  },
  {
    "code": "22591",
    "name": "Phường Hòa Thắng",
    "type": "ward",
    "provinceCode": "56"
  },
  {
    "code": "22597",
    "name": "Xã Nam Ninh Hòa",
    "type": "commune",
    "provinceCode": "56"
  },
  {
    "code": "22552",
    "name": "Xã Tây Ninh Hòa",
    "type": "commune",
    "provinceCode": "56"
  },
  {
    "code": "22558",
    "name": "Xã Hòa Trí",
    "type": "commune",
    "provinceCode": "56"
  },
  {
    "code": "22504",
    "name": "Xã Đại Lãnh",
    "type": "commune",
    "provinceCode": "56"
  },
  {
    "code": "22498",
    "name": "Xã Tu Bông",
    "type": "commune",
    "provinceCode": "56"
  },
  {
    "code": "22516",
    "name": "Xã Vạn Thắng",
    "type": "commune",
    "provinceCode": "56"
  },
  {
    "code": "22489",
    "name": "Xã Vạn Ninh",
    "type": "commune",
    "provinceCode": "56"
  },
  {
    "code": "22525",
    "name": "Xã Vạn Hưng",
    "type": "commune",
    "provinceCode": "56"
  },
  {
    "code": "22651",
    "name": "Xã Diên Khánh",
    "type": "commune",
    "provinceCode": "56"
  },
  {
    "code": "22678",
    "name": "Xã Diên Lạc",
    "type": "commune",
    "provinceCode": "56"
  },
  {
    "code": "22657",
    "name": "Xã Diên Điền",
    "type": "commune",
    "provinceCode": "56"
  },
  {
    "code": "22660",
    "name": "Xã Diên Lâm",
    "type": "commune",
    "provinceCode": "56"
  },
  {
    "code": "22672",
    "name": "Xã Diên Thọ",
    "type": "commune",
    "provinceCode": "56"
  },
  {
    "code": "22702",
    "name": "Xã Suối Hiệp",
    "type": "commune",
    "provinceCode": "56"
  },
  {
    "code": "22453",
    "name": "Xã Cam Lâm",
    "type": "commune",
    "provinceCode": "56"
  },
  {
    "code": "22708",
    "name": "Xã Suối Dầu",
    "type": "commune",
    "provinceCode": "56"
  },
  {
    "code": "22435",
    "name": "Xã Cam Hiệp",
    "type": "commune",
    "provinceCode": "56"
  },
  {
    "code": "22465",
    "name": "Xã Cam An",
    "type": "commune",
    "provinceCode": "56"
  },
  {
    "code": "22615",
    "name": "Xã Bắc Khánh Vĩnh",
    "type": "commune",
    "provinceCode": "56"
  },
  {
    "code": "22612",
    "name": "Xã Trung Khánh Vĩnh",
    "type": "commune",
    "provinceCode": "56"
  },
  {
    "code": "22624",
    "name": "Xã Tây Khánh Vĩnh",
    "type": "commune",
    "provinceCode": "56"
  },
  {
    "code": "22648",
    "name": "Xã Nam Khánh Vĩnh",
    "type": "commune",
    "provinceCode": "56"
  },
  {
    "code": "22609",
    "name": "Xã Khánh Vĩnh",
    "type": "commune",
    "provinceCode": "56"
  },
  {
    "code": "22714",
    "name": "Xã Khánh Sơn",
    "type": "commune",
    "provinceCode": "56"
  },
  {
    "code": "22720",
    "name": "Xã Tây Khánh Sơn",
    "type": "commune",
    "provinceCode": "56"
  },
  {
    "code": "22732",
    "name": "Xã Đông Khánh Sơn",
    "type": "commune",
    "provinceCode": "56"
  },
  {
    "code": "22736",
    "name": "Đặc khu Trường Sa",
    "type": "special_zone",
    "provinceCode": "56"
  },
  {
    "code": "22759",
    "name": "Phường Phan Rang",
    "type": "ward",
    "provinceCode": "56"
  },
  {
    "code": "22780",
    "name": "Phường Đông Hải",
    "type": "ward",
    "provinceCode": "56"
  },
  {
    "code": "22834",
    "name": "Phường Ninh Chử",
    "type": "ward",
    "provinceCode": "56"
  },
  {
    "code": "22741",
    "name": "Phường Bảo An",
    "type": "ward",
    "provinceCode": "56"
  },
  {
    "code": "22738",
    "name": "Phường Đô Vinh",
    "type": "ward",
    "provinceCode": "56"
  },
  {
    "code": "22870",
    "name": "Xã Ninh Phước",
    "type": "commune",
    "provinceCode": "56"
  },
  {
    "code": "22891",
    "name": "Xã Phước Hữu",
    "type": "commune",
    "provinceCode": "56"
  },
  {
    "code": "22873",
    "name": "Xã Phước Hậu",
    "type": "commune",
    "provinceCode": "56"
  },
  {
    "code": "22897",
    "name": "Xã Thuận Nam",
    "type": "commune",
    "provinceCode": "56"
  },
  {
    "code": "22909",
    "name": "Xã Cà Ná",
    "type": "commune",
    "provinceCode": "56"
  },
  {
    "code": "22900",
    "name": "Xã Phước Hà",
    "type": "commune",
    "provinceCode": "56"
  },
  {
    "code": "22888",
    "name": "Xã Phước Dinh",
    "type": "commune",
    "provinceCode": "56"
  },
  {
    "code": "22852",
    "name": "Xã Ninh Hải",
    "type": "commune",
    "provinceCode": "56"
  },
  {
    "code": "22861",
    "name": "Xã Xuân Hải",
    "type": "commune",
    "provinceCode": "56"
  },
  {
    "code": "22846",
    "name": "Xã Vĩnh Hải",
    "type": "commune",
    "provinceCode": "56"
  },
  {
    "code": "22849",
    "name": "Xã Thuận Bắc",
    "type": "commune",
    "provinceCode": "56"
  },
  {
    "code": "22840",
    "name": "Xã Công Hải",
    "type": "commune",
    "provinceCode": "56"
  },
  {
    "code": "22810",
    "name": "Xã Ninh Sơn",
    "type": "commune",
    "provinceCode": "56"
  },
  {
    "code": "22813",
    "name": "Xã Lâm Sơn",
    "type": "commune",
    "provinceCode": "56"
  },
  {
    "code": "22828",
    "name": "Xã Anh Dũng",
    "type": "commune",
    "provinceCode": "56"
  },
  {
    "code": "22822",
    "name": "Xã Mỹ Sơn",
    "type": "commune",
    "provinceCode": "56"
  },
  {
    "code": "22801",
    "name": "Xã Bác Ái Đông",
    "type": "commune",
    "provinceCode": "56"
  },
  {
    "code": "22795",
    "name": "Xã Bác Ái",
    "type": "commune",
    "provinceCode": "56"
  },
  {
    "code": "22786",
    "name": "Xã Bác Ái Tây",
    "type": "commune",
    "provinceCode": "56"
  },
  {
    "code": "24175",
    "name": "Xã Hòa Phú",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "24133",
    "name": "Phường Buôn Ma Thuột",
    "type": "ward",
    "provinceCode": "66"
  },
  {
    "code": "24163",
    "name": "Phường Tân An",
    "type": "ward",
    "provinceCode": "66"
  },
  {
    "code": "24121",
    "name": "Phường Tân Lập",
    "type": "ward",
    "provinceCode": "66"
  },
  {
    "code": "24154",
    "name": "Phường Thành Nhất",
    "type": "ward",
    "provinceCode": "66"
  },
  {
    "code": "24169",
    "name": "Phường Ea Kao",
    "type": "ward",
    "provinceCode": "66"
  },
  {
    "code": "24328",
    "name": "Xã Ea Drông",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "24305",
    "name": "Phường Buôn Hồ",
    "type": "ward",
    "provinceCode": "66"
  },
  {
    "code": "24340",
    "name": "Phường Cư Bao",
    "type": "ward",
    "provinceCode": "66"
  },
  {
    "code": "24211",
    "name": "Xã Ea Súp",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "24217",
    "name": "Xã Ea Rốk",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "24229",
    "name": "Xã Ea Bung",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "24221",
    "name": "Xã Ia Rvê",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "24214",
    "name": "Xã Ia Lốp",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "24241",
    "name": "Xã Ea Wer",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "24250",
    "name": "Xã Ea Nuôl",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "24235",
    "name": "Xã Buôn Đôn",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "24265",
    "name": "Xã Ea Kiết",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "24286",
    "name": "Xã Ea M’Droh",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "24259",
    "name": "Xã Quảng Phú",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "24301",
    "name": "Xã Cuôr Đăng",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "24280",
    "name": "Xã Cư M’gar",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "24277",
    "name": "Xã Ea Tul",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "24316",
    "name": "Xã Pơng Drang",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "24310",
    "name": "Xã Krông Búk",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "24313",
    "name": "Xã Cư Pơng",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "24208",
    "name": "Xã Ea Khăl",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "24181",
    "name": "Xã Ea Drăng",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "24193",
    "name": "Xã Ea Wy",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "24184",
    "name": "Xã Ea H’Leo",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "24187",
    "name": "Xã Ea Hiao",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "24343",
    "name": "Xã Krông Năng",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "24346",
    "name": "Xã Dliê Ya",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "24352",
    "name": "Xã Tam Giang",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "24364",
    "name": "Xã Phú Xuân",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "24490",
    "name": "Xã Krông Pắc",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "24505",
    "name": "Xã Ea Knuếc",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "24526",
    "name": "Xã Tân Tiến",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "24502",
    "name": "Xã Ea Phê",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "24496",
    "name": "Xã Ea Kly",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "24529",
    "name": "Xã Vụ Bổn",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "24373",
    "name": "Xã Ea Kar",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "24403",
    "name": "Xã Ea Ô",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "24376",
    "name": "Xã Ea Knốp",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "24406",
    "name": "Xã Cư Yang",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "24400",
    "name": "Xã Ea Păl",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "24412",
    "name": "Xã M’Drắk",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "24433",
    "name": "Xã Ea Riêng",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "24436",
    "name": "Xã Cư M’ta",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "24444",
    "name": "Xã Krông Á",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "24415",
    "name": "Xã Cư Prao",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "24445",
    "name": "Xã Ea Trang",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "24472",
    "name": "Xã Hòa Sơn",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "24454",
    "name": "Xã Dang Kang",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "24448",
    "name": "Xã Krông Bông",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "24484",
    "name": "Xã Yang Mao",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "24478",
    "name": "Xã Cư Pui",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "24580",
    "name": "Xã Liên Sơn Lắk",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "24595",
    "name": "Xã Đắk Liêng",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "24607",
    "name": "Xã Nam Ka",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "24598",
    "name": "Xã Đắk Phơi",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "24604",
    "name": "Xã Krông Nô",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "24540",
    "name": "Xã Ea Ning",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "24561",
    "name": "Xã Dray Bhăng",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "24544",
    "name": "Xã Ea Ktur",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "24538",
    "name": "Xã Krông Ana",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "24568",
    "name": "Xã Dur Kmăl",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "24559",
    "name": "Xã Ea Na",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "22015",
    "name": "Phường Tuy Hòa",
    "type": "ward",
    "provinceCode": "66"
  },
  {
    "code": "22240",
    "name": "Phường Phú Yên",
    "type": "ward",
    "provinceCode": "66"
  },
  {
    "code": "22045",
    "name": "Phường Bình Kiến",
    "type": "ward",
    "provinceCode": "66"
  },
  {
    "code": "22075",
    "name": "Xã Xuân Thọ",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "22060",
    "name": "Xã Xuân Cảnh",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "22057",
    "name": "Xã Xuân Lộc",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "22076",
    "name": "Phường Xuân Đài",
    "type": "ward",
    "provinceCode": "66"
  },
  {
    "code": "22051",
    "name": "Phường Sông Cầu",
    "type": "ward",
    "provinceCode": "66"
  },
  {
    "code": "22291",
    "name": "Xã Hòa Xuân",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "22258",
    "name": "Phường Đông Hòa",
    "type": "ward",
    "provinceCode": "66"
  },
  {
    "code": "22261",
    "name": "Phường Hòa Hiệp",
    "type": "ward",
    "provinceCode": "66"
  },
  {
    "code": "22114",
    "name": "Xã Tuy An Bắc",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "22120",
    "name": "Xã Tuy An Đông",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "22147",
    "name": "Xã Ô Loan",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "22153",
    "name": "Xã Tuy An Nam",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "22132",
    "name": "Xã Tuy An Tây",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "22319",
    "name": "Xã Phú Hòa 1",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "22303",
    "name": "Xã Phú Hòa 2",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "22255",
    "name": "Xã Tây Hòa",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "22276",
    "name": "Xã Hòa Thịnh",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "22285",
    "name": "Xã Hòa Mỹ",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "22250",
    "name": "Xã Sơn Thành",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "22165",
    "name": "Xã Sơn Hòa",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "22177",
    "name": "Xã Vân Hòa",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "22171",
    "name": "Xã Tây Sơn",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "22192",
    "name": "Xã Suối Trai",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "22237",
    "name": "Xã Ea Ly",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "22225",
    "name": "Xã Ea Bá",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "22222",
    "name": "Xã Đức Bình",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "22207",
    "name": "Xã Sông Hinh",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "22090",
    "name": "Xã Xuân Lãnh",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "22096",
    "name": "Xã Phú Mỡ",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "22111",
    "name": "Xã Xuân Phước",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "22081",
    "name": "Xã Đồng Xuân",
    "type": "commune",
    "provinceCode": "66"
  },
  {
    "code": "24781",
    "name": "Phường Xuân Hương - Đà Lạt",
    "type": "ward",
    "provinceCode": "68"
  },
  {
    "code": "24787",
    "name": "Phường Cam Ly - Đà Lạt",
    "type": "ward",
    "provinceCode": "68"
  },
  {
    "code": "24778",
    "name": "Phường Lâm Viên - Đà Lạt",
    "type": "ward",
    "provinceCode": "68"
  },
  {
    "code": "24805",
    "name": "Phường Xuân Trường - Đà Lạt",
    "type": "ward",
    "provinceCode": "68"
  },
  {
    "code": "24846",
    "name": "Phường Lang Biang - Đà Lạt",
    "type": "ward",
    "provinceCode": "68"
  },
  {
    "code": "24823",
    "name": "Phường 1 Bảo Lộc",
    "type": "ward",
    "provinceCode": "68"
  },
  {
    "code": "24820",
    "name": "Phường 2 Bảo Lộc",
    "type": "ward",
    "provinceCode": "68"
  },
  {
    "code": "24841",
    "name": "Phường 3 Bảo Lộc",
    "type": "ward",
    "provinceCode": "68"
  },
  {
    "code": "24829",
    "name": "Phường B'Lao",
    "type": "ward",
    "provinceCode": "68"
  },
  {
    "code": "24848",
    "name": "Xã Lạc Dương",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "24931",
    "name": "Xã Đơn Dương",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "24943",
    "name": "Xã Ka Đô",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "24955",
    "name": "Xã Quảng Lập",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "24934",
    "name": "Xã D'Ran",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "24967",
    "name": "Xã Hiệp Thạnh",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "24958",
    "name": "Xã Đức Trọng",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "24976",
    "name": "Xã Tân Hội",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "24991",
    "name": "Xã Tà Hine",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "24988",
    "name": "Xã Tà Năng",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "24871",
    "name": "Xã Đinh Văn Lâm Hà",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "24895",
    "name": "Xã Phú Sơn Lâm Hà",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "24883",
    "name": "Xã Nam Hà Lâm Hà",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "24868",
    "name": "Xã Nam Ban Lâm Hà",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "24916",
    "name": "Xã Tân Hà Lâm Hà",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "24907",
    "name": "Xã Phúc Thọ Lâm Hà",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "24886",
    "name": "Xã Đam Rông 1",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "24877",
    "name": "Xã Đam Rông 2",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "24875",
    "name": "Xã Đam Rông 3",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "24853",
    "name": "Xã Đam Rông 4",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "25000",
    "name": "Xã Di Linh",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "25036",
    "name": "Xã Hòa Ninh",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "25042",
    "name": "Xã Hòa Bắc",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "25007",
    "name": "Xã Đinh Trang Thượng",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "25018",
    "name": "Xã Bảo Thuận",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "25051",
    "name": "Xã Sơn Điền",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "25015",
    "name": "Xã Gia Hiệp",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "25054",
    "name": "Xã Bảo Lâm 1",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "25084",
    "name": "Xã Bảo Lâm 2",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "25093",
    "name": "Xã Bảo Lâm 3",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "25063",
    "name": "Xã Bảo Lâm 4",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "25057",
    "name": "Xã Bảo Lâm 5",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "25099",
    "name": "Xã Đạ Huoai",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "25105",
    "name": "Xã Đạ Huoai 2",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "25114",
    "name": "Xã Đạ Huoai 3",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "25126",
    "name": "Xã Đạ Tẻh",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "25138",
    "name": "Xã Đạ Tẻh 2",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "25135",
    "name": "Xã Đạ Tẻh 3",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "25159",
    "name": "Xã Cát Tiên",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "25180",
    "name": "Xã Cát Tiên 2",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "25162",
    "name": "Xã Cát Tiên 3",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "22933",
    "name": "Phường Hàm Thắng",
    "type": "ward",
    "provinceCode": "68"
  },
  {
    "code": "22960",
    "name": "Phường Bình Thuận",
    "type": "ward",
    "provinceCode": "68"
  },
  {
    "code": "22918",
    "name": "Phường Mũi Né",
    "type": "ward",
    "provinceCode": "68"
  },
  {
    "code": "22924",
    "name": "Phường Phú Thủy",
    "type": "ward",
    "provinceCode": "68"
  },
  {
    "code": "22945",
    "name": "Phường Phan Thiết",
    "type": "ward",
    "provinceCode": "68"
  },
  {
    "code": "22954",
    "name": "Phường Tiến Thành",
    "type": "ward",
    "provinceCode": "68"
  },
  {
    "code": "23235",
    "name": "Phường La Gi",
    "type": "ward",
    "provinceCode": "68"
  },
  {
    "code": "23231",
    "name": "Phường Phước Hội",
    "type": "ward",
    "provinceCode": "68"
  },
  {
    "code": "22963",
    "name": "Xã Tuyên Quang",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "23246",
    "name": "Xã Tân Hải",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "22981",
    "name": "Xã Vĩnh Hảo",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "22969",
    "name": "Xã Liên Hương",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "22978",
    "name": "Xã Tuy Phong",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "22972",
    "name": "Xã Phan Rí Cửa",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "23005",
    "name": "Xã Bắc Bình",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "23041",
    "name": "Xã Hồng Thái",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "23020",
    "name": "Xã Hải Ninh",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "23008",
    "name": "Xã Phan Sơn",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "23023",
    "name": "Xã Sông Lũy",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "23032",
    "name": "Xã Lương Sơn",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "23053",
    "name": "Xã Hòa Thắng",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "23074",
    "name": "Xã Đông Giang",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "23065",
    "name": "Xã La Dạ",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "23089",
    "name": "Xã Hàm Thuận Bắc",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "23059",
    "name": "Xã Hàm Thuận",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "23086",
    "name": "Xã Hồng Sơn",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "23095",
    "name": "Xã Hàm Liêm",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "23122",
    "name": "Xã Hàm Thạnh",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "23128",
    "name": "Xã Hàm Kiệm",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "23143",
    "name": "Xã Tân Thành",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "23110",
    "name": "Xã Hàm Thuận Nam",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "23134",
    "name": "Xã Tân Lập",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "23230",
    "name": "Xã Tân Minh",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "23236",
    "name": "Xã Hàm Tân",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "23266",
    "name": "Xã Sơn Mỹ",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "23152",
    "name": "Xã Bắc Ruộng",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "23158",
    "name": "Xã Nghị Đức",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "23173",
    "name": "Xã Đồng Kho",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "23149",
    "name": "Xã Tánh Linh",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "23188",
    "name": "Xã Suối Kiết",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "23200",
    "name": "Xã Nam Thành",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "23191",
    "name": "Xã Đức Linh",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "23194",
    "name": "Xã Hoài Đức",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "23227",
    "name": "Xã Trà Tân",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "23272",
    "name": "Đặc khu Phú Quý",
    "type": "special_zone",
    "provinceCode": "68"
  },
  {
    "code": "24611",
    "name": "Phường Bắc Gia Nghĩa",
    "type": "ward",
    "provinceCode": "68"
  },
  {
    "code": "24615",
    "name": "Phường Nam Gia Nghĩa",
    "type": "ward",
    "provinceCode": "68"
  },
  {
    "code": "24617",
    "name": "Phường Đông Gia Nghĩa",
    "type": "ward",
    "provinceCode": "68"
  },
  {
    "code": "24646",
    "name": "Xã Đắk Wil",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "24649",
    "name": "Xã Nam Dong",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "24640",
    "name": "Xã Cư Jút",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "24682",
    "name": "Xã Thuận An",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "24664",
    "name": "Xã Đức Lập",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "24670",
    "name": "Xã Đắk Mil",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "24678",
    "name": "Xã Đắk Sắk",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "24697",
    "name": "Xã Nam Đà",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "24688",
    "name": "Xã Krông Nô",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "24703",
    "name": "Xã Nâm Nung",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "24712",
    "name": "Xã Quảng Phú",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "24718",
    "name": "Xã Đắk Song",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "24717",
    "name": "Xã Đức An",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "24722",
    "name": "Xã Thuận Hạnh",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "24730",
    "name": "Xã Trường Xuân",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "24637",
    "name": "Xã Tà Đùng",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "24631",
    "name": "Xã Quảng Khê",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "24748",
    "name": "Xã Quảng Tân",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "24739",
    "name": "Xã Tuy Đức",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "24733",
    "name": "Xã Kiến Đức",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "24751",
    "name": "Xã Nhân Cơ",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "24760",
    "name": "Xã Quảng Tín",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "24985",
    "name": "Xã Ninh Gia",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "24620",
    "name": "Xã Quảng Hòa",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "24616",
    "name": "Xã Quảng Sơn",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "24736",
    "name": "Xã Quảng Trực",
    "type": "commune",
    "provinceCode": "68"
  },
  {
    "code": "26068",
    "name": "Phường Biên Hòa",
    "type": "ward",
    "provinceCode": "75"
  },
  {
    "code": "26041",
    "name": "Phường Trấn Biên",
    "type": "ward",
    "provinceCode": "75"
  },
  {
    "code": "26017",
    "name": "Phường Tam Hiệp",
    "type": "ward",
    "provinceCode": "75"
  },
  {
    "code": "26020",
    "name": "Phường Long Bình",
    "type": "ward",
    "provinceCode": "75"
  },
  {
    "code": "25993",
    "name": "Phường Trảng Dài",
    "type": "ward",
    "provinceCode": "75"
  },
  {
    "code": "26005",
    "name": "Phường Hố Nai",
    "type": "ward",
    "provinceCode": "75"
  },
  {
    "code": "26380",
    "name": "Phường Long Hưng",
    "type": "ward",
    "provinceCode": "75"
  },
  {
    "code": "26491",
    "name": "Xã Đại Phước",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "26485",
    "name": "Xã Nhơn Trạch",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "26503",
    "name": "Xã Phước An",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "26422",
    "name": "Xã Phước Thái",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "26413",
    "name": "Xã Long Phước",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "26389",
    "name": "Xã Bình An",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "26368",
    "name": "Xã Long Thành",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "26383",
    "name": "Xã An Phước",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "26296",
    "name": "Xã An Viễn",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "26278",
    "name": "Xã Bình Minh",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "26248",
    "name": "Xã Trảng Bom",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "26254",
    "name": "Xã Bàu Hàm",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "26281",
    "name": "Xã Hưng Thịnh",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "26326",
    "name": "Xã Dầu Giây",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "26311",
    "name": "Xã Gia Kiệm",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "26299",
    "name": "Xã Thống Nhất",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "26089",
    "name": "Phường Bình Lộc",
    "type": "ward",
    "provinceCode": "75"
  },
  {
    "code": "26098",
    "name": "Phường Bảo Vinh",
    "type": "ward",
    "provinceCode": "75"
  },
  {
    "code": "26104",
    "name": "Phường Xuân Lập",
    "type": "ward",
    "provinceCode": "75"
  },
  {
    "code": "26080",
    "name": "Phường Long Khánh",
    "type": "ward",
    "provinceCode": "75"
  },
  {
    "code": "26113",
    "name": "Phường Hàng Gòn",
    "type": "ward",
    "provinceCode": "75"
  },
  {
    "code": "26332",
    "name": "Xã Xuân Quế",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "26347",
    "name": "Xã Xuân Đường",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "26341",
    "name": "Xã Cẩm Mỹ",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "26362",
    "name": "Xã Sông Ray",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "26359",
    "name": "Xã Xuân Đông",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "26461",
    "name": "Xã Xuân Định",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "26458",
    "name": "Xã Xuân Phú",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "26425",
    "name": "Xã Xuân Lộc",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "26446",
    "name": "Xã Xuân Hòa",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "26434",
    "name": "Xã Xuân Thành",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "26428",
    "name": "Xã Xuân Bắc",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "26227",
    "name": "Xã La Ngà",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "26206",
    "name": "Xã Định Quán",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "26215",
    "name": "Xã Phú Vinh",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "26221",
    "name": "Xã Phú Hòa",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "26134",
    "name": "Xã Tà Lài",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "26122",
    "name": "Xã Nam Cát Tiên",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "26116",
    "name": "Xã Tân Phú",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "26158",
    "name": "Xã Phú Lâm",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "26170",
    "name": "Xã Trị An",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "26179",
    "name": "Xã Tân An",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "26188",
    "name": "Phường Tân Triều",
    "type": "ward",
    "provinceCode": "75"
  },
  {
    "code": "25441",
    "name": "Phường Minh Hưng",
    "type": "ward",
    "provinceCode": "75"
  },
  {
    "code": "25432",
    "name": "Phường Chơn Thành",
    "type": "ward",
    "provinceCode": "75"
  },
  {
    "code": "25450",
    "name": "Xã Nha Bích",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "25351",
    "name": "Xã Tân Quan",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "25345",
    "name": "Xã Tân Hưng",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "25357",
    "name": "Xã Tân Khai",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "25349",
    "name": "Xã Minh Đức",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "25326",
    "name": "Phường Bình Long",
    "type": "ward",
    "provinceCode": "75"
  },
  {
    "code": "25333",
    "name": "Phường An Lộc",
    "type": "ward",
    "provinceCode": "75"
  },
  {
    "code": "25294",
    "name": "Xã Lộc Thành",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "25270",
    "name": "Xã Lộc Ninh",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "25303",
    "name": "Xã Lộc Hưng",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "25279",
    "name": "Xã Lộc Tấn",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "25280",
    "name": "Xã Lộc Thạnh",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "25292",
    "name": "Xã Lộc Quang",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "25318",
    "name": "Xã Tân Tiến",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "25308",
    "name": "Xã Thiện Hưng",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "25309",
    "name": "Xã Hưng Phước",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "25267",
    "name": "Xã Phú Nghĩa",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "25231",
    "name": "Xã Đa Kia",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "25220",
    "name": "Phường Phước Bình",
    "type": "ward",
    "provinceCode": "75"
  },
  {
    "code": "25217",
    "name": "Phường Phước Long",
    "type": "ward",
    "provinceCode": "75"
  },
  {
    "code": "25246",
    "name": "Xã Bình Tân",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "25255",
    "name": "Xã Long Hà",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "25252",
    "name": "Xã Phú Riềng",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "25261",
    "name": "Xã Phú Trung",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "25210",
    "name": "Phường Đồng Xoài",
    "type": "ward",
    "provinceCode": "75"
  },
  {
    "code": "25195",
    "name": "Phường Bình Phước",
    "type": "ward",
    "provinceCode": "75"
  },
  {
    "code": "25387",
    "name": "Xã Thuận Lợi",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "25390",
    "name": "Xã Đồng Tâm",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "25378",
    "name": "Xã Tân Lợi",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "25363",
    "name": "Xã Đồng Phú",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "25420",
    "name": "Xã Phước Sơn",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "25417",
    "name": "Xã Nghĩa Trung",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "25396",
    "name": "Xã Bù Đăng",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "25402",
    "name": "Xã Thọ Sơn",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "25399",
    "name": "Xã Đak Nhau",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "25405",
    "name": "Xã Bom Bo",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "26374",
    "name": "Phường Tam Phước",
    "type": "ward",
    "provinceCode": "75"
  },
  {
    "code": "26377",
    "name": "Phường Phước Tân",
    "type": "ward",
    "provinceCode": "75"
  },
  {
    "code": "26209",
    "name": "Xã Thanh Sơn",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "26119",
    "name": "Xã Đak Lua",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "26173",
    "name": "Xã Phú Lý",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "25222",
    "name": "Xã Bù Gia Mập",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "25225",
    "name": "Xã Đăk Ơ",
    "type": "commune",
    "provinceCode": "75"
  },
  {
    "code": "26506",
    "name": "Phường Vũng Tàu",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "26526",
    "name": "Phường Tam Thắng",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "26536",
    "name": "Phường Rạch Dừa",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "26542",
    "name": "Phường Phước Thắng",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "26560",
    "name": "Phường Bà Rịa",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "26566",
    "name": "Phường Long Hương",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "26704",
    "name": "Phường Phú Mỹ",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "26572",
    "name": "Phường Tam Long",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "26725",
    "name": "Phường Tân Thành",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "26713",
    "name": "Phường Tân Phước",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "26710",
    "name": "Phường Tân Hải",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "26728",
    "name": "Xã Châu Pha",
    "type": "commune",
    "provinceCode": "79"
  },
  {
    "code": "26575",
    "name": "Xã Ngãi Giao",
    "type": "commune",
    "provinceCode": "79"
  },
  {
    "code": "26590",
    "name": "Xã Bình Giã",
    "type": "commune",
    "provinceCode": "79"
  },
  {
    "code": "26608",
    "name": "Xã Kim Long",
    "type": "commune",
    "provinceCode": "79"
  },
  {
    "code": "26596",
    "name": "Xã Châu Đức",
    "type": "commune",
    "provinceCode": "79"
  },
  {
    "code": "26584",
    "name": "Xã Xuân Sơn",
    "type": "commune",
    "provinceCode": "79"
  },
  {
    "code": "26617",
    "name": "Xã Nghĩa Thành",
    "type": "commune",
    "provinceCode": "79"
  },
  {
    "code": "26620",
    "name": "Xã Hồ Tràm",
    "type": "commune",
    "provinceCode": "79"
  },
  {
    "code": "26632",
    "name": "Xã Xuyên Mộc",
    "type": "commune",
    "provinceCode": "79"
  },
  {
    "code": "26641",
    "name": "Xã Hòa Hội",
    "type": "commune",
    "provinceCode": "79"
  },
  {
    "code": "26638",
    "name": "Xã Bàu Lâm",
    "type": "commune",
    "provinceCode": "79"
  },
  {
    "code": "26686",
    "name": "Xã Phước Hải",
    "type": "commune",
    "provinceCode": "79"
  },
  {
    "code": "26662",
    "name": "Xã Long Hải",
    "type": "commune",
    "provinceCode": "79"
  },
  {
    "code": "26680",
    "name": "Xã Đất Đỏ",
    "type": "commune",
    "provinceCode": "79"
  },
  {
    "code": "26659",
    "name": "Xã Long Điền",
    "type": "commune",
    "provinceCode": "79"
  },
  {
    "code": "26732",
    "name": "Đặc khu Côn Đảo",
    "type": "special_zone",
    "provinceCode": "79"
  },
  {
    "code": "25951",
    "name": "Phường Đông Hòa",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "25942",
    "name": "Phường Dĩ An",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "25945",
    "name": "Phường Tân Đông Hiệp",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "25978",
    "name": "Phường Thuận An",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "25969",
    "name": "Phường Thuận Giao",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "25987",
    "name": "Phường Bình Hòa",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "25966",
    "name": "Phường Lái Thiêu",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "25975",
    "name": "Phường An Phú",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "25760",
    "name": "Phường Bình Dương",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "25771",
    "name": "Phường Chánh Hiệp",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "25747",
    "name": "Phường Thủ Dầu Một",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "25750",
    "name": "Phường Phú Lợi",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "25912",
    "name": "Phường Vĩnh Tân",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "25915",
    "name": "Phường Bình Cơ",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "25888",
    "name": "Phường Tân Uyên",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "25920",
    "name": "Phường Tân Hiệp",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "25891",
    "name": "Phường Tân Khánh",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "25849",
    "name": "Phường Hòa Lợi",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "25768",
    "name": "Phường Phú An",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "25843",
    "name": "Phường Tây Nam",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "25840",
    "name": "Phường Long Nguyên",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "25813",
    "name": "Phường Bến Cát",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "25837",
    "name": "Phường Chánh Phú Hòa",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "25906",
    "name": "Xã Bắc Tân Uyên",
    "type": "commune",
    "provinceCode": "79"
  },
  {
    "code": "25909",
    "name": "Xã Thường Tân",
    "type": "commune",
    "provinceCode": "79"
  },
  {
    "code": "25867",
    "name": "Xã An Long",
    "type": "commune",
    "provinceCode": "79"
  },
  {
    "code": "25864",
    "name": "Xã Phước Thành",
    "type": "commune",
    "provinceCode": "79"
  },
  {
    "code": "25882",
    "name": "Xã Phước Hòa",
    "type": "commune",
    "provinceCode": "79"
  },
  {
    "code": "25858",
    "name": "Xã Phú Giáo",
    "type": "commune",
    "provinceCode": "79"
  },
  {
    "code": "25819",
    "name": "Xã Trừ Văn Thố",
    "type": "commune",
    "provinceCode": "79"
  },
  {
    "code": "25822",
    "name": "Xã Bàu Bàng",
    "type": "commune",
    "provinceCode": "79"
  },
  {
    "code": "25780",
    "name": "Xã Minh Thạnh",
    "type": "commune",
    "provinceCode": "79"
  },
  {
    "code": "25792",
    "name": "Xã Long Hòa",
    "type": "commune",
    "provinceCode": "79"
  },
  {
    "code": "25777",
    "name": "Xã Dầu Tiếng",
    "type": "commune",
    "provinceCode": "79"
  },
  {
    "code": "25807",
    "name": "Xã Thanh An",
    "type": "commune",
    "provinceCode": "79"
  },
  {
    "code": "26740",
    "name": "Phường Sài Gòn",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "26737",
    "name": "Phường Tân Định",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "26743",
    "name": "Phường Bến Thành",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "26758",
    "name": "Phường Cầu Ông Lãnh",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "27154",
    "name": "Phường Bàn Cờ",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "27139",
    "name": "Phường Xuân Hòa",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "27142",
    "name": "Phường Nhiêu Lộc",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "27259",
    "name": "Phường Xóm Chiếu",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "27265",
    "name": "Phường Khánh Hội",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "27286",
    "name": "Phường Vĩnh Hội",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "27301",
    "name": "Phường Chợ Quán",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "27316",
    "name": "Phường An Đông",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "27343",
    "name": "Phường Chợ Lớn",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "27367",
    "name": "Phường Bình Tây",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "27373",
    "name": "Phường Bình Tiên",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "27364",
    "name": "Phường Bình Phú",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "27349",
    "name": "Phường Phú Lâm",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "27478",
    "name": "Phường Tân Thuận",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "27484",
    "name": "Phường Phú Thuận",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "27487",
    "name": "Phường Tân Mỹ",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "27475",
    "name": "Phường Tân Hưng",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "27418",
    "name": "Phường Chánh Hưng",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "27427",
    "name": "Phường Phú Định",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "27424",
    "name": "Phường Bình Đông",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "27169",
    "name": "Phường Diên Hồng",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "27190",
    "name": "Phường Vườn Lài",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "27163",
    "name": "Phường Hòa Hưng",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "27238",
    "name": "Phường Minh Phụng",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "27232",
    "name": "Phường Bình Thới",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "27211",
    "name": "Phường Hòa Bình",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "27226",
    "name": "Phường Phú Thọ",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "26791",
    "name": "Phường Đông Hưng Thuận",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "26785",
    "name": "Phường Trung Mỹ Tây",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "26782",
    "name": "Phường Tân Thới Hiệp",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "26773",
    "name": "Phường Thới An",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "26767",
    "name": "Phường An Phú Đông",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "27460",
    "name": "Phường An Lạc",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "27457",
    "name": "Phường Tân Tạo",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "27442",
    "name": "Phường Bình Tân",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "27448",
    "name": "Phường Bình Trị Đông",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "27439",
    "name": "Phường Bình Hưng Hòa",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "26944",
    "name": "Phường Gia Định",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "26929",
    "name": "Phường Bình Thạnh",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "26905",
    "name": "Phường Bình Lợi Trung",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "26956",
    "name": "Phường Thạnh Mỹ Tây",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "26911",
    "name": "Phường Bình Quới",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "26890",
    "name": "Phường Hạnh Thông",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "26876",
    "name": "Phường An Nhơn",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "26884",
    "name": "Phường Gò Vấp",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "26878",
    "name": "Phường An Hội Đông",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "26898",
    "name": "Phường Thông Tây Hội",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "26882",
    "name": "Phường An Hội Tây",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "27043",
    "name": "Phường Đức Nhuận",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "27058",
    "name": "Phường Cầu Kiệu",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "27073",
    "name": "Phường Phú Nhuận",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "26977",
    "name": "Phường Tân Sơn Hòa",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "26968",
    "name": "Phường Tân Sơn Nhất",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "26995",
    "name": "Phường Tân Hòa",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "26983",
    "name": "Phường Bảy Hiền",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "27004",
    "name": "Phường Tân Bình",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "27007",
    "name": "Phường Tân Sơn",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "27013",
    "name": "Phường Tây Thạnh",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "27019",
    "name": "Phường Tân Sơn Nhì",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "27022",
    "name": "Phường Phú Thọ Hòa",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "27031",
    "name": "Phường Tân Phú",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "27028",
    "name": "Phường Phú Thạnh",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "26809",
    "name": "Phường Hiệp Bình",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "26824",
    "name": "Phường Thủ Đức",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "26803",
    "name": "Phường Tam Bình",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "26800",
    "name": "Phường Linh Xuân",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "26842",
    "name": "Phường Tăng Nhơn Phú",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "26833",
    "name": "Phường Long Bình",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "26857",
    "name": "Phường Long Phước",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "26860",
    "name": "Phường Long Trường",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "27112",
    "name": "Phường Cát Lái",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "27097",
    "name": "Phường Bình Trưng",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "26848",
    "name": "Phường Phước Long",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "27094",
    "name": "Phường An Khánh",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "27601",
    "name": "Xã Vĩnh Lộc",
    "type": "commune",
    "provinceCode": "79"
  },
  {
    "code": "27604",
    "name": "Xã Tân Vĩnh Lộc",
    "type": "commune",
    "provinceCode": "79"
  },
  {
    "code": "27610",
    "name": "Xã Bình Lợi",
    "type": "commune",
    "provinceCode": "79"
  },
  {
    "code": "27595",
    "name": "Xã Tân Nhựt",
    "type": "commune",
    "provinceCode": "79"
  },
  {
    "code": "27637",
    "name": "Xã Bình Chánh",
    "type": "commune",
    "provinceCode": "79"
  },
  {
    "code": "27628",
    "name": "Xã Hưng Long",
    "type": "commune",
    "provinceCode": "79"
  },
  {
    "code": "27619",
    "name": "Xã Bình Hưng",
    "type": "commune",
    "provinceCode": "79"
  },
  {
    "code": "27667",
    "name": "Xã Bình Khánh",
    "type": "commune",
    "provinceCode": "79"
  },
  {
    "code": "27673",
    "name": "Xã An Thới Đông",
    "type": "commune",
    "provinceCode": "79"
  },
  {
    "code": "27664",
    "name": "Xã Cần Giờ",
    "type": "commune",
    "provinceCode": "79"
  },
  {
    "code": "27553",
    "name": "Xã Củ Chi",
    "type": "commune",
    "provinceCode": "79"
  },
  {
    "code": "27496",
    "name": "Xã Tân An Hội",
    "type": "commune",
    "provinceCode": "79"
  },
  {
    "code": "27526",
    "name": "Xã Thái Mỹ",
    "type": "commune",
    "provinceCode": "79"
  },
  {
    "code": "27508",
    "name": "Xã An Nhơn Tây",
    "type": "commune",
    "provinceCode": "79"
  },
  {
    "code": "27511",
    "name": "Xã Nhuận Đức",
    "type": "commune",
    "provinceCode": "79"
  },
  {
    "code": "27541",
    "name": "Xã Phú Hòa Đông",
    "type": "commune",
    "provinceCode": "79"
  },
  {
    "code": "27544",
    "name": "Xã Bình Mỹ",
    "type": "commune",
    "provinceCode": "79"
  },
  {
    "code": "27568",
    "name": "Xã Đông Thạnh",
    "type": "commune",
    "provinceCode": "79"
  },
  {
    "code": "27559",
    "name": "Xã Hóc Môn",
    "type": "commune",
    "provinceCode": "79"
  },
  {
    "code": "27577",
    "name": "Xã Xuân Thới Sơn",
    "type": "commune",
    "provinceCode": "79"
  },
  {
    "code": "27592",
    "name": "Xã Bà Điểm",
    "type": "commune",
    "provinceCode": "79"
  },
  {
    "code": "27655",
    "name": "Xã Nhà Bè",
    "type": "commune",
    "provinceCode": "79"
  },
  {
    "code": "27658",
    "name": "Xã Hiệp Phước",
    "type": "commune",
    "provinceCode": "79"
  },
  {
    "code": "26545",
    "name": "Xã Long Sơn",
    "type": "commune",
    "provinceCode": "79"
  },
  {
    "code": "26647",
    "name": "Xã Hòa Hiệp",
    "type": "commune",
    "provinceCode": "79"
  },
  {
    "code": "26656",
    "name": "Xã Bình Châu",
    "type": "commune",
    "provinceCode": "79"
  },
  {
    "code": "25846",
    "name": "Phường Thới Hòa",
    "type": "ward",
    "provinceCode": "79"
  },
  {
    "code": "27676",
    "name": "Xã Thạnh An",
    "type": "commune",
    "provinceCode": "79"
  },
  {
    "code": "27727",
    "name": "Xã Hưng Điền",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "27736",
    "name": "Xã Vĩnh Thạnh",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "27721",
    "name": "Xã Tân Hưng",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "27748",
    "name": "Xã Vĩnh Châu",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "27775",
    "name": "Xã Tuyên Bình",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "27757",
    "name": "Xã Vĩnh Hưng",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "27763",
    "name": "Xã Khánh Hưng",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "27817",
    "name": "Xã Tuyên Thạnh",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "27793",
    "name": "Xã Bình Hiệp",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "27787",
    "name": "Phường Kiến Tường",
    "type": "ward",
    "provinceCode": "80"
  },
  {
    "code": "27811",
    "name": "Xã Bình Hòa",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "27823",
    "name": "Xã Mộc Hóa",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "27841",
    "name": "Xã Hậu Thạnh",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "27838",
    "name": "Xã Nhơn Hòa Lập",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "27856",
    "name": "Xã Nhơn Ninh",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "27826",
    "name": "Xã Tân Thạnh",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "27868",
    "name": "Xã Bình Thành",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "27877",
    "name": "Xã Thạnh Phước",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "27865",
    "name": "Xã Thạnh Hóa",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "27889",
    "name": "Xã Tân Tây",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "28036",
    "name": "Xã Thủ Thừa",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "28066",
    "name": "Xã Mỹ An",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "28051",
    "name": "Xã Mỹ Thạnh",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "28072",
    "name": "Xã Tân Long",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "27907",
    "name": "Xã Mỹ Quý",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "27898",
    "name": "Xã Đông Thành",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "27925",
    "name": "Xã Đức Huệ",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "27943",
    "name": "Xã An Ninh",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "27952",
    "name": "Xã Hiệp Hòa",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "27931",
    "name": "Xã Hậu Nghĩa",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "27979",
    "name": "Xã Hòa Khánh",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "27964",
    "name": "Xã Đức Lập",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "27976",
    "name": "Xã Mỹ Hạnh",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "27937",
    "name": "Xã Đức Hòa",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "27994",
    "name": "Xã Thạnh Lợi",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "28015",
    "name": "Xã Bình Đức",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "28003",
    "name": "Xã Lương Hòa",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "27991",
    "name": "Xã Bến Lức",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "28018",
    "name": "Xã Mỹ Yên",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "28126",
    "name": "Xã Long Cang",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "28114",
    "name": "Xã Rạch Kiến",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "28132",
    "name": "Xã Mỹ Lệ",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "28138",
    "name": "Xã Tân Lân",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "28108",
    "name": "Xã Cần Đước",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "28144",
    "name": "Xã Long Hựu",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "28165",
    "name": "Xã Phước Lý",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "28177",
    "name": "Xã Mỹ Lộc",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "28159",
    "name": "Xã Cần Giuộc",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "28201",
    "name": "Xã Phước Vĩnh Tây",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "28207",
    "name": "Xã Tân Tập",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "28093",
    "name": "Xã Vàm Cỏ",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "28075",
    "name": "Xã Tân Trụ",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "28087",
    "name": "Xã Nhựt Tảo",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "28225",
    "name": "Xã Thuận Mỹ",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "28243",
    "name": "Xã An Lục Long",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "28210",
    "name": "Xã Tầm Vu",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "28222",
    "name": "Xã Vĩnh Công",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "27694",
    "name": "Phường Long An",
    "type": "ward",
    "provinceCode": "80"
  },
  {
    "code": "27712",
    "name": "Phường Tân An",
    "type": "ward",
    "provinceCode": "80"
  },
  {
    "code": "27715",
    "name": "Phường Khánh Hậu",
    "type": "ward",
    "provinceCode": "80"
  },
  {
    "code": "25459",
    "name": "Phường Tân Ninh",
    "type": "ward",
    "provinceCode": "80"
  },
  {
    "code": "25480",
    "name": "Phường Bình Minh",
    "type": "ward",
    "provinceCode": "80"
  },
  {
    "code": "25567",
    "name": "Phường Ninh Thạnh",
    "type": "ward",
    "provinceCode": "80"
  },
  {
    "code": "25630",
    "name": "Phường Long Hoa",
    "type": "ward",
    "provinceCode": "80"
  },
  {
    "code": "25645",
    "name": "Phường Hòa Thành",
    "type": "ward",
    "provinceCode": "80"
  },
  {
    "code": "25633",
    "name": "Phường Thanh Điền",
    "type": "ward",
    "provinceCode": "80"
  },
  {
    "code": "25708",
    "name": "Phường Trảng Bàng",
    "type": "ward",
    "provinceCode": "80"
  },
  {
    "code": "25732",
    "name": "Phường An Tịnh",
    "type": "ward",
    "provinceCode": "80"
  },
  {
    "code": "25654",
    "name": "Phường Gò Dầu",
    "type": "ward",
    "provinceCode": "80"
  },
  {
    "code": "25672",
    "name": "Phường Gia Lộc",
    "type": "ward",
    "provinceCode": "80"
  },
  {
    "code": "25711",
    "name": "Xã Hưng Thuận",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "25729",
    "name": "Xã Phước Chỉ",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "25657",
    "name": "Xã Thạnh Đức",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "25663",
    "name": "Xã Phước Thạnh",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "25666",
    "name": "Xã Truông Mít",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "25579",
    "name": "Xã Lộc Ninh",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "25573",
    "name": "Xã Cầu Khởi",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "25552",
    "name": "Xã Dương Minh Châu",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "25522",
    "name": "Xã Tân Đông",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "25516",
    "name": "Xã Tân Châu",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "25549",
    "name": "Xã Tân Phú",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "25525",
    "name": "Xã Tân Hội",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "25534",
    "name": "Xã Tân Thành",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "25531",
    "name": "Xã Tân Hòa",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "25489",
    "name": "Xã Tân Lập",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "25486",
    "name": "Xã Tân Biên",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "25498",
    "name": "Xã Thạnh Bình",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "25510",
    "name": "Xã Trà Vong",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "25591",
    "name": "Xã Phước Vinh",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "25606",
    "name": "Xã Hòa Hội",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "25621",
    "name": "Xã Ninh Điền",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "25585",
    "name": "Xã Châu Thành",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "25588",
    "name": "Xã Hảo Đước",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "25684",
    "name": "Xã Long Chữ",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "25702",
    "name": "Xã Long Thuận",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "25681",
    "name": "Xã Bến Cầu",
    "type": "commune",
    "provinceCode": "80"
  },
  {
    "code": "28261",
    "name": "Phường Mỹ Tho",
    "type": "ward",
    "provinceCode": "82"
  },
  {
    "code": "28249",
    "name": "Phường Đạo Thạnh",
    "type": "ward",
    "provinceCode": "82"
  },
  {
    "code": "28273",
    "name": "Phường Mỹ Phong",
    "type": "ward",
    "provinceCode": "82"
  },
  {
    "code": "28270",
    "name": "Phường Thới Sơn",
    "type": "ward",
    "provinceCode": "82"
  },
  {
    "code": "28285",
    "name": "Phường Trung An",
    "type": "ward",
    "provinceCode": "82"
  },
  {
    "code": "28306",
    "name": "Phường Gò Công",
    "type": "ward",
    "provinceCode": "82"
  },
  {
    "code": "28297",
    "name": "Phường Long Thuận",
    "type": "ward",
    "provinceCode": "82"
  },
  {
    "code": "28729",
    "name": "Phường Sơn Qui",
    "type": "ward",
    "provinceCode": "82"
  },
  {
    "code": "28315",
    "name": "Phường Bình Xuân",
    "type": "ward",
    "provinceCode": "82"
  },
  {
    "code": "28435",
    "name": "Phường Mỹ Phước Tây",
    "type": "ward",
    "provinceCode": "82"
  },
  {
    "code": "28436",
    "name": "Phường Thanh Hòa",
    "type": "ward",
    "provinceCode": "82"
  },
  {
    "code": "28439",
    "name": "Phường Cai Lậy",
    "type": "ward",
    "provinceCode": "82"
  },
  {
    "code": "28477",
    "name": "Phường Nhị Quý",
    "type": "ward",
    "provinceCode": "82"
  },
  {
    "code": "28468",
    "name": "Xã Tân Phú",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "28426",
    "name": "Xã Thanh Hưng",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "28429",
    "name": "Xã An Hữu",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "28414",
    "name": "Xã Mỹ Lợi",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "28405",
    "name": "Xã Mỹ Đức Tây",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "28378",
    "name": "Xã Mỹ Thiện",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "28366",
    "name": "Xã Hậu Mỹ",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "28393",
    "name": "Xã Hội Cư",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "28360",
    "name": "Xã Cái Bè",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "28471",
    "name": "Xã Bình Phú",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "28501",
    "name": "Xã Hiệp Đức",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "28516",
    "name": "Xã Ngũ Hiệp",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "28504",
    "name": "Xã Long Tiên",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "28456",
    "name": "Xã Mỹ Thành",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "28444",
    "name": "Xã Thạnh Phú",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "28321",
    "name": "Xã Tân Phước 1",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "28327",
    "name": "Xã Tân Phước 2",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "28345",
    "name": "Xã Tân Phước 3",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "28336",
    "name": "Xã Hưng Thạnh",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "28525",
    "name": "Xã Tân Hương",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "28519",
    "name": "Xã Châu Thành",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "28537",
    "name": "Xã Long Hưng",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "28543",
    "name": "Xã Long Định",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "28576",
    "name": "Xã Vĩnh Kim",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "28582",
    "name": "Xã Kim Sơn",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "28564",
    "name": "Xã Bình Trưng",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "28603",
    "name": "Xã Mỹ Tịnh An",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "28615",
    "name": "Xã Lương Hòa Lạc",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "28627",
    "name": "Xã Tân Thuận Bình",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "28594",
    "name": "Xã Chợ Gạo",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "28633",
    "name": "Xã An Thạnh Thủy",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "28648",
    "name": "Xã Bình Ninh",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "28651",
    "name": "Xã Vĩnh Bình",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "28660",
    "name": "Xã Đồng Sơn",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "28663",
    "name": "Xã Phú Thành",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "28687",
    "name": "Xã Long Bình",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "28678",
    "name": "Xã Vĩnh Hựu",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "28747",
    "name": "Xã Gò Công Đông",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "28738",
    "name": "Xã Tân Điền",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "28702",
    "name": "Xã Tân Hòa",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "28723",
    "name": "Xã Tân Đông",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "28720",
    "name": "Xã Gia Thuận",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "28693",
    "name": "Xã Tân Thới",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "28696",
    "name": "Xã Tân Phú Đông",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "29926",
    "name": "Xã Tân Hồng",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "29938",
    "name": "Xã Tân Thành",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "29929",
    "name": "Xã Tân Hộ Cơ",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "29944",
    "name": "Xã An Phước",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "29954",
    "name": "Phường An Bình",
    "type": "ward",
    "provinceCode": "82"
  },
  {
    "code": "29955",
    "name": "Phường Hồng Ngự",
    "type": "ward",
    "provinceCode": "82"
  },
  {
    "code": "29978",
    "name": "Phường Thường Lạc",
    "type": "ward",
    "provinceCode": "82"
  },
  {
    "code": "29971",
    "name": "Xã Thường Phước",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "29983",
    "name": "Xã Long Khánh",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "29992",
    "name": "Xã Long Phú Thuận",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "30019",
    "name": "Xã An Hòa",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "30010",
    "name": "Xã Tam Nông",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "30034",
    "name": "Xã Phú Thọ",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "30001",
    "name": "Xã Tràm Chim",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "30025",
    "name": "Xã Phú Cường",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "30028",
    "name": "Xã An Long",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "30130",
    "name": "Xã Thanh Bình",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "30157",
    "name": "Xã Tân Thạnh",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "30163",
    "name": "Xã Bình Thành",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "30154",
    "name": "Xã Tân Long",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "30037",
    "name": "Xã Tháp Mười",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "30073",
    "name": "Xã Thanh Mỹ",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "30055",
    "name": "Xã Mỹ Quí",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "30061",
    "name": "Xã Đốc Binh Kiều",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "30046",
    "name": "Xã Trường Xuân",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "30043",
    "name": "Xã Phương Thịnh",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "30088",
    "name": "Xã Phong Mỹ",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "30085",
    "name": "Xã Ba Sao",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "30076",
    "name": "Xã Mỹ Thọ",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "30118",
    "name": "Xã Bình Hàng Trung",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "30112",
    "name": "Xã Mỹ Hiệp",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "29869",
    "name": "Phường Cao Lãnh",
    "type": "ward",
    "provinceCode": "82"
  },
  {
    "code": "29884",
    "name": "Phường Mỹ Ngãi",
    "type": "ward",
    "provinceCode": "82"
  },
  {
    "code": "29888",
    "name": "Phường Mỹ Trà",
    "type": "ward",
    "provinceCode": "82"
  },
  {
    "code": "30178",
    "name": "Xã Mỹ An Hưng",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "30184",
    "name": "Xã Tân Khánh Trung",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "30169",
    "name": "Xã Lấp Vò",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "30226",
    "name": "Xã Lai Vung",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "30208",
    "name": "Xã Hòa Long",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "30235",
    "name": "Xã Phong Hòa",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "29905",
    "name": "Phường Sa Đéc",
    "type": "ward",
    "provinceCode": "82"
  },
  {
    "code": "30214",
    "name": "Xã Tân Dương",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "30244",
    "name": "Xã Phú Hựu",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "30253",
    "name": "Xã Tân Nhuận Đông",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "30259",
    "name": "Xã Tân Phú Trung",
    "type": "commune",
    "provinceCode": "82"
  },
  {
    "code": "29641",
    "name": "Xã Cái Nhum",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29653",
    "name": "Xã Tân Long Hội",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29623",
    "name": "Xã Nhơn Phú",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29638",
    "name": "Xã Bình Phước",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29584",
    "name": "Xã An Bình",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29602",
    "name": "Xã Long Hồ",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29611",
    "name": "Xã Phú Quới",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29590",
    "name": "Phường Thanh Đức",
    "type": "ward",
    "provinceCode": "86"
  },
  {
    "code": "29551",
    "name": "Phường Long Châu",
    "type": "ward",
    "provinceCode": "86"
  },
  {
    "code": "29557",
    "name": "Phường Phước Hậu",
    "type": "ward",
    "provinceCode": "86"
  },
  {
    "code": "29593",
    "name": "Phường Tân Hạnh",
    "type": "ward",
    "provinceCode": "86"
  },
  {
    "code": "29566",
    "name": "Phường Tân Ngãi",
    "type": "ward",
    "provinceCode": "86"
  },
  {
    "code": "29677",
    "name": "Xã Quới Thiện",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29659",
    "name": "Xã Trung Thành",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29698",
    "name": "Xã Trung Ngãi",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29668",
    "name": "Xã Quới An",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29683",
    "name": "Xã Trung Hiệp",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29701",
    "name": "Xã Hiếu Phụng",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29713",
    "name": "Xã Hiếu Thành",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29857",
    "name": "Xã Lục Sĩ Thành",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29821",
    "name": "Xã Trà Ôn",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29836",
    "name": "Xã Trà Côn",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29845",
    "name": "Xã Vĩnh Xuân",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29830",
    "name": "Xã Hòa Bình",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29734",
    "name": "Xã Hòa Hiệp",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29719",
    "name": "Xã Tam Bình",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29767",
    "name": "Xã Ngãi Tứ",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29740",
    "name": "Xã Song Phú",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29728",
    "name": "Xã Cái Ngang",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29800",
    "name": "Xã Tân Quới",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29785",
    "name": "Xã Tân Lược",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29788",
    "name": "Xã Mỹ Thuận",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29771",
    "name": "Phường Bình Minh",
    "type": "ward",
    "provinceCode": "86"
  },
  {
    "code": "29770",
    "name": "Phường Cái Vồn",
    "type": "ward",
    "provinceCode": "86"
  },
  {
    "code": "29812",
    "name": "Phường Đông Thành",
    "type": "ward",
    "provinceCode": "86"
  },
  {
    "code": "29263",
    "name": "Phường Long Đức",
    "type": "ward",
    "provinceCode": "86"
  },
  {
    "code": "29242",
    "name": "Phường Trà Vinh",
    "type": "ward",
    "provinceCode": "86"
  },
  {
    "code": "29254",
    "name": "Phường Nguyệt Hóa",
    "type": "ward",
    "provinceCode": "86"
  },
  {
    "code": "29398",
    "name": "Phường Hòa Thuận",
    "type": "ward",
    "provinceCode": "86"
  },
  {
    "code": "29275",
    "name": "Xã An Trường",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29278",
    "name": "Xã Tân An",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29266",
    "name": "Xã Càng Long",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29302",
    "name": "Xã Nhị Long",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29287",
    "name": "Xã Bình Phú",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29386",
    "name": "Xã Song Lộc",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29374",
    "name": "Xã Châu Thành",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29407",
    "name": "Xã Hưng Mỹ",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29410",
    "name": "Xã Hòa Minh",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29413",
    "name": "Xã Long Hòa",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29308",
    "name": "Xã Cầu Kè",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29329",
    "name": "Xã Phong Thạnh",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29317",
    "name": "Xã An Phú Tân",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29335",
    "name": "Xã Tam Ngãi",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29371",
    "name": "Xã Tân Hòa",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29362",
    "name": "Xã Hùng Hòa",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29341",
    "name": "Xã Tiểu Cần",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29365",
    "name": "Xã Tập Ngãi",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29419",
    "name": "Xã Mỹ Long",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29431",
    "name": "Xã Vinh Kim",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29416",
    "name": "Xã Cầu Ngang",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29446",
    "name": "Xã Nhị Trường",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29455",
    "name": "Xã Hiệp Mỹ",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29476",
    "name": "Xã Lưu Nghiệp Anh",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29491",
    "name": "Xã Đại An",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29489",
    "name": "Xã Hàm Giang",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29461",
    "name": "Xã Trà Cú",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29506",
    "name": "Xã Long Hiệp",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29467",
    "name": "Xã Tập Sơn",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29512",
    "name": "Phường Duyên Hải",
    "type": "ward",
    "provinceCode": "86"
  },
  {
    "code": "29516",
    "name": "Phường Trường Long Hòa",
    "type": "ward",
    "provinceCode": "86"
  },
  {
    "code": "29518",
    "name": "Xã Long Hữu",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29513",
    "name": "Xã Long Thành",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29536",
    "name": "Xã Đông Hải",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29533",
    "name": "Xã Long Vĩnh",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29497",
    "name": "Xã Đôn Châu",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29530",
    "name": "Xã Ngũ Lạc",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "28777",
    "name": "Phường An Hội",
    "type": "ward",
    "provinceCode": "86"
  },
  {
    "code": "28756",
    "name": "Phường Phú Khương",
    "type": "ward",
    "provinceCode": "86"
  },
  {
    "code": "28789",
    "name": "Phường Bến Tre",
    "type": "ward",
    "provinceCode": "86"
  },
  {
    "code": "28783",
    "name": "Phường Sơn Đông",
    "type": "ward",
    "provinceCode": "86"
  },
  {
    "code": "28858",
    "name": "Phường Phú Tân",
    "type": "ward",
    "provinceCode": "86"
  },
  {
    "code": "28810",
    "name": "Xã Phú Túc",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "28807",
    "name": "Xã Giao Long",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "28861",
    "name": "Xã Tiên Thủy",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "28840",
    "name": "Xã Tân Phú",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "28879",
    "name": "Xã Phú Phụng",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "28870",
    "name": "Xã Chợ Lách",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "28894",
    "name": "Xã Vĩnh Thành",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "28901",
    "name": "Xã Hưng Khánh Trung",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "28915",
    "name": "Xã Phước Mỹ Trung",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "28921",
    "name": "Xã Tân Thành Bình",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "28948",
    "name": "Xã Nhuận Phú Tân",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "28945",
    "name": "Xã Đồng Khởi",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "28903",
    "name": "Xã Mỏ Cày",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "28969",
    "name": "Xã Thành Thới",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "28957",
    "name": "Xã An Định",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "28981",
    "name": "Xã Hương Mỹ",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29194",
    "name": "Xã Đại Điền",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29191",
    "name": "Xã Quới Điền",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29182",
    "name": "Xã Thạnh Phú",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29224",
    "name": "Xã An Qui",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29221",
    "name": "Xã Thạnh Hải",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29227",
    "name": "Xã Thạnh Phong",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29167",
    "name": "Xã Tân Thủy",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29125",
    "name": "Xã Bảo Thạnh",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29110",
    "name": "Xã Ba Tri",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29137",
    "name": "Xã Tân Xuân",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29122",
    "name": "Xã Mỹ Chánh Hòa",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29143",
    "name": "Xã An Ngãi Trung",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29158",
    "name": "Xã An Hiệp",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29044",
    "name": "Xã Hưng Nhượng",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "28984",
    "name": "Xã Giồng Trôm",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29029",
    "name": "Xã Tân Hào",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29020",
    "name": "Xã Phước Long",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "28993",
    "name": "Xã Lương Phú",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "28996",
    "name": "Xã Châu Hòa",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "28987",
    "name": "Xã Lương Hòa",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29107",
    "name": "Xã Thới Thuận",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29104",
    "name": "Xã Thạnh Phước",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29050",
    "name": "Xã Bình Đại",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29089",
    "name": "Xã Thạnh Trị",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29077",
    "name": "Xã Lộc Thuận",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29083",
    "name": "Xã Châu Hưng",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "29062",
    "name": "Xã Phú Thuận",
    "type": "commune",
    "provinceCode": "86"
  },
  {
    "code": "30313",
    "name": "Xã Mỹ Hòa Hưng",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30307",
    "name": "Phường Long Xuyên",
    "type": "ward",
    "provinceCode": "91"
  },
  {
    "code": "30292",
    "name": "Phường Bình Đức",
    "type": "ward",
    "provinceCode": "91"
  },
  {
    "code": "30301",
    "name": "Phường Mỹ Thới",
    "type": "ward",
    "provinceCode": "91"
  },
  {
    "code": "30316",
    "name": "Phường Châu Đốc",
    "type": "ward",
    "provinceCode": "91"
  },
  {
    "code": "30325",
    "name": "Phường Vĩnh Tế",
    "type": "ward",
    "provinceCode": "91"
  },
  {
    "code": "30337",
    "name": "Xã An Phú",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30367",
    "name": "Xã Vĩnh Hậu",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30346",
    "name": "Xã Nhơn Hội",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30341",
    "name": "Xã Khánh Bình",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30352",
    "name": "Xã Phú Hữu",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30388",
    "name": "Xã Tân An",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30403",
    "name": "Xã Châu Phong",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30385",
    "name": "Xã Vĩnh Xương",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30376",
    "name": "Phường Tân Châu",
    "type": "ward",
    "provinceCode": "91"
  },
  {
    "code": "30377",
    "name": "Phường Long Phú",
    "type": "ward",
    "provinceCode": "91"
  },
  {
    "code": "30406",
    "name": "Xã Phú Tân",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30436",
    "name": "Xã Phú An",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30445",
    "name": "Xã Bình Thạnh Đông",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30409",
    "name": "Xã Chợ Vàm",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30430",
    "name": "Xã Hòa Lạc",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30421",
    "name": "Xã Phú Lâm",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30463",
    "name": "Xã Châu Phú",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30469",
    "name": "Xã Mỹ Đức",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30478",
    "name": "Xã Vĩnh Thạnh Trung",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30487",
    "name": "Xã Bình Mỹ",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30481",
    "name": "Xã Thạnh Mỹ Tây",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30526",
    "name": "Xã An Cư",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30538",
    "name": "Xã Núi Cấm",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30520",
    "name": "Phường Tịnh Biên",
    "type": "ward",
    "provinceCode": "91"
  },
  {
    "code": "30502",
    "name": "Phường Thới Sơn",
    "type": "ward",
    "provinceCode": "91"
  },
  {
    "code": "30505",
    "name": "Phường Chi Lăng",
    "type": "ward",
    "provinceCode": "91"
  },
  {
    "code": "30547",
    "name": "Xã Ba Chúc",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30544",
    "name": "Xã Tri Tôn",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30577",
    "name": "Xã Ô Lâm",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30580",
    "name": "Xã Cô Tô",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30568",
    "name": "Xã Vĩnh Gia",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30589",
    "name": "Xã An Châu",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30607",
    "name": "Xã Bình Hòa",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30595",
    "name": "Xã Cần Đăng",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30619",
    "name": "Xã Vĩnh Hanh",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30604",
    "name": "Xã Vĩnh An",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30628",
    "name": "Xã Chợ Mới",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30643",
    "name": "Xã Cù Lao Giêng",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30673",
    "name": "Xã Hội An",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30631",
    "name": "Xã Long Điền",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30658",
    "name": "Xã Nhơn Mỹ",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30664",
    "name": "Xã Long Kiến",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30682",
    "name": "Xã Thoại Sơn",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30688",
    "name": "Xã Óc Eo",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30709",
    "name": "Xã Định Mỹ",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30685",
    "name": "Xã Phú Hòa",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30697",
    "name": "Xã Vĩnh Trạch",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30691",
    "name": "Xã Tây Phú",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "31064",
    "name": "Xã Vĩnh Bình",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "31069",
    "name": "Xã Vĩnh Thuận",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "31051",
    "name": "Xã Vĩnh Phong",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "31012",
    "name": "Xã Vĩnh Hòa",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "31027",
    "name": "Xã U Minh Thượng",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "31024",
    "name": "Xã Đông Hòa",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "31031",
    "name": "Xã Tân Thạnh",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "31036",
    "name": "Xã Đông Hưng",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "31018",
    "name": "Xã An Minh",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "31042",
    "name": "Xã Vân Khánh",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30988",
    "name": "Xã Tây Yên",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "31006",
    "name": "Xã Đông Thái",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30985",
    "name": "Xã An Biên",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30958",
    "name": "Xã Định Hòa",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30952",
    "name": "Xã Gò Quao",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30970",
    "name": "Xã Vĩnh Hòa Hưng",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30982",
    "name": "Xã Vĩnh Tuy",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30904",
    "name": "Xã Giồng Riềng",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30910",
    "name": "Xã Thạnh Hưng",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30943",
    "name": "Xã Long Thạnh",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30934",
    "name": "Xã Hòa Hưng",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30928",
    "name": "Xã Ngọc Chúc",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30949",
    "name": "Xã Hòa Thuận",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30856",
    "name": "Xã Tân Hội",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30850",
    "name": "Xã Tân Hiệp",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30874",
    "name": "Xã Thạnh Đông",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30886",
    "name": "Xã Thạnh Lộc",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30880",
    "name": "Xã Châu Thành",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30898",
    "name": "Xã Bình An",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30817",
    "name": "Xã Hòn Đất",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30835",
    "name": "Xã Sơn Kiên",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30838",
    "name": "Xã Mỹ Thuận",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30823",
    "name": "Xã Bình Sơn",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30826",
    "name": "Xã Bình Giang",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30796",
    "name": "Xã Giang Thành",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30793",
    "name": "Xã Vĩnh Điều",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30790",
    "name": "Xã Hòa Điền",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30787",
    "name": "Xã Kiên Lương",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30811",
    "name": "Xã Sơn Hải",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "30814",
    "name": "Xã Hòn Nghệ",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "31108",
    "name": "Đặc khu Kiên Hải",
    "type": "special_zone",
    "provinceCode": "91"
  },
  {
    "code": "30760",
    "name": "Phường Vĩnh Thông",
    "type": "ward",
    "provinceCode": "91"
  },
  {
    "code": "30742",
    "name": "Phường Rạch Giá",
    "type": "ward",
    "provinceCode": "91"
  },
  {
    "code": "30769",
    "name": "Phường Hà Tiên",
    "type": "ward",
    "provinceCode": "91"
  },
  {
    "code": "30766",
    "name": "Phường Tô Châu",
    "type": "ward",
    "provinceCode": "91"
  },
  {
    "code": "30781",
    "name": "Xã Tiên Hải",
    "type": "commune",
    "provinceCode": "91"
  },
  {
    "code": "31078",
    "name": "Đặc khu Phú Quốc",
    "type": "special_zone",
    "provinceCode": "91"
  },
  {
    "code": "31105",
    "name": "Đặc khu Thổ Châu",
    "type": "special_zone",
    "provinceCode": "91"
  },
  {
    "code": "31135",
    "name": "Phường Ninh Kiều",
    "type": "ward",
    "provinceCode": "92"
  },
  {
    "code": "31120",
    "name": "Phường Cái Khế",
    "type": "ward",
    "provinceCode": "92"
  },
  {
    "code": "31147",
    "name": "Phường Tân An",
    "type": "ward",
    "provinceCode": "92"
  },
  {
    "code": "31150",
    "name": "Phường An Bình",
    "type": "ward",
    "provinceCode": "92"
  },
  {
    "code": "31174",
    "name": "Phường Thới An Đông",
    "type": "ward",
    "provinceCode": "92"
  },
  {
    "code": "31168",
    "name": "Phường Bình Thủy",
    "type": "ward",
    "provinceCode": "92"
  },
  {
    "code": "31183",
    "name": "Phường Long Tuyền",
    "type": "ward",
    "provinceCode": "92"
  },
  {
    "code": "31186",
    "name": "Phường Cái Răng",
    "type": "ward",
    "provinceCode": "92"
  },
  {
    "code": "31201",
    "name": "Phường Hưng Phú",
    "type": "ward",
    "provinceCode": "92"
  },
  {
    "code": "31153",
    "name": "Phường Ô Môn",
    "type": "ward",
    "provinceCode": "92"
  },
  {
    "code": "31157",
    "name": "Phường Thới Long",
    "type": "ward",
    "provinceCode": "92"
  },
  {
    "code": "31162",
    "name": "Phường Phước Thới",
    "type": "ward",
    "provinceCode": "92"
  },
  {
    "code": "31217",
    "name": "Phường Trung Nhứt",
    "type": "ward",
    "provinceCode": "92"
  },
  {
    "code": "31207",
    "name": "Phường Thốt Nốt",
    "type": "ward",
    "provinceCode": "92"
  },
  {
    "code": "31228",
    "name": "Phường Thuận Hưng",
    "type": "ward",
    "provinceCode": "92"
  },
  {
    "code": "31213",
    "name": "Phường Tân Lộc",
    "type": "ward",
    "provinceCode": "92"
  },
  {
    "code": "31299",
    "name": "Xã Phong Điền",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31315",
    "name": "Xã Nhơn Ái",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31309",
    "name": "Xã Trường Long",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31258",
    "name": "Xã Thới Lai",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31282",
    "name": "Xã Đông Thuận",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31294",
    "name": "Xã Trường Xuân",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31288",
    "name": "Xã Trường Thành",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31261",
    "name": "Xã Cờ Đỏ",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31273",
    "name": "Xã Đông Hiệp",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31249",
    "name": "Xã Thạnh Phú",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31264",
    "name": "Xã Thới Hưng",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31255",
    "name": "Xã Trung Hưng",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31232",
    "name": "Xã Vĩnh Thạnh",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31237",
    "name": "Xã Vĩnh Trinh",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31231",
    "name": "Xã Thạnh An",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31246",
    "name": "Xã Thạnh Quới",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31338",
    "name": "Xã Hỏa Lựu",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31321",
    "name": "Phường Vị Thanh",
    "type": "ward",
    "provinceCode": "92"
  },
  {
    "code": "31333",
    "name": "Phường Vị Tân",
    "type": "ward",
    "provinceCode": "92"
  },
  {
    "code": "31441",
    "name": "Xã Vị Thủy",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31453",
    "name": "Xã Vĩnh Thuận Đông",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31465",
    "name": "Xã Vị Thanh 1",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31459",
    "name": "Xã Vĩnh Tường",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31489",
    "name": "Xã Vĩnh Viễn",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31495",
    "name": "Xã Xà Phiên",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31492",
    "name": "Xã Lương Tâm",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31473",
    "name": "Phường Long Bình",
    "type": "ward",
    "provinceCode": "92"
  },
  {
    "code": "31471",
    "name": "Phường Long Mỹ",
    "type": "ward",
    "provinceCode": "92"
  },
  {
    "code": "31480",
    "name": "Phường Long Phú 1",
    "type": "ward",
    "provinceCode": "92"
  },
  {
    "code": "31360",
    "name": "Xã Thạnh Xuân",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31342",
    "name": "Xã Tân Hòa",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31348",
    "name": "Xã Trường Long Tây",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31366",
    "name": "Xã Châu Thành",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31369",
    "name": "Xã Đông Phước",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31378",
    "name": "Xã Phú Hữu",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31411",
    "name": "Phường Đại Thành",
    "type": "ward",
    "provinceCode": "92"
  },
  {
    "code": "31340",
    "name": "Phường Ngã Bảy",
    "type": "ward",
    "provinceCode": "92"
  },
  {
    "code": "31399",
    "name": "Xã Tân Bình",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31393",
    "name": "Xã Hòa An",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31426",
    "name": "Xã Phương Bình",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31432",
    "name": "Xã Tân Phước Hưng",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31396",
    "name": "Xã Hiệp Hưng",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31420",
    "name": "Xã Phụng Hiệp",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31408",
    "name": "Xã Thạnh Hòa",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31510",
    "name": "Phường Phú Lợi",
    "type": "ward",
    "provinceCode": "92"
  },
  {
    "code": "31507",
    "name": "Phường Sóc Trăng",
    "type": "ward",
    "provinceCode": "92"
  },
  {
    "code": "31684",
    "name": "Phường Mỹ Xuyên",
    "type": "ward",
    "provinceCode": "92"
  },
  {
    "code": "31717",
    "name": "Xã Hòa Tú",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31726",
    "name": "Xã Gia Hòa",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31708",
    "name": "Xã Nhu Gia",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31723",
    "name": "Xã Ngọc Tố",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31654",
    "name": "Xã Trường Khánh",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31645",
    "name": "Xã Đại Ngãi",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31666",
    "name": "Xã Tân Thạnh",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31639",
    "name": "Xã Long Phú",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31552",
    "name": "Xã Nhơn Mỹ",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31537",
    "name": "Xã Phong Nẫm",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31531",
    "name": "Xã An Lạc Thôn",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31528",
    "name": "Xã Kế Sách",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31540",
    "name": "Xã Thới An Hội",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31561",
    "name": "Xã Đại Hải",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31569",
    "name": "Xã Phú Tâm",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31594",
    "name": "Xã An Ninh",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31582",
    "name": "Xã Thuận Hòa",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31570",
    "name": "Xã Hồ Đắc Kiện",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31567",
    "name": "Xã Mỹ Tú",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31579",
    "name": "Xã Long Hưng",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31603",
    "name": "Xã Mỹ Phước",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31591",
    "name": "Xã Mỹ Hương",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31795",
    "name": "Xã Vĩnh Hải",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31810",
    "name": "Xã Lai Hòa",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31804",
    "name": "Phường Vĩnh Phước",
    "type": "ward",
    "provinceCode": "92"
  },
  {
    "code": "31783",
    "name": "Phường Vĩnh Châu",
    "type": "ward",
    "provinceCode": "92"
  },
  {
    "code": "31789",
    "name": "Phường Khánh Hòa",
    "type": "ward",
    "provinceCode": "92"
  },
  {
    "code": "31741",
    "name": "Xã Tân Long",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31732",
    "name": "Phường Ngã Năm",
    "type": "ward",
    "provinceCode": "92"
  },
  {
    "code": "31753",
    "name": "Phường Mỹ Quới",
    "type": "ward",
    "provinceCode": "92"
  },
  {
    "code": "31756",
    "name": "Xã Phú Lộc",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31777",
    "name": "Xã Vĩnh Lợi",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31759",
    "name": "Xã Lâm Tân",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31699",
    "name": "Xã Thạnh Thới An",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31687",
    "name": "Xã Tài Văn",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31675",
    "name": "Xã Liêu Tú",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31679",
    "name": "Xã Lịch Hội Thượng",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31673",
    "name": "Xã Trần Đề",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31615",
    "name": "Xã An Thạnh",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "31633",
    "name": "Xã Cù Lao Dung",
    "type": "commune",
    "provinceCode": "92"
  },
  {
    "code": "32002",
    "name": "Phường An Xuyên",
    "type": "ward",
    "provinceCode": "96"
  },
  {
    "code": "32014",
    "name": "Phường Lý Văn Lâm",
    "type": "ward",
    "provinceCode": "96"
  },
  {
    "code": "32025",
    "name": "Phường Tân Thành",
    "type": "ward",
    "provinceCode": "96"
  },
  {
    "code": "32041",
    "name": "Phường Hòa Thành",
    "type": "ward",
    "provinceCode": "96"
  },
  {
    "code": "32167",
    "name": "Xã Tân Thuận",
    "type": "commune",
    "provinceCode": "96"
  },
  {
    "code": "32188",
    "name": "Xã Tân Tiến",
    "type": "commune",
    "provinceCode": "96"
  },
  {
    "code": "32155",
    "name": "Xã Tạ An Khương",
    "type": "commune",
    "provinceCode": "96"
  },
  {
    "code": "32161",
    "name": "Xã Trần Phán",
    "type": "commune",
    "provinceCode": "96"
  },
  {
    "code": "32185",
    "name": "Xã Thanh Tùng",
    "type": "commune",
    "provinceCode": "96"
  },
  {
    "code": "32152",
    "name": "Xã Đầm Dơi",
    "type": "commune",
    "provinceCode": "96"
  },
  {
    "code": "32182",
    "name": "Xã Quách Phẩm",
    "type": "commune",
    "provinceCode": "96"
  },
  {
    "code": "32047",
    "name": "Xã U Minh",
    "type": "commune",
    "provinceCode": "96"
  },
  {
    "code": "32044",
    "name": "Xã Nguyễn Phích",
    "type": "commune",
    "provinceCode": "96"
  },
  {
    "code": "32062",
    "name": "Xã Khánh Lâm",
    "type": "commune",
    "provinceCode": "96"
  },
  {
    "code": "32059",
    "name": "Xã Khánh An",
    "type": "commune",
    "provinceCode": "96"
  },
  {
    "code": "32244",
    "name": "Xã Phan Ngọc Hiển",
    "type": "commune",
    "provinceCode": "96"
  },
  {
    "code": "32248",
    "name": "Xã Đất Mũi",
    "type": "commune",
    "provinceCode": "96"
  },
  {
    "code": "32236",
    "name": "Xã Tân Ân",
    "type": "commune",
    "provinceCode": "96"
  },
  {
    "code": "32110",
    "name": "Xã Khánh Bình",
    "type": "commune",
    "provinceCode": "96"
  },
  {
    "code": "32104",
    "name": "Xã Đá Bạc",
    "type": "commune",
    "provinceCode": "96"
  },
  {
    "code": "32119",
    "name": "Xã Khánh Hưng",
    "type": "commune",
    "provinceCode": "96"
  },
  {
    "code": "32098",
    "name": "Xã Sông Đốc",
    "type": "commune",
    "provinceCode": "96"
  },
  {
    "code": "32095",
    "name": "Xã Trần Văn Thời",
    "type": "commune",
    "provinceCode": "96"
  },
  {
    "code": "32065",
    "name": "Xã Thới Bình",
    "type": "commune",
    "provinceCode": "96"
  },
  {
    "code": "32071",
    "name": "Xã Trí Phải",
    "type": "commune",
    "provinceCode": "96"
  },
  {
    "code": "32083",
    "name": "Xã Tân Lộc",
    "type": "commune",
    "provinceCode": "96"
  },
  {
    "code": "32092",
    "name": "Xã Hồ Thị Kỷ",
    "type": "commune",
    "provinceCode": "96"
  },
  {
    "code": "32069",
    "name": "Xã Biển Bạch",
    "type": "commune",
    "provinceCode": "96"
  },
  {
    "code": "32201",
    "name": "Xã Đất Mới",
    "type": "commune",
    "provinceCode": "96"
  },
  {
    "code": "32191",
    "name": "Xã Năm Căn",
    "type": "commune",
    "provinceCode": "96"
  },
  {
    "code": "32206",
    "name": "Xã Tam Giang",
    "type": "commune",
    "provinceCode": "96"
  },
  {
    "code": "32212",
    "name": "Xã Cái Đôi Vàm",
    "type": "commune",
    "provinceCode": "96"
  },
  {
    "code": "32227",
    "name": "Xã Nguyễn Việt Khái",
    "type": "commune",
    "provinceCode": "96"
  },
  {
    "code": "32218",
    "name": "Xã Phú Tân",
    "type": "commune",
    "provinceCode": "96"
  },
  {
    "code": "32214",
    "name": "Xã Phú Mỹ",
    "type": "commune",
    "provinceCode": "96"
  },
  {
    "code": "32134",
    "name": "Xã Lương Thế Trân",
    "type": "commune",
    "provinceCode": "96"
  },
  {
    "code": "32137",
    "name": "Xã Tân Hưng",
    "type": "commune",
    "provinceCode": "96"
  },
  {
    "code": "32140",
    "name": "Xã Hưng Mỹ",
    "type": "commune",
    "provinceCode": "96"
  },
  {
    "code": "32128",
    "name": "Xã Cái Nước",
    "type": "commune",
    "provinceCode": "96"
  },
  {
    "code": "31825",
    "name": "Phường Bạc Liêu",
    "type": "ward",
    "provinceCode": "96"
  },
  {
    "code": "31834",
    "name": "Phường Vĩnh Trạch",
    "type": "ward",
    "provinceCode": "96"
  },
  {
    "code": "31840",
    "name": "Phường Hiệp Thành",
    "type": "ward",
    "provinceCode": "96"
  },
  {
    "code": "31942",
    "name": "Phường Giá Rai",
    "type": "ward",
    "provinceCode": "96"
  },
  {
    "code": "31951",
    "name": "Phường Láng Tròn",
    "type": "ward",
    "provinceCode": "96"
  },
  {
    "code": "31957",
    "name": "Xã Phong Thạnh",
    "type": "commune",
    "provinceCode": "96"
  },
  {
    "code": "31843",
    "name": "Xã Hồng Dân",
    "type": "commune",
    "provinceCode": "96"
  },
  {
    "code": "31858",
    "name": "Xã Vĩnh Lộc",
    "type": "commune",
    "provinceCode": "96"
  },
  {
    "code": "31864",
    "name": "Xã Ninh Thạnh Lợi",
    "type": "commune",
    "provinceCode": "96"
  },
  {
    "code": "31849",
    "name": "Xã Ninh Quới",
    "type": "commune",
    "provinceCode": "96"
  },
  {
    "code": "31972",
    "name": "Xã Gành Hào",
    "type": "commune",
    "provinceCode": "96"
  },
  {
    "code": "31993",
    "name": "Xã Định Thành",
    "type": "commune",
    "provinceCode": "96"
  },
  {
    "code": "31988",
    "name": "Xã An Trạch",
    "type": "commune",
    "provinceCode": "96"
  },
  {
    "code": "31985",
    "name": "Xã Long Điền",
    "type": "commune",
    "provinceCode": "96"
  },
  {
    "code": "31975",
    "name": "Xã Đông Hải",
    "type": "commune",
    "provinceCode": "96"
  },
  {
    "code": "31891",
    "name": "Xã Hòa Bình",
    "type": "commune",
    "provinceCode": "96"
  },
  {
    "code": "31918",
    "name": "Xã Vĩnh Mỹ",
    "type": "commune",
    "provinceCode": "96"
  },
  {
    "code": "31927",
    "name": "Xã Vĩnh Hậu",
    "type": "commune",
    "provinceCode": "96"
  },
  {
    "code": "31867",
    "name": "Xã Phước Long",
    "type": "commune",
    "provinceCode": "96"
  },
  {
    "code": "31876",
    "name": "Xã Vĩnh Phước",
    "type": "commune",
    "provinceCode": "96"
  },
  {
    "code": "31885",
    "name": "Xã Phong Hiệp",
    "type": "commune",
    "provinceCode": "96"
  },
  {
    "code": "31882",
    "name": "Xã Vĩnh Thanh",
    "type": "commune",
    "provinceCode": "96"
  },
  {
    "code": "31900",
    "name": "Xã Vĩnh Lợi",
    "type": "commune",
    "provinceCode": "96"
  },
  {
    "code": "31906",
    "name": "Xã Hưng Hội",
    "type": "commune",
    "provinceCode": "96"
  },
  {
    "code": "31894",
    "name": "Xã Châu Thới",
    "type": "commune",
    "provinceCode": "96"
  }
];

export const wardsByProvinceCode: Record<string, LocationWard[]> = wards2025.reduce<Record<string, LocationWard[]>>(
  (result, ward) => {
    result[ward.provinceCode] = result[ward.provinceCode] ?? [];
    result[ward.provinceCode].push(ward);
    return result;
  },
  {},
);
