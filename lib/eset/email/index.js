import { createEmailApi as createMigadu } from './Migadu.js';
import { createEmailApi as createMailTm } from './MailTm.js';
import { createEmailApi as createPro100 } from './Pro100Pochta.js';
import { getSetting } from '../../db.js';

const createFallbackWrapper = async (proxyUrl, primary, secondary) => {
  const p1 = primary === 'mailtm' ? await createMailTm(proxyUrl) : await createPro100(proxyUrl);
  const p2 = secondary === 'mailtm' ? await createMailTm(proxyUrl) : await createPro100(proxyUrl);
  
  let currentProvider = p1;
  
  return {
    generateEmailAddress: async () => {
       const res = await p1.generateEmailAddress();
       if (res.isErr()) {
          console.warn(`[Fallback] ${primary} failed, switching to ${secondary}...`);
          currentProvider = p2;
          return await p2.generateEmailAddress();
       }
       return res;
    },
    getInbox: async (externEmail) => {
       return await currentProvider.getInbox(externEmail);
    },
    readMessage: async (messageId, externEmail) => {
       return await currentProvider.readMessage(messageId, externEmail);
    }
  };
};

/**
 * Returns the configured email provider
 * @param {string} proxyUrl
 */
export const getEmailProvider = async (proxyUrl) => {
  const provider = getSetting('eset_email_provider') || process.env.EMAIL_PROVIDER || 'migadu';
  
  if (provider === 'mailtm') {
    return await createFallbackWrapper(proxyUrl, 'mailtm', 'pro100pochta');
  }

  if (provider === 'pro100pochta') {
    return await createFallbackWrapper(proxyUrl, 'pro100pochta', 'mailtm');
  }
  
  // Default to migadu
  return await createMigadu(proxyUrl);
};
