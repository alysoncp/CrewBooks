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

The schema defines tables for users, income records, expenses, and receipts with Canadian-specific tax filing statuses and industry-specific categorization.

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