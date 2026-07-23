import fetch from 'node-fetch';
import { createEmailApi } from '../eset/email/Pro100Pochta.js';
import { updateJetBrainsStudentEmailStatus, insertJetBrainsAccount } from '../db.js';
import { getAuthSessionId, getRecoveryOtp, confirmJetBrainsLicense as confirmLicense, getAcceptLink, setAccountPassword } from './outlookScraper.js';

const firstNames = ['John', 'Jane', 'Michael', 'Emily', 'William', 'Olivia', 'James', 'Sophia', 'Benjamin', 'Isabella', 'Daniel', 'Mia', 'Matthew', 'Charlotte', 'Joseph', 'Amelia'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas'];

function generateRandomName() {
  const first = firstNames[Math.floor(Math.random() * firstNames.length)];
  const last = lastNames[Math.floor(Math.random() * lastNames.length)];
  return { first, last };
}

class JetBrainsSession {
  constructor() {
    this.cookies = {};
  }

  getCookieString() {
    return Object.entries(this.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  updateCookies(setCookieHeaders) {
    if (!setCookieHeaders) return;
    for (const cookieHeader of setCookieHeaders) {
      const parts = cookieHeader.split(';');
      const [nameValue] = parts;
      const splitIndex = nameValue.indexOf('=');
      if (splitIndex > 0) {
        const name = nameValue.substring(0, splitIndex).trim();
        const value = nameValue.substring(splitIndex + 1).trim();
        this.cookies[name] = value;
      }
    }
  }

  async fetchApi(path, payload, type = 'shop', method = 'POST') {
    const baseUrl = type === 'shop' ? 'https://www.jetbrains.com' : 'https://account.jetbrains.com';
    const targetUrl = baseUrl + path;

    const headers = {
      'Accept': 'application/json, text/plain, */*',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Origin': baseUrl,
      'Referer': baseUrl + '/',
      'X-Requested-With': 'XMLHttpRequest',
    };

    const cookieStr = this.getCookieString();
    if (cookieStr) headers['Cookie'] = cookieStr;

    const cookieName = type === 'shop' ? '_st-SHOP' : '_st-JBA';
    if (this.cookies[cookieName]) {
      headers['x-xsrf-token'] = this.cookies[cookieName];
    }

    if (payload) {
      headers['Content-Type'] = 'application/json';
    }

    const { ofetch } = await import('ofetch');
    const { Agent } = await import('undici');
    const { buildSocksProxyConnector } = await import('@jsr/undicijs__proxy');
    
    // We can reuse the PROXY_URL from the file
    const dispatcher = new Agent({ connect: buildSocksProxyConnector(PROXY_URL) });

    const options = {
      method,
      headers,
      dispatcher,
      ignoreResponseError: true,
      responseType: 'text',
    };
    if (payload && method !== 'GET' && method !== 'HEAD') {
      options.body = JSON.stringify(payload);
    }

    const response = await ofetch.raw(targetUrl, options);
    
    if (typeof response.headers.getSetCookie === 'function') {
      this.updateCookies(response.headers.getSetCookie());
    } else {
      const sc = response.headers.get('set-cookie');
      if (sc) this.updateCookies([sc]); // Note: standard Headers concatenates cookies, but it might work for this simple case. Ideally we should use raw headers, but undici returns them concatenated if we use the standard interface. Wait, ofetch uses undici's fetch so getSetCookie() should be available in Node 18+.
    }

    if (response.status === 204) return null;

    let data;
    const contentType = response.headers.get('content-type');
    const textData = response._data;
    
    if (contentType && contentType.includes('application/json')) {
      try { data = JSON.parse(textData); } catch (e) { data = textData; }
    } else {
      data = textData;
    }

    if (response.status < 200 || response.status >= 300) {
      throw new Error(typeof data === 'string' ? data : JSON.stringify(data) || response.statusText);
    }

    return data;
  }
}

const PROXY_URL = 'socks5://4w99sxjb5s-corp.mobile.res-country-LV-hold-session-session-6a45848ec8ed4:ohh401aJwRYe8xuN@82.27.118.182:443';

async function generatePro100PochtaEmail() {
  const api = await createEmailApi(PROXY_URL);
  const res = await api.generateEmailAddress();
  if (res.isErr()) throw new Error('Could not parse disposable email from pro100pochta: ' + res.error);
  return { loginString: res.value.password, email: res.value.email, api, externEmail: res.value };
}

async function pollForOtp(api, externEmail) {
  let attempts = 0;
  while (attempts < 60) {
    await new Promise(r => setTimeout(r, 5000));
    try {
      const inboxRes = await api.getInbox(externEmail);
      if (inboxRes.isOk() && inboxRes.value && inboxRes.value.length > 0) {
        for (const msg of inboxRes.value) {
          console.log(`[JB Worker] Checking message ID: ${msg.id}, Subject: ${msg.subject}`);
          const msgRes = await api.readMessage(msg.id, externEmail);
          if (msgRes.isOk() && msgRes.value) {
            // JetBrains OTP could be 6 digits without <b> tags, let's try a broader regex if needed, but let's log it first if it's from jetbrains
            if (msg.from && msg.from.toLowerCase().includes('jetbrains')) {
               console.log(`[JB Worker] Found JetBrains email! Extracting OTP...`);
               // Find all 6 digit numbers
               const matches = msgRes.value.match(/\b(\d{6})\b/g);
               if (matches) {
                 // Filter out common colors
                 const validOtps = matches.filter(m => m !== '000000' && m !== 'ffffff' && m !== 'FFFFFF');
                 if (validOtps.length > 0) {
                   const otp = validOtps[0];
                   console.log(`[JB Worker] Extracted OTP: ${otp}`);
                   return otp;
                 }
               }
               console.log(`[JB Worker] Could not find 6 digits in JetBrains email! Body snippet: ${msgRes.value.substring(0, 200)}`);
            } else {
               // Fallback to original logic just in case the sender is weird
               const otpMatch = msgRes.value.match(/<b[^>]*>\s*(\d{6})\s*<\/b>/);
               if (otpMatch) return otpMatch[1];
            }
          }
        }
      }
    } catch (e) {
      console.error('[JB Worker] Poll error:', e);
    }
    attempts++;
  }
  throw new Error('Timeout waiting for OTP on pro100pochta');
}

export async function startJetBrainsActivation(jobId, outlookEmail, outlookPass, orderId = null) {
  try {
    console.log(`[JB Worker] Starting activation for ${outlookEmail}`);
    
    // We pass an empty string for "token" to scraping functions since we are on the backend
    // and they expect a Bearer token but we can bypass or give them an admin token if needed.
    // However, outlookScraper functions like getAuthSessionId don't actually use the `token` parameter,
    // they are the actual implementation! Wait!
    // The `getAuthSessionId` imported here is from `./outlookScraper.js` which is the actual puppeteer code, 
    // NOT the `clientApi.js` fetch wrappers.
    // That's perfect because we can run puppeteer directly!

    const session = new JetBrainsSession();
    const { first, last } = generateRandomName();
    const jetbrainsPass = outlookPass;

    console.log(`[JB Worker] 0. Initializing session`);
    await session.fetchApi('/shop/eform/v2/students', null, 'shop', 'GET');

    console.log(`[JB Worker] 1. Generating pro100pochta`);
    const { email: personalEmail, api, externEmail } = await generatePro100PochtaEmail();
    
    console.log(`[JB Worker] 2. Verify Email`);
    await session.fetchApi('/shop/api/v2/eform/student/verifyEmail', { email: personalEmail }, 'shop', 'POST');

    console.log(`[JB Worker] 3. Waiting for OTP`);
    const otp = await pollForOtp(api, externEmail);

    console.log(`[JB Worker] 4. Verifying OTP`);
    await session.fetchApi('/shop/api/v2/eform/student/verifyOtp', { email: personalEmail, otp }, 'shop', 'POST');

    console.log(`[JB Worker] 5. Submitting form`);
    let isAlreadyUsed = false;
    try {
      await session.fetchApi('/shop/api/v2/eform/student/submit', {
        requesterType: 'Student',
        countryIso: 'LV',
        levelOfStudy: 'Undergraduate',
        universityEmail: outlookEmail,
        personalEmail,
        personalEmailOtp: otp,
        firstName: first,
        lastName: last,
        isCsOrEngineeringMajorField: false,
        agreementAccepted: true,
        likeToReceiveNews: false,
        under13YearsOld: false,
        applicationType: 'UniversityEmail'
      }, 'shop', 'POST');
    } catch (err) {
      if (err.message && err.message.includes('AlreadyUsedForLicenseRequest')) {
        console.log(`[JB Worker] License already confirmed. Proceeding to recovery.`);
        isAlreadyUsed = true;
      } else {
        throw err;
      }
    }

    let accountAuthSessionId;

    if (isAlreadyUsed) {
      console.log(`[JB Worker] 6. Getting accept link via IMAP`);
      const acceptLink = await getAcceptLink(outlookEmail, outlookPass);
      console.log(`[JB Worker] 7. Puppeteer confirmation`);
      accountAuthSessionId = await confirmLicense(acceptLink, outlookEmail);
    } else {
      console.log(`[JB Worker] 6. Waiting for confirmation email via IMAP`);
      const requestCode = await getAuthSessionId(outlookEmail, outlookPass);
      console.log(`[JB Worker] 7. Puppeteer confirmation`);
      accountAuthSessionId = await confirmLicense(requestCode, outlookEmail);
    }

    console.log(`[JB Worker] 8. Waiting for recovery OTP via IMAP`);
    const otpCode = await getRecoveryOtp(outlookEmail, outlookPass);

    console.log(`[JB Worker] 9. Setting password`);
    await setAccountPassword(accountAuthSessionId, otpCode, jetbrainsPass);

    console.log(`[JB Worker] Done! Saving to db...`);
    insertJetBrainsAccount(personalEmail, jetbrainsPass, outlookEmail, orderId);
    updateJetBrainsStudentEmailStatus(jobId, 'active');

    return { success: true, email: personalEmail };

  } catch (error) {
    console.error(`[JB Worker] Error for ${outlookEmail}:`, error);
    updateJetBrainsStudentEmailStatus(jobId, 'error', error.message);
    throw error;
  }
}
