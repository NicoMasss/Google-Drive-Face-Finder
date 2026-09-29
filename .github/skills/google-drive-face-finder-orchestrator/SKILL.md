---
name: google-drive-face-finder-orchestrator
description: "Orchestrate development of the Google Drive Face Finder MVP. Use when implementing, debugging, reviewing, testing, or planning Google OAuth, Google Drive image search, Node.js/TypeScript backend, Python/FastAPI/InsightFace face processing, multipart uploads, face comparison, thresholds, pagination, or the React frontend in this repository."
argument-hint: "Describe the next feature, bug, or MVP milestone to implement"
user-invocable: true
disable-model-invocation: false
---

# Google Drive Face Finder Orchestrator

## Purpose

Guide incremental development of this repository toward a functional MVP that lets an authenticated user compare a reference face with images in their own Google Drive. Keep the implementation simple, testable, privacy-conscious, ready to evolve toward facial indexing without introducing premature infrastructure and if you need you can create other agents to help you, you are an orchestrator.

## Operating Rules

- Inspect the current repository, relevant files, routes, services, dependencies, tests, and environment configuration before editing.
- State one local hypothesis about the controlling code path and one cheap validation check before the first edit.
- Preserve working behavior and existing technology. Do not recreate the project or replace InsightFace, Google Drive, OAuth, Node.js, or Python without a concrete reason.
- Make the smallest coherent change, then run a focused executable validation immediately before expanding the scope.
- Keep business orchestration in Node.js/TypeScript, Google Drive access in its service, and computer vision in the independent Python/FastAPI service.
- Do not add a database, queue, cache, distributed system, or permanent image storage for the MVP.
- Do not commit changes, expose secrets, or undo unrelated user changes.

## Architecture Contract

- Frontend: React UI only; it must not contain Google credentials or tokens.
- Backend: Express/TypeScript orchestrator responsible for OAuth, Drive metadata/downloads, uploads, validation, threshold rules, and calls to the face service.
- Face service: FastAPI/InsightFace service independent of Google Drive. It detects faces, generates embeddings, compares embeddings, and returns similarity data.
- Google Drive: read-only source of user files. Use `https://www.googleapis.com/auth/drive.readonly` and retain file IDs plus metadata instead of copying images permanently.
- Local ports: backend `http://localhost:3000`, face service `http://localhost:8000`.
- Configuration: read `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `FACE_SERVICE_URL`, and `FACE_SIMILARITY_THRESHOLD` from the environment. Never hardcode credentials or scatter the threshold literal.

## Delivery Workflow

### 1. Route the request

Classify the task as one of:

- backend route or orchestration;
- Google OAuth or Drive integration;
- face-service behavior;
- validation, privacy, or error handling;
- tests or diagnostics;
- frontend workflow;
- later optimization or indexing.

Find the nearest owning abstraction and a neighboring test or call site. Read only enough local context to identify the controlling path. If a file only forwards or registers behavior, follow the call into the service that decides it.

### 2. Establish the current baseline

Before changing code:

- inspect the relevant files and package scripts;
- check for existing uncommitted changes and work with them;
- identify the current endpoint contract and error behavior;
- confirm required services and environment variables without printing secrets;
- choose a narrow check that can disconfirm the working hypothesis.

For a new endpoint, first verify adjacent route and service patterns. For a bug, reproduce it with the smallest available test or request. For an integration task, use mocks or local service checks before requiring live Google credentials.

### 3. Implement in MVP order

Prefer this sequence unless the user explicitly changes the priority:

1. `POST /search/drive/compare`: receive `reference` and `fileId`, validate the reference, download one Drive image, call the face service, apply the configured threshold, and return file metadata plus `similarity_score` and `match`.
2. Reference validation: reject empty or invalid images, enforce MIME and size limits, require exactly one detected face, and return actionable client errors.
3. `POST /search/drive`: validate once, list Drive images with pagination, process images sequentially initially, ignore images without faces, continue after individual failures where practical, and sort matches by descending score.
4. Face-service optimization: extract the reference embedding once, compare it with every detected face in each Drive image, and use the maximum similarity for multi-face images.
5. Frontend: provide Google connection, reference upload, progress/error states, and result previews using existing project conventions.
6. Only after the flow is proven: bounded concurrency, caching, persistent sessions, indexing, and vector search.

### 4. Handle face semantics correctly

- A reference image must contain exactly one face for predictable MVP behavior.
- A Drive image may contain zero, one, or many faces.
- Zero faces means skip that image, not fail the whole search.
- For multiple faces, compare the reference embedding with every face and use `max_similarity`.
- A match is `similarity_score >= FACE_SIMILARITY_THRESHOLD`.
- Treat the score as model similarity, never as an identity probability.
- Keep the initial threshold configurable and experimental; do not claim that `0.40` is scientifically validated.

### 5. Apply security and privacy checks

- Keep client secrets, access tokens, and refresh tokens server-side.
- Never return tokens or log complete tokens; boolean presence indicators are acceptable during development.
- Use the minimum Drive scope and protect authenticated routes.
- Validate multipart field names, MIME type, file size, empty files, and malformed images.
- Download images temporarily for processing and avoid permanent copies.
- Ensure a `fileId` is resolved through the authenticated user's Drive client; never permit cross-user file access.
- Treat face embeddings and source photos as sensitive data.

### 6. Validate each slice

Use the narrowest available check first, then broaden only when it passes:

- TypeScript: the package's focused typecheck, build, lint, or test script.
- Python: focused pytest coverage or an import/health check for the face service.
- HTTP integration: `/health`, mocked Drive/face-service calls, then the real local service if available.
- Frontend: the project's test/build command and, when a dev server exists, a browser smoke test of upload, progress, errors, and results.

At minimum, cover health, OAuth URL scope, Drive list/download behavior, upload validation, face-service calls, threshold boundaries, no-face images, multiple faces, and per-image failure handling. Do not require live OAuth in unit tests.

### 7. Report completion

Summarize changed files and behavior, validation commands and outcomes, remaining blockers, and any assumptions. Call out unavailable external prerequisites such as Google credentials or the InsightFace model instead of masking them. Include the next smallest milestone only when it is genuinely useful.

## Endpoint Contracts

### Single-image comparison

`POST /search/drive/compare` as multipart form data:

- `reference`: reference image file;
- `fileId`: Google Drive file ID.

Expected successful shape:

```json
{
  "file": {
    "id": "abc123",
    "name": "photo.jpg",
    "mimeType": "image/jpeg"
  },
  "similarity_score": 0.76,
  "match": true
}
```

### Complete search

`POST /search/drive` as multipart form data with `reference`.

Expected successful shape:

```json
{
  "results": [
    {
      "id": "abc123",
      "name": "photo.jpg",
      "mimeType": "image/jpeg",
      "webViewLink": "https://drive.google.com/",
      "similarity_score": 0.81
    }
  ],
  "processed": 1,
  "matched": 1,
  "failed": 0
}
```

## Completion Checklist

- Existing working routes and services remain intact.
- OAuth uses offline access and the read-only Drive scope; no token is exposed.
- Reference and Drive images are validated before processing.
- Multi-face and no-face behavior is explicit and tested.
- Threshold comes from configuration and is applied consistently.
- Drive pagination is handled before declaring full search complete.
- Individual image failures do not silently become false matches.
- Results contain metadata and scores, not permanent image copies.
- Focused tests or executable checks pass, and unresolved external prerequisites are documented.
