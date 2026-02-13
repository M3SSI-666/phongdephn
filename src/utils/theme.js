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

export const QUAN_LIST = [
  'Đống Đa', 'Cầu Giấy', 'Nam Từ Liêm', 'Bắc Từ Liêm',
  'Thanh Xuân', 'Hai Bà Trưng', 'Hoàng Mai', 'Hà Đông',
  'Tây Hồ', 'Ba Đình', 'Hoàn Kiếm', 'Long Biên',
];

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
