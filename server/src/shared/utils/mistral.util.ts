import { ChatMistralAI } from "@langchain/mistralai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import env from "../config/env.config.js";
import logger from "../config/logger.config.js";
import { createLocalEmbedding } from "./local-embedding.util.js";

const apiKeys: string[] = [];

function isUsableApiKey(value: string | undefined): value is string {
    if (!value) return false;
    const normalized = value.trim().toLowerCase();
    return normalized.length > 0 &&
        !normalized.startsWith("your_") &&
        !normalized.includes("api_key_here") &&
        !normalized.includes("placeholder");
}

// Load keys using the exact same priority/logic
const firstKey = env.MISTRAL_API_KEY || process.env.MISTRAL_API_KEY || process.env.MISTRAL_API_KEY1;
if (isUsableApiKey(firstKey)) {
    apiKeys.push(firstKey.trim());
}
for (let i = 2; i <= 50; i++) {
    const key = process.env[`MISTRAL_API_KEY${i}`];
    if (isUsableApiKey(key)) {
        apiKeys.push(key.trim());
    }
}

let keyIndex = 0;

export function hasMistralApiKey(): boolean {
    return apiKeys.length > 0;
}

/**
 * Returns a Mistral API key from the pool (simple round-robin).
 */
function getApiKey(): string {
    if (apiKeys.length === 0) {
        throw new Error("No Mistral API keys configured in environment variables");
    }
    const key = apiKeys[keyIndex];
    keyIndex = (keyIndex + 1) % apiKeys.length;
    return key;
}

/**
 * Instantiates and returns a configured ChatMistralAI agent using the next key in the pool.
 */
export function createAgent(): ChatMistralAI {
    const apiKey = getApiKey();
    return new ChatMistralAI({
        modelName: "mistral-large-latest",
        apiKey: apiKey,
        temperature: 0,
    });
}

/**
 * Calls Mistral API to generate a 1024-dimension text embedding vector.
 */
export async function getEmbedding(text: string): Promise<Float32Array> {
    if (!hasMistralApiKey()) {
        return createLocalEmbedding(text);
    }

    const apiKey = getApiKey();
    
    const response = await fetch("https://api.mistral.ai/v1/embeddings", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: "mistral-embed",
            input: [text],
        }),
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        if (response.status === 401 || response.status === 403) {
            logger.warn("Mistral credentials were rejected; using local demo embeddings");
            return createLocalEmbedding(text);
        }
        throw new Error(`Mistral Embeddings API error ${response.status}: ${errorText}`);
    }

    interface MistralEmbeddingResponse {
        data: {
            embedding: number[];
            index: number;
        }[];
    }

    const result = (await response.json()) as MistralEmbeddingResponse;
    const embedding = result.data[0]?.embedding;
    if (!embedding) {
        throw new Error("Mistral API returned empty embedding data");
    }

    return new Float32Array(embedding);
}

/**
 * Calls Mistral Chat Completion API in streaming mode using LangChain's ChatMistralAI agent.
 * Yields text tokens as they arrive.
 */
export async function* streamChatCompletion(
    systemPrompt: string,
    userMessage: string,
    preferLocalAnswer = false,
): AsyncGenerator<string, void, unknown> {
    if (preferLocalAnswer) {
        const answer = createUploadedDocumentAnswer(systemPrompt, userMessage);
        yield answer || "The selected documents do not contain enough information to answer this question.";
        return;
    }

    if (!hasMistralApiKey()) {
        const answer = createLocalAnswer(systemPrompt, userMessage);
        if (answer) {
            yield answer;
        } else {
            yield "The selected documents do not contain enough information to answer this question.";
        }
        return;
    }

    const agent = createAgent();

    try {
        const stream = await agent.stream([
            new SystemMessage(systemPrompt),
            new HumanMessage(userMessage),
        ]);

        for await (const chunk of stream) {
            if (typeof chunk.content === "string" && chunk.content) {
                yield chunk.content;
            }
        }
    } catch (err: any) {
        logger.error({ error: err.message }, "Error during LangChain ChatMistralAI stream execution");
        const answer = createLocalAnswer(systemPrompt, userMessage);
        if (answer) {
            yield answer;
            return;
        }
        throw new Error(`LangChain LLM Error: ${err.message}`);
    }
}

function extractFirstSource(systemPrompt: string): string | undefined {
    return systemPrompt
        .match(/\[Source 1(?:[^\]]*)\]:\s*([\s\S]*?)(?:\n\n\[Source 2(?:[^\]]*)\]:|$)/)?.[1]
        ?.trim();
}

function createLocalAnswer(systemPrompt: string, userMessage: string): string | undefined {
    const sources = [...systemPrompt.matchAll(/\[Source \d+[^\]]*\]:\s*([\s\S]*?)(?=\n\n\[Source \d+[^\]]*\]:|$)/g)]
        .map((match) => match[1].trim())
        .filter(Boolean);
    if (sources.length === 0) {
        return undefined;
    }

    const queryTerms = tokenize(userMessage);
    const candidates = sources.flatMap((source) => source
        .split(/\n+/)
        .flatMap((line) => splitSentences(line))
        .map((text) => text.trim())
        .filter((text) => text.length > 2)
        .map((text) => ({
            text,
            score: [...tokenize(text)].reduce(
                (score, term) => score + (queryTerms.has(term) ? 1 : 0),
                0,
            ),
        })));

    const relevant = candidates
        .filter((candidate) => candidate.score > 0)
        .sort((left, right) => right.score - left.score)
        .slice(0, 1)
        .map((candidate) => candidate.text);

    if (relevant.length > 0) {
        return relevant.join(" ");
    }

    return extractFirstSource(systemPrompt);
}

function createUploadedDocumentAnswer(systemPrompt: string, userMessage: string): string | undefined {
    const sources = [...systemPrompt.matchAll(/\[Source \d+[^\]]*\]:\s*([\s\S]*?)(?=\n\n\[Source \d+[^\]]*\]:|$)/g)]
        .map((match) => match[1].trim())
        .filter(Boolean);
    if (sources.length === 0) {
        return undefined;
    }

    const queryTerms = tokenize(userMessage);
    if (queryTerms.has("about") || queryTerms.has("purpose") || queryTerms.has("explain")) {
        ["brief", "description", "purpose", "work"].forEach((term) => queryTerms.add(term));
    }
    const candidates = sources.flatMap((source) => {
        const lines = source
            .split(/\n+/)
            .map((line) => line.trim())
            .filter(Boolean);
        const segments: string[] = [];

        for (let index = 0; index < lines.length; index += 1) {
            const line = lines[index];
            const nextLine = lines[index + 1];
            if (nextLine && line.endsWith(":")) {
                segments.push(`${line} ${nextLine}`);
                index += 1;
            } else {
                segments.push(...splitSentences(line));
            }
        }

        return segments
            .filter((text) => text.length > 2)
            .map((text) => ({
                text,
                score: [...tokenize(text)].reduce(
                    (score, term) => score + (queryTerms.has(term) ? 1 : 0),
                    0,
                ),
            }));
    });

    const bestMatch = candidates
        .filter((candidate) => candidate.score > 0)
        .sort((left, right) => right.score - left.score)
        .at(0)?.text;

    return bestMatch ? formatDocumentFallback(bestMatch, userMessage) : undefined;
}

function formatDocumentFallback(text: string, userMessage: string): string {
    const question = userMessage.toLowerCase();
    let answer = text
        .replace(/^\s*\d+[\].:)]+\s*/, "")
        .replace(/^\s*[ivx]+[\].:)]\s*/i, "")
        .trim();

    if (question.includes("objective")) {
        const objectiveText = (answer.match(/objectives?[^:]*:\s*(.*)$/i)?.[1] || answer)
            .replace(/^\s*[ivx]+[\].:)]\s*/i, "")
            .trim();
        answer = `The main objective is ${objectiveText.replace(/^to\s+/i, "to ")}`
            .replace(/\s+/g, " ")
            .trim();
    } else if (question.includes("summar")) {
        answer = `The document explains that ${answer.charAt(0).toLowerCase()}${answer.slice(1)}`;
    } else if (question.includes("about") && answer.includes(":")) {
        answer = answer.slice(answer.indexOf(":") + 1).trim();
    }

    return answer;
}

function tokenize(value: string): Set<string> {
    const ignoredTerms = new Set([
        "a", "an", "and", "are", "does", "for", "how", "is", "of",
        "the", "this", "to", "what", "who", "where", "which", "with",
    ]);
    return new Set(
        value.toLowerCase().match(/[a-z0-9]+/g)?.filter((term) => !ignoredTerms.has(term)) || [],
    );
}

function splitSentences(value: string): string[] {
    return value
        .replace(/\b(Dr|Mr|Mrs|Ms|Prof)\./g, "$1<abbreviation>")
        .split(/(?<=[.!?])\s+/)
        .map((sentence) => sentence.replace(/<abbreviation>/g, "."));
}
