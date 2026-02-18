export const C = {
  primary: '#22C55E',
  primaryDark: '#15803D',
  primaryLight: '#4ADE80',
  primaryBg: '#F0FDF4',
  primaryBgHover: '#DCFCE7',
  primaryGlow: '#22C55E33',
  accent: '#FF6B2C',
  accentLight: '#FFF7ED',
  bg: '#F8FAFB',
  bgCard: '#FFFFFF',
  bgInput: '#F8FAFB',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  text: '#0F172A',
  textMuted: '#64748B',
  textDim: '#94A3B8',
  white: '#0F172A',
  warn: '#F59E0B',
  error: '#EF4444',
  blue: '#3B82F6',
  purple: '#8B5CF6',
  gradient: 'linear-gradient(135deg, #22C55E, #16A34A)',
  gradientLight: 'linear-gradient(135deg, #F0FDF4, #ECFDF5)',
  shadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
  shadowMd: '0 4px 12px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.04)',
  shadowLg: '0 10px 25px rgba(0,0,0,0.08), 0 4px 10px rgba(0,0,0,0.04)',
  shadowGreen: '0 4px 14px rgba(34,197,94,0.20)',
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

export const LOAI_PHONG = ['Phòng trọ đơn', 'Nguyên căn', 'Chung cư', 'Homestay', '1N1K', '2N1K', '3N1K', '1N1B', '2N1B'];

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
