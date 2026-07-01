import os
import urllib.request
import cv2
import numpy as np

# Model URLs from official OpenCV Zoo
YUNET_URL = "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx"
SFACE_URL = "https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx"

MODELS_DIR = "models"
YUNET_PATH = os.path.join(MODELS_DIR, "face_detection_yunet_2023mar.onnx")
SFACE_PATH = os.path.join(MODELS_DIR, "face_recognition_sface_2021dec.onnx")

class FaceEngine:
    def __init__(self):
        self.detector = None
        self.recognizer = None
        self.initialized = False
        
    def download_models(self):
        """Downloads the ONNX models if they do not exist locally."""
        os.makedirs(MODELS_DIR, exist_ok=True)
        
        # Download YuNet (Face Detection)
        if not os.path.exists(YUNET_PATH):
            print(f"Downloading YuNet face detection model from {YUNET_URL}...")
            urllib.request.urlretrieve(YUNET_URL, YUNET_PATH)
            print("YuNet model downloaded successfully.")
            
        # Download SFace (Face Recognition)
        if not os.path.exists(SFACE_PATH):
            print(f"Downloading SFace face recognition model from {SFACE_URL}...")
            urllib.request.urlretrieve(SFACE_URL, SFACE_PATH)
            print("SFace model downloaded successfully.")
            
    def initialize(self):
        """Initializes the OpenCV YuNet and SFace models."""
        if self.initialized:
            return
            
        self.download_models()
        
        print("Initializing YuNet and SFace models...")
        # Initialize YuNet detector
        # We start with a default input size of 320x320; it is resized dynamically during detection
        self.detector = cv2.FaceDetectorYN.create(
            model=YUNET_PATH,
            config="",
            input_size=(320, 320),
            score_threshold=0.8,  # filter low confidence detections
            nms_threshold=0.3
        )
        
        # Initialize SFace recognizer
        self.recognizer = cv2.FaceRecognizerSF.create(
            model=SFACE_PATH,
            config=""
        )
        
        self.initialized = True
        print("Face Recognition Engine initialized successfully.")
        
    def detect_faces(self, img):
        """
        Detects faces in the given image.
        Returns:
            faces: numpy array of detected faces with coordinates and landmarks, or None.
        """
        if not self.initialized:
            self.initialize()
            
        h, w = img.shape[:2]
        self.detector.setInputSize((w, h))
        
        _, faces = self.detector.detect(img)
        return faces
        
    def align_and_extract(self, img, face):
        """
        Aligns a single face and extracts its 128-dimensional embedding vector.
        Args:
            img: Original image.
            face: The face array returned by YuNet.
        Returns:
            aligned_face: The aligned, cropped face image.
            feature: The 1D numpy array representing the face embedding.
        """
        if not self.initialized:
            self.initialize()
            
        # Crop and align the face using the 5 landmarks detected by YuNet
        aligned_face = self.recognizer.alignCrop(img, face)
        
        # Extract features (embeddings)
        feature = self.recognizer.feature(aligned_face)
        
        # Copy to avoid modification in place and flatten it
        return aligned_face, feature.copy().flatten()
        
    def compute_similarity(self, feat1, feat2):
        """
        Computes the cosine similarity between two face feature embeddings.
        Args:
            feat1: first embedding vector.
            feat2: second embedding vector.
        Returns:
            similarity: Cosine similarity score (typically -1.0 to 1.0, where 1.0 is identical).
        """
        # Calculate Cosine Similarity manually using numpy
        dot = np.dot(feat1, feat2)
        norm1 = np.linalg.norm(feat1)
        norm2 = np.linalg.norm(feat2)
        if norm1 == 0 or norm2 == 0:
            return 0.0
        return float(dot / (norm1 * norm2))

    def find_match(self, query_feat, known_faces, threshold=0.363):
        """
        Searches for a match in the database of known faces.
        Args:
            query_feat: The feature embedding of the face to recognize.
            known_faces: List of dicts with keys 'id', 'name', and 'embedding'.
            threshold: Cosine similarity threshold for a match (default: 0.363).
        Returns:
            best_match: Dict of the matched face with similarity score, or None.
        """
        if not known_faces:
            return None
            
        best_score = -1.0
        best_match = None
        
        for face in known_faces:
            score = self.compute_similarity(query_feat, face["embedding"])
            if score > best_score:
                best_score = score
                best_match = {
                    "id": face["id"],
                    "name": face["name"],
                    "score": score
                }
                
        if best_score >= threshold:
            return best_match
        return None
