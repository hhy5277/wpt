// META: script=support-promises.js

/**
 * This file contains the webplatform tests for the explicit commit() method
 * of the IndexedDB transaction API.
 *
 * @author andreasbutler@google.com
 */

promise_test(async testCase => {
  const db = await createDatabase(testCase, async db => {
    await createBooksStore(testCase, db);
  });
  const txn = db.transaction(['books'], 'readwrite');
  const objectStore = txn.objectStore('books');
  objectStore.put({isbn: 'one', title: 't1'});
  objectStore.put({isbn: 'two', title: 't2'});
  objectStore.put({isbn: 'three', title: 't3'});
  txn.commit();
  await promiseForTransaction(testCase, txn);

  const txn2 = db.transaction(['books'], 'readwrite');
  const objectStore2 = txn2.objectStore('books');
  const getRequest1 = objectStore2.get('one');
  const getRequest2 = objectStore2.get('two');
  const getRequest3 = objectStore2.get('three');
  txn2.commit();
  await promiseForTransaction(testCase, txn2);
  assert_array_equals(
    [getRequest1.result.title,
        getRequest2.result.title,
        getRequest3.result.title],
    ['t1', 't2', 't3'],
    'Data put by an explicitly committed transaction should be gettable.');
}, 'Explicitly committed data can be read back out.');


promise_test(async testCase => {
  const db = await createDatabase(testCase, async db => {
    await createBooksStore(testCase, db);
  });
  const txn = db.transaction(['books'], 'readwrite');
  const objectStore = txn.objectStore('books');
  txn.commit();
  assert_throws('TransactionInactiveError',
      () => { objectStore.put({isbn: 'one', title: 't1'}); },
      'After commit is called, the transaction should be inactive.');
}, 'A committed transaction is blocked immediately.');


promise_test(async testCase => {
  const db = await createDatabase(testCase, async db => {
    await createBooksStore(testCase, db);
  });
  const txn = db.transaction(['books'], 'readwrite');
  const objectStore = txn.objectStore('books');
  const putRequest = objectStore.put({isbn: 'one', title: 't1'});
  putRequest.onsuccess = () => {
    assert_throws('TransactionInactiveError',
      () => { objectStore.put({isbn:'two', title:'t2'}); },
      'The transaction should not be active in the callback of a request after '
      + 'commit() is called.');
  };
  txn.commit();
  await promiseForTransaction(testCase, txn);
}, 'A committed transaction is blocked in future request callbacks.');


promise_test(async testCase => {
  const db = await createDatabase(testCase, async db => {
    await createBooksStore(testCase, db);
  });
  const txn = db.transaction(['books'], 'readwrite');
  const objectStore = txn.objectStore('books');
  txn.commit();

  // Try to make a putRequest with the knowledge that it will throw and then in
  // the catch body make sure nothing was put.
  try {
    const putRequest = objectStore.put({isbn:'one', title:'t1'});
    fail('Exception not thrown when calling put after a commit.');
  } catch(err) {
    const txn2 = db.transaction(['books'], 'readonly');
    const objectStore2 = txn2.objectStore('books');
    const getRequest = objectStore2.get('one');
    await promiseForTransaction(testCase, txn2);
    assert_equals(getRequest.result, undefined);
  }
}, 'Puts issued after commit do not put anything.');


promise_test(async testCase => {
  const db = await createDatabase(testCase, async db => {
    await createBooksStore(testCase, db);
  });
  const txn = db.transaction(['books'], 'readwrite');
  const objectStore = txn.objectStore('books');
  txn.abort();
  assert_throws('InvalidStateError',
      () => { txn.commit(); },
      'The transaction should have been aborted.');
}, 'Calling commit on an aborted transaction throws.');


promise_test(async testCase => {
  const db = await createDatabase(testCase, async db => {
    await createBooksStore(testCase, db);
  });
  const txn = db.transaction(['books'], 'readwrite');
  const objectStore = txn.objectStore('books');
  txn.commit();
  assert_throws('InvalidStateError',
      () => { txn.commit(); },
      'The transaction should have already committed.');
}, 'Calling commit on a committed transaction throws.');


promise_test(async testCase => {
  const db = await createDatabase(testCase, async db => {
    await createBooksStore(testCase, db);
  });
  const txn = db.transaction(['books'], 'readwrite');
  const objectStore = txn.objectStore('books');
  const putRequest = objectStore.put({isbn:'one', title:'t1'});
  txn.commit();
  assert_throws('InvalidStateError',
      () => { txn.abort(); },
      'The transaction should already have committed.');
  const txn2 = db.transaction(['books'], 'readwrite');
  const objectStore2 = txn2.objectStore('books');
  const getRequest = objectStore2.get('one');
  await promiseForTransaction(testCase, txn2);
  assert_equals(
      getRequest.result.title,
      't1',
      'Expected the result to be retrievable');
}, 'Calling abort on a committed transaction throws and data is still '
   + 'committed.');


promise_test(async testCase => {
  return new Promise(async (resolve,reject) => {
    const db = await createDatabase(testCase, async db => {
      await createBooksStore(testCase, db);
    });
    const txn = db.transaction(['books'], 'readwrite');
    const objectStore = txn.objectStore('books');
    const releaseTxnFunction = keep_alive(txn, 'books');

    // Use an error-wrapping promise to catch any errors thrown in the body of
    // the setTimeout() task.
    const errorWrappingPromise = new Promise((resolve, reject) => {
      // Use setTimeout() to register a microtask the body of which we can be
      // certain runs after the transaction has transitioned into an inactive
      // state.
      setTimeout(() => {
        try {
          assert_throws('InvalidStateError',
              () => { txn.commit(); },
              'The transaction should be inactive so commit should be '
              + 'uncallable.');
          releaseTxnFunction();
          resolve();
        } catch(err) {
          releaseTxnFunction();
          reject(err);
        }
      }, 0);
    });
    errorWrappingPromise
        .then(result => { resolve(); })
        .catch(err => { reject(err); });
  });
}, 'Calling txn.commit() when txn is inactive should throw.');
