import dotenv from 'dotenv';
dotenv.config();

const requiredEnvVars = ['TOKEN', 'CLIENT_ID'];
const missingEnvVars = requiredEnvVars.filter(key => !process.env[key]);

if (missingEnvVars.length > 0) {
    console.error(`\x1b[31m[CRITICAL ERROR] Missing required environment variables: ${missingEnvVars.join(', ')}\x1b[0m`);
    console.error(`\x1b[31mPlease check your .env file before starting the bot.\x1b[0m`);
    process.exit(1);
}

let lavalinkNodes: Array<{ name: string, url: string, auth: string, secure: boolean }> = [];
const nodesEnv = process.env.LAVALINK_NODES?.trim();

if (nodesEnv && nodesEnv !== '[]' && nodesEnv !== 'null') {
    try {
        const parsed = JSON.parse(nodesEnv);
        if (Array.isArray(parsed) && parsed.length > 0) {
            lavalinkNodes = parsed;
        } else {
            console.error(`\x1b[31m[CRITICAL ERROR] LAVALINK_NODES must be a non-empty array if provided.\x1b[0m`);
            process.exit(1);
        }
    } catch (e) {
        console.error(`\x1b[31m[CRITICAL ERROR] Failed to parse LAVALINK_NODES environment variable.\x1b[0m`);
        process.exit(1);
    }
} else {
    if (!process.env.LAVALINK_HOST || !process.env.LAVALINK_PASSWORD) {
        console.error(`\x1b[31m[CRITICAL ERROR] Missing LAVALINK_HOST and LAVALINK_PASSWORD environment variables.\x1b[0m`);
        process.exit(1);
    }
    lavalinkNodes = [
        {
            name: 'Node 1',
            url: process.env.LAVALINK_HOST,
            auth: process.env.LAVALINK_PASSWORD,
            secure: process.env.LAVALINK_SECURE === 'true',
        }
    ];
}

if (lavalinkNodes.length === 0) {
    console.error(`\x1b[31m[CRITICAL ERROR] No Lavalink nodes configured.\x1b[0m`);
    process.exit(1);
}

const configuredNodesStr = lavalinkNodes.map((n) => n.name).join(', ');
console.log(`Configured Lavalink nodes: ${configuredNodesStr}`);

export const config = {
    bot: {
        token: process.env.TOKEN!,
        clientId: process.env.CLIENT_ID!,
    },
    lavalink: lavalinkNodes,
    port: parseInt(process.env.PORT || '3000', 10)
};
