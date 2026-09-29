import { Router } from "express";
import { googleOAuth2Client } from "../config/google.js";
import {
    listDriveImages,
    listDriveFolders,
    downloadDriveImage,
    getDriveFileMetadata
} from "../services/google-drive.service.js";

const router = Router();
const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";

router.get("/google", (_req, res) => {
    const authUrl = googleOAuth2Client.generateAuthUrl({
        access_type: "offline",
        prompt: "consent",
        scope: ["https://www.googleapis.com/auth/drive.readonly"]
    });

    res.redirect(authUrl);
});

router.get("/google/callback", async (req, res) => {
    try {
        const code = req.query.code as string;

        if (!code) {
            return res.status(400).json({ error: "Código de autorização não fornecido." });
        }

        const { tokens } = await googleOAuth2Client.getToken(code);
        googleOAuth2Client.setCredentials(tokens);

        res.cookie("google_auth", "true", {
            httpOnly: false,
            sameSite: "lax",
            secure: false,
            maxAge: 1000 * 60 * 60 * 24 * 7
        });

        const redirectUrl = `${frontendUrl}/?googleAuthenticated=1`;
        return res.redirect(redirectUrl);
    } catch (error) {
        console.error("Erro ao obter tokens:", error);
        return res.redirect(`${frontendUrl}/?googleAuthenticated=0&error=oauth`);
    }
});

router.get("/drive/images", async (req, res) => {
    try {
        const pageSize = Math.min(Math.max(Number(req.query.pageSize ?? 20), 1), 100);
        const pageToken = typeof req.query.pageToken === "string" ? req.query.pageToken : undefined;
        const result = await listDriveImages({ pageSize, pageToken });

        res.json({
            files: result.files,
            nextPageToken: result.nextPageToken
        });
    } catch (error: unknown) {
        console.error("Erro ao listar imagens do Drive:", error);

        res.status(500).json({
            error: "Erro ao acessar o Google Drive."
        });
    }
});

router.get("/drive/folders", async (req, res) => {
    try {
        const pageSize = Math.min(Math.max(Number(req.query.pageSize ?? 50), 1), 100);
        const pageToken = typeof req.query.pageToken === "string" ? req.query.pageToken : undefined;
        const result = await listDriveFolders({ pageSize, pageToken });

        res.json({
            folders: result.folders,
            nextPageToken: result.nextPageToken
        });
    } catch (error: unknown) {
        console.error("Erro ao listar pastas do Drive:", error);

        res.status(500).json({
            error: "Erro ao acessar as pastas do Google Drive."
        });
    }
});

router.get("/drive/images/:fileId", async (req, res) => {
    try {
        const { fileId } = req.params;
        const file = await getDriveFileMetadata(fileId);

        res.json({
            file: {
                id: file.id,
                name: file.name,
                mimeType: file.mimeType,
                webViewLink: file.webViewLink
            }
        });
    } catch (error) {
        console.error("Erro ao consultar arquivo do Drive:", error);
        res.status(500).json({ error: "Erro ao consultar o arquivo do Drive." });
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

