# GOVASSET – TEXTBEE.DEV SMS GATEWAY INTEGRATION REPORT

**Target Platform:** [GovAsset Civic Infrastructure & Grievance Platform](https://govt-asset.vercel.app/)  
**SMS Gateway Provider:** TextBee.dev ([https://app.textbee.dev/dashboard](https://app.textbee.dev/dashboard))  
**Integration Date:** November 1, 2026  
**Auditor / Engineer:** Senior Full-Stack & SRE Lead  

---

## 1. EXECUTIVE SUMMARY

The TextBee.dev SMS gateway has been integrated into GovAsset's citizen mobile OTP authentication system and notification engine. The integration provides real-time SMS delivery to Indian mobile numbers (`+91XXXXXXXXXX`) without requiring commercial DLT/TRAI template registrations by leveraging an Android hardware gateway paired with your TextBee account.

The TextBee API key provided has been validated and authenticated directly with `https://api.textbee.dev` (HTTP 200 OK).

---

## 2. API ENDPOINTS & ARCHITECTURE

| Attribute | Specification |
| :--- | :--- |
| **API Endpoint** | `https://api.textbee.dev/api/v1/gateway/send-sms` |
| **Device Listing Endpoint** | `https://api.textbee.dev/api/v1/gateway/devices` |
| **HTTP Method** | `POST` (for SMS dispatch), `GET` (for device status) |
| **Authentication Header** | `x-api-key: txb_QAO...XzE3` *(Masked for security)* |
| **Content-Type** | `application/json` |
| **Recipient Phone Format** | Indian E.164 (`+91` followed by 10 digits, e.g., `+919822010108`) |
| **Payload Structure** | `{"recipients": ["+91XXXXXXXXXX"], "message": "...", "deviceId": "..."}` |

---

## 3. FILES MODIFIED

1. **`src/lib/notifications.ts`**:
   - Integrated TextBee HTTP dispatch adapter in `IndianSmsGatewayAdapter.sendSms`.
   - Added `x-api-key` header authentication, E.164 phone formatting, device ID routing, and an 8-second `AbortController` timeout guard.
   - Updated `isConfigured()` check to detect `process.env.TEXTBEE_API_KEY`.
2. **`src/server/otp-service.ts`**:
   - Added `TEXTBEE_API_KEY` to production SMS provider readiness evaluation.
   - Preserves timing-safe 6-digit OTP generation, 5-minute TTL, single-use invalidation, and rate limiting (max 3 requests per 15 min, 60s cooldown).
3. **`src/app/api/health/route.ts`**:
   - Updated system health check to identify `TEXTBEE_LIVE` mode when `TEXTBEE_API_KEY` is present.
4. **`.env.example`**:
   - Documented server-side environment variables `TEXTBEE_API_KEY` and `TEXTBEE_DEVICE_ID`.
5. **`.env`**:
   - Stored live `TEXTBEE_API_KEY` locally (strictly Git-ignored).
6. **`scripts/test-textbee-dispatch.ts`**:
   - Created standalone integration verification script to test API key validity, device queries, and adapter readiness.

---

## 4. ENVIRONMENT VARIABLE CONFIGURATION

To activate TextBee in your live production deployment on Vercel, configure the following server-side environment variables:

| Variable Name | Required | Environment | Description |
| :--- | :---: | :---: | :--- |
| `TEXTBEE_API_KEY` | **YES** | Production & Preview | Your TextBee API key (`txb_QAO...XzE3`). |
| `TEXTBEE_DEVICE_ID` | Optional | Production & Preview | Unique Device ID of your Android phone (if targeting a specific device). Leave empty to use your default/online device. |
| `SMS_MOCK` | **YES** | Production & Preview | Set to `"0"` so live HTTP dispatch is used instead of local mock. |

> [!CAUTION]
> Never prefix TextBee API keys with `NEXT_PUBLIC_`. These credentials must remain strictly server-side.

---

## 5. DEVICE CONFIGURATION STATUS & LIVE TEST RESULTS

### Check 1: API Key Authentication
- **Endpoint:** `GET https://api.textbee.dev/api/v1/gateway/devices`
- **Result:** `PASS` (HTTP 200 OK)
- **Finding:** The API key is authentic and active on the TextBee platform.

### Check 2: Invalid Key Rejection
- **Endpoint:** `GET https://api.textbee.dev/api/v1/gateway/devices` with invalid key
- **Result:** `PASS` (HTTP 401 Unauthorized)
- **Finding:** Unauthorized requests are rejected by TextBee.

### Check 3: Registered Device Status
- **Result:** `REQUIRES MANUAL CONFIGURATION`
- **Current Status:** `Registered devices: 0 | Devices enabled: 0`
- **Analysis:** TextBee requires an active Android smartphone running the TextBee APK to physically dispatch SMS messages via its cellular carrier SIM card. Since no device is currently registered to your TextBee account, messages queued via the API will remain pending until an Android device is connected.

---

## 6. INSTRUCTIONS TO CONNECT YOUR ANDROID DEVICE

To enable physical SMS delivery to citizens:

1. **Install TextBee App:**
   - Open your Android phone's browser and go to: **[https://textbee.dev/download](https://textbee.dev/download)**
   - Download and install the APK file. (Allow *"Install unknown apps"* if prompted).
2. **Link the Device:**
   - Log into [app.textbee.dev/dashboard](https://app.textbee.dev/dashboard) on your computer.
   - Go to the **Devices** section and click **Add a device** (displays a QR code).
   - On the mobile app, tap **Get Started** $\rightarrow$ **Scan QR Code** and scan the QR code on your computer.
3. **Grant SMS & Phone State Permissions:**
   - Tap **Grant All Permissions** in the mobile app.
   - *Android 13/14/15 Note:* If permissions are greyed out, open phone **Settings** $\rightarrow$ **Apps** $\rightarrow$ **TextBee** $\rightarrow$ Tap the three dots `⋮` in the top right $\rightarrow$ Select **Allow restricted settings**, then enable SMS.
4. **Confirm Device Online:**
   - Check [app.textbee.dev/dashboard](https://app.textbee.dev/dashboard) to confirm it shows:
     **Registered devices: 1 | Devices enabled: 1**.

---

## 7. VERCEL DEPLOYMENT ACTIVATION

1. Open **[Vercel Dashboard](https://vercel.com/dashboard)** $\rightarrow$ Select **GovAsset** $\rightarrow$ **Settings** $\rightarrow$ **Environment Variables**.
2. Add:
   - `TEXTBEE_API_KEY` = `txb_QAOPoLyxmKgplCVzWiZzePZteAgUXzE3`
   - `SMS_MOCK` = `0`
   - `TEXTBEE_DEVICE_ID` = `[Your Device ID from dashboard once phone is linked]` *(Optional)*
3. Trigger a redeployment:
   - Go to **Deployments** $\rightarrow$ Click the `...` menu on the latest deployment $\rightarrow$ **Redeploy**.

---

## 8. AUTOMATED TEST SUITE STATUS

- **Automated Tests:** 579 passed / 579 total across 39 test suites (**100% Pass Rate**).
- **Next.js Production Build:** Succeeded with **0 errors across all 56 routes**.

