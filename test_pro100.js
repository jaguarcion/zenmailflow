const https = require('https');

https.get('https://pro100pochta.com/api/get-list-new.php?m=testuser124', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('List API:', data);
  });
});
