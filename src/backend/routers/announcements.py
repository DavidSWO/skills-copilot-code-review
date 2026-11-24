"""Database-backed public announcements and authenticated management."""

from datetime import datetime, timezone
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator

from ..database import announcements_collection
from .auth import require_user

router = APIRouter(prefix="/announcements", tags=["announcements"])


class AnnouncementInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str = Field(min_length=1, max_length=120)
    message: str = Field(min_length=1, max_length=2000)
    starts_at: AwareDatetime | None = None
    expires_at: AwareDatetime

    @model_validator(mode="after")
    def validate_dates(self):
        if self.starts_at and self.starts_at >= self.expires_at:
            raise ValueError("Expiration must be after the start date.")
        return self


class Announcement(AnnouncementInput):
    id: str


def announcement_id(value: str) -> ObjectId:
    if not ObjectId.is_valid(value):
        raise HTTPException(status_code=404, detail="Announcement not found.")
    return ObjectId(value)


@router.get("", response_model=list[Announcement])
def active_announcements():
    now = datetime.now(timezone.utc)
    documents = announcements_collection.find({
        "expires_at": {"$gt": now},
        "$or": [{"starts_at": None}, {"starts_at": {"$lte": now}}]
    }).sort("expires_at", 1)
    return [serialize(document) for document in documents]


def serialize(document) -> Announcement:
    return Announcement(
        id=str(document["_id"]),
        title=document["title"],
        message=document["message"],
        starts_at=document.get("starts_at"),
        expires_at=document["expires_at"]
    )


@router.get("/manage", response_model=list[Announcement], dependencies=[Depends(require_user)])
def list_announcements():
    return [serialize(document) for document in announcements_collection.find().sort("expires_at", -1)]


@router.post("", response_model=Announcement, status_code=201, dependencies=[Depends(require_user)])
def create_announcement(announcement: AnnouncementInput):
    document = announcement.model_dump()
    result = announcements_collection.insert_one(document)
    return serialize({**document, "_id": result.inserted_id})


@router.put("/{id}", response_model=Announcement, dependencies=[Depends(require_user)])
def update_announcement(id: str, announcement: AnnouncementInput):
    object_id = announcement_id(id)
    document = announcement.model_dump()
    result = announcements_collection.update_one({"_id": object_id}, {"$set": document})
    if not result.matched_count:
        raise HTTPException(status_code=404, detail="Announcement not found.")
    return serialize({**document, "_id": object_id})


@router.delete("/{id}", status_code=204, dependencies=[Depends(require_user)])
def delete_announcement(id: str):
    result = announcements_collection.delete_one({"_id": announcement_id(id)})
    if not result.deleted_count:
        raise HTTPException(status_code=404, detail="Announcement not found.")
    return Response(status_code=204)
