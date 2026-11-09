# PRD: Neon PostgreSQL Migration and Vercel Deployment

## Problem
The History Quest application currently relies on a local SQLite database file that cannot persist state in serverless cloud runtimes such as Vercel. Additionally, the application is not yet deployed or publicly accessible under the target custom domain `history.melameds.net`.

## User & Job-to-be-Done
As a history learner, I want to access History Quest publicly on the web at `https://history.melameds.net` and play battle quizzes so that my questions, battle history, and progress are reliably saved in a cloud database across visits.

## Success Metric
- 100% of completed quiz attempts and battle logs initiated on `https://history.melameds.net` persist in Neon PostgreSQL without data loss.
- 0 DNS or SSL certificate errors when accessing `https://history.melameds.net`.

## Non-Goals
- User authentication, multi-tenant accounts, or password management (remains anonymous single-learner profile for v1).
- Migration of legacy data from local SQLite (`local.db`)—database starts fresh.
- Offline support or local SQLite fallbacks in production.

## Acceptance Criteria
- **AC-1 (Database Schema Initialization)**: Given a clean Neon PostgreSQL database, When database schema push/initialization is executed, Then all relational tables (`topics`, `contents`, `questions`, `attempts`, `answers`, `generationJobs`, `learnerProfile`) are created with valid PostgreSQL types and constraints.
- **AC-2 (Public Domain Availability)**: Given any web browser, When the user visits `https://history.melameds.net`, Then the application loads successfully over HTTPS with HTTP status 200 and a valid SSL certificate.
- **AC-3 (Quiz Flow & State Persistence)**: Given an active user on `https://history.melameds.net`, When the user selects a battle topic, chooses a difficulty, and completes 10 questions, Then the score and feedback (including celebratory or sad audio/effects) display correctly, and the attempt record is stored in Neon PostgreSQL.
- **AC-4 (History Retrieval Across Sessions)**: Given a user who completed past battles, When they return or start a new battle, Then the battle history and learner profile stats reflect prior results retrieved directly from Neon PostgreSQL.

## Assumptions
- `[CONFIRMED]` Neon PostgreSQL credentials and connection strings are provided and valid.
- `[CONFIRMED]` DNS for `melameds.net` is managed directly on Vercel.
- `[CONFIRMED]` GitHub repository `ranimela/learn-history-webapp` will be connected to Vercel for continuous deployment.
- `[CONFIRMED]` Database starts fresh; no migration of existing local SQLite rows is required.
- `[CONFIRMED]` User authentication is out of scope for this release.
- `[UNVERIFIED]` Whether the Vercel project has already been created in the Vercel dashboard or needs initial creation during setup.

## Kill Criteria
- Neon PostgreSQL connection fails to work reliably within Vercel serverless functions (e.g. persistent connection exhaustion or TLS errors).
- Vercel cannot issue an SSL certificate or route traffic for `history.melameds.net`.

## Open Questions
- None blocking planning.
