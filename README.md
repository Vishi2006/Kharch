# 🪙 Kharch v2.0 — Local-First Personal Finance PWA & Android Companion

Kharch is a fast, offline-first Progressive Web Application (Next.js 16 App Router, React 19, Dexie.js v3, Tailwind CSS, MongoDB/Mongoose) with a native Kotlin Android Companion APK (`NotificationListenerService`, Room, WorkManager) and native iOS Shortcuts transaction logging automation.

Kharch combines offline-first local speed with seamless background expense capture from Indian payment apps (PhonePe, Google Pay, Paytm, BHIM, etc.), NPCI-safe QR scanning, and automated merchant memory.

---

## 🛠️ Technology Stack

* **Web / PWA**: Next.js 16 (Turbopack, App Router, React 19, Tailwind CSS, Dexie.js IndexedDB v3)
* **Backend API**: Next.js Serverless Route Handlers (`src/app/api/...`), zero Render cold-starts (~200ms)
* **Database**: MongoDB Atlas with cached Mongoose singleton connection
* **Authentication**: Same-origin `HttpOnly` JWT session cookies + Bearer device tokens
* **Android Companion**: Native Kotlin app (`NotificationListenerService`, Room database, WorkManager background sync, Android 13–15 Restricted Settings onboarding flow, signed release build)
* **iOS Automation**: Native iOS Shortcuts webhook integration (`POST /api/notifications/ios-shortcut`)

---

## 📂 Project Structure

```
Kharch/
├── src/
│   ├── app/                      # Next.js 16 App Router pages & serverless API routes
│   │   ├── api/                  # 30+ Serverless API Route Handlers
│   │   │   ├── auth/             # Google OAuth & session management
│   │   │   ├── companion/        # Pairing tokens & APK download route
│   │   │   ├── consent/          # Companion privacy consent & data sync
│   │   │   ├── inbox/            # Receipt inbox matching & conversion
│   │   │   ├── merchant-mappings/# VPA Auto-Memory learning
│   │   │   ├── notifications/    # Android & iOS Shortcuts notification webhooks
│   │   │   ├── payment-attempts/ # UPI intent state tracking
│   │   │   ├── spaces/           # Multi-space isolation
│   │   │   ├── summaries/        # Monthly cashflow reconciliation
│   │   │   ├── titles/           # Categorization autocomplete
│   │   │   └── transactions/     # Ledger entry mutations & analytics
│   │   ├── add/                  # Manual expense creation
│   │   ├── analytics/            # Comparative cashflow matrices
│   │   ├── inbox/                # Receipt review & 1-tap confirmation
│   │   ├── login/                # Google Identity Services login
│   │   ├── pay/                  # NPCI-safe QR scanner & 3-second checkout
│   │   ├── reconcile/            # Monthly balance freezing & reconciliation
│   │   ├── settings/             # Account controls, APK download & pairing QR
│   │   └── spaces/               # Workspace management
│   ├── components/               # AppShell, bottom navigation, QRScanner
│   ├── context/                  # AppContext offline-first state provider
│   ├── lib/                      # MongoDB singleton, Auth helper, Matching engine, Parsers
│   ├── models/                   # Mongoose schemas (10 models)
│   └── utils/                    # Dexie.js v3 schema & FIFO sync queue
│
├── public/                       # Manifest, icons, service worker, signed release APK
│   └── companion/                # KharchCompanion.apk & app-release.apk
│
├── android/                      # Native Kotlin Companion App (Android 8.0 - 15)
│   ├── app/src/main/java/        # Notification listener, Room DB, WorkManager, UI
│   └── build.gradle.kts          # Signed release configuration (v1, v2, v3)
│
├── next.config.mjs               # Turbopack & headers configuration
├── tailwind.config.js            # Tailwind typography & styling
├── package.json                  # Next.js dependencies & scripts
└── .env.example                  # Environment template
```

---

## 🚀 Setup & Local Development

### 1. Prerequisites
* [Node.js](https://nodejs.org/) (v18+)
* MongoDB Atlas connection URI
* Google Cloud OAuth Web Client ID

### 2. Configure Environment
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Fill in your `MONGODB_URI`, `JWT_SECRET`, and `GOOGLE_CLIENT_ID`.

### 3. Install & Run
```bash
# Run local development server
npm run dev

# Run production build (Turbopack)
npm run build

# Start production server
npm start
```

---

## ☁️ Deployment (Vercel)

1. Connect this repository to **Vercel**.
2. Set **Root Directory** to `.` (the repository root).
3. Add the environment variables from `.env.example` in Vercel Project Settings.
4. Deploy! Your entire application, frontend PWA, and serverless API endpoints will deploy in a single unified project.
