import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import Database from "better-sqlite3";
import faiss from "faiss-napi";

const DIMENSION = 1024;
const outputDir = path.resolve(process.env.INDEX_ROOT ?? "./indexes", "aligned_english");

const documents = [
    // Core RAG Foundations
    "Retrieval-Augmented Generation, or RAG, retrieves relevant passages from a knowledge base before an AI model generates an answer. This reduces unsupported answers and makes responses easier to verify.",
    "The multilingual assistant accepts questions in supported Indian languages. A voice question can be transcribed, translated to English for retrieval, and answered with the user's language when translation services are configured.",
    "FAISS is a vector similarity search library developed by Meta AI. It stores numerical embeddings and quickly finds document passages that are most similar to a user's query using cosine or L2 distance.",
    "SQLite stores the metadata for each indexed passage, including its text, document identifier, passage number, and FAISS vector identifier.",
    "A grounded answer should be based on retrieved source passages. When the knowledge base does not contain enough information, the assistant should clearly say that it cannot answer from the available documents.",
    "The project has a React frontend and an Express backend. The frontend sends a query to the backend, and the backend streams status updates, citations, and answer text using Server-Sent Events.",
    
    // Advanced RAG Patterns & Architectures
    "Naive RAG consists of three basic stages: indexing document chunks, retrieving top-k similar chunks using dense embeddings, and augmenting prompt context for LLM generation. While simple, Naive RAG often suffers from low precision, irrelevant context, and hallucinations.",
    "Advanced RAG introduces pre-retrieval and post-retrieval optimization strategies. Pre-retrieval includes query expansion, hypothetical document embeddings (HyDE), and sub-query routing. Post-retrieval includes reranking, chunk deduplication, and context compression.",
    "Modular RAG offers a dynamic architecture where specialized modules — such as search, routing, rewrite, memory, evaluation, and predict — can be combined in flexible workflows. It supports iterative, recursive, and adaptive retrieval pipelines.",
    "Hybrid Search combines dense vector retrieval with sparse keyword search like BM25. Dense retrieval captures semantic intent, while sparse search guarantees exact keyword and acronym matching. The results are merged using Reciprocal Rank Fusion (RRF).",
    "Re-ranking is a crucial post-retrieval step in RAG pipelines. While bi-encoder vector search retrieves candidates quickly, cross-encoder rerankers (such as BGE-Reranker or Cohere Rerank) compute full cross-attention between the query and each chunk, dramatically improving retrieval precision.",
    "Contextual Compression and Small-to-Big Retrieval solve the chunk size trade-off in RAG. Small chunks (e.g. individual sentences) are used for precise vector embedding and retrieval, but their larger parent document windows (e.g. surrounding paragraphs) are passed to the LLM for generation.",
    "HyDE, or Hypothetical Document Embeddings, improves retrieval by asking the LLM to generate a hypothetical answer to the user's query first. The hypothetical answer's embedding is then used to search the vector database, leading to better semantic alignment with real documents.",
    "Self-RAG (Self-Reflective Retrieval-Augmented Generation) uses reflection tokens to dynamically decide when retrieval is necessary, evaluates the relevance of retrieved passages, and assesses whether the final generated output is supported and factual.",
    "Corrective RAG (CRAG) evaluates the quality of retrieved documents before generation. If the retrieval is evaluated as confident, it proceeds to generate; if ambiguous or incorrect, it falls back to external web search to correct the context.",
    "Graph RAG constructs a knowledge graph from text documents, extracting entities, relations, and communities. It excels at answering complex, global queries across entire document collections where standard vector similarity search fails to capture interconnected themes.",
    "The 'Lost in the Middle' phenomenon refers to LLM attention decay where models recall information placed at the beginning and end of long prompts much better than information located in the center. Effective RAG pipelines reorder retrieved chunks to place top context at the boundaries.",
    "RAG evaluation frameworks like Ragas and TruLens quantify pipeline quality using core metrics: Faithfulness (is the answer grounded in context?), Answer Relevance (does the answer address the user query?), and Context Recall (were all necessary facts retrieved?).",
    "In RAG pipelines, chunking is the process of breaking long documents into smaller, manageable text segments. Proper chunking preserves contextual meaning and ensures passages fit within the token context window of embedding and generative models.",
    "Dense vector embeddings represent text as continuous numerical arrays in a high-dimensional semantic space. Words and sentences with similar meanings are positioned close to each other, allowing vector similarity search to find semantically related passages.",
    "Large Language Models can occasionally hallucinate by generating plausible-sounding but factually incorrect statements. Grounding the generation step with retrieved context from verified documents significantly reduces hallucinations.",
    "The Transformer neural network architecture relies on self-attention mechanisms to process all tokens in a sequence in parallel. This breakthrough superseded recurrent neural networks and became the foundation for modern models like GPT, Gemini, and Mistral.",
    "Fine-tuning updates the internal weights of a pre-trained neural network on specialized data. In contrast, RAG provides relevant information dynamically at inference time without requiring expensive model retraining or server infrastructure.",

    // FAISS Deep Dive & Mechanics
    "FAISS provides IndexFlatL2 for exact Euclidean distance search and IndexFlatIP for exact Inner Product search. When embeddings are L2-normalized to unit length, Inner Product is mathematically equivalent to Cosine Similarity.",
    "IndexIVFFlat in FAISS partitions vector space into Voronoi cells using k-means clustering. At query time, instead of scanning every vector, it only searches the closest 'nprobe' centroids, accelerating nearest neighbor search by orders of magnitude.",
    "The 'nprobe' parameter in FAISS IVFFlat balances search speed and recall. A lower nprobe inspects fewer centroids for ultra-low latency, while a higher nprobe approaches exact search recall at the expense of slightly increased search time.",
    "Product Quantization (PQ) in FAISS breaks high-dimensional vectors into smaller sub-vectors and quantizes each into discrete centroid codes. IndexIVFPQ reduces memory footprint by up to 95%, allowing millions of high-dimensional vectors to reside in RAM.",
    "FAISS HNSW (Hierarchical Navigable Small World) builds a multi-layer proximity graph where upper layers have long-range skips and bottom layers contain fine-grained connections. HNSW delivers exceptional recall and sub-millisecond query latency without requiring offline training.",
    "IDMap and IDMap2 in FAISS maintain a two-way mapping between user-defined 64-bit integer IDs and the internal sequential storage indices. This allows developers to remove vectors by ID or associate vector positions directly with database primary keys.",
    "FAISS supports GPU acceleration through CUDA. It distributes vector indices across multiple GPUs, leveraging high-bandwidth video memory and tensor cores to achieve millions of similarity comparisons per second.",
    "Faiss-node is a high-performance native C++ Node.js binding for Meta's FAISS library. It allows Node.js and TypeScript backends to execute vector searches in native C++ memory without V8 heap overhead or garbage collection pauses.",
    "Vector indexing techniques in FAISS include Flat indexes for exact brute-force search, and IVF (Inverted File) indexes with Product Quantization (PQ) for ultra-fast approximate nearest neighbor search across millions of vectors.",

    // Application & Ecosystem Tech
    "Sarvam AI provides state-of-the-art speech recognition, text-to-speech, and machine translation models specifically optimized for Indian languages, enabling voice-to-text transcription and cross-lingual translation across Hindi, Tamil, Telugu, Bengali, Kannada, and other regional languages.",
    "The VaaniRAG application allows users to upload custom documents in PDF, DOCX, TXT, MD, CSV, and JSON formats. The uploaded documents are parsed, chunked, and stored in a session so users can query their own files.",
    "Server-Sent Events, or SSE, is a lightweight HTTP-based unidirectional streaming protocol. It allows the VaaniRAG backend to stream real-time query status, vector search progress, citations, and LLM tokens directly to the client browser.",
    "Mistral AI offers high-performance open-weight and commercial large language models, including Mistral 7B, Mixtral 8x7B mixture-of-experts, and Mistral Embeddings designed for semantic search and retrieval workflows.",

    // Indian Technology & Space Highlights
    "Chandrayaan-3 was India's third lunar exploration mission developed by ISRO. On August 23, 2023, its Vikram lander successfully executed a soft landing near the lunar south pole, making India the first country to land in the south polar region.",
    "The Pragyan rover from the Chandrayaan-3 mission deployed from Vikram lander and traversed the lunar surface, conducting in-situ chemical analysis of lunar soil and detecting the presence of sulphur, aluminium, calcium, iron, and oxygen.",
    "Aditya-L1 is India's first dedicated space observatory to study the Sun. It was launched by ISRO using PSLV-C57 and placed in a halo orbit around the Sun-Earth Lagrangian point L1, approximately 1.5 million kilometers from Earth.",
    "The Unified Payments Interface, known as UPI, is an instant real-time payment system developed by the National Payments Corporation of India (NPCI). It facilitates inter-bank peer-to-peer and person-to-merchant mobile transactions.",
    "Digital Public Infrastructure in India, often called the India Stack, consists of foundational digital public goods including Aadhaar for biometric digital identity, UPI for real-time payments, DigiLocker for document verification, and ONDC for open e-commerce.",
    "The Gaganyaan mission is an Indian human spaceflight program developed by ISRO. It aims to demonstrate human spaceflight capability by launching a crew of Indian astronauts (Vyomnauts) into a 400-kilometer low Earth orbit for a multi-day mission.",
    "Quantum computing utilizes the principles of quantum mechanics, such as superposition and entanglement, to perform computations that are exponentially faster than classical computers for specific problem classes like cryptography and molecular simulation.",
    "Green hydrogen is produced through the electrolysis of water using renewable energy sources such as solar or wind power. It serves as a zero-emission energy carrier for decarbonizing heavy industries and transportation.",
    "Lithium iron phosphate (LFP) batteries are widely used in electric vehicles and grid energy storage due to their long cycle life, high thermal stability, safety profile, and absence of cobalt and nickel in the cathode."
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
