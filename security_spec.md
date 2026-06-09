# Firestore Security Specification: Speech Therapy App

## Data Invariants
1. Each therapy plan must be bound to a unique therapist (`ownerId`).
2. Only the authenticated therapist who created the plan can read, update, or delete it (Zero-Trust isolation).
3. The name and patient fields cannot be empty during creation.
4. Timestamps (`createdAt`, `updatedAt`) must match server time.

## Test Cases (The Dirty Dozen Blockers)
1. Write plan without being signed in -> **BLOCKED**
2. Write plan with a foreign `ownerId` -> **BLOCKED**
3. Read a plan belonging to another therapist -> **BLOCKED**
4. Update a plan with a giant string to crash memory -> **BLOCKED**
5. Inject non-regex characters into the `planId` path -> **BLOCKED**
6. Modify a plan's immutable `createdAt` field -> **BLOCKED**
7. Set mock role/claims like `isAdmin` to gain extra permissions -> **BLOCKED**
