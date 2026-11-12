import { Request, Response } from "express";
import { searchDocuments } from "../services/document.service.js";
import { hasMistralApiKey, streamChatCompletion } from "../utils/mistral.util.js";
import logger from "../config/logger.config.js";

export async function handleDocumentQuery(req: Request, res: Response): Promise<void> {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const sendEvent = (event: string, data: unknown) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        if (typeof (res as Response & { flush?: () => void }).flush === "function") {
            (res as Response & { flush: () => void }).flush();
        }
    };

    try {
        const query = String(req.body?.query || "").trim();
        const sessionId = String(req.body?.documentSessionId || "").trim();
        const selectedDocumentIds = String(req.body?.selectedDocumentIds || "")
            .split(",")
            .map((id) => id.trim())
            .filter(Boolean);

        if (!query) {
            throw new Error("Enter a question about the selected documents.");
        }

        sendEvent("status", {
            step: "document_search_start",
            message: "Searching the selected documents...",
            timestamp: Date.now(),
        });

        const searchStart = performance.now();
        const results = searchDocuments(sessionId, selectedDocumentIds, query, 5);
        const searchMs = Number((performance.now() - searchStart).toFixed(4));

        sendEvent("status", {
            step: "document_search_done",
            message: `Found ${results.length} relevant sections in the selected documents.`,
            timestamp: Date.now(),
            latency: searchMs,
        });
        sendEvent("metadata", {
            query,
            searchedDocuments: selectedDocumentIds,
            searchMs,
            citations: results.map((result) => ({
                chunk_id: result.chunk_id,
                score: result.score,
                text: result.text,
                document_id: result.document_id,
                document_name: result.document_name,
                chunk_index: result.chunk_index,
            })),
        });

        const context = results
            .map((result, index) => `[Source ${index + 1} - ${result.document_name}]: ${result.text}`)
            .join("\n\n");
        const systemPrompt = `You are a document question-answering assistant.
Answer the user's question using only the selected document context.
Return a concise, direct answer. If the context does not answer the question, say that clearly.

Selected document context:
${context}`;

        sendEvent("status", {
            step: "answer_start",
            message: "Preparing an answer from the selected document context...",
            timestamp: Date.now(),
        });

        for await (const chunk of streamChatCompletion(systemPrompt, query, !hasMistralApiKey())) {
            sendEvent("chunk", { text: chunk });
        }

        sendEvent("status", {
            step: "answer_done",
            message: "Document-grounded answer completed.",
            timestamp: Date.now(),
        });
        sendEvent("done", {});
        res.end();
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to answer from the selected documents.";
        logger.error({ error: message }, "Document query failed");
        sendEvent("error", { message });
        res.end();
    }
}
