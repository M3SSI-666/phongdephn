const TABLE = 'quy_can_ban';

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
    ngay_update: today,
    ma_can:      p.Ma_Can     || '',
    thiet_ke:    p.Thiet_Ke   || '',
    dien_tich:   p.Dien_Tich  || '',
    slot_xe:     p.Slot_Xe    || 'Không',
    huong_bc:    p.Huong_BC   || '',
    huong_cua:   p.Huong_Cua  || '',
    gia:         p.Gia        || '',
    phi:         p.Phi        || 'Thu về',
    noi_that:    p.Noi_That   || '',
    sdt:         p.SDT        || '',
    ten_chu:     p.Ten_Chu    || '',
    hinh_anh:    p.Hinh_Anh   || '',
    nguon:       p.Nguon      || '',
    ghi_chu:     p.Ghi_Chu    || '',
    mau_ma_can:  p.Mau_Ma_Can || '',
    owner_id:    p.Owner_Id   || '',
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
        Ngay_Update: row.ngay_update || '',
        Ma_Can:      row.ma_can      || '',
        Thiet_Ke:    row.thiet_ke    || '',
        Dien_Tich:   row.dien_tich   || '',
        Slot_Xe:     row.slot_xe     || '',
        Huong_BC:    row.huong_bc    || '',
        Huong_Cua:   row.huong_cua   || '',
        Gia:         row.gia         || '',
        Phi:         row.phi         || '',
        Noi_That:    row.noi_that    || '',
        SDT:         row.sdt         || '',
        Ten_Chu:     row.ten_chu     || '',
        Hinh_Anh:    row.hinh_anh    || '',
        Nguon:       row.nguon       || '',
        Ghi_Chu:     row.ghi_chu     || '',
        Mau_Ma_Can:  row.mau_ma_can  || '',
        Owner_Id:    row.owner_id    || '',
        _rowIndex:   row.id,
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
    console.error(`[QuyCanBan] ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
}
