from datetime import datetime
from typing import List
from pydantic import BaseModel, Field

class ScoreSubmit(BaseModel):
    score: int = Field(..., gt=0, le=10000)
    level_completed: int = Field(..., ge=1)

class ScoreResponse(BaseModel):
    id: int
    score: int
    level_completed: int
    recorded_at: datetime

    class Config:
        from_attributes = True

class RankingEntry(BaseModel):
    position: int
    username: str
    best_score: int

class RankingResponse(BaseModel):
    entries: List[RankingEntry]
    page: int
    total_pages: int
    total_players: int
