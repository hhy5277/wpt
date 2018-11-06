// META: title=StorageManager: estimate() usage breakdown for indexeddb

function objEqualsExceptForKeys(obj1, obj2, keys) {
  if (Object.keys(obj1).length !== Object.keys(obj2).length) {
    return false;
  }
  for (const key in obj1) {
    if (keys.includes(key)) {
      continue;
    }
    if (obj1[key] !== obj2[key]) {
      return false;
    }
  }
  return true;
}

function openDB(dbname, objectStoreName, t) {
  return new Promise((resolve, reject) => {
    const openRequest = indexedDB.open(dbname);
    t.add_cleanup(() => {
      deleteDB(dbname);
    });

    openRequest.onerror = () => {
      reject(openRequest.error);
    };
    openRequest.onsuccess = () => {
      resolve(openRequest.result);
    };
    openRequest.onupgradeneeded = event => {
      openRequest.result.createObjectStore(objectStoreName);
    };
  });
}

function deleteDB(name) {
  return new Promise((resolve, reject) => {
    const deleteRequest = indexedDB.deleteDatabase(name);
    deleteRequest.onerror = () => {
      reject(deleteRequest.error);
    };
    deleteRequest.onsuccess = () => {
      resolve();
    };
  });
}

function transactionPromise(txn) {
  return new Promise((resolve, reject) => {
    txn.onabort = () => {
      reject(txn.error);
    };
    txn.oncomplete = () => {
      resolve();
    };
  });
}

promise_test(async t => {
  const estimate = await navigator.storage.estimate()
  assert_equals(typeof estimate.breakdown, 'object');
}, 'estimate() resolves to dictionary with usage breakdown member');

promise_test(async t => {
  const arraySize = 1e6;
  const objectStoreName = "storageManager";
  const dbname = self.location.pathname;

  await deleteDB(dbname);
  let estimate = await navigator.storage.estimate();
  const usageBeforeCreate = estimate.usage;
  const breakdownBeforeCreate = estimate.breakdown;

  assert_equals(usageBeforeCreate, breakdownBeforeCreate.IndexedDb,
    'breakdown should match usage before object store is created');

  const db = await openDB(dbname, objectStoreName, t);

  estimate = await navigator.storage.estimate();
  const usageAfterCreate = estimate.usage;
  const breakdownAfterCreate = estimate.breakdown;

  assert_equals(usageAfterCreate, breakdownAfterCreate.IndexedDb,
    'breakdown should match usage after object store is created.');
  assert_greater_than(
    usageAfterCreate, usageBeforeCreate,
    'estimated usage should increase after object store is created.');
  assert_true(
    objEqualsExceptForKeys(breakdownBeforeCreate, breakdownAfterCreate,
      ['IndexedDb']),
    'after create, breakdown object should remain ' +
    'unchanged aside from IndexedDb usage.');

  const txn = db.transaction(objectStoreName, 'readwrite');
  const buffer = new ArrayBuffer(arraySize);
  const view = new Uint8Array(buffer);

  for (let i = 0; i < arraySize; i++) {
    view[i] = Math.floor(Math.random() * 255);
  }

  const testBlob = new Blob([buffer], {
    type: "binary/random"
  });
  txn.objectStore(objectStoreName).add(testBlob, 1);

  await transactionPromise(txn);

  estimate = await navigator.storage.estimate();
  const usageAfterPut = estimate.usage;
  const breakdownAfterPut = estimate.breakdown;

  assert_equals(usageAfterPut, breakdownAfterPut.IndexedDb,
    'breakdown should match usage after large value is stored');
  assert_greater_than(
    usageAfterPut, usageAfterCreate,
    'estimated usage should increase after large value is stored');
  assert_true(
    objEqualsExceptForKeys(breakdownAfterCreate, breakdownAfterPut,
      ['IndexedDb']),
    'after put, breakdown object should remain unchanged ' +
    'aside from IndexedDb usage.');

  db.close();
}, 'estimate() usage breakdown reflects increase after large value is stored');
