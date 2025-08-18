window.onload = () => {
  const connectBtn = document.getElementById("connectBtn");
  const statusEl = document.getElementById("status");

  connectBtn.onclick = async () => {
    try {
      statusEl.textContent = "";

      if (!window.ethereum) {
        statusEl.textContent = "MetaMask not found. Please install it.";
        return;
      }

      // Read ENS name
      const ensName = document.getElementById("ensInput").value.trim().toLowerCase();
      if (!ensName) {
        statusEl.textContent = "Please enter your ENS subdomain.";
        return;
      }
      if (!ensName.endsWith(".emperor.club.agi.eth")) {
        statusEl.textContent = "ENS must be a subdomain of emperor.club.agi.eth";
        return;
      }

      // Get discordId from query string
      const urlParams = new URLSearchParams(window.location.search);
      const discordId = urlParams.get("discordId");
      if (!discordId) {
        statusEl.textContent = "Discord ID missing in URL (?discordId=...)";
        return;
      }

      // Connect wallet
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const wallet = (await signer.getAddress()).toLowerCase();

      // --- NameWrapper token ID is the namehash of the FULL name ---
      const tokenId = ethers.namehash(ensName);

      // Sign a deterministic message (ties wallet ↔ discordId)
      const message = `Verify ENS subdomain for ${discordId}`;
      const signature = await signer.signMessage(message);

      // Call serverless verify endpoint
      const resp = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discordId, wallet, tokenId, signature, ensName })
      });

      const data = await resp.json();
      if (resp.ok && data?.success) {
        statusEl.textContent = "✅ Verified! Role granted in Discord.";
      } else {
        statusEl.textContent = "❌ Verification failed: " + (data?.error || resp.statusText);
      }
    } catch (err) {
      console.error(err);
      statusEl.textContent = "Error during verification.";
    }
  };
};
