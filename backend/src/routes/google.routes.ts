import { Router } from "express";
import { googleOAuth2Client } from "../config/google.js";

const router = Router();

let tokens: any = null;

router.get("/google", (req, res) => {
    const authUrl = googleOAuth2Client.generateAuthUrl({
        access_type: "offline",
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

        console.log("tokens recebidos:", tokens);
        googleOAuth2Client.setCredentials(tokens);


        res.json({ message: "Autenticação bem-sucedida.", tokens });
    } catch (error) {
        console.error("Erro ao obter tokens:", error);
        res.status(500).json({ error: "Erro ao obter tokens." });
    }
});

export default router;

