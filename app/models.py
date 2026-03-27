from pydantic import BaseModel
from typing import Optional

class TriageResult(BaseModel):
    needs_response: bool
    reason: str

class DraftResult(BaseModel):
    draft_body: str
    subject_line: str
    action_required: Optional[str] = None  # None if no action needed, otherwise describes what IET staff must do

