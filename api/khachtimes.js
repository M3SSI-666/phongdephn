const TABLE = 'khach_times';

function sbHeaders() {
  return {
    'apikey': process.env.SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
  };
}

function buildRecord(p) {
  const today = new Date().toLocaleDateString('vi-VN');
  return {
    ngay_ps:       p.Ngay_PS       || today,
    ten_zalo:      p.Ten_Zalo      || '',
    sdt:           p.SDT           || '',
    nhu_cau:       p.Nhu_Cau       || '',
    phong_ngu:     p.Phong_Ngu     || '',
    noi_that:      p.Noi_That      || '',
    slot_xe:       p.Slot_Xe       || '',
    thoi_han_thue: p.Thoi_Han_Thue || '',
    ngay_vao:      p.Ngay_Vao      || '',
    dien_tich:     p.Dien_Tich     || '',
    tai_chinh:     p.Tai_Chinh     || '',
    toa:           p.Toa           || '',
    can_tu_van:    p.Can_Tu_Van    || '',
    trang_thai:    p.Trang_Thai    || '',
    ghi_chu:       p.Ghi_Chu       || '',
    owner_id:      p.Owner_Id      || '',
  };
}

export default async function handler(req, res) {
  const BASE = process.env.SUPABASE_URL;
  const KEY  = process.env.SUPABASE_SERVICE_KEY;
  if (!BASE || !KEY) return res.status(500).json({ error: 'Supabase not configured' });

  try {
    if (req.method === 'GET') {
      const { userId, role } = req.query;
      const isAdmin = role === 'admin';

      let url = `${BASE}/rest/v1/${TABLE}?select=*&order=id.asc`;
      if (!isAdmin && userId) url += `&owner_id=eq.${encodeURIComponent(userId)}`;

      const r = await fetch(url, { headers: sbHeaders() });
      if (!r.ok) return res.status(500).json({ error: await r.text() });

      const rows = await r.json();
      const items = rows.map(row => ({
        STT:          String(row.id),
        Ngay_PS:      row.ngay_ps       || '',
        Ten_Zalo:     row.ten_zalo      || '',
        SDT:          row.sdt           || '',
        Nhu_Cau:      row.nhu_cau       || '',
        Phong_Ngu:    row.phong_ngu     || '',
        Noi_That:     row.noi_that      || '',
        Slot_Xe:      row.slot_xe       || '',
        Thoi_Han_Thue:row.thoi_han_thue || '',
        Ngay_Vao:     row.ngay_vao      || '',
        Dien_Tich:    row.dien_tich     || '',
        Tai_Chinh:    row.tai_chinh     || '',
        Toa:          row.toa           || '',
        Can_Tu_Van:   row.can_tu_van    || '',
        Trang_Thai:   row.trang_thai    || '',
        Ghi_Chu:      row.ghi_chu       || '',
        Owner_Id:     row.owner_id      || '',
        _rowIndex:    row.id,
      }));

      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.status(200).json(items);
    }

    if (req.method === 'POST') {
      const p = req.body;
      if (!p?.action) return res.status(400).json({ error: 'Missing action' });

      if (p.action === 'add') {
        const r = await fetch(`${BASE}/rest/v1/${TABLE}`, {
          method: 'POST',
          headers: { ...sbHeaders(), 'Prefer': 'return=minimal' },
          body: JSON.stringify(buildRecord(p)),
        });
        if (!r.ok) return res.status(500).json({ error: await r.text() });
        return res.status(200).json({ success: true });
      }

      if (p.action === 'update') {
        if (!p._rowIndex) return res.status(400).json({ error: 'Missing _rowIndex' });
        const r = await fetch(`${BASE}/rest/v1/${TABLE}?id=eq.${p._rowIndex}`, {
          method: 'PATCH',
          headers: { ...sbHeaders(), 'Prefer': 'return=minimal' },
          body: JSON.stringify(buildRecord(p)),
        });
        if (!r.ok) return res.status(500).json({ error: await r.text() });
        return res.status(200).json({ success: true });
      }

      if (p.action === 'delete') {
        if (!p._rowIndex) return res.status(400).json({ error: 'Missing _rowIndex' });
        const r = await fetch(`${BASE}/rest/v1/${TABLE}?id=eq.${p._rowIndex}`, {
          method: 'DELETE',
          headers: { ...sbHeaders(), 'Prefer': 'return=minimal' },
        });
        if (!r.ok) return res.status(500).json({ error: await r.text() });
        return res.status(200).json({ success: true });
      }

      return res.status(400).json({ error: `Unknown action: ${p.action}` });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(`[KhachTimes] ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
}
