import 'dotenv/config';

function required(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return v;
}

export const config = {
  dnsexitApiKey: required('DNSEXIT_API_KEY'),
  baseDomain: (process.env.BASE_DOMAIN || 'bill.work.gd').toLowerCase(),
  mailServer: (process.env.MAIL_SERVER || 'dfssdfsdfdsfgdg.work.gd').toLowerCase(),
  mxPriority: Number(process.env.MX_PRIORITY || 10),
  mxTtl: Number(process.env.MX_TTL || 300),

  botToken: required('BOT_TOKEN'),

  smtpPort: Number(process.env.SMTP_PORT || 25),
  smtpHost: process.env.SMTP_HOST || '0.0.0.0',

  labelLen: Number(process.env.LABEL_LEN || 10),
  storeFile: process.env.STORE_FILE || './data/mailboxes.json',
};
