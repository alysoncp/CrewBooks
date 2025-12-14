# Setting Up Local PostgreSQL for Development

Since your network doesn't support IPv6 and Supabase's free tier only provides IPv6, here's how to set up a local PostgreSQL database for development.

## Option 1: Install PostgreSQL Locally (Recommended)

### Windows Installation:

1. **Download PostgreSQL:**
   - Go to https://www.postgresql.org/download/windows/
   - Download the Windows installer
   - Run the installer and follow the prompts
   - Remember the password you set for the `postgres` user

2. **Update your `.env` file:**
   ```
   DATABASE_URL=postgresql://postgres:your-local-password@localhost:5432/crewbooks
   SESSION_SECRET=e1014662d6dbd8354c67eaef1ffe27a9aa9703325b723b8c106999da2ea7388c
   ```

3. **Create the database:**
   - Open "SQL Shell (psql)" from the Start menu
   - Connect with the default settings (press Enter for each prompt)
   - Run: `CREATE DATABASE crewbooks;`
   - Exit: `\q`

4. **Run migrations:**
   ```bash
   npm run db:push
   ```

## Option 2: Use Docker (Alternative)

If you have Docker installed:

1. **Run PostgreSQL in Docker:**
   ```bash
   docker run --name crewbooks-db -e POSTGRES_PASSWORD=yourpassword -e POSTGRES_DB=crewbooks -p 5432:5432 -d postgres:16
   ```

2. **Update your `.env` file:**
   ```
   DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/crewbooks
   SESSION_SECRET=e1014662d6dbd8354c67eaef1ffe27a9aa9703325b723b8c106999da2ea7388c
   ```

3. **Run migrations:**
   ```bash
   npm run db:push
   ```

## Option 3: Use Supabase IPv4 Add-on

If you want to stick with Supabase:

1. Go to your Supabase project dashboard
2. Navigate to Settings → Add-ons
3. Purchase the IPv4 add-on
4. Use the IPv4 connection string provided

## Switching Between Local and Supabase

You can easily switch between local and Supabase by updating your `.env` file with the appropriate `DATABASE_URL`.

