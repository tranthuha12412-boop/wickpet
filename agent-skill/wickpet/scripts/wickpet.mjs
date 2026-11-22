#!/usr/bin/env node
// WickPet helper for AI agents. No private keys, no signing: it only reads state
// and prints unsigned transaction data for the user's wallet to confirm.
//   node wickpet.mjs status <address>
//   node wickpet.mjs tx feed | play | callhome | treat <friend> | adopt "<name>"
// Env: WICKPET_ADDRESS (contract), BSC_RPC (default public BSC RPC)
const CONTRACT = process.env.WICKPET_ADDRESS || "WICKPET_ADDRESS";
const RPC = process.env.BSC_RPC || "https://bsc-dataseed.bnbchain.org";
const SPECIES = ["Bull", "Bear", "Whale", "Frog", "Cat", "Dragon"];
const STAGES = ["Egg", "Baby", "Teen", "Adult", "Legend"];

const hex = (n) => BigInt(n).toString(16).padStart(64, "0");
const addr = (a) => { if (!/^0x[0-9a-fA-F]{40}$/.test(a || "")) throw new Error("bad address: " + a); return a.slice(2).toLowerCase().padStart(64, "0"); };
function encString(s) {
  const b = Buffer.from(s, "utf8");
  return hex(32) + hex(b.length) + b.toString("hex").padEnd(Math.ceil(b.length / 32) * 64 || 64, "0");
}

async function call(data) {
  const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: CONTRACT, data }, "latest"] }) });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message);
  return j.result.slice(2);
}

async function status(who) {
  const has = BigInt("0x" + (await call("0x7962913a" + addr(who)) || "0")); // hasPet(address)
  if (!has) return { keeper: who, hasPet: false };
  const out = await call("0xeee24570" + addr(who)); // getPet(address)
  const w = (i) => BigInt("0x" + out.slice(64 + i * 64, 128 + i * 64)); // skip tuple offset word
  const now = Math.floor(Date.now() / 1000);
  const nameOff = Number(w(1)) / 32, nameLen = Number(w(nameOff));
  const name = Buffer.from(out.slice(64 + (nameOff + 1) * 64, 64 + (nameOff + 1) * 64 + nameLen * 2), "hex").toString("utf8");
  const nextFeedAt = Number(w(19)), nextPlayAt = Number(w(20));
  return {
    keeper: who, hasPet: true, name, species: SPECIES[Number(w(2))], generation: Number(w(3)),
    xp: Number(w(7)), level: Number(w(8)), stage: STAGES[Number(w(9))], hunger: Number(w(10)), happiness: Number(w(11)),
    ranAway: w(12) === 1n, streak: Number(w(17)), bestStreak: Number(w(18)),
    canFeedNow: now >= nextFeedAt, canPlayNow: now >= nextPlayAt,
    nextFeedAt: new Date(nextFeedAt * 1000).toISOString(), nextPlayAt: new Date(nextPlayAt * 1000).toISOString(),
  };
}

function tx(action, arg) {
  const data = {
    feed: () => "0x37a7b7d8",
    play: () => "0x93e84cd9",
    callhome: () => "0x96c6a161",
    treat: () => "0x8ebd4a80" + addr(arg),
    adopt: () => { if (!/^[A-Za-z0-9 ._-]{1,20}$/.test(arg || "")) throw new Error("name: 1-20 chars, letters/numbers/space . - _"); return "0x566fc123" + encString(arg); },
  }[action];
  if (!data) throw new Error("unknown action " + action);
  return { chainId: 56, to: CONTRACT, data: data(), value: "0", note: "Show to the user and wait for confirmation before submitting." };
}

const [cmd, a, b] = process.argv.slice(2);
try {
  if (cmd === "status") console.log(JSON.stringify(await status(a), null, 2));
  else if (cmd === "tx") console.log(JSON.stringify(tx(a, b), null, 2));
  else console.log("usage: wickpet.mjs status <address> | tx feed|play|callhome|treat <friend>|adopt <name>");
} catch (e) { console.error("error:", e.message); process.exit(1); }
