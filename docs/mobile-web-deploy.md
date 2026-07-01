# Mobile Web Deployment

`mobile.gwanje.com` is deployed as a separate Vercel project whose root directory is `mobile/`.

## Architecture

- Expo Router web build is exported to `mobile/dist`.
- Vercel serves the static mobile app from `mobile.gwanje.com`.
- Browser write requests call same-origin `/api/mobile/*`.
- `mobile/vercel.json` rewrites those requests to the existing Next.js API origin.
- Supabase reads still use the public Supabase URL and publishable key directly from the browser.

The current rewrite target is `https://gwanje.vercel.app`. Change the first rewrite in `mobile/vercel.json` to `https://gwanje.com/api/mobile/:path*` after the main web app is attached to `gwanje.com`.

## Vercel Project

Create or link a Vercel project with:

- Root Directory: `mobile`
- Build Command: `npm run export:web`
- Output Directory: `dist`
- Install Command: `npm ci`

The same settings are committed in `mobile/vercel.json`.

## Production Env Vars

Set these on the mobile Vercel project:

```bash
EXPO_PUBLIC_SUPABASE_URL=<same value as NEXT_PUBLIC_SUPABASE_URL>
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<same value as NEXT_PUBLIC_SUPABASE_ANON_KEY>
```

Do not set `EXPO_PUBLIC_WEB_API_BASE_URL` for the mobile web deployment unless you intentionally want to bypass the same-origin proxy. Native EAS builds can set it to `https://gwanje.com`.

## CLI Flow

```bash
cd mobile
npx vercel link --project gwanje-mobile
npx vercel env add EXPO_PUBLIC_SUPABASE_URL production
npx vercel env add EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY production
npm run export:web
npx vercel deploy --prod
npx vercel domains add mobile.gwanje.com
```

After adding the domain, configure DNS with the record Vercel shows for `mobile.gwanje.com`.

For the current Gabia DNS setup, Vercel inspection recommended the simple `A` record:

```text
Type: A
Name: mobile
Value: 76.76.21.21
```

Vercel verification also returned this `CNAME` alternative:

```text
Type: CNAME
Name: mobile
Value: 3524696da79262da.vercel-dns-017.com.
```

Choose only one option. Do not add an `A` record and `CNAME` record for `mobile` at the same time. After DNS propagation:

```bash
cd mobile
npx vercel domains verify mobile.gwanje.com
```
