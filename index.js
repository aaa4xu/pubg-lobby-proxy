const path = require('path');
const AssetsServer = require('./src/AssetsServer');
const WebsocketServer = require('./src/WebsocketServer');
const SslStripServer = require('./src/SslStripServer');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

process.on('unhandledRejection', err => {
    console.error(`Unhandled promise rejection:`, err);
    process.exit(-1);
});

const websocketServer = new WebsocketServer();
const assetsServer = new AssetsServer(websocketServer, path.join(__dirname, 'storage', 'cache'));
const sslStripServer = new SslStripServer(path.join(__dirname, 'storage', 'https', 'mockserver.crt'), path.join(__dirname, 'storage', 'https', 'mockserver.key'), assetsServer);