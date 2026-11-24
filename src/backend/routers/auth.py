"""
Authentication endpoints for the High School Management System API
"""

from datetime import datetime, timedelta, timezone
from hashlib import sha256
from secrets import token_urlsafe

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from typing import Dict, Any

from ..database import sessions_collection, teachers_collection, verify_password

router = APIRouter(
    prefix="/auth",
    tags=["auth"]
)


@router.post("/login")
def login(username: str, password: str, request: Request, response: Response) -> Dict[str, Any]:
    """Login a teacher account"""
    # Find the teacher in the database
    teacher = teachers_collection.find_one({"_id": username})

    # Verify password using Argon2 verifier from database.py
    if not teacher or not verify_password(teacher.get("password", ""), password):
        raise HTTPException(
            status_code=401, detail="Invalid username or password")

    token = token_urlsafe(32)
    sessions_collection.insert_one({
        "_id": sha256(token.encode()).hexdigest(),
        "username": teacher["_id"],
        "expires_at": datetime.now(timezone.utc) + timedelta(hours=8)
    })
    response.set_cookie(
        "session", token, httponly=True, samesite="strict",
        secure=request.url.scheme == "https", max_age=8 * 60 * 60, path="/"
    )

    # Return teacher information (excluding password)
    return {
        "username": teacher["username"],
        "display_name": teacher["display_name"],
        "role": teacher["role"]
    }


def require_user(request: Request) -> Dict[str, Any]:
    """Resolve the signed-in teacher from an unexpired server-side session."""
    token = request.cookies.get("session")
    if not token:
        raise HTTPException(status_code=401, detail="Please sign in to manage announcements.")
    session = sessions_collection.find_one({
        "_id": sha256(token.encode()).hexdigest(),
        "expires_at": {"$gt": datetime.now(timezone.utc)}
    })
    teacher = teachers_collection.find_one({"_id": session["username"]}) if session else None
    if not teacher:
        raise HTTPException(status_code=401, detail="Your session has expired. Please sign in again.")
    return teacher


@router.get("/check-session")
def check_session(teacher: Dict[str, Any] = Depends(require_user)) -> Dict[str, Any]:
    """Return the currently authenticated teacher."""
    return {
        "username": teacher["username"],
        "display_name": teacher["display_name"],
        "role": teacher["role"]
    }


@router.post("/logout", status_code=204)
def logout(request: Request, response: Response):
    token = request.cookies.get("session")
    if token:
        sessions_collection.delete_one({"_id": sha256(token.encode()).hexdigest()})
    response.delete_cookie("session", path="/")
