export async function checkAdobeAccount(email, refresh_token, client_id) {
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
             return { error: data?.error || 'Unknown error', messages: [], isBanned: false };
        }
        
        let isBanned = false;
        if (data.messages && Array.isArray(data.messages)) {
            data.messages = data.messages.map(m => {
                if (m.date) {
                    const parts = m.date.match(/(\d{2}):(\d{2})\s*-\s*(\d{2})\/(\d{2})\/(\d{4})/);
                    if (parts) {
                        const [_, hr, min, day, mo, yr] = parts;
                        const dateObj = new Date(yr, mo - 1, day, hr, min);
                        dateObj.setHours(dateObj.getHours() - 4);
                        
                        const newHr = String(dateObj.getHours()).padStart(2, '0');
                        const newMin = String(dateObj.getMinutes()).padStart(2, '0');
                        const newDay = String(dateObj.getDate()).padStart(2, '0');
                        const newMo = String(dateObj.getMonth() + 1).padStart(2, '0');
                        const newYr = dateObj.getFullYear();
                        
                        m.date = `${newHr}:${newMin} - ${newDay}/${newMo}/${newYr}`;
                    }
                }
                return m;
            });

            isBanned = data.messages.some(m => {
                const subj = (m.subject || '').toLowerCase();
                return subj.includes('fraudulent activity detected') || subj.includes('fraudulent behavior');
            });
        }
        
        return { ...data, isBanned };
    } catch (e) {
        console.error(`[AdobeChecker] Error checking ${email}:`, e.message);
        return { error: e.message, messages: [] };
    }
}
