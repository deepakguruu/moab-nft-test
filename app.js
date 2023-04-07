const contractAddress = "0x5014D007e32cc97CC60bE08a4032F00fD1839767";
const contractABI =[
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "_numShares",
				"type": "uint256"
			}
		],
		"name": "mint",
		"outputs": [],
		"stateMutability": "payable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "_numShares",
				"type": "uint256"
			}
		],
		"name": "sell",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "account",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "id",
				"type": "uint256"
			}
		],
		"name": "balanceOf",
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
		"name": "isContractActive",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "MINT_PRICE",
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
		"inputs": [
			{
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			}
		],
		"name": "canAccessAmount",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	}
];

const usdtContractAddress = "0xB844dEb4B250db47BB1D59Fe832Bb3A29999326a";
const usdtContractABI = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_spender",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "_value",
        "type": "uint256"
      }
    ],
    "name": "approve",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {
        "name": "_owner",
        "type": "address"
      }
    ],
    "name": "balanceOf",
    "outputs": [
      {
        "name": "balance",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  }
];

let provider;
let ethersProvider;
const targetNetwork = 97;
let signer;
let contract;
let usdtContract;
let connectedWallet;
let isWalletConnected = false;
let firstLoad=true;
let shareBalance;
let walletBalance;
let mintPrice;

const connectWalletBtn = document.getElementById("connect-wallet-btn");
const disconnectWalletBtn = document.getElementById("disconnect-wallet-btn");

async function walletChanged(){
  if(isWalletConnected){
    await loadProvider();
    if(provider){
      await switchNetwork();
      await refreshContracts();
    }
  }
  updateWalletButtons();
  updateUI();
}

async function updateUI() {
  console.log("updating UI");
  refreshMintPrice();
  refreshShareBalances();
  refreshWalletBalance();
}

function convertWeiToEther(value, decimal){
  return (value/Math.pow(10,18)).toFixed(decimal);
}

async function refreshShareBalances(){
  if (isWalletConnected) {
    shareBalance = await contract.balanceOf(signer.getAddress(), 0);
    document.getElementById("balance").textContent = shareBalance.toString();
    updateMaxSellValue();
  }else{
    document.getElementById("balance").textContent = "-";
  }
}

async function refreshWalletBalance(){
  if (isWalletConnected) {
    walletBalance = await usdtContract.balanceOf(signer.getAddress());
    document.getElementById("wallet-balance").textContent = convertWeiToEther(walletBalance, 2).toString();
    updateMaxBuyValue();
  }else{
    document.getElementById("wallet-balance").textContent = "-";
  }
}

async function refreshMintPrice(){
  if (isWalletConnected) {
    mintPrice = await contract.MINT_PRICE();
    document.getElementById("mintPrice").textContent = ethers.utils.formatEther(mintPrice);
  }
}

function updateMaxSellValue(){
  document.getElementById("numSharesSell").max=shareBalance;
}

function updateMaxBuyValue(){
  document.getElementById("numShares").max=Math.floor(walletBalance / mintPrice);
} 

async function mint() {
  if (!isWalletConnected) {
    showAlert("Error!!!", "Please connect your wallet first.");
    return;
  }
  let contractActive = await contract.isContractActive();
  if (!contractActive) {
    showAlert("Error!!!", "Minting not enabled.");
    return;
  }
  const numShares = Number(document.getElementById("numShares").value);
  const mintPrice = await contract.MINT_PRICE();
  const value = mintPrice.mul(numShares);
  if(numShares<=0){
    showAlert("Invalid Input!", "Number of shares to mint must be greater than 0 !");
    return;
  }
  let canAccessAmount = await contract.canAccessAmount(value);
  if (!canAccessAmount) {
    const alertmsg = "Please approve the transaction to allow the contract to access "+convertWeiToEther(value, 2)+" USDT for minting "+numShares+" shares.";
    showLoadingModal(alertmsg);
    await approve(value);
  }
  showLoadingModal("Please approve the transaction to mint "+numShares+" shares.");
  const tx = await contract.mint(numShares);
  const res = await tx.wait();
  hideLoadingModal();
  await updateUI();
}

async function approve(amount) {
  if (!isWalletConnected) return;
  const tx = await usdtContract.approve(contractAddress, amount);
  await tx.wait();
}

async function sell() {
  if (!isWalletConnected) {
    showAlert("Error!!!", "Please connect your wallet first.");
    return;
  }
  const numShares = Number(document.getElementById("numSharesSell").value);
  if(numShares<=0){
    showAlert("Invalid Input!", "Number of shares to sell must be greater than 0 !");
    return;
  }
  if(numShares>shareBalance){
    const alertmsg = "You have only "+shareBalance+" shares in your wallet!";
    showAlert("Insufficient balance!", alertmsg);
    return;
  }
  showLoadingModal("Please approve the transaction to sell "+numShares+" shares.");
  const tx = await contract.sell(numShares);
  await tx.wait();
  hideLoadingModal();
  await updateUI();
}

async function connectWallet() {
  try {
    isWalletConnected = true;
    await walletChanged();
  } catch (err) {
    console.error(err);
    alert("Could not connect to wallet. Please try again.");
  }
}

function updateWalletButtons(){
  if(isWalletConnected){
    disconnectWalletBtn.innerHTML = connectedWallet.slice(0, 6) + "..." + connectedWallet.slice(-4);
    connectWalletBtn.style.display="none";
    disconnectWalletBtn.style.display="";
  }else{
    disconnectWalletBtn.innerHTML ="Disconnect"
    connectWalletBtn.style.display="";
    disconnectWalletBtn.style.display="none";
  }
    
}

async function refreshContracts(){
  const accounts = await provider.request({ method: "eth_requestAccounts" });
  connectedWallet = accounts[0];
  signer = ethersProvider.getSigner();
  contract = new ethers.Contract(contractAddress, contractABI, signer);
  usdtContract = new ethers.Contract(usdtContractAddress, usdtContractABI, signer);
}

async function disconnectWallet() {
  isWalletConnected = false;
  connectedWallet=null;
  await walletChanged();
}

async function loadProvider(){
  provider = await detectEthereumProvider();
  if (provider) {
    ethersProvider = new ethers.providers.Web3Provider(provider);
    provider.on('accountsChanged',  walletChanged);
    window.ethereum.on('networkChanged', networkChanged);
  } else {
    alert('Provider not found');
  }
}

async function networkChanged(networkId){
  console.log('networkChanged',networkId);
  if(networkId!=targetNetwork){
    await disconnectWallet();
  }
};

async function switchNetwork() {
  try {
    // Get the current network from Metamask
    const currentNetwork = await ethereum.request({ method: "eth_chainId" });

    // Check if we are already on the target network
    if (currentNetwork === targetNetwork) {
      console.log(`Already on network ${network}`);
      return;
    }

    // Switch to the target network
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: `0x${targetNetwork.toString(16)}` }],
    });

    console.log(`Switched to network`);
    await loadProvider();
  } catch (error) {
    console.error(error);
    alert(`Failed to switch to network ${targetNetwork}`);
  }
}


window.addEventListener("load", () => {
    console.log("onload");
    // Connect wallet button
    connectWalletBtn.addEventListener("click", connectWallet);
    disconnectWalletBtn.addEventListener("click", disconnectWallet);

    const mintButton = document.getElementById("mintBtn");
    mintButton.addEventListener("click", mint);

    const sellButton = document.getElementById("sellBtn");
    sellButton.addEventListener("click", sell);

});

const loadingModalMessage = document.querySelector('.loading-modal-message');

function showLoadingModal(message) {
  var modal = document.getElementById("loading-modal");
  loadingModalMessage.innerHTML=message;
  modal.style.display = "block";
}

function hideLoadingModal() {
  var modal = document.getElementById("loading-modal");
  modal.style.display = "none";
}

const alertModalClose = document.querySelector('.alert-close');
const alertModal = document.getElementById('alertModal');
const alertModalTitle = document.querySelector('.alert-modal-title');
const alertModalMessage = document.querySelector('.alert-modal-message');
// When the user clicks the button, show the modal
function showAlert(title, message) {
  alertModal.style.display = 'block';
  alertModalTitle.innerHTML=title;
  alertModalMessage.innerHTML=message;
}

// When the user clicks on <span> (x), hide the modal
  alertModalClose.onclick = function() {
    alertModal.style.display = 'none';
  }

// When the user clicks anywhere outside of the modal, hide it
window.onclick = function(event) {
  if (event.target == alertModal) {
    alertModal.style.display = 'none';
  }
}