import fs from 'fs';
import path from 'path';

export function logRequest(endpoint: string, payload: any) {
  const log = {
    endpoint,
    payload,
    time: new Date().toISOString()
  };

  const logFile = path.join(__dirname, 'requests.log');
  fs.appendFileSync(logFile, JSON.stringify(log) + '\n');

  console.log('📦 Dummy API received:', payload);
}
