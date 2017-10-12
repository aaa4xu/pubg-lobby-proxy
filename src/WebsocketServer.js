const WebSocket = require('ws');
const querystring = require('querystring');
const PubgRequest = require('./Pubg/PubgRequest');
const PubgResponse = require('./Pubg/PubgResponse');

class WebsocketServer {
    constructor(port = 8001) {
        this.port = port;
        this.lastAuth = null;

        this.start();
    }

    start() {
        this.server = new WebSocket.Server({ port: this.port });
        this.server.on('connection', this.handleConnection.bind(this));
        console.log(`Websocket server started at http://localhost:${this.port}`);
    }

    handleConnection(clientSocket, req) {
        const [, encodedUri, query] = req.url.split('/');
        const qs = querystring.parse(query.substr(1));
        const uri = decodeURIComponent(encodedUri);
        console.log('Connection from steamId=', qs.playerNetId);

        console.log(uri + query);
        this.lastAuth = qs;
        const serverSocket = new WebSocket(uri + query);

        // let listeners = [];

        clientSocket.on('message', data => {
            data = new PubgRequest(data);
            console.log('C->S:', data);

            /*if(data.method === 'GetOpenGameInfo') {
                listeners.push(data);
            }*/

            serverSocket.send(JSON.stringify(data));
        });

        serverSocket.on('message', data => {
            data = new PubgResponse(data);

            /*listeners = listeners.filter(listener => {
                if(listener.id === data.id) {
                    data = this.processListener(listener, data);
                    return false;
                }

                return true;
            });*/

            console.log('S->C:', data);
            clientSocket.send(JSON.stringify(data));
        });

        serverSocket.on('error', err => {
            console.log('Client error:', err);
            clientSocket.close();
        });

        serverSocket.on('close', () => {
            console.log('Game server closed connection');
            try {
                clientSocket.close();
            } catch(ignored) {}
        });

        clientSocket.on('close', () => {
            console.log('Game client closed connection');
            try {
                serverSocket.close();
            } catch(ignored) {}
        });
    }

    /*processListener(req, res) {
        if(req.method === 'GetOpenGameInfo') {
            const regionId = 'eu';
            const selectedRegion = res.arguments[0].MatchDescsByRegionAndPartyType[regionId];

            delete res.arguments[0].MatchDescsByRegionAndPartyType[regionId];

            res.arguments[0].MatchDescsByRegionAndPartyType = {
                [regionId]: selectedRegion,
                ...res.arguments[0].MatchDescsByRegionAndPartyType,
            };
        }

        return res;
    }*/
}

module.exports = WebsocketServer;