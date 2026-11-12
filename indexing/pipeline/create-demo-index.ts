import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import Database from "better-sqlite3";
import faiss from "faiss-napi";

const DIMENSION = 1024;
const outputDir = path.resolve(process.env.INDEX_ROOT ?? "./indexes", "aligned_english");

const documents = [
    "Retrieval-Augmented Generation, or RAG, retrieves relevant passages from a knowledge base before an AI model generates an answer. This reduces unsupported answers and makes responses easier to verify.",
    "The multilingual assistant accepts questions in supported Indian languages. A voice question can be transcribed, translated to English for retrieval, and answered with the user's language when translation services are configured.",
    "FAISS is a vector similarity search library. It stores numerical embeddings and quickly finds document passages that are most similar to a user's query.",
    "SQLite stores the metadata for each indexed passage, including its text, document identifier, passage number, and FAISS vector identifier.",
    "A grounded answer should be based on retrieved source passages. When the knowledge base does not contain enough information, the assistant should clearly say that it cannot answer from the available documents.",
    "The project has a React frontend and an Express backend. The frontend sends a query to the backend, and the backend streams status updates, citations, and answer text using Server-Sent Events."
];

function indexFor(token: string): number {
    return createHash("sha256").update(token).digest().readUInt32BE(0) % DIMENSION;
}

function signFor(token: string): number {
    return createHash("sha256").update(`sign:${token}`).digest()[0] % 2 === 0 ? 1 : -1;
}

function embed(text: string): number[] {
    const tokens = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
    const vector = new Array<number>(DIMENSION).fill(0);
    for (let i = 0; i < tokens.length; i++) {
        vector[indexFor(tokens[i])] += signFor(tokens[i]);
        if (i > 0) {
            const bigram = `${tokens[i - 1]}:${tokens[i]}`;
            vector[indexFor(bigram)] += signFor(bigram);
        }
    }
    const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
    return norm === 0 ? vector : vector.map((value) => value / norm);
}

await fs.mkdir(outputDir, { recursive: true });
const index = new faiss.IndexFlatL2(DIMENSION).toIDMap2();
const vectors = documents.flatMap(embed);
const ids = documents.map((_, index) => BigInt(index));
index.addWithIds(vectors, ids);
index.write(path.join(outputDir, "index.faiss"));

const dbPath = path.join(outputDir, "metadata.db");
await fs.rm(dbPath, { force: true });
const db = new Database(dbPath);
db.exec(`
    DROP TABLE IF EXISTS chunks;
    CREATE TABLE chunks (
        faiss_id INTEGER PRIMARY KEY,
        chunk_id TEXT NOT NULL,
        parent_id TEXT NOT NULL,
        text TEXT NOT NULL,
        query_id INTEGER NOT NULL,
        language TEXT NOT NULL,
        passage_index INTEGER NOT NULL,
        is_selected INTEGER NOT NULL,
        chunk_index INTEGER NOT NULL,
        chunk_type TEXT NOT NULL,
        translations TEXT
    );
`);
const insert = db.prepare(`
    INSERT INTO chunks
    (faiss_id, chunk_id, parent_id, text, query_id, language, passage_index, is_selected, chunk_index, chunk_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertMany = db.transaction(() => {
    documents.forEach((text, id) => {
        insert.run(id, `demo-${id}`, `demo-${id}`, text, id, "en", id, 1, 0, "whole");
    });
});
insertMany();
db.close();

await fs.writeFile(
    path.join(outputDir, "state.json"),
    JSON.stringify({ language: "aligned_english", sourceFile: "built-in demo knowledge base", completed: true }, null, 2)
);

console.log(`Created ${documents.length} demo passages in ${outputDir}`);
