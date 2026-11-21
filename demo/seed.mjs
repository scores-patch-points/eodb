import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openLog, say } from '../facade/db.mjs';
import { group, lend } from '../facade/grant.mjs';
import { defineSite } from '../facade/site.mjs';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'log');

const alice = await openLog({ dir, writer: 'alice', store: 'lazy' });
await say(alice, 'add', 'contact:ana', { name: 'Ana Reyes', phone: '555-0101', email: 'ana@x.io' });
await say(alice, 'add', 'contact:zed', { name: 'Zed', phone: '555-9999', email: 'zed@x.io' });
await group(alice, 'team', ['dave']);
await lend(alice, { to: 'carol', scope: { addr: 'contact:ana', fields: ['name'] } });
await lend(alice, { to: 'group:team', scope: { kind: 'contact' } });
await lend(alice, { to: '*', scope: { addr: 'contact:ana', fields: ['name'] } });
await defineSite(alice, { title: 'My Contacts', pages: [{ path: '/', title: 'Contacts', kind: 'contact' }] });

console.log(JSON.stringify({ seeded: dir }));
