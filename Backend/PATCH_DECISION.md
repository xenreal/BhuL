# Architecture Decision: Deferred PATCH /documents/{id}/commit

## Context & Rationale
In the full specification (Section 2b & 9), `PATCH /documents/{document_id}/commit` is designed to:
1. Receive human inline corrections made on the React table UI.
2. Calculate a field-by-field diff between the AI's initial extraction and the user's manual correction.
3. Save each divergence into the `CorrectionExample` table to feed the in-context few-shot learning loop.
4. Mark the document status as `committed`.

### Why Real PATCH Diffing is Deferred in the Prototype:
* **Tight Coupling with Frontend**: A diff-based commit endpoint requires an active frontend table with editable inputs to collect `{ field_name: corrected_value }` payloads. Building the diff logic before the frontend exists creates untestable code.
* **No Impact on Record Persistence**: The document extraction pipeline already writes all extracted fields (`ExtractedRecord`), validation flags (`ValidationResult`), and metadata (`Document`) into SQLite synchronously upon upload (`POST /documents/upload`). Nothing is lost.

---

## Alternative Implemented for the Demo

1. **Immediate SQLite Persistence**:
   * Every upload is committed immediately to SQLite. When judges ask to retrieve a previously processed document, `GET /documents/{document_id}` fetches the authoritative record directly from the database.
2. **Simplified Commit / Status Flip**:
   * A lightweight commit route transitions document status (`verified` -> `committed`), satisfying the UI flow and dashboard metrics.
3. **Pre-Seeded Few-Shot Learning Loop**:
   * To demonstrate Section 9 (Few-Shot Correction Store) without requiring live manual typing during the 3-minute hackathon presentation, realistic correction examples (e.g., stripping residency text from Hindi landowner names) are pre-seeded into the `CorrectionExample` database table.
   * `ai_service.py` injects these into future extraction prompts, demonstrating in-context adaptation live.

