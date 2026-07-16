export const jbApi = {
  initSession: () => 
    fetchProxy('/shop/eform/v2/students', null, 'shop', 'GET'),

  verifyEmail: (personalEmail) => 
    fetchProxy('/shop/api/v2/eform/student/verifyEmail', { email: personalEmail }, 'shop'),

  verifyOtp: (personalEmail, otp) => 
    fetchProxy('/shop/api/v2/eform/student/verifyOtp', { email: personalEmail, otp }, 'shop'),

  submit: (universityEmail, personalEmail, otp, firstName, lastName) => 
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
    }, 'shop'),

  emailLogin: (authSessionId, universityEmail) => 
    fetchProxy(`/api/auth/sessions/${authSessionId}/email/login`, { email: universityEmail }, 'account'),

  passwordRecovery: (authSessionId) => 
    fetchProxy(`/api/auth/sessions/${authSessionId}/password/recovery`, null, 'account'),

  otpEmail: (authSessionId, oneTimePassword) => 
    fetchProxy(`/api/auth/sessions/${authSessionId}/otp/email`, { oneTimePassword }, 'account'),

  verifyRequestCode: (code) => 
    fetchProxy(`/shop/eform/students/request?code=${code}`, null, 'shop', 'GET'),

  initAccountSession: () => 
    fetchProxy('/api/auth/sessions', '{}', 'account').then(data => data.id),

  setPassword: (authSessionId, password) => 
    fetchProxy(`/api/auth/sessions/${authSessionId}/password`, { password }, 'account')
};

async function fetchProxy(path, payload, type = 'shop', method = 'POST') {
  // Use zenmailflow's internal proxy endpoint
  const url = '/api/jetbrains/proxy';
  
  const headers = {
    'Content-Type': 'application/json',
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
      const res = await fetch(`/api/jetbrains/pro100pochta?path=/?${loginString}`);
      const text = await res.text();
      // check if any link looks like JetBrains email
      const matchEmailLink = text.match(/href="(\/\?read=[^"]+)"/i);
      if (matchEmailLink) {
        // read email
        const readRes = await fetch(`/api/jetbrains/pro100pochta?path=${matchEmailLink[1]}`);
        const readText = await readRes.text();
        const otpMatch = readText.match(/code[^\d]*?(\d{6})/i) || readText.match(/>(\d{6})</);
        if (otpMatch) {
          return otpMatch[1];
        }
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    throw new Error('Timeout waiting for OTP on pro100pochta');
  }
};
