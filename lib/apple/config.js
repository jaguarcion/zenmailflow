require('dotenv').config();

module.exports = {
    onlinesim: {
        apiKey: process.env.ONLINESIM_API_KEY || 'dd988ca817a1ae6b834a51fbf08125c4',
        service: 'Apple', // Service name for Apple in onlinesim
        country: 77 // Kazakhstan ID
    },
    proxy: {
        server: 'socks5://212.8.249.142:443',
        username: '4w99sxjb5s-corp.mobile.res-country-LV-state-454311-hold-session-session-6a56a9ca21a90',
        password: 'ohh401aJwRYe8xuN',
        refreshUrl: 'https://api.sx.org/proxy/d657d522-7fca-11f1-ae21-bc24114c89e8/refresh-ip' // Добавьте сюда URL для смены IP
    },
    email: {
        imap: {
            user: process.env.IMAP_USER || '',
            password: process.env.IMAP_PASSWORD || '',
            host: process.env.IMAP_HOST || 'imap.migadu.com',
            port: parseInt(process.env.IMAP_PORT || '993', 10),
            tls: true,
            authTimeout: 10000
        }
    },
    db: {
        path: process.env.APPLE_DB_PATH || require('path').join(__dirname, '..', '..', 'apple_accounts.db')
    },
    registration: {
        password: process.env.DEFAULT_PASSWORD || 'AppleId_Pass123!',
        // How long to wait for code (ms)
        codeTimeout: 180000
    }
};
