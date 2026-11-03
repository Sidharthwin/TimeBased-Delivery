# Frontend Implementation Plan

## 1. Goal

Build a responsive React interface for the multi-agency courier delivery slot platform. The frontend should expose different screens and actions based on the signed-in user's role.

## 2. Suggested stack

- React
- Vite
- React Router
- Fetch or Axios for API calls
- A chart library for analytics
- A consistent component library or a small reusable design system

Keep API calls in a dedicated service layer rather than scattering request logic across components.

## 3. Main application areas

### Authentication

- Login page
- Current-user/session loading
- Logout
- Protected routes
- Role-aware navigation

### Platform Admin

- Platform dashboard
- Agency list
- Register agency form
- Agency details/status page
- Create or invite initial Agency Admin

### Agency Admin

- Agency dashboard
- User management
- Service area management
- Delivery slot management
- Consignment management
- Booking overview
- Analytics

### Dispatcher

- Consignment list and details
- Create/update consignment
- Slot availability
- Booking and rescheduling overview
- Delivery assignment view

### Delivery Worker

- Assigned deliveries
- Consignment details
- Record delivery attempt
- Update delivery outcome

### Customer

- My consignments
- Consignment details and tracking timeline
- Available delivery slots
- Recommended slots with estimated success score
- Confirm, cancel or reschedule booking

## 4. Suggested route map

| Route | Access |
|---|---|
| `/login` | Public |
| `/platform` | Platform Admin |
| `/platform/agencies` | Platform Admin |
| `/platform/agencies/new` | Platform Admin |
| `/agency` | Agency Admin / Dispatcher |
| `/agency/users` | Agency Admin |
| `/agency/slots` | Agency Admin / Dispatcher |
| `/agency/consignments` | Agency Admin / Dispatcher |
| `/agency/bookings` | Agency Admin / Dispatcher |
| `/worker/deliveries` | Delivery Worker |
| `/customer/consignments` | Customer |
| `/customer/consignments/:id` | Customer |

Route protection improves navigation and usability, but the backend must independently enforce every permission.

## 5. Key UI workflows

### Agency registration

1. Platform Admin opens the agency list.
2. Selects **Register agency**.
3. Enters agency name, contact information and status.
4. Enters the initial Agency Admin details or triggers an invitation.
5. Sees the new agency in the list.

### Customer booking

1. Customer opens a consignment.
2. Frontend requests available slots and recommendations.
3. UI displays date, time window, remaining capacity and estimated success probability.
4. Customer selects a slot and confirms.
5. Frontend displays success or a useful conflict message.
6. If the slot filled before confirmation, refresh availability and ask the customer to choose again.

### Delivery attempt

1. Worker opens assigned deliveries.
2. Selects a consignment.
3. Records outcome, timestamp and optional note.
4. UI refreshes the delivery timeline/status.

## 6. Important components

- `AppLayout`
- `Sidebar` / `TopNavigation`
- `ProtectedRoute`
- `RoleGuard`
- `DataTable`
- `StatusBadge`
- `AgencyForm`
- `ConsignmentForm`
- `SlotCard`
- `SlotRecommendationList`
- `BookingConfirmation`
- `DeliveryAttemptForm`
- `AnalyticsChart`
- `LoadingState`, `EmptyState`, `ErrorState`

## 7. API integration expectations

Agree response formats with the backend developer before implementing complex screens.

Suggested conventions:

- Show validation errors beside the relevant form fields.
- Show a general error for network/server failures.
- Treat HTTP `401` as an authentication/session issue.
- Treat HTTP `403` as a permission issue.
- Treat HTTP `404` as missing or inaccessible data.
- Treat HTTP `409` as a booking/capacity conflict.
- Never assume a button click means a booking succeeded; wait for the API response.

## 8. Frontend acceptance checklist

- [ ] Login and logout work.
- [ ] Navigation changes by role.
- [ ] Platform Admin can register and view agencies.
- [ ] Agency screens show only the signed-in agency's data.
- [ ] Customer can view consignment details.
- [ ] Available slots and recommendations are readable.
- [ ] Booking confirmation and conflict states are handled.
- [ ] Reschedule and cancellation states are handled.
- [ ] Worker can submit a delivery attempt.
- [ ] Analytics graph labels estimates and actual outcomes distinctly.
- [ ] Loading, empty and error states exist.
- [ ] Layout works on laptop and mobile widths.

## 9. UI guidance

Prioritize clarity over visual complexity. Make the selected time slot, remaining capacity, booking status and estimated recommendation score easy to understand. Do not present a model probability as a guaranteed delivery outcome.
