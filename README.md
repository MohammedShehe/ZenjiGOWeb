# ZenjiGO Web Application

Professional, fully responsive web version of ZenjiGO for both **Riders** and **Drivers**, using the **exact same API endpoints** as the Flutter mobile apps and the Node.js backend.

## Features

### Public website
- Home, About, Features, Contact
- Coastal Zanzibar-inspired design (teal / aqua / sand palette)
- Responsive Bootstrap 5 layout

### Rider portal (`/rider/`)
- OTP login (`POST /auth/rider/send-otp`, `POST /auth/rider/verify-otp`)
- Dashboard, book ride (quote + create), live tracking, cancel, rate
- Ride history, wallet (balance, top-up, transactions)
- Payment methods, saved locations
- Parcels, tour packages
- Chat / support
- Profile update

### Driver portal (`/driver/`)
- OTP login & full registration (multipart documents)
- Go online / offline, location updates
- Incoming ride requests, accept, status updates (arriving → completed)
- Earnings, finance, payouts
- Ride history, documents, profile
- Chat / support

## API configuration

Default API base:

```
http://localhost:5000/api/v1
```

Change it in the browser console or by editing `js/config.js`:

```js
setApiBase('https://your-api.example.com/api/v1');
```

Or persist via:

```js
localStorage.setItem('zenjigo_api_base', 'https://your-api.example.com/api/v1');
```

## How to run

1. Start your ZenjiGO backend on port 5000 (or update the API base).
2. Serve this folder with any static server, for example:

```bash
# Python
python -m http.server 8080

# Node
npx serve .
```

3. Open `http://localhost:8080` in a browser.
4. Use Rider Login or Driver Login. Ensure CORS on the backend allows your origin (already configured for common local ports).

## Tech stack

- HTML5, CSS3, Vanilla JavaScript
- Bootstrap 5.3
- Bootstrap Icons
- Exact endpoint paths from the mobile apps (`RiderApi` / `DriverApi`) and backend routes

## Project structure

```
zenjigo-web/
├── index.html, about.html, contact.html, features.html
├── css/style.css
├── js/config.js, api.js, utils.js
├── rider/   (login, dashboard, book, history, ride, wallet, payments, saved, parcels, tours, chat, profile)
└── driver/  (login, register, dashboard, requests, active, earnings, history, profile, chat)
```

## Notes

- All authenticated calls send `Authorization: Bearer <accessToken>` and automatically attempt refresh on 401 via `POST /auth/refresh`.
- Driver registration uses `multipart/form-data` for documents (license, national ID, insurance, vehicle photos, driver photo).
- Map areas are placeholders; coordinates are sent to the real quote / create / track endpoints.

© 2026 ZenjiGO


## API endpoint configuration

The website defaults to the same-origin `/api/v1` when hosted on a non-local domain, and to `http://localhost:5000/api/v1` for local development. If the website and API are hosted separately, set the exact reachable backend URL before using the API:

```js
localStorage.setItem('zenjigo_api_base', 'https://YOUR-BACKEND-HOST/api/v1');
location.reload();
```

The backend must allow the website's exact origin in `CORS_ORIGINS`, and its `/health` endpoint should be reachable. Do not use `localhost` for a remotely hosted website because it points to the visitor's own computer.


## UI enhancement pass
- Added shared rider navigation in `js/rider-ui.js`; rider pages now use one consistent menu and persistent `zenjigo_theme` preference.
- Added a site-wide theme control for public pages in `js/site-ui.js`. Driver pages retain the shared driver navigation and use the same theme preference.
- Extended `css/style.css` with responsive layouts, improved touch targets, form focus states, reduced-motion support, card and navigation polish, and mobile breakpoints.
- Reworked `rider/payments.html` with card live preview and CVV-side flip, mobile-money provider/phone fields, bank details, validation, loading states, accessible list actions, and responsive layout.

### Payment security note
The browser-side card form deliberately sends only card label/brand, expiry, and last four digits; it never sends or stores the full card number or CVV. This is a polished UI flow, not a substitute for a PCI-compliant payment provider/tokenization integration. To actually charge cards, integrate a hosted/tokenized provider and save its payment-method token server-side. Mobile-money and bank-account flows also depend on backend support and provider verification.
