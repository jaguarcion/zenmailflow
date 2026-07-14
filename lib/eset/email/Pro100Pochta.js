import { ofetch } from 'ofetch';
import { ok, err } from 'neverthrow';
import { fakerEN as faker } from '@faker-js/faker';
import { logger as parentLogger } from '../logger.js';
import { buildSocksProxyConnector } from '@jsr/undicijs__proxy';
import { Agent } from 'undici';

const logger = parentLogger.child({ module: 'Pro100PochtaEmailApi' });

const randomLogin = () => faker.internet.username().toLowerCase().replace(/[^a-z0-9]/g, '');

export const createEmailApi = async (proxyUrl) => {
  const dispatcher = proxyUrl
    ? new Agent({
      connect: buildSocksProxyConnector(proxyUrl),
    })
    : undefined;

  const client = ofetch.create({
    baseURL: 'https://pro100pochta.com',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    },
    retry: 0,
    timeout: 15000,
    ...(dispatcher ? { dispatcher } : {}),
  });

  const generateEmailAddress = async () => {
    logger.debug('Creating an email address on Pro100Pochta');
    try {
      const login = randomLogin() + Math.floor(Math.random() * 10000);
      
      const response = await client(`/?${login}`, { responseType: 'text' });
      
      // Extract the email address from HTML
      const emails = [...response.matchAll(/([a-zA-Z0-9.\-_]+@[a-zA-Z0-9.\-_]+\.[a-zA-Z]+)/g)].map(m => m[1]);
      const validEmails = emails.filter(e => e.includes('pro100pochta.com') || e.includes('neuroemailedu.com'));
      
      if (validEmails.length === 0) {
         throw new Error("Could not find email address in HTML response");
      }
      
      const address = validEmails[0];
      
      logger.debug(`Pro100Pochta mailbox created: ${address} for login ${login}`);

      const expiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1_000);

      // We use the 'login' string as the password so we can re-authenticate
      return ok({
        email: address,
        password: login,
        expiresAt,
      });
    } catch (error) {
      logger.error({ error }, 'Failed to create Pro100Pochta account');
      return err({ type: 'EmailInitError', error });
    }
  };

  const getInbox = async (externEmail) => {
    const email = externEmail?.email;
    const login = externEmail?.password; 

    if (!email || !login) {
      return err({ type: 'EmailInboxError', message: 'Email and login required', error: null });
    }

    logger.debug(`Fetching inbox for: ${email}`);
    try {
      const messages = await client(`/api/get-list-new.php?m=${login}`);
      
      const formattedMessages = (messages || []).map(msg => ({
        id: msg.id,
        from: msg.from || '',
        subject: msg.subject || '',
      }));

      logger.debug(`Inbox fetched ${email} with ${formattedMessages.length} messages`);
      return ok(formattedMessages);
    } catch (error) {
      return err({ type: 'EmailInboxError', error });
    }
  };

  const readMessage = async (messageId, externEmail) => {
    const email = externEmail?.email;
    const login = externEmail?.password;

    if (!email || !login) {
      return err({ type: 'EmailReadError', message: 'Email and login required', error: null });
    }

    try {
      logger.debug(`Reading message in ${email} with ID: ${messageId}`);
      const msg = await client(`/api/get-one-new.php?m=${login}&i=${encodeURIComponent(messageId)}`);

      const messageBody = msg.content || '';
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
