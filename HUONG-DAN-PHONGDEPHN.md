╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║                  PHÒNG ĐẸP HN — TÀI LIỆU DỰ ÁN                ║
║                                                                  ║
║        Thuyết minh cấu trúc · Cài đặt · Hướng dẫn sử dụng      ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝

Phiên bản 1.0 — Tháng 2/2026
Zalo: 0961 685 136



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MỤC LỤC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  PHẦN A — THUYẾT MINH CẤU TRÚC DỰ ÁN
    A1. Tổng quan dự án
    A2. Hệ sinh thái công nghệ
    A3. Cấu trúc thư mục (từng file làm gì)
    A4. Dòng chảy dữ liệu (data chạy từ đâu đến đâu)
    A5. 3 trang web trong dự án

  PHẦN B — HƯỚNG DẪN CÀI ĐẶT (CÁC API KEY)
    B1. Lấy Gemini API Key (AI đọc tin nhắn)
    B2. Tạo tài khoản Cloudinary (lưu ảnh + video)
    B3. Tạo Google Sheets + Service Account (database)
    B4. Tạo file .env (dán tất cả key vào đây)
    B5. Chạy dự án lần đầu
    B6. Deploy lên mạng (Vercel)

  PHẦN C — HƯỚNG DẪN SỬ DỤNG
    C1. Quy trình nhập 1 phòng (Admin Tool)
    C2. Cách khách thuê sử dụng website
    C3. Quản lý phòng trên Google Sheets
    C4. Xử lý lỗi thường gặp



╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║         PHẦN A — THUYẾT MINH CẤU TRÚC DỰ ÁN                    ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝


┌─────────────────────────────────────────────────────────────────┐
│ A1. TỔNG QUAN DỰ ÁN                                            │
└─────────────────────────────────────────────────────────────────┘

Phòng Đẹp HN là hệ thống gồm 2 phần:

  ┌──────────────┐         ┌──────────────────┐
  │  ADMIN TOOL  │ ──────> │  WEBSITE KHÁCH   │
  │  (Bạn dùng)  │         │  (Khách thuê xem)│
  └──────────────┘         └──────────────────┘
        │                          │
        │    ┌────────────────┐    │
        └──> │ GOOGLE SHEETS  │ <──┘
             │   (Database)   │
             └────────────────┘

  Admin Tool:  Bạn paste tin nhắn Zalo + thả ảnh/video
               --> AI tự đọc và điền form
               --> Bạn kiểm tra, nhấn xác nhận
               --> Data tự chạy vào Google Sheets

  Website:     Khách thuê mở link, tự lọc quận/giá/loại phòng,
               tự chọn phòng ưng, nhắn Zalo cho bạn.

Toàn bộ miễn phí (trừ tên miền ~250k/năm nếu muốn).


┌─────────────────────────────────────────────────────────────────┐
│ A2. HỆ SINH THÁI CÔNG NGHỆ                                     │
└─────────────────────────────────────────────────────────────────┘

  Thành phần            Công cụ                Chi phí
  ─────────────────     ──────────────────     ─────────────
  Website + Admin       React + Vite + Vercel  Miễn phí
  AI đọc tin nhắn       Google Gemini 2.0      Miễn phí (*)
  Lưu ảnh + video       Cloudinary             Miễn phí 25GB
  Database phòng        Google Sheets          Miễn phí
  Tên miền (tuỳ chọn)  phongdephn.com         ~250k/năm

  (*) Gemini free tier: 15 requests/phút, 1 triệu tokens/tháng.
      Nhập 30 phòng/ngày = ~900 req/tháng, dư rất nhiều.


┌─────────────────────────────────────────────────────────────────┐
│ A3. CẤU TRÚC THƯ MỤC — TỪNG FILE LÀM GÌ                      │
└─────────────────────────────────────────────────────────────────┘

  PhongdepHN/
  │
  ├── index.html ················ Trang HTML gốc (khung chứa app)
  ├── package.json ·············· Danh sách thư viện cần cài
  ├── vite.config.js ············ Cấu hình build tool (Vite)
  ├── vercel.json ··············· Cấu hình deploy Vercel
  ├── .env.example ·············· Mẫu file cấu hình (copy ra .env)
  ├── .env ······················ File cấu hình thật (BẠN TẠO, KHÔNG CHIA SẺ)
  ├── start.bat ················· Nhấn đúp để chạy dự án trên máy
  │
  ├── src/ ······················ MÃ NGUỒN GIAO DIỆN
  │   ├── main.jsx ·············· Điểm khởi đầu của app
  │   ├── App.jsx ··············· Bộ định tuyến (quyết định hiện trang nào)
  │   │
  │   ├── pages/
  │   │   ├── AdminTool.jsx ····· ADMIN TOOL — trang nhập phòng
  │   │   │                       Gồm: ô paste text, thả ảnh, thả video,
  │   │   │                       nút "Xử lý tự động", form review,
  │   │   │                       preview phòng, nút xác nhận
  │   │   │
  │   │   ├── RoomList.jsx ······ WEBSITE — danh sách phòng + bộ lọc
  │   │   │                       Gồm: thanh tìm kiếm, filter quận/giá/
  │   │   │                       loại phòng/tiện ích, grid card phòng
  │   │   │
  │   │   └── RoomDetail.jsx ···· WEBSITE — chi tiết 1 phòng
  │   │                           Gồm: gallery ảnh/video, thông tin,
  │   │                           giá dịch vụ, nút nhắn Zalo/gọi
  │   │
  │   └── utils/
  │       ├── theme.js ·········· Màu sắc, danh sách quận, loại phòng,
  │       │                       hàm format giá (4500000 -> "4.5 tr")
  │       │
  │       └── api.js ············ Gọi API từ giao diện:
  │                               - parseTextWithClaude() -> gửi text cho AI
  │                               - uploadToCloudinary()  -> upload ảnh/video
  │                               - pushToGoogleSheets()  -> đẩy data vào Sheet
  │                               - fetchRoomsFromSheets()-> lấy phòng cho web
  │
  └── api/ ······················ SERVERLESS FUNCTIONS (chạy trên server)
      │
      ├── parse.js ·············· Nhận text tin nhắn Zalo
      │                           -> Gửi cho Gemini AI
      │                           -> Gemini trả về JSON có cấu trúc:
      │                              { quan, gia, dia_chi, dien_tich,
      │                                loai_phong, khep_kin, pet, ... }
      │                           -> Kèm confidence level (chắc chắn / cần kiểm tra)
      │
      ├── sheets.js ············· Nhận data phòng đã xác nhận
      │                           -> Tạo JWT token (xác thực Google)
      │                           -> Ghi 1 dòng mới vào Google Sheet
      │                           -> Cột A-U: ID, địa chỉ, giá, ảnh, video...
      │
      └── rooms.js ·············· Website gọi API này để lấy danh sách phòng
                                  -> Đọc toàn bộ Google Sheet
                                  -> Lọc phòng có trạng thái "available"
                                  -> Trả về JSON cho website hiển thị
                                  -> Cache 5 phút (không gọi Sheet liên tục)


┌─────────────────────────────────────────────────────────────────┐
│ A4. DÒNG CHẢY DỮ LIỆU                                          │
└─────────────────────────────────────────────────────────────────┘

  Khi bạn nhập 1 phòng qua Admin Tool, data chạy như sau:

  ┌─────────────┐
  │ Tin nhắn    │     ┌─────────────┐     ┌──────────────┐
  │ Zalo        │────>│ Gemini AI   │────>│ JSON có cấu  │
  │ (text thô)  │     │ (parse.js)  │     │ trúc         │
  └─────────────┘     └─────────────┘     └──────┬───────┘
                                                  │
  ┌─────────────┐                                 │
  │ Ảnh (JPG,   │     ┌─────────────┐             │
  │ PNG, WebP)  │────>│ Cloudinary  │──> URL ảnh ─┤
  └─────────────┘     └─────────────┘             │
                                                  │  3 luồng chạy
  ┌─────────────┐                                 │  SONG SONG
  │ Video (MP4, │     ┌─────────────┐             │  (~15-20 giây)
  │ MOV)        │────>│ Cloudinary  │──> URL vid ─┤
  └─────────────┘     └─────────────┘             │
                                                  ▼
                                          ┌──────────────┐
                                          │ Form Review  │
                                          │ (bạn kiểm    │
                                          │ tra + sửa)   │
                                          └──────┬───────┘
                                                 │
                                                 │ Nhấn "Xác nhận"
                                                 ▼
                                          ┌──────────────┐
                                          │ Google       │
                                          │ Sheets       │
                                          │ (sheets.js)  │
                                          └──────┬───────┘
                                                 │
                                                 │ Website tự đọc
                                                 ▼
                                          ┌──────────────┐
                                          │ Website      │
                                          │ khách thuê   │
                                          │ (rooms.js)   │
                                          └──────────────┘

  Thời gian: ~1.5 phút/phòng (30s paste + 20s chờ AI + 15s review + 5s xác nhận)


┌─────────────────────────────────────────────────────────────────┐
│ A5. BA TRANG WEB TRONG DỰ ÁN                                   │
└─────────────────────────────────────────────────────────────────┘

  Đường dẫn (URL)        Ai dùng        Chức năng
  ─────────────────      ──────────     ────────────────────────
  /                      Khách thuê     Danh sách phòng + bộ lọc
  /phong/abc123          Khách thuê     Chi tiết 1 phòng cụ thể
  /admin                 Chỉ bạn        Admin Tool nhập phòng

  Cả 3 trang nằm trong cùng 1 website, chung 1 link.
  VD: phongdephn.vercel.app       (trang chính)
      phongdephn.vercel.app/admin  (admin tool)

  File App.jsx quyết định hiển thị trang nào:

      URL chứa "/"           -> hiện RoomList.jsx
      URL chứa "/phong/..."  -> hiện RoomDetail.jsx
      URL chứa "/admin"      -> hiện AdminTool.jsx



╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║         PHẦN B — HƯỚNG DẪN CÀI ĐẶT (CÁC API KEY)              ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝

  Bạn cần lấy 3 "chìa khoá" từ 3 dịch vụ miễn phí,
  rồi dán tất cả vào 1 file duy nhất (.env).

  Tổng thời gian: ~25-30 phút lần đầu. Chỉ làm 1 lần duy nhất.

  ┌────────────────────────────────────────────────────────────┐
  │  Bước 1: Gemini Key ──> dán vào .env                      │
  │  Bước 2: Cloudinary  ──> dán vào .env                     │
  │  Bước 3: Google Sheet ──> dán vào .env                    │
  │  Bước 4: Tạo file .env                                    │
  │  Bước 5: Chạy                                             │
  └────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────┐
│ B1. LẤY GEMINI API KEY                                  ~5 phút│
│     (AI miễn phí để đọc tin nhắn Zalo)                          │
└─────────────────────────────────────────────────────────────────┘

  1. Mở trình duyệt, vào:

         https://aistudio.google.com/apikey

  2. Đăng nhập bằng tài khoản Google (Gmail) của bạn

  3. Nhấn nút [Create API Key]

  4. Một cửa sổ hiện ra, chọn [Create API key in new project]

  5. Sau vài giây, bạn sẽ thấy một đoạn mã dài dạng:

         AIzaSyB_xxxxxxxxxxxxxxxxxxxxxxxxxxxx

  6. Nhấn nút Copy bên cạnh

  7. Mở Notepad, dán vào, ghi chú: "GEMINI KEY"
     GIỮ CỬA SỔ NOTEPAD MỞ, lát nữa dùng tiếp.


┌─────────────────────────────────────────────────────────────────┐
│ B2. TẠO TÀI KHOẢN CLOUDINARY                           ~5 phút│
│     (Lưu ảnh + video miễn phí 25GB)                             │
└─────────────────────────────────────────────────────────────────┘

  1. Mở trình duyệt, vào:

         https://cloudinary.com/users/register/free

  2. Điền form đăng ký (tên, email, mật khẩu) --> nhấn Create Account

  3. Sau khi đăng nhập, bạn sẽ thấy trang Dashboard.
     Nhìn phần "Product Environment Credentials" có dòng:

         Cloud Name:  dxxxxxxx

     Copy cái "Cloud Name" này --> dán vào Notepad, ghi chú "CLOUD NAME"

  4. Tạo Upload Preset (để website được phép upload ảnh):

     a) Nhấn biểu tượng bánh răng (Settings) ở sidebar trái
     b) Nhấn mục "Upload" ở menu bên trái
     c) Kéo xuống tìm "Upload presets"
     d) Nhấn [Add upload preset]
     e) Điền:
          - Upload preset name: gõ     phongdephn_unsigned
          - Signing Mode: chọn         Unsigned
          - Folder: gõ                 phongdephn
     f) Nhấn [Save]

  Xong. Bạn đã có 2 giá trị cần lưu:
    - Cloud Name:      dxxxxxxx
    - Upload Preset:   phongdephn_unsigned


┌─────────────────────────────────────────────────────────────────┐
│ B3. TẠO GOOGLE SHEETS + SERVICE ACCOUNT               ~15 phút │
│     (Database lưu phòng)                                        │
└─────────────────────────────────────────────────────────────────┘

  Bước này dài nhất nhưng chỉ làm 1 lần. Có 3 phần nhỏ.


  ── B3a. Tạo Google Sheet ──────────────────────────────────────

  1. Mở trình duyệt, vào:

         https://sheets.google.com

  2. Nhấn dấu [+] để tạo bảng tính mới

  3. Đặt tên bảng tính: PhongDepHN Database
     (nhấn vào chữ "Untitled spreadsheet" ở góc trên trái để đổi tên)

  4. Ở HÀNG 1 (hàng đầu tiên), gõ vào từng ô:

     Ô A1 gõ: ID
     Ô B1 gõ: Ma_toa
     Ô C1 gõ: Dia_chi
     Ô D1 gõ: Quan
     Ô E1 gõ: Khu_vuc
     Ô F1 gõ: Gia
     Ô G1 gõ: Dien_tich
     Ô H1 gõ: Loai_phong
     Ô I1 gõ: Khep_kin
     Ô J1 gõ: Xe_dien
     Ô K1 gõ: Pet
     Ô L1 gõ: Dien
     Ô M1 gõ: Nuoc
     Ô N1 gõ: Internet
     Ô O1 gõ: Noi_that
     Ô P1 gõ: Mo_ta
     Ô Q1 gõ: Hoa_hong
     Ô R1 gõ: Images
     Ô S1 gõ: Videos
     Ô T1 gõ: Ngay_dang
     Ô U1 gõ: Trang_thai

  5. Nhìn lên thanh địa chỉ trình duyệt, URL có dạng:

         https://docs.google.com/spreadsheets/d/1aBcDeFgHiJkLmNoPqRsTuVwXyZ/edit

     Phần ở giữa (1aBcDeFgHiJkLmNoPqRsTuVwXyZ) chính là SHEET ID.
     Copy nó --> dán vào Notepad, ghi chú "SHEET ID"


  ── B3b. Tạo Google Service Account ───────────────────────────

  Đây là "tài khoản robot" để website tự động đọc/ghi Google Sheet.

  1. Mở trình duyệt, vào:

         https://console.cloud.google.com

  2. Đăng nhập bằng CÙNG tài khoản Google đã tạo Sheet

  3. Tạo Project mới:
     - Nhấn vào tên project ở góc trên trái (hoặc "Select a project")
     - Nhấn [New Project]
     - Project name: gõ     PhongDepHN
     - Nhấn [Create]
     - Chờ vài giây, nhấn thông báo để chuyển sang project mới

  4. Bật Google Sheets API:
     - Vào link:

           https://console.cloud.google.com/apis/library/sheets.googleapis.com

     - Nhấn nút [Enable] màu xanh
     - Chờ vài giây cho đến khi thấy "API enabled"

  5. Tạo Service Account:
     - Vào link:

           https://console.cloud.google.com/iam-admin/serviceaccounts

     - Nhấn [+ Create Service Account]
     - Service account name: gõ     phongdephn
       (Service account ID tự điền, không cần sửa)
     - Nhấn [Create and Continue]
     - Phần "Grant this service account access":
         Role: tìm và chọn "Editor"
     - Nhấn [Continue] rồi [Done]

  6. Tạo Key (chìa khoá):
     - Ở bảng danh sách, nhấn vào service account vừa tạo
       (dòng có email dạng phongdephn@...iam.gserviceaccount.com)
     - Nhấn tab [Keys] ở menu trên
     - Nhấn [Add Key] --> [Create new key]
     - Chọn [JSON] --> nhấn [Create]
     - MỘT FILE JSON SẼ TỰ TẢI VỀ MÁY (tên dạng phongdephn-xxxxx.json)

  7. Mở file JSON vừa tải bằng Notepad.
     Tìm 2 dòng sau:

         "client_email": "phongdephn@ten-project.iam.gserviceaccount.com",

         "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQ...(rất dài)...\n-----END PRIVATE KEY-----\n",

     Copy CẢ 2 GIÁ TRỊ này --> dán vào Notepad, ghi chú:
       "SERVICE EMAIL" và "PRIVATE KEY"


  ── B3c. Chia sẻ Sheet cho Service Account ─────────────────────

  Nếu không làm bước này, website sẽ không đọc/ghi được Sheet.

  1. Quay lại Google Sheet ở bước B3a

  2. Nhấn nút [Share] (Chia sẻ) ở góc trên bên phải

  3. Ở ô "Add people and groups", dán email Service Account:

         phongdephn@ten-project.iam.gserviceaccount.com

     (chính là "client_email" ở bước B3b.7)

  4. Chọn quyền: Editor

  5. Bỏ tick "Notify people" (không cần gửi email thông báo)

  6. Nhấn [Share]

  Xong bước 3. Bạn đã có tất cả "chìa khoá" cần thiết.


┌─────────────────────────────────────────────────────────────────┐
│ B4. TẠO FILE .env                                       ~2 phút│
│     (Dán tất cả key vào 1 file)                                │
└─────────────────────────────────────────────────────────────────┘

  1. Mở thư mục dự án:

         C:\Users\PC\OneDrive\Desktop\PhongdepHN

  2. Tìm file tên ".env.example"
     (Nếu không thấy: nhấn View ở thanh trên --> tick "File name extensions"
      và "Hidden items")

  3. Nhấn chuột phải vào ".env.example" --> Copy

  4. Paste ngay trong thư mục đó --> file mới tên ".env.example - Copy"

  5. Đổi tên thành:   .env
     (Nếu Windows báo lỗi, gõ tên là:   .env.    có dấu chấm cuối,
      Windows sẽ tự bỏ dấu chấm thừa)

  6. Nhấn chuột phải vào file .env --> Open with --> Notepad

  7. Xoá nội dung cũ, dán nội dung mới (thay bằng key thật của bạn):

     ┌──────────────────────────────────────────────────────────┐
     │                                                          │
     │  GEMINI_API_KEY=AIzaSyB_key_cua_ban_o_day                │
     │                                                          │
     │  VITE_CLOUDINARY_CLOUD_NAME=cloud_name_cua_ban           │
     │  VITE_CLOUDINARY_UPLOAD_PRESET=phongdephn_unsigned       │
     │                                                          │
     │  GOOGLE_SHEETS_ID=id_sheet_cua_ban                       │
     │  GOOGLE_SERVICE_ACCOUNT_EMAIL=phongdephn@xxx.iam...com   │
     │  GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...    │
     │  ...(copy nguyên cục private_key từ file JSON)...\n      │
     │  -----END PRIVATE KEY-----\n"                            │
     │                                                          │
     └──────────────────────────────────────────────────────────┘

  8. Lưu file (Ctrl + S)

  LƯU Ý QUAN TRỌNG:
  - Mỗi dòng bắt đầu bằng TÊN_BIẾN=giá_trị (không có dấu cách quanh dấu =)
  - PRIVATE_KEY phải bọc trong dấu ngoặc kép "..."
  - KHÔNG CHIA SẺ file .env cho ai. Đây là mật khẩu của dự án.


┌─────────────────────────────────────────────────────────────────┐
│ B5. CHẠY DỰ ÁN LẦN ĐẦU                                ~1 phút│
└─────────────────────────────────────────────────────────────────┘

  CÁCH 1 — Nhấn đúp (dễ nhất):

     Vào thư mục PhongdepHN --> nhấn đúp file "start.bat"

     Một cửa sổ đen hiện ra, chờ vài giây đến khi thấy:

         Local: http://localhost:5173/

     Mở trình duyệt, vào:
       - http://localhost:5173          (website khách)
       - http://localhost:5173/admin    (admin tool)


  CÁCH 2 — Mở PowerShell thủ công:

     Nhấn phím Windows --> gõ "powershell" --> Enter
     Gõ lần lượt 3 dòng (Enter sau mỗi dòng):

         $env:PATH = "C:\Users\PC\AppData\Local\nodejs;$env:PATH"
         cd C:\Users\PC\OneDrive\Desktop\PhongdepHN
         npm run dev

     Khi thấy dòng "Local: http://localhost:5173/" là thành công.


  MUỐN TẮT? Nhấn Ctrl + C trong cửa sổ đen, rồi đóng cửa sổ.


┌─────────────────────────────────────────────────────────────────┐
│ B6. DEPLOY LÊN MẠNG (VERCEL)                          ~10 phút│
│     (Để khách mở link bất kỳ lúc nào, không cần bật máy bạn)  │
└─────────────────────────────────────────────────────────────────┘

  ── B6a. Đưa code lên GitHub ──────────────────────────────────

  1. Vào https://github.com --> đăng ký tài khoản (nếu chưa có)

  2. Đăng nhập --> nhấn dấu [+] góc trên phải --> [New repository]
     - Repository name: gõ     phongdephn
     - Chọn:                   Private (quan trọng, để bảo mật)
     - Nhấn [Create repository]

  3. Mở PowerShell (cách mở: xem B5 cách 2), gõ lần lượt:

         $env:PATH = "C:\Users\PC\AppData\Local\nodejs;$env:PATH"
         cd C:\Users\PC\OneDrive\Desktop\PhongdepHN
         git init
         git add .
         git commit -m "Initial commit"
         git branch -M main
         git remote add origin https://github.com/TEN_CUA_BAN/phongdephn.git
         git push -u origin main

     (Thay TEN_CUA_BAN bằng username GitHub của bạn)

     Lần đầu push, Windows sẽ hỏi đăng nhập GitHub --> đăng nhập bình thường.


  ── B6b. Deploy lên Vercel ────────────────────────────────────

  1. Mở trình duyệt, vào:

         https://vercel.com

  2. Nhấn [Sign Up] --> chọn "Continue with GitHub"

  3. Sau khi đăng nhập, nhấn [Add New...] --> [Project]

  4. Tìm repo "phongdephn" --> nhấn [Import]

  5. Phần "Framework Preset": chọn Vite

  6. MỞ RỘNG phần "Environment Variables" (nhấn vào nó)
     Thêm từng biến (gõ Name rồi Value, nhấn Add):

     ┌─────────────────────────────────┬─────────────────────────┐
     │ Name (gõ chính xác)            │ Value (dán key của bạn) │
     ├─────────────────────────────────┼─────────────────────────┤
     │ GEMINI_API_KEY                  │ AIzaSyB_...             │
     │ VITE_CLOUDINARY_CLOUD_NAME     │ dxxxxxxx                │
     │ VITE_CLOUDINARY_UPLOAD_PRESET  │ phongdephn_unsigned     │
     │ GOOGLE_SHEETS_ID               │ 1aBcDeF...              │
     │ GOOGLE_SERVICE_ACCOUNT_EMAIL   │ phongdephn@...com       │
     │ GOOGLE_PRIVATE_KEY             │ -----BEGIN PRIVATE...   │
     └─────────────────────────────────┴─────────────────────────┘

  7. Nhấn [Deploy]

  8. Chờ 1-2 phút. Khi xong, Vercel cho bạn link dạng:

         https://phongdephn.vercel.app

     Đây chính là link website công khai.
     Admin Tool ở: https://phongdephn.vercel.app/admin



╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║         PHẦN C — HƯỚNG DẪN SỬ DỤNG                              ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝


┌─────────────────────────────────────────────────────────────────┐
│ C1. QUY TRÌNH NHẬP 1 PHÒNG (Admin Tool)              ~1.5 phút│
└─────────────────────────────────────────────────────────────────┘

  Mở Admin Tool: vào /admin trên trình duyệt.

  Giao diện chia 2 cột: trái là INPUT, phải là TRẠNG THÁI.


  ── Bước 1: Paste text ─────────────────────────────────────────

     Vào nhóm Zalo, copy toàn bộ tin nhắn mô tả phòng.
     Dán (Ctrl+V) vào ô "Text từ Zalo" ở Admin Tool.

     Tin nhắn kiểu:
       "Mã F066 - Ngõ 690 Lạc Long Quân, Tây Hồ
        Giá 4tr5 - 25m2 - Khép kín
        Điện 4k, nước 30k, net free
        Full nội thất: điều hoà, nóng lạnh, giường, tủ
        Hoa hồng 30%"


  ── Bước 2: Thả ảnh ───────────────────────────────────────────

     Mở folder ảnh phòng trên máy.
     Chọn tất cả ảnh (Ctrl+A) --> kéo thả vào ô "Ảnh phòng".
     Hoặc click vào ô đó để mở cửa sổ chọn file.

     Hỗ trợ: JPG, PNG, WebP. Nhiều ảnh cùng lúc.
     Muốn xoá ảnh: nhấn nút [x] trên ảnh.


  ── Bước 3: Thả video (nếu có) ────────────────────────────────

     Tương tự ảnh, kéo thả video vào ô "Video phòng".
     Hỗ trợ: MP4, MOV.


  ── Bước 4: Nhấn "Xử lý tự động" ─────────────────────────────

     Nhấn nút xanh lá ở dưới. 3 việc chạy CÙNG LÚC:

       [==========] AI Parse text       OK    (Gemini đọc tin nhắn)
       [========  ] Upload 5 ảnh        80%   (gửi ảnh lên Cloudinary)
       [======    ] Upload 1 video      60%   (gửi video lên Cloudinary)

     Tổng thời gian: ~15-20 giây.


  ── Bước 5: Review form ───────────────────────────────────────

     Sau khi xử lý xong, giao diện chuyển sang 2 cột mới:
       - Trái: FORM với data AI đã điền sẵn
       - Phải: PREVIEW (phòng hiển thị trên website sẽ trông như thế nào)

     Hệ thống đánh dấu màu cho mỗi trường:
       - Viền bình thường  = AI chắc chắn (confidence: high)
       - Viền vàng [?]     = AI không chắc, BẠN CẦN KIỂM TRA
       - Viền đỏ [!]       = AI không tìm thấy, BẠN CẦN ĐIỀN

     Các trường trong form:
       Mã toà nhà ......... VD: F066
       Địa chỉ ............ VD: Ngõ 690 Lạc Long Quân
       Quận ............... Dropdown 12 quận Hà Nội
       Khu vực ............ VD: Lạc Long Quân
       Giá (VNĐ) ......... VD: 4500000  (đơn vị đồng)
       Diện tích (m2) ..... VD: 25
       Loại phòng ......... Dropdown: Phòng trọ / CCMN / Studio / Chung cư / Homestay
       WC Khép kín ........ Toggle bật/tắt
       Xe điện ............ Toggle bật/tắt
       Nuôi Pet ........... Toggle bật/tắt
       Điện ............... VD: 4.000đ/số
       Nước ............... VD: 30.000đ/người
       Internet ........... VD: Miễn phí
       Nội thất ........... VD: Điều hoà, nóng lạnh, giường, tủ
       Mô tả .............. VD: Phòng mới, thoáng mát
       Hoa hồng CTV ....... VD: 30%

     Lướt qua, sửa chỗ nào sai.


  ── Bước 6: Xác nhận ──────────────────────────────────────────

     Nhấn nút [Xác nhận & Đẩy vào Sheet]

     Nếu muốn nhập lại: nhấn [Nhập lại]

     Sau khi xác nhận:
       --> Data + URL ảnh + URL video được ghi vào Google Sheet
       --> Website khách tự hiển thị phòng mới (trong vài phút)
       --> Màn hình hiện "Đã đẩy thành công!"
       --> Tự reset sau 2.5 giây, sẵn sàng nhập phòng tiếp


┌─────────────────────────────────────────────────────────────────┐
│ C2. CÁCH KHÁCH THUÊ SỬ DỤNG WEBSITE                            │
└─────────────────────────────────────────────────────────────────┘

  Khách vào link website (VD: phongdephn.vercel.app)

  ── Trang chính (Danh sách phòng) ─────────────────────────────

     Gồm:
     - Thanh tìm kiếm: gõ địa chỉ, khu vực
     - Sidebar bộ lọc:
         Quận: dropdown 12 quận
         Loại phòng: dropdown 5 loại
         Mức giá: radio chọn 1 khoảng (dưới 3tr / 3-5tr / 5-7tr / 7-10tr / trên 10tr)
         Tiện ích: checkbox (Khép kín / Nuôi Pet / Xe điện)
         Nút "Xoá bộ lọc": reset về mặc định
     - Grid các card phòng:
         Mỗi card hiện: ảnh đại diện + loại phòng + giá + địa chỉ + m2

     Nhấn vào card --> mở trang chi tiết phòng.


  ── Trang chi tiết phòng ──────────────────────────────────────

     Gồm:
     - Gallery ảnh/video (vuốt trái phải, có thumbnail)
     - Thông tin đầy đủ: giá, diện tích, điện, nước, internet, nội thất
     - Các tag: loại phòng, quận, khép kín, pet, xe điện
     - Khung "Liên hệ xem phòng" (sticky bên phải):
         Nút [Nhắn Zalo xem phòng]  --> mở Zalo chat trực tiếp
         Nút [Gọi: 0961 685 136]    --> gọi điện trực tiếp
         Ghi chú mã phòng để hỗ trợ nhanh

  ── Cách gửi link cho khách ───────────────────────────────────

     Khách hỏi: "Anh ơi tìm phòng Cầu Giấy dưới 5 triệu"
     Bạn gửi link: phongdephn.vercel.app  (khách tự lọc)
     Hoặc gửi thẳng link 1 phòng cụ thể: phongdephn.vercel.app/phong/abc123


┌─────────────────────────────────────────────────────────────────┐
│ C3. QUẢN LÝ PHÒNG TRÊN GOOGLE SHEETS                           │
└─────────────────────────────────────────────────────────────────┘

  Mở Google Sheet "PhongDepHN Database".
  Mỗi hàng là 1 phòng. Bạn có thể:

  ── Đánh dấu phòng đã thuê ────────────────────────────────────

     Tìm cột U (Trang_thai), đổi "available" thành "rented"
     --> Phòng sẽ BIẾN MẤT khỏi website (tự động, trong 5 phút)

  ── Xoá phòng ─────────────────────────────────────────────────

     Hoặc đổi Trang_thai thành bất kỳ gì khác "available"
     Hoặc xoá cả hàng

  ── Sửa thông tin phòng ───────────────────────────────────────

     Sửa trực tiếp trên Sheet. Website sẽ cập nhật trong 5 phút
     (do cache 5 phút).

  ── Cấu trúc cột ──────────────────────────────────────────────

     A: ID (tự tạo, không sửa)        L: Điện
     B: Mã toà                         M: Nước
     C: Địa chỉ                        N: Internet
     D: Quận                            O: Nội thất
     E: Khu vực                         P: Mô tả
     F: Giá (số, VD: 4500000)          Q: Hoa hồng
     G: Diện tích (số, VD: 25)         R: Image URLs (phẩy cách)
     H: Loại phòng                     S: Video URLs (phẩy cách)
     I: Khép kín (TRUE/FALSE)          T: Ngày đăng
     J: Xe điện (TRUE/FALSE)           U: Trạng thái (available/rented)
     K: Pet (TRUE/FALSE)


┌─────────────────────────────────────────────────────────────────┐
│ C4. XỬ LÝ LỖI THƯỜNG GẶP                                      │
└─────────────────────────────────────────────────────────────────┘

  Lỗi                              Nguyên nhân & cách sửa
  ────────────────────────────      ────────────────────────────
  Nhấn start.bat không hiện gì     Node.js chưa đúng PATH.
                                    Mở PowerShell, chạy 3 lệnh ở B5.

  "Gemini API error"                Key sai hoặc thiếu.
                                    Mở .env kiểm tra GEMINI_API_KEY.
                                    Vào aistudio.google.com/apikey
                                    kiểm tra key còn hoạt động.

  "Sheets API error"                3 khả năng:
                                    1) Chưa bật Sheets API (xem B3b.4)
                                    2) Chưa share Sheet cho SA (xem B3c)
                                    3) PRIVATE_KEY sai format trong .env

  "Upload failed"                   Cloud Name hoặc Upload Preset sai.
                                    Vào Cloudinary Dashboard kiểm tra.

  Website không hiện phòng          Sheet trống hoặc chưa có phòng
                                    trạng thái "available".

  Ảnh không hiện trên web           Kiểm tra cột R trong Sheet có URL
                                    Cloudinary không. URL phải bắt đầu
                                    bằng https://res.cloudinary.com/...

  Website hiện "Đang tải..."        API bị lỗi. Mở trình duyệt, nhấn
  mãi không xong                    F12 --> tab Console, đọc lỗi đỏ.

  AI parse sai thông tin            Bình thường. AI không hoàn hảo.
                                    Sửa trong form review trước khi
                                    nhấn xác nhận. Các ô viền vàng/đỏ
                                    là AI tự báo "không chắc chắn".


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TÓM TẮT NHANH — CHECKLIST SETUP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [ ] B1. Có Gemini API Key
  [ ] B2. Có Cloudinary Cloud Name + Upload Preset
  [ ] B3. Có Google Sheet ID + Service Account Email + Private Key
  [ ] B3c. Đã share Sheet cho Service Account
  [ ] B4. Đã tạo file .env với đầy đủ 6 biến
  [ ] B5. Nhấn start.bat, thấy "localhost:5173"
  [ ] B6. (Tuỳ chọn) Đã deploy lên Vercel

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
