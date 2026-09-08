import axios from "axios";
import FormData from "form-data";

const FACE_SERVICE_URL = "http://localhost:8000";

export async function compareFaces(
    image1: Buffer,
    image2: Buffer
) {
    const formData = new FormData();

    formData.append("image1", image1, {
        filename: "image1.jpg",
        contentType: "image/jpeg"
    });

    formData.append("image2", image2, {
        filename: "image2.jpg",
        contentType: "image/jpeg"
    });

    const response = await axios.post(
        `${FACE_SERVICE_URL}/faces/compare`,
        formData,
        {
            headers: {
                ...formData.getHeaders()
            }
        }
    );

    return response.data;
}