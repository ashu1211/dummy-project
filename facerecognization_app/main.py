import os
import base64
import cv2
import numpy as np
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from typing import Optional, List
import shutil
import datetime

import database as db
from face_engine import FaceEngine

app = FastAPI(title="Face Recognition Visitor Management System")

# Initialize face recognition engine
face_engine = FaceEngine()
face_engine.initialize()

# Initialize DB structure
db.init_db()

# In-memory cache of face embeddings for instant lookups
cached_embeddings = []

def reload_embeddings_cache():
    """Reloads known visitor embeddings from the database into memory."""
    global cached_embeddings
    cached_embeddings = db.get_visitor_embeddings()
    print(f"Loaded {len(cached_embeddings)} registered visitor embeddings into cache.")

@app.on_event("startup")
async def startup_event():
    # Load embeddings on server startup
    reload_embeddings_cache()

# Mount visitor photos and snapshots folders to be accessible by client
app.mount("/data/photos", StaticFiles(directory=db.PHOTOS_DIR), name="photos")
app.mount("/data/snapshots", StaticFiles(directory=db.SNAPSHOTS_DIR), name="snapshots")

# Pydantic schemas
class ScanRequest(BaseModel):
    image: str  # Base64 data URL

class CheckInRequest(BaseModel):
    visitor_id: Optional[int] = None
    name: str
    to_meet: str
    from_location: str
    purpose: Optional[str] = ""
    image: str  # Base64 snapshot image
    register_new: bool = False

class IdentityRequest(BaseModel):
    aadhar_no: Optional[str] = ""
    pan_no: Optional[str] = ""
    voter_id: Optional[str] = ""
    driving_license: Optional[str] = ""
    passport_no: Optional[str] = ""
    company_name: Optional[str] = ""
    company_id: Optional[str] = ""
    school_name: Optional[str] = ""
    college_name: Optional[str] = ""
    office_address: Optional[str] = ""

def decode_base64_image(base64_str: str) -> np.ndarray:
    """Decodes a base64 image string into an OpenCV BGR image."""
    try:
        if "," in base64_str:
            base64_str = base64_str.split(",")[1]
        img_data = base64.b64decode(base64_str)
        nparr = np.frombuffer(img_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Decoded image is empty")
        return img
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid base64 image: {str(e)}")

def encode_image_to_base64(img: np.ndarray) -> str:
    """Encodes an OpenCV image into a base64 jpeg data URL."""
    _, buffer = cv2.imencode(".jpg", img)
    base64_str = base64.b64encode(buffer).decode("utf-8")
    return f"data:image/jpeg;base64,{base64_str}"

@app.post("/api/detect-recognize")
async def detect_recognize(req: ScanRequest):
    """
    Receives a webcam frame, detects a face, and attempts to recognize it against cache.
    Returns details of matched visitor or returns crop preview for registration.
    """
    img = decode_base64_image(req.image)
    
    # Run face detection
    faces = face_engine.detect_faces(img)
    
    if faces is None or len(faces) == 0:
        return {"detected": False, "recognized": False}
        
    # We take the first face detected
    face = faces[0]
    box = [int(face[0]), int(face[1]), int(face[2]), int(face[3])]
    
    # Align and extract embedding
    aligned_face, embedding = face_engine.align_and_extract(img, face)
    
    # Find match
    match = face_engine.find_match(embedding, cached_embeddings)
    
    # Encode aligned face crop to show on client UI
    cropped_face_b64 = encode_image_to_base64(aligned_face)
    
    if match:
        visitor_id = match["id"]
        # Fetch detailed stats and recent visit history
        stats = db.get_visitor_stats(visitor_id)
        recent_visits = db.get_visitor_recent_logs(visitor_id, limit=5)
        return {
            "detected": True,
            "recognized": True,
            "visitor_id": visitor_id,
            "name": match["name"],
            "score": match["score"],
            "cropped_face": cropped_face_b64,
            "box": box,
            "visit_stats": stats,
            "recent_visits": recent_visits
        }
    else:
        return {
            "detected": True,
            "recognized": False,
            "cropped_face": cropped_face_b64,
            "box": box
        }

@app.post("/api/checkin")
async def checkin(req: CheckInRequest):
    """
    Handles visitor check-in. If register_new is set, it extracts features and
    registers the visitor's face profile first.
    """
    img = decode_base64_image(req.image)
    visitor_id = req.visitor_id
    
    # 1. Register new visitor if requested
    if req.register_new:
        faces = face_engine.detect_faces(img)
        if faces is None or len(faces) == 0:
            raise HTTPException(status_code=400, detail="No face detected in registration snapshot.")
            
        face = faces[0]
        aligned_face, embedding = face_engine.align_and_extract(img, face)
        
        # Save registered photo
        temp_id = len(cached_embeddings) + 1
        photo_filename = f"visitor_{temp_id}_{int(os.path.getmtime(db.DB_PATH) if os.path.exists(db.DB_PATH) else 1)}.jpg"
        photo_path = os.path.join(db.PHOTOS_DIR, photo_filename)
        cv2.imwrite(photo_path, aligned_face)
        
        # Save to DB
        visitor_id = db.register_visitor(req.name, embedding, f"/data/photos/{photo_filename}")
        
        # Update cache
        reload_embeddings_cache()
    
    # 2. Save check-in snapshot
    snapshot_filename = f"visit_{visitor_id or 'anon'}_{int(datetime.datetime.now().timestamp())}.jpg"
    snapshot_path = os.path.join(db.SNAPSHOTS_DIR, snapshot_filename)
    cv2.imwrite(snapshot_path, img)
    
    # 3. Log visit
    log_id = db.add_visit_log(
        visitor_id=visitor_id,
        name=req.name,
        to_meet=req.to_meet,
        from_location=req.from_location,
        purpose=req.purpose,
        photo_path=f"/data/snapshots/{snapshot_filename}"
    )
    
    # Get updated visitor stats
    visit_count = 1
    last_visit = None
    if visitor_id:
        stats = db.get_visitor_stats(visitor_id)
        visit_count = stats["total_visits"]
        last_visit = stats["last_visit_time"]
        
    return {
        "success": True,
        "visitor_id": visitor_id,
        "name": req.name,
        "visit_count": visit_count,
        "last_visit": last_visit
    }

@app.get("/api/visitors")
async def get_visitors():
    """Gets list of all registered visitors."""
    return db.get_all_visitors()

@app.get("/api/logs")
async def get_logs(limit: int = 100):
    """Gets latest visitor logs."""
    return db.get_all_visit_logs(limit=limit)

@app.get("/api/stats")
async def get_stats():
    """Gets dashboard statistics."""
    return db.get_dashboard_data()

@app.get("/api/visitor/{visitor_id}/identity")
async def get_identity(visitor_id: int):
    """Returns stored government and private ID details for a visitor."""
    return db.get_visitor_identity(visitor_id)

@app.post("/api/visitor/{visitor_id}/identity")
async def save_identity(visitor_id: int, req: IdentityRequest):
    """Saves or updates government and private ID details for a visitor."""
    db.save_visitor_identity(visitor_id, req.model_dump())
    return {"success": True, "visitor_id": visitor_id}

# SPA: Serve frontend HTML, CSS, JS
# Check if static directory exists; if not, create it
os.makedirs("static", exist_ok=True)
os.makedirs("static/css", exist_ok=True)
os.makedirs("static/js", exist_ok=True)

@app.get("/")
async def serve_home():
    return FileResponse("static/index.html")

# Serve the static files
app.mount("/", StaticFiles(directory="static"), name="static")
