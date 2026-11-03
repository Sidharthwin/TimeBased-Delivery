# Courier Delivery Slot Platform — Master Project Execution Plan

## 1. Project overview

Build a reusable, multi-agency courier delivery platform where customers can choose a suitable delivery time slot and receive recommendations based on predicted delivery success.

A central **Platform Super Admin** registers courier agencies. Each agency then manages its own users, service areas, consignments, delivery slots, bookings, and delivery operations.

The MVP should demonstrate the complete workflow with two demo agencies and realistic seed data. It should not claim to be connected to live India Post, DTDC, or Blue Dart systems unless real integrations are separately implemented and tested.

## 2. Product structure and roles

### Platform onboarding

1. Platform Super Admin signs in.
2. Platform Super Admin registers a courier agency.
3. The platform creates or invites that agency's first Agency Admin.
4. Agency Admin signs in and manages that agency's operations.
5. Customers book available delivery slots; workers and dispatchers manage delivery activity.

Courier agencies do **not** self-register in this MVP.

### Roles

| Role | Main permissions |
|---|---|
| `PLATFORM_ADMIN` | Register and manage agencies; view platform-level agency information |
| `AGENCY_ADMIN` | Manage one agency's users, service areas, slots, consignments and operations |
| `DISPATCHER` | Manage consignments, slots, bookings and assignments within their agency |
| `DELIVERY_WORKER` | View assigned deliveries and record delivery attempts |
| `CUSTOMER` | View own consignment information and manage own booking |

## 3. Recommended technology

- Frontend: React + Vite
- Backend: Node.js + Express
- Database: PostgreSQL
- Database access: `pg` with parameterized SQL and transactions
- Authentication: JWT + bcrypt
- Validation: Zod
- Backend tests: Jest + Supertest
- ML predictor: Python HTTP API
- Charts: a React charting library selected by the frontend developer
- Version control: Git + GitHub

Use a modular monolith for the MVP. Avoid microservices and Kubernetes.

## 4. Team responsibilities

### Developer A — Backend and platform integration

- Express application structure and PostgreSQL connection
- Authentication and role-based authorization
- Multi-agency data isolation
- Platform Admin agency onboarding
- Consignment, slot, booking, rescheduling and cancellation APIs
- Delivery attempts and operational workflows
- AI service integration and fallback logic
- API tests, security checks and deployment support

### Developer B — AI/ML predictor

- Find, prepare or generate a suitable dataset
- Document the prediction target and data assumptions
- Clean data and engineer features
- Build a simple baseline
- Train and evaluate a suitable model
- Expose a prediction endpoint
- Produce a prediction graph and explain model limitations

### Shared work

- Agree API contracts and data shapes
- Integrate frontend, backend and predictor
- End-to-end testing
- Deployment, README, demo script and presentation

Frontend implementation can be led by either teammate, but the API contract and integration must be agreed together.

## 5. MVP feature scope

### Must-have

- Login and role-based access
- Platform Admin agency registration
- Agency Admin operational dashboard
- Agency user management
- Service area and delivery slot management
- Consignment creation and listing
- Available slot discovery
- Slot recommendations from the predictor
- Booking, cancellation and rescheduling
- Delivery worker's assigned-delivery view
- Delivery attempt/status recording
- Basic analytics and prediction graph
- Tenant-isolation and booking-capacity tests

### Out of scope for this deadline

- Live production integrations with courier provider systems
- GPS/live vehicle tracking
- Route optimization
- Payments
- SMS or WhatsApp notifications
- Kubernetes or microservices
- Advanced AI beyond the agreed predictor

## 6. 19-day execution schedule

| Day | Backend / integration | Frontend / shared | AI/ML |
|---|---|---|---|
| 1 | Repository, app skeleton, DB connection | Wireframes and page list | Dataset inventory and target definition |
| 2 | Authentication and user model | Login screens | Data cleaning |
| 3 | Agency onboarding and tenant isolation | Platform Admin agency form/list | Baseline definition |
| 4 | Consignment APIs | Consignment screens | Feature engineering |
| 5 | Slot APIs | Slot management screens | Baseline model |
| 6 | Transactional booking | Booking flow | Model training |
| 7 | Reschedule, cancel, booking history | Booking management UI | Model evaluation |
| 8 | Worker and dispatcher APIs | Worker/dispatcher screens | Prediction endpoint draft |
| 9 | Predictor integration and fallback | Recommendation UI | Endpoint integration support |
| 10 | Analytics APIs | Graph/dashboard | Graph and model explanation |
| 11 | Security and integration tests | End-to-end testing | Final evaluation |
| 12 | Deployment stabilization | Complete core screens | Freeze model interface |
| 13–14 | Edge cases and bug fixes | Polish and documentation | Document limitations |
| 15–19 | Buffer for critical fixes | Final demo preparation | Final demo support |

**Target:** core feature completion by Day 12–14. Keep the remaining days for testing, fixes and demo preparation.

## 7. Definition of done

- A Platform Admin can register at least two demo agencies.
- Each agency can manage its own users and operations.
- A user from Agency A cannot read or modify Agency B's tenant-owned records.
- A customer can view a consignment's available slots and book one.
- Booking capacity cannot be exceeded when simultaneous requests occur.
- Recommendations show a probability or score and are clearly labelled as estimates.
- If the ML service is unavailable, the application still provides a deterministic fallback.
- A worker can record a delivery attempt.
- The main workflow can be demonstrated from login to booking and delivery outcome.
- README contains setup, environment variables, migrations/seed steps and demo credentials.

## 8. Demo sequence

1. Sign in as Platform Admin.
2. Register Agency A and Agency B.
3. Sign in as Agency A Admin.
4. Create a service area, delivery slots and a consignment.
5. Open the consignment's available slot recommendations.
6. Select and confirm a slot.
7. Show that the booking consumes capacity.
8. Sign in as a delivery worker and record an attempt.
9. Show the dashboard/analytics.
10. Demonstrate tenant isolation by trying to access another agency's record.

## 9. Project principles

- Keep the MVP small and demonstrable.
- Derive agency scope from authenticated membership, not a client-supplied agency ID.
- Treat the ML model as a recommendation aid, not a guarantee.
- Recheck capacity at booking time; recommendations do not reserve slots.
- Label synthetic data clearly.
- Do not invent model accuracy or claim real-world provider integration.
