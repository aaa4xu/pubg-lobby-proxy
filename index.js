const path = require('path');
const AssetsServer = require('./src/AssetsServer');
const WebsocketServer = require('./src/WebsocketServer');

const websocketServer = new WebsocketServer();
const assetsServer = new AssetsServer(websocketServer, path.join(__dirname, 'storage', 'cache'));