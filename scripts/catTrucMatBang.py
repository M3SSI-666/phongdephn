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

# Mỗi tòa: danh sách DẢI MÀU theo thứ tự trái sang phải, mỗi dải ghi các trục trong đó.
#   ["04", "05"]            dải này một cột, ô trên là trục 04, ô dưới là 05
#   ["02", "01", "03"]      đầu hồi: trên / giữa / dưới, ô giữa khác màu hai ô kia
#   [["08","09"], ["10","11"]]  hai cột cùng một màu -> chia đôi dải tại tâm
# Chạy với --do để script in ra các dải màu đo được rồi điền vào đây.
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
    ys = [y for y, v in enumerate(hang) if v > W * 0.04]
    xs = [x for x, v in enumerate(cot) if v > H * 0.05]
    if not xs or not ys:
        raise SystemExit("khong tim thay vung mau nao trong anh")
    ox, oy = min(xs), min(ys)
    return im.crop((ox, oy, max(xs) + 1, max(ys) + 1)), ox, oy


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
    DW, DH = im_day.size
    du = doc_ban_do()
    du[toa] = {t: {"x": round((ox + b[0]) / DW * 100, 2), "y": round((oy + b[1]) / DH * 100, 2),
                   "w": round((b[2] - b[0]) / DW * 100, 2), "h": round((b[3] - b[1]) / DH * 100, 2)}
               for t, b in sorted(hop.items())}
    ghi_ban_do(du)

    print("%s: %d truc  (mat bang %dx%d, khung do tren %dx%d)" % (toa, len(hop), W, H, DW, DH))
    return hop


if __name__ == "__main__":
    args = [a for a in sys.argv[1:]]
    do = "--do" in args
    args = [a for a in args if not a.startswith("--")]
    danh = args or sorted(CONFIG)
    for t in danh:
        lam_toa(t, chi_do=do)
