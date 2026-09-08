import { Router } from "express";
import multer from "multer";
import { compareFaces } from "../services/face-service.service.js";

const router = Router();

const upload = multer({
    storage: multer.memoryStorage()
});

router.post(
    "/compare",
    upload.fields([
        { name: "image1", maxCount: 1 },
        { name: "image2", maxCount: 1 }
    ]),
    async (req, res) => {
        try {
            const files = req.files as {
                [fieldname: string]: Express.Multer.File[];
            };

            const image1 = files.image1?.[0];
            const image2 = files.image2?.[0];

            if (!image1 || !image2) {
                return res.status(400).json({
                    error: "As duas imagens são obrigatórias."
                });
            }

            const result = await compareFaces(
                image1.buffer,
                image2.buffer
            );

            res.json(result);

        } catch (error) {
            console.error(error);

            res.status(500).json({
                error: "Erro ao comparar as imagens."
            });
        }
    }
);

export default router;