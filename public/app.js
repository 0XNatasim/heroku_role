(async function () {
  const $btn = document.getElementById('connect');
  const $status = document.getElementById('status');
  const $mmHelp = document.getElementById('mm-help');
  const $mmOpen = document.getElementById('open-in-metamask');

  const qs = new URLSearchParams(window.location.search);
  const uid = qs.get('uid');     // Discord user id
  const guild = qs.get('guild'); // Discord guild id

  function log(msg, cls='') {
    const div = document.createElement('div');
    if (cls) div.className = cls;
    div.textContent = msg;
    $status.appendChild(div);
  }

  function buildMetaMaskDeepLink() {
    const fullUrl = window.location.href; // includes query with uid/guild
    const noProto = fullUrl.replace(/^https?:\/\//, '');
    return `https://metamask.app.link/dapp/${noProto}`;
  }

  // If no injected provider, show MetaMask open button (mobile)
  if (typeof window.ethereum === 'undefined') {
    $mmHelp.style.display = 'block';
    if ($mmOpen) {
      $mmOpen.addEventListener('click', () => {
        window.location.href = buildMetaMaskDeepLink();
      });
    }
  }

  async function getNonce() {
    const r = await fetch('/nonce');
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
    if (!window.ethereum) throw new Error('MetaMask not found. Please open in MetaMask (use the button above).');
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    if (!accounts || !accounts[0]) throw new Error('No account returned by MetaMask.');
    return accounts[0];
  }

  $btn.addEventListener('click', async () => {
    try {
      $status.innerHTML = '';
      if (!uid || !guild) throw new Error('Missing uid/guild. Open this page from /verify in Discord.');

      log('Connecting MetaMask…');
      const address = await requestAccounts();
      log(`Connected: ${address}`);

      log('Fetching nonce…');
      const nonce = await getNonce();
      log(`Nonce: ${nonce}`);

      const message = buildMessage(address, nonce);
      log('Signing message…');
      const signature = await window.ethereum.request({
        method: 'personal_sign',
        params: [message, address]
      });

      log('Verifying on server…');
      const r = await fetch('/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, signature, uid, guild })
      });
      const j = await r.json();

      if (j.ok) {
        const names = Array.isArray(j.sample) && j.sample.length ? j.sample.join(', ') : '';
        log(`Success! Found ${j.matched} matching (${names})  Roles "Club Member" granted.`, 'ok');
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
