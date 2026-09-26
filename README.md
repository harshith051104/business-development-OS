# ELLY Business Development Portal — Backend (Phase 1)

This repository contains the backend for the internal **ELLY Business Development Portal**, handling authentication, user session management, and strict role-based access control.

> **IMPORTANT**: This internal portal is restricted solely to the internal Business Development team (`BUSINESS_DEVELOPMENT` role). Hospitals, patients, external doctors, and general users are forbidden from accessing this portal.

---

## Phase 1 Capabilities

- **User Model & Database**: SQLAlchemy User table with `id`, `name`, `email`, `password_hash`, `role`, `is_active`, `created_at`, `updated_at`.
- **Password Security**: Bcrypt salted password hashing.
- **JWT Authentication**: HS256 signed JSON Web Tokens with configurable expiration.
- **Role-Based Access Control**: Reusable FastAPI dependency ensuring endpoints are strictly restricted to authorized roles.
- **Protected BD Access Verification**: `/api/business-development/access` verifying `BUSINESS_DEVELOPMENT` clearance.
- **Automated Tests**: 10 comprehensive tests covering all positive and negative access scenarios.

---

## API Endpoints

| Method | Endpoint | Access Level | Description |
|---|---|---|---|
| `POST` | `/auth/login` | Public | Authenticates credentials and returns JWT bearer token + user profile |
| `GET` | `/auth/me` | Authenticated | Retrieves current authenticated user profile |
| `POST` | `/auth/logout` | Authenticated | Confirms logout |
| `GET` | `/api/business-development/access` | `BUSINESS_DEVELOPMENT` only | Returns 200 for BD users, 403 for other roles, 401 for unauthenticated |
| `GET` | `/health` | Public | System and database health status |
| `GET` | `/docs` | Public | Interactive Swagger API documentation |

---

## Development Setup

### 1. Configure Environment
```bash
cp .env.example .env
```

### 2. Seed Test Users
```bash
py seed.py
```

### 3. Run Backend Server
```bash
py -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

### 4. Run Test Suite
```bash
py -m pytest tests/test_access_control.py -v
```

---

## Test Accounts

| Name | Email | Password | Role | Expected BD Portal Access |
|---|---|---|---|---|
| **BD Test User** | `bd@test.local` | `password123` | `BUSINESS_DEVELOPMENT` | **200 Allowed** |
| **Healthcare User** | `healthcare@test.local` | `password123` | `HEALTHCARE` | **403 Forbidden** |
| **Standard User** | `user@test.local` | `password123` | `USER` | **403 Forbidden** |
| **Admin User** | `admin@test.local` | `password123` | `ADMIN` | **403 Forbidden** |
