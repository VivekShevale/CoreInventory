# CoreInventory — Full-Stack Inventory Management System

A modular, real-time Inventory Management System built with:
- **Frontend**: React + Vite + Tailwind CSS v4 + Redux Toolkit + GSAP
- **Backend**: Flask + PostgreSQL + JWT + SQLAlchemy
- **Services**: Cloudinary (image storage) · Brevo (transactional email / OTP)

---

## Project Structure

```
coreinventory/
├── frontend/                    # React + Vite app
│   ├── src/
│   │   ├── App.jsx              # Root routing
│   │   ├── main.jsx             # Redux Provider + BrowserRouter entry
│   │   ├── components/          # Shared UI components
│   │   │   ├── ui.jsx           # All base components (Btn, Table, Modal, etc.)
│   │   │   ├── AuthGuard.jsx    # JWT-protected route wrapper
│   │   │   ├── Breadcrumb.jsx   # Breadcrumb navigation
│   │   │   ├── FilterDrawer.jsx # Side filter panel
│   │   │   └── ProductPicker.jsx# Product selection modal
│   │   ├── configs/
│   │   │   └── api.js           # Axios instance with JWT interceptor
│   │   ├── layout/
│   │   │   └── AppLayout.jsx    # Sidebar nav + topbar layout
│   │   ├── lib/
│   │   │   ├── utils.js         # Formatters, helpers
│   │   │   └── cloudinary.js    # Cloudinary upload helper
│   │   ├── pages/
│   │   │   ├── auth/            # Login · Register · ForgotPassword
│   │   │   ├── dashboard/       # Dashboard with KPIs + operation blocks
│   │   │   ├── receipts/        # Receipts list + detail (WH/IN/xxxx)
│   │   │   ├── delivery/        # Deliveries list + detail (WH/OUT/xxxx)
│   │   │   ├── adjustments/     # Stock adjustments
│   │   │   ├── stock/           # Stock overview (editable)
│   │   │   ├── movehistory/     # Full move ledger
│   │   │   ├── settings/        # Warehouse + Locations
│   │   │   └── profile/         # User profile + avatar upload
│   │   └── store/
│   │       ├── index.js         # Redux store
│   │       └── slices/          # authSlice · themeSlice · receiptSlice
│   │                            #   deliverySlice · stockSlice
│   │                            #   dashboardSlice · warehouseSlice
│   └── package.json
│
└── server/                      # Flask backend
    ├── run.py                   # Entry point
    ├── requirements.txt
    ├── .env.example             # Copy to .env and fill in values
    └── app/
        ├── __init__.py          # Flask factory + blueprint registration
        ├── extensions.py        # db, jwt, mail instances
        ├── models.py            # All SQLAlchemy models
        ├── routes/              # One blueprint per domain
        │   ├── auth.py          # /api/auth/*
        │   ├── products.py      # /api/products/*
        │   ├── receipts.py      # /api/receipts/*
        │   ├── delivery.py      # /api/delivery/*
        │   ├── adjustments.py   # /api/adjustments/*
        │   ├── warehouse.py     # /api/warehouses/*
        │   ├── locations.py     # /api/locations/*
        │   ├── stock.py         # /api/stock/*
        │   ├── move_history.py  # /api/move-history/*
        │   └── dashboard.py     # /api/dashboard/stats
        └── utils/
            ├── reference.py     # WH/IN/0001 reference generator
            └── stock_utils.py   # Stock level + move ledger helpers
```

---

## Quick Start

### 1. PostgreSQL — Create Database

```sql
CREATE DATABASE coreinventory;
```

### 2. Backend Setup

```bash
cd server

# Create virtual environment
python -m venv venv
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your DB credentials, JWT secret, Brevo keys, Cloudinary keys

# Run server (auto-creates all tables on first run)
python run.py
```

Server runs at **http://localhost:5000**

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env:
#   VITE_BASE_URL=http://localhost:5000
#   VITE_CLOUDINARY_CLOUD_NAME=your-cloud-name
#   VITE_CLOUDINARY_UPLOAD_PRESET=your-unsigned-preset

# Start dev server
npm run dev
```

Frontend runs at **http://localhost:5173**

---

## Environment Variables

### Backend (`server/.env`)

| Variable | Description |
|---|---|
| `SECRET_KEY` | Flask secret key |
| `JWT_SECRET_KEY` | JWT signing key |
| `DATABASE_URL` | PostgreSQL connection string |
| `BREVO_SMTP_USER` | Brevo SMTP login (for OTP emails) |
| `BREVO_SMTP_KEY` | Brevo SMTP key |
| `MAIL_SENDER` | From address for emails |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |

### Frontend (`frontend/.env`)

| Variable | Description |
|---|---|
| `VITE_BASE_URL` | Flask API base URL |
| `VITE_CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `VITE_CLOUDINARY_UPLOAD_PRESET` | Unsigned upload preset from Cloudinary |

---

## Features

### Authentication
- Login (Login ID + Password)
- Register (Login ID 6-12 chars, unique email, strong password)
- OTP-based password reset via Brevo email
- JWT tokens stored in localStorage, auto-refreshed on page load

### Dashboard
- KPI cards: Total Products, Low Stock, Out of Stock, Pending Receipts, Pending Deliveries
- Operation blocks for Receipts and Deliveries (To Receive/Deliver · Late · Scheduled)
- Late = scheduled date < today · Scheduled = scheduled date > today · Waiting = waiting for stock

### Receipts (Incoming Stock — WH/IN/xxxx)
- List view + Kanban view (by status)
- Search by reference / contact
- Filter by status, warehouse
- Status flow: **Draft → Ready → Done**
- Validating auto-increases stock at destination location
- Print receipt once Done

### Delivery Orders (Outgoing Stock — WH/OUT/xxxx)
- List view + Kanban view
- Status flow: **Draft → Waiting → Ready → Done**
- Auto-sets to "Waiting" if any product has insufficient stock
- Validates stock before confirming; decreases stock on validation
- Alert if product is out of stock (line highlighted red)

### Stock Adjustments
- Select warehouse + location
- Add products with new counted quantities
- System auto-calculates delta and updates stock ledger
- All adjustments logged in Move History

### Stock Page
- View all products with On Hand, Free to Use, Per Unit Cost
- Inline editable On Hand quantity
- Low stock / out of stock alerts and row highlighting
- Filter by location

### Move History
- Full audit ledger of all stock movements
- Green = incoming (in), Red = outgoing (out)
- Columns: Reference, Date, Contact, From, To, Quantity, Status
- Multiple products per operation shown as separate rows

### Settings
- **Warehouse**: Create/edit/delete warehouses with short codes
- **Locations**: Create/delete locations linked to warehouses

### User Profile
- Update full name, email
- Upload avatar via Cloudinary
- Login ID is read-only

### Theme
- Light/Dark mode toggle (persisted in localStorage)
- Controlled via Redux `themeSlice`

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Get current user |
| PUT | `/api/auth/profile` | Update profile |
| POST | `/api/auth/forgot-password` | Send OTP |
| POST | `/api/auth/verify-otp` | Verify OTP + reset password |
| GET | `/api/dashboard/stats` | Dashboard KPIs |
| GET/POST | `/api/products/` | List / create products |
| GET/PUT | `/api/products/:id` | Get / update product |
| GET/POST | `/api/receipts/` | List / create receipts |
| POST | `/api/receipts/:id/confirm` | Draft → Ready |
| POST | `/api/receipts/:id/validate` | Ready → Done + stock +  |
| POST | `/api/receipts/:id/cancel` | Cancel receipt |
| GET/POST | `/api/delivery/` | List / create deliveries |
| POST | `/api/delivery/:id/validate` | Validate + stock − |
| POST | `/api/delivery/:id/cancel` | Cancel delivery |
| GET/POST | `/api/adjustments/` | List / create adjustments |
| GET | `/api/stock/` | Stock overview |
| POST | `/api/stock/update` | Manual stock update |
| GET | `/api/move-history/` | Full move ledger |
| GET/POST | `/api/warehouses/` | List / create warehouses |
| GET/POST | `/api/locations/` | List / create locations |

---

## Data Models

### Reference Format
```
WH/IN/0001   — Receipt
WH/OUT/0001  — Delivery
WH/INT/0001  — Internal Transfer
WH/ADJ/0001  — Adjustment
```

### Stock Flow Example
1. **Receive** 100kg Steel → `StockLevel(Steel, Main Store) += 100`
2. **Deliver** 20kg → `StockLevel(Steel, Main Store) -= 20`
3. **Adjust** damaged 3kg → `StockLevel(Steel, Main Store) -= 3`
4. All 3 logged in `StockMove` table (Move History)

---

## Additional npm Packages to Install

Run this in the `frontend/` directory:

```bash
npm install @reduxjs/toolkit react-redux gsap react-to-print axios
```

---

## Notes
- All tables auto-created via `db.create_all()` on first server start
- CORS is open (`*`) for development — restrict in production
- JWT token expires in 24 hours
- Cloudinary upload preset must be **unsigned** for client-side uploads
- Brevo SMTP port 587 with TLS
