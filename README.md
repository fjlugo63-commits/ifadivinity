# Ifa Divinity Marketplace

A marketplace platform for Ifa divination products and readings. Features buyer browsing/checkout, seller product management, admin panel, and booking system for readings.

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Styling**: Tailwind CSS + shadcn/ui
- **Authentication**: Supabase Auth (email/password, role-based)
- **Database**: Supabase PostgreSQL with Row Level Security
- **Payments**: Stripe (test mode)
- **Fonts**: Rubik (headings) + Nunito Sans (body)

## Features

- 🛒 **Marketplace** — Browse and purchase Ifa divination products
- 📅 **Booking System** — Schedule readings with practitioners
- 👤 **Role-Based Access** — Buyer, Seller, Admin, Awo (practitioner) portals
- 💳 **Stripe Checkout** — Secure payment processing
- 🔒 **Row Level Security** — Data protection at the database level

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm

### Installation

```bash
cd frontend
pnpm install
```

### Environment Variables

Create a `.env` file in the `frontend/` directory:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
```

### Development

```bash
cd frontend
pnpm run dev
```

The app will be available at `http://localhost:3000`.

### Build

```bash
cd frontend
pnpm run build
```

## Project Structure

```
app/
├── frontend/           # React frontend application
│   ├── src/
│   │   ├── components/ # Reusable UI components
│   │   ├── pages/      # Page components (routes)
│   │   ├── lib/        # Utilities, Supabase client, helpers
│   │   └── hooks/      # Custom React hooks
│   ├── public/         # Static assets
│   └── supabase/       # Supabase configuration & migrations
└── README.md           # This file
```

## User Roles

| Role | Access |
|------|--------|
| **Buyer** | Browse products, make purchases, book readings |
| **Seller** | Manage product listings, view orders |
| **Awo** | Manage consultations, readings calendar |
| **Admin** | Full platform management, user oversight |

## Deployment

1. Build the frontend: `pnpm run build`
2. Deploy the `dist/` folder to your hosting provider (Vercel, Netlify, etc.)
3. Set environment variables on your hosting platform
4. Configure Supabase project URL and keys

## License

MIT