# -*- coding: utf-8 -*-
"""Cắt mặt bằng tòa thành ảnh layout từng trục.

Mặt bằng mọi tầng của một tòa giống hệt nhau, nên một ảnh trục dùng được cho mọi
căn cùng trục: tòa T1 có 450 căn nhưng chỉ cần 18 ảnh.

Mặt bằng Times City tô màu theo LOẠI căn, nên ranh giới các trục đọc được bằng chỗ
đổi màu — không phải khoanh tay từng ô.

    python scripts/catTrucMatBang.py T01 --do    # chỉ đo, in ra để điền CONFIG
    python scripts/catTrucMatBang.py T01         # cắt ảnh + ghi toạ độ
    python scripts/catTrucMatBang.py --tatca

Nguồn ảnh: public/mat-bang/truc/<tòa>.jpg nếu có, không thì public/mat-bang/<tòa>.jpg.
Nên đặt sẵn vào thư mục truc/ một bản mặt bằng gọn — còn đủ nhãn mã căn và diện tích,
nhưng không có tiêu đề, la bàn, sơ đồ vị trí — vì chính ảnh đó là nền khoanh đỏ.

Đầu ra:
    public/mat-bang/truc/<tòa>.jpg        ảnh nền để khoanh đỏ (giữ nguyên bản nguồn)
    public/mat-bang/truc/<tòa>-<trục>.jpg ảnh riêng từng trục
    src/data/matBangTruc.js               toạ độ % để khoanh đỏ bằng CSS
"""
import colorsys
import io
import json
import os
import re
import statistics as stat
import sys

from PIL import Image

GOC = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
THUMUC_MB = os.path.join(GOC, "public", "mat-bang")
THUMUC_RA = os.path.join(THUMUC_MB, "truc")
FILE_DATA = os.path.join(GOC, "src", "data", "matBangTruc.js")
DAU_FILE = ("// Toạ độ từng trục trên mặt bằng tòa, tính theo % ảnh trong public/mat-bang/truc.\n"
            "// SINH TỰ ĐỘNG bởi scripts/catTrucMatBang.py — sửa tay là lần chạy sau mất sạch.\n"
            "export default ")

CHAT_LUONG = 92    # ảnh nền: nét bản vẽ mảnh, nén mạnh là rỗ hết

# Khung đỏ nới ra ngoài mép căn một chút chứ không ôm sát: ôm sát thì lan can, tường bao
# không được tô màu rơi ra ngoài khung, nhìn như khoanh thiếu. Tính theo % ảnh để tòa
# ảnh to hay nhỏ nới ra một tỉ lệ như nhau.
LE_NGANG = 0.018
LE_DOC = 0.040

# Tối hơn mức này là MỰC. Dòng m² của nhãn P5 in xám nhạt, sáng tới ~150–180 — để 140
# là máy không thấy nó và đặt cạnh khung đè lên. Màu tô của căn bên cạnh (160–230) không
# bị vạ lây vì dải kiểm tra đã trừ hết cột thuộc căn khác (xem toa_do).
MUC = 185
CACH_CHU = 3       # dừng cách chữ ngần này pixel
MUC_LAC = 2        # hàng có tới ngần này pixel mực vẫn tính là sạch (nhiễu nén, răng cưa)


def toa_do(b, im_day, khac=()):
    """Bao (pixel) -> toạ độ % đã nới lề. `khac` = bao của các căn còn lại.

    Nới mỗi cạnh ra đủ lề, nhưng không được gạch qua chữ nhãn. Đi từ mép căn ra ngoài,
    đọc từng hàng của một dải kiểm tra:

    * Dải kiểm tra BỎ các cột thuộc bao của căn khác. Nét vẽ của căn bên cạnh lọt vào
      dải (P5-03 lấn 24px vào dải của P5-02) làm không hàng nào "sạch", và luật dò chữ
      chết lặng. Ta biết bao của mọi căn, không phải đoán thụt bao nhiêu cho đủ.
    * "Sạch" = không có MỰC; màu tô của căn bên cạnh vẫn được tính là sạch.
    * Mực ngay 1–2 hàng đầu kể từ mép căn là KHỐI DÍNH LIỀN — tường của chính căn, hoặc
      nhãn nằm trong hốc của căn (P5-02 có dòng "90,6m²" chồng lên mép căn). Khe dưới
      4 hàng vẫn thuộc khối (khoảng cách giữa hai dòng chữ chỉ 1–3 hàng). Phải đi qua
      hết khối rồi mới bắt đầu dò chữ; cho phép vượt lề mong muốn tới gấp đôi để thoát
      khối, và nét đỏ (vẽ phía trong khung) không được đè lên khối.
    * Qua khối rồi mà gặp mực -> đó là chữ nhãn ngoài căn, dừng cách nó CACH_CHU.
    * Mép căn trống ngay từ hàng đầu -> không có khối dính; mực gặp sau đó là chữ ngoài
      căn (P3-10 có "56,3 m²" cách đáy căn đúng 3 hàng — vẫn phải dừng trước nó).

    Không dùng "viền bao của tòa" làm mốc được: tòa chữ U như P3 có nhãn nằm ngay trong
    lòng khuyết, tức là BÊN TRONG viền bao — mốc đó cho phép khung gạch ngang chữ.
    """
    W, H = im_day.size
    px = im_day.load()
    lx, ly = W * LE_NGANG, H * LE_DOC
    net = max(3, round(W / 220))               # bề dày nét đỏ, như veKhoanhDo trong app
    bx1, by1, bx2, by2 = b

    def muc(x, y):
        r, g, bb = px[x, y]
        return (r * 299 + g * 587 + bb * 114) / 1000.0 < MUC

    # Dải kiểm tra thụt vào 15% mỗi đầu: nhãn của căn BÊN CẠNH nằm chéo góc, không
    # được để nó chặn cạnh của căn này.
    def thut(a, c):
        d = (c - a) * 0.15
        return int(a + d), int(c - d)

    sx1, sx2 = thut(bx1, bx2)
    sy1, sy2 = thut(by1, by2)

    # Bao của căn khác nở thêm vài pixel: tường bao của nó là nét đen nằm NGAY NGOÀI bao
    # màu (P5-03 bao tới x=313, tường ở 314–316). Trừ đúng bao màu là sót lại một vạch
    # mực dọc theo mọi hàng, không hàng nào sạch được.
    no = max(3, round(W * 0.005))
    khac_no = [(k[0] - no, k[1] - no, k[2] + no, k[3] + no) for k in khac]

    def hang(y):                   # dải ngang tại hàng y, trừ cột thuộc căn khác
        bo = [(k[0], k[2]) for k in khac_no if k[1] <= y <= k[3]]
        return [(x, y) for x in range(max(0, sx1), min(W, sx2 + 1))
                if not any(a <= x <= c for a, c in bo)]

    def cot(x):                    # dải dọc tại cột x, trừ hàng thuộc căn khác
        bo = [(k[1], k[3]) for k in khac_no if k[0] <= x <= k[2]]
        return [(x, y) for y in range(max(0, sy1), min(H, sy2 + 1))
                if not any(a <= y <= c for a, c in bo)]

    def sach(dai):                 # vài pixel mực lạc (nhiễu nén, răng cưa) vẫn là sạch
        return sum(1 for x, y in dai if muc(x, y)) <= MUC_LAC

    def noi(mep, mong, chieu, lay_dai, gioi_han, le):
        sach_lien, khoi, qua_khoi = 0, False, False
        v = mep + chieu
        buoc = 0
        while 0 <= v < gioi_han and abs(v - mep) <= 2 * le:
            buoc += 1
            if sach(lay_dai(v)):
                sach_lien += 1
                if (buoc <= 2 and not khoi) or sach_lien >= 4:
                    qua_khoi = True
            elif qua_khoi:
                return v - chieu * CACH_CHU            # chữ ngoài căn: dừng trước nó
            else:
                khoi, sach_lien = True, 0              # tường / nhãn trong hốc: đi tiếp
            # đủ lề, và phía trong đủ hàng sạch cho nét đỏ không đè lên khối
            if abs(v - mep) >= le and sach_lien >= net + CACH_CHU:
                return v
            v += chieu
        return mong                                    # kẹt trong khối quá 2 lề: đành lấy lề

    y1 = noi(by1, int(by1 - ly), -1, hang, H, ly)
    y2 = noi(by2, int(by2 + ly), +1, hang, H, ly)
    x1 = noi(bx1, int(bx1 - lx), -1, cot, W, lx)
    x2 = noi(bx2, int(bx2 + lx), +1, cot, W, lx)
    # không bao giờ bó hẹp hơn chính căn, và không ra ngoài ảnh
    x1, y1 = max(0, min(x1, bx1)), max(0, min(y1, by1))
    x2, y2 = min(W - 1, max(x2, bx2)), min(H - 1, max(y2, by2))
    return {"x": round(x1 / W * 100, 2), "y": round(y1 / H * 100, 2),
            "w": round((x2 - x1) / W * 100, 2), "h": round((y2 - y1) / H * 100, 2)}


def vien_toa_cua(im_day):
    """Viền vùng màu của tòa trên ảnh đầy đủ (chưa nới)."""
    cat, ox, oy = cat_khung(im_day)
    return (ox, oy, ox + cat.width, oy + cat.height)

# Mỗi tòa: danh sách DẢI MÀU theo thứ tự trái sang phải, mỗi dải ghi các trục trong đó.
#   ["04", "05"]            dải này một cột, ô trên là trục 04, ô dưới là 05
#   ["02", "01", "03"]      đầu hồi: trên / giữa / dưới, ô giữa khác màu hai ô kia
#   [["08","09"], ["10","11"]]  hai cột cùng một màu -> chia đôi dải tại tâm
# Chạy với --do để script in ra các dải màu đo được rồi điền vào đây.
# Cách 2 — VÙNG MÀU LIÊN THÔNG, cho tòa không xếp thành lưới cột đều.
# Tòa P1 hình chữ H, 17 trục xếp vòng quanh, mỗi căn một màu riêng. Khai báo mốc gần
# đúng (% ảnh) của từng trục; script tìm mảng màu liền chứa mốc đó rồi lấy bao của nó.
# Chạy với --vung để script in ra tâm của mọi mảng màu, chép vào đây là xong.
CONFIG_VUNG = {
    "P01": {
        "15": (16.4, 25.0), "16": (31.0, 26.7), "17": (44.7, 32.0), "01": (55.8, 31.1),
        "02": (63.8, 24.8), "03": (74.7, 26.1), "04": (84.9, 25.0),
        "12B": (11.7, 46.9), "05": (89.5, 46.9),
        "12A": (14.5, 72.9), "12": (24.0, 70.7), "11": (36.2, 72.5), "10": (45.3, 64.7),
        "09": (56.0, 64.7), "08": (64.3, 71.0), "07": (77.3, 70.7), "06": (86.8, 72.9),
    },
    # Cùng dáng chữ H với P1 nhưng hàng trên lệch: trái 3 căn (15,16,17), phải 4 (01..04).
    "P02": {
        "15": (19.5, 28.5), "16": (33.2, 29.5), "17": (42.8, 34.3), "01": (56.3, 33.7),
        "02": (61.3, 27.1), "03": (74.8, 26.9), "04": (80.9, 28.1),
        "12B": (14.7, 40.1), "05": (85.1, 40.1),
        "12A": (14.1, 65.8), "12": (22.4, 72.6), "11": (37.9, 71.0), "10": (43.4, 65.3),
        "09": (56.3, 65.3), "08": (62.0, 71.1), "07": (77.4, 72.6), "06": (85.7, 65.8),
    },
    # Chữ U, 18 trục, nhãn ghi "CH-xx". Bốn góc là bốn căn to (15, 03, 11, 06); nhãn của
    # hàng trên nằm trong lòng khuyết chữ U.
    "P03": {
        "15": (16.5, 12.3), "16": (30.3, 29.2), "17": (42.4, 28.5), "18": (49.7, 34.8),
        "01": (56.4, 32.0), "02": (69.5, 29.0), "03": (80.4, 14.1),
        "12B": (18.1, 29.5), "12A": (16.8, 46.2), "12": (18.2, 70.7), "11": (17.5, 85.6),
        "04": (82.3, 38.1), "05": (81.9, 62.7), "06": (80.3, 84.2),
        "10": (29.3, 68.5), "09": (43.9, 64.9), "08": (56.5, 65.2), "07": (69.8, 67.3),
    },
    # P05 KHÔNG nằm ở đây: tòa đó lấy từ khung vẽ tay (Cách 3). Để ở đây thì lần chạy lại
    # toàn bộ sẽ ghi đè khung vẽ tay bằng kết quả máy đo.
}

# Cách 1 — DẢI MÀU DỌC, cho tòa xếp thành lưới cột đều như T1.
CONFIG = {
    "T01": [
        ["02", "01", "03"],
        ["04", "05"],
        ["06", "07"],
        [["08", "09"], ["10", "11"]],
        ["12", "12A"],
        ["12B", "15"],
        ["16", "18", "17"],
    ],
}


def doc_ban_do():
    """Đọc lại bản đồ cũ để chạy một tòa không xoá mất các tòa đã làm trước."""
    if not os.path.exists(FILE_DATA):
        return {}
    s = open(FILE_DATA, encoding="utf-8").read()
    return json.loads(s[s.index("{"):s.rindex("}") + 1])


def ghi_ban_do(du):
    os.makedirs(os.path.dirname(FILE_DATA), exist_ok=True)
    body = json.dumps(du, indent=2, ensure_ascii=False, sort_keys=True)
    open(FILE_DATA, "w", encoding="utf-8").write(DAU_FILE + body + ";\n")


def ho_mau(px, x, y):
    """Họ màu của một pixel. Nét vẽ đen và nền trắng trả None."""
    r, g, b = px[x, y]
    mx, mn = max(r, g, b), min(r, g, b)
    if mx < 60 or (mx - mn) < 12:
        return None
    h = colorsys.rgb_to_hls(r / 255.0, g / 255.0, b / 255.0)[0] * 360
    if h < 20 or h >= 330:
        return "hong"
    if h < 45:
        return "cam"
    if h < 70:
        return "vang"
    if h < 170:
        return "xanhla"
    if h < 260:
        return "xanhduong"
    return "hong"          # tím nhạt và hồng nhạt cùng là một loại căn


def cat_khung(im):
    """Khoanh riêng hình tòa nhà để đo, trả về (ảnh đã cắt, lệch x, lệch y).

    Lọc theo pixel CÓ MÀU nên chữ (xám đen) tự rụng, không cần biết trước nó nằm đâu.
    Chỉ dùng để ĐO và để cắt ảnh trục — ảnh nền vẫn giữ nguyên bản đầy đủ, vì nhãn mã
    căn và diện tích nằm ngoài hình tòa, cắt đi là mất thông tin khách cần nhất.
    """
    W, H = im.size
    px = im.load()
    hang = [sum(1 for x in range(W) if ho_mau(px, x, y)) for y in range(H)]
    cot = [sum(1 for y in range(H) if ho_mau(px, x, y)) for x in range(W)]
    # Nhãn P1 in màu xanh ngọc nên cũng "có màu", và một hàng chữ đậm đủ dày để vượt
    # ngưỡng. Nhưng hàng chữ chỉ là một dải MỎNG vài pixel, tách rời khỏi tòa bởi khoảng
    # trắng; bỏ các dải mỏng đi là hàng chữ rụng. Không được lấy "dải dài nhất": tòa
    # hình chữ H bị hành lang giữa cắt làm hai dải, lấy một dải là mất nửa tòa.
    ys = bo_dai_mong([y for y, v in enumerate(hang) if v > W * 0.25], H * 0.05)
    xs = bo_dai_mong([x for x, v in enumerate(cot) if v > H * 0.20], W * 0.05)
    if not xs or not ys:
        raise SystemExit("khong tim thay vung mau nao trong anh")
    ox, oy = min(xs), min(ys)
    return im.crop((ox, oy, max(xs) + 1, max(ys) + 1)), ox, oy


def bo_dai_mong(chi_so, toi_thieu, ho=3):
    """Giữ lại các dải chỉ số liên tục dài từ `toi_thieu` trở lên, gộp làm một danh sách.
    Đứt quãng dưới `ho` phần tử vẫn tính là liền (nét tường, nhiễu nén)."""
    dai, cur = [], []
    for i in chi_so:
        if cur and i - cur[-1] > ho:
            dai.append(cur)
            cur = []
        cur.append(i)
    if cur:
        dai.append(cur)
    return [i for d in dai if len(d) >= toi_thieu for i in d]


def dai_mau_ngang(im):
    """Các dải màu theo trục X, đọc ở dải trên của tòa. Mỗi dải là một cột căn."""
    W, H = im.size
    px = im.load()
    ya, yb = int(H * 0.08), int(H * 0.38)
    day = []
    truoc = object()        # không phải None: cột đầu tiên thường trắng, vẫn phải mở dải
    for x in range(W):
        d = {}
        for y in range(ya, yb):
            m = ho_mau(px, x, y)
            if m:
                d[m] = d.get(m, 0) + 1
        m = max(d, key=d.get) if d else None
        if m and d[m] < (yb - ya) * 0.2:
            m = None
        if m != truoc:
            day.append([x, x, m])
            truoc = m
        else:
            day[-1][1] = x
    # bỏ dải mảnh (vạch tường, nhiễu nén ảnh) rồi nối hai đầu cho kín tòa
    dai = [d for d in day if d[2] and (d[1] - d[0]) >= W * 0.02]
    if dai:
        dai[0][0], dai[-1][1] = 0, W - 1
    return dai


def o_trong_cot(im, xa, xb, ds, tam_y):
    """Toạ độ từng căn trong một cột.

    Cột 2 căn: trên / dưới, cách nhau bởi hành lang giữa.
    Cột 3 căn (đầu hồi): căn giữa là căn khác màu, hai căn kia hình chữ L ôm quanh nó
    nên phải lấy bao của chính vùng màu, chia chữ nhật đều là cắt cụt mất một cánh.
    """
    px = im.load()
    H = im.size[1]
    lui = max(3, int((xb - xa) * 0.05))

    if len(ds) == 2:
        co = [y for y in range(H)
              if sum(1 for x in range(xa + lui, xb - lui) if ho_mau(px, x, y))
              > (xb - xa) * 0.15]
        tren = [y for y in co if y < tam_y]
        duoi = [y for y in co if y > tam_y]
        if not tren or not duoi:
            raise SystemExit("cot %d-%d: khong tach duoc o tren / o duoi" % (xa, xb))
        return {ds[0]: (xa, 0, xb, max(tren)), ds[1]: (xa, min(duoi), xb, H - 1)}, max(tren), min(duoi)

    # gom pixel theo họ màu để biết họ nào là căn giữa
    gom = {}
    for x in range(xa, xb + 1):
        for y in range(H):
            m = ho_mau(px, x, y)
            if m:
                gom.setdefault(m, []).append((x, y))
    # Nén JPEG đẻ ra vài chục pixel lạc màu quanh nét vẽ; để nguyên thì chúng thành một
    # "họ màu" riêng và bị nhận nhầm là một căn.
    nho_nhat = (xb - xa + 1) * H * 0.02
    gom = {m: ps for m, ps in gom.items() if len(ps) >= nho_nhat}
    if len(gom) < 2:
        raise SystemExit("cot %d-%d: can 2 ho mau tro len cho dau hoi" % (xa, xb))
    # Căn giữa = họ màu KHÔNG chạm mép trên lẫn mép dưới của tòa. Không dùng trọng tâm
    # được: hai căn trên và dưới cùng màu nên trọng tâm chung của chúng cũng rơi đúng
    # giữa, chọn theo trọng tâm là nhận nhầm cả cột thành một căn.
    def kep_giua(m):
        ys = [p[1] for p in gom[m]]
        return min(ys) > H * 0.1 and max(ys) < H * 0.9
    ung = [m for m in gom if kep_giua(m)]
    if len(ung) != 1:
        # dự phòng: họ màu trải dọc ít nhất
        ung = [min(gom, key=lambda m: max(p[1] for p in gom[m]) - min(p[1] for p in gom[m]))]
    giua = ung[0]

    bao = {}
    for m, ps in gom.items():
        for x, y in ps:
            n = ds[1] if m == giua else (ds[0] if y < tam_y else ds[2])
            b = bao.get(n)
            if b is None:
                bao[n] = [x, y, x, y]
            else:
                b[0], b[1] = min(b[0], x), min(b[1], y)
                b[2], b[3] = max(b[2], x), max(b[3], y)
    if len(bao) != 3:
        raise SystemExit("cot %d-%d: cho 3 o nhung ra %d" % (xa, xb, len(bao)))
    return {k: tuple(v) for k, v in bao.items()}, None, None


# ============ Cách 3: khung vẽ tay ============
#
# Người dùng tự khoanh đỏ từng trục trên ảnh chụp mặt bằng, gửi một thư mục gồm:
#   <tòa>.png / .jpg        mặt bằng sạch, KHÔNG có khung đỏ  -> thành ảnh nền
#   <tòa>-<trục>.jpg        mỗi ảnh đúng MỘT khung đỏ quanh trục đó
# Máy chỉ làm hai việc: tìm khung đỏ, và căn chỉnh từng ảnh về ảnh nền (ảnh chụp màn
# hình cắt lệch nhau vài pixel) bằng cách so khung bao của tòa. Khung giữ nguyên như vẽ,
# không nới thêm — người vẽ đã quyết định lề rồi.
#
#   python scripts/catTrucMatBang.py T18 --zip "C:\...\T18"
#
# Tên file phải mang ĐÚNG mã trục như trong mã căn (T18-12A.jpg, không phải T18-13.jpg):
# tên sai là khung gắn nhầm căn mà không ai báo. Lô nào đã lỡ đánh số liền thì khai lại
# ở DOI_TEN_ZIP, sau khi đã soi ảnh kiểm xác nhận từng cái.
DOI_TEN_ZIP = {
    "T18": {"13": "12A", "14": "12B"},   # đã soi ảnh: file 13 khoanh T18-12A, file 14 khoanh T18-12B
    "P08": {"13": "12A", "14": "12B"},   # đã soi ảnh: file 13 khoanh P8-12A, file 14 khoanh P8-12B
    "P07": {"13": "12A", "14": "12B"},   # đã soi ảnh: file 13 khoanh P7-12A, file 14 khoanh P7-12B
    "P06": {"13": "12A", "14": "12B"},   # đã soi ảnh: file 13 khoanh P6-12A, file 14 khoanh P6-12B
    "P05": {"13": "12A", "14": "12B"},   # đã soi ảnh: file 13 khoanh P5-12A, file 14 khoanh P5-12B
    "P09": {"13": "12A", "14": "12B"},   # đã soi ảnh: file 13 khoanh P9-12A, file 14 khoanh P9-12B
    "P10": {"13": "12A", "14": "12B"},   # đã soi ảnh: file 13 khoanh P10-12A, file 14 khoanh P10-12B
    "P11": {"13": "12A", "14": "12B"},   # đã soi ảnh: file 13 khoanh P11-12A, file 14 khoanh P11-12B
    "P12": {"13": "12A", "14": "12B"},   # đã soi ảnh: file 13 khoanh P12-12A, file 14 khoanh P12-12B
}
TRUC_HOP_LE = re.compile(r"^(\d{2}|12[AB])$")


def la_do(p):
    return p[0] > 190 and p[1] < 90 and p[2] < 90


def khung_toa_bo_do(im):
    """Khung bao vùng màu của tòa, bỏ qua pixel đỏ của khung vẽ tay."""
    W, H = im.size
    px = im.load()
    # Bỏ cả VIỀN 3px quanh nét đỏ, không chỉ pixel đỏ tinh: quanh nét khung có một lớp
    # răng cưa hồng nhạt — không đủ đỏ để bị loại, nhưng đủ "có màu" để được tính là tòa.
    # Khung vẽ chạy ra ngoài mép tòa là kéo giãn khung tòa (P9-01 cao thêm 12px).
    gan_do = [[False] * H for _ in range(W)]
    for x in range(W):
        for y in range(H):
            if la_do(px[x, y]):
                for xx in range(max(0, x - 3), min(W, x + 4)):
                    for yy in range(max(0, y - 3), min(H, y + 4)):
                        gan_do[xx][yy] = True
    def mau(x, y):
        p = px[x, y]
        return max(p) >= 70 and (max(p) - min(p)) >= 10 and not gan_do[x][y]
    hang = [sum(1 for x in range(W) if mau(x, y)) for y in range(H)]
    cot  = [sum(1 for y in range(H) if mau(x, y)) for x in range(W)]
    ys = bo_dai_mong([y for y, v in enumerate(hang) if v > W * 0.25], H * 0.05)
    xs = bo_dai_mong([x for x, v in enumerate(cot) if v > H * 0.20], W * 0.05)
    if not xs or not ys:
        raise SystemExit("khong tim thay vung mau cua toa trong anh")
    return min(xs), min(ys), max(xs), max(ys)


def khung_do_trong(im):
    """Khung đỏ vẽ tay = MẢNG ĐỎ LIỀN LỚN NHẤT trong ảnh.

    Không lấy bao của mọi pixel đỏ: bản vẽ P5 có sẵn vài ký hiệu đỏ nhỏ cạnh sảnh thang,
    gộp vào là khung giãn ra gần bằng cả tòa. Nét khung là một đường liền nên luôn là
    mảng lớn nhất; nối qua khe 2px để nét bị nén JPEG làm đứt vẫn tính là một.
    """
    W, H = im.size
    px = im.load()
    do = set((x, y) for x in range(W) for y in range(H) if la_do(px[x, y]))
    tot, tot_n = None, 0
    while do:
        x0, y0 = do.pop()
        ngan, n = [(x0, y0)], 0
        x1 = x2 = x0
        y1 = y2 = y0
        while ngan:
            x, y = ngan.pop()
            n += 1
            if x < x1: x1 = x
            if x > x2: x2 = x
            if y < y1: y1 = y
            if y > y2: y2 = y
            for dx in (-2, -1, 0, 1, 2):
                for dy in (-2, -1, 0, 1, 2):
                    p = (x + dx, y + dy)
                    if p in do:
                        do.discard(p)
                        ngan.append(p)
        if n > tot_n:
            tot, tot_n = (x1, y1, x2, y2), n
    if tot_n < 200:
        return None
    return tot


def lam_toa_zip(toa, thu_muc):
    import glob
    goc_fs = [f for f in glob.glob(os.path.join(thu_muc, toa + ".*")) if f.lower().endswith((".png", ".jpg", ".jpeg"))]
    if len(goc_fs) != 1:
        raise SystemExit("%s: can dung MOT anh nen %s.png/.jpg trong %s" % (toa, toa, thu_muc))
    goc = Image.open(goc_fs[0]).convert("RGB")
    GW, GH = goc.size
    if khung_do_trong(goc):
        raise SystemExit("%s: anh nen dang co khung do — anh nen phai sach" % toa)
    gk = khung_toa_bo_do(goc)
    doi = DOI_TEN_ZIP.get(toa, {})

    hop = {}
    for f in sorted(glob.glob(os.path.join(thu_muc, toa + "-*.*"))):
        duoi = os.path.splitext(os.path.basename(f))[0][len(toa) + 1:].upper()
        truc = doi.get(duoi, duoi)
        if not TRUC_HOP_LE.match(truc):
            raise SystemExit("%s: ten file %s -> truc '%s' khong hop le" % (toa, os.path.basename(f), truc))
        if truc in hop:
            raise SystemExit("%s: truc %s co hai file" % (toa, truc))
        im = Image.open(f).convert("RGB")
        kd = khung_do_trong(im)
        if not kd:
            raise SystemExit("%s: %s khong co khung do" % (toa, os.path.basename(f)))
        kt = khung_toa_bo_do(im)
        sx = (gk[2] - gk[0]) / float(kt[2] - kt[0])
        sy = (gk[3] - gk[1]) / float(kt[3] - kt[1])
        # Ảnh nền và ảnh vẽ chụp ở hai mức zoom khác nhau vẫn được (P5: nền to hơn 1,12
        # lần) — căn theo khung tòa đã tự lo tỉ lệ. Cái phải chặn là hai chiều phóng KHÁC
        # nhau: nghĩa là khung tòa đo sai ở một ảnh, và toạ độ chiếu ra sẽ lệch.
        if not (0.5 <= sx <= 2 and abs(sx / sy - 1) <= 0.03):
            raise SystemExit("%s: %s lech ti le voi anh nen (ngang %.3f, doc %.3f)" % (toa, os.path.basename(f), sx, sy))
        hop[truc] = (gk[0] + (kd[0] - kt[0]) * sx, gk[1] + (kd[1] - kt[1]) * sy,
                     gk[0] + (kd[2] - kt[0]) * sx, gk[1] + (kd[3] - kt[1]) * sy)
    if not hop:
        raise SystemExit("%s: khong co file %s-<truc>.jpg nao" % (toa, toa))

    os.makedirs(THUMUC_RA, exist_ok=True)
    goc.save(os.path.join(THUMUC_RA, "%s.jpg" % toa), quality=CHAT_LUONG, optimize=True)
    du = doc_ban_do()
    du[toa] = {t: {"x": round(b[0] / GW * 100, 2), "y": round(b[1] / GH * 100, 2),
                   "w": round((b[2] - b[0]) / GW * 100, 2), "h": round((b[3] - b[1]) / GH * 100, 2)}
               for t, b in sorted(hop.items())}
    ghi_ban_do(du)
    print("%s: %d truc tu khung ve tay  (mat bang %dx%d)" % (toa, len(hop), GW, GH))
    return hop


# ============ Cách 2: vùng màu liên thông ============

VOI = 4          # nối qua được tối đa ngần này pixel nét vẽ
SAI_MAU = 42     # hai pixel coi là cùng màu nếu lệch dưới mức này

def tim_vung(im):
    """Mọi mảng màu liền nhau trong ảnh, kèm bao và tâm.

    Vách tường đen mảnh cắt đứt mảng màu, nên cho phép nối qua vài pixel — nhưng chỉ khi
    hai đầu cùng màu, để không dính sang căn bên cạnh.
    """
    W, H = im.size
    px = im.load()
    # Ngưỡng bão hoà 8: nền trắng JPEG lệch tối đa 2, còn ô tô nhạt nhất đo được (xám-tím
    # P2-08 và P2-11) chỉ 11–12 — để 14 như trước là hai căn đó biến mất khỏi bản vẽ.
    #
    # Riêng P5-15 tô XÁM TRUNG TÍNH (bão hoà 0), không ngưỡng bão hoà nào bắt được. Nhận
    # thêm "mảng xám đặc": xám sáng 165–215 mà ô 5×5 quanh nó không dính nét tối nào.
    # Điều kiện lân cận là bắt buộc — viền răng cưa xám bám quanh mọi nét đen cũng sáng
    # cỡ đó, bỏ điều kiện là chúng nối nhau thành một mạng nhện phủ cả bản vẽ.
    def xam_dac(x, y):
        for dx in (-2, -1, 0, 1, 2):
            for dy in (-2, -1, 0, 1, 2):
                xx, yy = x + dx, y + dy
                if 0 <= xx < W and 0 <= yy < H:
                    r2, g2, b2 = px[xx, yy]
                    if (r2 * 299 + g2 * 587 + b2 * 114) / 1000.0 < 150:
                        return False
        return True

    mau = [[None] * H for _ in range(W)]
    for x in range(W):
        for y in range(H):
            r, g, b = px[x, y]
            mx, mn = max(r, g, b), min(r, g, b)
            if mx >= 70 and (mx - mn) >= 8:
                mau[x][y] = (r, g, b)
            elif 165 <= (r * 299 + g * 587 + b * 114) / 1000.0 <= 215 and xam_dac(x, y):
                mau[x][y] = (r, g, b)

    nhan = [[0] * H for _ in range(W)]
    ra = []
    for sx in range(W):
        for sy in range(H):
            if mau[sx][sy] is None or nhan[sx][sy]:
                continue
            k = len(ra) + 1
            nhan[sx][sy] = k
            ngan = [(sx, sy)]
            dem = tx = ty = 0
            x1 = x2 = sx
            y1 = y2 = sy
            tr = tg = tb = 0
            while ngan:
                x, y = ngan.pop()
                dem += 1
                tx += x
                ty += y
                if x < x1: x1 = x
                if x > x2: x2 = x
                if y < y1: y1 = y
                if y > y2: y2 = y
                c = mau[x][y]
                tr += c[0]
                tg += c[1]
                tb += c[2]
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    for b in range(1, VOI + 1):
                        nx, ny = x + dx * b, y + dy * b
                        if not (0 <= nx < W and 0 <= ny < H):
                            break
                        c2 = mau[nx][ny]
                        if c2 is None:
                            continue
                        if not nhan[nx][ny] and abs(c[0]-c2[0]) + abs(c[1]-c2[1]) + abs(c[2]-c2[2]) <= SAI_MAU:
                            nhan[nx][ny] = k
                            ngan.append((nx, ny))
                        break
            ra.append({"dt": dem, "bao": [x1, y1, x2, y2], "tam": (tx // dem, ty // dem),
                       "mau": (tr // dem, tg // dem, tb // dem)})

    nho = W * H * 0.004
    to = [v for v in ra if v["dt"] >= nho]
    vun = [v for v in ra if 150 <= v["dt"] < nho]

    # Mảnh vụn cùng màu nằm sát một mảng lớn là phần của căn đó bị vách tường cắt rời
    # (góc trên-trái căn P1-17 là 3.500 px như thế). Nới bao mảng lớn ra trùm mảnh.
    # Chạy hai lượt vì mảnh có thể chỉ chạm mảng lớn sau khi mảng đã nở ra trùm mảnh khác.
    GAN = 8
    def cung_mau(a, b):
        return abs(a[0]-b[0]) + abs(a[1]-b[1]) + abs(a[2]-b[2]) <= SAI_MAU
    def cham(a, b):
        return a[0] <= b[2] + GAN and b[0] <= a[2] + GAN and a[1] <= b[3] + GAN and b[1] <= a[3] + GAN
    for _ in range(2):
        con = []
        for v in vun:
            ung = [t for t in to if cung_mau(v["mau"], t["mau"]) and cham(v["bao"], t["bao"])]
            if not ung:
                con.append(v)
                continue
            # kẹt giữa hai mảng cùng màu (P1-09 và 10 cùng cam) thì về mảng có tâm gần hơn
            t = min(ung, key=lambda t: (t["tam"][0]-v["tam"][0])**2 + (t["tam"][1]-v["tam"][1])**2)
            t["bao"][0] = min(t["bao"][0], v["bao"][0])
            t["bao"][1] = min(t["bao"][1], v["bao"][1])
            t["bao"][2] = max(t["bao"][2], v["bao"][2])
            t["bao"][3] = max(t["bao"][3], v["bao"][3])
        vun = con
    for t in to:
        t["bao"] = tuple(t["bao"])
    return to


def lam_toa_vung(toa, chi_do=False):
    nguon = os.path.join(THUMUC_RA, "%s.jpg" % toa)
    if not os.path.exists(nguon):
        nguon = os.path.join(THUMUC_MB, "%s.jpg" % toa)
    if not os.path.exists(nguon):
        raise SystemExit("khong thay mat bang cua toa %s" % toa)

    im = Image.open(nguon).convert("RGB")
    W, H = im.size
    vung = tim_vung(im)

    # Một căn không thể nằm ngoài tòa. Vệt đường cong vàng nhạt vẽ nền ở rìa ảnh P2 chạy
    # sát cạnh căn 15, flood fill rò theo nó lên tận mép trên ảnh — kẹp bao về viền tòa
    # là vết rò tự mất, mà không phải chỉnh ngưỡng màu cho từng bản vẽ.
    vx1, vy1, vx2, vy2 = vien_toa_cua(im)
    for v in vung:
        x1, y1, x2, y2 = v["bao"]
        v["bao"] = (max(x1, vx1), max(y1, vy1), min(x2, vx2), min(y2, vy2))

    if chi_do:
        print("%s: anh %dx%d — %d mang mau du to" % (toa, W, H, len(vung)))
        for v in sorted(vung, key=lambda v: (v["tam"][1], v["tam"][0])):
            x1, y1, x2, y2 = v["bao"]
            print("   tam %5.1f,%5.1f   bao x %5.1f..%5.1f  y %5.1f..%5.1f   %d px"
                  % (v["tam"][0]/W*100, v["tam"][1]/H*100,
                     x1/W*100, x2/W*100, y1/H*100, y2/H*100, v["dt"]))
        return

    moc = CONFIG_VUNG[toa]
    if len(vung) < len(moc):
        raise SystemExit("%s: khai %d truc nhung chi tim duoc %d mang mau — chay --vung xem lai"
                         % (toa, len(moc), len(vung)))
    if len(vung) > len(moc):
        # Thừa mảng thì không sao — mốc sẽ chọn đúng mảng — nhưng phải nói ra để còn biết
        # thừa là thứ gì (lõi thang tô xám? sơ đồ phụ dính trong ảnh?).
        print("   %s: tim duoc %d mang, khai %d truc — %d mang khong gan voi truc nao"
              % (toa, len(vung), len(moc), len(vung) - len(moc)))

    hop, da_dung = {}, set()
    for truc, (mx, my) in moc.items():
        px_, py_ = mx / 100 * W, my / 100 * H
        # mảng chứa đúng mốc; mốc lỡ rơi vào nét vẽ thì lấy mảng có tâm gần nhất
        trong = [i for i, v in enumerate(vung)
                 if v["bao"][0] <= px_ <= v["bao"][2] and v["bao"][1] <= py_ <= v["bao"][3]]
        i = min(trong, key=lambda i: (vung[i]["tam"][0]-px_)**2 + (vung[i]["tam"][1]-py_)**2) if trong \
            else min(range(len(vung)), key=lambda i: (vung[i]["tam"][0]-px_)**2 + (vung[i]["tam"][1]-py_)**2)
        if i in da_dung:
            raise SystemExit("%s: truc %s tro vao mang da thuoc truc khac — moc dat sai" % (toa, truc))
        da_dung.add(i)
        hop[truc] = vung[i]["bao"]

    os.makedirs(THUMUC_RA, exist_ok=True)
    im.save(os.path.join(THUMUC_RA, "%s.jpg" % toa), quality=CHAT_LUONG, optimize=True)
    du = doc_ban_do()
    du[toa] = {t: toa_do(b, im, [k for t2, k in hop.items() if t2 != t])
               for t, b in sorted(hop.items())}
    ghi_ban_do(du)
    print("%s: %d truc  (mat bang %dx%d)" % (toa, len(hop), W, H))
    return hop


def lam_toa(toa, chi_do=False):
    nguon = os.path.join(THUMUC_RA, "%s.jpg" % toa)
    if not os.path.exists(nguon):
        nguon = os.path.join(THUMUC_MB, "%s.jpg" % toa)
    if not os.path.exists(nguon):
        raise SystemExit("khong thay mat bang cua toa %s" % toa)

    im_day = Image.open(nguon).convert("RGB")
    im, ox, oy = cat_khung(im_day)
    W, H = im.size
    tam_y, tam_x = H // 2, W // 2
    dai = dai_mau_ngang(im)

    if chi_do:
        print("%s: anh %dx%d sau khi cat khung" % (toa, W, H))
        print("  %d dai mau: %s" % (len(dai), "  ".join("%s %d..%d" % (d[2], d[0], d[1]) for d in dai)))
        return

    bang = CONFIG.get(toa)
    if not bang:
        raise SystemExit("chua co CONFIG cho toa %s — chay voi --do truoc" % toa)
    if len(bang) != len(dai):
        raise SystemExit("%s: CONFIG khai %d dai nhung do duoc %d dai" % (toa, len(bang), len(dai)))

    # dải nào khai lồng (hai cột cùng màu) thì chia đôi tại tâm dải
    cot = []
    for (xa, xb, _), khai in zip(dai, bang):
        if khai and isinstance(khai[0], list):
            giua = (xa + xb) // 2
            cot.append((xa, giua, khai[0]))
            cot.append((giua + 1, xb, khai[1]))
        else:
            cot.append((xa, xb, khai))

    hop, days, daus = {}, [], []
    for xa, xb, ds in cot:
        b, day, dau = o_trong_cot(im, xa, xb, ds, tam_y)
        hop.update(b)
        if day is not None:
            days.append(day)
            daus.append(dau)

    # Nắn mép ngang các cột 2 căn về một mức chung: vài căn có mảng trắng (ban công)
    # làm đứt dải màu, để nguyên thì hai căn soi gương nhau ra cao thấp khác nhau.
    if days:
        day_tren, dau_duoi = int(stat.median(days)), int(stat.median(daus))
        for xa, xb, ds in cot:
            if len(ds) == 2:
                hop[ds[0]] = (xa, 0, xb, day_tren)
                hop[ds[1]] = (xa, dau_duoi, xb, H - 1)

    # Ảnh nền giữ NGUYÊN BẢN đầy đủ, không cắt: nhãn "T1-04 / 75,2 M2" nằm ngoài hình
    # tòa, cắt sát khung là khách mất đúng hai thứ họ đọc đầu tiên.
    os.makedirs(THUMUC_RA, exist_ok=True)
    im_day.save(os.path.join(THUMUC_RA, "%s.jpg" % toa), quality=CHAT_LUONG, optimize=True)

    # Toạ độ tính theo % của ẢNH NỀN đầy đủ, nên phải cộng lại chỗ lệch của khung đo.
    day = {t: (ox + b[0], oy + b[1], ox + b[2], oy + b[3]) for t, b in hop.items()}
    du = doc_ban_do()
    du[toa] = {t: toa_do(b, im_day, [k for t2, k in day.items() if t2 != t])
               for t, b in sorted(day.items())}
    ghi_ban_do(du)

    print("%s: %d truc  (mat bang %dx%d, khung do tren %dx%d)" % (toa, len(hop), W, H, im_day.width, im_day.height))
    return hop


if __name__ == "__main__":
    args = sys.argv[1:]
    if "--zip" in args:
        i = args.index("--zip")
        toa_zip, thu_muc = args[i - 1], args[i + 1]
        lam_toa_zip(toa_zip, thu_muc)
        raise SystemExit(0)
    do = "--do" in args
    vung = "--vung" in args
    args = [a for a in args if not a.startswith("--")]
    danh = args or sorted(set(CONFIG) | set(CONFIG_VUNG))
    for t in danh:
        # Tòa nào khai mốc vùng thì đi đường vùng màu; còn lại đi đường dải màu dọc.
        if vung or t in CONFIG_VUNG:
            lam_toa_vung(t, chi_do=do or vung)
        else:
            lam_toa(t, chi_do=do)
