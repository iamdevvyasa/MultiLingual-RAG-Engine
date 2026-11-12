import { Request, Response } from "express";
import {
    listDocuments,
    processDocuments,
    removeDocument,
} from "../services/document.service.js";

function sessionIdFromRequest(req: Request): string {
    return String(req.body?.sessionId || req.query.sessionId || "").trim();
}

export async function uploadDocuments(req: Request, res: Response): Promise<void> {
    const files = Array.isArray(req.files) ? req.files : [];
    const sessionId = sessionIdFromRequest(req);
    const documents = await processDocuments(sessionId, files);
    res.status(201).json({ documents });
}

export function getDocuments(req: Request, res: Response): void {
    const sessionId = sessionIdFromRequest(req);
    res.json({ documents: listDocuments(sessionId) });
}

export function deleteDocument(req: Request, res: Response): void {
    const sessionId = sessionIdFromRequest(req);
    const documentId = String(req.params.documentId || "").trim();
    if (!documentId || !removeDocument(sessionId, documentId)) {
        res.status(404).json({ message: "Document was not found in this session." });
        return;
    }
    res.status(204).send();
}
