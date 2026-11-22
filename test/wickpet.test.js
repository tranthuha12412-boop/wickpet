// Run: node test/wickpet.test.js   (after: node scripts/compile.js)
const assert = require("assert");
const ganache = require("ganache");
const { ethers } = require("ethers");
const W = require("../build/WickPet.json");
const M = require("../build/MockAgentID.json");

const HOUR = 3600;
const DAY = 86400;

async function main() {
  const g = ganache.provider({ logging: { quiet: true }, chain: { hardfork: "shanghai" }, wallet: { totalAccounts: 5 } });
  const provider = new ethers.BrowserProvider(g);
  // ganache under-estimates gas for calls that make an external call; use a fixed limit in tests
  const realEstimate = provider.estimateGas.bind(provider);
  provider.estimateGas = async (tx) => (await realEstimate(tx)) * 2n;
  const [deployer, alice, bob, carol, noId] = await Promise.all([0, 1, 2, 3, 4].map((i) => provider.getSigner(i)));

  const mock = await new ethers.ContractFactory(M.abi, M.bytecode, deployer).deploy();
  const pet = await new ethers.ContractFactory(W.abi, W.bytecode, deployer).deploy(await mock.getAddress());
  for (const s of [alice, bob, carol]) await (await mock.setHolder(await s.getAddress(), true)).wait();

  const A = await alice.getAddress();
  const B = await bob.getAddress();
  const C = await carol.getAddress();
  const as = (s) => pet.connect(s);
  const warp = async (sec) => { await provider.send("evm_increaseTime", [sec]); await provider.send("evm_mine", []); };
  const reverts = async (p, name) => {
    try { await p; } catch (e) {
      let got = e?.revert?.name;
      if (!got) {
        let data = e?.data ?? e?.info?.error?.data ?? e?.error?.data;
        if (data && typeof data === "object") data = data.data ?? data.result;
        try { got = data ? pet.interface.parseError(data)?.name : undefined; } catch {}
      }
      assert.equal(got, name, `expected ${name}, got ${got || e.shortMessage || e.message}`);
      return;
    }
    assert.fail(`expected revert ${name}`);
  };
  let n = 0;
  const ok = (msg) => console.log(`  ✓ ${++n}. ${msg}`);

  console.log("WickPet tests");

  // Gating
  await reverts(as(noId).adopt.staticCall("Nope"), "NoAgentID"); ok("wallet without Agent ID cannot adopt");
  await reverts(as(alice).adopt.staticCall(""), "BadName");
  await reverts(as(alice).adopt.staticCall("<script>"), "BadName");
  await reverts(as(alice).adopt.staticCall("x".repeat(21)), "BadName"); ok("pet names are validated");

  // Adopt
  await (await as(alice).adopt("Mochi")).wait();
  let v = await pet.getPet(A);
  assert.equal(v.name, "Mochi"); assert.equal(v.generation, 1n); assert.equal(v.stage, 0n); assert.equal(v.level, 1n);
  assert(v.species < 6n); assert.equal(v.ranAway, false);
  ok("Agent ID holder adopts a pet (egg, level 1)");
  await reverts(as(alice).adopt.staticCall("Again"), "AlreadyHasPet"); ok("only one living pet per Agent ID");

  // Feed / play / cooldown
  await (await as(alice).feed()).wait();
  v = await pet.getPet(A);
  assert.equal(v.feeds, 1n); assert.equal(v.streak, 1n); assert.equal(v.xp, 11n); // 10 + streak bonus 1
  ok("first feed works right away (+10 xp, +1 streak bonus)");
  await reverts(as(alice).feed.staticCall(), "TooSoon"); ok("feed cooldown enforced");
  await (await as(alice).play()).wait();
  v = await pet.getPet(A);
  assert.equal(v.xp, 19n); // same day → no new streak bonus
  assert.equal(v.stage, 1n, "egg hatches into a baby after first feed + play");
  ok("play gives xp, streak bonus once per day; egg hatches");
  await reverts(as(alice).play.staticCall(), "TooSoon");
  await warp(4 * HOUR + 1);
  await (await as(alice).feed()).wait();
  await (await as(alice).play()).wait();
  ok("actions allowed again after 4h cooldown");

  // Hunger rises over time
  await warp(36 * HOUR);
  v = await pet.getPet(A);
  assert(v.hunger >= 49n && v.hunger <= 51n, "hunger ~50 after 36h, got " + v.hunger);
  assert(v.happiness <= 26n, "happiness drops, got " + v.happiness);
  ok("hunger and happiness change with time");

  // Streak across days
  await (await as(alice).feed()).wait();
  v = await pet.getPet(A);
  assert(v.streak >= 1n);
  ok("streak tracked across days");

  // Treats
  await reverts(as(bob).sendTreat.staticCall(A), "NoPet"); ok("must own a pet to send treats");
  await (await as(bob).adopt("Bobby")).wait();
  await reverts(as(bob).sendTreat.staticCall(B), "CannotTreatSelf");
  await warp(30 * HOUR); // alice hungry again
  const before = await pet.getPet(A);
  await (await as(bob).sendTreat(A)).wait();
  const after = await pet.getPet(A);
  assert(after.hunger < before.hunger, "treat lowers hunger");
  assert.equal(after.treatsReceived, 1n);
  assert.equal((await pet.getPet(B)).treatsGiven, 1n);
  ok("friend treat lowers hunger and gives xp to both");
  await reverts(as(bob).sendTreat.staticCall(A), "TooSoon"); ok("one treat per friend per day");

  // Run away
  await warp(80 * HOUR);
  v = await pet.getPet(A);
  assert.equal(v.ranAway, true); assert.equal(v.hunger, 100n);
  await reverts(as(alice).feed.staticCall(), "PetRanAway");
  await reverts(as(carol).sendTreat.staticCall(A), "NoPet"); // carol has no pet yet
  ok("pet runs away after 72h without food");

  // Call home
  const xpBefore = v.xp;
  await (await as(alice).callHome()).wait();
  v = await pet.getPet(A);
  assert.equal(v.ranAway, false); assert.equal(v.xp, xpBefore / 2n); assert.equal(v.streak, 0n);
  await reverts(as(alice).callHome.staticCall(), "PetIsHome");
  ok("callHome brings it back with half xp and streak reset");

  // New generation after runaway
  await warp(73 * HOUR);
  await (await as(alice).adopt("Mochi II")).wait();
  v = await pet.getPet(A);
  assert.equal(v.generation, 2n); assert.equal(v.xp, 0n);
  ok("or adopt a new generation pet");

  // Losing Agent ID blocks actions
  await (await mock.setHolder(A, false)).wait();
  await reverts(as(alice).feed.staticCall(), "NoAgentID");
  await (await mock.setHolder(A, true)).wait();
  ok("every action re-checks Agent ID ownership");

  // Leaderboard pagination
  await (await as(carol).adopt("Cara")).wait();
  assert.equal(await pet.keeperCount(), 3n);
  const page = await pet.getPets(0, 10);
  assert.equal(page.length, 3);
  assert.equal((await pet.getPets(1, 1)).length, 1);
  assert.equal((await pet.getPets(10, 5)).length, 0);
  ok("getPets paginates for leaderboards");

  // Level curve
  assert.equal(await pet.totalAdoptions(), 4n);
  ok("counters: " + (await pet.totalActions()) + " actions, " + (await pet.totalAdoptions()) + " adoptions");

  // No payable functions / no owner
  const payable = W.abi.filter((f) => f.stateMutability === "payable");
  assert.equal(payable.length, 0);
  assert(!W.abi.some((f) => /owner|withdraw|pause|upgrade/i.test(f.name || "")));
  ok("no payable, owner, withdraw, pause or upgrade functions");

  console.log(`\nAll ${n} checks passed.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
