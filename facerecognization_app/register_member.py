#!/usr/bin/env python3
import os
import sys
import argparse
import cv2
import database as db
from face_engine import FaceEngine

def register_from_file(name, image_path):
    # Initialize DB and Engine
    db.init_db()
    
    if not os.path.exists(image_path):
        print(f"Error: Image file not found at '{image_path}'")
        return False
        
    # Read image
    img = cv2.imread(image_path)
    if img is None:
        print(f"Error: Could not read image at '{image_path}'")
        return False
        
    engine = FaceEngine()
    engine.initialize()
    
    # 1. Detect face
    faces = engine.detect_faces(img)
    if faces is None or len(faces) == 0:
        print("Error: No face detected in the provided image. Please use a clear portrait photo.")
        return False
        
    # 2. Extract embedding and align
    face = faces[0]
    aligned_face, embedding = engine.align_and_extract(img, face)
    
    # 3. Save aligned profile photo
    # We query the DB size to generate a unique filename
    known_embeddings = db.get_visitor_embeddings()
    temp_id = len(known_embeddings) + 1
    
    photo_filename = f"visitor_{temp_id}_{int(os.path.getmtime(image_path))}.jpg"
    photo_dest = os.path.join(db.PHOTOS_DIR, photo_filename)
    cv2.imwrite(photo_dest, aligned_face)
    
    # 4. Insert into SQLite Database
    visitor_id = db.register_visitor(
        name=name,
        embedding_arr=embedding,
        photo_path=f"/data/photos/{photo_filename}"
    )
    
    print(f"\n[Success] Registered '{name}' successfully!")
    print(f"  - Visitor ID: {visitor_id}")
    print(f"  - Aligned Profile Saved: {photo_dest}")
    print("  - Face embedding vector stored in SQLite database.")
    
    return True

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Register a new visitor/employee in the Face Recognition Database.")
    parser.add_argument("--name", required=True, help="Full name of the person")
    parser.add_argument("--photo", required=True, help="Path to the portrait photo file")
    
    args = parser.parse_args()
    register_from_file(args.name, args.photo)
