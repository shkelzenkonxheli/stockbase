## StockBase

Multi-tenant stock management app me:

- owner console
- tenant onboarding
- configurable categories
- variant management
- manual trial / activation flow

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Testing And Deploy

Per testim manual dhe pergatitje para deploy-it shiko:

- `docs/end-to-end-testing-checklist.md`
- `docs/deploy-prep-checklist.md`

## Environment

Per setup fillestar:

1. kopjo `.env.example` ne `.env`
2. vendos databazen
3. vendos `PLATFORM_ADMIN_EMAILS`
4. vendos `R2` credentials nese perdor upload

Shenim:

- billing manual punon edhe pa `STRIPE_*`
- per Neon prefero `DIRECT_URL` per migrate
- fotot tani ruhen ne `Cloudflare R2`

## Production Start

```bash
npx prisma migrate deploy
npm run build
npm run start
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
