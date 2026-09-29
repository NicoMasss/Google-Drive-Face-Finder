import axios from "axios";
import dotenv from "dotenv";
import FormData from "form-data";

dotenv.config();

const FACE_SERVICE_URL = process.env.FACE_SERVICE_URL ?? "http://localhost:8000";

export function getFaceSimilarityThreshold(): number {
    const configuredThreshold = Number(process.env.FACE_SIMILARITY_THRESHOLD ?? "0.2");

    if (!Number.isFinite(configuredThreshold) || configuredThreshold < 0 || configuredThreshold > 1) {
        return 0.2;
    }

    return configuredThreshold;
}

export function normalizeComparisonResult(rawResult: { similarity_score?: number; match?: boolean }): { similarity_score: number; match: boolean } {
    const similarityScore = typeof rawResult.similarity_score === "number" ? rawResult.similarity_score : 0;
    const normalizedScore = Number.isFinite(similarityScore) ? similarityScore : 0;
    const threshold = getFaceSimilarityThreshold();

    return {
        similarity_score: normalizedScore,
        match: Boolean(rawResult.match) && normalizedScore >= threshold
    };
}

export function toDriveSearchResult(file: {
    id: string;
    name: string;
    mimeType?: string;
    webViewLink?: string;
    similarity_score: number;
    match?: boolean;
}) {
    return {
        id: file.id,
        name: file.name,
        mimeType: file.mimeType ?? "application/octet-stream",
        webViewLink: file.webViewLink ?? "",
        similarity_score: Number(file.similarity_score ?? 0),
        match: Boolean(file.match)
    };
}

export async function compareFaces(
    referenceImage: Buffer,
    candidateImage: Buffer
) {
    const formData = new FormData();

    formData.append("image1", referenceImage, {
        filename: "reference.jpg",
        contentType: "image/jpeg"
    });

    formData.append("image2", candidateImage, {
        filename: "candidate.jpg",
        contentType: "image/jpeg"
    });

    const response = await axios.post(
        `${FACE_SERVICE_URL}/faces/compare`,
        formData,
        {
            headers: {
                ...formData.getHeaders()
            },
            timeout: 30000
        }
    );

    return normalizeComparisonResult(response.data ?? {});
}

export async function generateFaceEmbedding(referenceImage: Buffer): Promise<number[]> {
    const formData = new FormData();

    formData.append("image", referenceImage, {
        filename: "reference.jpg",
        contentType: "image/jpeg"
    });

    let response;
    try {
        response = await axios.post(
            `${FACE_SERVICE_URL}/faces/embedding`,
            formData,
            {
                headers: {
                    ...formData.getHeaders()
                },
                timeout: 30000
            }
        );
    } catch (error) {
        if (axios.isAxiosError(error)) {
            const status = error.response?.status;
            throw new Error(`Serviço facial indisponível${status ? ` (HTTP ${status})` : ""}.`);
        }
        throw error;
    }

    const faces = response.data?.faces;
    if (!Array.isArray(faces) || faces.length === 0 || !Array.isArray(faces[0]?.embedding)) {
        throw new Error("A imagem de referência deve conter pelo menos um rosto detectável.");
    }

    return faces[0].embedding;
}

export async function compareFaceEmbedding(
    referenceEmbedding: number[],
    candidateImage: Buffer
) {
    const formData = new FormData();

    formData.append("image", candidateImage, {
        filename: "candidate.jpg",
        contentType: "image/jpeg"
    });
    formData.append("reference_embedding", JSON.stringify(referenceEmbedding));

    const response = await axios.post(
        `${FACE_SERVICE_URL}/faces/compare-embedding`,
        formData,
        {
            headers: {
                ...formData.getHeaders()
            },
            timeout: 30000
        }
    );

    return normalizeComparisonResult(response.data ?? {});
}