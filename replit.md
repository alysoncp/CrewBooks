# CrewBooks - Financial Management for Film & TV Professionals

## Overview

CrewBooks is a tax and financial management web application designed for self-employed performers and crew in the Canadian film and television industry. The application helps users track income, expenses, and receipts while providing tax calculations and dividend vs salary optimization for those with corporate structures.

Key features include:
- Income tracking with film/TV industry-specific categories (wages, residuals, per diem, buyouts, royalties)
- Expense management with industry-relevant categories (equipment, union dues, agent fees, wardrobe, etc.)
- Receipt photo upload and storage
- Canadian tax calculations with federal and provincial bracket breakdowns
- Dividend vs salary optimization for corporate income splitting
- User profile management with pricing tier support
- T1 Personal Tax Filing wizard (5-step questionnaire for personal tax returns)
- T2 Corporate Tax Filing wizard (7-step questionnaire for corporate tax returns)
- Multi-step questionnaire system with save/resume functionality

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming (light/dark mode support)
- **Forms**: React Hook Form with Zod validation
- **Charts**: Recharts for data visualization

The frontend follows a page-based architecture with shared components. Pages are located in `client/src/pages/` and reusable UI components in `client/src/components/ui/`.

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **API Style**: REST endpoints under `/api/*`
- **File Uploads**: Multer for handling receipt image uploads (stored in `/uploads` directory)

The server uses a simple route registration pattern in `server/routes.ts` with a storage abstraction layer for data persistence.

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema**: Defined in `shared/schema.ts` with Drizzle table definitions
- **Validation**: Zod schemas generated from Drizzle schemas using drizzle-zod
- **Current Storage**: In-memory storage implementation (MemStorage class) with interface for future database migration

The schema defines tables for users, income records, expenses, receipts, tax_questionnaires, and tax_questionnaire_responses with Canadian-specific tax filing statuses and industry-specific categorization.

### Tax Questionnaire System
- **tax_questionnaires**: Stores questionnaire metadata (type: t1/t2, status, current step, tax year)
- **tax_questionnaire_responses**: Stores individual question responses (sectionId, questionId, JSON value)
- Multi-step wizard pattern with progress tracking and resume capability
- Feature gating: T1 available to Personal/Corporate tiers, T2 available to Corporate tier only

### Build System
- **Development**: Vite dev server with HMR
- **Production Build**: Custom build script using esbuild for server bundling and Vite for client
- **Path Aliases**: `@/` maps to client source, `@shared/` maps to shared code

## External Dependencies

### Database
- PostgreSQL (configured via `DATABASE_URL` environment variable)
- Drizzle Kit for schema migrations (`npm run db:push`)

### Third-Party Services
The application is designed to integrate with:
- File storage for receipt images (currently local filesystem at `/uploads`)
- Session storage via connect-pg-simple for PostgreSQL-backed sessions

### Key NPM Packages
- `@tanstack/react-query` - Server state management
- `drizzle-orm` / `drizzle-zod` - Database ORM and validation
- `react-hook-form` / `@hookform/resolvers` - Form handling
- `recharts` - Data visualization
- `date-fns` - Date formatting
- `multer` - File upload handling
- Full shadcn/ui component set via Radix UI primitives