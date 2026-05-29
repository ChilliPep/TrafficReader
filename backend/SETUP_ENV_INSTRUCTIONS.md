# Environment Setup (TrafficReader)

## 1. Create local `.env` (never commit it)

From the `backend` folder:

```powershell
copy .env.example .env
```

Edit `backend/.env` and set your demo key locally:

```env
USE_2GIS_API=false
DEMO_SAFE_SYNTHETIC=true
GIS_API_KEY=your_actual_demo_key_here
```

Do **not** commit `.env` to GitHub.

## 2. Verify `.gitignore`

The repository root `.gitignore` must include:

```
.env
backend/.env
```

If GitHub still shows `.env` as tracked, remove it from the index once:

```powershell
git rm --cached backend/.env
git rm --cached .env
git commit -m "Stop tracking local env files"
```

## 3. Enable real 2GIS traffic safely

When you are ready to spend API quota:

```env
USE_2GIS_API=true
DEMO_SAFE_SYNTHETIC=false
GIS_API_KEY=your_actual_demo_key_here
```

Restart backend:

```powershell
cd backend
npm start
```

On 4xx/5xx, timeout, or quota lock, the collector falls back to synthetic data and logs:

```
console.warn('2GIS fallback for seg_...: ...')
```

## 4. Rollback to demo mode

```env
USE_2GIS_API=false
DEMO_SAFE_SYNTHETIC=true
```

Then restart the server.
