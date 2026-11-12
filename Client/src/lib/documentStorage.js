const DB_NAME = "vaanirag-documents";
const STORE_NAME = "files";
const DB_VERSION = 1;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Unable to open document storage."));
  });
}

export async function saveDocumentFiles(sessionId, files) {
  const database = await openDatabase();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    files.forEach((file) => {
      store.put({
        key: `${sessionId}:${file.name}:${file.size}:${file.lastModified}`,
        sessionId,
        name: file.name,
        type: file.type,
        size: file.size,
        lastModified: file.lastModified,
        file,
      });
    });
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || new Error("Unable to save document locally."));
  });
  database.close();
}

export async function removeDocumentFile(sessionId, document) {
  const database = await openDatabase();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => {
      request.result
        .filter((entry) => (
          entry.sessionId === sessionId
          && entry.name === document.name
          && entry.size === document.size
        ))
        .forEach((entry) => store.delete(entry.key));
    };
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || new Error("Unable to remove document locally."));
  });
  database.close();
}

export async function getStoredDocumentFiles(sessionId) {
  const database = await openDatabase();
  const files = await new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(
      request.result
        .filter((entry) => entry.sessionId === sessionId)
        .map((entry) => entry.file),
    );
    request.onerror = () => reject(request.error || new Error("Unable to read local documents."));
  });
  database.close();
  return files;
}
