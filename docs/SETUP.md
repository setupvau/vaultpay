# VaultPay — Setup Guide

## What you need first

Before starting, create these free accounts:
- **Supabase** (database) → supabase.com
- **Cloudinary** (image storage) → cloudinary.com

---

## Step 1 — Database setup

1. Go to **supabase.com** → create project
2. Go to **SQL Editor** → **New query**
3. Open `docs/FULL_SETUP.sql` from this project
4. Copy everything, paste it, click **Run**
5. You should see: `VaultPay database ready ✅`

---

## Step 2 — Get your database URL

1. In Supabase → **Settings** → **Database**
2. Scroll to **"Connection string"**
3. Click the **"URI"** tab
4. Copy the string — it looks like:
   `postgresql://postgres.xxxx:YOUR_PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`

**If the URL contains `[YOUR-PASSWORD]` — replace that with your actual password.**

---

## Step 3 — Create backend/.env

Inside the `backend` folder, create a file called `.env` with this content:

```
PORT=5000
NODE_ENV=development

DATABASE_URL=paste_your_supabase_uri_here

JWT_SECRET=paste_output_1_here
JWT_REFRESH_SECRET=paste_output_2_here
ADMIN_JWT_SECRET=paste_output_3_here

JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

CLOUDINARY_CLOUD_NAME=from_cloudinary_dashboard
CLOUDINARY_API_KEY=from_cloudinary_dashboard
CLOUDINARY_API_SECRET=from_cloudinary_dashboard

FRONTEND_URL=http://localhost:5173
ADMIN_URL=http://localhost:5174
```

To generate the 3 JWT secrets, run this command 3 separate times.
Each time you get a different output — paste each into a different field above:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## Step 4 — Create frontend/.env

Inside the `frontend` folder, create a file called `.env`:
```
VITE_API_URL=/api
```

---

## Step 5 — Create admin/.env

Inside the `admin` folder, create a file called `.env`:
```
VITE_API_URL=http://localhost:5000/api
```

---

## Step 6 — Create your admin account

First install backend packages:
```bash
cd backend
npm install
```

Then generate a password hash (replace MyPassword123 with your chosen password):
```bash
node -e "const b=require('bcryptjs');b.hash('MyPassword123',12).then(h=>console.log(h))"
```

Copy the output hash. Then go to **Supabase → SQL Editor** and run:
```sql
INSERT INTO users (phone, password_hash, full_name, role)
VALUES ('+91XXXXXXXXXX', '$2a$12$PASTE_HASH_HERE', 'Admin', 'superadmin');

INSERT INTO wallets (user_id)
SELECT id FROM users WHERE phone = '+91XXXXXXXXXX';
```

Replace `+91XXXXXXXXXX` with your phone number and `$2a$12$PASTE_HASH_HERE` with your hash.

---

## Step 7 — Start everything

Open 3 separate terminal windows:

**Terminal 1 — Backend:**
```bash
cd backend
npm install
npm run dev
```
Should print: `VaultPay API running on port 5000`

**Terminal 2 — User app:**
```bash
cd frontend
npm install
npm run dev
```
Open: http://localhost:5173

**Terminal 3 — Admin panel:**
```bash
cd admin
npm install
npm run dev
```
Open: http://localhost:5174

---

## Step 8 — Configure the admin panel

Log into http://localhost:5174 then set these in **Settings**:

| Setting | What to enter |
|---------|--------------|
| USDT → INR Rate | e.g. `110` |
| Support WhatsApp | e.g. `+919876543210` |
| Support Telegram | e.g. `@YourSupport` |

Then go to **Settings → USDT Addresses** and add your TRC20 and BEP20 wallet addresses.

Then go to **Settings → Bank Accounts** and add at least one bank account for INR deposits.

---

## Troubleshooting

**"Invalid URL" or database connection error:**
Your DATABASE_URL is wrong. Go back to Step 2. Make sure the password is filled in and there are no square brackets.

**"Cannot find module" errors:**
Run `npm install` in that folder.

**Login works but dashboard shows error:**
Open browser console (F12). If you see a 401 error, your JWT_SECRET may have changed. Log out and log back in.

**Tailwind CSS not loading (page looks plain):**
Make sure `postcss.config.js` exists in both `frontend` and `admin` folders.

**Admin panel shows blank page:**
Make sure `index.html` exists in the `admin` folder.
