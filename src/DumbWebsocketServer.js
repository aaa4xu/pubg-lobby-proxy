const WebSocket = require('ws');
const querystring = require('querystring');

class DumbWebsocketServer {
    constructor(port = 8001) {
        this.port = port;
        this.clients = [];
        this.start();
    }

    start() {
        this.server = new WebSocket.Server({ port: this.port });
        this.server.on('connection', this.handleClientConnection.bind(this));
        console.log(`Websocket server started at http://localhost:${this.port}`);
    }

    /**
     *
     * @param {WebSocket} client
     * @param req
     * @private
     */
    handleClientConnection(client, req) {
        const [, encodedUri, query] = req.url.split('/');
        const uri = decodeURIComponent(encodedUri);
        const qs = querystring.parse(query.substr(1));
        console.log('Connection from steamId=', qs.playerNetId);
        console.log(uri + query);

        const server = new WebSocket(uri + query);

        client.on('message', message => {
            console.log('C->S:', message.toString('utf8'));
            server.send(message);
        });

        server.on('message', message => {
            console.log('S->C:', message.toString('utf8'));
            client.send(message);
        });
    }
}

module.exports = DumbWebsocketServer;