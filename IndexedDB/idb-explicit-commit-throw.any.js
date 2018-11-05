// META: script=support-promises.js

/**
 * @fileoverview This file was separated out from the rest of the idb explicit
 * commit tests because it requires the flag 'allow_uncaught_exception', which
 * prevents unintentionally thrown errors from failing tests.
 *
 * @author andreasbutler@google.com
 */

setup({allow_uncaught_exception:true});

promise_test(async testCase => {
  // Register an event listener that will prevent the intentionally thrown
  // error from bubbling up to the window and failing the testharness. This
  // is necessary because currently allow_uncaught_exception does not behave
  // as expected for promise_test.
  self.addEventListener('error', (event) => { event.preventDefault(); });

  const db = await createDatabase(testCase, async db =>{
    await createBooksStore(testCase, db);
  });

  // Intentionally throw an error in the callback of a successful put request
  // after an explicit commit has already been made.
  const txn = db.transaction(['books'], 'readwrite');
  const objectStore = txn.objectStore('books');
  const putRequest = objectStore.put({isbn:'one', title:'t1'});
  txn.commit();
  putRequest.onsuccess = () => {
    throw new Error('an error');
  }
  await promiseForTransaction(testCase, txn);

  // Ensure that despite the uncaught error after the put request, the explicit
  // commit still causes the request to be committed.
  const txn2 = db.transaction(['books'], 'readwrite');
  const objectStore2 = txn2.objectStore('books');
  const getRequest = objectStore2.get('one');
  await promiseForTransaction(testCase, txn2);

  assert_equals(getRequest.result.title, 't1');
}, 'Any errors in callbacks that run after an explicit commit will not stop '
   + 'the commit from being processed.');
