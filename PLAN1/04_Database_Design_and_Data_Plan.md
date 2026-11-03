# Database Design and Data Plan

## 1. Design goals

- Support multiple courier agencies in one application and one PostgreSQL database.
- Enforce tenant isolation at the backend query layer.
- Preserve booking and delivery history.
- Keep the MVP schema understandable and implementable within the project timeline.

## 2. Core entities

| Entity | Purpose |
|---|---|
| `COURIER_AGENCY` | Registered courier companies |
| `USER` | Login identity and user profile |
| `AGENCY_USER` | Agency membership and agency-specific role |
| `ADDRESS` | Sender/recipient or delivery address |
| `SERVICE_AREA` | Area/pincode served by an agency |
| `POSTAL_WORKER` | Worker profile/operational details if needed |
| `CONSIGNMENT` | Parcel/article being delivered |
| `DELIVERY_SLOT` | Date/time window and capacity |
| `SLOT_BOOKING` | Customer's reservation and booking history |
| `DELIVERY_ATTEMPT` | Recorded attempt and outcome |
| `SLOT_RECOMMENDATION` | Optional stored recommendation snapshot |
| `NOTIFICATION` | Optional in-app notification record |

Do not create every optional table unless the feature is actually needed for the demo.

## 3. Relationship overview

```text
COURIER_AGENCY
  ├── AGENCY_USER ─── USER
  ├── SERVICE_AREA
  ├── CONSIGNMENT
  │     ├── ADDRESS (recipient/sender references)
  │     ├── SLOT_BOOKING ─── DELIVERY_SLOT
  │     ├── DELIVERY_ATTEMPT
  │     └── SLOT_RECOMMENDATION
  └── DELIVERY_SLOT
```

A user may have one or more agency memberships if the product requires it. For a simpler MVP, constrain each operational user to one agency membership. A Platform Admin can exist without an agency membership.

## 4. Key fields to consider

### `COURIER_AGENCY`

- `id` primary key
- `name`
- `code` unique
- `contact_email`
- `contact_phone`
- `status`
- `created_at`, `updated_at`

### `USER`

- `id` primary key
- `name`
- `email` unique
- `password_hash`
- `status`
- `created_at`, `updated_at`

### `AGENCY_USER`

- `id` primary key
- `agency_id` foreign key
- `user_id` foreign key
- `role`
- `created_at`
- Unique constraint on `(agency_id, user_id)`

### `SERVICE_AREA`

- `id`
- `agency_id`
- `name`
- `pincode` or area identifier
- `status`

### `CONSIGNMENT`

- `id`
- `agency_id`
- `tracking_number`
- `sender_address_id`
- `recipient_address_id`
- `customer_user_id` where applicable
- `service_area_id`
- `article_type`
- `status`
- `created_at`, `updated_at`

Use a unique constraint on `(agency_id, tracking_number)` unless tracking numbers are globally unique by product design.

### `DELIVERY_SLOT`

- `id`
- `agency_id`
- `service_area_id`
- `slot_date`
- `start_time`
- `end_time`
- `capacity`
- `status`
- `created_at`, `updated_at`

Add checks so capacity is positive and the end time is after the start time.

### `SLOT_BOOKING`

- `id`
- `agency_id`
- `consignment_id`
- `slot_id`
- `customer_user_id`
- `status`
- `booked_at`
- `cancelled_at` if applicable
- `created_at`, `updated_at`

Keep historical booking records when rescheduling or cancelling. Define which statuses consume capacity.

### `DELIVERY_ATTEMPT`

- `id`
- `agency_id`
- `consignment_id`
- `worker_user_id`
- `attempted_at`
- `outcome`
- `notes`

## 5. Constraints and indexes

Recommended:

- Foreign keys for all relationships.
- Unique agency code.
- Unique user email.
- Unique `(agency_id, tracking_number)`.
- Check constraints for positive slot capacity and valid time ranges.
- Index tenant-scoped lookup columns, such as `(agency_id, status)` and `(agency_id, slot_date)`.
- Index booking lookups by `(agency_id, slot_id, status)`.
- Use appropriate `ON DELETE` behavior; avoid cascading deletion of operational history by default.

Always include `agency_id` in tenant-scoped queries, even when a record ID is globally unique.

## 6. Capacity calculation

Available capacity should be calculated from:

```text
available_capacity = slot.capacity - count(active confirmed bookings)
```

Do not maintain an independently editable `available_capacity` field unless you also implement robust transactional synchronization. For this MVP, derive it from bookings.

The booking transaction must lock the slot row, recalculate active bookings and insert only if capacity remains.

## 7. Data and seed plan

Seed at least:

- Two demo agencies.
- One Agency Admin per agency.
- A dispatcher and delivery worker for at least one agency.
- A customer account.
- Two or more service areas/pincodes.
- Several consignments with different statuses.
- Slots with different capacities and dates.
- Confirmed, cancelled and completed booking examples.
- Delivery attempts with different outcomes.

Use clearly fictional names and contact details in seed data. Do not use real customer personal information.

## 8. ML dataset planning

The prediction target must be defined before feature selection. A reasonable MVP target is:

**For a consignment and a candidate delivery time slot, estimate the probability that the first delivery attempt will succeed.**

Potential features, only where the dataset supports them:

- Day of week
- Time window
- Lead time between booking and delivery
- Slot utilization at recommendation time
- Service area or pincode (use appropriate encoding)
- Article type
- Previous attempt count
- Recipient time preference
- Historical area/time-window success aggregates

Avoid target leakage: do not use information that would only become known after the delivery outcome.

Split data by time or another suitable grouping so evaluation better reflects future predictions. If using synthetic data, label it clearly and do not present synthetic-data performance as real-world model performance.

## 9. Database acceptance checklist

- [ ] Migrations can create the schema from an empty database.
- [ ] Seed script can populate two demo agencies.
- [ ] Foreign keys and checks reject invalid records.
- [ ] Tenant-owned records have agency ownership.
- [ ] Cross-agency access is blocked by backend queries.
- [ ] Booking capacity is derived consistently.
- [ ] Booking transaction protects against concurrent overbooking.
- [ ] Historical bookings and delivery attempts are retained.
