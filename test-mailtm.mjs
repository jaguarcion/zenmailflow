import axios from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent';

const proxyUrl = 'socks5://82.27.118.182:443';
console.log('Using proxy:', proxyUrl);

const httpsAgent = new SocksProxyAgent(proxyUrl);

axios.get('https://api.mail.tm/domains', {
  httpsAgent,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Accept': 'application/json'
  }
}).then(res => {
  console.log('SUCCESS:', res.data);
}).catch(err => {
  console.error('ERROR:', err.message);
  if (err.response) {
     console.error('Response status:', err.response.status);
     console.error('Response body:', err.response.data);
  }
});
