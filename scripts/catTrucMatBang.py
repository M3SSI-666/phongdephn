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

# Khung đỏ nới ra ngoài mép căn một chút chứ không ôm sát: ôm sát thì lan can, tường bao
# không được tô màu rơi ra ngoài khung, nhìn như khoanh thiếu. Tính theo % ảnh để tòa
# ảnh to hay nhỏ nới ra một tỉ lệ như nhau.
LE_NGANG = 0.018
LE_DOC = 0.040

def toa_do(b, W, H, khung_toa):
    """Bao (pixel) -> toạ độ % đã nới lề.

    Kẹp trong KHUNG TÒA NHÀ chứ không phải khung ảnh: nhãn "T1-04 / 75,2 M2" nằm ngay
    sát mép tòa, nới quá là cạnh khung đè lên chữ.
    """
    lx, ly = W * LE_NGANG, H * LE_DOC
    kx1, ky1, kx2, ky2 = khung_toa
    x1, y1 = max(kx1, b[0] - lx), max(ky1, b[1] - ly)
    x2, y2 = min(kx2, b[2] + lx), min(ky2, b[3] + ly)
    return {"x": round(x1 / W * 100, 2), "y": round(y1 / H * 100, 2),
            "w": round((x2 - x1) / W * 100, 2), "h": round((y2 - y1) / H * 100, 2)}


def khung_toa_cua(im_day):
    """Khung tòa nhà trên ảnh đầy đủ, nhích ra một chút để nét đỏ nằm ngoài tường bao."""
    W, H = im_day.size
    cat, ox, oy = cat_khung(im_day)
    dx, dy = W * 0.005, H * 0.012
    return (max(0, ox - dx), max(0, oy - dy),
            min(W - 1, ox + cat.width + dx), min(H - 1, oy + cat.height + dy))

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
    mau = [[None] * H for _ in range(W)]
    for x in range(W):
        for y in range(H):
            r, g, b = px[x, y]
            mx, mn = max(r, g, b), min(r, g, b)
            if mx >= 70 and (mx - mn) >= 14:
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

    if chi_do:
        print("%s: anh %dx%d — %d mang mau du to" % (toa, W, H, len(vung)))
        for v in sorted(vung, key=lambda v: (v["tam"][1], v["tam"][0])):
            x1, y1, x2, y2 = v["bao"]
            print("   tam %5.1f,%5.1f   bao x %5.1f..%5.1f  y %5.1f..%5.1f   %d px"
                  % (v["tam"][0]/W*100, v["tam"][1]/H*100,
                     x1/W*100, x2/W*100, y1/H*100, y2/H*100, v["dt"]))
        return

    moc = CONFIG_VUNG[toa]
    if len(vung) != len(moc):
        raise SystemExit("%s: khai %d truc nhung tim duoc %d mang mau — chay --vung xem lai"
                         % (toa, len(moc), len(vung)))

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
    khung = khung_toa_cua(im)
    du = doc_ban_do()
    du[toa] = {t: toa_do(b, W, H, khung) for t, b in sorted(hop.items())}
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
    DW, DH = im_day.size
    khung = (max(0, ox - DW * 0.005), max(0, oy - DH * 0.012),
             min(DW - 1, ox + W + DW * 0.005), min(DH - 1, oy + H + DH * 0.012))
    du = doc_ban_do()
    du[toa] = {t: toa_do((ox + b[0], oy + b[1], ox + b[2], oy + b[3]), DW, DH, khung)
               for t, b in sorted(hop.items())}
    ghi_ban_do(du)

    print("%s: %d truc  (mat bang %dx%d, khung do tren %dx%d)" % (toa, len(hop), W, H, DW, DH))
    return hop


if __name__ == "__main__":
    args = sys.argv[1:]
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
