# Courier Backend API

All paths below are relative to the backend origin. JSON requests use `Content-Type: application/json`. Protected routes require `Authorization: Bearer <JWT>`. Agency routes use the JWT's agency context and re-check that the caller's membership is active on every request. `agencyId` and `customerId` are never accepted from a request body for booking or agency employee operations.

Slot dates use `YYYY-MM-DD`. Slot times use 24-hour `HH:mm` in the agency's local time. The database stores a date and wall-clock times without a timezone; configure the agency's local timezone in the frontend when presenting them.

## Delivery slots

| Method and URL | Required role | Request | Success |
|---|---|---|---|
| `POST /api/delivery/agency/delivery-slots` | Agency Admin | `{ "date": "2026-12-01", "startTime": "09:00", "endTime": "12:00", "capacity": 10 }` | `201` slot with `booked`, `remaining`, and `isActive` |
| `GET /api/delivery/agency/delivery-slots?date=2026-12-01` | Agency Admin, Dispatcher | Optional `date` filter | `200` agency slots, including inactive slots |
| `PATCH /api/delivery/agency/delivery-slots/:id` | Agency Admin | Any subset of `date`, `startTime`, `endTime`, `capacity` | `200` updated slot |
| `PATCH /api/delivery/agency/delivery-slots/:id/deactivate` | Agency Admin | No body | `200` inactive slot; historical bookings remain |
| `GET /api/delivery/delivery-slots/available?agencyId=<uuid>&date=2026-12-01` | Public (customer use) | Required `agencyId` and future `date` | `200` active slots with remaining capacity; full slots are omitted |

Date/time validation, positive integer capacity, no overlapping slots for an agency/date, and preservation of confirmed bookings are enforced in the API and database. A confirmed slot's date/times cannot be edited. Capacity cannot be reduced below current confirmed bookings. Deactivation does not cancel existing bookings.

## Customer bookings

| Method and URL | Required role | Request | Success |
|---|---|---|---|
| `POST /api/delivery/bookings` | Customer | `{ "consignmentId": "<uuid>", "slotId": "<uuid>" }` | `201` confirmed booking snapshot |
| `GET /api/delivery/bookings?date=2026-12-01&status=CONFIRMED` | Customer | Optional date/status filters | `200` only the caller's bookings |
| `GET /api/delivery/bookings/:id` | Customer | — | `200` caller-owned booking, otherwise `404` |
| `DELETE /api/delivery/bookings/:id` | Customer | — | `200` cancelled booking; capacity is released |
| `POST /api/delivery/bookings/:id/reschedule` | Customer | `{ "slotId": "<new-slot-uuid>" }` | `200` updated booking; old and new capacity change atomically |

Booking responses include a historical slot snapshot (`date`, `startTime`, `endTime`), booking status/timestamps, agency name, and consignment tracking number/status. They do not include customer contact or address fields. A consignment can have at most one confirmed booking. Only active, non-terminal consignments can be booked or rescheduled. Slot row locks serialize capacity checks; exhausted capacity returns `409`.

## Agency bookings and assignments

| Method and URL | Required role | Request | Success |
|---|---|---|---|
| `GET /api/delivery/agency/bookings?date=2026-12-01&status=CONFIRMED` | Agency Admin, Dispatcher | Optional date/status filters | `200` bookings belonging to the verified agency |
| `GET /api/delivery/agency/bookings/:id` | Agency Admin, Dispatcher | — | `200` booking in the caller's agency, otherwise `404` |
| `POST /api/delivery/agency/consignments/:consignmentId/assignment` | Agency Admin, Dispatcher | `{ "employeeId": "<worker-user-uuid>" }` | `201` new assignment or `200` if already assigned to that worker |
| `GET /api/delivery/agency/assignments?active=true` | Agency Admin, Dispatcher | Optional `active=true|false` | `200` agency assignment history |
| `GET /api/delivery/agency/assignments/:id` | Agency Admin, Dispatcher | — | `200` assignment in the caller's agency, otherwise `404` |

The selected worker must have an active `DELIVERY_WORKER` membership in that agency. Reassignment closes the former assignment and creates a new history row. A partial unique database index permits only one active assignment per consignment.

## Worker delivery operations

| Method and URL | Required role | Request | Success |
|---|---|---|---|
| `GET /api/delivery/worker/assignments` | Delivery Worker | — | `200` only this worker's agency-scoped assignment history |
| `GET /api/delivery/worker/assignments/:id` | Delivery Worker | — | `200` own assignment, otherwise `404` |
| `GET /api/delivery/worker/consignments` | Delivery Worker | — | `200` active assignments with delivery details |
| `GET /api/delivery/worker/consignments/:id` | Delivery Worker | — | `200` details only while currently assigned |
| `PATCH /api/delivery/worker/consignments/:id/status` | Delivery Worker | `{ "status": "PICKED_UP" }`, `{ "status": "IN_TRANSIT" }`, or `{ "status": "OUT_FOR_DELIVERY" }` | `200` status and history updated |
| `POST /api/delivery/worker/consignments/:id/attempts` | Delivery Worker | Success: `{ "status": "SUCCESSFUL", "notes": "Handed to recipient" }`; failure: `{ "status": "FAILED", "failureReason": "Recipient unavailable", "notes": "Called twice" }` | `201` attempt and updated consignment status |
| `GET /api/delivery/agency/delivery-attempts?date=2026-12-01&consignmentId=<uuid>` | Agency Admin, Dispatcher | Optional date/consignment filters | `200` attempt history for the agency |

Only the active assigned worker can update a consignment. Worker status updates are limited to valid transitions into `PICKED_UP`, `IN_TRANSIT`, or `OUT_FOR_DELIVERY`; success/failure are recorded as attempts. A retry after failure records a transition back to `OUT_FOR_DELIVERY`. Success changes the consignment to `DELIVERED`, completes its confirmed booking, and closes the assignment in one transaction. Failure requires a reason and changes the status to `FAILED_DELIVERY`. Agency status updates cannot mark a delivery `DELIVERED` or `FAILED_DELIVERY`.

## Tracking

| Method and URL | Required role | Request | Success |
|---|---|---|---|
| `GET /api/consignments/track/:trackingNumber` | Public | Tracking number in `CDM-` plus 24 uppercase hex characters format | `200` current status, chronological public status history, agency name, and the current/completed delivery slot if available |

Public tracking is limited to 40 requests per IP per 15 minutes (`429` includes `Retry-After`). Its response omits private addresses, phone numbers, customer IDs, and employee details. Invalid and unknown tracking numbers both return `404`.

Authenticated existing endpoint `GET /api/consignments/:id` remains scoped to the authenticated customer or the verified agency. Delivery workers use the assigned-consignment routes above.

## Common errors

| Status | Meaning |
|---|---|
| `400` | Invalid path, query, or body data |
| `401` | Missing, invalid, or expired JWT |
| `403` | Authenticated role is not permitted |
| `404` | Resource not found within the caller's scope |
| `409` | Capacity exhausted, overlapping slot, duplicate active booking/assignment, or concurrent conflict |
| `422` | Request is well formed but violates a delivery business rule |
| `429` | Public tracking rate limit exceeded |
| `500` | Unexpected error; response does not expose database details |

Error response shape: `{ "success": false, "message": "..." }`.
