# Changelog

All notable changes to this project will be documented in this file.

## 2026-01-27

### Added
- **Config**: Added `JWT_SECRET` and `WEBAPP_PASSWORD` environment variables.
- **Frontend Auth**: Created `useAuth` hook for managing JWT sessions.
- **Frontend UI**: Added `Login.tsx` component for technician access.
- **Frontend API**: Added `login` method to `APIClient` and updated header injection to use `Authorization: Bearer`.
- **S3 Service**: Added `uploadFileToS3` helper to support direct server-to-S3 uploads.
- **Deployment**: Configured `src/server/app.ts` to serve the compiled React frontend statically, enabling a single-container deployment.

### Changed
- **Middleware**: Updated `authMiddleware` to support both Telegram `initData` and Bearer JWT tokens.
- **Dependencies**: Added `jsonwebtoken` and `@types/jsonwebtoken` to `package.json`.
- **Frontend App**: Refactored `App.tsx` to remove Telegram dependencies and implement conditional rendering based on auth state.
- **Frontend API**: Replaced `X-Telegram-Init-Data` header with standard Bearer Token authentication.
- **Docker**: Updated `docker-compose.yml` to include new authentication environment variables.
- **Entry Point**: Updated `src/index.ts` startup logs to provide clear access instructions for the standalone Web App.

### Removed
- **Frontend**: Removed `useTelegram` hook dependency.