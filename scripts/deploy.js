// Deploy WickPet.
//
//   Mainnet (real Agent ID contract):
//     PRIVATE_KEY=0x... node scripts/deploy.js
//
//   Testnet rehearsal (deploys a test Agent ID mock and marks your wallet as a holder):
//     PRIVATE_KEY=0x... NETWORK=testnet node scripts/deploy.js
//
// Use a fresh deployer wallet holding only a little BNB for gas. Never commit your key.
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const AGENT_ID_MAINNET = "0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F";
const NETS = {
  mainnet: { rpc: process.env.RPC || "https://bsc-dataseed.bnbchain.org", chainId: 56, explorer: "https://bscscan.com" },
  testnet: { rpc: process.env.RPC || "https://bsc-testnet-dataseed.bnbchain.org", chainId: 97, explorer: "https://testnet.bscscan.com" },
};

async function main() {
  const netName = process.env.NETWORK || "mainnet";
  const net = NETS[netName] && { ...NETS[netName], ...(process.env.CHAIN_ID ? { chainId: Number(process.env.CHAIN_ID) } : {}) };
  if (!net) throw new Error("NETWORK must be mainnet or testnet");
  if (!process.env.PRIVATE_KEY) throw new Error("Set PRIVATE_KEY");

  const root = path.join(__dirname, "..");
  const W = JSON.parse(fs.readFileSync(path.join(root, "build/WickPet.json"), "utf8"));
  const provider = new ethers.JsonRpcProvider(net.rpc, net.chainId);
  const key = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const wallet = new ethers.NonceManager(key); // keeps nonces in order even on load-balanced RPCs
  wallet.address = key.address;
  const bal = await provider.getBalance(wallet.address);
  console.log(`Network: ${netName} (${net.chainId})\nDeployer: ${wallet.address}\nBalance: ${ethers.formatEther(bal)} BNB`);
  if (bal === 0n) throw new Error("Deployer has no BNB for gas");

  let agentId = AGENT_ID_MAINNET;
  if (netName === "testnet") {
    const M = JSON.parse(fs.readFileSync(path.join(root, "build/MockAgentID.json"), "utf8"));
    const mock = await new ethers.ContractFactory(M.abi, M.bytecode, wallet).deploy();
    await mock.waitForDeployment();
    agentId = await mock.getAddress();
    await (await mock.setHolder(wallet.address, true)).wait();
    console.log(`Test Agent ID mock: ${agentId} (your wallet is marked as a holder)`);
    console.log(`  Give a tester an "Agent ID": call setHolder(<address>, true) on the mock.`);
  }

  const factory = new ethers.ContractFactory(W.abi, W.bytecode, wallet);
  const pet = await factory.deploy(agentId);
  console.log(`Deploying WickPet… tx ${pet.deploymentTransaction().hash}`);
  await pet.waitForDeployment();
  const address = await pet.getAddress();
  const ctorArgs = ethers.AbiCoder.defaultAbiCoder().encode(["address"], [agentId]).slice(2);

  console.log(`\n✅ WickPet deployed: ${address}`);
  console.log(`   ${net.explorer}/address/${address}`);
  console.log(`\nVerify on BscScan (Standard-Json-Input):`);
  console.log(`   compiler: ${W.compiler}  · optimizer: yes, 200 runs · EVM: paris · license: MIT`);
  console.log(`   file: build/WickPet.standard-input.json`);
  console.log(`   constructor arguments (ABI-encoded): ${ctorArgs}`);
  console.log(`   or run: ETHERSCAN_API_KEY=... NETWORK=${netName} node scripts/verify.js ${address}`);

  // Write the address into the web app config
  const htmlPath = path.join(root, "docs/index.html");
  let html = fs.readFileSync(htmlPath, "utf8");
  html = html.replace(/contract: "[^"]*",/, `contract: "${address}",`);
  html = html.replace(/chainId: \d+,/, `chainId: ${net.chainId},`);
  html = html.replace(/rpc: "[^"]*",/, `rpc: "${net.rpc}",`);
  html = html.replace(/explorer: "[^"]*",/, `explorer: "${net.explorer}",`);
  fs.writeFileSync(htmlPath, html);
  fs.writeFileSync(path.join(root, `deployment.${netName}.json`), JSON.stringify({ address, agentId, chainId: net.chainId, deployer: wallet.address, constructorArgs: ctorArgs, compiler: W.compiler, at: new Date().toISOString() }, null, 2));
  console.log(`\ndocs/index.html now points to ${address}. Saved deployment.${netName}.json`);
}

main().catch((e) => { console.error("❌", e.shortMessage || e.message); process.exit(1); });
