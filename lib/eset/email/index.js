import { createEmailApi as createMigadu } from './Migadu.js';
import { createEmailApi as createMailTm } from './MailTm.js';
import { getSetting } from '../../db.js';

/**
 * Returns the configured email provider
 */
export const getEmailProvider = async () => {
  const provider = getSetting('eset_email_provider') || process.env.EMAIL_PROVIDER || 'migadu';
  
  if (provider === 'mailtm') {
    return await createMailTm();
  }
  
  // Default to migadu
  return await createMigadu();
};
