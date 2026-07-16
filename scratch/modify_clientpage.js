const fs = require('fs');
let code = fs.readFileSync('app/[[...tab]]/ClientPage.js', 'utf8');

code = code.replace(
  'import JetBrainsAccountsTab from "../components/JetBrainsAccountsTab";',
  'import JetBrainsAccountsTab from "../components/JetBrainsAccountsTab";\nimport JetBrainsStudentEmailsTab from "../components/JetBrainsStudentEmailsTab";'
);

code = code.replace(
  '{ id: \'jetbrains\', label: \'Активация\' },',
  '{ id: \'jetbrains-student\', label: \'Пул почт (Student)\' },\n        { id: \'jetbrains\', label: \'Активация (Manual)\' },'
);

code = code.replace(
  '{activeTab === \'burp-mail\' && \'Временные почты Burp\'}',
  '{activeTab === \'burp-mail\' && \'Временные почты Burp\'}\n                {activeTab === \'jetbrains-student\' && \'Пул студенческих почт для JetBrains\'}'
);

code = code.replace(
  'activeTab !== \'burp-mail\' && activeTab !== \'jetbrains\'',
  'activeTab !== \'burp-mail\' && activeTab !== \'jetbrains-student\' && activeTab !== \'jetbrains\''
);

code = code.replace(
  '{activeTab === \'jetbrains\' && \'Скрапинг и автоматическая регистрация аккаунтов JetBrains\'}',
  '{activeTab === \'jetbrains-student\' && \'Загрузка и автоматическая активация JetBrains через фоновые задачи\'}\n                {activeTab === \'jetbrains\' && \'Скрапинг и автоматическая регистрация аккаунтов JetBrains\'}'
);

code = code.replace(
  '{activeTab === \'jetbrains\' && <JetBrainsActivationTab token={token} />}',
  '{activeTab === \'jetbrains-student\' && <JetBrainsStudentEmailsTab token={token} />}\n          {activeTab === \'jetbrains\' && <JetBrainsActivationTab token={token} />}'
);

fs.writeFileSync('app/[[...tab]]/ClientPage.js', code);
