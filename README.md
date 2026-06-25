# ZenMailFlow

![Next.js](https://img.shields.io/badge/Next.js-black?style=flat-square&logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=flat-square&logo=sqlite&logoColor=white)

## Описание
ZenMailFlow — это удобный сервис для генерации и управления электронными почтами. 
Позволяет быстро создавать случайные email-адреса, сохранять их в историю, управлять ими и массово выгружать в удобном формате (.txt). Полностью локализован на русский язык.

## Возможности
- 🔐 Доступ по защищенному мастер-токену
- 📧 Массовая генерация почтовых аккаунтов (со сложными безопасными паролями)
- 💾 История сгенерированных адресов (сохраняется в локальной SQLite базе данных)
- 📥 Массовая выгрузка выбранных аккаунтов или всей базы
- 🗑️ Удобное управление (удаление отдельных адресов или полная очистка базы)
- 🌐 Современный UI с поддержкой темной темы и эффекта матового стекла (Glassmorphism)

## Стек
- **Frontend:** Next.js (App Router), React, Vanilla CSS
- **Backend:** Next.js API Routes, SQLite (better-sqlite3)

## Запуск проекта

1. Установите зависимости:
   ```bash
   npm install
   ```
2. Настройте переменные окружения:
   Создайте файл `.env.local` и укажите мастер-токен:
   ```env
   ACCESS_TOKEN=ваш_надежный_пароль
   ```
3. Запустите сервер разработки:
   ```bash
   npm run dev
   ```
4. Откройте `http://localhost:3000` в браузере.
