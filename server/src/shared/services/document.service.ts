import crypto from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import { createLocalEmbedding } from "../utils/local-embedding.util.js";
import { AdvancedChunker } from "../utils/chunker.util.js";
import logger from "../config/logger.config.js";

const require = createRequire(import.meta.url);
const MAX_DOCUMENTS_PER_SESSION = 20;
const MAX_EXTRACTED_CHARACTERS = 2_000_000;

export interface UploadedDocument {
    id: string;
    name: string;
    type: string;
    size: number;
    status: "ready";
    chunkCount: number;
    createdAt: string;
}

interface DocumentChunk {
    documentId: string;
    documentName: string;
    chunkIndex: number;
    text: string;
    embedding: Float32Array;
}

interface StoredDocument extends UploadedDocument {
    chunks: DocumentChunk[];
}

const sessions = new Map<string, Map<string, StoredDocument>>();

function getSession(sessionId: string): Map<string, StoredDocument> {
    let session = sessions.get(sessionId);
    if (!session) {
        session = new Map();
        sessions.set(sessionId, session);
    }
    return session;
}

async function extractText(file: Express.Multer.File): Promise<string> {
    const extension = path.extname(file.originalname).toLowerCase();

    if (extension === ".txt" || extension === ".md" || extension === ".csv" || extension === ".json") {
        return file.buffer.toString("utf8");
    }

    if (extension === ".pdf") {
        const pdfParse = require("pdf-parse") as (buffer: Buffer) => Promise<{ text: string }>;
        const result = await pdfParse(file.buffer);
        return result.text;
    }

    if (extension === ".docx") {
        const mammoth = require("mammoth") as {
            extractRawText: (input: { buffer: Buffer }) => Promise<{ value: string }>;
        };
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        return result.value;
    }

    throw new Error(`Unsupported document type: ${extension || "unknown"}. Use PDF, DOCX, TXT, MD, CSV, or JSON.`);
}

export async function processDocuments(
    sessionId: string,
    files: Express.Multer.File[],
): Promise<UploadedDocument[]> {
    if (!sessionId.trim()) {
        throw new Error("A document session is required.");
    }
    if (files.length === 0) {
        throw new Error("Select at least one document to upload.");
    }

    const session = getSession(sessionId);
    if (session.size + files.length > MAX_DOCUMENTS_PER_SESSION) {
        throw new Error(`You can upload up to ${MAX_DOCUMENTS_PER_SESSION} documents in one session.`);
    }

    const processed: UploadedDocument[] = [];
    for (const file of files) {
        const text = (await extractText(file)).replace(/\u0000/g, "").trim();
        if (!text) {
            throw new Error(`"${file.originalname}" does not contain readable text.`);
        }
        if (text.length > MAX_EXTRACTED_CHARACTERS) {
            throw new Error(`"${file.originalname}" is too large after text extraction.`);
        }

        const id = crypto.randomUUID();
        const chunks = AdvancedChunker.chunkSemantic(text)
            .filter((chunk) => chunk.text.length > 20)
            .map((chunk) => ({
                documentId: id,
                documentName: file.originalname,
                chunkIndex: chunk.index,
                text: chunk.text,
                embedding: createLocalEmbedding(chunk.text),
            }));

        if (chunks.length === 0) {
            throw new Error(`"${file.originalname}" does not contain enough text to search.`);
        }

        const document: StoredDocument = {
            id,
            name: file.originalname,
            type: extensionLabel(file.originalname),
            size: file.size,
            status: "ready",
            chunkCount: chunks.length,
            createdAt: new Date().toISOString(),
            chunks,
        };
        session.set(id, document);
        processed.push(toPublicDocument(document));
        logger.info({ sessionId, documentId: id, name: file.originalname, chunks: chunks.length }, "Uploaded document indexed");
    }

    return processed;
}

function extensionLabel(name: string): string {
    return path.extname(name).slice(1).toUpperCase() || "FILE";
}

function toPublicDocument(document: StoredDocument): UploadedDocument {
    const { chunks: _chunks, ...publicDocument } = document;
    return publicDocument;
}

export function listDocuments(sessionId: string): UploadedDocument[] {
    return Array.from(getSession(sessionId).values()).map(toPublicDocument);
}

export function removeDocument(sessionId: string, documentId: string): boolean {
    return getSession(sessionId).delete(documentId);
}

export interface UploadedSearchResult {
    score: number;
    chunk_id: string;
    text: string;
    document_id: string;
    document_name: string;
    chunk_index: number;
}

export function searchDocuments(
    sessionId: string,
    documentIds: string[],
    query: string,
    topK = 5,
): UploadedSearchResult[] {
    const session = sessions.get(sessionId);
    if (!session) {
        throw new Error("Your document session has expired. Please upload the documents again.");
    }
    const selected = documentIds
        .map((id) => session.get(id))
        .filter((document): document is StoredDocument => Boolean(document));
    if (selected.length === 0) {
        throw new Error("Select at least one uploaded document before asking a question.");
    }

    const queryEmbedding = createLocalEmbedding(query);
    const matches = selected.flatMap((document) => document.chunks.map((chunk) => ({
        ...chunk,
        score: cosineSimilarity(queryEmbedding, chunk.embedding),
    })));

    return matches
        .sort((left, right) => right.score - left.score)
        .slice(0, topK)
        .map((match) => ({
            score: match.score,
            chunk_id: `${match.documentId}:${match.chunkIndex}`,
            text: match.text,
            document_id: match.documentId,
            document_name: match.documentName,
            chunk_index: match.chunkIndex,
        }));
}

function cosineSimilarity(left: Float32Array, right: Float32Array): number {
    let score = 0;
    for (let index = 0; index < left.length; index += 1) {
        score += left[index] * right[index];
    }
    return score;
}
