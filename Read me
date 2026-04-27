# BuyTrip Pro — Setup Guide

## Guía de Configuración

-----

## 🚀 Quick Start / Inicio Rápido

### 1. Open the app / Abrir la app

Open `index.html` in any browser, or host the files on any web server.
Abre `index.html` en cualquier navegador, o sube los archivos a cualquier servidor web.

**Recommended hosting (free):**

- **Netlify**: Drop the folder at netlify.com/drop
- **Vercel**: `vercel --prod` in the folder
- **GitHub Pages**: Push to a repo and enable Pages

-----

## 🔑 API Keys Configuration / Configuración de Claves

Open `app.js` and find the `CONFIG` block at the top:

```javascript
const CONFIG = {
  SUPABASE_URL: 'YOUR_SUPABASE_URL',
  SUPABASE_ANON_KEY: 'YOUR_SUPABASE_ANON_KEY',
  CLAUDE_API_KEY: 'YOUR_CLAUDE_API_KEY',
};
```

### Claude API Key (for OCR)

1. Go to console.anthropic.com
1. Create an API key
1. Replace `YOUR_CLAUDE_API_KEY`

**Without the key:** The app works in demo mode with mock OCR data.

### Supabase (for team sync)

1. Go to supabase.com and create a free project
1. Copy your Project URL → `SUPABASE_URL`
1. Copy your `anon` public key → `SUPABASE_ANON_KEY`
1. Run these SQL commands in Supabase SQL editor:

```sql
-- Create tables
CREATE TABLE visits (
  id TEXT PRIMARY KEY,
  team TEXT NOT NULL,
  name TEXT, city TEXT, market TEXT,
  notes TEXT, date TEXT, created_by TEXT,
  created_at BIGINT
);

CREATE TABLE suppliers (
  id TEXT PRIMARY KEY,
  team TEXT NOT NULL,
  visit_id TEXT, name TEXT, booth TEXT,
  contact TEXT, wechat TEXT, category TEXT,
  notes TEXT, rating INT, created_by TEXT,
  created_at BIGINT
);

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  team TEXT NOT NULL,
  visit_id TEXT, supplier_id TEXT,
  supplier_name TEXT, description TEXT,
  model TEXT, price TEXT, price_negotiated TEXT,
  moq TEXT, pcs_per_box TEXT, weight TEXT,
  dimensions TEXT, cbm TEXT, colors TEXT,
  suggested_order TEXT, status TEXT,
  priority TEXT, notes TEXT,
  created_by TEXT, created_at BIGINT
);

-- Enable Row Level Security (optional but recommended)
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
```

**Without Supabase:** The app works fully offline, data is saved in the browser.

-----

## 📱 Install as iPhone App / Instalar en iPhone

1. Open Safari on iPhone
1. Navigate to your hosted URL
1. Tap the Share button (□↑)
1. Select “Add to Home Screen”
1. Tap “Add”

The app will appear on your home screen like a native app.

-----

## 👥 Team Usage / Uso en Equipo

1. One person creates a visit and shares the **Team Code**
1. All team members log in with the **same Team Code**
1. Everyone can add suppliers and products simultaneously
1. Tap **⟳ Sync** to share data with the team

-----

## 📊 Excel Export

The exported Excel file contains:

- **Sheet 1: Products** — All products grouped by supplier, with all fields
- **Sheet 2: Suppliers** — All supplier information

To embed images in Excel (requires additional setup with Node.js):

- Images are stored in the browser due to size constraints
- For production with embedded images, use the Node.js export script (coming soon)

-----

## 🔧 Files / Archivos

```
buytrip/
├── index.html       ← Main app
├── style.css        ← All styles
├── app.js           ← All logic + OCR + Export
├── manifest.json    ← PWA manifest
├── service-worker.js← Offline support
└── README.md        ← This file
```

-----

## 💡 Tips for Best OCR Results / Tips para mejor OCR

1. **Good lighting** — Avoid shadows on the product label
1. **Include the full data** — Make sure price tags, codes, and specs are visible
1. **Steady shot** — Hold phone still, let camera focus
1. **One product per photo** — Never mix multiple products in one shot

-----

## 🆘 Support

If OCR doesn’t work: Check that your Claude API key is valid and has credits.
If sync doesn’t work: Check Supabase URL and key are correct.
For offline use: Everything works without any API keys.
