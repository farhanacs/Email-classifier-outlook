from pydantic import BaseModel


# ── STRUCTURED OUTPUT MODELS ─────────────────────────────────────────────────
class TriageResult(BaseModel):
    needs_response: bool
    reason: str

class DraftResult(BaseModel):
    draft_body: str
    subject_line: str