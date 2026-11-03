# AI/ML Delivery Slot Predictor Plan

## 1. Objective

Build a predictor that estimates the likelihood of a successful first delivery attempt for each eligible candidate time slot. The predictor provides recommendations; it does not confirm or reserve bookings.

## 2. Define the target

Recommended target:

`first_attempt_success`

- `1`: first delivery attempt succeeded.
- `0`: first delivery attempt did not succeed.

Confirm that the dataset has reliable labels before training. If the dataset does not contain the information needed to define this target, document the limitation and choose a target the data genuinely supports.

## 3. Data preparation

1. Inspect available columns and data quality.
2. Remove duplicates and invalid records.
3. Handle missing values transparently.
4. Normalize timestamps and time zones.
5. Define the prediction observation point: what was known when the recommendation would have been made?
6. Exclude features that leak the eventual outcome.
7. Split training and test data by time or a suitable group.
8. Record dataset provenance and whether data is real, public or synthetic.

Do not mix synthetic and real data without clearly documenting the distinction.

## 4. Candidate features

Use only features available at recommendation time and supported by the data.

- Day of week
- Candidate time window
- Lead time
- Slot utilization
- Service area/pincode
- Article type
- Previous delivery attempt count
- Recipient's stated time preference
- Historical success rate for an area/time window, computed without future leakage

Avoid using the final delivery status, actual attempt outcome, or any post-delivery information as input features.

## 5. Modeling approach

Start with a simple baseline, such as:

- Overall historical success rate, or
- Historical success rate by time window/area where sample size is sufficient.

Then train a suitable classifier, for example logistic regression or a tree-based model, depending on data size and feature types.

Compare the trained model against the baseline. Prefer a simple, explainable model if performance is similar.

## 6. Evaluation

Report metrics appropriate to the class balance and project objective:

- Confusion matrix
- Precision
- Recall
- F1 score
- ROC-AUC where meaningful
- Calibration or reliability assessment if displaying probabilities

Do not invent accuracy or claim that the model is reliable without evaluation. Explain dataset size, class balance, split strategy and limitations.

## 7. Predictor service contract

Example request:

```json
{
  "consignment_id": "demo-consignment-001",
  "agency_id": "demo-agency-001",
  "recipient_preferences": {
    "preferred_period": "AFTERNOON"
  },
  "candidate_slots": [
    {
      "slot_id": "slot-101",
      "date": "2026-11-15",
      "start_time": "09:00",
      "end_time": "11:00",
      "available_capacity": 4
    },
    {
      "slot_id": "slot-102",
      "date": "2026-11-15",
      "start_time": "14:00",
      "end_time": "16:00",
      "available_capacity": 2
    }
  ]
}
```

Example response (illustrative only; these values are not model results):

```json
{
  "model_version": "baseline-1",
  "recommendations": [
    {
      "slot_id": "slot-102",
      "success_probability": 0.78,
      "reason": "Matches the preferred period and has historical support"
    },
    {
      "slot_id": "slot-101",
      "success_probability": 0.64,
      "reason": "Eligible slot with a lower estimated success probability"
    }
  ]
}
```

The backend must verify that every returned `slot_id` belongs to the candidate slots it supplied. The predictor must not accept arbitrary agency access as an authorization mechanism; the backend controls data access.

## 8. Integration and fallback

1. Backend obtains eligible slots from PostgreSQL.
2. Backend calls the predictor with a bounded timeout.
3. Predictor returns a score for each candidate.
4. Backend validates the response and sorts recommendations.
5. Frontend displays scores as estimates.
6. Customer chooses a slot.
7. Backend independently rechecks capacity and books transactionally.

If the predictor is unavailable, slow or returns invalid data, fall back to deterministic ranking, for example by availability, preference match and a documented simple rule.

## 9. Prediction graph

The graph can show:

- Candidate time slot
- Estimated success probability
- Available capacity
- Selected/recommended slot
- Optional reason or explanation

Keep model estimates visually distinct from actual delivery outcomes. Include model version and a short note that probabilities are estimates, not guarantees.

## 10. AI/ML deliverables

- Dataset description and provenance
- Data-cleaning/preprocessing script
- Feature definition document
- Baseline implementation
- Trained model and version
- Evaluation report
- Prediction API
- Example request/response
- Prediction graph
- Limitations and synthetic-data disclosure, if applicable

## 11. Acceptance checklist

- [ ] Prediction target is documented.
- [ ] All features are available at recommendation time.
- [ ] Leakage is checked.
- [ ] Baseline is evaluated.
- [ ] Model is compared against baseline.
- [ ] Evaluation metrics and dataset limitations are documented.
- [ ] Predictor returns one score per eligible candidate or a clear error.
- [ ] Backend validates returned slot IDs.
- [ ] Fallback works when predictor is unavailable.
- [ ] UI labels probabilities as estimates.
