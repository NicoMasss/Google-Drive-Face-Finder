import json

from fastapi import FastAPI, UploadFile, File, Form
import cv2
import numpy as np

from app.face import FaceRecognizer

app = FastAPI()

recognizer = FaceRecognizer()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/faces/embedding")
async def generate_embedding(image: UploadFile = File(...)):
    contents = await image.read()

    image_array = np.frombuffer(contents, dtype=np.uint8)
    image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)

    faces = recognizer.detect_faces(image)

    results = []

    for face in faces:
        results.append({
            "embedding": face.embedding.tolist(),
            "bbox": face.bbox.tolist()
        })

    return {
        "faces": results
    }

@app.post("/faces/compare")
async def compare_faces(image1: UploadFile = File(...), image2: UploadFile = File(...)):
    contents1 = await image1.read()
    contents2 = await image2.read()

    image_array1 = np.frombuffer(contents1, dtype=np.uint8)
    image_array2 = np.frombuffer(contents2, dtype=np.uint8)

    img1 = cv2.imdecode(image_array1, cv2.IMREAD_COLOR)
    img2 = cv2.imdecode(image_array2, cv2.IMREAD_COLOR)

    faces1 = recognizer.detect_faces(img1)
    faces2 = recognizer.detect_faces(img2)

    if not faces1 or not faces2:
        return {"error": "No faces detected in one or both images."}

    embedding1 = faces1[0].embedding
    for face2 in faces2:
        embedding2 = face2.embedding

        similarity_score = (
            np.dot(embedding1, embedding2)
           / (
               np.linalg.norm(embedding1)
               * np.linalg.norm(embedding2)
         )
        )

        threshold = 0.2
        match = similarity_score >= threshold

        if match:
            return {
                "similarity_score": float(similarity_score),
                "match": True
            }

    return {
    "similarity_score": 0,
    "match": False
}


@app.post("/faces/compare-embedding")
async def compare_with_embedding(
    image: UploadFile = File(...),
    reference_embedding: str = Form(...)
):
    contents = await image.read()
    image_array = np.frombuffer(contents, dtype=np.uint8)
    candidate_image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
    faces = recognizer.detect_faces(candidate_image)

    if not faces:
        return {"similarity_score": 0, "match": False}

    embedding1 = np.asarray(json.loads(reference_embedding), dtype=np.float32)
    best_score = 0.0

    for face in faces:
        embedding2 = face.embedding
        similarity_score = np.dot(embedding1, embedding2) / (
            np.linalg.norm(embedding1) * np.linalg.norm(embedding2)
        )
        best_score = max(best_score, float(similarity_score))

    return {
        "similarity_score": best_score,
        "match": True
    }
         