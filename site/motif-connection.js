(function () {
  'use strict';
  const box = document.querySelector('#sfMotifConnection');
  if (!box) return;
  const status = document.querySelector('#sfMotifStatus');
  const connect = document.querySelector('#sfMotifConnect');
  const retry = document.querySelector('#sfMotifRetry');
  const disconnect = document.querySelector('#sfMotifDisconnect');
  const queue = [];
  let linked = false;
  let saving = false;

  function render(message) {
    box.hidden = false;
    status.textContent = message;
    connect.hidden = linked;
    disconnect.hidden = !linked;
    retry.hidden = !linked || !queue.length || saving;
  }

  function request(op, options) {
    return fetch('/api/motif-library?op=' + op, { cache: 'no-store', referrerPolicy: 'same-origin', ...options });
  }

  const ready = (async () => {
    const fragment = new URLSearchParams(location.hash.slice(1));
    if (fragment.has('motif-link')) {
      const code = fragment.get('motif-link');
      history.replaceState(history.state, '', location.pathname + location.search);
      render('Connecting this browser to My Motifs…');
      try {
        const response = await request('link', { method: 'POST', body: code });
        if (!response.ok) throw Error();
        linked = true;
        render('My Motifs connected. New embroidery designs save automatically.');
      } catch {
        render('Connection expired or unavailable. Open My Motifs in Design Editor for a fresh link.');
      }
      return;
    }
    try {
      const response = await request('connection');
      if (!response.ok) return;
      const connection = await response.json();
      if (!connection.available) return;
      linked = connection.linked === true;
      render(linked ? 'My Motifs connected. New embroidery designs save automatically.' : 'Save new embroidery designs to your private library.');
    } catch {}
  })();

  async function saveQueue() {
    if (!linked || saving || !queue.length) return;
    saving = true;
    render('Saving to My Motifs…');
    let message = 'Saved to My Motifs.';
    try {
      while (linked && queue.length) {
        const job = queue[0];
        const response = await request(job.legacy ? 'save-legacy' : 'save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/zip', 'X-Motif-Name': encodeURIComponent(job.name.slice(0, 100)) },
          body: job.bytes
        });
        if (response.status === 401) {
          linked = false;
          message = 'Reconnect My Motifs to save your designs.';
          break;
        }
        if (!response.ok) throw Error();
        queue.shift();
      }
    } catch {
      message = 'My Motifs could not save this design. Retry here, or use the downloaded ZIP.';
    } finally {
      saving = false;
      render(message);
    }
  }

  window.addEventListener('stitchforge:motif-ready', async event => {
    await ready;
    if (!linked || !event.detail?.bytes) return;
    if (queue.length >= 6) {
      render('My Motifs has pending saves. This design is available as a downloaded ZIP.');
      return;
    }
    queue.push(event.detail);
    await saveQueue();
  });
  retry.addEventListener('click', saveQueue);
  disconnect.addEventListener('click', async () => {
    if (saving) return;
    try {
      const response = await request('disconnect', { method: 'POST' });
      if (!response.ok) throw Error();
      linked = false;
      queue.length = 0;
      render('This browser is disconnected from My Motifs.');
    } catch {
      render('Could not disconnect. Try again.');
    }
  });
})();
