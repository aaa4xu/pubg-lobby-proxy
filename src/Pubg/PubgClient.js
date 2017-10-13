const PubgRequest = require('./PubgRequest');
const PubgResponse = require('./PubgResponse');
const {EventEmitter} = require('events');
const WebSocket = require('ws');

class PubgClient extends EventEmitter {
    constructor() {
        super();
        this.queue = [];
        this.normalCallbackId = 10000;
        this.bypassCallbackId = 10000000;
        this.socket = null;
    }

    connect(uri) {
        this.socket = new WebSocket(uri);
        this.socket.on('close', this.emit.bind(this, 'close'));
        this.socket.on('error', this.emit.bind(this, 'error'));
        this.socket.on('message', this.handleSocketMessage.bind(this));
        this.startPingPong();
    }

    startPingPong() {
        const pingPongId = setInterval(() => {
            this.execute('UserProxyApi', 'Ping').catch(err => null); // Server dont reply to ping packets
        }, 15000);

        this.socket.on('close', () => clearInterval(pingPongId));
    }

    generateCallbackId(type) {
        return type === PubgRequest.TYPES.VOID ? 0 : (type === PubgRequest.TYPES.NORMAL ? this.normalCallbackId++ : this.bypassCallbackId++);
    }

    execute(api, method, args = [], flags = null, type = PubgRequest.TYPES.NORMAL, timeout = 15000) {
        const packet = new PubgRequest();
        packet.interface = api;
        packet.method = method;
        packet.arguments = args;
        packet.flags = flags;

        return this.executeRequest(packet, type, timeout);
    }

    executeRequest(packet, type = PubgRequest.TYPES.NORMAL, timeout = 15000) {
        packet.callbackId = this.generateCallbackId(type);

        const requestPromise = new Promise((resolve, reject) => {
            try {
                this.send(packet);

                if(!packet.isVoid) {
                    this.queue.push({
                        packet,
                        resolve,
                        reject,
                        createdAt: Date.now(),
                    });
                }
            } catch(err) {
                reject(err);
            }
        });

        if(packet.isVoid) return Promise.resolve(null);

        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Timeout')), timeout);
        });

        return Promise.race([requestPromise, timeoutPromise]);
    }

    send(packet) {
        this.socket.send(JSON.stringify(packet));
    }

    handleSocketMessage(data) {
        const packet = PubgResponse.parse(data);

        if(packet.isVoid) {
            return this.emit('void', packet);
        }

        this.queue = this.queue.filter(item => {
            if(item.packet.id === packet.id) {
                this.emit('packet', {req: item, res: packet});
                item.resolve(packet);
                return false;
            }

            return true;
        });
    }
}

module.exports = PubgClient;