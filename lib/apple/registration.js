const { faker } = require('@faker-js/faker');
const browserService = require('./browser');
const smsService = require('./services/sms');
const emailService = require('./services/email');
const config = require('./config');

class RegistrationFlow {
    async run() {
        let page;
        try {
            console.log('Generating random user data...');
            const firstName = faker.person.firstName();
            const lastName = faker.person.lastName();
            const password = config.registration.password;
            const birthDate = faker.date.birthdate({ min: 18, max: 50, mode: 'age' });
            
            // Format: MMDDYYYY (depends on region, but often Apple uses localized forms. For US it's MM/DD/YYYY).
            // Let's assume we need separate inputs or a single input. Apple's form often has one text input for date of birth.
            const dobString = `${String(birthDate.getMonth() + 1).padStart(2, '0')}${String(birthDate.getDate()).padStart(2, '0')}${birthDate.getFullYear()}`;

            const emailAccount = await emailService.generateEmail();
            const emailAddress = emailAccount.email;
            
            console.log(`Email: ${emailAddress}`);
            
            console.log('Requesting SMS number...');
            const phoneData = await smsService.getNumber();
            console.log(`Received phone number: ${phoneData.number} (tzid: ${phoneData.tzid})`);

            page = await browserService.init();
            
            console.log('Navigating to Apple ID creation page...');
            await page.goto('https://appleid.apple.com/account');

            // Wait for form to load (Apple ID uses iframes)
            await page.waitForSelector('#aid-create-widget-iFrame');
            const frameElement = await page.$('#aid-create-widget-iFrame');
            const frame = await frameElement.contentFrame();
            if (!frame) throw new Error('Create widget iframe not found');

            await frame.waitForSelector('input[name="firstName"]');
            
            console.log('Filling form...');
            
            // Change Country Region first because changing it re-renders the form and resets fields!
            const countrySelect = frame.locator('select[name="countrySelect"]');
            if (await countrySelect.count() > 0) {
                console.log('Setting Country Region to KAZ...');
                await countrySelect.selectOption({ value: 'KAZ' }).catch(e => console.log('Could not select country KAZ'));
                // Wait for form to re-render after country change
                await page.waitForTimeout(2000); 
            }

            await frame.type('input[name="firstName"]', firstName, { delay: 50 });
            await frame.type('input[name="lastName"]', lastName, { delay: 50 });
            
            // Apple usually has a text/tel field for birthday, let's find the input inside the birthday wrapper
            const monthSelect = frame.locator('select[data-testid="select-month"]');
            const daySelect = frame.locator('select[data-testid="select-day"]');
            const yearSelect = frame.locator('select[data-testid="select-year"]');
            
            if (await monthSelect.count() > 0) {
                const monthStr = String(birthDate.getMonth() + 1).padStart(2, '0');
                const dayStr = String(birthDate.getDate()).padStart(2, '0');
                
                // Day works with '01' to '31'
                await daySelect.selectOption({ value: dayStr }, { timeout: 3000 }).catch(e => console.log('Could not select day'));
                // Month works with '01' to '12'
                await monthSelect.selectOption({ value: monthStr }, { timeout: 3000 }).catch(e => console.log('Could not select month'));
                // Year works with '1990'
                await yearSelect.selectOption({ value: String(birthDate.getFullYear()) }, { timeout: 3000 }).catch(e => console.log('Could not select year'));
            } else {
                // Fallback to single input
                const birthdayInput = frame.locator('.birthday-wrapper input').first();
                if (await birthdayInput.count() > 0) {
                    await birthdayInput.type(dobString, { delay: 50 });
                }
            }

            await frame.type('input[name="appleId"]', emailAddress, { delay: 50 });
            await frame.type('input[name="password"]', password, { delay: 50 });
            await frame.type('input[name="confirmPassword"]', password, { delay: 50 });

            // Change Phone Country Code to match Onlinesim number
            const phoneCodeSelect = frame.locator('select[name="phoneCode"]');
            if (await phoneCodeSelect.count() > 0) {
                let phoneCountryCode = 'EE'; // default
                
                if (config.onlinesim.country === 372) {
                    phoneCountryCode = 'EE';
                    if (phoneData.number.startsWith('+372')) phoneData.number = phoneData.number.replace('+372', '');
                } else if (config.onlinesim.country === 77) {
                    phoneCountryCode = 'KZ';
                    if (phoneData.number.startsWith('+7')) phoneData.number = phoneData.number.replace('+7', '');
                }

                await phoneCodeSelect.selectOption({ value: phoneCountryCode }).catch(e => console.log('Could not select phone code'));
            }

            // Phone country and number.
            await frame.type('input[name="phoneNumber"]', phoneData.number.replace('+', ''), { delay: 50 });

            // Need to press enter on a specific element or use page.keyboard
            await frame.locator('input[name="phoneNumber"]').press('Enter');

            // Wait a bit to let form validate or show captcha
            await page.waitForTimeout(2000);

            // Check for Captcha
            const captchaInput = frame.locator('input[name="captcha"]');
            if (await captchaInput.count() > 0) {
                console.log('Captcha detected! Waiting for user to solve it via Web UI.');
                
                // We can extract the base64 image
                const captchaImg = frame.locator('.captcha-container img, img[src^="data:image"]').first();
                if (await captchaImg.count() > 0) {
                    const src = await captchaImg.getAttribute('src');
                    // We can save it or log it
                    require('fs').writeFileSync('public/captcha.jpg', src.replace(/^data:image\/(jpeg|png);base64,/, ''), 'base64');
                    console.log('Captcha image saved to public/captcha.jpg. Check Web UI.');
                } else {
                    console.log('Warning: Captcha image element not found!');
                }

                // Wait for the captcha input to be filled manually by the user from the web UI
                const Redis = require('ioredis');
                const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
                
                await redis.set('apple_captcha_status', 'waiting', 'EX', 120);
                
                const captchaSolution = await new Promise((resolve, reject) => {
                    let attempts = 0;
                    const interval = setInterval(async () => {
                        attempts++;
                        if (attempts > 60) {
                            clearInterval(interval);
                            await redis.del('apple_captcha_status');
                            reject(new Error('Captcha timeout'));
                            return;
                        }
                        const solution = await redis.get('apple_captcha_solution');
                        if (solution) {
                            clearInterval(interval);
                            await redis.del('apple_captcha_solution');
                            await redis.del('apple_captcha_status');
                            resolve(solution);
                        }
                    }, 2000);
                });
                redis.disconnect();

                console.log(`Received captcha solution from UI: ${captchaSolution}`);
                await frame.type('input[name="captcha"]', captchaSolution, { delay: 100 });
                
                // Submit the captcha
                await frame.locator('button[type="submit"], input[name="captcha"]').last().press('Enter').catch(() => {});

            } else {
                console.log('Submitting form...');
                // Need to press enter on a specific element or use page.keyboard
                await frame.locator('input[name="phoneNumber"]').press('Enter');
            }

            console.log('Waiting for Email code step...');
            // Wait a few seconds for the captcha to process and the UI to update
            await page.waitForTimeout(3000);
            // We need to wait for inputs that handle the verification code.
            // Usually, there are 6 inputs like 'input[id^="char"]' or a single hidden input for code.
            // Apple now uses 'input.form-security-code-input'
            await frame.waitForSelector('input[id*="char0"], input.form-security-code-input, input[name*="code"], input[name="email-code-input"]', { timeout: 120000 }).catch(() => {
                console.log('Could not find email code input. Possibly Captcha failed or blocked.');
            });

            const emailCode = await emailService.getAppleVerificationCode(emailAccount.login, config.registration.codeTimeout);
            console.log(`Received Email Code: ${emailCode}`);
            
            // Fill email code
            // Apple uses 6 separate inputs usually (char0, char1, char2...) or class form-security-code-input
            const codeInputs = await frame.$$('input[id*="char"], input.form-security-code-input');
            if (codeInputs.length === 6) {
                for (let i = 0; i < 6; i++) {
                    await codeInputs[i].type(emailCode[i], { delay: 100 });
                }
            } else {
                // Fallback if it's a single input
                await frame.type('input[name*="code"], input[name="email-code-input"]', emailCode, { delay: 100 });
            }
            
            // Submit email code
            const emailSubmit = frame.locator('button[type="submit"], button[form="verifyEmail"]').last();
            if (await emailSubmit.count() > 0) {
                await emailSubmit.click();
            } else {
                await frame.keyboard.press('Enter');
            }

            console.log('Waiting for SMS code step...');
            // Wait for SMS code input. Apple usually re-renders the same char inputs for SMS.
            await frame.waitForSelector('input[id*="char0"], input.form-security-code-input, input[name*="code"]', { timeout: 120000 }).catch(() => {});
            
            let smsCode = null;
            let smsAttempts = 0;
            const MAX_SMS_ATTEMPTS = 3;
            
            while (!smsCode && smsAttempts < MAX_SMS_ATTEMPTS) {
                smsAttempts++;
                console.log(`Waiting for SMS code for tzid ${phoneData.tzid} (Attempt ${smsAttempts})...`);
                
                try {
                    // Ожидаем СМС ровно 65 секунд (smsService делает проверки)
                    // Если не придет - Promise.race откинет ошибку по таймауту 60 секунд.
                    smsCode = await Promise.race([
                        smsService.getCode(phoneData.tzid, 65000), 
                        new Promise((resolve, reject) => {
                            const checkInterval = setInterval(async () => {
                                try {
                                    const errorTextVisible = await frame.locator('text=/невозможно отправить|Cannot send|Повторите попытку/i').isVisible();
                                    if (errorTextVisible) {
                                        clearInterval(checkInterval);
                                        reject(new Error('Apple blocked this phone number (cannot send SMS)'));
                                    }
                                } catch (e) {}
                            }, 2000);
                            setTimeout(() => { clearInterval(checkInterval); reject(new Error('Timeout waiting for SMS code (60s)')); }, 60000);
                        })
                    ]);
                } catch (e) {
                    console.log(`SMS receiving failed or timed out: ${e.message}`);
                    if (smsAttempts >= MAX_SMS_ATTEMPTS) {
                        throw new Error('Failed to get SMS after maximum attempts.');
                    }
                    console.log('Requesting a new phone number...');
                    
                    // Клик "Не получили код?"
                    const didntReceiveBtn = frame.locator('button').filter({ hasText: /Не получили код\?|Didn't receive a code/i }).first();
                    await didntReceiveBtn.waitFor({ state: 'visible', timeout: 10000 });
                    await didntReceiveBtn.click();
                    await page.waitForTimeout(2000);
                    
                    // Клик "Использовать другой номер"
                    const useAnotherBtn = frame.locator('button').filter({ hasText: /Использовать другой номер|Use a different number/i }).first();
                    await useAnotherBtn.waitFor({ state: 'visible', timeout: 10000 });
                    await useAnotherBtn.click();
                    await page.waitForTimeout(3000);
                    
                    // Получаем новый номер
                    const newPhoneData = await smsService.getNumber();
                    phoneData.number = newPhoneData.number;
                    phoneData.tzid = newPhoneData.tzid;
                    console.log(`Received NEW phone number: ${phoneData.number} (tzid: ${phoneData.tzid})`);
                    
                    // Вводим новый номер в инпут
                    const phoneInput = frame.locator('input[type="tel"], input[name="phoneNumber"]').first();
                    await phoneInput.waitFor({ state: 'visible', timeout: 10000 });
                    await phoneInput.fill('');
                    await page.waitForTimeout(500);
                    
                    // Стираем код страны для ввода, если он подставляется автоматически
                    let numberToEnter = phoneData.number.replace('+', '');
                    if (config.onlinesim.country === 77 && numberToEnter.startsWith('7')) {
                        numberToEnter = numberToEnter.substring(1);
                    } else if (config.onlinesim.country === 372 && numberToEnter.startsWith('372')) {
                        numberToEnter = numberToEnter.substring(3);
                    }
                    
                    await phoneInput.fill(numberToEnter);
                    await page.waitForTimeout(1000);
                    
                    // Нажимаем Продолжить
                    const continueBtn = frame.locator('button[type="submit"]').filter({ hasText: /Продолжить|Continue/i }).first();
                    if (await continueBtn.count() > 0) {
                        await continueBtn.click();
                    } else {
                        await phoneInput.press('Enter');
                    }
                    
                    // Ждем пока форма отправится и снова появится ввод СМС-кода
                    await page.waitForTimeout(3000);
                    await frame.waitForSelector('input[id*="char0"], input.form-security-code-input, input[name*="code"]', { timeout: 15000 }).catch(() => {});
                }
            }
            console.log(`Received SMS Code: ${smsCode}`);
            
            // Fill sms code
            const smsCodeInputs = await frame.$$('input[id*="char"], input.form-security-code-input');
            if (smsCodeInputs.length === 6) {
                for (let i = 0; i < 6; i++) {
                    await smsCodeInputs[i].type(smsCode[i], { delay: 100 });
                }
            } else {
                await frame.type('input[name*="code"], input[name="sms-code-input"]', smsCode, { delay: 100 });
            }
            
            // Submit sms code
            const smsSubmit = frame.locator('button[type="submit"], button[form="verifyPhone"]').last();
            if (await smsSubmit.count() > 0) {
                await smsSubmit.click();
            } else {
                await frame.keyboard.press('Enter');
            }

            // Finish (skip releasing the number to keep it active for a while)
            // await smsService.setOperationOk(phoneData.tzid);

            // Wait for successful login/dashboard
            try {
                // networkidle can timeout if there are lingering background requests, so we use domcontentloaded and catch the error
                await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 });
            } catch (e) {
                console.log('Navigation wait finished or timed out, proceeding to save...');
            }
            
            // --- ДОБАВЛЕНИЕ НОВОГО НОМЕРА ТЕЛЕФОНА ---
            console.log('Начинаем процесс добавления номера телефона на аккаунте...');
            try {
                // Ждем загрузки дашборда
                await page.waitForTimeout(5000);

                // 1. Клик по разделу "Безопасность учетной записи"
                console.log('Ищем раздел "Безопасность учетной записи"...');
                const securityCard = page.locator('button').filter({ hasText: /Безопасность учетной записи|Account Security/i }).first();
                await securityCard.waitFor({ state: 'visible', timeout: 15000 });
                await securityCard.click();
                await page.waitForTimeout(3000);

                // 2. Клик "Добавить номер телефона" (иконка плюса)
                console.log('Нажимаем кнопку "Добавить номер телефона"...');
                let addPhoneBtn = page.locator('button').filter({ hasText: /Добавить номер телефона|Add a trusted phone number/i }).first();
                
                if (await addPhoneBtn.count() === 0) {
                    console.log('Ищем через заголовок списка телефонов...');
                    const phoneCard = page.locator('.card').filter({ has: page.locator('h2, h3', { hasText: /номер.*телефон|phone/i }) }).first();
                    addPhoneBtn = phoneCard.locator('button').first();
                }

                if (await addPhoneBtn.count() === 0) {
                    console.log('Берем кнопку добавления (фоллбэк)...');
                    addPhoneBtn = page.locator('button.button-icon').last();
                }

                await addPhoneBtn.waitFor({ state: 'visible', timeout: 10000 });
                await addPhoneBtn.click();
                await page.waitForTimeout(3000);

                // 3. Выбор страны (США)
                console.log('Выбираем страну (US)...');
                const countrySelect = page.locator('select.form-dropdown-select').first();
                await countrySelect.waitFor({ state: 'visible', timeout: 10000 });
                await countrySelect.selectOption({ value: 'US' });
                await page.waitForTimeout(1000);

                // 4. Ввод номера телефона
                const newPhoneNumber = '2012545058';
                console.log(`Вводим новый номер телефона: ${newPhoneNumber}...`);
                const phoneInput = page.locator('input[type="tel"].form-textbox-input').first();
                await phoneInput.fill(newPhoneNumber);
                await page.waitForTimeout(1000);

                // Запоминаем последние SMS, чтобы найти только новое
                let seenMessagesIds = new Set();
                const axios = require('axios');
                // Добавляем '1' (код США), так как Fanytel API сохраняет номера с кодом страны
                const smsApiUrl = `https://sms.cdk-gpt.ru/api/sms/1${newPhoneNumber}?token=MP3-TmH-ya4-7Q7`;
                
                try {
                    const initRes = await axios.get(smsApiUrl);
                    if (Array.isArray(initRes.data)) {
                        for (let msg of initRes.data) {
                            seenMessagesIds.add(msg.id || msg.message_text);
                        }
                    }
                } catch(e) {
                    console.log('Не удалось получить изначальную историю SMS:', e.message);
                }

                // 5. Нажатие "Продолжить"
                console.log('Нажимаем Продолжить (отправка SMS)...');
                const continueBtn = page.locator('button[type="submit"]').filter({ hasText: /Продолжить|Continue/i }).first();
                await continueBtn.click();

                // 5.1 Проверка на запрос пароля (иногда Apple просит подтвердить пароль аккаунта)
                try {
                    const pwdInput = page.locator('input[type="password"][autocomplete="current-password"]');
                    // Ждем недолго (3 сек), если не появится, то запроса нет
                    await pwdInput.waitFor({ state: 'visible', timeout: 3000 });
                    if (await pwdInput.count() > 0) {
                        console.log('Apple запросил подтверждение пароля. Вводим пароль...');
                        await pwdInput.fill(password);
                        await page.waitForTimeout(500);
                        
                        // Нажимаем Продолжить снова
                        const pwdContinueBtn = page.locator('button[type="submit"]').filter({ hasText: /Продолжить|Continue/i }).last();
                        await pwdContinueBtn.click();
                        await page.waitForTimeout(2000);
                    }
                } catch (e) {
                    // Если пароль не запросили - это нормально, таймаут просто истечет
                    console.log('Подтверждение пароля не потребовалось.');
                }

                // 6. Получение СМС
                console.log('Ожидаем SMS-код для нового номера (проверка каждые 5 сек)...');
                let newSmsCode = null;

                // Ожидаем до 120 секунд (24 попытки по 5 сек)
                for (let i = 0; i < 24; i++) {
                    await page.waitForTimeout(5000);
                    try {
                        const response = await axios.get(smsApiUrl);
                        const messages = response.data;
                        if (Array.isArray(messages)) {
                            for (let msg of messages) {
                                const currentId = msg.id || msg.message_text;
                                if (!seenMessagesIds.has(currentId)) {
                                    seenMessagesIds.add(currentId);
                                    const latestMsgText = msg.message_text || msg.text || '';
                                    const match = latestMsgText.match(/\b(\d{6})\b/);
                                    if (match) {
                                        newSmsCode = match[1];
                                        console.log(`Получен новый SMS-код от Apple: ${newSmsCode}`);
                                        break;
                                    }
                                }
                            }
                        }
                        if (newSmsCode) break;
                    } catch (e) {
                        console.log('Ошибка при обращении к API SMS:', e.message);
                    }
                }

                if (newSmsCode) {
                    // 7. Ввод кода
                    console.log('Вводим SMS-код...');
                    const codeInputs = await page.$$('input.form-security-code-input');
                    if (codeInputs.length === 6) {
                        for (let i = 0; i < 6; i++) {
                            await codeInputs[i].type(newSmsCode[i], { delay: 100 });
                        }
                    } else {
                        const fallbackInput = page.locator('input[type="tel"]').first();
                        await fallbackInput.fill(newSmsCode);
                    }
                    await page.waitForTimeout(1000);

                    // 8. Нажатие финального "Продолжить"
                    const continueSubmitBtn = page.locator('button[type="submit"]').filter({ hasText: /Продолжить|Continue/i }).last();
                    await continueSubmitBtn.click();
                    
                    await page.waitForTimeout(5000); // Ждем пока номер сохранится
                    console.log('Номер телефона успешно добавлен!');
                    
                    // Обновляем данные о номере, чтобы он записался в базу как текущий
                    phoneData.number = newPhoneNumber;
                } else {
                    console.log('Не удалось получить SMS-код за отведенное время.');
                }
            } catch (changeErr) {
                console.log('Произошла ошибка при попытке смены номера:', changeErr.message);
            }
            // --- КОНЕЦ БЛОКА СМЕНЫ НОМЕРА ---

            console.log('Registration successful! Saving to DB...');
            // Save to the main database
            const { insertAppleAccount } = require('../../db.js');
            const accountId = insertAppleAccount(
                emailAddress,
                emailAccount.login,
                password,
                firstName,
                lastName,
                dobString,
                phoneData.number
            );

            console.log(`Saved account ID: ${accountId}`);
            return { success: true, accountId, email: emailAddress, phone: phoneData.number };

        } catch (err) {
            console.error('Registration failed:', err);
            return { success: false, error: err.message };
        } finally {
            if (page) {
                // Закрываем браузер по завершению всех процессов (включая добавление резервного номера)
                await browserService.close();
            }
        }
    }
}

module.exports = new RegistrationFlow();
