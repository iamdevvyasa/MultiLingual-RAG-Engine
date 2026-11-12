import { createHash } from "node:crypto";

export const LOCAL_EMBEDDING_DIMENSION = 1024;

function tokenIndex(token: string): number {
    const digest = createHash("sha256").update(token).digest();
    return digest.readUInt32BE(0) % LOCAL_EMBEDDING_DIMENSION;
}

function tokenSign(token: string): number {
    const digest = createHash("sha256").update(`sign:${token}`).digest();
    return digest[0] % 2 === 0 ? 1 : -1;
}

export function createLocalEmbedding(text: string): Float32Array {
    const tokens = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
    const vector = new Float32Array(LOCAL_EMBEDDING_DIMENSION);

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const weight = 1 + Math.log1p(tokens.length);
        vector[tokenIndex(token)] += tokenSign(token) * weight;

        if (i > 0) {
            const bigram = `${tokens[i - 1]}:${token}`;
            vector[tokenIndex(bigram)] += tokenSign(bigram) * weight;
        }
    }

    let norm = 0;
    for (const value of vector) norm += value * value;
    norm = Math.sqrt(norm);

    if (norm > 0) {
        for (let i = 0; i < vector.length; i++) {
            vector[i] /= norm;
        }
    }

    return vector;
}
