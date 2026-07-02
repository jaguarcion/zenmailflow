const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '..', 'config.json');

let config = {
    auth_token: '',
    fingerprint_token: ''
};

function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const data = fs.readFileSync(CONFIG_FILE, 'utf8');
            config = { ...config, ...JSON.parse(data) };
        }
    } catch (e) {
        console.error('Failed to load config:', e.message);
    }
}

function saveConfig(newConfig) {
    try {
        config = { ...config, ...newConfig };
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 4), 'utf8');
    } catch (e) {
        console.error('Failed to save config:', e.message);
    }
}

function getConfig() {
    return config;
}

loadConfig();

module.exports = {
    getConfig,
    saveConfig
};
