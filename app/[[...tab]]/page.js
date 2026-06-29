import ClientPage from './ClientPage';

const titles = {
  'dashboard': 'Дашборд',
  'adobe-list': 'Список аккаунтов',
  'adobe-upload': 'Загрузка аккаунтов',
  'keys-checker': 'Чекер ключей',
  'audit-logs': 'Журнал логов',
  'generator': 'Генерация почт',
  'history': 'История',
  'clients': 'Клиенты'
};

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const tab = resolvedParams?.tab?.[0] || 'dashboard';
  const section = titles[tab] || 'Дашборд';
  
  return {
    title: `${section} - Keysoft panel`,
  };
}

export default async function Page({ params }) {
  const resolvedParams = await params;
  const tab = resolvedParams?.tab?.[0] || 'dashboard';
  
  return <ClientPage initialTab={tab} />;
}
