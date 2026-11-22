# Hướng dẫn triển khai WickPet (tiếng Việt)

Hạn nộp bài: **15:00 ngày 09/12/2026 (giờ Việt Nam)**. Nên deploy xong trước **ngày 26/11** để còn khoảng 2 tuần kéo cộng đồng.

## Trong gói có gì

| Thư mục / file | Dùng để làm gì |
|---|---|
| `contracts/WickPet.sol` | Smart contract của game. Không có owner, không giữ tiền, không approve. |
| `docs/index.html` | Website của game, chỉ 1 file và không cần build. |
| `scripts/deploy.js` | Deploy contract và tự điền địa chỉ contract vào website. |
| `scripts/verify.js` | Xác minh mã nguồn trên BscScan (bắt buộc theo luật thi). |
| `agent-skill/wickpet/` | Skill cho AI agent chăm pet qua Agentic Wallet. Đây là điểm cộng lớn về "chiều sâu Agent ID". |
| `ai-worker/worker.js` | (Tùy chọn) Cho pet nói chuyện bằng AI thật. Không có thì pet vẫn nói bằng engine có sẵn. |
| `README.md` | Tài liệu tiếng Anh cho ban giám khảo, dùng làm README trên GitHub. |
| `SUBMISSION.md` | Nội dung tiếng Anh để copy vào form nộp bài. |

## Bước 0: Chuẩn bị

1. Cài **Node.js 18+** (nodejs.org).
2. Tạo **một ví mới chỉ để deploy** (MetaMask hoặc ví bất kỳ), nạp khoảng **0.01 BNB** để trả gas. Không dùng ví chính chứa nhiều tiền.
3. Xuất private key của ví deploy đó. **Không gửi key cho ai và không đưa key lên GitHub.**
4. Mở terminal trong thư mục `wickpet`, rồi chạy:
   ```bash
   npm install
   npm test
   ```
   Thấy dòng `All 20 checks passed.` là ổn.

## Bước 1: Chạy thử trên testnet (khuyên làm)

Agent ID chỉ có trên mainnet, nên bản testnet sẽ tự tạo một contract "Agent ID giả" và đánh dấu ví của bạn là holder.

1. Lấy BNB testnet miễn phí từ faucet của BNB Chain (tìm "BNB Chain testnet faucet").
2. Chạy:
   ```bash
   PRIVATE_KEY=0xKEY_CUA_BAN npm run deploy:testnet
   ```
   (Trên Windows PowerShell: `$env:PRIVATE_KEY="0x..."; npm run deploy:testnet`)
3. Mở `docs/index.html` bằng trình duyệt có ví và chuyển ví sang BSC Testnet để chơi thử.
4. Muốn cho người khác test: gọi `setHolder(địa_chỉ, true)` trên contract mock (địa chỉ được in ra khi deploy).

> Sau khi test xong, **tải lại file `docs/index.html` gốc** (hoặc sửa lại phần CONFIG) trước khi deploy mainnet, vì script đã ghi địa chỉ testnet vào file.

## Bước 2: Deploy lên mainnet

```bash
PRIVATE_KEY=0xKEY_CUA_BAN npm run deploy:mainnet
```

Script in ra:
- Địa chỉ contract WickPet. **Lưu lại địa chỉ này.**
- Constructor arguments, dùng khi verify thủ công.
- Đồng thời tự điền địa chỉ contract vào `docs/index.html`.

## Bước 3: Verify mã nguồn trên BscScan (bắt buộc)

**Cách nhanh:** tạo API key miễn phí ở etherscan.io (một key dùng được cho BscScan), rồi chạy:
```bash
ETHERSCAN_API_KEY=KEY_CUA_BAN node scripts/verify.js DIA_CHI_CONTRACT
```

**Cách thủ công:**
1. Vào bscscan.com, mở contract, chọn tab **Contract**, bấm **Verify & Publish**.
2. Compiler Type: **Solidity (Standard-Json-Input)**.
3. Compiler: **v0.8.28+commit.7893614a**. License: **MIT**.
4. Upload file `build/WickPet.standard-input.json`.
5. Dán constructor arguments mà script đã in ra.

## Bước 4: Đưa website lên mạng (miễn phí)

Chọn một trong các cách:
- **Netlify Drop** (dễ nhất): vào app.netlify.com/drop, kéo thả thư mục `docs` vào là có link.
- **Vercel** hoặc **Cloudflare Pages**: tạo project và chọn thư mục `docs`.
- **GitHub Pages**: đẩy code lên GitHub, bật Pages.

Có thể gắn domain riêng, ví dụ `pet.htp96.xyz`.

## Bước 5: Đưa code lên GitHub (bắt buộc công khai mã nguồn)

Tạo repo public tên `wickpet`, đẩy toàn bộ thư mục lên. `.gitignore` đã loại `node_modules`.
**Kiểm tra kỹ là không có private key trong bất kỳ file nào.**

## Bước 6 (tùy chọn): Cho pet nói chuyện bằng AI thật

1. Tạo tài khoản Cloudflare (miễn phí) và lấy API key của Anthropic.
2. Trong thư mục `ai-worker`, chạy:
   ```bash
   npm i -g wrangler
   wrangler deploy worker.js --name wickpet-ai --compatibility-date 2026-11-01
   wrangler secret put ANTHROPIC_API_KEY
   ```
3. Dán URL worker vào `aiEndpoint` trong phần CONFIG của `docs/index.html`, rồi upload lại website.

Nếu bỏ qua bước này, pet vẫn nói chuyện bằng engine có sẵn: 6 tính cách, phản ứng theo tâm trạng và giá BTC.

## Bước 7: Nộp bài

Copy nội dung trong `SUBMISSION.md`, điền link website, địa chỉ contract và link GitHub, rồi nộp qua form của Binance trước **15:00 ngày 09/12**.

---

## Kế hoạch kéo người chơi (quan trọng cho giải Tiên phong)

Mục tiêu tối thiểu là **30 ví có Agent ID** (điều kiện xét giải Sáng tạo). Càng nhiều người chơi hằng ngày thì điểm giải Tiên phong càng cao.

1. **Ngày đầu:** đăng hướng dẫn 3 bước trên Telegram, X và TikTok:
   (1) nhận Agent ID trong app Binance (Ví → banner trang chủ → Agent ID),
   (2) mở website và nhận trứng,
   (3) cho ăn mỗi ngày.
2. **Mỗi ngày:** nhắc cộng đồng "đến giờ cho pet ăn" kèm screenshot pet của bạn. Đây là lý do để anh em quay lại mỗi ngày.
3. **Bảng xếp hạng tuần:** có thể tặng quà cho top level hoặc top streak. Chỉ nói "quà cho top người chơi", **không nói "kiếm tiền", "thu nhập thụ động" hay "lợi nhuận"** vì luật thi cấm.
4. **Invite link:** khuyến khích mọi người chia sẻ link để bạn bè gửi treat. Mỗi treat là một tương tác on-chain mới.
5. **Chiến dịch X (2.000 USDC):** khuyến khích người chơi bấm nút "Share" trên web. Bài đăng đã có sẵn hashtag #BinanceWalletHackathon #AgenticWallet, nên họ cũng đủ điều kiện tham gia chiến dịch cộng đồng.
6. **Mời KOL khác** trong mạng lưới của bạn cùng chơi để kéo thêm cộng đồng mới.

## Lưu ý về luật thi

- **Không đổi tên dự án hay token có chữ "BNB" hoặc "Binance"**, vì luật cấm dùng chữ này theo cách dễ gây nhầm là sản phẩm chính thức. Dự án đang tên **WickPet by HTP96**.
- **Không buff tương tác bằng ví ảo.** Agent ID là 1 người 1 ID nên khó farm. Có dấu hiệu thao túng thì cả dự án bị loại.
- **Khi hướng dẫn dùng Agentic Wallet:** nhắc người dùng chỉ để ít BNB đủ trả gas trong ví khi bật Developer Mode, và tắt Developer Mode sau khi dùng xong.
- **Chi phí gas:** mỗi lần cho ăn hay chơi là một giao dịch trên BNB Chain, phí rất nhỏ nhưng người chơi cần có một ít BNB trong ví.
