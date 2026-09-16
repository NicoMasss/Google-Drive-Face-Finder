import { google } from "googleapis";
import { googleOAuth2Client } from "../config/google.js";

export async function listDriveImages() {
    const drive = google.drive({ version: "v3", auth: googleOAuth2Client });

    const response = await drive.files.list({
        pageSize: 20,
        fields: "files(id, name, mimeType, webViewLink)",
        q: "trashed = false and mimeType contains 'image/'"
    });
    
    return response.data.files ?? [];
}


export async function downloadDriveImage(fileId: string) {
    const drive = google.drive({
        version: "v3",
        auth: googleOAuth2Client
    });

    const response = await drive.files.get(
        {
            fileId,
            alt: "media"
        },
        {
            responseType: "arraybuffer"
        }
    );

    return Buffer.from(response.data as ArrayBuffer);
}