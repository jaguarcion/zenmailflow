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
             return { error: data?.error || 'Unknown error', messages: [] };
        }
        
        return data;
    } catch (e) {
        console.error(`[AdobeChecker] Error checking ${email}:`, e.message);
        return { error: e.message, messages: [] };
    }
}
