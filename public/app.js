(async function () {
  const $btn = document.getElementById('connect');
  const $status = document.getElementById('status');

  const qs = new URLSearchParams(window.location.search);
  const uid = qs.get('uid');
  const guild = qs.get('guild');

  function log(msg, cls = '') {
    const div = document.createElement('div');
    if (cls) div.className = cls;
    div.textContent = msg;
    $status.appendChild(div);
  }

  async function getNonce() {
    const r = await fetch('/api/nonce');
    if (!r.ok) throw new Error('Nonce fetch failed');
    const j = await r.json();
    return j.nonce;
  }

  function buildMessage(addr, nonce) {
    return [
      'ENS Club Verification',
      'I authorize linking my Discord account to my wallet.',
      `Wallet: ${addr}`,
      `Nonce: ${nonce}`
    ].join('\n');
  }

  async function requestAccounts() {
    if (!window.ethereum) throw new Error('MetaMask not found. Please install it.');
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    if (!accounts || !accounts[0]) throw new Error('No account returned by MetaMask.');
    return accounts[0];
  }

  $btn.addEventListener('click', async () => {
    try {
      $status.innerHTML = '';
      if (!uid || !guild) throw new Error('Missing uid/guild. Open this page from /verify in Discord.');

      log('Connecting MetaMask...');
      const address = await requestAccounts();
      log(`Connected: ${address}`);

      log('Fetching nonce...');
      const nonce = await getNonce();
      log(`Nonce: ${nonce}`);

      const message = buildMessage(address, nonce);
      log('Signing message...');
      const signature = await window.ethereum.request({
        method: 'personal_sign',
        params: [message, address]
      });

      log('Verifying on server...');
      const r = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, signature, uid, guild })
      });
      const j = await r.json();

      if (j.ok) {
        log(`Success! Matched ${j.matched} subdomain(s). Role granted.`, 'ok');
      } else {
        log(`No match. ${j.error || 'You do not own a required subdomain.'}`, 'err');
        if (Array.isArray(j.sample) && j.sample.length) {
          log(`Found (sample): ${j.sample.join(', ')}`);
        }
      }
    } catch (err) {
      console.error(err);
      log(`Error: ${err.message || err}`, 'err');
    }
  });
})();
