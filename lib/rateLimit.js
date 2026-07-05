import { connection } from './queue.js';

/**
 * Проверяет лимит запросов для заданного ключа.
 * 
 * @param {string} identifier - Уникальный идентификатор (например, IP адрес или токен)
 * @param {number} limit - Максимальное количество запросов в окно
 * @param {number} windowSeconds - Размер окна в секундах
 * @returns {Promise<boolean>} - true, если лимит не превышен (можно выполнять запрос), false если превышен.
 */
export async function checkRateLimit(identifier, limit = 5, windowSeconds = 60) {
    if (!identifier) return true; // Если идентификатор пустой, пропускаем

    const key = `ratelimit:${identifier}`;
    
    try {
        const current = await connection.incr(key);
        if (current === 1) {
            // Устанавливаем время жизни ключа только при первом запросе
            await connection.expire(key, windowSeconds);
        }
        return current <= limit;
    } catch (err) {
        // В случае падения Redis лучше пропустить запрос, чтобы не сломать API
        console.error('[RateLimit Error]', err);
        return true; 
    }
}
