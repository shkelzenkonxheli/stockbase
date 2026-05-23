# Deploy Prep Checklist

Ky dokument perdoret pasi mbaron testimi manual.

## 1. Database

- Verifiko qe `DATABASE_URL` dhe `DIRECT_URL` jane production-safe
- Per Neon:
  - `DATABASE_URL` mund te jete pooled/runtime connection
  - `DIRECT_URL` perdore per migrate/direct operations
- Ekzekuto migrimet:

```powershell
npx prisma migrate deploy
```

- Verifiko qe migrimi i fundit eshte aplikuar:
  - `20260522093000_add_variant_custom_attributes`

## 2. Environment Variables

Kontrollo minimalisht:

- `DATABASE_URL`
- `DIRECT_URL`
- `PLATFORM_ADMIN_EMAILS`
- `APP_URL`
- `NEXT_PUBLIC_APP_URL`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `CLOUDINARY_APP_FOLDER`

Nese billing eshte manual:

- `STRIPE_*` vars nuk jane te domosdoshme per go-live

## 3. Platform Owner Access

- Verifiko qe owner email ekziston si user ne DB
- Verifiko qe owner login shkon te `/platform/tenants`
- Verifiko qe klienti normal nuk hyn ne `/platform/*`

## 4. Tenant Bootstrap

Per cdo tenant demo / klient:

- krijo tenant nga `/platform/tenants/new`
- verifiko trial status
- bej login me owner te tenant-it
- kontrollo settings dhe kategorite

## 5. Asset / Upload Check

- verifiko qe upload-et ne Cloudinary ruhen ne folderin e app-it
- testo upload te pakten per:
  - produkt normal
  - variant me foto
  - footwear me foto per ngjyre

## 6. Production Build

- ekzekuto:

```powershell
npm run build
```

- verifiko qe build kalon pa error

## 7. Smoke Test After Deploy

Pas deploy-it, testo:

- `/login`
- owner login
- tenant login
- `/platform/tenants/new`
- `/settings`
- `/products/new`
- `/products/[id]/variants/new`
- `/orders/new`
- `/stock/incoming`
- `/reports`

## 8. Go / No-Go

Deploy-i konsiderohet gati vetem nese:

- build kalon
- migrimet aplikohen
- owner console punon
- tenant onboarding punon
- tenant isolation eshte verifikuar
- product / variant / order flow punon pa error
