
# OFJR Construction — Frontend

React + TypeScript frontend for the OFJR Construction management platform.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| Build tool | Vite |
| Styling | Tailwind CSS |
| UI components | Radix UI / shadcn/ui |
| Icons | Lucide React |
| Routing | React Router v6 |
| Notifications | Sonner |

## Prerequisites

- Node.js 18+
- npm 9+ (or pnpm / yarn)
- Backend API running (see [backend-construction-ofjr](https://github.com/imanderrrrr/backend-construction-ofjr))

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env to point to your running backend

# 3. Start dev server
npm run dev
```

The app will be available at `http://localhost:5173`.

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `VITE_API_URL` | Backend API base URL (no trailing slash) | `http://localhost:58080` |

Copy `.env.example` to `.env` and adjust as needed. **Never commit `.env` files.**

## Available Scripts

```bash
npm run dev       # Start Vite dev server with HMR
npm run build     # Production build → dist/
npm run preview   # Preview the production build locally
npm run lint      # Run ESLint
```

## Project Structure

```
src/
  app/
    components/   # Feature components (views, dialogs, cards)
    lib/          # API client
    helpers/      # Shared utilities
  styles/         # Global CSS and theme
  main.tsx        # App entry point
```

## User Roles

| Role | Access |
|---|---|
| Admin | Full access — project management, finance, audit log |
| Supervisor | Approve expenses/hours, manage team |
| Worker | My hours, my expenses, my tools |

## QA Setup Guide

Follow these steps to get the full stack running locally for testing.

### 1. Backend (Spring Boot + PostgreSQL)

```bash
# Clone the backend
git clone https://github.com/imanderrrrr/backend-construction-ofjr.git
cd backend-construction-ofjr
git checkout develop

# Make sure you have:
#   - Java 17+ (JDK)
#   - PostgreSQL 15+ running locally
#   - A database created (e.g. "construction_ofjr")

# Configure your database connection in src/main/resources/application.properties
# or set env vars:
#   SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/construction_ofjr
#   SPRING_DATASOURCE_USERNAME=postgres
#   SPRING_DATASOURCE_PASSWORD=<your_password>

# Run the backend
./gradlew bootRun
# API will be available at http://localhost:58080
# Health check: http://localhost:58080/actuator/health
```

### 2. Frontend (this repo)

```bash
git clone https://github.com/imanderrrrr/frontend-construction-ofjr.git
cd frontend-construction-ofjr
git checkout develop

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Verify VITE_API_URL points to your running backend (default: http://localhost:58080)

# Start dev server
npm run dev
# App available at http://localhost:5173
```

### 3. Mobile App (Flutter)

```bash
git clone https://github.com/imanderrrrr/mobile-construction-ofjr.git
cd mobile-construction-ofjr
git checkout develop

# Make sure you have:
#   - Flutter SDK 3.x installed (https://docs.flutter.dev/get-started/install)
#   - Android Studio or Xcode for emulators

# Install dependencies
flutter pub get

# Run on connected device or emulator
flutter run
```

### Test Accounts

Ask the project lead for test credentials. The system has three roles:
- **Admin** — full access to all modules
- **Supervisor** — time/expense approvals, team management
- **Worker** — personal time tracking, expenses, tools

### Supported Languages

The app supports English and Spanish. Toggle via the language switcher in the top bar.

## Branch Strategy

| Branch | Purpose |
|---|---|
| `main` | Production-ready code |
| `develop` | Integration branch — **always start QA from this branch** |
| `feature/*` | Individual feature branches |
| `release/*` | Release candidates |
| `hotfix/*` | Urgent fixes |

## License

Proprietary — see [LICENSE](LICENSE). Copyright © 2026 Anthony Anderson Herrera Aguirre, Founder of Archlogic Systems. All rights reserved. Unauthorized commercial use will result in legal action.
