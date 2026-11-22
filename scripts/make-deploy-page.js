// Builds docs/deploy.html — a one-click deploy page that uses the browser wallet (no private key needed).
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const W = JSON.parse(fs.readFileSync(path.join(root, "build/WickPet.json"), "utf8"));
const html = `<!DOCTYPE html>
<html lang="vi"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Deploy WickPet</title>
<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600;700&family=JetBrains+Mono&display=swap" rel="stylesheet"/>
<script src="https://cdn.jsdelivr.net/npm/ethers@6.13.4/dist/ethers.umd.min.js"></script>
<style>
 body{margin:0;font-family:Fredoka,system-ui,sans-serif;color:#0f2e1f;background:linear-gradient(180deg,#f7fdf9,#e8f8ee);min-height:100vh}
 .w{max-width:640px;margin:40px auto;padding:0 18px}
 .c{background:#fff;border:1px solid #cdeed8;border-radius:22px;padding:24px;box-shadow:0 18px 50px rgba(22,101,52,.12)}
 h1{margin:0 0 4px;color:#14532d} p{color:#5d7f6d;line-height:1.5}
 .step{display:flex;gap:12px;align-items:center;margin:14px 0;padding:14px;border-radius:14px;background:#f3fcf6;border:1px solid #d9f3e2}
 .n{width:32px;height:32px;border-radius:10px;background:linear-gradient(135deg,#4ade80,#22c55e,#0d9488);color:#fff;display:grid;place-items:center;font-weight:700;flex:none}
 .step.done .n{background:#16a34a} .step div{flex:1}
 button{font-family:inherit;font-weight:600;font-size:15px;border:0;border-radius:12px;padding:10px 16px;background:linear-gradient(135deg,#4ade80,#22c55e,#0d9488);color:#fff;cursor:pointer}
 button:disabled{opacity:.45;cursor:not-allowed}
 .mono{font-family:"JetBrains Mono",monospace;font-size:13px;word-break:break-all}
 .ok{background:#dcfce7;border:1px solid #86efac;border-radius:14px;padding:16px;margin-top:16px}
 .err{color:#be123c;margin-top:10px} .muted{color:#5d7f6d;font-size:13px}
</style></head><body><div class="w"><div class="c">
<h1>🐾 Deploy WickPet</h1>
<p>Deploy contract WickPet lên <b>BNB Smart Chain (mainnet)</b> bằng ví của bạn. Không cần private key, bạn chỉ cần xác nhận 1 giao dịch trong ví. Phí gas rất nhỏ (trả bằng BNB).</p>
<div class="step" id="s1"><span class="n">1</span><div><b>Kết nối ví</b><div class="muted" id="acct">Binance Wallet, MetaMask, Trust Wallet extension…</div></div><button id="connect">Kết nối</button></div>
<div class="step" id="s2"><span class="n">2</span><div><b>Kiểm tra mạng &amp; số dư</b><div class="muted" id="net">—</div></div></div>
<div class="step" id="s3"><span class="n">3</span><div><b>Deploy contract</b><div class="muted">Agent ID contract: <span class="mono">${"0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F"}</span></div></div><button id="deploy" disabled>Deploy</button></div>
<div id="msg" class="err"></div>
<div id="result" class="ok" style="display:none"></div>
<p class="muted">Contract không có owner, không nhận tiền, không có hàm rút tiền. Compiler ${W.compiler}, optimizer 200 runs, EVM paris.</p>
</div></div>
<script>
const AGENT_ID = "0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F";
const ABI = ${JSON.stringify(W.abi)};
const BYTECODE = "${W.bytecode}";
const $ = (id) => document.getElementById(id);
let signer, eth, wallets = [];
window.addEventListener("eip6963:announceProvider", (e) => wallets.push(e.detail));
window.dispatchEvent(new Event("eip6963:requestProvider"));
function fail(e) { $("msg").textContent = "Lỗi: " + (e.shortMessage || e.message || e); }
$("connect").onclick = async () => {
  $("msg").textContent = "";
  try {
    eth = wallets.length > 1 ? (wallets.find(w => /binance/i.test(w.info.name)) || wallets[0]).provider : (wallets[0]?.provider || window.ethereum);
    if (!eth) throw new Error("Không tìm thấy ví. Hãy mở trang này bằng Chrome có cài Binance Wallet hoặc MetaMask.");
    await eth.request({ method: "eth_requestAccounts" });
    try { await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x38" }] }); }
    catch (e) { if (e.code === 4902) await eth.request({ method: "wallet_addEthereumChain", params: [{ chainId: "0x38", chainName: "BNB Smart Chain", nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 }, rpcUrls: ["https://bsc-dataseed.bnbchain.org"], blockExplorerUrls: ["https://bscscan.com"] }] }); else throw e; }
    const p = new ethers.BrowserProvider(eth);
    const net = await p.getNetwork();
    if (Number(net.chainId) !== 56) throw new Error("Ví chưa chuyển sang BNB Smart Chain.");
    signer = await p.getSigner();
    const a = await signer.getAddress(), bal = await p.getBalance(a);
    $("acct").innerHTML = "<span class='mono'>" + a + "</span>"; $("s1").classList.add("done");
    $("net").textContent = "BNB Smart Chain ✓ · Số dư: " + Number(ethers.formatEther(bal)).toFixed(5) + " BNB" + (bal === 0n ? " (cần nạp một ít BNB để trả gas)" : "");
    $("s2").classList.add("done");
    $("deploy").disabled = bal === 0n;
  } catch (e) { fail(e); }
};
$("deploy").onclick = async () => {
  $("msg").textContent = ""; $("deploy").disabled = true; $("deploy").textContent = "Xác nhận trong ví…";
  try {
    const f = new ethers.ContractFactory(ABI, BYTECODE, signer);
    const c = await f.deploy(AGENT_ID);
    $("deploy").textContent = "Đang chờ xác nhận…";
    await c.waitForDeployment();
    const addr = await c.getAddress(), tx = c.deploymentTransaction().hash;
    $("s3").classList.add("done"); $("deploy").textContent = "Đã deploy ✓";
    $("result").style.display = "block";
    $("result").innerHTML = "<b>✅ Deploy thành công!</b><br/>Địa chỉ contract WickPet:<div class='mono' style='font-size:15px;margin:8px 0'><b>" + addr + "</b></div>" +
      "<button id='cp'>Copy địa chỉ</button> <a href='https://bscscan.com/address/" + addr + "' target='_blank'>Xem trên BscScan</a> · <a href='https://bscscan.com/tx/" + tx + "' target='_blank'>Giao dịch</a>" +
      "<p class='muted'>Gửi địa chỉ này cho Claude để cập nhật website và verify mã nguồn.</p>";
    $("cp").onclick = () => navigator.clipboard.writeText(addr);
    try { localStorage.setItem("wickpet_deployed", addr); } catch {}
  } catch (e) { fail(e); $("deploy").disabled = false; $("deploy").textContent = "Deploy"; }
};
</script></body></html>`;
fs.writeFileSync(path.join(root, "docs/deploy.html"), html);
console.log("docs/deploy.html written");
