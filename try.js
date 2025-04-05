const PINATA_API_KEY = 'a456c69f1da325f277a8';
const PINATA_SECRET_API_KEY = 'b75da41611e039df09c13d3789b862ed8dfae4280a0737734f505d009f5e822e';
const CONTRACT_ADDRESS = '0x7Fb86B4e7fE2cc358a734Cd4F9cD29D3f596a88a';


const ABI = [
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "_cid",
				"type": "string"
			},
			{
				"internalType": "uint256",
				"name": "_unlockTime",
				"type": "uint256"
			}
		],
		"name": "lockFile",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"name": "files",
		"outputs": [
			{
				"internalType": "string",
				"name": "cid",
				"type": "string"
			},
			{
				"internalType": "uint256",
				"name": "unlockTime",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "user",
				"type": "address"
			}
		],
		"name": "getUnlockTime",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "retrieveFile",
		"outputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"stateMutability": "view",
		"type": "function"
	}
];

let web3, contract, account;

document.getElementById("connectWallet").onclick = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        web3 = new Web3(window.ethereum);
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        const accounts = await web3.eth.getAccounts();
        account = accounts[0];
        document.getElementById("walletAddress").textContent = `Wallet: ${account}`;
        contract = new web3.eth.Contract(ABI, CONTRACT_ADDRESS);
        notify("✅ Wallet connected!", "success");
      } catch (err) {
        notify("❌ Wallet connection denied!", "error");
        console.error(err);
      }
    } else {
      // 🔁 MetaMask not installed - show popup
      const installConfirmed = confirm("🦊 MetaMask is not installed!\nWould you like to install it now?");
      if (installConfirmed) {
        // Redirect user to MetaMask installation page
        window.open("https://metamask.io/download.html", "_blank");
      } else {
        notify("⚠️ MetaMask is required to continue!", "warn");
      }
    }
};
  

document.getElementById("lockFile").onclick = async () => {
    const fileInput = document.getElementById("fileInput").files[0];
    const unlockInput = document.getElementById("unlockTime").value;
  
    if (!fileInput || !unlockInput) {
      notify("⚠️ Please upload a file and select unlock time!", "warn");
      return;
    }
  
    const unlockTime = Math.floor(new Date(unlockInput).getTime() / 1000);
    const now = Math.floor(Date.now() / 1000);
  
    if (unlockTime <= now) {
      notify("⚠️ Unlock time must be in the future!", "warn");
      return;
    }
  
    notify("🔐 Encrypting file...", "info");
  
    try {
      // Generate AES key
      const aesKey = CryptoJS.lib.WordArray.random(16).toString(); // 128-bit key
      const reader = new FileReader();
  
      reader.onload = async (e) => {
        const fileContent = e.target.result;
        const encrypted = CryptoJS.AES.encrypt(fileContent, aesKey).toString();
  
        const blob = new Blob([encrypted], { type: "text/plain" });
        const formData = new FormData();
        formData.append('file', blob, "encrypted_file.txt");
  
        alert("🔐 Your decryption key (save it safely!):\n\n" + aesKey);
  
        notify("⏫ Uploading encrypted file to IPFS...", "info");
  
        const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
          method: "POST",
          headers: {
            pinata_api_key: PINATA_API_KEY,
            pinata_secret_api_key: PINATA_SECRET_API_KEY,
          },
          body: formData,
        });
  
        const result = await response.json();
  
        if (!result.IpfsHash) {
          throw new Error("❌ Failed to upload to Pinata");
        }
  
        const cid = result.IpfsHash;
  
        notify("📦 Storing CID on blockchain and locking...", "info");
  
        await contract.methods.lockFile(cid, unlockTime).send({ from: account });
  
        notify("✅ File encrypted, stored, and locked!", "success");
        startCountdown(unlockTime);
      };
  
      reader.readAsText(fileInput);
    } catch (err) {
      console.error(err);
      notify("❌ Error locking file: " + err.message, "error");
    }
};




document.getElementById("retrieveFile").onclick = async () => {
    try {
      const fileData = await contract.methods.files(account).call();
      const currentTime = Math.floor(Date.now() / 1000);
  
      if (!fileData.cid || fileData.cid === "") {
        notify("⚠️ No file locked yet for this wallet!", "warn");
        return;
      }
  
      if (currentTime < fileData.unlockTime) {
        const readableTime = new Date(fileData.unlockTime * 1000).toLocaleString();
        notify(`⏳ File is still locked! Try again after: ${readableTime}`, "warn");
        return;
      }
  
      let userKey = prompt("🔑 Enter your decryption key (exactly as shown):");
      if (!userKey || userKey.trim() === "") {
        notify("❌ Decryption key is required!", "error");
        return;
      }
  
      const url = `https://gateway.pinata.cloud/ipfs/${fileData.cid}`;
      const response = await fetch(url);
      const encryptedText = await response.text();
  
      try {
        const decrypted = CryptoJS.AES.decrypt(encryptedText, userKey);
        const decryptedText = decrypted.toString(CryptoJS.enc.Utf8);
  
        if (!decryptedText) {
          throw new Error("Decryption failed or incorrect key");
        }
  
        const blob = new Blob([decryptedText], { type: "text/plain" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "decrypted_file.txt";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
  
        notify("🎉 File decrypted and downloaded successfully!", "success");
      } catch (err) {
        console.error(err);
        notify("❌ Decryption failed: Incorrect key or corrupted file", "error");
      }
    } catch (err) {
      console.error(err);
      notify("❌ Retrieval/Decryption failed: " + err.message, "error");
    }
};
  
/*function notify(message, type = "info") {
  const resultDiv = document.getElementById("result");
  const color = type === "error" ? "red" : type === "warn" ? "#FFA500" : type === "success" ? "green" : "#007bff";
  resultDiv.innerHTML = `<div style="margin-top: 10px; color: ${color}; font-weight: 600;">${message}</div>`;
}*/

const notify = (message, type = "info") => {
    const notificationElement = document.getElementById("notification");
    if (notificationElement) {
        notificationElement.innerText = message;
        notificationElement.className = type; // Assuming you have CSS for styling
    } else {
        console.warn("Notification element not found:", message);
        }
};

function startCountdown(unlockTime) {
  const timerEl = document.getElementById("timer");
  const interval = setInterval(() => {
    const now = Math.floor(Date.now() / 1000);
    const remaining = unlockTime - now;

    if (remaining > 0) {
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      timerEl.textContent = `⏳ Time left: ${mins}m ${secs}s`;
    } else {
      clearInterval(interval);
      timerEl.textContent = "✅ File is now ready for retrieval!";
    }
  }, 1000);
}
