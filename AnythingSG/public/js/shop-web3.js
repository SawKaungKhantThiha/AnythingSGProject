function setStatus(element, message, isError) {
  if (!element) return;
  element.textContent = message;
  element.className = isError ? "status-block error" : "status-block success";
}

async function getAccount() {
  if (!window.ethereum) {
    throw new Error("MetaMask is not installed");
  }
  const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
  if (!accounts.length) {
    throw new Error("No accounts available in MetaMask");
  }
  return accounts[0];
}

async function getWeb3() {
  if (!window.ethereum) {
    throw new Error("MetaMask is not installed");
  }
  return new Web3(window.ethereum);
}

async function loadContract(contractName) {
  const artifactUrl = new URL(`/build/${contractName}.json`, window.location.origin);
  let response;
  try {
    response = await fetch(artifactUrl);
  } catch (error) {
    throw new Error(
      `Failed to fetch contract artifact at ${artifactUrl}. Make sure the AnythingSG server is running and /build is accessible.`
    );
  }
  if (!response.ok) {
    throw new Error(`Missing build artifact for ${contractName} at ${artifactUrl}`);
  }
  const data = await response.json();
  const web3 = await getWeb3();
  const networkId = await web3.eth.net.getId();
  const deployed = data.networks[networkId];
  if (!deployed || !deployed.address) {
    throw new Error(`${contractName} not deployed on network ${networkId}`);
  }
  return new web3.eth.Contract(data.abi, deployed.address);
}
