// ============================================================
// HANOI GEOGRAPHY DATABASE (hard-coded, loaded once)
// AI chỉ cần nhận diện keyword → code JS tra cứu map này
// ============================================================

const QUAN_PHUONG = {
  'Hoàng Mai': ['Hoàng Liệt','Đại Kim','Định Công','Giáp Bát','Hoàng Văn Thụ','Lĩnh Nam','Mai Động','Tân Mai','Thanh Trì','Thịnh Liệt','Trương Định','Tương Mai','Vĩnh Hưng','Yên Sở'],
  'Thanh Xuân': ['Hạ Đình','Khương Đình','Khương Mai','Khương Trung','Kim Giang','Nhân Chính','Phương Liệt','Thanh Xuân Bắc','Thanh Xuân Nam','Thanh Xuân Trung','Thượng Đình'],
  'Đống Đa': ['Cát Linh','Chùa Bộc','Hàng Bột','Khâm Thiên','Khương Thượng','Kim Liên','Láng Hạ','Láng Thượng','Nam Đồng','Ngã Tư Sở','Ô Chợ Dừa','Phương Liên','Phương Mai','Quang Trung','Thịnh Quang','Thổ Quan','Trung Liệt','Trung Phụng','Trung Tự','Văn Chương','Văn Miếu'],
  'Hai Bà Trưng': ['Bách Khoa','Bạch Đằng','Bạch Mai','Cầu Dền','Đống Mác','Đồng Nhân','Đồng Tâm','Lê Đại Hành','Minh Khai','Ngô Thì Nhậm','Nguyễn Du','Phạm Đình Hổ','Phố Huế','Quỳnh Lôi','Quỳnh Mai','Thanh Lương','Thanh Nhàn','Trương Định','Vĩnh Tuy'],
  'Cầu Giấy': ['Dịch Vọng','Dịch Vọng Hậu','Mai Dịch','Nghĩa Đô','Nghĩa Tân','Quan Hoa','Trung Hòa','Yên Hòa'],
  'Ba Đình': ['Cống Vị','Điện Biên','Đội Cấn','Giảng Võ','Kim Mã','Liễu Giai','Ngọc Hà','Ngọc Khánh','Nguyễn Trung Trực','Phúc Xá','Quán Thánh','Thành Công','Trúc Bạch','Vĩnh Phúc'],
  'Hà Đông': ['Biên Giang','Dương Nội','Đồng Mai','Hà Cầu','Kiến Hưng','La Khê','Mỗ Lao','Nguyễn Trãi','Phú La','Phú Lãm','Phú Lương','Phúc La','Quang Trung','Vạn Phúc','Văn Quán','Yên Nghĩa','Yết Kiêu'],
  'Long Biên': ['Bồ Đề','Cự Khối','Đức Giang','Giang Biên','Gia Thụy','Long Biên','Ngọc Lâm','Ngọc Thụy','Phúc Đồng','Phúc Lợi','Sài Đồng','Thạch Bàn','Thượng Thanh','Việt Hưng'],
  'Tây Hồ': ['Bưởi','Nhật Tân','Phú Thượng','Quảng An','Thụy Khuê','Tứ Liên','Xuân La','Yên Phụ'],
  'Nam Từ Liêm': ['Cầu Diễn','Đại Mỗ','Mễ Trì','Mỹ Đình 1','Mỹ Đình 2','Phú Đô','Phương Canh','Tây Mỗ','Trung Văn','Xuân Phương'],
  'Bắc Từ Liêm': ['Cổ Nhuế 1','Cổ Nhuế 2','Đông Ngạc','Đức Thắng','Liên Mạc','Minh Khai','Phú Diễn','Phúc Diễn','Tây Tựu','Thượng Cát','Thụy Phương','Xuân Đỉnh','Xuân Tảo'],
  'Hoàn Kiếm': ['Chương Dương','Cửa Đông','Cửa Nam','Đồng Xuân','Hàng Bạc','Hàng Bài','Hàng Bồ','Hàng Buồm','Hàng Đào','Hàng Gai','Hàng Mã','Hàng Trống','Lý Thái Tổ','Phan Chu Trinh','Phúc Tân','Trần Hưng Đạo','Tráng Tiền'],
  'Thanh Trì': ['Đại Áng','Đông Mỹ','Duyên Hà','Hữu Hòa','Liên Ninh','Ngọc Hồi','Ngũ Hiệp','Tả Thanh Oai','Tam Hiệp','Tân Triều','Thanh Liệt','Tứ Hiệp','Vạn Phúc','Vĩnh Quỳnh','Yên Mỹ'],
  'Gia Lâm': ['Đặng Xá','Cổ Bi','Dương Xá','Kim Sơn','Trâu Quỳ','Đa Tốn','Kiêu Kỵ','Bát Tràng','Đông Dư','Văn Đức','Dương Quang','Dương Hà','Phú Thị','Lệ Chi','Ninh Hiệp','Yên Viên','Yên Thường'],
  'Đông Anh': ['Nguyên Khê','Vân Nội','Kim Chung','Uy Nỗ','Tiên Dương','Nam Hồng','Bắc Hồng','Hải Bối','Vĩnh Ngọc','Đông Hội','Cổ Loa','Mai Lâm','Xuân Canh','Tàm Xá','Liên Hà','Việt Hùng','Vân Hà'],
  'Hoài Đức': ['Trạm Trôi','An Khánh','An Thượng','Đắc Sở','Di Trạch','Đông La','Đức Giang','Đức Thượng','Kim Chung','La Phù','Lại Yên','Minh Khai','Song Phương','Sơn Đồng','Tiền Yên','Vân Canh','Vân Côn','Yên Sở'],
};

// Đường lớn → { quan_huyen: [...], phuong: [...] }
const DUONG = {
  'Nguyễn Trãi': { quan: ['Thanh Xuân','Hà Đông'], phuong: ['Thanh Xuân Trung','Thanh Xuân Bắc','Thượng Đình','Nhân Chính','Khương Mai','Nguyễn Trãi','Văn Quán','Mỗ Lao','Phúc La','Quang Trung'] },
  'Giải Phóng': { quan: ['Đống Đa','Hai Bà Trưng','Hoàng Mai'], phuong: ['Phương Mai','Kim Liên','Phạm Đình Hổ','Đồng Tâm','Giáp Bát','Tương Mai','Thịnh Liệt'] },
  'Minh Khai': { quan: ['Hai Bà Trưng','Hoàng Mai'], phuong: ['Minh Khai','Thanh Lương','Vĩnh Tuy','Mai Động','Tân Mai'] },
  'Láng': { quan: ['Đống Đa','Cầu Giấy'], phuong: ['Láng Thượng','Láng Hạ','Dịch Vọng','Quan Hoa'] },
  'Trường Chinh': { quan: ['Đống Đa','Thanh Xuân','Hoàng Mai'], phuong: ['Khương Thượng','Phương Mai','Khương Mai','Phương Liệt','Giáp Bát'] },
  'Lê Trọng Tấn': { quan: ['Thanh Xuân','Hà Đông'], phuong: ['Khương Mai','La Khê','Dương Nội','Phú Lãm'] },
  'Kim Giang': { quan: ['Thanh Xuân','Hoàng Mai','Thanh Trì'], phuong: ['Kim Giang','Đại Kim','Thanh Liệt'] },
  'Nguyễn Xiển': { quan: ['Thanh Xuân','Hoàng Mai','Thanh Trì'], phuong: ['Hạ Đình','Đại Kim','Tân Triều'] },
  'Tố Hữu': { quan: ['Thanh Xuân','Hà Đông'], phuong: ['Nhân Chính','La Khê','Phú La'] },
  'Lê Văn Lương': { quan: ['Thanh Xuân','Cầu Giấy'], phuong: ['Nhân Chính','Thượng Đình','Trung Hòa'] },
  'Cầu Giấy': { quan: ['Cầu Giấy','Ba Đình'], phuong: ['Quan Hoa','Dịch Vọng','Ngọc Khánh'] },
  'Hoàng Quốc Việt': { quan: ['Cầu Giấy','Bắc Từ Liêm'], phuong: ['Nghĩa Đô','Nghĩa Tân','Cổ Nhuế 1','Cổ Nhuế 2'] },
  'Xuân Thủy': { quan: ['Cầu Giấy'], phuong: ['Dịch Vọng Hậu','Quan Hoa','Dịch Vọng'] },
  'Phạm Hùng': { quan: ['Nam Từ Liêm','Cầu Giấy'], phuong: ['Mễ Trì','Mỹ Đình 1','Mỹ Đình 2','Mai Dịch'] },
  'Phạm Văn Đồng': { quan: ['Bắc Từ Liêm','Cầu Giấy'], phuong: ['Cổ Nhuế 1','Xuân Đỉnh','Mai Dịch'] },
  'Ngọc Hồi': { quan: ['Hoàng Mai','Thanh Trì'], phuong: ['Hoàng Liệt','Ngọc Hồi','Tứ Hiệp'] },
  'Tam Trinh': { quan: ['Hoàng Mai'], phuong: ['Mai Động','Tân Mai','Hoàng Văn Thụ','Yên Sở','Lĩnh Nam'] },
  'Vũ Tông Phan': { quan: ['Thanh Xuân','Hoàng Mai'], phuong: ['Kim Giang','Khương Đình','Đại Kim'] },
  'Định Công': { quan: ['Hoàng Mai'], phuong: ['Định Công','Đại Kim','Thịnh Liệt'] },
  'Trịnh Đình Cửu': { quan: ['Hoàng Mai'], phuong: ['Định Công','Đại Kim'] },
  'Nguyễn Lân': { quan: ['Thanh Xuân'], phuong: ['Phương Liệt','Khương Mai'] },
  'Khương Đình': { quan: ['Thanh Xuân'], phuong: ['Khương Đình','Hạ Đình','Kim Giang'] },
  'Khuất Duy Tiến': { quan: ['Thanh Xuân','Cầu Giấy'], phuong: ['Nhân Chính','Thanh Xuân Bắc','Trung Hòa'] },
  'Nguyễn Tuân': { quan: ['Thanh Xuân'], phuong: ['Thanh Xuân Trung','Nhân Chính'] },
  'Trần Duy Hưng': { quan: ['Cầu Giấy'], phuong: ['Trung Hòa','Yên Hòa'] },
  'Linh Đàm': { quan: ['Hoàng Mai'], phuong: ['Hoàng Liệt','Đại Kim'] },
};

// Trường ĐH / Cao đẳng / Landmark → { quan: [...], phuong: [...] }
const LANDMARK = {
  // Đại học
  'ĐH Bách Khoa': { quan: ['Hai Bà Trưng','Hoàng Mai'], phuong: ['Bách Khoa','Lê Đại Hành','Trương Định','Phạm Đình Hổ','Thanh Nhàn','Đồng Tâm','Minh Khai','Tân Mai','Mai Động'] },
  'ĐH Thăng Long': { quan: ['Hoàng Mai','Thanh Xuân'], phuong: ['Đại Kim','Thịnh Liệt','Định Công','Tân Mai','Giáp Bát','Kim Giang','Hạ Đình','Khương Đình'] },
  'ĐH Xây Dựng': { quan: ['Hai Bà Trưng','Hoàng Mai'], phuong: ['Thanh Lương','Minh Khai','Vĩnh Tuy','Bạch Mai','Thanh Nhàn','Mai Động','Tân Mai'] },
  'ĐH Kinh Tế Quốc Dân': { quan: ['Hai Bà Trưng'], phuong: ['Đồng Tâm','Bách Khoa','Lê Đại Hành','Phạm Đình Hổ','Đồng Nhân','Quỳnh Lôi'] },
  'ĐH Quốc Gia': { quan: ['Cầu Giấy'], phuong: ['Dịch Vọng Hậu','Dịch Vọng','Quan Hoa','Mai Dịch','Nghĩa Tân','Nghĩa Đô'] },
  'ĐH Khoa Học Tự Nhiên': { quan: ['Thanh Xuân','Đống Đa'], phuong: ['Thanh Xuân Bắc','Thanh Xuân Trung','Thanh Xuân Nam','Khương Mai','Nhân Chính','Thượng Đình','Ngã Tư Sở','Phương Liên','Khương Thượng'] },
  'ĐH Sư Phạm': { quan: ['Cầu Giấy'], phuong: ['Dịch Vọng Hậu','Quan Hoa','Dịch Vọng','Mai Dịch'] },
  'Học Viện Nông Nghiệp': { quan: ['Gia Lâm'], phuong: ['Trâu Quỳ','Đặng Xá','Cổ Bi','Dương Xá','Kim Sơn'] },
  'ĐH Công Nghiệp': { quan: ['Bắc Từ Liêm','Nam Từ Liêm'], phuong: ['Minh Khai','Phúc Diễn','Phú Diễn','Cầu Diễn','Tây Tựu'] },
  'CĐ Y Hà Nội': { quan: ['Ba Đình'], phuong: ['Ngọc Hà','Đội Cấn','Kim Mã','Giảng Võ','Cống Vị','Liễu Giai'] },
  'Cao đẳng Y': { quan: ['Ba Đình'], phuong: ['Ngọc Hà','Đội Cấn','Kim Mã','Giảng Võ','Cống Vị','Liễu Giai'] },
  'ĐH Y Hà Nội': { quan: ['Đống Đa'], phuong: ['Trung Tự','Kim Liên','Phương Mai','Phương Liên','Chùa Bộc','Nam Đồng'] },
  'ĐH Thủy Lợi': { quan: ['Đống Đa'], phuong: ['Chùa Bộc','Trung Liệt','Thịnh Quang','Kim Liên','Phương Mai','Trung Tự'] },
  'ĐH Giao Thông Vận Tải': { quan: ['Đống Đa','Cầu Giấy'], phuong: ['Láng Thượng','Láng Hạ','Ô Chợ Dừa','Thịnh Quang','Dịch Vọng','Quan Hoa'] },
  'ĐH Ngoại Thương': { quan: ['Đống Đa','Cầu Giấy'], phuong: ['Láng Thượng','Láng Hạ','Ô Chợ Dừa','Thịnh Quang','Dịch Vọng','Quan Hoa'] },
  'ĐH Luật': { quan: ['Đống Đa','Thanh Xuân'], phuong: ['Ngã Tư Sở','Khương Thượng','Phương Liên','Thịnh Quang','Thanh Xuân Bắc'] },
  'ĐH Mở': { quan: ['Hai Bà Trưng'], phuong: ['Bạch Đằng','Phố Huế','Đồng Nhân','Ngô Thì Nhậm'] },
  'ĐH Công Đoàn': { quan: ['Đống Đa'], phuong: ['Quang Trung','Trung Tự','Nam Đồng','Văn Chương','Khâm Thiên'] },
  'ĐH Phenikaa': { quan: ['Hà Đông'], phuong: ['Yên Nghĩa','Phú Lãm','Dương Nội','Kiến Hưng'] },
  'ĐH Hà Nội': { quan: ['Thanh Xuân'], phuong: ['Nhân Chính','Thượng Đình','Thanh Xuân Trung','Thanh Xuân Bắc'] },
  'ĐH Mỹ Thuật': { quan: ['Đống Đa'], phuong: ['Kim Liên','Trung Tự','Phương Mai','Nam Đồng'] },
  'ĐH Văn Hóa': { quan: ['Cầu Giấy'], phuong: ['Mai Dịch','Dịch Vọng','Dịch Vọng Hậu','Quan Hoa'] },
  // Bệnh viện / Landmark
  'BV Bạch Mai': { quan: ['Đống Đa','Hai Bà Trưng'], phuong: ['Phương Mai','Kim Liên','Trung Tự','Chùa Bộc','Phạm Đình Hổ'] },
  'Bệnh viện Bạch Mai': { quan: ['Đống Đa','Hai Bà Trưng'], phuong: ['Phương Mai','Kim Liên','Trung Tự','Chùa Bộc','Phạm Đình Hổ'] },
  'BV Việt Đức': { quan: ['Hoàn Kiếm'], phuong: ['Cửa Nam','Hàng Trống','Hàng Gai','Hàng Bồ'] },
  'Bến xe Giáp Bát': { quan: ['Hoàng Mai'], phuong: ['Giáp Bát','Tương Mai','Thịnh Liệt','Trương Định','Đại Kim'] },
  'Bến xe Mỹ Đình': { quan: ['Nam Từ Liêm'], phuong: ['Mỹ Đình 2','Mỹ Đình 1','Mễ Trì','Cầu Diễn'] },
  'Hồ Tây': { quan: ['Tây Hồ'], phuong: ['Quảng An','Nhật Tân','Bưởi','Xuân La','Thụy Khuê','Tứ Liên','Yên Phụ'] },
  'Times City': { quan: ['Hai Bà Trưng','Hoàng Mai'], phuong: ['Vĩnh Tuy','Mai Động','Tân Mai','Minh Khai'] },
  'Linh Đàm': { quan: ['Hoàng Mai','Thanh Trì'], phuong: ['Hoàng Liệt','Đại Kim','Tân Triều','Thanh Liệt'] },
  'Royal City': { quan: ['Thanh Xuân'], phuong: ['Thượng Đình','Nhân Chính','Thanh Xuân Trung'] },
  'Keangnam': { quan: ['Nam Từ Liêm'], phuong: ['Mễ Trì','Mỹ Đình 1','Mỹ Đình 2'] },
  'Aeon Long Biên': { quan: ['Long Biên'], phuong: ['Cự Khối','Thạch Bàn','Sài Đồng','Long Biên'] },
  'Aeon Hà Đông': { quan: ['Hà Đông'], phuong: ['Dương Nội','La Khê','Phú Lãm','Kiến Hưng'] },
  'Big C Thăng Long': { quan: ['Cầu Giấy'], phuong: ['Dịch Vọng Hậu','Mai Dịch','Nghĩa Tân'] },
  'Chợ Đồng Xuân': { quan: ['Hoàn Kiếm'], phuong: ['Đồng Xuân','Hàng Mã','Hàng Buồm','Hàng Đào'] },
  'Công viên Thống Nhất': { quan: ['Hai Bà Trưng','Đống Đa'], phuong: ['Lê Đại Hành','Kim Liên','Trung Tự'] },
};

// Tên gọi phổ biến / thôn / xóm / khu vực → phường chính thức + quận
// (Nhiều khu vực người dân hay gọi không phải tên phường chính thức)
const TEN_PHO_BIEN = {
  'Yên Xá': { quan: ['Thanh Trì','Hà Đông'], phuong: ['Tân Triều','Thanh Liệt','Hữu Hòa','Phúc La','Văn Quán'] },
  'Triều Khúc': { quan: ['Thanh Xuân','Thanh Trì'], phuong: ['Tân Triều','Thanh Liệt','Thanh Xuân Nam','Hạ Đình'] },
  'Bùi Xương Trạch': { quan: ['Thanh Xuân'], phuong: ['Khương Đình','Kim Giang','Hạ Đình'] },
  'Quan Nhân': { quan: ['Thanh Xuân'], phuong: ['Nhân Chính','Thượng Đình','Thanh Xuân Trung'] },
  'Cự Lộc': { quan: ['Thanh Xuân'], phuong: ['Thượng Đình','Thanh Xuân Trung','Nhân Chính'] },
  'Pháo Đài Láng': { quan: ['Đống Đa'], phuong: ['Láng Thượng','Láng Hạ','Ô Chợ Dừa'] },
  'Chùa Láng': { quan: ['Đống Đa'], phuong: ['Láng Thượng','Láng Hạ'] },
  'Ngã Tư Vọng': { quan: ['Hai Bà Trưng','Đống Đa'], phuong: ['Phạm Đình Hổ','Đồng Tâm','Phương Mai'] },
  'Hào Nam': { quan: ['Đống Đa'], phuong: ['Ô Chợ Dừa','Cát Linh','Hàng Bột'] },
  'Xã Đàn': { quan: ['Đống Đa'], phuong: ['Nam Đồng','Trung Tự','Phương Liên'] },
  'Giảng Võ': { quan: ['Ba Đình','Đống Đa'], phuong: ['Giảng Võ','Kim Mã','Cát Linh','Ô Chợ Dừa'] },
  'Đê La Thành': { quan: ['Đống Đa','Ba Đình'], phuong: ['Ô Chợ Dừa','Hàng Bột','Cát Linh','Giảng Võ','Thành Công'] },
  'Ngã Tư Sở': { quan: ['Đống Đa','Thanh Xuân'], phuong: ['Ngã Tư Sở','Khương Thượng','Thịnh Quang','Thanh Xuân Bắc'] },
  'Phùng Khoang': { quan: ['Nam Từ Liêm','Hà Đông'], phuong: ['Trung Văn','Đại Mỗ','Văn Quán','Phúc La'] },
  'Văn Quán': { quan: ['Hà Đông'], phuong: ['Văn Quán','Phúc La','Mỗ Lao','Nguyễn Trãi'] },
  'Xa La': { quan: ['Hà Đông'], phuong: ['Phúc La','Hà Cầu','Kiến Hưng'] },
  'Văn Phú': { quan: ['Hà Đông'], phuong: ['Phú La','Phú Lãm','Văn Quán','Hà Cầu'] },
  'Đại Từ': { quan: ['Hoàng Mai'], phuong: ['Đại Kim','Thịnh Liệt','Hoàng Liệt'] },
  'Kim Văn Kim Lũ': { quan: ['Hoàng Mai'], phuong: ['Đại Kim','Hoàng Liệt','Thịnh Liệt'] },
  'Tây Hồ Tây': { quan: ['Tây Hồ','Bắc Từ Liêm'], phuong: ['Xuân La','Nhật Tân','Phú Thượng','Xuân Đỉnh','Đông Ngạc'] },
  'Mỹ Đình': { quan: ['Nam Từ Liêm'], phuong: ['Mỹ Đình 1','Mỹ Đình 2','Mễ Trì','Cầu Diễn','Phú Đô'] },
  'Cổ Nhuế': { quan: ['Bắc Từ Liêm'], phuong: ['Cổ Nhuế 1','Cổ Nhuế 2','Xuân Đỉnh','Đức Thắng'] },
  'Trung Kính': { quan: ['Cầu Giấy'], phuong: ['Trung Hòa','Yên Hòa','Quan Hoa'] },
  'Dịch Vọng': { quan: ['Cầu Giấy'], phuong: ['Dịch Vọng','Dịch Vọng Hậu','Quan Hoa'] },
  'Trung Hòa Nhân Chính': { quan: ['Cầu Giấy','Thanh Xuân'], phuong: ['Trung Hòa','Nhân Chính','Yên Hòa','Thanh Xuân Bắc'] },
  'Giáp Nhị': { quan: ['Hoàng Mai'], phuong: ['Thịnh Liệt','Hoàng Liệt','Đại Kim'] },
  'Tứ Kỳ': { quan: ['Hoàng Mai'], phuong: ['Hoàng Liệt','Yên Sở','Thịnh Liệt'] },
  'Pháp Vân': { quan: ['Hoàng Mai'], phuong: ['Hoàng Liệt','Yên Sở'] },
  'Tựu Liệt': { quan: ['Thanh Trì'], phuong: ['Thanh Liệt','Tân Triều','Ngũ Hiệp'] },
  'Cầu Bươu': { quan: ['Thanh Trì','Hà Đông'], phuong: ['Thanh Liệt','Tân Triều','Hữu Hòa','Phúc La'] },
};

// Phường lân cận (giáp ranh giữa các quận)
const GIAP_RANH = {
  'Hoàng Mai': ['Kim Giang','Hạ Đình','Khương Đình','Phương Liệt','Thanh Liệt','Tân Triều','Ngọc Hồi'],
  'Thanh Xuân': ['Ngã Tư Sở','Phương Liên','Khương Thượng','Đại Kim','Tân Triều','La Khê','Phú La','Trung Hòa'],
  'Đống Đa': ['Thanh Xuân Bắc','Kim Giang','Dịch Vọng','Quan Hoa','Phạm Đình Hổ','Lê Đại Hành'],
  'Hai Bà Trưng': ['Tân Mai','Mai Động','Kim Liên','Trung Tự','Phương Mai'],
  'Cầu Giấy': ['Láng Thượng','Ngọc Khánh','Cổ Nhuế 1','Mai Dịch','Mỹ Đình 1'],
  'Hà Đông': ['Nhân Chính','Thượng Đình','Trung Văn','Tây Mỗ','Đại Mỗ'],
};

// ============================================================
// MAIN HANDLER
// ============================================================
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { query } = req.body;
    if (!query || !query.trim()) {
      return res.status(400).json({ error: 'Missing query' });
    }

    const cleanQuery = query
      .replace(/[\u{1F000}-\u{1F9FF}]/gu, '')
      .replace(/[\u{2600}-\u{27BF}]/gu, '')
      .replace(/[\u{200B}-\u{200D}\u{FEFF}]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Bước 1: Thử tra cứu map cứng trước (không cần AI)
    const localResult = tryLocalLookup(cleanQuery);
    if (localResult) {
      console.log(`[Search] Local lookup → found: ${localResult.khu_vuc.length} wards`);
      return res.status(200).json(localResult);
    }

    // Bước 2: Nếu không match → dùng AI với prompt nhẹ
    console.log('[Search] No local match → calling AI...');
    const PROMPT = `Bạn là trợ lý tìm phòng trọ Hà Nội. Phân tích yêu cầu và trả về JSON.

Nhiệm vụ: Xác định người dùng muốn tìm phòng ở ĐÂU tại Hà Nội.
Trả về: { "type": "quan" | "phuong" | "landmark" | "duong", "keywords": ["tên quận/phường/trường/đường"], "summary": "1 câu tóm tắt tiếng Việt" }

Quy tắc:
- type="quan": người dùng nói tên quận (Đống Đa, Hoàng Mai, Hà Đông...)
- type="phuong": người dùng nói tên phường cụ thể (Trương Định, Tân Mai, Kim Giang...)
- type="landmark": người dùng nói tên trường/bệnh viện/khu đô thị (ĐH Bách Khoa, BV Bạch Mai, Linh Đàm...)
- type="duong": người dùng nói tên đường (Nguyễn Trãi, Giải Phóng, Minh Khai...)
- keywords: mảng tên đã được chuẩn hóa, viết đúng tên chính thức
- Nếu có NHIỀU địa điểm → liệt kê tất cả trong keywords

VD:
"Phòng khu vực Trương Định, Hoàng Mai" → {"type":"phuong","keywords":["Trương Định"],"summary":"Tìm phòng khu vực Trương Định, Hoàng Mai"}
"Phòng gần ĐH Bách Khoa" → {"type":"landmark","keywords":["ĐH Bách Khoa"],"summary":"Tìm phòng gần ĐH Bách Khoa Hà Nội"}
"Phòng Đống Đa" → {"type":"quan","keywords":["Đống Đa"],"summary":"Tìm phòng quận Đống Đa"}
"Phòng đường Nguyễn Trãi" → {"type":"duong","keywords":["Nguyễn Trãi"],"summary":"Tìm phòng khu vực đường Nguyễn Trãi"}
"Phòng Kim Giang, Vũ Tông Phan" → {"type":"duong","keywords":["Kim Giang","Vũ Tông Phan"],"summary":"Tìm phòng khu vực Kim Giang, Vũ Tông Phan"}

Yêu cầu: ${cleanQuery}`;

    const aiResult = await callAI(PROMPT);
    if (!aiResult) {
      return res.status(429).json({ error: 'Tất cả API đều rate limit. Đợi vài giây rồi thử lại.' });
    }

    // Bước 3: Dùng kết quả AI tra cứu map cứng
    const finalResult = resolveAIResult(aiResult, cleanQuery);
    console.log(`[Search] AI resolved → ${finalResult.khu_vuc.length} wards in ${finalResult.quan_huyen.join(', ')}`);
    return res.status(200).json(finalResult);

  } catch (err) {
    console.error(`[Search] Exception: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
}

// ============================================================
// LOCAL LOOKUP — tra cứu map cứng, không cần AI
// ============================================================
function tryLocalLookup(query) {
  const q = query.toLowerCase().trim();

  // 1. Check tên quận
  for (const [quan, phuongs] of Object.entries(QUAN_PHUONG)) {
    if (q.includes(quan.toLowerCase()) && (q.includes('quận') || q.includes('khu vực') || q.includes('phòng'))) {
      // Chỉ match khi có vẻ hỏi cả quận (không phải hỏi phường cụ thể trong quận)
      const mentionsPhuong = phuongs.some(p => q.includes(p.toLowerCase()));
      if (!mentionsPhuong) {
        return {
          quan_huyen: [quan],
          khu_vuc: [...phuongs],
          summary: `Tìm phòng tất cả phường thuộc quận ${quan}`,
        };
      }
    }
  }

  // 2. Check tên phổ biến / thôn / khu vực
  for (const [name, data] of Object.entries(TEN_PHO_BIEN)) {
    if (q.includes(name.toLowerCase())) {
      return {
        quan_huyen: data.quan,
        khu_vuc: data.phuong,
        summary: `Tìm phòng khu vực ${name} (${data.quan.join(', ')}) và lân cận`,
      };
    }
  }

  // 3. Check tên landmark (exact match)
  for (const [name, data] of Object.entries(LANDMARK)) {
    if (q.includes(name.toLowerCase())) {
      return {
        quan_huyen: data.quan,
        khu_vuc: data.phuong,
        summary: `Tìm phòng quanh ${name} và khu vực lân cận`,
      };
    }
  }

  // 4. Check tên đường (exact match)
  for (const [name, data] of Object.entries(DUONG)) {
    if (q.includes(name.toLowerCase())) {
      return {
        quan_huyen: data.quan,
        khu_vuc: data.phuong,
        summary: `Tìm phòng khu vực đường ${name} (${data.quan.join(', ')})`,
      };
    }
  }

  return null; // Không match → cần AI
}

// ============================================================
// RESOLVE AI RESULT — dùng type + keywords tra map cứng
// ============================================================
function resolveAIResult(aiData, originalQuery) {
  const { type, keywords = [], summary = '' } = aiData;
  const allQuan = new Set();
  const allPhuong = new Set();

  for (const kw of keywords) {
    if (type === 'quan') {
      // Tìm quận trong map
      for (const [quan, phuongs] of Object.entries(QUAN_PHUONG)) {
        if (quan.toLowerCase() === kw.toLowerCase() || kw.toLowerCase().includes(quan.toLowerCase())) {
          allQuan.add(quan);
          phuongs.forEach(p => allPhuong.add(p));
        }
      }
    } else if (type === 'duong') {
      // Tra đường trong map
      for (const [name, data] of Object.entries(DUONG)) {
        if (name.toLowerCase() === kw.toLowerCase() || kw.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(kw.toLowerCase())) {
          data.quan.forEach(q => allQuan.add(q));
          data.phuong.forEach(p => allPhuong.add(p));
        }
      }
    } else if (type === 'landmark') {
      for (const [name, data] of Object.entries(LANDMARK)) {
        if (name.toLowerCase().includes(kw.toLowerCase()) || kw.toLowerCase().includes(name.toLowerCase())) {
          data.quan.forEach(q => allQuan.add(q));
          data.phuong.forEach(p => allPhuong.add(p));
        }
      }
    } else if (type === 'phuong') {
      // Tìm phường trong tất cả quận
      let found = false;
      for (const [quan, phuongs] of Object.entries(QUAN_PHUONG)) {
        for (const p of phuongs) {
          if (p.toLowerCase() === kw.toLowerCase()) {
            allQuan.add(quan);
            allPhuong.add(p);
            addNearby(quan, p, allPhuong);
            found = true;
          }
        }
      }
      // Nếu không tìm thấy trong phường chính thức → thử tên phổ biến
      if (!found) {
        for (const [name, data] of Object.entries(TEN_PHO_BIEN)) {
          if (name.toLowerCase() === kw.toLowerCase() || kw.toLowerCase().includes(name.toLowerCase())) {
            data.quan.forEach(q => allQuan.add(q));
            data.phuong.forEach(p => allPhuong.add(p));
          }
        }
      }
    }
  }

  // Nếu vẫn không tìm được gì → fallback: dùng originalQuery tra lại local
  if (allPhuong.size === 0) {
    const fallback = tryLocalLookup(originalQuery);
    if (fallback) return fallback;
  }

  // Thêm phường giáp ranh
  for (const quan of allQuan) {
    if (GIAP_RANH[quan]) {
      GIAP_RANH[quan].forEach(p => allPhuong.add(p));
    }
  }

  return {
    quan_huyen: [...allQuan],
    khu_vuc: [...allPhuong],
    summary: summary || `Tìm phòng khu vực ${keywords.join(', ')}`,
  };
}

function addNearby(quan, phuong, set) {
  const phuongs = QUAN_PHUONG[quan];
  if (!phuongs) return;
  const idx = phuongs.findIndex(p => p.toLowerCase() === phuong.toLowerCase());
  if (idx === -1) return;
  // Thêm 3 phường trước + 3 phường sau trong danh sách (gần nhau về mặt địa lý trong cùng quận)
  for (let i = Math.max(0, idx - 3); i <= Math.min(phuongs.length - 1, idx + 3); i++) {
    set.add(phuongs[i]);
  }
}

// ============================================================
// AI CALL — prompt nhẹ, chỉ nhận diện type + keywords
// ============================================================
async function callAI(prompt) {
  // Try Groq
  const groqKeys = [];
  if (process.env.GROQ_API_KEY) groqKeys.push(process.env.GROQ_API_KEY);
  for (let i = 2; i <= 10; i++) {
    const val = process.env[`GROQ_API_KEY_${i}`];
    if (val) groqKeys.push(val);
  }

  if (groqKeys.length > 0) {
    const startIdx = Math.floor(Math.random() * groqKeys.length);
    for (let i = 0; i < groqKeys.length; i++) {
      const idx = (startIdx + i) % groqKeys.length;
      console.log(`[Search] Trying Groq key ${idx + 1}/${groqKeys.length}...`);
      const result = await callGroq(groqKeys[idx], prompt);
      if (result.data) {
        console.log(`[Search] Groq key ${idx + 1} → SUCCESS`);
        return result.data;
      }
      console.log(`[Search] Groq key ${idx + 1} → ${result.rateLimited ? '429' : 'failed'}`);
    }
  }

  // Fallback Gemini
  const geminiKeys = [];
  if (process.env.GEMINI_API_KEY) geminiKeys.push(process.env.GEMINI_API_KEY);
  for (let i = 2; i <= 10; i++) {
    const val = process.env[`GEMINI_API_KEY_${i}`];
    if (val) geminiKeys.push(val);
  }

  if (geminiKeys.length > 0) {
    const geminiBody = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 256 },
    });

    const startIdx = Math.floor(Math.random() * geminiKeys.length);
    for (let i = 0; i < geminiKeys.length; i++) {
      const idx = (startIdx + i) % geminiKeys.length;
      console.log(`[Search] Trying Gemini key ${idx + 1}...`);
      const result = await callGemini(geminiKeys[idx], geminiBody);
      if (result.data) {
        console.log(`[Search] Gemini key ${idx + 1} → SUCCESS`);
        return result.data;
      }
    }
  }

  return null;
}

// ============ GROQ ============
async function callGroq(apiKey, prompt) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'Return ONLY valid JSON, no markdown.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 256,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    if (response.status === 429) return { rateLimited: true, errorDetail: '429' };
    if (!response.ok) return { error: true, errorDetail: `HTTP ${response.status}` };

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    if (!content) return { error: true, errorDetail: 'Empty' };

    return parseJsonResponse(content);
  } catch (e) {
    return { error: true, errorDetail: e.message };
  } finally {
    clearTimeout(timeout);
  }
}

// ============ GEMINI ============
async function callGemini(apiKey, requestBody) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: requestBody, signal: controller.signal }
    );

    if (response.status === 429) return { rateLimited: true };
    if (!response.ok) return { error: true, errorDetail: `HTTP ${response.status}` };

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!content) return { error: true, errorDetail: 'Empty' };

    return parseJsonResponse(content);
  } catch (e) {
    return { error: true, errorDetail: e.message };
  } finally {
    clearTimeout(timeout);
  }
}

// ============ JSON Parser ============
function parseJsonResponse(content) {
  let jsonStr = '';
  const codeBlock = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) jsonStr = codeBlock[1].trim();
  else {
    const m = content.match(/\{[\s\S]*\}/);
    if (m) jsonStr = m[0];
  }
  if (!jsonStr) return { error: true, errorDetail: 'No JSON' };

  try { return { data: JSON.parse(jsonStr) }; }
  catch {
    try { return { data: JSON.parse(jsonStr.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']').replace(/'/g, '"')) }; }
    catch { return { error: true, errorDetail: 'JSON parse failed' }; }
  }
}
