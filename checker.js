const Database = require('better-sqlite3');
const path = require('path');

async function checkAdobeAccount(email, refresh_token, client_id) {
    try {
        const response = await fetch('https://tools.dongvanfb.net/api/get_messages_oauth2', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email,
                refresh_token,
                client_id,
                list_mail: "all"
            }),
            signal: AbortSignal.timeout(20000)
        });

        const data = await response.json();
        if (!data || data.error) {
             return { error: data?.error || 'Unknown error', messages: [] };
        }
        
        return data;
    } catch (e) {
        console.error(`[AdobeChecker] Error checking ${email}:`, e.message);
        return { error: e.message, messages: [] };
    }
}

async function runAdobeWorker() {
    console.log(`[AdobeChecker] Starting check of all active Adobe accounts at ${new Date().toISOString()}`);
    const db = new Database(path.resolve(process.cwd(), 'emails.db'));

    try {
        const accounts = db.prepare("SELECT id, email, refresh_token, device_id FROM adobe_accounts WHERE status = 'active'").all();
        
        for (const account of accounts) {
            console.log(`[AdobeChecker] Checking ${account.email}...`);
            const result = await checkAdobeAccount(account.email, account.refresh_token, account.device_id);
            
            if (result && result.messages && Array.isArray(result.messages)) {
                // Check if any message implies block
                const isBlocked = result.messages.some(msg => {
                    const subject = (msg.subject || '').toLowerCase();
                    return subject.includes('email address changed') || 
                           subject.includes('suspended') || 
                           subject.includes('deactivated');
                });
                
                if (isBlocked) {
                    console.log(`[AdobeChecker] Account ${account.email} is BLOCKED.`);
                    db.prepare("UPDATE adobe_accounts SET status = 'blocked', checked_at = CURRENT_TIMESTAMP WHERE id = ?").run(account.id);
                } else {
                    db.prepare("UPDATE adobe_accounts SET checked_at = CURRENT_TIMESTAMP WHERE id = ?").run(account.id);
                }
            } else {
                console.log(`[AdobeChecker] Could not fetch messages for ${account.email}.`);
            }
            
            // Avoid rate limiting
            await new Promise(r => setTimeout(r, 2000));
        }
    } catch (e) {
        console.error('[AdobeChecker] Worker failed:', e);
    } finally {
        db.close();
    }
    console.log('[AdobeChecker] Finished check.');
}

// Run immediately and then every 10 minutes (600000 ms)
runAdobeWorker();
setInterval(runAdobeWorker, 600000);
