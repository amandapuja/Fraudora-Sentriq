# TrustLens x Fraudora Sentriq TraceX (Gabungan BE + FE)

Proyek ini adalah hasil **penggabungan**:

- **Backend**: `backend/` — diambil dari **TRUSTLENS-main** (FastAPI + PostgreSQL + Neo4j), tidak diubah logikanya, hanya `BACKEND_CORS_ORIGINS` default diperluas agar bisa diakses dari frontend Vite.
- **Frontend**: `frontend/` — diambil dari **alibaba_fiks** (Vite + React + TypeScript, landing page + dashboard "Fraudora Sentriq TraceX"), **diperbaiki agar login & register benar-benar terhubung ke backend** (sebelumnya login hanya cek email/password hardcoded di JavaScript, tidak memanggil API sama sekali).

## Apa yang diperbaiki pada Login

Sebelumnya (`alibaba_fiks` asli):

- Login hanya mengecek `email === "analyst@fraudora.dev" && password === "demo123"` secara hardcoded di client, tanpa pernah memanggil backend.
- Tidak ada penyimpanan token, tidak ada sesi yang bertahan setelah refresh halaman.
- Tombol "Daftar" hanya menampilkan pesan "Fitur pendaftaran segera hadir." (tidak fungsional).

Sekarang:

- `frontend/src/lib/api.ts` — client API baru yang memanggil `POST /api/v1/auth/login`, `POST /api/v1/auth/register`, dan `GET /api/v1/auth/me` ke backend TrustLens.
- Token JWT (`access_token`) dan data user hasil login disimpan di `localStorage` (`trustlens_token`, `trustlens_user`).
- Saat halaman di-refresh, sesi login otomatis dipulihkan (tidak perlu login ulang selama token masih ada).
- Form **Daftar** kini fungsional — memanggil `POST /auth/register` sungguhan (role: `ADMIN` / `ANALYST` / `INSTITUTION`).
- Pesan error di form login sekarang berasal dari respons backend (mis. "Invalid email or password"), bukan pesan statis.
- Tombol "Masuk sebagai Tamu" tetap bekerja seperti semula (mode guest, tanpa backend — sesuai desain asli).

> Catatan: Konten di dalam dashboard (grafik, tabel transaksi, alert, dsb.) pada versi `alibaba_fiks` masih berupa **data simulasi/mock di frontend** dan belum di-wire ke endpoint data TrustLens lainnya (`/transactions`, `/alerts`, `/graph`, dst). Hanya alur **autentikasi (login/register/sesi)** yang sudah terhubung penuh ke backend sesuai permintaan. Endpoint-endpoint lain sudah tersedia di backend (lihat `backend/app/api/`) dan bisa disambungkan menyusul dengan pola yang sama seperti `lib/api.ts`.

## Akun Demo (dari seed backend)

Jika `AUTO_SEED=true` saat backend pertama kali jalan, akun berikut otomatis dibuat:

| Role       | Email                     | Password    |
|------------|----------------------------|-------------|
| Admin      | valen@trustlens.dev        | password123 |
| Analyst    | analyst@trustlens.dev      | password123 |
| Institution| operator@trustlens.dev     | password123 |

Kredensial ini hanya untuk demo lokal — jangan dipakai di production.

## Perbaikan Clone-Safe Login

Versi ini tidak lagi menanam `http://localhost:8000` ke bundle frontend. Frontend memanggil `/api/v1` pada origin yang sama, lalu Vite dev/preview meneruskan request ke backend. Ini membuat login tetap bekerja ketika frontend dibuka melalui IP komputer host/LAN.

`docker compose up --build` juga tidak lagi mewajibkan file `.env`; semua nilai penting memiliki default dan `.env` hanya diperlukan jika Anda ingin override konfigurasi. Saat `AUTO_SEED=true`, tiga akun demo di atas akan dibuat/disegarkan secara idempotent walaupun volume database sudah berisi data lain.

## Struktur Proyek

```
.
├── backend/          # FastAPI (TrustLens) — API, Alembic migration, ML pipeline
├── frontend/          # Vite + React (alibaba_fiks) — landing page + dashboard, login terhubung ke backend
├── docker-compose.yml # Orkestrasi: postgres + neo4j + backend + frontend
└── .env.example        # Contoh environment variable untuk docker-compose
```

## Menjalankan dengan Docker (disarankan)

Prasyarat: Docker & Docker Compose.

```bash
# .env sekarang opsional; project bisa langsung dijalankan setelah clone
docker compose up --build

# Opsional, jika ingin override password/port/config:
# cp .env.example .env
```

Akses aplikasi:

- Frontend: http://localhost:8443
- Backend API: http://localhost:8000
- Swagger/OpenAPI: http://localhost:8000/docs
- Neo4j Browser: http://localhost:7474

Backend container otomatis menunggu PostgreSQL & Neo4j siap, menjalankan migrasi Alembic, menjalankan seed demo (jika `AUTO_SEED=true`), lalu start Uvicorn.

## Menjalankan Manual (tanpa Docker)

### 1. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Edit .env: sesuaikan POSTGRES_* dan NEO4J_* dengan instance lokal Anda
# Pastikan PostgreSQL & Neo4j sudah berjalan

alembic upgrade head
python -m app.db.seeds.seed     # opsional, membuat akun demo di atas

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend berjalan di `http://localhost:8000`, dengan seluruh endpoint di bawah prefix `/api/v1` (mis. `http://localhost:8000/api/v1/auth/login`).

### 2. Frontend

```bash
cd frontend
npm install

cp .env.example .env
# Default VITE_API_URL=/api/v1 (same-origin).
# VITE_PROXY_TARGET default http://localhost:8000 untuk mode manual.

npm run dev
```

Frontend default berjalan di `http://localhost:8443` (diatur lewat `vite.config.ts`, bisa dioverride dengan env `PORT`).

### Deploy frontend ke Vercel

Repo ini sudah menyediakan `frontend/vercel.json`. Saat import di Vercel, set **Root Directory** ke `frontend`; konfigurasi tersebut memasang dependency, menjalankan build Vite, dan mengarahkan route SPA ke `index.html`.

1. Import repository ini di [Vercel](https://vercel.com/new).
2. Set **Root Directory** ke `frontend` dan gunakan preset **Vite**.
3. Tambahkan environment variable production `VITE_API_URL` dengan URL publik backend FastAPI, termasuk prefix `/api/v1`, misalnya `https://api.example.com/api/v1`.
4. Deploy ulang setelah environment variable disimpan.

Vercel hanya menjalankan frontend pada konfigurasi ini. Backend, PostgreSQL, dan Neo4j tetap harus dijalankan pada server/container terpisah. Pastikan backend mengizinkan domain Vercel pada `BACKEND_CORS_ORIGINS`.

Jika port frontend diubah (mis. ke `5173`), tambahkan origin tersebut ke `BACKEND_CORS_ORIGINS` pada `backend/.env`, contoh:

```
BACKEND_CORS_ORIGINS=http://localhost:5173,http://localhost:8443
```

## Alur Login Singkat

1. User mengisi email & password di halaman Login → tombol "Masuk" memanggil `loginWithCredentials()` di `AuthProvider` (`frontend/src/App.tsx`).
2. `loginWithCredentials()` memanggil `apiLogin()` (`frontend/src/lib/api.ts`) → `POST /api/v1/auth/login` ke backend.
3. Backend (`backend/app/api/auth.py`) memverifikasi email & password ter-hash, lalu mengembalikan `access_token` (JWT) + data user.
4. Token & user disimpan di `localStorage`, state auth di React di-set `authenticated`, dan user diarahkan ke dashboard.
5. Setiap request API berikutnya (bila diimplementasikan) otomatis menyertakan header `Authorization: Bearer <token>` lewat `apiFetch()`.
6. Saat halaman direfresh, `AuthProvider` membaca ulang token+user dari `localStorage` sehingga sesi tetap login.
7. Logout menghapus token/user dari `localStorage` dan mengembalikan state ke `unauthenticated`.

## Troubleshooting

- **Login gagal / "Tidak dapat menghubungi server"** → pada konfigurasi baru frontend memakai `/api/v1` dan mem-proxy request ke backend. Pastikan backend sehat di `http://localhost:8000/api/v1/health`. Untuk Docker, target proxy default adalah `http://backend:8000`.
- **CORS error di console browser** → tambahkan origin frontend Anda ke `BACKEND_CORS_ORIGINS` pada `backend/.env`, lalu restart backend.
- **401 Invalid email or password** → pastikan sudah menjalankan seed (`python -m app.db.seeds.seed`) atau daftar akun baru lewat form Register.
