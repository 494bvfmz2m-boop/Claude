'use strict';

// Shared documents (chat conversations, short links, file shares…), kept in memory once read and
// written back in the background. Callers change a document in place and call save(name).
// Writes to one document never overlap: a change made while one is being written goes out next.

const MAX_CACHED = 400;

function createDocs(backend) {
    const cache = new Map(); // name -> value
    const loading = new Map(); // name -> promise
    const writing = new Map(); // name -> promise
    const again = new Set();

    function trim() {
        if (cache.size <= MAX_CACHED) return;
        for (const name of cache.keys()) {
            if (cache.size <= MAX_CACHED) break;
            if (!writing.has(name)) cache.delete(name);
        }
    }

    /** the document, or what fallback() makes when there's none yet */
    async function get(name, fallback = () => ({})) {
        if (cache.has(name)) {
            const v = cache.get(name);
            cache.delete(name); // most recently used last
            cache.set(name, v);
            return v;
        }
        if (!loading.has(name)) {
            loading.set(
                name,
                backend
                    .loadDoc(name)
                    .then(doc => {
                        if (!cache.has(name)) cache.set(name, doc || fallback());
                        trim();
                        return cache.get(name);
                    })
                    .finally(() => loading.delete(name))
            );
        }
        return loading.get(name);
    }

    function save(name) {
        if (writing.has(name)) return void again.add(name);
        const run = (async () => {
            do {
                again.delete(name);
                try {
                    if (cache.has(name)) await backend.saveDoc(name, cache.get(name));
                } catch (err) {
                    console.error(`Couldn’t save ${name}:`, err.message);
                }
            } while (again.has(name));
        })();
        writing.set(name, run);
        run.finally(() => writing.delete(name));
    }

    async function remove(name) {
        cache.delete(name);
        while (writing.has(name)) await writing.get(name);
        await backend.deleteDoc(name);
    }

    async function flush() {
        while (writing.size) await Promise.all([...writing.values()]);
    }

    return { get, save, remove, flush };
}

module.exports = { createDocs };
