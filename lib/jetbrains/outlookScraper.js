import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { executablePath } from 'puppeteer';

import * as proxyChain from 'proxy-chain';

puppeteer.use(StealthPlugin());

let activeProxyUrl = null;

async function scrapeEmail(user, pass, searchRegex, maxWaitMs = 60000) {
  const oldProxyUrl = 'socks5://4w99sxjb5s-corp.mobile.res-country-LV-state-454311-hold-session-session-6a56a9ca21a90:ohh401aJwRYe8xuN@212.8.249.142:443';
  const newProxyUrl = await proxyChain.anonymizeProxy(oldProxyUrl);
  activeProxyUrl = newProxyUrl;

  const browser = await puppeteer.launch({
    headless: 'new',
    channel: 'chrome',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=1280,800',
      `--proxy-server=${newProxyUrl}`
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    let foundMatch = null;

    // Intercept network responses to extract email content early
    page.on('response', async (response) => {
      if (foundMatch) return;
      const type = response.request().resourceType();
      if (type === 'fetch' || type === 'xhr' || type === 'document') {
        try {
          const text = await response.text();
          if (text.includes('JetBrains') || text.includes('shop/eform/students/request')) {
            const match = text.match(searchRegex);
            if (match) foundMatch = match[1] || match[0];
          }
        } catch (e) { /* ignore binary/stream errors */ }
      }
    });

    const domain = user.split('@')[1] || '';
    const isMicrosoft = domain.includes('hotmail') || domain.includes('outlook') ||
                        domain.includes('live') || domain.includes('msn');

    if (!isMicrosoft) {
      // ─────────── GMAIL / Google Workspace ───────────
      console.log(`[Scraper] Google provider for ${user}. Navigating to Gmail...`);
      await page.goto('https://mail.google.com/', { waitUntil: 'networkidle2', timeout: 30000 });
      console.log(`[Scraper] Gmail URL: ${page.url()}`);

      // Handle cookie consent banner if it appears (accounts.google.com/signin...)
      // Try to dismiss it first
      try {
        const consentBtn = await page.waitForSelector(
          'button[aria-label*="Accept"], button[jsname="higCR"], #L2AGLb, form[action*="consent"] button',
          { timeout: 4000, visible: true }
        );
        if (consentBtn) {
          await consentBtn.click();
          console.log('[Scraper] Gmail: dismissed consent banner');
          await new Promise(r => setTimeout(r, 1500));
        }
      } catch (e) { /* No consent banner, that's fine */ }

      // Wait for email input with a broader set of selectors
      console.log('[Scraper] Gmail: waiting for email input...');
      const emailInputHandle = await page.waitForFunction(() => {
        const selectors = [
          'input[type="email"]',
          'input[name="identifier"]',
          'input[autocomplete="username"]',
          'input[autocomplete="email"]',
        ];
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el && el.offsetParent !== null) return sel;
        }
        return null;
      }, { timeout: 25000 });
      const emailSel = await emailInputHandle.jsonValue();
      console.log(`[Scraper] Gmail: found email input: ${emailSel}`);

      await page.click(emailSel, { clickCount: 3 });
      await page.type(emailSel, user, { delay: 50 });
      await new Promise(r => setTimeout(r, 500));
      await page.keyboard.press('Enter');
      console.log('[Scraper] Gmail: email entered, waiting for password...');

      // Wait for password field
      const passInputHandle = await page.waitForFunction(() => {
        const selectors = [
          'input[type="password"]',
          'input[name="password"]',
          'input[autocomplete="current-password"]',
        ];
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el && el.offsetParent !== null) return sel;
        }
        return null;
      }, { timeout: 20000 });
      const passSel = await passInputHandle.jsonValue();
      console.log(`[Scraper] Gmail: found password input: ${passSel}`);

      await new Promise(r => setTimeout(r, 500));
      await page.focus(passSel);
      await page.keyboard.down('Control');
      await page.keyboard.press('KeyA');
      await page.keyboard.up('Control');
      await page.keyboard.press('Delete');
      await page.type(passSel, pass, { delay: 50 });
      console.log('[Scraper] Gmail: password entered');
      await new Promise(r => setTimeout(r, 500));
      await page.keyboard.press('Enter');

      // Wait for inbox — use navigation event instead of polling DOM (prevents "context destroyed" error)
      console.log('[Scraper] Gmail: waiting for inbox navigation...');
      try {
        // Wait for any navigation triggered by the password submit
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
      } catch (e) {
        // May throw if navigation already completed
      }
      console.log(`[Scraper] Gmail: after login URL: ${page.url()}`);

      // If not on Gmail yet, keep waiting
      if (!page.url().includes('mail.google.com')) {
        // Could be on a 2FA or account selection page — wait more
        try {
          await page.waitForFunction(
            () => window.location.hostname === 'mail.google.com',
            { timeout: 20000 }
          );
        } catch (e) {
          throw new Error(`Gmail inbox not reached. URL: ${page.url()}`);
        }
      }
      console.log('[Scraper] Gmail: inbox loaded!');

      // Scan inbox for JetBrains email (all DOM calls wrapped in try/catch for safety)
      console.log('[Scraper] Gmail: scanning inbox for JetBrains email...');
      const startTime = Date.now();
      while (Date.now() - startTime < maxWaitMs && !foundMatch) {
        try {
          const bodyText = await page.evaluate(() => document.body.innerText);
          const domMatch = bodyText.match(searchRegex);
          if (domMatch) { foundMatch = domMatch[1] || domMatch[0]; break; }

          // Click first JetBrains email in list
          await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('tr.zA, tr[jsmodel]'));
            for (const row of rows) {
              if (row.innerText && (row.innerText.includes('JetBrains') || row.innerText.includes('Educational'))) {
                row.click();
                return;
              }
            }
          });
        } catch (e) {
          // Ignore context errors during navigation
          console.log(`[Scraper] Gmail scan error (ignoring): ${e.message}`);
        }
        await new Promise(r => setTimeout(r, 2000));
      }

    } else {
      // ─────────── OUTLOOK / Microsoft ───────────
      console.log(`[Scraper] Microsoft provider for ${user}. Navigating to Outlook...`);
      let retries = 3;
      while (retries > 0) {
        try {
          await page.goto('https://outlook.office.com/mail/', { waitUntil: 'networkidle2', timeout: 30000 });
          break;
        } catch (err) {
          retries--;
          if (retries === 0) throw err;
          await new Promise(r => setTimeout(r, 2000));
        }
      }

      // Enter email (handle DSSO cancel)
      try {
        const emailOrCancel = await page.waitForFunction(() => {
          const emailInput = document.querySelector('input[type="email"], input[name="loginfmt"]');
          const cancelBtn = document.querySelector('#desktopSsoCancel, a[id="desktopSsoCancel"]');
          if (emailInput && emailInput.offsetParent !== null) return 'email';
          if (cancelBtn && cancelBtn.offsetParent !== null) return 'cancel';
          return null;
        }, { timeout: 30000 });
        const resultType = await emailOrCancel.jsonValue();
        if (resultType === 'cancel') {
          console.log('[Scraper] Clicking DSSO Cancel...');
          await page.click('#desktopSsoCancel');
          await page.waitForSelector('input[type="email"], input[name="loginfmt"]', { timeout: 15000, visible: true });
        }
        const emailSelector = 'input[type="email"], input[name="loginfmt"]';
        await page.waitForSelector(emailSelector, { timeout: 10000, visible: true });
        await page.click(emailSelector, { clickCount: 3 });
        await page.keyboard.press('Backspace');
        await page.type(emailSelector, user, { delay: 50 });
        await new Promise(r => setTimeout(r, 500));
        const nextBtn = await page.$('input[type="submit"], button[type="submit"]');
        if (nextBtn) await nextBtn.click();
        else await page.keyboard.press('Enter');
      } catch (e) {
        throw new Error(`Outlook email input failed. URL: ${page.url()}`);
      }

      // Enter password
      await page.waitForSelector('input[name="passwd"]', { visible: true, timeout: 20000 });
      await new Promise(r => setTimeout(r, 1000));
      await page.focus('input[name="passwd"]');
      await page.keyboard.down('Control');
      await page.keyboard.press('KeyA');
      await page.keyboard.up('Control');
      await page.keyboard.press('Delete');
      await new Promise(r => setTimeout(r, 200));
      await page.type('input[name="passwd"]', pass, { delay: 50 });
      const pwdValue = await page.evaluate(() => document.querySelector('input[name="passwd"]').value);
      console.log(`[Scraper] Outlook password field: "${pwdValue}"`);
      await new Promise(r => setTimeout(r, 500));
      const passBtn = await page.$('input[type="submit"], button[type="submit"]');
      if (passBtn) await passBtn.click();
      else await page.keyboard.press('Enter');

      // Wait for inbox
      const inboxEndTime = Date.now() + 30000;
      let inboxLoaded = false;
      while (Date.now() < inboxEndTime) {
        try {
          if (await page.$('[aria-label="Message list" i], div[role="listbox"], div.mail-app-component')) {
            inboxLoaded = true; break;
          }
          const nextBtn = await page.$('#idBtn_Back, #idSIButton9');
          if (nextBtn) await nextBtn.click();
          const loginError = await page.$('div#passwordError, div#usernameError');
          if (loginError) {
            const errorText = await page.evaluate(el => el.innerText, loginError);
            if (errorText && errorText.trim()) throw new Error(`Login failed: ${errorText.trim()}`);
          }
        } catch (e) {
          if (e.message.includes('Login failed:')) throw e;
        }
        await new Promise(r => setTimeout(r, 1000));
      }
      if (!inboxLoaded) throw new Error(`Outlook inbox not loaded. URL: ${page.url()}`);

      // Scan inbox
      const startTime = Date.now();
      while (Date.now() - startTime < maxWaitMs && !foundMatch) {
        const bodyText = await page.evaluate(() => document.body.innerText);
        
        // Find all matches and take the last one (for Gmail conversation threads, the newest is at the bottom)
        const flags = searchRegex.flags.includes('g') ? searchRegex.flags : searchRegex.flags + 'g';
        const globalRegex = new RegExp(searchRegex.source, flags);
        const allMatches = [...bodyText.matchAll(globalRegex)];
        
        if (allMatches.length > 0) { 
          const lastMatch = allMatches[allMatches.length - 1];
          foundMatch = lastMatch[1] || lastMatch[0]; 
          // Don't break immediately if we have returnLastMatch logic? 
          // Actually, if we just break, we might get the old one if the new one hasn't arrived.
          // We will handle waiting in the caller function.
          break; 
        }
        await page.evaluate(() => {
          const elements = Array.from(document.querySelectorAll('[role="option"], [role="row"], div[role="listbox"] div'));
          for (let el of elements) {
            if (el.innerText && (el.innerText.includes('JetBrains') || el.innerText.includes('Educational Pack')))
              el.click();
          }
        });
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    if (!foundMatch) throw new Error(`Email not found after ${maxWaitMs}ms`);
    return foundMatch;

  } finally {
    await browser.close();
    if (activeProxyUrl) {
      await proxyChain.closeAnonymizedProxy(activeProxyUrl, true);
      activeProxyUrl = null;
    }
  }
}

// Alias for backward compatibility
const scrapeOutlook = scrapeEmail;

export async function getAuthSessionId(email, pass) {
  // Regex to capture the confirmation code from the link
  // e.g., https://www.jetbrains.com/shop/eform/students/request?code=81rdu7fpf32wsxpki16v2atbk
  const regex = /code=([a-zA-Z0-9]+)/;
  return await scrapeEmail(email, pass, regex);
}

export async function getRecoveryOtp(email, pass) {
  console.log(`[Scraper] Waiting 15s for the new JetBrains OTP email to arrive...`);
  await new Promise(r => setTimeout(r, 15000));
  const code = await scrapeEmail(email, pass, /code[^\d]*?(\d{6})/i);
  return code;
}

// Find the admin/company/accept/ link from JetBrains "Pack confirmed" email
export async function getAcceptLink(email, pass) {
  // Matches: https://account.jetbrains.com/admin/company/accept/XXXX
  const regex = /https:\/\/account\.jetbrains\.com\/admin\/company\/accept\/([a-zA-Z0-9]+)/;
  const token = await scrapeEmail(email, pass, regex);
  // scrapeEmail returns match[1] (the capture group = just the token)
  return `https://account.jetbrains.com/admin/company/accept/${token}`;
}

// Shared helper: navigate to the admin/company/accept/ URL, log in with email, trigger OTP recovery
async function doRecoveryFlow(page, acceptUrl, email) {
  console.log(`[LicenseConfirm] doRecoveryFlow: navigating to ${acceptUrl}`);
  await page.goto(acceptUrl, { waitUntil: 'networkidle2', timeout: 25000 });
  console.log(`[LicenseConfirm] doRecoveryFlow: landed on ${page.url()}`);

  // The page shows JetBrains login — first dismiss cookie banner if present
  if (page.url().includes('/login') || page.url().includes('account.jetbrains.com')) {
    // Dismiss cookie consent dialog ("Accept All" / "Deny All" buttons)
    try {
      await page.waitForFunction(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        return btns.some(b => b.innerText && /accept all|deny all/i.test(b.innerText.trim()));
      }, { timeout: 4000 });
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        // Prefer "Accept All", fall back to "Deny All"
        const acceptBtn = btns.find(b => b.innerText && /accept all/i.test(b.innerText.trim()));
        const denyBtn = btns.find(b => b.innerText && /deny all/i.test(b.innerText.trim()));
        if (acceptBtn) acceptBtn.click();
        else if (denyBtn) denyBtn.click();
      });
      console.log('[LicenseConfirm] doRecoveryFlow: dismissed cookie banner');
      await new Promise(r => setTimeout(r, 1000));
    } catch (e) {
      // No cookie banner — that's fine
    }

    // Find and click "Continue with email" button
    try {
      await page.waitForFunction(() => {
        const els = Array.from(document.querySelectorAll('button, a, div[role="button"]'));
        return els.some(e => e.innerText && e.innerText.toLowerCase().includes('continue with email'));
      }, { timeout: 8000 });
      await page.evaluate(() => {
        const els = Array.from(document.querySelectorAll('button, a, div[role="button"]'));
        const emailBtn = els.find(e => e.innerText && e.innerText.toLowerCase().includes('continue with email'));
        if (emailBtn) emailBtn.click();
      });
      console.log('[LicenseConfirm] doRecoveryFlow: clicked Continue with email');
      await new Promise(r => setTimeout(r, 1500));
    } catch (e) {
      console.log(`[LicenseConfirm] doRecoveryFlow: no Continue with email button, trying direct email input. Error: ${e.message}`);
    }

    // Enter university email
    try {
      const emailSelector = 'input[name="email"], input[id="email"], input[type="email"]';
      await page.waitForSelector(emailSelector, { timeout: 8000, visible: true });
      await page.click(emailSelector, { clickCount: 3 });
      await page.type(emailSelector, email, { delay: 50 });
      await page.keyboard.press('Enter');
      console.log(`[LicenseConfirm] doRecoveryFlow: entered email ${email}`);
      try { await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }); } catch(e) {}
      console.log(`[LicenseConfirm] doRecoveryFlow: after email submit: ${page.url()}`);
    } catch (e) {
      console.log(`[LicenseConfirm] doRecoveryFlow: email input error: ${e.message}`);
    }
  }

  // Extract authSessionId from URL if redirected to /login?authSessionId=...
  const urlParams = new URL(page.url()).searchParams;
  let sessionId = urlParams.get('authSessionId');

  if (sessionId) {
    console.log(`[LicenseConfirm] doRecoveryFlow: got authSessionId from URL: ${sessionId}`);
    
    // The UI handles the CSRF token. Click the "Create a password" or "Forgot password?" link/button
    // to trigger the recovery OTP email.
    try {
      await page.waitForFunction(() => {
        const els = Array.from(document.querySelectorAll('a, button'));
        return els.some(e => e.innerText && /create a password|forgot password/i.test(e.innerText.trim()));
      }, { timeout: 8000 });
      
      await page.evaluate(() => {
        const els = Array.from(document.querySelectorAll('a, button'));
        const triggerBtn = els.find(e => e.innerText && /create a password|forgot password/i.test(e.innerText.trim()));
        if (triggerBtn) triggerBtn.click();
      });
      console.log(`[LicenseConfirm] doRecoveryFlow: clicked Create/Forgot password button to trigger OTP`);
      await new Promise(r => setTimeout(r, 2000));
    } catch (e) {
      console.log(`[LicenseConfirm] doRecoveryFlow: could not find Create/Forgot password button: ${e.message}`);
    }
    
    return sessionId;
  }

  // Fallback: create new session from account.jetbrains.com/login
  console.log(`[LicenseConfirm] doRecoveryFlow: no authSessionId in URL, creating session from login page...`);
  if (!page.url().startsWith('https://account.jetbrains.com')) {
    await page.goto('https://account.jetbrains.com/login', { waitUntil: 'networkidle2', timeout: 20000 });
  }
  const sessionId2 = await page.evaluate(async (email) => {
    const match = document.cookie.match(/(?:^|;\s*)_st-JBA=([^;]+)/);
    const csrfToken = match ? match[1] : '';
    const headers = { 'Content-Type': 'application/json' };
    if (csrfToken) headers['x-xsrf-token'] = csrfToken;

    const sessRes = await fetch('/api/auth/sessions', {
      method: 'POST', headers, body: '{}', credentials: 'include'
    });
    const sessText = await sessRes.text();
    let sessData;
    try { sessData = JSON.parse(sessText); } catch(e) {
      throw new Error(`Session create error (${sessRes.status}): ${sessText.substring(0, 200)}`);
    }
    if (!sessData.id) throw new Error('No session id: ' + sessText.substring(0, 200));
    const sid = sessData.id;
    await fetch(`/api/auth/sessions/${sid}/email/login`, {
      method: 'POST', headers,
      body: JSON.stringify({ email }), credentials: 'include'
    }).catch(() => {});
    const recovRes = await fetch(`/api/auth/sessions/${sid}/password/recovery`, {
      method: 'POST', headers, credentials: 'include'
    });
    if (!recovRes.ok) {
      const t = await recovRes.text();
      throw new Error(`passwordRecovery ${recovRes.status}: ${t.substring(0, 200)}`);
    }
    return sid;
  }, email);
  console.log(`[LicenseConfirm] doRecoveryFlow: fallback session created: ${sessionId2}`);
  return sessionId2;
}

export async function confirmJetBrainsLicense(code, outlookEmail) {
  let activeProxyUrl = null;
  const PROXY_URL = 'socks5://4w99sxjb5s-corp.mobile.res-country-LV-hold-session-session-6a45848ec8ed4:ohh401aJwRYe8xuN@82.27.118.182:443';
  activeProxyUrl = await proxyChain.anonymizeProxy(PROXY_URL);

  const browser = await puppeteer.launch({
    headless: 'new',
    channel: 'chrome',
    args: [
      `--proxy-server=${activeProxyUrl}`,
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  });

  try {
    const page = await browser.newPage();

    // Shortcut: if code is a full accept URL or the special marker
    if (code === '__ALREADY_ACCEPTED__') {
      console.log(`[LicenseConfirm] __ALREADY_ACCEPTED__ mode — going to direct recovery...`);
      return await doRecoveryFlow(page, 'https://account.jetbrains.com/login', outlookEmail);
    }
    // If code is a full accept URL (https://account.jetbrains.com/admin/company/accept/...)
    if (code.startsWith('https://')) {
      console.log(`[LicenseConfirm] Accept URL mode: ${code}`);
      return await doRecoveryFlow(page, code, outlookEmail);
    }

    // Step 1: Navigate to finished page — it auto-redirects to licenseAgreementsPage on account.jetbrains.com
    const finishedUrl = `https://www.jetbrains.com/shop/eform/students/request/finished?code=${code}`;
    console.log(`[LicenseConfirm] Navigating to: ${finishedUrl}`);
    await page.goto(finishedUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    console.log(`[LicenseConfirm] Landed on: ${page.url()}`);

    // Step 2: The page should now be licenseAgreementsPage on account.jetbrains.com
    // Find the form with action containing 'licenseAgreements/accept_on_order'
    const acceptAction = await page.evaluate(() => {
      const form = document.querySelector('form[action*="licenseAgreements/accept_on_order"]');
      return form ? form.action : null;
    });

    if (!acceptAction) {
      // License was already accepted but password never set — do recovery.
      const pageText = await page.evaluate(() => document.body.innerText.substring(0, 300));
      console.log(`[LicenseConfirm] Accept form not found (license already accepted). URL: ${page.url()}`);
      console.log(`[LicenseConfirm] Page snippet: ${pageText}`);
      return await doRecoveryFlow(page, page.url(), outlookEmail);
    }

    console.log(`[LicenseConfirm] Found accept form action: ${acceptAction}`);

    // Step 3: Scroll to bottom to trigger the button enable (JS scroll event listener)
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(r => setTimeout(r, 1500));
    // Scroll again slowly to ensure all scroll listeners fire
    await page.evaluate(() => {
      const el = document.scrollingElement || document.documentElement;
      el.scrollTop = el.scrollHeight;
      // Dispatch scroll event manually in case it's needed
      window.dispatchEvent(new Event('scroll'));
      document.dispatchEvent(new Event('scroll'));
    });
    await new Promise(r => setTimeout(r, 1000));

    // Step 4: Remove disabled from button and submit the form
    const submitted = await page.evaluate(() => {
      const form = document.querySelector('form[action*="licenseAgreements/accept_on_order"]');
      if (!form) return false;
      const btn = form.querySelector('button[disabled], button.btn-primary');
      if (btn) btn.removeAttribute('disabled');
      form.submit();
      return true;
    });

    if (!submitted) throw new Error('Failed to submit license accept form');
    console.log(`[LicenseConfirm] License form submitted!`);

    // Wait for navigation after form submit
    try {
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    } catch (e) { /* may already be done */ }
    console.log(`[LicenseConfirm] Post-submit URL: ${page.url()}`);

    console.log(`[LicenseConfirm] Current URL after submit: ${page.url()}`);

    // Step 6: Extract authSessionId from the redirect URL
    // After form submit, JetBrains redirects to /login?authSessionId=XXXX
    // That session ID IS what we need — no need to call POST /api/auth/sessions
    const currentUrl = page.url();
    const urlParams = new URL(currentUrl).searchParams;
    let sessionId = urlParams.get('authSessionId');

    if (sessionId) {
      console.log(`[LicenseConfirm] Got authSessionId from URL: ${sessionId}`);
    } else {
      // Fallback: try to extract from page content or create new session
      console.log(`[LicenseConfirm] No authSessionId in URL. Trying to create session...`);
      // Make sure we're on account.jetbrains.com
      if (!currentUrl.startsWith('https://account.jetbrains.com')) {
        await page.goto('https://account.jetbrains.com', { waitUntil: 'networkidle2', timeout: 20000 });
      }
      sessionId = await page.evaluate(async () => {
        const match = document.cookie.match(/(?:^|;\s*)_st-JBA=([^;]+)/);
        const csrfToken = match ? match[1] : '';
        const headers = { 'Content-Type': 'application/json' };
        if (csrfToken) headers['x-xsrf-token'] = csrfToken;

        const res = await fetch('/api/auth/sessions', {
          method: 'POST',
          headers,
          body: '{}',
          credentials: 'include'
        });
        const text = await res.text();
        const data = JSON.parse(text);
        if (!data.id) throw new Error('No id in: ' + text.substring(0, 200));
        return data.id;
      });
      console.log(`[LicenseConfirm] Created fallback session: ${sessionId}`);
    }

    // Step 7: Trigger email login + password recovery OTP using the session
    // (stays on account.jetbrains.com — same origin, no CORS)
    await page.evaluate(async (sid, email) => {
      const match = document.cookie.match(/(?:^|;\s*)_st-JBA=([^;]+)/);
      const csrfToken = match ? match[1] : '';
      const headers = { 'Content-Type': 'application/json' };
      if (csrfToken) headers['x-xsrf-token'] = csrfToken;

      // Email login — expected to return PasswordNotSet, that's fine
      await fetch(`/api/auth/sessions/${sid}/email/login`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ email }),
        credentials: 'include'
      }).catch(() => {});

      // Trigger password recovery OTP email
      const recovRes = await fetch(`/api/auth/sessions/${sid}/password/recovery`, {
        method: 'POST',
        headers,
        credentials: 'include'
      });
      if (!recovRes.ok) {
        const t = await recovRes.text();
        throw new Error(`passwordRecovery ${recovRes.status}: ${t.substring(0, 200)}`);
      }
    }, sessionId, outlookEmail);

    console.log(`[LicenseConfirm] OTP recovery triggered. Session: ${sessionId}`);
    return sessionId;


  } finally {
    await browser.close();
    if (activeProxyUrl) {
      await proxyChain.closeAnonymizedProxy(activeProxyUrl, true);
    }
  }
}

export async function setAccountPassword(sessionId, otpCode, newPassword) {
  const oldProxyUrl = 'socks5://4w99sxjb5s-corp.mobile.res-country-LV-state-454311-hold-session-session-6a56a9ca21a90:ohh401aJwRYe8xuN@212.8.249.142:443';
  const newProxyUrl = await proxyChain.anonymizeProxy(oldProxyUrl);
  activeProxyUrl = newProxyUrl;

  const browser = await puppeteer.launch({
    headless: 'new',
    channel: 'chrome',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      `--proxy-server=${newProxyUrl}`
    ]
  });

  try {
    const page = await browser.newPage();
    // We navigate to the login page with our sessionId to re-hydrate the CSRF cookies
    await page.goto(`https://account.jetbrains.com/login?authSessionId=${sessionId}`, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Dismiss cookie banner
    try {
      await page.waitForSelector('.ch2-dialog-content, #ch2-dialog', { timeout: 4000 });
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('a, button'));
        const acceptAll = btns.find(b => b.innerText && /accept all|deny all/i.test(b.innerText.trim()));
        if (acceptAll) acceptAll.click();
      });
      console.log('[setAccountPassword] Dismissed cookie banner');
      await new Promise(r => setTimeout(r, 1000));
    } catch(e) {}

    // Instead of using fetch to API, we interact with the DOM directly.
    console.log(`[setAccountPassword] Typing OTP...`);
    
    // Type the 6 digit OTP into the 6 inputs (otp-1 to otp-6)
    for (let i = 0; i < 6; i++) {
      const char = otpCode[i];
      if (char) {
        await page.waitForSelector(`input[name="otp-${i + 1}"]`, { visible: true, timeout: 10000 });
        await page.click(`input[name="otp-${i + 1}"]`, { clickCount: 3 });
        await page.type(`input[name="otp-${i + 1}"]`, char, { delay: 50 });
      }
    }
    
    // Click submit for OTP
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const submitBtn = btns.find(b => b.innerText && /submit/i.test(b.innerText.trim()));
      if (submitBtn) submitBtn.click();
      else {
        const formBtn = document.querySelector('button[type="submit"]');
        if (formBtn) formBtn.click();
      }
    });
    
    console.log(`[setAccountPassword] OTP typed and submitted, waiting for password form...`);
    
    // Wait for password inputs (either newPassword or just password inputs)
    try {
      await page.waitForSelector('input[type="password"]', { visible: true, timeout: 15000 });
      
      const pwdInputs = await page.$$('input[type="password"]');
      if (pwdInputs.length > 0) {
        console.log(`[setAccountPassword] Typing password...`);
        for (const input of pwdInputs) {
          await input.click({ clickCount: 3 });
          await input.type(newPassword, { delay: 50 });
        }
        
        // Click submit for Password
        await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const submitBtn = btns.find(b => b.innerText && /submit|save/i.test(b.innerText.trim()));
          if (submitBtn) submitBtn.click();
          else {
            const formBtn = document.querySelector('button[type="submit"]');
            if (formBtn) formBtn.click();
          }
        });
        
        await new Promise(r => setTimeout(r, 4000));
        console.log(`[setAccountPassword] Password submitted.`);
      }
    } catch(e) {
      const html = await page.evaluate(() => document.body.innerText);
      throw new Error(`Failed to find password fields after OTP: ${e.message}\nPage text: ${html.substring(0, 300)}`);
    }
    
    return true;
  } finally {
    await browser.close();
    if (activeProxyUrl) {
      await proxyChain.closeAnonymizedProxy(activeProxyUrl, true);
    }
  }
}
