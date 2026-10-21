/** Never echo a connection URL: it contains credentials. */
export function assertSafeDatabaseTarget(url: string, nodeEnv: string): void {
  if (nodeEnv === 'production') return;
  let target: URL;
  try { target = new URL(url); } catch { throw new Error('Invalid database target'); }
  const local = ['localhost', '127.0.0.1', '::1', '[::1]', 'postgres', 'db'].includes(target.hostname);
  const testDatabase = /(?:^|[_-])test$/.test(decodeURIComponent(target.pathname).slice(1));
  if (!local && !testDatabase) {
    throw new Error('Non-production database access blocked. Use an isolated localhost database or a dedicated database named *_test. Never point development/tests at the production database.');
  }
}
