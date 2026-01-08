import fs from 'fs';
import { simpleParser } from 'mailparser';
import { parseGlobalTixEmail } from '../parsers/globaltix-email.parser';

(async () => {
  const raw = fs.readFileSync('sample-email.eml');
  const parsed = await simpleParser(raw);

  const order = parseGlobalTixEmail(parsed);

  console.log(JSON.stringify(order, null, 2));
})();


import { EmailParser } from '../src/services/email-parser';
import fs from 'fs';
import path from 'path';

/**
 * Test script untuk email parser
 * Run: npx ts-node test/test-parser.ts
 */

const parser = new EmailParser();

// Read example email
const exampleEmailPath = path.join(__dirname, '../example-email.txt');
const emailContent = fs.readFileSync(exampleEmailPath, 'utf-8');

console.log('='.repeat(60));
console.log('Testing Email Parser');
console.log('='.repeat(60));
console.log('');

// Parse email
const order = parser.parseGlobalTixEmail(emailContent);

if (order) {
    console.log('✓ Email parsed successfully!\n');
    console.log(parser.formatOrderSummary(order));
    console.log('\nFull Order Object:');
    console.log(JSON.stringify(order, null, 2));
} else {
    console.error('✗ Failed to parse email');
}
