import { Router } from "express";
import { googleOAuth2Client } from "../config/google.js";
import {
    listDriveImages,
    downloadDriveImage
} from "../services/google-drive.service.js";

const router = Router();

let tokens: any = null;

router.get("/google", (req, res) => {
    const authUrl = googleOAuth2Client.generateAuthUrl({
        access_type: "offline",
        prompt: "consent",        
        scope: ["https://www.googleapis.com/auth/drive.readonly"]
    });

    res.redirect(authUrl);
});

router.get("/google/callback", async (req, res) => {
    try {
        const code  = req.query.code as string;

        if (!code) {
            return res.status(400).json({ error: "Código de autorização não fornecido." });
        }

        const { tokens } = await googleOAuth2Client.getToken(code);

        googleOAuth2Client.setCredentials(tokens);


        res.json({ message: "Autenticação bem-sucedida."
        });
    } catch (error) {
        console.error("Erro ao obter tokens:", error);
        res.status(500).json({ error: "Erro ao obter tokens." });
    }
});

router.get("/drive/images", async (_req, res) => {
    try {
        const files = await listDriveImages();

        res.json({
            files
        });

    } catch (error: unknown) {
        //console.error("Erro ao listar imagens do Drive:", error);

        console.dir(error, { depth: 10 });

        res.status(500).json({
            error: "Erro ao acessar o Google Drive."
        });
    }
});

router.get("/drive/images/:fileId/download", async (req, res) => {
    try {
        const { fileId } = req.params;

        const image = await downloadDriveImage(fileId);

        res.setHeader("Content-Type", "image/jpeg");
        res.send(image);

    } catch (error) {
        console.error("Erro ao baixar imagem do Drive:", error);

        res.status(500).json({
            error: "Erro ao baixar imagem do Drive."
        });
    }
});

export default router;

