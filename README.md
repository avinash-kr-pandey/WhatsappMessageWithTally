# TallyPrime + WhatsApp Cloud API Integration Project

Production-ready, highly reliable event-driven connection bridging TallyPrime Sales Invoices with Meta's official WhatsApp Cloud API through an Express + Redis (BullMQ) Queue microservice.

---

## 🚀 Features
- **Event-Driven Architecture**: Uses Tally TDL to push Sales Vouchers on save. No polling needed.
- **Asynchronous Processing**: Immediate REST response to TallyPrime. WhatsApp generation and PDF delivery is processed in the background queue.
- **Idempotency Protection**: Generates automatic md5 fingerprint of Company + Invoice Number + Date to prevent duplicate messages.
- **Built-in Mock/Demo Mode**: Bypasses WhatsApp cloud gateway if no credentials are set, simulating successful delivery to local log/database.
- **Two-way Integration**: Supports customer commands mapping for `balance`, `invoice`, and `statement` fetches.

---

## 🛠️ 1. Setup Stack (Zero-Docker/Local)

To achieve maximum performance and avoid heavy setups like Docker:

### 1. Redis (Queue)
This project requires **Redis v5.0.0+**. Install the Windows compatible port:
```powershell
winget install taizod1024.redis-windows-fork --accept-package-agreements --accept-source-agreements
```
Launch the Redis server (Port 6379):
```powershell
redis-server
```

### 2. MongoDB Atlas (Cloud Database)
We use a free MongoDB Atlas cloud instance to bypass local service lock errors on network drives:
1. Register a free account at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas).
2. Create a database user (e.g., `tally` with password `tally123`).
3. Set your connection string in `backend/.env`.

---

## ⚙️ 2. Server Installation & Configuration

1. Change directory to `backend`:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure your Environment:
   Create a `.env` file in the `backend/` directory:
   ```env
   PORT=5000
   NODE_ENV=development
   
   # Cloud Database Link
   MONGODB_URI=mongodb+srv://tally:tally123@cluster0.fravw5e.mongodb.net/tally_whatsapp?retryWrites=true&w=majority
   
   # Redis Host
   REDIS_HOST=localhost
   REDIS_PORT=6379
   
   # Tally Config
   TALLY_API_KEY=change_me
   
   # WhatsApp Cloud API (Leave as fake_ for Mock/Demo mode)
   WHATSAPP_ACCESS_TOKEN=fake_token_for_testing
   WHATSAPP_PHONE_NUMBER_ID=fake_phone_number_id
   WHATSAPP_BUSINESS_ACCOUNT_ID=fake_business_id
   ```

---

## ⚡ 3. Running Project

- **Run Dev Mode (Auto-restart)**:
  ```bash
  npm run dev
  ```
- **Run Integration Validation Tests**:
  ```bash
  node tests/run-tests.js
  ```

---

## 📊 4. Testing Webhook & Mock Mode

With the dev server running, open another terminal in the root directory:

**PowerShell Testing Command**:
```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/tally/invoice" -Method Post -Headers @{"x-tally-api-key"="change_me"} -InFile "sample-tally-invoice.json" -ContentType "application/json"
```

**Output**:
You will see `success: true` in your testing terminal, and your backend server terminal will print a simulation log showing:
`[Mock] API Post to https://graph.facebook.com/...` with full payload details, PDF generation logs, and database saves.

---

## 🎛️ 5. TallyPrime Integration Steps
1. Open **TallyPrime**.
2. Go to **F1: Help** -> **TDL & Add-ons** -> **F4: Manage Local TDLs**.
3. Set *Load TDLs on Start-up* to **Yes**.
4. Input the absolute path of the [tally-whatsapp.tdl](tally/tally-whatsapp.tdl) file.
5. Save. The system will now automatically send invoices to the backend on Accept.
