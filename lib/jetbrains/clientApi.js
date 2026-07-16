export const jbApi = {
  initSession: (token) => 
    fetchProxy('/shop/eform/v2/students', null, 'shop', 'GET', token),

  verifyEmail: (personalEmail, token) => 
    fetchProxy('/shop/api/v2/eform/student/verifyEmail', { email: personalEmail }, 'shop', 'POST', token),

  verifyOtp: (personalEmail, otp, token) => 
    fetchProxy('/shop/api/v2/eform/student/verifyOtp', { email: personalEmail, otp }, 'shop', 'POST', token),

  submit: (universityEmail, personalEmail, otp, firstName, lastName, token) => 
    fetchProxy('/shop/api/v2/eform/student/submit', {
      requesterType: 'Student',
      countryIso: 'LV', // Or whatever default
      levelOfStudy: 'Undergraduate',
      universityEmail,
      personalEmail,
      personalEmailOtp: otp,
      firstName,
      lastName,
      isCsOrEngineeringMajorField: false,
      agreementAccepted: true,
      likeToReceiveNews: false,
      under13YearsOld: false,
      applicationType: 'UniversityEmail'
    }, 'shop', 'POST', token),

  emailLogin: (authSessionId, universityEmail, token) => 
    fetchProxy(`/api/auth/sessions/${authSessionId}/email/login`, { email: universityEmail }, 'account', 'POST', token),

  passwordRecovery: (authSessionId, token) => 
    fetchProxy(`/api/auth/sessions/${authSessionId}/password/recovery`, null, 'account', 'POST', token),

  otpEmail: (authSessionId, oneTimePassword, token) => 
    fetchProxy(`/api/auth/sessions/${authSessionId}/otp/email`, { oneTimePassword }, 'account', 'POST', token),

  verifyRequestCode: (code, token) => 
    fetchProxy(`/shop/eform/students/request?code=${code}`, null, 'shop', 'GET', token),

  initAccountSession: (token) => 
    fetchProxy('/api/auth/sessions', '{}', 'account', 'POST', token).then(data => data.id),

  setPassword: (authSessionId, password, token) => 
    fetchProxy(`/api/auth/sessions/${authSessionId}/password`, { password }, 'account', 'POST', token)
};

async function fetchProxy(path, payload, type = 'shop', method = 'POST', token) {
  // Use zenmailflow's internal proxy endpoint
  const url = '/api/jetbrains/proxy';
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  const bodyObj = {
    path,
    type,
    method,
  };

  if (payload && typeof payload === 'object') {
    bodyObj.payload = payload;
  } else if (payload && typeof payload === 'string') {
    bodyObj.payload = JSON.parse(payload);
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(bodyObj)
  });
  
  let data;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    throw new Error(typeof data === 'string' ? data : JSON.stringify(data) || response.statusText);
  }

  return data;
}

// Mail API wrapper for pro100pochta proxy
export const mailApi = {
  generateEmail: async () => {
    const randomStr = Array.from({length: 10}, () => Math.random().toString(36).charAt(2)).join('');
    const res = await fetch(`/api/jetbrains/pro100pochta?path=/?${randomStr}`);
    const text = await res.text();
    // Use regex to extract the email box: ...
    const match = text.match(/<div id="emailbox">([^<]+)<\/div>/i) || text.match(/value="([^"]+@pro100pochta\.com)"/i) || text.match(/([a-zA-Z0-9._-]+@pro100pochta\.com)/i);
    if (!match) throw new Error('Could not parse disposable email from pro100pochta');
    return { loginString: randomStr, email: match[1].trim() };
  },

  pollForOtp: async (loginString, maxAttempts = 15) => {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const queryPath = encodeURIComponent(`/api/get-list-new.php?m=${loginString}`);
        const res = await fetch(`/api/jetbrains/pro100pochta?path=${queryPath}`);
        if (!res.ok) throw new Error('API failed');
        const messages = await res.json();
        
        if (Array.isArray(messages) && messages.length > 0) {
          // Find JetBrains email
          const jbMsg = messages.find(m => m.from && m.from.includes('jetbrains.com'));
          if (jbMsg) {
            const readPath = encodeURIComponent(`/api/get-one-new.php?m=${loginString}&i=${jbMsg.id}`);
            const readRes = await fetch(`/api/jetbrains/pro100pochta?path=${readPath}`);
            const readData = await readRes.json();
            
            if (readData && readData.content) {
              const otpMatch = readData.content.match(/>(\d{6})</) || readData.content.match(/code[^\d]*?(\d{6})/i);
              if (otpMatch) {
                return otpMatch[1];
              }
            }
          }
        }
      } catch (err) {
        console.log('Error polling pro100pochta:', err);
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    throw new Error('Timeout waiting for OTP on pro100pochta');
  }
};
