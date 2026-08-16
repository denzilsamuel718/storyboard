# Architecture

The browser communicates with the API using authenticated, HTTP-only cookies. The API owns authentication, authorization, public submission ID generation, metadata, upload authorization, signed downloads, and every administrator mutation. PostgreSQL is the source of truth. Object storage holds private binaries only.

## Core flow

1. A creator creates a draft owned by their server-side user ID.
2. The API validates file metadata and creates an unpredictable storage key.
3. The API starts a multipart upload and signs each requested part.
4. The browser sends parts directly to storage and returns ETags for completion.
5. On final submission, a PostgreSQL upsert atomically increments the global public-ID counter inside the same transaction as the status update, producing permanent references such as `SB0001`.
6. Admin decisions create both status history and audit records. Private notes are never selected for creator responses.

Creator queries include the authenticated creator ID. Admin routes pass both authentication and server-side role middleware. Signed downloads are issued only after ownership or role checks.

A future worker can consume object-created events for malware scanning, thumbnails, video metadata, notifications, and abandoned-upload cleanup without changing the API contract.
