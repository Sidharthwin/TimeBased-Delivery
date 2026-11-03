# Backend Implementation Plan

## 1. Goal

Implement a secure Express API for a shared multi-agency courier platform, using PostgreSQL as the source of truth.

## 2. Suggested stack

- Node.js and Express
- PostgreSQL
- `pg` connection pool
- JWT authentication
- bcrypt password hashing
- Zod request validation
- Jest and Supertest

Use a modular monolith. Keep routes, controllers, services, repositories and middleware separated where useful.

## 3. Suggested folder structure

```text
backend/
  src/
    app.js
    server.js
    config/
      env.js
      database.js
    middleware/
      authenticate.js
      authorize.js
      validate.js
      errorHandler.js
      agencyScope.js
    modules/
      auth/
      agencies/
      users/
      serviceAreas/
      consignments/
      slots/
      bookings/
      deliveries/
      recommendations/
      analytics/
    utils/
    tests/
  migrations/
  seeds/
  .env.example
  package.json
```

## 4. Authentication and authorization

- Hash passwords with bcrypt; never store plaintext passwords.
- Validate credentials and issue a signed JWT.
- Add authentication middleware to protected routes.
- Add role authorization middleware.
- Resolve the user's agency membership from the database.
- Platform Admin routes should be separate from agency-scoped routes.
- A user must not be able to choose their own role or agency membership through an unrestricted public request.

Suggested roles:

- `PLATFORM_ADMIN`
- `AGENCY_ADMIN`
- `DISPATCHER`
- `DELIVERY_WORKER`
- `CUSTOMER`

## 5. Multi-agency isolation

This is a critical security requirement.

- Use one shared database.
- Store `agency_id` on tenant-owned operational records.
- Use an `AGENCY_USER` membership table to map users to agencies and roles.
- Derive the agency ID from the authenticated user's membership.
- Do not trust `agency_id` supplied in request bodies, query strings or route parameters as proof of access.
- Scope every read, update and delete query by the authorized agency.
- For nested records, verify that the parent record belongs to the user's agency.
- Add automated cross-agency access tests.

Example query pattern:

```sql
SELECT *
FROM consignments
WHERE id = $1
  AND agency_id = $2;
```

Here `$2` must come from authenticated server-side membership context.

## 6. Suggested API endpoints

### Authentication

```http
POST /api/auth/login
GET  /api/auth/me
```

### Platform Admin

```http
POST  /api/admin/agencies
GET   /api/admin/agencies
GET   /api/admin/agencies/:id
PATCH /api/admin/agencies/:id
PATCH /api/admin/agencies/:id/status
```

### Agency operations

```http
GET  /api/agency/dashboard
POST /api/agency/users
POST /api/consignments
GET  /api/consignments
GET  /api/consignments/:id
GET  /api/consignments/:trackingNumber
PATCH /api/consignments/:id/status
POST /api/slots
GET  /api/slots/available
GET  /api/consignments/:id/slots
POST /api/consignments/:id/bookings
PATCH /api/bookings/:id/reschedule
POST /api/bookings/:id/cancel
GET  /api/worker/deliveries
POST /api/consignments/:id/attempts
GET  /api/consignments/:id/recommendations
GET  /api/analytics/delivery-outcomes
GET  /api/analytics/slot-utilization
```

Finalize request/response schemas jointly with the frontend and ML developers. Avoid implementing duplicate endpoints that perform the same operation.

## 7. Booking capacity and concurrency

Never rely only on a frontend availability check. Two customers may attempt to book the last place at the same time.

Recommended transaction flow:

1. Begin transaction.
2. Lock the relevant slot row using `SELECT ... FOR UPDATE`.
3. Count active confirmed bookings for that slot.
4. Compare the count with the slot capacity.
5. If full, roll back and return HTTP `409 Conflict`.
6. Otherwise insert the booking.
7. Commit the transaction.

Illustrative SQL:

```sql
BEGIN;

SELECT id, capacity
FROM delivery_slot
WHERE id = $1
  AND agency_id = $2
FOR UPDATE;

SELECT COUNT(*) AS confirmed_count
FROM slot_booking
WHERE slot_id = $1
  AND status = 'CONFIRMED';

-- Application checks confirmed_count < capacity.
-- Insert booking only if capacity remains.

COMMIT;
```

Use the correct table and column names from the final schema. Ensure all queries run on the same transaction connection.

## 8. Booking lifecycle

Suggested statuses:

- `CONFIRMED`
- `CANCELLED`
- `COMPLETED`
- `RESCHEDULED` (or retain old booking as historical and create a new confirmed booking)

Preserve booking history. Do not overwrite historical records in a way that loses the previous slot or status. Rescheduling should be transactional and should validate capacity for the new slot.

## 9. ML recommendation integration

- Backend fetches eligible candidate slots.
- Backend sends only the required, authorized data to the predictor.
- Predictor returns scores/recommendations, not a booking.
- Backend validates that returned slot IDs belong to the candidate set.
- Backend returns recommendations to the frontend.
- Booking endpoint rechecks capacity independently.
- If predictor times out or fails, use deterministic fallback ranking based on availability and simple business rules.

## 10. Error handling

Use consistent responses, for example:

```json
{
  "error": {
    "code": "SLOT_FULL",
    "message": "This delivery slot is no longer available."
  }
}
```

Suggested HTTP codes:

- `400` invalid request
- `401` unauthenticated
- `403` authenticated but not permitted
- `404` resource not found or not accessible
- `409` booking conflict/capacity exhausted
- `500` unexpected server error
- `503` dependent service unavailable, where appropriate

Avoid exposing SQL errors, stack traces or secrets to clients.

## 11. Backend test checklist

- [ ] Login success and failure.
- [ ] Passwords are stored as hashes.
- [ ] Role restrictions work.
- [ ] Platform Admin can create agencies.
- [ ] Agency Admin cannot access another agency's records.
- [ ] Cross-agency update/delete attempts fail safely.
- [ ] Booking succeeds when capacity exists.
- [ ] Booking fails with `409` when full.
- [ ] Concurrent booking cannot exceed capacity.
- [ ] Cancellation releases capacity according to the business rule.
- [ ] Rescheduling preserves history and validates capacity.
- [ ] Predictor failure triggers fallback.
- [ ] Invalid predictor slot IDs are rejected.
