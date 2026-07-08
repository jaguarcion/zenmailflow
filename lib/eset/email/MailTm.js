import { ofetch } from 'ofetch';
import { ok, err } from 'neverthrow';
import { fakerEN as faker } from '@faker-js/faker';
import { logger as parentLogger } from '../logger.js';
import { buildSocksProxyConnector } from '@jsr/undicijs__proxy';
import { Agent } from 'undici';

const logger = parentLogger.child({ module: 'MailTmEmailApi' });

const randomLogin = () => faker.internet.username().toLowerCase().replace(/[^a-z0-9]/g, '');

export const createEmailApi = async (proxyUrl) => {
  const dispatcher = proxyUrl
    ? new Agent({
      connect: buildSocksProxyConnector(proxyUrl),
    })
    : undefined;

  const client = ofetch.create({
    baseURL: 'https://api.mail.tm',
    headers: {
      'Content-Type': 'application/json',
    },
    ...(dispatcher ? { dispatcher } : {}),
  });

  const mailboxPassword = '1q2w3e4r5t6y!';

  const getDomain = async () => {
    try {
      const response = await client('/domains');
      if (response && response['hydra:member'] && response['hydra:member'].length > 0) {
        return response['hydra:member'][0].domain;
      }
      throw new Error('No domains found');
    } catch (error) {
      throw new Error('Failed to fetch Mail.tm domain', { cause: error });
    }
  };

  const getToken = async (email, password) => {
    try {
      const response = await client('/token', {
        method: 'POST',
        body: { address: email, password },
      });
      return response.token;
    } catch (error) {
      throw new Error('Failed to get Mail.tm token', { cause: error });
    }
  };

  const generateEmailAddress = async () => {
    logger.debug('Creating an email address on Mail.tm');
    try {
      const domain = await getDomain();
      const login = randomLogin() + Math.floor(Math.random() * 10000);
      const address = `${login}@${domain}`;

      await client('/accounts', {
        method: 'POST',
        body: {
          address,
          password: mailboxPassword,
        },
      });

      logger.debug(`Mail.tm mailbox created: ${address}`);

      // mail.tm accounts are not deleted automatically after 2 days (only if inactive) but we can put a dummy expiresAt
      const expiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1_000);

      return ok({
        email: address,
        password: mailboxPassword,
        expiresAt,
      });
    } catch (error) {
      logger.error({ error }, 'Failed to create Mail.tm account');
      return err({ type: 'EmailInitError', error });
    }
  };

  const getInbox = async (externEmail) => {
    const email = externEmail?.email;
    const password = externEmail?.password || mailboxPassword;

    if (!email || !password) {
      return err({ type: 'EmailInboxError', message: 'Email and password required', error: null });
    }

    logger.debug(`Fetching inbox for: ${email}`);
    try {
      const token = await getToken(email, password);
      const response = await client('/messages', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const messages = (response['hydra:member'] || []).map(msg => ({
        id: msg.id,
        from: msg.from?.address || '',
        subject: msg.subject || '',
      }));

      logger.debug(`Inbox fetched ${email} with ${messages.length} messages`);
      return ok(messages);
    } catch (error) {
      return err({ type: 'EmailInboxError', error });
    }
  };

  const readMessage = async (messageId, externEmail) => {
    const email = externEmail?.email;
    const password = externEmail?.password || mailboxPassword;

    if (!email || !password) {
      return err({ type: 'EmailReadError', message: 'Email and password required', error: null });
    }

    try {
      logger.debug(`Reading message in ${email} with ID: ${messageId}`);
      const token = await getToken(email, password);
      const msg = await client(`/messages/${messageId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const messageBody = (msg.html && msg.html.length > 0) ? msg.html[0] : (msg.text || '');
      return ok(messageBody);
    } catch (error) {
      return err({ type: 'EmailReadError', error });
    }
  };

  return {
    generateEmailAddress,
    getInbox,
    readMessage,
  };
};
