const axios = require('axios');
const config = require('../config');

class SmsService {
    constructor() {
        this.apiKey = config.onlinesim.apiKey;
        this.service = config.onlinesim.service;
        this.baseUrl = 'https://onlinesim.ru/api';
    }

    async getNumber() {
        try {
            const response = await axios.get(`${this.baseUrl}/getNum.php`, {
                params: {
                    apikey: this.apiKey,
                    service: this.service,
                    country: config.onlinesim.country
                }
            });
            
            if (response.data.response === 1 && response.data.tzid) {
                let number = response.data.number;
                const tzid = response.data.tzid;

                let attempts = 0;
                while (!number && attempts < 15) {
                    await new Promise(r => setTimeout(r, 2000));
                    const stateRes = await axios.get(`${this.baseUrl}/getState.php`, {
                        params: { apikey: this.apiKey, tzid: tzid }
                    });
                    // stateRes.data is an array
                    const state = stateRes.data.find(s => String(s.tzid) === String(tzid));
                    if (state && state.number) {
                        number = state.number;
                    }
                    attempts++;
                }

                if (!number) {
                    throw new Error('Failed to obtain the assigned number from Onlinesim within timeout.');
                }

                return { tzid, number };
            }
            throw new Error('Failed to get number from Onlinesim: ' + JSON.stringify(response.data));
        } catch (err) {
            console.error('SmsService.getNumber error:', err.message);
            throw err;
        }
    }

    async getCode(tzid, timeoutMs = 120000) {
        const startTime = Date.now();
        console.log(`Waiting for SMS code for tzid ${tzid}...`);
        
        while (Date.now() - startTime < timeoutMs) {
            try {
                const response = await axios.get(`${this.baseUrl}/getState.php`, {
                    params: {
                        apikey: this.apiKey,
                        message_to_code: 1, // Get only the code
                        tzid: tzid
                    }
                });

                const state = response.data.find(s => s.tzid === tzid);
                if (state) {
                    if (state.response === 'TZ_NUM_ANSWER' && state.msg) {
                        return state.msg;
                    }
                }
            } catch (err) {
                console.error('SmsService.getCode check error:', err.message);
            }
            // wait 10 seconds before next check
            await new Promise(resolve => setTimeout(resolve, 10000));
        }
        
        throw new Error('Timeout waiting for SMS code');
    }

    async setOperationOk(tzid) {
        try {
            await axios.get(`${this.baseUrl}/setOperationOk.php`, {
                params: { apikey: this.apiKey, tzid: tzid }
            });
        } catch (err) {
            console.error('SmsService.setOperationOk error:', err.message);
        }
    }
}

module.exports = new SmsService();
