(async function () {
  const $btn = document.getElementById('connect');
  const $status = document.getElementById('status');

  const qs = new URLSearchParams(window.location.search);
  const uid = qs.get('uid');   // Discord user id
  const guild = qs.get('guild'); // Guild id

  function log(msg, cls = '') {
    const div = document.createElement('div');
    if (cls) div.className = cls;
    div.textContent = msg;
    $status.appendChild(div);
  }

  async function getNonce() {
    const r = await fetch('/nonce');
    const j = await r.json();
    return j.nonce;
  }

  function buildMessage(addr, nonce) {
    // Minimal signed message (non-SIWE for simplicity)
    return [
      'ENS Club Verification',
      'I authorize linking my Discord account to my wallet.',
      `Wallet: ${addr}`,
      `Nonce: ${nonce}` // 32 hex chars
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
      if (!uid || !guild) {
        throw new Error('Missing uid/guild. Please open this page from the /verify button in Discord.');
      }

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
      const r = await fetch('/verify', {
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
          log(`Found (non-matching sample): ${j.sample.join(', ')}`);
        }
      }
    } catch (err) {
      console.error(err);
      log(`Error: ${err.message || err}`, 'err');
    }
  });
})();
