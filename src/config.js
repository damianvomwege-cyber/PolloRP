export const SERVER_URL = (() => {
  const params = new URLSearchParams(window.location.search);
  const override = params.get('ws');
  if (override) return override;

  const host = window.location.hostname;
  const isLocal = host === 'localhost' || host === '127.0.0.1';
  if (isLocal) {
    return 'ws://localhost:3001';
  }

  return 'wss://pollorp.onrender.com';
})();

export function makeRandomName() {
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `Traveler${suffix}`;
}
