const WebSocket = require('ws');
const querystring = require('querystring');
const PubgRequest = require('./Pubg/PubgRequest');
const PubgResponse = require('./Pubg/PubgResponse');
const PubgClient = require('./Pubg/PubgClient');

class WebsocketServer {
    constructor(port = 8001) {
        this.port = port;
        this.lastAuth = null;
        this.lastPubgClient = null;

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

        //console.log(uri + query);
        this.lastAuth = qs;
        const pubgClient = this.lastPubgClient = new PubgClient(uri + query);
        pubgClient.connect(uri + query);

        clientSocket.on('message', data => {
            data = PubgRequest.parse(data);
            if(data.isVoid) {
                console.log('C->S:', data);
            }

            const gameClientCallbackId = data.callbackId;
            pubgClient.executeRequest(data, data.type).then(res => {
                data.callbackId = gameClientCallbackId;
                res.callbackId = gameClientCallbackId * -1;

                console.log('RPC:', { request: data, response: res });
                clientSocket.send(JSON.stringify(res));
            }).catch(err => {
                if(err.message === 'Timeout' && data.method === 'Ping') return;
                console.error(`C2S Packet error:`, err);
            });
        });

        pubgClient.on('void', data => {
            console.log('S->C:', data);
            clientSocket.send(JSON.stringify(data));
        });

        pubgClient.on('error', err => {
            console.log('PUBG Client error:', err);
            try {
                clientSocket.close();
            } catch(ignored) {}
        });

        pubgClient.on('close', () => {
            console.log('Game server closed connection');
            try {
                clientSocket.close();
            } catch(ignored) {}
        });

        clientSocket.on('close', () => {
            console.log('Game client closed connection');
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