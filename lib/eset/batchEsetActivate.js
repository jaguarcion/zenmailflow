import 'dotenv/config';
import crypto from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import db, { getSetting } from '../db.js';
import { createHttpActivator } from './http.js';
import { getEmailProvider } from './email/index.js';
import { logger } from './logger.js';

const MAX_PROXY_RETRIES = 10;

const generatePassword = () => {
  const raw = crypto.randomBytes(12).toString('base64url');
  return (`A1a${raw}`).slice(0, 16);
};

const extractTokenFromMessage = (messageBody) => {
  const urlRegex = /https:\/\/login\.eset\.com\/link\/confirmregistration\?token=[\w\d\-]+/g;
  const urls = messageBody.match(urlRegex);
  if (!urls || urls.length === 0) return null;
  try {
    const activationUrl = urls[0];
    const token = new URL(activationUrl).searchParams.get('token');
    return token || null;
  } catch {
    return null;
  }
};

const waitForActivationToken = async (emailApi, externEmail, workerLogger) => {
  for (let attempt = 1; attempt <= 20; attempt++) {
    workerLogger.debug(`Checking inbox for activation email (${attempt}/20)`);
    const inboxResult = await emailApi.getInbox(externEmail);
    if (inboxResult.isErr()) {
      workerLogger.warn({ error: inboxResult.error }, 'Failed to fetch inbox');
      await sleep(10_000);
      continue;
    }

    const activationEmails = inboxResult.value.filter(emailInfo => {
      const fromEset = emailInfo.from.includes('product.eset.com');
      const fromEsetHome = emailInfo.from.includes('ESET HOME');
      return fromEset || fromEsetHome;
    });

    for (const activationEmail of activationEmails) {
      const messageResult = await emailApi.readMessage(activationEmail.id, externEmail);
      if (messageResult.isErr()) {
        workerLogger.warn({ error: messageResult.error }, 'Failed to read activation email');
        continue;
      }

      const token = extractTokenFromMessage(messageResult.value);
      if (token) return token;
    }

    await sleep(10_000);
  }

  throw new Error('Activation email token not found');
};

const parseProxyUrls = () => {
  const proxySetting = getSetting('eset_proxy') || '';
  const rawUrls = proxySetting.split(',').map(proxy => proxy.trim()).filter(Boolean);

  return rawUrls.map(proxyStr => {
    let refreshUrl = null;
    let url = proxyStr;
    const match = proxyStr.match(/\[(.*?)\]$/);
    if (match) {
      refreshUrl = match[1];
      url = proxyStr.replace(/\[.*?\]$/, '');
    }
    
    const parts = url.split('@');
    if (parts.length === 2) {
      const hostPortEtc = parts[1].split(':');
      if (hostPortEtc.length > 2) {
        url = `${parts[0]}@${hostPortEtc[0]}:${hostPortEtc[1]}`;
      }
    }
    
    return { url, refreshUrl, original: proxyStr };
  });
};

const isProxyConnectivityError = (error) => {
  const chunks = [];
  let current = error;
  while (current) {
    if (current.message) chunks.push(String(current.message));
    if (current.code) chunks.push(String(current.code));
    current = current.cause;
  }

  const message = chunks.join(' | ').toLowerCase();
  return message.includes('hostunreachable')
    || message.includes('socks5 proxy rejected connection')
    || message.includes('cannot complete socks5 connection')
    || message.includes('fetcherror')
    || message.includes('fetch failed')
    || message.includes('other side closed')
    || message.includes('socketerror')
    || message.includes('socket hang up')
    || message.includes('405')
    || message.includes('403')
    || message.includes('429');
};

const getProxyMeta = (proxyUrl) => {
  if (!proxyUrl) return { mode: 'direct', host: '' };
  try {
    const url = new URL(proxyUrl);
    return { mode: 'proxy', host: `${url.hostname}:${url.port || 'default'}` };
  } catch {
    return { mode: 'proxy', host: 'invalid-url' };
  }
};

const runSingleActivation = async (proxyUrls, taskId, workerLogger) => {
  const emailApi = await getEmailProvider();
  let currentEmailInfo = null;

  for (let attempt = 1; attempt <= MAX_PROXY_RETRIES; attempt++) {
    const hasProxyPool = proxyUrls.length > 0;
    const proxyObj = hasProxyPool
      ? proxyUrls[Math.floor(Math.random() * proxyUrls.length)]
      : undefined;
    const proxyUrl = proxyObj?.url;
    const proxyRefreshUrl = proxyObj?.refreshUrl;
    const proxyMeta = getProxyMeta(proxyUrl);

    try {
      const activator = createHttpActivator(proxyUrl);

      if (!currentEmailInfo) {
        workerLogger.debug('Generating new email address');
        const emailRes = await emailApi.generateEmailAddress();
        if (emailRes.isErr()) {
          throw new Error(`Failed to generate email: ${emailRes.error?.message || 'Unknown error'}`, { cause: emailRes.error });
        }
        currentEmailInfo = emailRes.value;

        try {
          db.prepare('INSERT INTO eset_emails (email, password, expires_at) VALUES (?, ?, ?)').run(
            currentEmailInfo.email,
            currentEmailInfo.password,
            Math.floor(currentEmailInfo.expiresAt.valueOf() / 1000)
          );
        } catch (e) {}
      }

      const email = currentEmailInfo.email;
      const emailPassword = currentEmailInfo.password;
      const accountPassword = generatePassword();

      workerLogger.info({ email, attempt, mode: proxyMeta.mode, proxyHost: proxyMeta.host }, 'Starting license generation');
      await activator.createAccount(email, accountPassword);

      workerLogger.debug({ email }, 'Waiting for activation token in email');
      const token = await waitForActivationToken(emailApi, { email, password: emailPassword }, workerLogger);

      workerLogger.debug({ email }, 'Activating ESET account with token');
      await activator.activateAccount(token);

      workerLogger.debug({ email }, 'Generating access token for activated account');
      const [accessToken] = await activator.generateAccessToken();

      workerLogger.debug({ email }, 'Activating trial license');
      const licenses = await activator.activateTrialLicense(accessToken);
      if (!licenses || licenses.length === 0) {
        throw new Error('No licenses returned');
      }

      workerLogger.debug({ email }, 'Creating account owner member for license');
      await activator.createAccountOwnerMember(accessToken, email, accountPassword);

      workerLogger.debug({ email }, 'License activated successfully');
      const license = licenses[0];

      try {
        db.prepare('UPDATE eset_emails SET used = 1 WHERE email = ?').run(email);
      } catch (e) {}

      const licenseData = {
        email,
        emailPassword,
        accountPassword,
        licenseKey: license.licenseKey || '',
        productName: license.productName || license.product || '',
        expirationDate: license.expirationDate || '',
      };

      // Update task in DB directly
      try {
        const task = db.prepare('SELECT * FROM eset_tasks WHERE id = ?').get(taskId);
        if (task) {
          const items = JSON.parse(task.items_json || '[]');
          items.push(licenseData);
          db.prepare('UPDATE eset_tasks SET success = success + 1, items_json = ? WHERE id = ?').run(JSON.stringify(items), taskId);
        }
      } catch (e) {
        workerLogger.error('Failed to save to DB', e);
      }

      return true;
    } catch (err) {
      const isProxyError = isProxyConnectivityError(err) || (err.message && err.message.includes('Failed to generate email'));
      const isLastAttempt = attempt >= MAX_PROXY_RETRIES;
      const email = currentEmailInfo ? currentEmailInfo.email : 'N/A';

      if (err.message === 'Email already registered or invalid') {
        workerLogger.warn({ email }, 'Email already registered or invalid. Will generate a new email next attempt.');
        currentEmailInfo = null;
        continue; 
      }

      workerLogger.error(
        { err: err.message, email, attempt, maxAttempts: MAX_PROXY_RETRIES, mode: proxyMeta.mode, proxyHost: proxyMeta.host },
        isProxyError && !isLastAttempt
          ? 'Proxy/IP connection or generation failed. Retrying with next IP if available.'
          : 'Failed to generate license.'
      );

      if (isProxyError && !isLastAttempt) {
        if (proxyRefreshUrl) {
          workerLogger.info({ refreshUrl: proxyRefreshUrl }, 'Refreshing proxy IP');
          try {
            await fetch(proxyRefreshUrl);
            await sleep(10000);
          } catch (e) {}
        } else {
          await sleep(Math.min(30_000, 1_000 * attempt));
        }
        continue;
      }

      return false; // Exhausted retries or non-proxy error
    }
  }
  return false;
};

export const startBatchEsetActivate = async (taskId, totalCount = 10, concurrency = 2) => {
  const proxyUrls = parseProxyUrls();
  const workerLogger = logger.child({ taskId });

  workerLogger.info(`Starting batch activation for task ${taskId}, total: ${totalCount}, concurrency: ${concurrency}`);

  // Set initial status
  db.prepare("UPDATE eset_tasks SET status = 'processing', total = ? WHERE id = ?").run(totalCount, taskId);

  const pool = new Set();
  
  for (let i = 0; i < totalCount; i++) {
    // Check if task was cancelled or deleted
    const task = db.prepare('SELECT status FROM eset_tasks WHERE id = ?').get(taskId);
    if (!task || task.status !== 'processing') {
        workerLogger.info(`Task ${taskId} was cancelled or deleted. Stopping.`);
        break;
    }

    const p = runSingleActivation(proxyUrls, taskId, workerLogger).then(success => {
      if (!success) {
        db.prepare('UPDATE eset_tasks SET error = error + 1 WHERE id = ?').run(taskId);
      }
    }).finally(() => {
      pool.delete(p);
    });

    pool.add(p);

    if (pool.size >= concurrency) {
      await Promise.race(pool);
    }
  }

  await Promise.all(pool);

  // Mark task as complete if it still exists
  try {
      db.prepare("UPDATE eset_tasks SET status = 'success' WHERE id = ? AND status = 'processing'").run(taskId);
      workerLogger.info(`Task ${taskId} finished.`);
  } catch (e) {}
};
