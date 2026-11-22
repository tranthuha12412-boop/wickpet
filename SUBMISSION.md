# Hackathon submission — ready to paste

**Project name:** WickPet

**Website:** https://tranthuha12412-boop.github.io/wickpet/

**Contract (BNB Chain, verified):** 0x44886b9997Dc2fA7C4C88Fc2EF249105f8c9Da92 (https://bscscan.com/address/0x44886b9997Dc2fA7C4C88Fc2EF249105f8c9Da92#code)

**Source code:** https://github.com/tranthuha12412-boop/wickpet

**Contact:** X @htp96_community · Telegram @htp96_community

**Team:** HTP96

---

## One-liner
WickPet gives every Agent ID holder an on-chain AI pet: feed it, play with it and keep your streak, or it runs away.

## Description
WickPet is a daily-care pet game on BNB Chain where your Agent ID is your key. Each Agent ID can adopt exactly one pet,
whose species is decided on-chain (Bull, Bear, Whale, Frog, Cat or Dragon). Pets must be fed and played with every few
hours; they hatch, grow through five stages up to Legend, and build daily streaks. Leave a pet hungry for 72 hours and it
runs away: you can call it home at a cost or start a new generation. Friends keep each other's pets alive with daily
treats sent through invite links, and every pet has its own AI personality that jokes about the live BTC market
(entertainment only, never advice).

## How Agent ID is used
1. **Access control:** every write function checks `AgentID.balanceOf(msg.sender) > 0`. Only Agent ID holders can adopt, feed, play, send treats or call a pet home.
2. **Sybil-resistant identity:** Agent ID is one-per-user and non-transferable, so it is "1 person = 1 pet". Leaderboards and streaks can't be farmed with bulk wallets, and pets can't be traded.
3. **Social graph:** Agent ID holders interact with each other's pets (treats), creating real person-to-person on-chain interactions.
4. **Agent-native care:** an included agent skill lets the user's AI agent read the pet, speak as it, and prepare feed/play transactions for the Agentic Wallet. The user confirms every transaction.

## Safety
No owner, no admin, no upgrade or pause. Every function is non-payable; the contract never holds funds, requests
approvals or moves user assets. Source is verified and open on BscScan and GitHub. The website shows a risk warning and
promises no income or returns.

## Hashtags
#BinanceWalletHackathon #AgenticWallet
