import { Router } from "express";
import multer from "multer";
import { compareFaceEmbedding, compareFaces, generateFaceEmbedding, getFaceSimilarityThreshold, toDriveSearchResult } from "../services/face-service.service.js";
import { downloadDriveImage, getDriveFileMetadata, listDriveImages, parseDriveFolderId } from "../services/google-drive.service.js";

const router = Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024
    }
});

const allowedMimeTypes = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

function getUploadedFile(files: Record<string, Express.Multer.File[]>, fieldName: string) {
    return files[fieldName]?.[0] ?? null;
}

function validateReferenceImage(file: Express.Multer.File | null | undefined) {
    if (!file) {
        return { valid: false, error: "A imagem de referência é obrigatória." };
    }

    if (!file.size || file.size <= 0) {
        return { valid: false, error: "A imagem de referência está vazia." };
    }

    const mimeType = file.mimetype || "application/octet-stream";
    if (!allowedMimeTypes.has(mimeType)) {
        return { valid: false, error: "Formato de imagem inválido. Use JPEG, PNG ou WEBP." };
    }

    return { valid: true };
}

router.post(
    "/compare",
    upload.fields([
        { name: "image1", maxCount: 1 },
        { name: "image2", maxCount: 1 }
    ]),
    async (req, res) => {
        try {
            const files = req.files as Record<string, Express.Multer.File[]>;
            const image1 = getUploadedFile(files, "image1");
            const image2 = getUploadedFile(files, "image2");

            if (!image1 || !image2) {
                return res.status(400).json({
                    error: "As duas imagens são obrigatórias."
                });
            }

            const result = await compareFaces(image1.buffer, image2.buffer);
            res.json(result);
        } catch (error) {
            console.error(error);
            res.status(500).json({
                error: "Erro ao comparar as imagens."
            });
        }
    }
);

router.post(
    "/drive/compare",
    upload.fields([
        { name: "reference", maxCount: 1 },
        { name: "fileId", maxCount: 1 }
    ]),
    async (req, res) => {
        try {
            const files = req.files as Record<string, Express.Multer.File[]>;
            const reference = getUploadedFile(files, "reference");
            const fileId = (req.body.fileId as string) || getUploadedFile(files, "fileId")?.buffer?.toString();

            const referenceValidation = validateReferenceImage(reference);
            if (!referenceValidation.valid || !reference) {
                return res.status(400).json({ error: referenceValidation.error || "A imagem de referência é obrigatória." });
            }

            if (!fileId || !fileId.trim()) {
                return res.status(400).json({ error: "O ID do arquivo do Google Drive é obrigatório." });
            }

            const driveFile = await getDriveFileMetadata(fileId.trim());
            const candidateImage = await downloadDriveImage(fileId.trim());
            const result = await compareFaces(reference.buffer, candidateImage);

            return res.json({
                file: {
                    id: driveFile.id,
                    name: driveFile.name,
                    mimeType: driveFile.mimeType,
                    webViewLink: driveFile.webViewLink
                },
                similarity_score: result.similarity_score,
                match: result.match
            });
        } catch (error) {
            console.error("Erro ao comparar referência com imagem do Drive:", error);
            return res.status(500).json({
                error: "Erro ao comparar a imagem de referência com o arquivo do Drive."
            });
        }
    }
);

router.post(
    "/drive",
    upload.single("reference"),
    async (req, res) => {
        try {
            const reference = req.file;
            const referenceValidation = validateReferenceImage(reference);
            if (!referenceValidation.valid || !reference) {
                return res.status(400).json({ error: referenceValidation.error || "A imagem de referência é obrigatória." });
            }

            const pageSize = 100;
            let pageToken = typeof req.body.pageToken === "string" ? req.body.pageToken : undefined;
            const folderId = parseDriveFolderId(typeof req.body.folderId === "string" ? req.body.folderId : undefined);
            const files = [] as Array<{ id?: string | null; name?: string | null; mimeType?: string | null; webViewLink?: string | null }>;
            let nextPageToken: string | null = pageToken ?? null;

            do {
                const page = await listDriveImages({ pageSize, pageToken, folderId });
                files.push(...page.files);
                nextPageToken = page.nextPageToken;
                pageToken = page.nextPageToken ?? undefined;
            } while (nextPageToken);

            const threshold = getFaceSimilarityThreshold();
            const referenceEmbedding = await generateFaceEmbedding(reference.buffer);
            const results: Array<{ id: string; name: string; mimeType: string; webViewLink: string; similarity_score: number; match: boolean }> = [];
            const imageFiles = files.filter((file) => file.id && file.mimeType?.includes("image/"));
            const processed = imageFiles.length;
            let matched = 0;
            let failed = 0;

            let nextFileIndex = 0;
            const processNextFile = async () => {
                while (nextFileIndex < imageFiles.length) {
                    const file = imageFiles[nextFileIndex++];

                    try {
                        const driveImage = await downloadDriveImage(file.id as string);
                        const comparison = await compareFaceEmbedding(referenceEmbedding, driveImage);

                        results.push(
                            toDriveSearchResult({
                                id: file.id as string,
                                name: file.name ?? "imagem",
                                mimeType: file.mimeType ?? "image/jpeg",
                                webViewLink: file.webViewLink ?? "",
                                similarity_score: comparison.similarity_score,
                                match: comparison.match && comparison.similarity_score >= threshold
                            })
                        );
                        if (comparison.match && comparison.similarity_score >= threshold) {
                            matched += 1;
                        }
                    } catch (error) {
                        console.error(`Falha na comparação do arquivo ${file.id}:`, error);
                        failed += 1;
                    }
                }
            };

            const workerCount = Math.min(3, imageFiles.length);
            await Promise.all(Array.from({ length: workerCount }, () => processNextFile()));

            results.sort((left, right) => right.similarity_score - left.similarity_score);

            return res.json({
                results,
                processed,
                matched,
                failed,
                nextPageToken: null
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Erro inesperado.";
            console.error("Erro ao buscar imagens no Drive:", message);
            return res.status(500).json({
                error: message === "A imagem de referência deve conter pelo menos um rosto detectável."
                    ? message
                    : "Erro ao buscar imagens no Google Drive. Verifique se o serviço facial está ativo."
            });
        }
    }
);

export default router;