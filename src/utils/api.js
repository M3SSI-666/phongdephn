const CLOUDINARY_CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export async function parseTextWithClaude(rawText) {
  // Try once, if 429 wait 5s and retry once more
  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await fetch('/api/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: rawText }),
    });

    if (res.ok) return res.json();

    const errData = await res.json().catch(() => ({}));

    if (res.status === 429 && attempt === 1) {
      await new Promise((r) => setTimeout(r, 5000));
      continue;
    }

    throw new Error(errData.error || `Parse failed (${res.status})`);
  }
}

export async function uploadToCloudinary(file, resourceType = 'image', onProgress) {
  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/${resourceType}/upload`;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_PRESET);
  formData.append('folder', 'phongdephn');

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = JSON.parse(xhr.responseText);
        resolve(data.secure_url);
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error('Upload network error'));
    xhr.send(formData);
  });
}

export async function uploadImagesToCloudinary(files, onProgress) {
  const urls = [];
  for (let i = 0; i < files.length; i++) {
    const url = await uploadToCloudinary(files[i].file, 'image', (p) => {
      const overall = ((i * 100 + p) / files.length);
      onProgress?.(overall);
    });
    urls.push(url);
  }
  onProgress?.(100);
  return urls;
}

export async function uploadVideosToCloudinary(files, onProgress) {
  const urls = [];
  for (let i = 0; i < files.length; i++) {
    const url = await uploadToCloudinary(files[i].file, 'video', (p) => {
      const overall = ((i * 100 + p) / files.length);
      onProgress?.(overall);
    });
    urls.push(url);
  }
  onProgress?.(100);
  return urls;
}

export async function pushToGoogleSheets(data) {
  const res = await fetch('/api/sheets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Push to Sheets failed');
  return res.json();
}

export async function smartSearch(query) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });

    if (res.ok) return res.json();

    const errData = await res.json().catch(() => ({}));

    if (res.status === 429 && attempt === 1) {
      await new Promise((r) => setTimeout(r, 5000));
      continue;
    }

    throw new Error(errData.error || `Search failed (${res.status})`);
  }
}

export async function fetchRoomsFromSheets(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v) params.set(k, v);
  });
  const res = await fetch(`/api/rooms?${params.toString()}`);
  if (!res.ok) throw new Error('Fetch rooms failed');
  return res.json();
}
