import { google } from "googleapis";
import dotenv from "dotenv";

dotenv.config();

const googleClientId = process.env.GOOGLE_CLIENT_ID ?? "";
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";
const googleRedirectUri = process.env.GOOGLE_REDIRECT_URI ?? "http://localhost:3000/auth/google/callback";

export const googleOAuth2Client = new google.auth.OAuth2(
    googleClientId,
    googleClientSecret,
    googleRedirectUri
);