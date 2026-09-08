from insightface.app import FaceAnalysis


class FaceRecognizer:
    def __init__(self):
        self.app = FaceAnalysis(
            name="buffalo_l",
            providers=["CPUExecutionProvider"]
        )

        self.app.prepare(
            ctx_id=0,
            det_size=(640, 640)
        )

    def detect_faces(self, image):
        return self.app.get(image)