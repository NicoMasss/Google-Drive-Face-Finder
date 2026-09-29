import test from "node:test";
import assert from "node:assert/strict";

import {
  getFaceSimilarityThreshold,
  normalizeComparisonResult,
  toDriveSearchResult
} from "../src/services/face-service.service.js";
import {
  buildDriveImageQuery,
  parseDriveFolderId
} from "../src/services/google-drive.service.js";

test("threshold comes from environment and supports the MVP boundary", () => {
  process.env.FACE_SIMILARITY_THRESHOLD = "0.2";

  assert.equal(getFaceSimilarityThreshold(), 0.2);
  assert.equal(
    normalizeComparisonResult({ similarity_score: 0.2, match: true }).match,
    true
  );
  assert.equal(
    normalizeComparisonResult({ similarity_score: 0.19, match: false }).match,
    false
  );
});

test("search result metadata is normalized without permanent copies", () => {
  const result = toDriveSearchResult({
    id: "abc123",
    name: "photo.jpg",
    mimeType: "image/jpeg",
    webViewLink: "https://drive.google.com/file/d/abc123/view",
    similarity_score: 0.81
  });

  assert.equal(result.id, "abc123");
  assert.equal(result.name, "photo.jpg");
  assert.equal(result.similarity_score, 0.81);
  assert.equal(result.match, false);
  assert.equal(result.webViewLink.includes("drive.google.com"), true);
});

test("drive folder selection is parsed and applied to the search query", () => {
  assert.equal(parseDriveFolderId("https://drive.google.com/drive/folders/abc123"), "abc123");
  assert.equal(parseDriveFolderId("abc123"), "abc123");
  assert.equal(
    buildDriveImageQuery("folder123"),
    "trashed = false and mimeType contains 'image/' and 'folder123' in parents"
  );
  assert.equal(
    buildDriveImageQuery(),
    "trashed = false and mimeType contains 'image/'"
  );
});
