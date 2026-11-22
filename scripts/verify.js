// Verify WickPet source on BscScan through the Etherscan V2 API.
//   ETHERSCAN_API_KEY=... node scripts/verify.js <contractAddress>
//   (NETWORK=testnet for BSC testnet)
// Get a free API key at etherscan.io (one key works for BscScan via API V2).
// If this fails, verify manually: BscScan → contract → "Verify & Publish" →
// "Solidity (Standard-Json-Input)" → upload build/WickPet.standard-input.json.
const fs = require("fs");
const path = require("path");

async function main() {
  const address = process.argv[2];
  const key = process.env.ETHERSCAN_API_KEY;
  const netName = process.env.NETWORK || "mainnet";
  const chainId = netName === "testnet" ? 97 : 56;
  if (!address || !key) throw new Error("Usage: ETHERSCAN_API_KEY=... node scripts/verify.js <address>");

  const root = path.join(__dirname, "..");
  const dep = JSON.parse(fs.readFileSync(path.join(root, `deployment.${netName}.json`), "utf8"));
  const input = fs.readFileSync(path.join(root, "build/WickPet.standard-input.json"), "utf8");

  const body = new URLSearchParams({
    module: "contract", action: "verifysourcecode", apikey: key,
    contractaddress: address, sourceCode: input, codeformat: "solidity-standard-json-input",
    contractname: "contracts/WickPet.sol:WickPet", compilerversion: dep.compiler,
    constructorArguements: dep.constructorArgs, licenseType: "3",
  });
  const api = `https://api.etherscan.io/v2/api?chainid=${chainId}`;
  const r = await (await fetch(api, { method: "POST", body })).json();
  console.log("Submit:", r.result);
  if (r.status !== "1") process.exit(1);

  for (let i = 0; i < 20; i++) {
    await new Promise((s) => setTimeout(s, 5000));
    const s = await (await fetch(`${api}&module=contract&action=checkverifystatus&guid=${r.result}&apikey=${key}`)).json();
    console.log("Status:", s.result);
    if (!/pending/i.test(s.result)) process.exit(/pass|already/i.test(s.result) ? 0 : 1);
  }
}
main().catch((e) => { console.error("❌", e.message); process.exit(1); });
