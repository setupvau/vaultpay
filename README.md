# VaultPay — Wallet & Deposit Management Platform

A full-stack wallet application supporting INR and USDT deposits,
built with Node.js + Express + PostgreSQL (backend) and React + Tailwind (frontend).

## Quick Start

```bash
# 1. Backend
cd backend && npm install && npm run dev

# 2. User Frontend (new terminal)
cd frontend && npm install && npm run dev

# 3. Admin Panel (new terminal)
cd admin && npm install && npm run dev
```

## URLs
- User App:    http://localhost:5173
- Admin Panel: http://localhost:5174
- API:         http://localhost:5000

## Key Files
- `docs/SETUP.md`        ← Complete setup instructions (START HERE)
- `docs/schema.sql`      ← Run this in Supabase to create database
- `docs/ARCHITECTURE.md` ← System design overview
- `docs/API.md`          ← All API endpoints
- `backend/.env.example` ← Copy to .env and fill in your values

## Features
- ✅ Phone + password authentication
- ✅ JWT access + refresh tokens
- ✅ USDT deposits (TRC20 + BEP20)
- ✅ INR deposits with bank account management
- ✅ WhatsApp redirect when bank is near limit
- ✅ Client-side image compression before upload
- ✅ Cloudinary image storage
- ✅ Admin deposit approval with amount editing
- ✅ Wallet ledger system (never edit balance directly)
- ✅ Admin user management (freeze/unfreeze, wallet adjustment)
- ✅ Full audit logging of all admin actions
- ✅ Role-based access (user / admin / superadmin)
- ✅ Rate limiting on all routes
- ✅ Mobile-responsive UI

## Tech Stack
Backend: Node.js, Express, PostgreSQL, JWT, Cloudinary
Frontend: React 18, Vite, Tailwind CSS, React Router v6
Database: Supabase 
Images: Cloudinary 
