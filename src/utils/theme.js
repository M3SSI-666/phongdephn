export const C = {
  primary: '#2DA44E',
  primaryDark: '#1A7F37',
  primaryLight: '#4AC26B',
  primaryBg: '#2DA44E12',
  primaryBgHover: '#2DA44E22',
  accent: '#FF7439',
  bg: '#F6F8FA',
  bgCard: '#FFFFFF',
  bgInput: '#F6F8FA',
  border: '#D8DEE4',
  borderLight: '#E8ECF0',
  text: '#1F2328',
  textMuted: '#656D76',
  textDim: '#8B949E',
  white: '#1F2328',
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
  return num.toLocaleString('vi-VN') + ' đ';
};

export const formatVNDFull = (v) => {
  if (!v) return '';
  const num = Number(v);
  if (isNaN(num)) return v;
  return num.toLocaleString('vi-VN') + ' đ';
};
