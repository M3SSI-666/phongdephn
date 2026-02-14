export const C = {
  primary: '#88C646',
  primaryDark: '#6BA534',
  primaryLight: '#A3D96B',
  primaryBg: '#88C64612',
  primaryBgHover: '#88C64622',
  accent: '#FF7439',
  bg: '#0B0F0D',
  bgCard: '#131A16',
  bgInput: '#0B0F0D',
  border: '#1E2E24',
  borderLight: '#2A3D32',
  text: '#E2EDE6',
  textMuted: '#7A9484',
  textDim: '#4D6656',
  white: '#FFFFFF',
  warn: '#D97706',
  error: '#DC2626',
  blue: '#3B82F6',
  purple: '#9333EA',
};

// 12 Quận + 18 Huyện/Thị xã Hà Nội
export const QUAN_LIST = [
  'Ba Đình', 'Bắc Từ Liêm', 'Cầu Giấy', 'Đống Đa',
  'Hà Đông', 'Hai Bà Trưng', 'Hoàn Kiếm', 'Hoàng Mai',
  'Long Biên', 'Nam Từ Liêm', 'Tây Hồ', 'Thanh Xuân',
  'Ba Vì', 'Chương Mỹ', 'Đan Phượng', 'Đông Anh',
  'Gia Lâm', 'Hoài Đức', 'Mê Linh', 'Mỹ Đức',
  'Phú Xuyên', 'Phúc Thọ', 'Quốc Oai', 'Sóc Sơn',
  'Sơn Tây', 'Thạch Thất', 'Thanh Oai', 'Thanh Trì',
  'Thường Tín', 'Ứng Hòa',
];

export const QUAN_VIETTAT = {
  'Ba Đình': 'BD', 'Bắc Từ Liêm': 'BTL', 'Cầu Giấy': 'CG', 'Đống Đa': 'DD',
  'Hà Đông': 'HD', 'Hai Bà Trưng': 'HBT', 'Hoàn Kiếm': 'HK', 'Hoàng Mai': 'HM',
  'Long Biên': 'LB', 'Nam Từ Liêm': 'NTL', 'Tây Hồ': 'TH', 'Thanh Xuân': 'TX',
  'Ba Vì': 'BV', 'Chương Mỹ': 'CM', 'Đan Phượng': 'DP', 'Đông Anh': 'DA',
  'Gia Lâm': 'GL', 'Hoài Đức': 'HoD', 'Mê Linh': 'ML', 'Mỹ Đức': 'MD',
  'Phú Xuyên': 'PX', 'Phúc Thọ': 'PT', 'Quốc Oai': 'QO', 'Sóc Sơn': 'SS',
  'Sơn Tây': 'ST', 'Thạch Thất': 'TT', 'Thanh Oai': 'TO', 'Thanh Trì': 'TTr',
  'Thường Tín': 'TTi', 'Ứng Hòa': 'UH',
};

export const LOAI_PHONG = ['Phòng trọ', 'CCMN', 'Studio', 'Chung cư', 'Homestay'];

export const formatVND = (v) => {
  if (!v) return '';
  const num = Number(v);
  if (isNaN(num)) return v;
  if (num >= 1000000) return (num / 1000000).toFixed(1).replace('.0', '') + ' tr';
  if (num >= 1000) return (num / 1000).toFixed(0) + 'k';
  return num.toString();
};

export const formatVNDFull = (v) => {
  if (!v) return '';
  const num = Number(v);
  if (isNaN(num)) return v;
  return num.toLocaleString('vi-VN') + 'đ';
};
