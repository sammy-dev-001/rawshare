const DB_NAME = 'RawShare-PWA';
const DB_VERSION = 1;
const STORE_NAME = 'shared-files';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method === 'POST' && event.request.url.endsWith('/api/share-target')) {
    event.respondWith(
      (async () => {
        try {
          const formData = await event.request.formData();
          const files = formData.getAll('files');
          
          if (files && files.length > 0) {
            const db = await openDB();
            
            // We use a Promise to wrap the transaction logic
            await new Promise((resolve, reject) => {
              const transaction = db.transaction(STORE_NAME, 'readwrite');
              const store = transaction.objectStore(STORE_NAME);
              
              store.clear().onsuccess = () => {
                let addedCount = 0;
                let filesToAdd = 0;
                
                for (const file of files) {
                  if (file instanceof File) {
                    filesToAdd++;
                    const addReq = store.add(file);
                    addReq.onsuccess = () => {
                      addedCount++;
                      if (addedCount === filesToAdd) resolve(true);
                    };
                    addReq.onerror = () => reject(addReq.error);
                  }
                }
                if (filesToAdd === 0) resolve(true);
              };
            });
          }
          
          return Response.redirect('/?shared=true', 303);
        } catch (error) {
          console.error('Error handling share target:', error);
          return Response.redirect('/?shared=error', 303);
        }
      })()
    );
  }
});
