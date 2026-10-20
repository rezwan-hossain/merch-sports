

# Merch Sports

A modern sports event management and registration platform built with Next.js, TypeScript, Prisma, PostgreSQL, and Supabase.

Merch Sports provides a platform for showcasing sports events, managing registration packages, handling participant information, and organizing event-related orders and payments.

## ✨ Features

- **Event Management** — Organize sports events with descriptions, dates, locations, banners, and registration statuses.
- **Registration Packages** — Configure packages, pricing, distances, and available slots.
- **Participant Registration** — Manage participant details and registration information.
- **Order Management** — Track orders, quantities, discounts, totals, and order statuses.
- **Payment Tracking** — Store payment information, transaction references, and payment statuses.
- **Coupon Management** — Support fixed or percentage discounts with validity periods and usage limits.
- **User Management** — Support user accounts and role-based access for users, administrators, and organizers.
- **Homepage Management** — Manage hero sections, gallery images, FAQs, and site settings.
- **Organizer Management** — Maintain organizer information and associate organizers with events.
- **Activity Auditing** — Record administrative actions and changes for accountability.
- **Analytics** — Track daily page views, traffic sources, and event-sharing activity.

> Feature availability and access permissions depend on the implemented application flows and configuration.

## 🛠️ Tech Stack

| Technology | Purpose |
| --- | --- |
| Next.js 16 | Full-stack React framework |
| React 19 | User interface |
| TypeScript | Type-safe development |
| Tailwind CSS 4 | Styling |
| Prisma ORM | Database access and schema management |
| PostgreSQL | Relational database |
| Supabase | Authentication and backend services |
| Zod | Data validation |
| Framer Motion | UI animations |
| Tiptap | Rich-text editing |
| Resend | Email integration |
| Lucide React | Icons |

## 🚀 Getting Started

Follow these steps to run the project locally.

### Prerequisites

Make sure you have the following installed:

- Node.js — a version compatible with the project dependencies
- npm
- A PostgreSQL database
- A Supabase project with the required authentication and database configuration

### 1\. Clone the repository

```
git clone https://github.com/rezwan-hossain/merch-sports.git
cd merch-sports
```

### 2\. Install dependencies

```
npm install
```

### 3\. Configure environment variables

Create a `.env` file in the project root and configure the environment variables required by the application.

```
DATABASE_URL="your-postgresql-connection-string"
DIRECT_URL="your-direct-postgresql-connection-string"
```

Configure any additional Supabase, payment gateway, email, or other service credentials required by the application's code.

**Important:** Never commit real API keys, database credentials, or other secrets to Git.

### 4\. Generate the Prisma client

```
npx prisma generate
```

### 5\. Set up the database

Apply the project's existing database migrations:

```
npx prisma migrate deploy
```

For local development, use `npx prisma migrate dev` when creating or applying development migrations.

Ensure that your database is configured and the required environment variables are available before running these commands.

### 6\. Start the development server

```
npm run dev
```

Open http://localhost:3000 in your browser.

## 📜 Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Generate Prisma Client and build the application |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npx prisma generate` | Generate Prisma Client |
| `npx prisma migrate deploy` | Apply existing production migrations |

## 🗂️ Project Structure

The project follows a modular Next.js application structure.

```
merch-sports/
├── app/                  # Next.js App Router and application routes
├── module/               # Feature-oriented application modules
├── lib/                  # Shared utilities and services
├── prisma/
│   ├── schema.prisma     # Database schema
│   └── seed.ts           # Database seed script
├── public/               # Static assets
├── package.json          # Dependencies and scripts
└── README.md             # Project documentation
```

This is a high-level overview; consult the repository for the complete directory structure.

## 🗄️ Database Overview

The Prisma schema defines the main entities used by the platform, including:

- **Users and Organizers** — Account information, roles, and event ownership.
- **Events and Packages** — Event details, registration availability, pricing, and capacity.
- **Orders and Registrations** — Purchase records and participant information.
- **Payments** — Payment amounts, methods, transaction identifiers, and statuses.
- **Coupons and Coupon Usage** — Discount rules and redemption tracking.
- **Site Content** — Homepage sections, FAQs, gallery images, and settings.
- **Audit Logs and Analytics** — Administrative activity and aggregated traffic statistics.

Prisma manages the application's database models and client generation.

## 🔐 Environment Configuration

Keep environment-specific values in your local environment configuration.

| Variable or configuration | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection used by Prisma |
| `DIRECT_URL` | Direct PostgreSQL connection for Prisma operations |
| Supabase credentials | Authentication and Supabase service access |
| Payment gateway credentials | Payment processing, if enabled |
| Email service credentials | Email delivery, if enabled |

Consult the application code and deployment configuration for the complete list of required variables.

## 🏗️ Production Build

Create a production build:

```
npm run build
```

Start the built application:

```
npm run start
```

For deployment, configure the environment variables, database connectivity, Prisma migrations, and external services in your hosting environment.

## 🤝 Contributing

Contributions, suggestions, and bug reports are welcome.

1. Fork the repository.
2. Create a feature branch:```
   git checkout -b feature/your-feature
   ```
3. Make your changes and test them.
4. Commit your changes:```
   git commit -m "Add your feature"
   ```
5. Push your branch and open a pull request.

## 🐛 Issues and Support

If you encounter a bug or have a feature request, please open an issue in the GitHub repository.

Include a clear description of the problem and steps to reproduce it when reporting a bug.

## 📄 License

Please refer to the repository's license file for the applicable license terms.

## 👨‍💻 Author

**Rezwan Hossain**

- GitHub: @rezwan-hossain
- Repository: merch-sports

Before publishing: Verify the environment-variable names, migration setup, directory tree, and supported features against your current deployment. The repository's package scripts and Prisma schema support the technical details above, but I haven't verified every feature's user-facing implementation.

To use it, replace the existing `README.md` in your repository with this content and commit the changes.
