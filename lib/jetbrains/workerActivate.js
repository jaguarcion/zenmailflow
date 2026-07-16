import fetch from 'node-fetch';
import { updateJetBrainsStudentEmailStatus, insertJetBrainsAccount } from '../db.js';
import { getAuthSessionId, getRecoveryOtp, confirmLicense, getAcceptLink } from './outlookScraper.js';

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

    const options = { method, headers };
    if (payload && method !== 'GET' && method !== 'HEAD') {
      options.body = JSON.stringify(payload);
    }

    const response = await fetch(targetUrl, options);
    
    // Node-fetch get raw Set-Cookie headers
    const setCookies = response.headers.raw()['set-cookie'];
    this.updateCookies(setCookies);

    if (response.status === 204) return null;

    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      throw new Error(typeof data === 'string' ? data : JSON.stringify(data) || response.statusText);
    }

    return data;
  }
}

async function generatePro100PochtaEmail() {
  const randomStr = Array.from({length: 10}, () => Math.random().toString(36).charAt(2)).join('');
  const res = await fetch(`https://pro100pochta.com/?${randomStr}`, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const text = await res.text();
  const match = text.match(/<div id="emailbox">([^<]+)<\/div>/i) || text.match(/value="([^"]+@pro100pochta\.com)"/i) || text.match(/([a-zA-Z0-9._-]+@pro100pochta\.com)/i);
  if (!match) throw new Error('Could not parse disposable email from pro100pochta');
  return { loginString: randomStr, email: match[1].trim() };
}

async function pollForOtp(loginString) {
  let attempts = 0;
  while (attempts < 60) {
    await new Promise(r => setTimeout(r, 5000));
    try {
      const ts = new Date().getTime();
      const listRes = await fetch(`https://pro100pochta.com/api/get-list-new.php?login=${encodeURIComponent(loginString)}&t=${ts}`);
      const listData = await listRes.json();

      if (listData && Array.isArray(listData) && listData.length > 0) {
        const mailId = listData[0].id;
        const msgRes = await fetch(`https://pro100pochta.com/api/get-message.php?login=${encodeURIComponent(loginString)}&id=${mailId}`);
        const msgData = await msgRes.json();
        
        if (msgData && msgData.html) {
          const otpMatch = msgData.html.match(/<b[^>]*>\s*(\d{6})\s*<\/b>/);
          if (otpMatch) return otpMatch[1];
        }
      }
    } catch (e) {
      // ignore poll errors
    }
    attempts++;
  }
  throw new Error('Timeout waiting for OTP on pro100pochta');
}

export async function startJetBrainsActivation(jobId, outlookEmail, outlookPass) {
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
    const { loginString, email: personalEmail } = await generatePro100PochtaEmail();
    
    console.log(`[JB Worker] 2. Verify Email`);
    await session.fetchApi('/shop/api/v2/eform/student/verifyEmail', { email: personalEmail }, 'shop', 'POST');

    console.log(`[JB Worker] 3. Waiting for OTP`);
    const otp = await pollForOtp(loginString);

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
    await session.fetchApi(`/api/auth/sessions/${accountAuthSessionId}/password`, { password: jetbrainsPass }, 'account', 'POST');

    console.log(`[JB Worker] Done! Saving to db...`);
    insertJetBrainsAccount(personalEmail, jetbrainsPass, outlookEmail);
    updateJetBrainsStudentEmailStatus(jobId, 'active');

    return { success: true, email: personalEmail };

  } catch (error) {
    console.error(`[JB Worker] Error for ${outlookEmail}:`, error);
    updateJetBrainsStudentEmailStatus(jobId, 'error', error.message);
    throw error;
  }
}
