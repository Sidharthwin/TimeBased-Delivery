# Integration, Testing and Deployment Plan

## 1. Goal

Bring the frontend, backend, PostgreSQL database and Python predictor together into a stable demo that can be set up and run by another developer.

## 2. Integration order

1. Agree API request and response schemas.
2. Start PostgreSQL and apply migrations.
3. Seed two demo agencies and test users.
4. Start the Express backend and verify health/auth endpoints.
5. Connect frontend login and role-based routing.
6. Integrate agency onboarding and operational screens.
7. Start the predictor and test it independently.
8. Connect backend recommendation service to predictor.
9. Complete booking and delivery workflows.
10. Run end-to-end and tenant-isolation tests.
11. Deploy and rehearse the demo.

## 3. Environment configuration

Create `.env.example` files. Do not commit real secrets.

Backend variables may include:

```env
NODE_ENV=development
PORT=5000
DATABASE_URL=postgresql://user:password@localhost:5432/courier_platform
JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRES_IN=1d
PREDICTOR_BASE_URL=http://localhost:8000
PREDICTOR_TIMEOUT_MS=3000
```

Frontend variables may include:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

Predictor variables may include:

```env
HOST=0.0.0.0
PORT=8000
MODEL_PATH=./models/model.joblib
```

Adjust names to match the actual implementation. Keep local `.env` files out of Git.

## 4. Test layers

### Backend unit tests

- Validation functions
- Authorization helpers
- Booking capacity calculations
- Recommendation response validation
- Fallback ranking

### Backend integration tests

- Login and current-user endpoint
- Agency creation
- Consignment creation/listing
- Slot creation and availability
- Booking/cancellation/rescheduling
- Delivery attempt recording
- Analytics queries

### Security and tenant-isolation tests

- Agency A cannot read Agency B's consignment.
- Agency A cannot update Agency B's slot.
- Agency A cannot book against Agency B's slot.
- A customer cannot view another customer's consignment.
- A non-admin cannot register agencies.
- Client-supplied agency IDs cannot override authenticated agency scope.

### Concurrency tests

Simulate simultaneous requests for the final available place in a slot. The number of confirmed bookings must never exceed capacity.

### Predictor tests

- Valid candidate slots produce valid scores.
- Empty candidate list is handled.
- Missing or malformed features are handled.
- Model loading failure is reported safely.
- Backend timeout triggers fallback.
- Predictor cannot cause the backend to book a slot automatically.

### Frontend end-to-end tests

- Login by role
- Platform Admin registers agency
- Agency Admin creates consignment and slots
- Customer receives recommendations and books
- Worker records delivery attempt
- Dashboard displays relevant information

## 5. Demo data and accounts

Prepare fictional demo accounts for:

- Platform Admin
- Agency A Admin
- Agency B Admin
- Dispatcher
- Delivery Worker
- Customer

Document the credentials in a private demo note or local seed output. Do not commit production credentials or real personal data.

## 6. Deployment checklist

- [ ] Production database provisioned.
- [ ] Migrations applied.
- [ ] Seed/demo data strategy decided.
- [ ] Backend environment variables configured.
- [ ] JWT secret is strong and private.
- [ ] CORS allows only the intended frontend origin.
- [ ] Frontend API URL points to deployed backend.
- [ ] Predictor URL and timeout configured.
- [ ] Health endpoints verified.
- [ ] Logs do not expose passwords, tokens or sensitive data.
- [ ] Error responses do not expose stack traces.
- [ ] Main user journey tested against deployed services.

## 7. Demo rehearsal

Run the full demo from a clean browser session:

1. Login as Platform Admin.
2. Register two agencies.
3. Login as Agency A Admin.
4. Create or open a consignment.
5. Show available slots and model recommendations.
6. Book a slot and show confirmation.
7. Show capacity change.
8. Login as a worker and record a delivery attempt.
9. Show analytics and explain the prediction graph.
10. Demonstrate that Agency A cannot access Agency B's data.

## 8. Final release checklist

- [ ] All critical user journeys work.
- [ ] Tenant isolation tests pass.
- [ ] Booking concurrency test passes.
- [ ] Predictor fallback works.
- [ ] No unresolved critical bugs.
- [ ] README setup instructions are complete.
- [ ] API documentation is available.
- [ ] Dataset and model limitations are disclosed.
- [ ] Demo data and accounts are ready.
- [ ] Presentation and demo script are rehearsed.
