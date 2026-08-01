# 🪙 Kharch — Personal Finance & Cashflow Tracker

Kharch is a sleek, modern, and privacy-oriented PWA (Progressive Web Application) designed to help you track your cashflows, reconcile closing balances, manage multiple independent spaces, and optimize your spending with detailed comparative analytics.

Built with a fast **Express/MongoDB** REST API backend and a responsive **Next.js** frontend styled with TailwindCSS, Kharch focuses on maximum space optimization, clean ledger tables, and interactive micro-animations.

---

## ✨ Features

### 🛡️ Authentication & Gestures
*   **Slide to Sign In**: A custom, premium gesture-based login. Sliding the Google logo handle unlocks a clean **`Tap to Sign In`** button.
*   **Invisible Google Popup Trigger**: Integrates Google Identity Services (GSI) securely in popup mode. It runs locally and in production using only **Authorized JavaScript Origins** (no complex redirect URI mismatch issues).

### 💼 Multiple Workspaces
*   **Spaces Dashboard**: Switch between different budget pools (e.g., *Personal*, *Business*, *Savings*) with a single tap.
*   **Stop Propagation Actioning**: Easily delete or configure workspaces without accidental clicks triggering space switches.

### 📊 Comparative Analytics
*   **Day Tabular ledger**: A mobile-optimized ledger row list displaying Category (with click-to-expand text clipping), Time, Earned amount, Spent amount, and shortened importance tags (`Ess` / `Mod` / `Low`).
*   **Weekly Ledger**: Tracks cashflows across a 7-day period.
*   **Monthly Grid Matrix**: Replaces generic category charts with a highly readable 4-week comparison table (Weekly Cashflows).
*   **Yearly Matrix**: Compares cashflows month-by-month across 12 months.

### 🔐 Balance Reconciliation
*   **Reconcile Dashboard**: Swapped out the old transaction history pages for a monthly closing balance logging dashboard. Allows users to freeze their monthly opening/closing balances to ensure ledger accuracy.

---

## 🛠️ Technology Stack

*   **Frontend**: Next.js (App Router, React 19, Lucide Icons, Recharts, TailwindCSS)
*   **Backend**: Express.js REST API (Node.js, Mongoose, Helmet, Rate Limiter)
*   **Database**: MongoDB (Mongoose Schema Modelling)
*   **Security**: Cookie-based HttpOnly JWT tokens, CORS Origin Verification, Express Rate Limiter, Helmet protection.

---

## 📂 Project Structure

```
Kharch/
├── backend/                  # Express REST API
│   ├── config/               # DB connection configurations
│   ├── models/               # MongoDB Mongoose schemas
│   ├── routes/               # API route modules (auth, transactions, spaces)
│   ├── server.js             # API entrypoint
│   └── package.json
│
├── frontend/                 # Next.js App Router Frontend
│   ├── src/
│   │   ├── app/              # PWA routes (login, analytics, reconcile, settings)
│   │   ├── components/       # Shared UI Shell & Layouts
│   │   └── context/          # AppContext global React state provider
│   ├── public/               # Static assets & logos
│   └── package.json
│
├── package.json              # Workspace root scripts configuration
└── README.md                 # Project manual
```

---

## 🚀 Setup & Installation

### 1. Prerequisites
*   [Node.js](https://nodejs.org/) (v18+)
*   [MongoDB](https://www.mongodb.com/) running locally or a MongoDB Atlas URI connection string.
*   A [Google Cloud Project](https://console.cloud.google.com/) with an OAuth 2.0 Client ID configured for JavaScript Origins (`http://localhost:3000`).

### 2. Environment Configurations

#### Backend (`backend/.env`)
Create a `.env` file in the `backend/` directory:
```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/kharch
JWT_SECRET=your_super_secret_jwt_key
FRONTEND_URL=http://localhost:3000
GOOGLE_CLIENT_ID=your_google_oauth_client_id.apps.googleusercontent.com
NODE_ENV=production
```

#### Frontend (`frontend/.env.local`)
Create a `.env.local` file in the `frontend/` directory:
```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_oauth_client_id.apps.googleusercontent.com
NEXT_PUBLIC_BACKEND_URL=http://localhost:5000
```

---

### Running Locally

Since the frontend PWA and backend API are independent, you can run them separately in their respective folders:

#### 1. Running the Backend API
Navigate to the `backend` folder and start the API:
```bash
cd backend
npm install
npm start
```
This runs the production backend quietly on `http://localhost:5000`.

#### 2. Running the Frontend PWA
Navigate to the `frontend` folder, perform an optimized build, and start the Next.js server:
```bash
cd frontend
npm install
npm run build
npm run start
```
This starts your compiled production web app on `http://localhost:3000`.

---

## 🔒 Security Best Practices
*   **HttpOnly JWT Cookies**: The backend signs a JWT token and stores it in a secure, server-side cookie (`token`) to prevent XSS credential stealing.
*   **Morgan Logging**: Switched off in production mode to avoid leaking user transactions/endpoints in the hosting terminal.
*   **Express Rate Limiter**: Configured on the API and Google Login endpoints to block brute-force attempts.
