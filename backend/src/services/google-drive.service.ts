import { google } from "googleapis";
import { googleOAuth2Client } from "../config/google.js";

export function parseDriveFolderId(folderIdOrUrl?: string | null) {
    if (!folderIdOrUrl) {
        return null;
    }

    const trimmed = folderIdOrUrl.trim();
    if (!trimmed) {
        return null;
    }

    const match = trimmed.match(/(?:folders\/|id=)([A-Za-z0-9_-]+)/i);
    if (match?.[1]) {
        return match[1];
    }

    return trimmed;
}

export function buildDriveImageQuery(folderId?: string | null) {
    const baseQuery = "trashed = false and mimeType contains 'image/'";
    if (!folderId) {
        return baseQuery;
    }

    return `${baseQuery} and '${folderId}' in parents`;
}

export async function listDriveImages(options: { pageSize?: number; pageToken?: string | null; folderId?: string | null } = {}) {
    const drive = google.drive({ version: "v3", auth: googleOAuth2Client });
    const pageSize = Math.min(Math.max(Number(options.pageSize ?? 20), 1), 100);
    const folderId = parseDriveFolderId(options.folderId ?? null);

    const response = await drive.files.list({
        pageSize,
        pageToken: options.pageToken ?? undefined,
        fields: "nextPageToken, files(id, name, mimeType, webViewLink)",
        q: buildDriveImageQuery(folderId),
        orderBy: "modifiedTime desc"
    });

    return {
        files: response.data.files ?? [],
        nextPageToken: response.data.nextPageToken ?? null,
        folderId
    };
}

export async function listDriveFolders(options: { pageSize?: number; pageToken?: string | null } = {}) {
    const drive = google.drive({ version: "v3", auth: googleOAuth2Client });
    const pageSize = Math.min(Math.max(Number(options.pageSize ?? 20), 1), 100);

    const response = await drive.files.list({
        pageSize,
        pageToken: options.pageToken ?? undefined,
        fields: "nextPageToken, files(id, name, mimeType, webViewLink)",
        q: "trashed = false and mimeType = 'application/vnd.google-apps.folder'",
        orderBy: "name asc"
    });

    return {
        folders: (response.data.files ?? []).map((file) => ({
            id: file.id ?? "",
            name: file.name ?? "Pasta sem nome",
            mimeType: file.mimeType ?? "application/vnd.google-apps.folder",
            webViewLink: file.webViewLink ?? ""
        })),
        nextPageToken: response.data.nextPageToken ?? null
    };
}

export async function getDriveFileMetadata(fileId: string) {
    const drive = google.drive({ version: "v3", auth: googleOAuth2Client });
    const response = await drive.files.get({
        fileId,
        fields: "id, name, mimeType, webViewLink"
    });

    return response.data;
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