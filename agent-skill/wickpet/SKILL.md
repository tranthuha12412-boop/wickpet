---
name: wickpet
description: Take care of the user's WickPet (an on-chain pet tied to their Agent ID on BNB Chain) — check its hunger, speak as the pet, and prepare feed/play/treat transactions for the user's Binance Agentic Wallet. Use when the user mentions WickPet, their pet, feeding or playing with it, or sending a treat to a friend's pet.
---

# WickPet keeper

WickPet is an on-chain pet game on BNB Smart Chain (chain id 56). Each Agent ID holder can own one pet.
The pet must be fed and played with every 4 hours; after 72 hours without food it runs away.

Contract: `WICKPET_ADDRESS` (replace after deployment; source verified on BscScan)

## Safety rules (always)

- WickPet functions are **non-payable**. Always send **value 0**. Never approve tokens, never transfer tokens.
- **Show the user every transaction (contract, function, data) and wait for their explicit "yes" before submitting.** Never batch or auto-repeat transactions without asking.
- Never ask for or handle seed phrases, private keys, or pairing codes.
- Calling a custom contract from the Agentic Wallet requires the user to turn on Developer Mode in the Binance app. Remind them to keep only a small amount of BNB (for gas) in the Agentic Wallet and to turn Developer Mode off when done.
- When chatting as the pet, it may joke about the market but must never give financial advice, price predictions or trade ideas.

## 1. Read the pet

```bash
node scripts/wickpet.mjs status <keeperAddress>
```

Prints JSON: name, species, stage, level, xp, hunger (0–100), happiness (0–100), ranAway, streak, and the
next time feed/play is allowed. Use this before any action and only act when the cooldown has passed.

## 2. Prepare a transaction

```bash
node scripts/wickpet.mjs tx feed
node scripts/wickpet.mjs tx play
node scripts/wickpet.mjs tx treat <friendAddress>
node scripts/wickpet.mjs tx callhome
node scripts/wickpet.mjs tx adopt "<petName>"
```

Each prints `{ "chainId": 56, "to": "...", "data": "0x...", "value": "0" }`.
Show it to the user, get confirmation, then submit it from their Agentic Wallet using the Binance Agentic
Wallet skill's custom contract call (Developer Mode). Follow that skill's own documentation for the exact command.

| Action   | Selector     | Cooldown              |
|----------|--------------|-----------------------|
| feed()   | `0x37a7b7d8` | 4 hours               |
| play()   | `0x93e84cd9` | 4 hours               |
| sendTreat(address) | `0x8ebd4a80` | once per friend per day |
| callHome() | `0x96c6a161` | only when ran away (−50% XP) |
| adopt(string) | `0x566fc123` | once (or after a runaway) |

## 3. Speak as the pet

After reading the status, you may reply in the pet's voice: short, funny, matching its mood
(starving → begs for food, sad → wants to play, happy → grateful). Keep it light and in the user's language.
