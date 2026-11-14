import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import Database from "better-sqlite3";
import faiss from "faiss-napi";

const DIMENSION = 1024;
const outputDir = path.resolve(process.env.INDEX_ROOT ?? "./indexes", "aligned_english");

const documents = [
    // --- MODULE 1: ARTIFICIAL INTELLIGENCE & MACHINE LEARNING BASICS ---
    "Artificial Intelligence (AI) is the broad field of computer science focused on creating machines capable of performing tasks that typically require human intelligence, including learning, reasoning, problem-solving, perception, and natural language understanding.",
    "Machine Learning (ML) is a subset of artificial intelligence where algorithms learn patterns directly from data rather than following hardcoded, rule-based instructions. As the algorithm is exposed to more data over time, its predictive accuracy improves.",
    "Supervised Learning is an ML paradigm where models are trained on labeled data pairs consisting of input features and ground-truth targets. The two main tasks are Classification (predicting discrete categorical labels) and Regression (predicting continuous numerical values).",
    "Unsupervised Learning trains algorithms on unlabeled data to discover hidden patterns, underlying structures, and intrinsic groupings without human supervision. Common examples include K-Means Clustering and Principal Component Analysis (PCA).",
    "Reinforcement Learning (RL) is a goal-oriented learning framework where an autonomous agent learns to make sequential decisions within an environment to maximize cumulative numerical rewards through trial-and-error exploration and exploitation.",
    "The Bias-Variance Tradeoff is a central challenge in machine learning. High bias leads to Underfitting (the model is too simplistic to capture data patterns), while high variance causes Overfitting (the model memorizes noise in the training set and fails to generalize to unseen test data).",
    "Key Machine Learning evaluation metrics include Accuracy (percentage of correct predictions), Precision (true positives divided by total predicted positives), Recall (true positives divided by actual real positives), and F1-Score (the harmonic mean of precision and recall).",
    "Feature Engineering and Data Preprocessing are foundational steps in ML. They involve cleaning missing values, encoding categorical variables through one-hot encoding, and scaling numerical features using normalization or standardization so algorithms converge faster.",
    "Classical Machine Learning algorithms include Linear Regression for continuous trends, Logistic Regression for binary probabilities, Decision Trees for hierarchical decision rules, Random Forests for ensemble bagging, and Gradient Boosted Trees (like XGBoost) for competitive tabular modeling.",

    // --- MODULE 2: DEEP LEARNING & NEURAL NETWORKS ---
    "Deep Learning is a specialized branch of machine learning based on Artificial Neural Networks with multiple stacked hidden layers. It automatically extracts hierarchical feature representations from raw data like images, audio, and text without manual feature engineering.",
    "An Artificial Neuron (Perceptron) calculates the weighted sum of its inputs, adds a bias term, and passes the result through a non-linear Activation Function such as ReLU (Rectified Linear Unit), Sigmoid, or Softmax to determine its output activation.",
    "Backpropagation is the fundamental training algorithm for neural networks. It computes the gradient of the loss function with respect to every weight using the mathematical chain rule, allowing optimization algorithms like Stochastic Gradient Descent (SGD) and Adam to adjust weights iteratively.",
    "Convolutional Neural Networks (CNNs) use mathematical convolution operations and pooling layers to extract spatial hierarchies and translational invariant patterns, making them the standard architecture for computer vision, image classification, and object detection.",
    "Recurrent Neural Networks (RNNs) and Long Short-Term Memory (LSTM) networks process sequential data by maintaining internal memory states across time steps, mitigating the vanishing gradient problem when modeling sequential dependencies.",
    "The Attention Mechanism allows a model to dynamically weigh the importance of different tokens in an input sequence regardless of their distance. It calculates Query, Key, and Value interactions, allowing deep context comprehension without recurrent bottlenecks.",
    "The Transformer architecture, introduced in 2017 in the paper 'Attention Is All You Need', eliminated recurrence completely in favor of multi-head self-attention and positional encodings, becoming the foundational architecture for all modern Large Language Models.",

    // --- MODULE 3: GENERATIVE AI & LARGE LANGUAGE MODELS (LLMs) ---
    "Generative AI focuses on creating new, original content — including text, code, images, and audio — by learning statistical distributions from massive datasets, contrasting with discriminative models that merely classify or categorize inputs.",
    "Large Language Models (LLMs) are massive transformer-based neural networks trained on hundreds of billions of text tokens using self-supervised next-token prediction, enabling them to understand and generate fluent, human-like language across diverse domains.",
    "The LLM training pipeline consists of three core phases: Pre-training (learning language patterns and broad world knowledge from vast web corpora), Supervised Fine-Tuning (SFT on high-quality instruction datasets), and Alignment via RLHF (Reinforcement Learning from Human Feedback) or DPO (Direct Preference Optimization).",
    "Tokenization converts raw text strings into discrete integer token IDs that neural networks can process. Modern LLMs use subword tokenization algorithms like Byte-Pair Encoding (BPE) or SentencePiece, where one token typically represents approximately 3 to 4 English characters.",
    "Prompt Engineering is the practice of structuring, refining, and designing input prompts to steer an LLM toward accurate responses. Popular techniques include Zero-shot prompting, Few-shot prompting (providing examples), Chain-of-Thought (CoT reasoning), and ReAct (Reasoning and Acting).",
    "Hallucination in Large Language Models is the generation of confident, plausible-sounding statements that are factually false, ungrounded, or contradictory. Hallucinations happen because LLMs are probabilistic word predictors rather than verifiable knowledge databases.",
    "The Context Window defines the maximum number of tokens an LLM can accept and process in a single prompt. Modern context windows range from 8k to over 1 million tokens, although models often suffer from 'Lost in the Middle' attention degradation when critical facts are buried in center paragraphs.",
    "Quantization is a model compression technique that reduces the numerical precision of neural network weights from 16-bit floating point (FP16) to 8-bit (INT8) or 4-bit (INT4) integers, dramatically lowering RAM and GPU memory requirements with minimal loss in accuracy.",
    "Fine-Tuning adapts a pre-trained model's internal weights to a specific domain or format using methods like LoRA (Low-Rank Adaptation) and QLoRA. While effective for learning tone and style, fine-tuning is expensive, static, and cannot easily inject rapidly changing or private enterprise knowledge.",

    // --- MODULE 4: RETRIEVAL-AUGMENTED GENERATION (RAG) BASICS ---
    "Retrieval-Augmented Generation (RAG) is an architectural framework that enhances an LLM by retrieving relevant factual passages from an external, authoritative knowledge base and injecting them into the model's prompt context before generating an answer.",
    "The primary business benefits of RAG include preventing hallucinations, providing clear verifiable source citations, keeping answers up-to-date without retraining, and enforcing granular document-level access control and privacy for enterprise data.",
    "Naive RAG follows three linear steps: Indexing (parsing, chunking, and embedding documents into a vector database), Retrieval (finding the top-K chunks most similar to a user query), and Generation (feeding the retrieved passages and user query to an LLM to generate the answer).",
    "Document Parsing and Ingestion is the first stage of RAG. It extracts clean, structured text and tables from various unstructured file formats such as PDFs, Word DOCX, Markdown, plain text, and CSV files, removing redundant formatting and headers.",
    "Chunking is the process of breaking long documents into smaller, coherent text segments. Common chunking strategies include fixed-size chunking with token overlap, sentence-level splitting, recursive character chunking, and semantic chunking based on semantic embedding shifts.",
    "Text Embeddings are dense, continuous vector representations that map the semantic meaning of words, sentences, or paragraphs into a high-dimensional mathematical space (such as 768 or 1024 dimensions). Texts with similar conceptual meanings cluster together.",
    "Vector Similarity Metrics quantify how close two embedding vectors are in vector space. The two most common metrics are Cosine Similarity (measuring the angular similarity between vectors) and Euclidean Distance (L2 distance measuring the straight-line physical separation).",
    "Vector Databases are purpose-built storage engines optimized for indexing, managing, and performing low-latency Approximate Nearest Neighbor (ANN) similarity search across millions or billions of high-dimensional embedding vectors.",

    // --- MODULE 5: INTERMEDIATE & ADVANCED RAG TECHNIQUES ---
    "Advanced RAG introduces pre-retrieval and post-retrieval optimizations. Pre-retrieval focuses on improving query clarity and search accuracy, while post-retrieval refines and filters candidate passages before passing them into the LLM context window.",
    "Hybrid Search combines dense vector retrieval (which understands semantic synonyms and conceptual meaning) with sparse keyword retrieval like BM25 (which guarantees exact keyword, ID, and acronym matches). Results are merged using Reciprocal Rank Fusion (RRF).",
    "Re-ranking is an essential post-retrieval technique where a Cross-Encoder model (such as BGE-Reranker or Cohere Rerank) calculates full token-to-token attention between the query and each candidate chunk, sorting them with far higher precision than fast bi-encoders.",
    "Hypothetical Document Embeddings (HyDE) is a query expansion method where the LLM first generates a hypothetical draft answer to the user query. The embedding of this synthetic answer is then used to search the vector database, bridging the semantic gap between questions and documents.",
    "Small-to-Big Retrieval (Parent-Child Retrieval) decouples the embedding chunk size from the context window size. Small chunks (like individual sentences) are indexed for precise vector matching, but their broader parent paragraphs or document windows are returned to the LLM.",
    "Contextual Compression uses an LLM or small classification model to strip away irrelevant filler sentences from retrieved chunks before prompt assembly, reducing token usage, avoiding noise, and mitigating the 'Lost in the Middle' problem.",
    "Self-RAG (Self-Reflective RAG) trains models to use special reflection tokens to dynamically judge whether retrieval is necessary, evaluate if retrieved passages are relevant, and verify whether the final generated output is supported by evidence.",
    "Corrective RAG (CRAG) evaluates the confidence of retrieved documents using a retrieval evaluator. If confidence is high, it refines the context; if ambiguous or incorrect, it falls back to external web search to correct the knowledge base.",
    "Graph RAG integrates Knowledge Graphs with vector search. It extracts entities and relationships from text to build an interconnected graph, enabling multi-hop reasoning and holistic thematic summarization across complex document collections.",
    "RAG Evaluation Frameworks such as Ragas and TruLens quantify performance using the RAG Triad: Faithfulness (is the answer grounded in the context?), Answer Relevance (does the answer address the user question?), and Context Precision/Recall (did the retriever find the right passages?).",

    // --- MODULE 6: FAISS & VECTOR SEARCH MECHANICS ---
    "FAISS (Facebook AI Similarity Search) is an open-source C++ library developed by Meta AI optimized for ultra-fast vector similarity search and clustering of dense high-dimensional vectors on both CPUs and GPUs.",
    "IndexFlatL2 and IndexFlatIP in FAISS perform exact brute-force vector search by calculating pairwise distances against every indexed vector. When vectors are L2-normalized to unit length, Inner Product (IndexFlatIP) is mathematically identical to Cosine Similarity.",
    "IndexIVFFlat in FAISS is an inverted file index that partitions vector space into Voronoi cells using k-means clustering. At search time, it only scans vectors in the closest 'nprobe' cluster centroids, accelerating search speeds by 10x to 100x.",
    "The 'nprobe' parameter in FAISS IVFFlat governs the trade-off between search speed and recall accuracy. Setting a low nprobe inspects fewer centroids for sub-millisecond latency, while a higher nprobe approaches exact brute-force search recall.",
    "Product Quantization (PQ / IndexIVFPQ) is a lossy vector compression algorithm that splits high-dimensional vectors into smaller sub-vectors and quantizes each into centroid indices, reducing vector memory consumption by up to 95% while retaining high search accuracy.",
    "FAISS HNSW (Hierarchical Navigable Small World) builds a multi-layer proximity graph where upper layers execute fast long-range skips and bottom layers provide fine-grained local navigation, achieving exceptional recall and sub-millisecond query latency without offline training.",
    "Faiss-node provides high-performance native C++ Node.js bindings for Meta's FAISS library. It allows Express and Node.js servers to execute vector similarity searches in native C++ memory without V8 heap garbage collection pauses."
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
        insert.run(id, `aiml-${id}`, `aiml-${id}`, text, id, "en", id, 1, 0, "whole");
    });
});
insertMany();
db.close();

await fs.writeFile(
    path.join(outputDir, "state.json"),
    JSON.stringify({ language: "aligned_english", sourceFile: "AI, ML, and RAG Comprehensive Knowledge Base", completed: true, totalChunks: documents.length }, null, 2)
);

console.log(`Created ${documents.length} demo passages in ${outputDir}`);
