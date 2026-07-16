"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, PlayCircle, Loader2 } from "lucide-react";
import { jbApi, mailApi } from "../../lib/jetbrains/clientApi";

const firstNames = ['John', 'Jane', 'Michael', 'Emily', 'William', 'Olivia', 'James', 'Sophia', 'Benjamin', 'Isabella', 'Daniel', 'Mia', 'Matthew', 'Charlotte', 'Joseph', 'Amelia'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas'];

function generateRandomName() {
  const first = firstNames[Math.floor(Math.random() * firstNames.length)];
  const last = lastNames[Math.floor(Math.random() * lastNames.length)];
  return { first, last };
}

// IMAP API wrappers
async function getAuthSessionId(email, pass, token) {
  const res = await fetch('/api/jetbrains/imap/get-auth-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ email, pass })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to get auth link from IMAP');
  return data.authSessionId;
}

async function getRecoveryOtp(email, pass, token) {
  const res = await fetch('/api/jetbrains/imap/get-recovery-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ email, pass })
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.otp;
}

async function confirmLicense(code, email, token) {
  const res = await fetch('/api/jetbrains/imap/confirm-license', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ code, email })
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.sessionId;
}

async function getAcceptLink(email, pass, token) {
  const res = await fetch('/api/jetbrains/imap/get-accept-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ email, pass })
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || 'Failed to get accept link');
  return data.acceptLink;
}

export default function JetBrainsActivationTab({ token }) {
  const [accountsInput, setAccountsInput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState([]);
  const [results, setResults] = useState([]);

  const logsEndRef = useRef(null);
  const resultsEndRef = useRef(null);

  useEffect(() => {
    if (logsEndRef.current) logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    if (resultsEndRef.current) resultsEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [results]);

  const addLog = (msg, isError = false) => {
    const timestamp = new Date().toLocaleTimeString();
    const formatted = `[${timestamp}] ${msg}`;
    setLogs(prev => [...prev, { text: formatted, isError }]);
  };

  const addResult = (email, password) => {
    setResults(prev => [...prev, `${email} : ${password}`]);
  };

  const startAutomation = async () => {
    if (isRunning) return;
    const lines = accountsInput.split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length === 0) {
      addLog('No accounts provided.', true);
      return;
    }

    setIsRunning(true);
    addLog(`Starting automation for ${lines.length} account(s)...`);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const parts = line.split(':');
      if (parts.length < 2) {
        addLog(`[Account ${i + 1}/${lines.length}] Invalid format: ${line}`, true);
        continue;
      }
      const outlookEmail = parts[0].trim();
      const outlookPass = parts.slice(1).join(':').trim(); // in case pass has ':'
      const jetbrainsPass = outlookPass; // Use same password

      const { first, last } = generateRandomName();
      addLog(`\n--- [Account ${i + 1}/${lines.length}] Processing ${outlookEmail} ---`);
      addLog(`Using generated name: ${first} ${last}`);

      try {
        // Step 0: Initialize JetBrains session
        addLog('0. Initializing JetBrains session (fetching CSRF token)...');
        await jbApi.initSession();

        // Step 1: Get disposable email
        addLog('1. Generating disposable pro100pochta email...');
        const { loginString, email: personalEmail } = await mailApi.generateEmail();
        addLog(`Generated personal email: ${personalEmail}`);

        // Step 2: Send Verify Email
        addLog('2. Sending Verify Email request to JetBrains...');
        await jbApi.verifyEmail(personalEmail);

        // Step 3: Wait for OTP on pro100pochta
        addLog('3. Waiting for JetBrains OTP on pro100pochta...');
        const otp = await mailApi.pollForOtp(loginString);
        addLog(`Received OTP: ${otp}`);

        // Step 4: Verify OTP
        addLog('4. Verifying OTP...');
        await jbApi.verifyOtp(personalEmail, otp);

        // Step 5: Submit Registration
        addLog(`5. Submitting student details (University Email: ${outlookEmail})...`);
        let isAlreadyUsed = false;
        try {
          await jbApi.submit(outlookEmail, personalEmail, otp, first, last);
        } catch (submitErr) {
          if (submitErr.message && submitErr.message.includes('AlreadyUsedForLicenseRequest')) {
            addLog(`ℹ️ Email ${outlookEmail} already used (license confirmed). Skipping to direct recovery...`);
            isAlreadyUsed = true;
          } else {
            throw submitErr;
          }
        }

        let accountAuthSessionId;

        if (isAlreadyUsed) {
          // License already accepted — get the accept link from email, navigate to it, do recovery
          addLog('6. Getting accept link from Gmail inbox...');
          const acceptLink = await getAcceptLink(outlookEmail, outlookPass, token);
          addLog(`Accept link: ${acceptLink}`);
          addLog('7. Navigating to accept link and starting recovery flow...');
          accountAuthSessionId = await confirmLicense(acceptLink, outlookEmail, token);
          addLog(`Recovery session ready: ${accountAuthSessionId}`);
        } else {
          // Step 6: Wait for "Complete Registration" email with code
          addLog('6. Connecting to Gmail/Outlook to await "Complete Registration" email (may take up to 60s)...');
          const requestCode = await getAuthSessionId(outlookEmail, outlookPass, token);
          addLog(`Extracted request code: ${requestCode}`);

          // Step 7: Accept License, Init Session & Trigger Password Recovery
          addLog('7. Accepting license and setting up account session...');
          accountAuthSessionId = await confirmLicense(requestCode, outlookEmail, token);
          addLog(`Account session ready: ${accountAuthSessionId}`);
        }

        // Step 8: Wait for JetBrains OTP email
        addLog('8. Waiting for JetBrains OTP email...');
        const otpCode = await getRecoveryOtp(outlookEmail, outlookPass, token);
        addLog(`Extracted OTP: ${otpCode}`);

        // Step 9: Verify OTP and Set Password via Backend
        addLog('9. Verifying OTP and Setting Password...');
        const setPassRes = await fetch('/api/jetbrains/imap/set-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ 
            email: outlookEmail, 
            sessionId: accountAuthSessionId, 
            otp: otpCode, 
            password: jetbrainsPass 
          })
        });
        
        if (!setPassRes.ok) {
          throw new Error(await setPassRes.text());
        }
        
        const setPassData = await setPassRes.json();
        if (setPassData.error) throw new Error(setPassData.error);

        addLog(`✅ SUCCESS: Account ${outlookEmail} created and verified!`);
        addResult(outlookEmail, jetbrainsPass);

      } catch (err) {
        addLog(`❌ FAILED for ${outlookEmail}: ${err.message}`, true);
        console.error(err);
      }

    }

    addLog('\n=== Automation Finished ===');
    setIsRunning(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">JetBrains Активация</CardTitle>
          <CardDescription>
            Вставьте ваши Outlook/Gmail аккаунты в формате <code>email:password</code> (по одному на строку). Система обработает их последовательно, используя Pro100Pochta для получения OTP.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            className="min-h-[150px] font-mono text-sm"
            placeholder="example1@outlook.com:Pass123!&#10;example2@outlook.com:Pass456!"
            value={accountsInput}
            onChange={(e) => setAccountsInput(e.target.value)}
            disabled={isRunning}
          />
          <div className="flex items-center gap-4">
            <Button onClick={startAutomation} disabled={isRunning} className="w-full sm:w-auto">
              {isRunning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Обработка...
                </>
              ) : (
                <>
                  <PlayCircle className="mr-2 h-4 w-4" /> Запустить автоматизацию
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="flex flex-col">
          <CardHeader className="py-4 border-b shrink-0">
            <CardTitle className="text-base text-muted-foreground flex items-center gap-2">
              <Zap className="w-4 h-4" /> Журнал выполнения
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            <div className="h-[300px] overflow-y-auto p-4 bg-muted/30 font-mono text-xs rounded-b-lg">
              {logs.map((log, i) => (
                <div key={i} className={`mb-1 ${log.isError ? 'text-red-500' : 'text-emerald-500'}`}>
                  {log.text}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="py-4 border-b shrink-0">
            <CardTitle className="text-base text-muted-foreground">Успешные регистрации</CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            <div className="h-[300px] overflow-y-auto p-4 bg-muted/30 font-mono text-sm rounded-b-lg text-foreground">
              {results.map((res, i) => (
                <div key={i} className="mb-1">{res}</div>
              ))}
              {results.length === 0 && <div className="text-muted-foreground/60 text-xs italic">Пока нет завершенных аккаунтов...</div>}
              <div ref={resultsEndRef} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
