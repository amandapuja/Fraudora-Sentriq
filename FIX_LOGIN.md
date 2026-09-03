# Login Fix (Clone-Safe)

Perbaikan utama pada versi ini:

1. Frontend memakai `VITE_API_URL=/api/v1` secara default (same-origin), bukan URL `localhost` yang ditanam ke bundle.
2. Vite dev dan preview mem-proxy `/api` ke backend melalui `VITE_PROXY_TARGET`.
3. Docker mengarahkan proxy ke `http://backend:8000`, sehingga akses lewat IP/LAN tetap login ke backend host yang benar.
4. `docker compose up --build` tidak lagi gagal hanya karena `.env` belum dibuat setelah clone.
5. `AUTO_SEED=true` selalu memastikan akun demo tersedia, bahkan bila database volume sudah berisi data lain.
6. Email login/register dinormalisasi menjadi lowercase + trim.
7. Token yang tersimpan di browser divalidasi ulang ke `/auth/me` saat refresh.

## Jalankan setelah clone

```bash
docker compose up --build
```

Lalu buka `http://localhost:8443`.

Akun demo:

- `analyst@trustlens.dev` / `password123`
- `valen@trustlens.dev` / `password123`
- `operator@trustlens.dev` / `password123`

Jika ingin konfigurasi khusus, salin `.env.example` menjadi `.env` lalu ubah nilainya.
