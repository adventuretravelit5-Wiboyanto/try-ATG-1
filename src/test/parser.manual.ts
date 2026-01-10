import fs from 'fs';
import path from 'path';
import { simpleParser } from 'mailparser';
import { parseGlobalTixEmail } from '../parsers/globaltix-email.parser';

/**
 * Manual test for GlobalTix email parser
 * Run:
 * npx ts-node src/test/parser.manual.ts
 */

(async () => {
    try {
        // 🔑 Ambil file dari ROOT project
        const emailPath = path.resolve(
            process.cwd(),
            'sample-email.eml'
        );

        const rawEmail = fs.readFileSync(emailPath);

        const parsedMail = await simpleParser(rawEmail);

        const order = parseGlobalTixEmail(parsedMail);

        console.log('='.repeat(60));
        console.log('Parsed Order Result');
        console.log('='.repeat(60));
        console.log(JSON.stringify(order, null, 2));

    } catch (err) {
        console.error('❌ Parser test failed:', err);
    }
})();
