# TrafficReader — полный запуск (Windows)

## 1. Установка

```powershell
cd C:\Users\Asus\Desktop\TrafficReader\backend
npm install
```

## 2. Создание `.env`

```powershell
copy .env.example .env
notepad .env
```

### Режим A — демо (без расхода квоты 2GIS)

```env
PORT=3000
POLL_INTERVAL=300000
USE_2GIS_API=false
DEMO_SAFE_SYNTHETIC=true
GIS_API_KEY=
```

### Режим B — реальный 2GIS

```env
PORT=3000
POLL_INTERVAL=300000
USE_2GIS_API=true
DEMO_SAFE_SYNTHETIC=false
GIS_API_KEY=ваш_ключ_2gis
```

> Никогда не коммитьте `backend/.env` в GitHub.

## 3. Запуск сервера

```powershell
cd C:\Users\Asus\Desktop\TrafficReader\backend
npm start
```

Откройте в браузере: **http://localhost:3000**

## 4. Проверка

```powershell
Invoke-RestMethod http://localhost:3000/api/health
Invoke-RestMethod http://localhost:3000/api/traffic/snapshot | Select source,last_updated,@{n='mode';e={$_.collector.mode}}
```

Ожидаемо:
- `healthy` на `/api/health`
- на snapshot: `source` = `2gis` или `synthetic`, `collector.mode` соответствует режиму

## 5. Карта (Leaflet)

- Зум и перемещение — мышью/тачпадом
- Клик по маркеру — выбор сегмента и детали справа/снизу
- **Fit all corridors** — показать все точки
- **Refresh now** — обновить данные сразу

## 6. Тесты

```powershell
cd C:\Users\Asus\Desktop\TrafficReader\backend
npm test
```

## 7. Остановка сервера

В терминале с `npm start`: `Ctrl + C`

Если порт занят:

```powershell
netstat -ano | findstr :3000
taskkill /PID <номер_процесса> /F
```

## Координаты эталонных улиц

| Улица | lat | lon |
|---|---|---|
| Abay Avenue | 44.832582 | 65.507194 |
| Korkyt Ata | 44.840005 | 65.493447 |
| Zheltoksan | 44.842838 | 65.502001 |
| Aiteke Bi | 44.842390 | 65.502240 |

Файл сегментов: `backend/src/config/kyzylordaSegments.js` (формат GIS: `[lon, lat]`).
