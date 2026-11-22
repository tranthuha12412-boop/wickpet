// Compiles the contracts with solc-js and writes:
//   build/WickPet.json              -> abi + bytecode (used by deploy.js and the web app)
//   build/MockAgentID.json          -> test-only mock
//   build/WickPet.standard-input.json -> upload this on BscScan ("Solidity (Standard-Json-Input)") to verify
const fs = require("fs");
const path = require("path");
const solc = require("solc");

const root = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

function compile(sources) {
  const input = {
    language: "Solidity",
    sources,
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "paris",
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };
  const out = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (out.errors || []).filter((e) => e.severity === "error");
  (out.errors || []).forEach((e) => console.log(e.formattedMessage));
  if (errors.length) process.exit(1);
  return { input, out };
}

fs.mkdirSync(path.join(root, "build"), { recursive: true });

// Production contract (compiled alone so the verification input is clean)
const main = compile({ "contracts/WickPet.sol": { content: read("contracts/WickPet.sol") } });
const c = main.out.contracts["contracts/WickPet.sol"].WickPet;
fs.writeFileSync(
  path.join(root, "build/WickPet.json"),
  JSON.stringify({ compiler: "v" + solc.version().replace(/\.Emscripten.*$/, ""), abi: c.abi, bytecode: "0x" + c.evm.bytecode.object }, null, 2)
);
const verifyInput = { ...main.input, settings: { ...main.input.settings, outputSelection: { "*": { "*": ["*"] } } } };
fs.writeFileSync(path.join(root, "build/WickPet.standard-input.json"), JSON.stringify(verifyInput, null, 2));

// Test mock
const mock = compile({ "contracts/test/MockAgentID.sol": { content: read("contracts/test/MockAgentID.sol") } });
const m = mock.out.contracts["contracts/test/MockAgentID.sol"].MockAgentID;
fs.writeFileSync(
  path.join(root, "build/MockAgentID.json"),
  JSON.stringify({ abi: m.abi, bytecode: "0x" + m.evm.bytecode.object }, null, 2)
);

console.log("Compiled with solc", solc.version(), "→ build/");
