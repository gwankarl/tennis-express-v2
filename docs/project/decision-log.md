# Project Decision Log

This log records decisions approved for Tennis-Xpress V2. Significant architecture
decisions may also receive individual records in `docs/adr/`.

## D-001 — Fresh repository

**Status:** Approved

Develop in the new `tennis-xpress-v2` repository. Do not copy application source
or configuration from the old repository. Preserve the approved planning baseline
and relevant lessons learned.

## D-002 — Monorepo and package manager

**Status:** Approved

Use an npm-workspace monorepo with `backend/` and `frontend/` workspaces.
Commit the root `package-lock.json` and use npm for dependency management.

## D-003 — Runtime baseline

**Status:** Approved

Use Node.js 22, `.nvmrc` set to `22`, and the agreed root engine constraints
(`node >=22 <23`, `npm >=10`). Reassess support status and dependency compatibility
before release.

## D-004 — Local development database

**Status:** Approved

Use the existing local MongoDB installation and database name `tennis_xpress_v2`.
Development URI:

`mongodb://127.0.0.1:27017/tennis_xpress_v2`

Automated tests must use an isolated test database and must not alter development
or production data.

## D-005 — Environment-file policy

**Status:** Approved

Commit example configuration only. Ignore real environment files and never commit
credentials or secrets. Backend configuration belongs in `backend/.env`.
Use `frontend/.env.local` only when required.

## D-006 — Local application URLs

**Status:** Approved

Frontend: `http://localhost:5173`  
Backend: `http://localhost:5000`

The backend must explicitly allow the configured frontend origin. The proposed API
prefix is `/api/v1`; reconcile it with approved planning document P07 before
implementation.

## D-007 — Development sequence

**Status:** Approved

Complete Stage 1 readiness before Stage 2. Build and accept backend functionality
before beginning frontend feature implementation. Complete integration and final
acceptance after both sides are ready.

## D-008 — Architecture and coding conventions

**Status:** Approved

Use layered backend responsibilities and feature-oriented organization. Use strict
TypeScript, runtime validation of untrusted input, centralized error handling,
least-privilege access and deliberate workspace boundaries. Exact implementation
details must align with the approved architecture and API documents.

## D-009 — Testing and quality strategy

**Status:** Approved

Use Vitest, `mongodb-memory-server`, Supertest, React Testing Library and Playwright
as appropriate. Enforce separate workspace coverage thresholds: statements 80%,
branches 75%, functions 80%, and lines 80%. Establish lint, formatting, type-check,
build and test gates, plus GitHub Actions CI.

## D-010 — Controlled milestone execution

**Status:** Approved

For each milestone, agree on scope, dependencies and acceptance criteria before
implementation. Verify results, record evidence and obtain acceptance before moving
forward. Use change control for scope changes.

## D-011 — Stage 1 task register

**Status:** Approved

Use `stage-1-task-register.md` as the authoritative register for Stage 1 task IDs,
batches, statuses and acceptance evidence.

## D-012 — Documentation conventions

**Status:** Approved in principle

Keep project records concise and useful. Preserve the approved planning documents.
Use properly formatted `/* ... */` for multiline explanatory code comments and `//`
for single-line comments. Avoid redundant comments.

## D-013 — Environment-file layout

**Status:** Approved

- Root `.env.example` documents the project-level development baseline.
- `backend/.env.example` documents backend environment variables and is committed.
- `backend/.env` contains local backend settings and must not be committed.
- `frontend/.env.local` is optional and should be created only when frontend
  environment configuration is needed.
- Frontend variables must contain public configuration only; never expose
  database credentials, private API keys, or other server-side secrets.
- Real environment files are ignored by Git, while `.env.example` files
  remain eligible for version control.
- Environment validation and application-specific configuration are handled
  separately under ENV-03 and subsequent implementation tasks.

## D-014 — Local URLs and CORS policy

**Status:** Approved

- The backend listens on the configured `PORT`.
- The frontend origin is configured through `CLIENT_URL`.
- Express CORS middleware will explicitly allow the configured frontend origin.
- Credentialed requests are enabled only where required by the approved
  authentication strategy.
- The backend must not use unrestricted wildcard origins with credentials.
- The API prefix remains subject to reconciliation with planning document P07.
- CORS middleware integration is deferred until the backend server foundation
  exists; no placeholder server is created for this task.

## D-015 — Database and Test Isolation

**Status:** Approved

- Development uses the `tennis_xpress_v2` database.
- The application may use a separately configured MongoDB Atlas connection when needed.
- The default automated test suite must run without a MongoDB server, MongoDB binary download, or Atlas credentials.
- Unit tests should mock database dependencies where practical.
- Database integration tests must use an explicitly configured, dedicated test database.
- Test configuration must reject development or production database targets before destructive operations.
- Test data and cleanup must remain isolated from development and production data.
- `mongodb-memory-server` is not required for the default test suite. It may be introduced later if a specific testing need justifies it.

## D-016 — External-Service Configuration Boundaries

**Status:** Approved

- Email and image-storage providers are configured through environment variables.
- Development and production use separate provider credentials and settings.
- Real credentials and local environment files must never be committed.
- Example environment files contain placeholders only.
- Automated tests mock external services by default and must not require external accounts or live API calls.
- Provider-specific configuration and validation are introduced with the relevant feature.
- External services are not required for the application to start unless an approved feature explicitly requires them.

## D-017 — Environment Verification Boundaries

**Status:** Approved

- Environment examples document the required local configuration.
- Local environment files and credentials must remain uncommitted.
- Backend environment configuration must compile successfully.
- Runtime configuration loading and MongoDB connectivity must be verified when the backend startup and database connection components are implemented.
- Clean-clone installation and documented startup commands must be verified before project release.

## D-018 — Feature-Oriented Module Boundaries

**Status:** Approved

- Backend business capabilities are organized into feature modules.
- Frontend business capabilities are organized into feature modules.
- Each module or feature owns its business logic and internal implementation.
- Cross-feature interactions use deliberate public interfaces instead of internal-file imports.
- Shared infrastructure contains generic, reusable functionality and does not depend on business features.
- Circular dependencies are avoided.
- The frontend communicates with the backend through the API and does not import backend source code.
- Backend and frontend feature responsibilities follow the approved ARCH-02 module mappings.

## D-019 — API Request Validation and Error Handling

**Status:** Approved

- Zod is the standard library for validating applicable API request inputs.
- Request bodies, query parameters, and route parameters are validated before reaching business logic.
- Validation schemas are defined close to the feature or module that owns the relevant inputs.
- Shared validation middleware handles schema validation consistently across routes.
- A centralized error-handling middleware processes errors from API requests.
- API errors use a consistent response structure with an appropriate HTTP status code and a safe, client-facing error message.
- Validation errors return HTTP 400 with sufficient field-level details to help clients correct invalid input.
- Authentication and authorization failures use appropriate HTTP status codes without exposing sensitive implementation details.
- Unexpected errors return HTTP 500 with a generic client-facing message.
- Internal stack traces, secrets, database details, and other sensitive implementation information are not exposed in production responses.
- Errors are logged appropriately on the server without unnecessarily recording sensitive data.
- Feature-specific business rules remain in the relevant services; request validation does not replace business validation.

## D-020 — Baseline Security Conventions

**Status:** Approved

- Authentication is required for protected operations; public access is limited to explicitly designated endpoints.
- Authorization is enforced on the backend and must not rely on frontend UI restrictions.
- Access is determined by the authenticated user's role and the permissions required for the operation.
- Users may access or modify only resources they are authorized to use. Ownership and access checks are performed on the backend.
- Passwords are hashed using a suitable password-hashing algorithm and are never stored or logged in plaintext.
- Authentication tokens are validated on protected requests. Signing secrets and other credentials are kept in environment variables and never committed to the repository.
- Token expiry, invalid tokens, and logout or revocation behavior follow the approved authentication design.
- Error responses must not expose passwords, tokens, secrets, stack traces, or sensitive internal implementation details.
- Security-sensitive operations must validate input and reject unauthorized requests by default.
- Security controls are implemented and tested within the relevant feature before that feature is accepted.

## D-021 — Naming and Code-Style Conventions

**Status:** Approved

- Use TypeScript for application code in both workspaces.
- Use `camelCase` for variables, functions, and object properties.
- Use `PascalCase` for classes, React components, and TypeScript types or interfaces.
- Use `UPPER_SNAKE_CASE` for shared constants that represent fixed configuration values.
- Use `kebab-case` for filenames, except where framework or tooling conventions require another format.
- Use named exports by default; use default exports where required or conventional, including the main React component and application entry points.
- Use explicit `import type` statements for imports used only as types.
- Use consistent relative imports within a workspace and include `.js` extensions in backend relative imports under the NodeNext module configuration.
- Use ESLint for code-quality and consistency rules.
- Use Prettier for automated formatting.
- Apply shared conventions across both workspaces while allowing framework-specific rules where necessary.
- Provide consistent root-level commands for linting and formatting once the relevant workspace tooling is configured.
- Avoid suppressing lint rules unless there is a clear, documented reason.

## D-022 — Documentation and Comment Conventions

**Status:** Approved

- Comments explain intent, non-obvious behavior, constraints, or important implementation decisions; they do not restate obvious code.
- Use `//` for single-line comments.
- Use properly formatted `/* ... */` blocks for multiline comments.
- Document public interfaces when their purpose, expected inputs, outputs, or constraints are not self-evident.
- Document environment variables in the relevant example environment file, including their purpose, whether they are required, and safe placeholder values.
- Keep README files focused on setup, configuration, commands, and essential usage instructions.
- Keep detailed architectural and implementation decisions in the project documentation and decision log rather than duplicating them in source comments.
- Update documentation when changes affect setup, configuration, public interfaces, or established behavior.
- Keep documentation concise, accurate, and consistent with the implemented code.
- Never include real secrets, credentials, or sensitive values in documentation.
