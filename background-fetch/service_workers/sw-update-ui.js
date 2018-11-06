importScripts('/resources/testharness.js')
importScripts('sw-helpers.js');

async function updateUI(event) {
  let updateParams = [];
  switch (event.registration.id) {
    case 'update-once':
      updateParams = [{title: 'Title1'}];
      break;
    case 'update-twice':
      updateParams = [{title: 'Title1'}, {title: 'Title2'}];
      break;
  }

  return Promise.all(updateParams.map(param => event.updateUI(param)))
           .then(() => 'update success')
           .catch(e => e.message);
}

self.addEventListener('backgroundfetchsuccess', event => {
  if (event.registration.id === 'update-inactive') {
    // Wait 1ms before calling updateUI from the inactive event.
    new Promise(r => step_timeout(r, 1))
        .then(() => event.updateUI({title: 'New title'}))
        .catch(e => sendMessageToDocument({ type: event.type, update: e.message }));
    return;
  }

  event.waitUntil(updateUI(event)
      .then(update => sendMessageToDocument({ type: event.type, update })));
});
