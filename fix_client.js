const fs = require('fs');
let code = fs.readFileSync('app/[[...tab]]/ClientPage.js', 'utf8');

code = code.replace(
  'import JetBrainsStudentEmailsTab from "../components/JetBrainsStudentEmailsTab";',
  'import JetBrainsStudentEmailsTab from "../components/JetBrainsStudentEmailsTab";\nimport JetBrainsOrdersTab from "../components/JetBrainsOrdersTab";'
);

code = code.replace(
  "{ id: 'jetbrains-accounts', label: 'Аккаунты' }",
  "{ id: 'jetbrains-orders', label: 'Оптовые заказы' },\n        { id: 'jetbrains-accounts', label: 'Аккаунты' }"
);

code = code.replace(
  "{activeTab === 'jetbrains' && 'Массовая автоматизация JetBrains'}\r\n                {activeTab === 'jetbrains-accounts' && 'Управление аккаунтами JetBrains'}",
  "{activeTab === 'jetbrains' && 'Массовая автоматизация JetBrains'}\r\n                {activeTab === 'jetbrains-orders' && 'Оптовые заказы JetBrains'}\r\n                {activeTab === 'jetbrains-accounts' && 'Управление аккаунтами JetBrains'}"
);

code = code.replace(
  "activeTab !== 'jetbrains-accounts' && navItems",
  "activeTab !== 'jetbrains-orders' && activeTab !== 'jetbrains-accounts' && navItems"
);

code = code.replace(
  "{activeTab === 'jetbrains' && 'Скрапинг и автоматическая регистрация аккаунтов JetBrains'}\r\n                {activeTab === 'jetbrains-accounts' && 'Просмотр и редактирование списка аккаунтов JetBrains'}",
  "{activeTab === 'jetbrains' && 'Скрапинг и автоматическая регистрация аккаунтов JetBrains'}\r\n                {activeTab === 'jetbrains-orders' && 'Выполнение заявок от оптовых клиентов'}\r\n                {activeTab === 'jetbrains-accounts' && 'Просмотр и редактирование списка аккаунтов JetBrains'}"
);

code = code.replace(
  "{activeTab === 'jetbrains' && <JetBrainsActivationTab token={token} />}\r\n          {activeTab === 'jetbrains-accounts' && <JetBrainsAccountsTab token={token} />}",
  "{activeTab === 'jetbrains' && <JetBrainsActivationTab token={token} />}\r\n          {activeTab === 'jetbrains-orders' && <JetBrainsOrdersTab token={token} />}\r\n          {activeTab === 'jetbrains-accounts' && <JetBrainsAccountsTab token={token} />}"
);

fs.writeFileSync('app/[[...tab]]/ClientPage.js', code);
