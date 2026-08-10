import { Shoukaku, Connectors } from 'shoukaku';
import { Client } from 'discord.js';

const client = new Client({ intents: [] });
const s = new Shoukaku(new Connectors.DiscordJS(client), [{name: 'test', url: 'localhost:2333', auth: 'pass'}], {});
s.on('debug', console.log);
s.on('error', console.error);
client.user = { id: '123' } as any;
client.emit('ready', client as any);
setTimeout(() => console.log('size:', s.nodes.size), 2000);
