# create-express-starter-kit 

A powerful CLI tool that interactively scaffolds a production-ready Express.js backend. By answering a few quick questions, it generates a robust, modular, and fully configured codebase tailored to your specific stack requirements.

## 📦 Usage

You can generate your project in an empty directory without installing the package globally. Run one of the following commands:

```bash
pnpm dlx create-express-starter-kit
```
**OR**
```bash
npx create-express-starter-kit
```

## ✨ Features & Available Integrations

The CLI prompts you with several configuration choices to automatically wire up your project dependencies, middleware, and project structure:

- **Package Manager 📦**: 
  - npm
  - pnpm
  - yarn
- **Authentication 🔐**: 
  - None
  - Custom JWT (basic)
  - Custom JWT-2FA (email verification + password reset via Redis + Resend)
  - Clerk Auth Support
- **Database 🗄️**: 
  - MongoDB (via Mongoose)
  - PostgreSQL (via Prisma ORM - automatically initializes schemas)
- **In-Memory Cache / DB ⚡**: 
  - Redis (via ioredis)
  - Valkey
  - None
- **Validation 🛡️**: 
  - Zod (generates validation middlewares and example schemas)
  - None
- **File Uploads ☁️**: 
  - Multer + Cloudinary
  - Multer + AWS S3
  - None
- **Docker 🐳**: 
  - Automatically generates a `docker-compose.yml` for your selected databases so you can start them with one click (includes MongoDB, Postgres, pgAdmin, Redis Stack, and Valkey configurations).

## Base Folder Structure

When the setup begins, the CLI scaffolding lays down a lean, base Express app using domain-driven design:

```text
.
├── controllers/
│   └── example.controller.js
├── middlewares/
│   └── example.middleware.js
├── public/
├── routers/
│   └── example.route.js
├── utils/
│   ├── ApiError.js
│   ├── ApiResponse.js
│   └── asyncHandler.js
├── app.js
└── index.js
```

### 🔄 How Selections Modify the Codebase
Based on your exact selections, files are cleanly swapped or generated so you are never left with useless "dead code":

**Custom JWT Auth (basic / 2FA)**
Replaces example files with auth-ready user routes/controllers and middleware.
```text
.
├── controllers/
│   └── user.controller.js
├── models/
│   └── user.model.js      (MongoDB only)
├── middlewares/
│   └── auth.middleware.js
├── routers/
│   └── user.route.js
├── prisma/
│   └── schema.prisma      (PostgreSQL only)
├── app.js          (updated)
└── index.js        (updated)
```

JWT-basic
- Login endpoint: `/login`
- Register endpoint: `/register`
- Required env keys: `JWT_SECRET`, `JWT_EXPIRES_IN`

JWT-2FA templates also include:
- Email verification endpoints: `/send-verification-code`, `/verify-email`
- Password reset endpoints: `/send-reset-code`, `/reset-password`
- Current profile endpoint: `/current`
- Refresh endpoint: `/refresh-auth-tokens`
- Required env key: `RESEND_API_KEY`

**Clerk Auth**
Rewrites `app.js` to mount Clerk's strict express middleware.
```text
.
└── app.js          (updated with @clerk/express)
```

**Database (MongoDB/Mongoose)**
Adds database connection and relevant model schemas.
```text
.
├── models/
│   └── user.model.js  (or example.model.js)
└── utils/
    └── connectDB.js
```

**Database (PostgreSQL/Prisma)**
Initializes Prisma schema and singleton database clients.
```text
.
├── prisma/
│   └── schema.prisma
└── utils/
    ├── connectDB.js
    └── prismaClient.js
```

**Validation (Zod)**
Injects validation middleware and Zod schema definitions only (does not overwrite auth controllers/routes).
```text
.
├── middlewares/
│   └── validate.middleware.js
└── schemas/
    └── user.schema.js
```

**In-Memory Cache (Redis / Valkey)**
Drops a configured client instance strictly for the chosen service.
```text
.
└── utils/
    └── redis.js       (or valkey.js)
```

**File Uploads (Cloudinary / AWS S3)**
Generates local disk storage middleware and dedicated SDK upload service.
```text
.
├── middlewares/
│   └── multer.middleware.js
└── utils/
    └── cloudinary.js  (or uploadS3.js)
```

**Docker**
Writes a custom compose file defining services uniquely based on databases/caches opted into.
```text
.
└── docker-compose.yml
```

## 🛠️ What it Does Under the Hood

1. **Initializes the Project:** Creates your `package.json` configured with ESM (`type: "module"`) and sets up a `dev` script using `node --watch`.
2. **Installs Dependencies:** Dynamically installs only the packages you need (e.g., `express`, `cors`, `zod`, `mongoose`, `prisma`, `multer`, etc.) using your chosen package manager (npm, pnpm, or yarn).
3. **Scaffolds Structure:** Sets up a clean domain-driven directory structure including `controllers/`, `routers/`, `models/`, `middlewares/`, `utils/`, and error-handling utilities like `ApiError` and `ApiResponse`. 
4. **Writes Boilerplate:** Injects full, ready-to-use boilerplate code (e.g., JWT basic/2FA flows, Prisma connections, Zod validators) based on your exact technology stack.
5. **Generates Environment Variables:** Appends the necessary secrets, Database URIs, and config keys directly into a `.env` file so you know exactly what is required.

## 🚀 Getting Started

Once the CLI finishes running:

1. Open the `.env` file and fill in your missing credentials (like DB connection strings, JWT secrets, Cloudinary/AWS keys).
2. Start up your Docker containers (if generated):
   ```bash
   docker-compose up -d
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```

## 📄 License
MIT
