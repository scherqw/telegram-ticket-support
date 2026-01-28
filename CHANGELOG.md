# Changelog

All notable changes to this project will be documented in this file.

## 2026-01-28

### Added
- **Database**: Created `Technician` model to store linked technician profiles.
- **Service**: Added `authState.ts` for managing temporary linking codes in memory.
- **API**: Added `GET /api/auth/link-code` and `GET /api/auth/link-status/:code` to facilitate account linking.
- **Bot**: Added `/link <code>` command to `techBot` to authenticate technicians via Telegram.
- **Notifications**: Implemented logic in `userMessage.ts` to notify all linked technicians via `techBot` when a new ticket is created.
- **Accountability**: Updated `tickets.ts` routes (`/reply`, `/close`) to utilize the authenticated Technician's identity from the JWT for message logging and user replies.
- **UI**: Added `LinkingModal.tsx` to generate and display Telegram linking codes.
- **Components**: Updated `Navigation.tsx` to display current user identity and trigger the linking flow.

### Changed
- **Architecture**: Migrated to a "Two-Bot" system.
  - `userBot`: Handles customer support interactions (existing logic).
  - `techBot`: Handles technician notifications (new instance).
- **Config**: Updated `BotConfig` and `loader.ts` to require `BOT_USER_TOKEN` and `BOT_TECH_TOKEN` instead of a single `BOT_TOKEN`.
- **Initialization**: Updated `src/index.ts` to initialize and run both bots in parallel.
- **Controllers**: Updated `authController` to support code generation and status checking.
- **Routing**: Updated `authRoutes` to include new linking endpoints.
- **Bot Initialization**: Updated `src/index.ts` to pass the `techBot` instance to the `userMessage` handler via a setter function (`setNotificationBot`), preventing circular dependencies.

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
