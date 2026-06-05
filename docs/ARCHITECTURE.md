# VaultPay — Complete Architecture Guide

## Project Overview
VaultPay is a wallet/deposit management platform supporting INR and USDT deposits.
Built as a web app first, with a REST API backend that is mobile-ready from day one.

---

## Tech Stack

### Backend
- **Runtime**: Node.js v20+
- **Framework**: Express.js
- **Database**: PostgreSQL via Supabase (free tier = 50,000 rows, 500MB)
- **Auth**: JWT (jsonwebtoken) + bcryptjs
- **Image Upload**: Cloudinary (free tier = 25GB)
- **Validation**: Joi
- **ORM**: pg (raw SQL for full control — better for beginners to understand what's happening)

### Frontend (Web App)
- **Framework**: React 18 + Vite
- **Styling**: Tailwind CSS v3
- **State**: React Context + useReducer (no Redux needed for MVP)
- **HTTP Client**: Axios
- **Image Compression**: browser-image-compression (client-side before upload)
- **Routing**: React Router v6

### Frontend (Admin Panel)
- Same stack as Web App but a SEPARATE build
- Different base URL: /admin
- More powerful table/management components

---

## Folder Structure

```
vaultpay/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.js          # PostgreSQL connection pool
│   │   │   └── cloudinary.js        # Image upload config
│   │   ├── middleware/
│   │   │   ├── auth.js              # JWT verification
│   │   │   ├── adminAuth.js         # Admin-only routes
│   │   │   ├── rateLimiter.js       # Rate limiting
│   │   │   └── errorHandler.js      # Global error handler
│   │   ├── controllers/
│   │   │   ├── authController.js    # Register/login
│   │   │   ├── depositController.js # USDT + INR deposits
│   │   │   ├── walletController.js  # Balance, history
│   │   │   └── adminController.js   # All admin actions
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── deposit.js
│   │   │   ├── wallet.js
│   │   │   └── admin.js
│   │   ├── services/
│   │   │   ├── walletService.js     # Ledger logic
│   │   │   ├── uploadService.js     # Cloudinary upload
│   │   │   └── notificationService.js
│   │   └── utils/
│   │       ├── jwt.js
│   │       └── helpers.js
│   ├── .env
│   ├── package.json
│   └── server.js
│
├── frontend/                        # User web app
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/                  # Reusable: Button, Input, Modal, etc.
│   │   │   ├── layout/              # Navbar, Sidebar, Footer
│   │   │   ├── auth/                # LoginForm, RegisterForm
│   │   │   ├── deposit/             # USDTDeposit, INRDeposit
│   │   │   └── wallet/              # Balance, TransactionList
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx
│   │   │   ├── RegisterPage.jsx
│   │   │   ├── DashboardPage.jsx
│   │   │   ├── DepositPage.jsx
│   │   │   └── HistoryPage.jsx
│   │   ├── context/
│   │   │   └── AuthContext.jsx      # Global auth state
│   │   ├── services/
│   │   │   └── api.js               # All API calls
│   │   └── hooks/
│   │       └── useAuth.js
│   ├── package.json
│   └── vite.config.js
│
├── admin/                           # Admin panel (separate app)
│   └── src/
│       ├── pages/
│       │   ├── DashboardPage.jsx
│       │   ├── UsersPage.jsx
│       │   ├── DepositsPage.jsx
│       │   ├── SettingsPage.jsx
│       │   └── LogsPage.jsx
│       └── ...
│
└── docs/
    ├── ARCHITECTURE.md              # This file
    ├── DATABASE.md                  # Full schema
    ├── API.md                       # All API endpoints
    └── SETUP.md                     # Step-by-step setup
```

---

## Security Design

1. **JWT Tokens**: Short-lived (15min access + 7day refresh)
2. **Password Hashing**: bcrypt with salt rounds = 12
3. **Rate Limiting**: 5 login attempts per IP per 15 minutes
4. **Admin Separation**: Admins have a separate JWT secret + role check on every route
5. **Input Validation**: Joi validates every request body
6. **SQL Injection**: Parameterized queries only (no string concatenation)
7. **File Upload Security**: Validate MIME type + size before upload; only JPEG/PNG allowed
8. **Duplicate Transaction Prevention**: Unique constraint on txid + order reference
9. **Audit Logging**: Every admin action is logged with IP, timestamp, before/after values

---

## Wallet Ledger System

NEVER update wallet balance directly. Every change goes through the ledger:

```
User wants to deposit 1000 INR
  → Create deposit order (status: pending)
  → Admin approves, sets actual amount (e.g. 950 INR)
  → System creates ledger_entry (type: deposit_credit, amount: 950)
  → System recalculates wallet balance = SUM of all ledger entries
  → User sees updated balance
```

This way you have a complete, auditable history of every rupee ever moved.

---

## Deployment Plan (Free Tier)

| Service      | Platform          | Free Limit              |
|--------------|-------------------|-------------------------|
| Backend API  | Railway.app        | 500hrs/month            |
| Frontend     | Vercel             | Unlimited static        |
| Admin Panel  | Vercel             | Unlimited static        |
| Database     | Supabase           | 500MB, 50k rows         |
| Images       | Cloudinary         | 25GB bandwidth          |
| Domain       | Freenom / Namecheap| Free .tk or ~$10/yr     |

First 10,000 users easily handled within free tiers.
