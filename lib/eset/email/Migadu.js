import { ofetch } from 'ofetch';
import { ImapFlow } from 'imapflow';
import PostalMime from 'postal-mime';

import { ok, err } from 'neverthrow';
import { fakerEN as faker } from '@faker-js/faker';
import { logger as parentLogger } from '../logger.js';

/** @typedef {import('neverthrow').Result} Result */
/** @typedef {import('../types.js').RuntimeError} RuntimeError */

const logger = parentLogger.child({ module: 'MigaduEmailApi' });
const randomLogin = () => faker.internet.username();

const buildBasicAuth = (user, token) =>
  `Basic ${Buffer.from(`${user}:${token}`).toString('base64')}`;

import { getSetting } from '../../db.js';

const getEnv = (key) => getSetting(`eset_${key.toLowerCase()}`) || process.env[key] || '';

/**
 * @param {string} email 
 * @param {string} password 
 */
const getImapConfig = (email, password) => ({
  host: 'imap.migadu.com',
  port: 993,
  secure: true,
  auth: {
    user: email,
    pass: password,
  },

  logger: logger.child({ submodule: 'ImapFlow' }, { level: 'warn' }),
});

/**
 * @template T
 * @param {string} email 
 * @param {string} password 
 * @param {(client: ImapFlow) => Promise<T>} fn 
 * @returns {Promise<T>}
 */
const withImap = async (email, password, fn) => {
  const client = new ImapFlow(getImapConfig(email, password));
  try {
    await client.connect();
    await client.mailboxOpen('INBOX');
    return await fn(client);
  } finally {
    try {
      await client.logout();
    } catch {
      // ignore logout errors
    }
  }
};

export const createEmailApi = async () => {
  const migaduUser = getEnv('MIGADU_USER');
  const migaduToken = getEnv('MIGADU_TOKEN');
  const migaduDomain = getEnv('MIGADU_DOMAIN');
  const migaduApiBase = 'https://api.migadu.com/v1';

  if (!migaduUser || !migaduToken || !migaduDomain) {
    throw new Error('Missing MIGADU_USER, MIGADU_TOKEN, or MIGADU_DOMAIN env variables');
  }

  const client = ofetch.create({
    baseURL: migaduApiBase,
    headers: {
      Authorization: buildBasicAuth(migaduUser, migaduToken),
      'Content-Type': 'application/json',
    },
  });

  let emailAddress = '';
  const mailboxPassword = '1q2w3e4r5t6y!';

  const createEmailAddress = async () => {
    try {
      logger.debug('Creating Migadu mailbox');
      const localPart = randomLogin();
      const mailboxName = `ESET ${localPart}`;

      const response = await client(`/domains/${migaduDomain}/mailboxes`, {
        method: 'POST',
        body: {
          name: mailboxName,
          local_part: localPart,
          password: mailboxPassword,
        },
      });

      emailAddress = response?.address || `${localPart}@${migaduDomain}`;
      logger.debug(`Migadu mailbox created: ${emailAddress}`);
      return ok();
    } catch (error) {
      return err({ type: 'EmailInitError', error });
    }
  };

  const generateEmailAddress = async () => {
    logger.debug('Creating an email address');

    const posleTomorrow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1_000);
    try {
      const login = randomLogin();
      const createResult = await client(`/domains/${migaduDomain}/mailboxes`, {
        method: 'POST',
        body: {
          name: `ESET ${login}`,
          local_part: login,
          password: mailboxPassword,
          expires_on: posleTomorrow.toISOString().split('T')[0],
          remove_upon_expiry: true,
        },
      });

      if (!createResult?.address) {
        logger.error('Failed to create mailbox: No address returned');
        return err({ type: 'EmailInitError', message: 'No address returned', error: null });
      }

      return ok({
        email: createResult.address,
        password: mailboxPassword,
        expiresAt: posleTomorrow,
      });
    } catch (error) {
      return err({
        type: '',
        error,
      });
    }
  };

  const deleteEmailAddress = async () => {
    if (!emailAddress) {
      return err({ type: 'EmailDeleteError', message: 'Mailbox not initialized', error: null });
    }

    try {
      logger.debug(`Deleting Migadu mailbox: ${emailAddress}`);
      const localPart = emailAddress.split('@')[0];
      await client(`/domains/${migaduDomain}/mailboxes/${localPart}`, {
        method: 'DELETE',
      });

      logger.debug('Migadu mailbox deleted');
      emailAddress = '';
      return ok();
    } catch (error) {
      return err({ type: 'EmailDeleteError', error });
    }
  };

  const getInbox = async (externEmail) => {
    const email = externEmail?.email || emailAddress;
    const password = externEmail?.password || mailboxPassword;

    if (!email || !password) {
      return err({ type: 'EmailInboxError', message: 'Mailbox not initialized', error: null });
    }

    logger.debug(`Fetching inbox via IMAP: ${email}`);
    try {
      const messages = await withImap(email, password, async (imap) => {
        const rawMessages = await imap.fetchAll('*', { envelope: true, uid: true });
        return rawMessages.map(msg => ({
          id: String(msg.uid),
          from: msg.envelope?.from?.[0]?.address || '',
          subject: msg.envelope?.subject || '',
        }));
      });

      logger.debug(`Inbox fetched ${email} with ${messages.length} messages`);
      return ok(messages);
    } catch (error) {
      return err({ type: 'EmailInboxError', error });
    }
  };

  const readMessage = async (messageId, externEmail) => {
    const email = externEmail?.email || emailAddress;
    const password = externEmail?.password || mailboxPassword;
    if (!email || !password) {
      return err({ type: 'EmailReadError', message: 'Mailbox not initialized', error: null });
    }

    try {
      logger.debug(`Reading message in ${email} with ID: ${messageId}`);
      const uid = Number(messageId);
      if (!Number.isFinite(uid)) {
        return err({ type: 'EmailReadError', message: 'Invalid message ID', error: null });
      }

      const messageBody = await withImap(email, password, async (imap) => {
        const message = await imap.fetchOne(uid, { source: true });
        return await PostalMime.parse(message.source || '')
          .then(parsed => parsed.html || '');
      });

      return ok(messageBody);
    } catch (error) {
      return err({ type: 'EmailReadError', error });
    }
  };

  return {
    createEmailAddress,
    getInbox,
    readMessage,
    deleteEmailAddress,

    getEmailAddress: () => emailAddress,

    generateEmailAddress,
  };
};
