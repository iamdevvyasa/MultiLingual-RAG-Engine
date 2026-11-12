import express from "express";
import multer from "multer";
import {
    deleteDocument,
    getDocuments,
    uploadDocuments,
} from "../controllers/document.controller.js";
import { handleDocumentQuery } from "../controllers/document-query.controller.js";

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        files: 20,
        fileSize: 25 * 1024 * 1024,
    },
});

const router = express.Router();

router.get("/", getDocuments);
router.post("/", upload.array("documents", 20), uploadDocuments);
router.post("/query", handleDocumentQuery);
router.delete("/:documentId", deleteDocument);

export default router;
