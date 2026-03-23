# Deployment Guide - CCJ SLA Tracker (IIS / Windows Server)

This guide outlines how to deploy the application on a Windows Server using Internet Information Services (IIS).

## 1. Prerequisites
- **Node.js**: v18+
- **PostgreSQL**: installed and running.
- **IIS Features**:
  - [URL Rewrite Module](https://www.iis.net/downloads/microsoft/url-rewrite) (Required for SPA routing)
  - [Application Request Routing (ARR)](https://www.iis.net/downloads/microsoft/application-request-routing) (Required to proxy to the API)


## 2. Server Setup

### A. Database
1. Create a database named `ccj_contracts` in PostgreSQL.
2. Initialize the schema:
   ```bash
   cd api
   npm install
   node src/scripts/initDb.js
   ```

### C. Database Migration (Optional)
If you are migrating from an existing database:
1. **Export** from your source machine:
   ```bash
   pg_dump -U postgres -d ccj_contracts > ccj_backup.sql
   ```
2. **Import** to the target server:
   ```bash
   psql -U postgres -d ccj_contracts < ccj_backup.sql
   ```

### B. Build Frontends (Vite)
On your build machine (or server), run:
```bash
cd admin-web && npm install && npm run build
cd ../main-web && npm install && npm run build
```
This generates `dist/` folders in both directories.

## 3. IIS Configuration

### Site 1: Main Tracker (Frontend)
1. Point a new IIS Website to the `main-web\dist` folder.
2. In that folder, create a `web.config` file with the following content (to support React routing):
   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <configuration>
     <system.webServer>
       <rewrite>
         <rules>
           <rule name="SPA Routes" stopProcessing="true">
             <match url=".*" />
             <conditions logicalGrouping="MatchAll">
               <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
               <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
             </conditions>
             <action type="Rewrite" url="index.html" />
           </rule>
         </rules>
       </rewrite>
     </system.webServer>
   </configuration>
   ```

### Site 2: Admin Panel (Frontend)
1. Point a new IIS Website to the `admin-web\dist` folder.
2. Create the same `web.config` file as above in the `dist` folder.

### Site 3: Backend API
You have two options:

#### Option 1: PM2 + Reverse Proxy (Recommended)
1. Start the API using PM2:
   ```bash
   cd api
   pm2 start src/index.js --name ccj-api
   ```
2. In IIS, create a site (or use an existing one) and use **URL Rewrite** to proxy `/api` requests to `http://localhost:5000/api`.
   - Ensure "Enable proxy" is checked in the Application Request Routing settings at the server level.

#### Option 2: iisnode
1. Install `iisnode` on the server.
2. Point an IIS Website to the `api` folder.
3. Configure a `web.config` to use `iisnode` for `src/index.js`.

## 4. Environment Variables
Ensure you have created `.env` files (based on `.env.example`) in the `api/`, `admin-web/`, and `main-web/` folders on the server.
- **IMPORTANT**: Update `VITE_API_URL` in the frontend `.env` files to point to the server's public IP or domain name.

## 5. File Permissions
Ensure the IIS User (`IIS AppPool\YourSiteName`) has **Read/Write** permissions to the `api/uploads` folder to handle contract PDF attachments.
