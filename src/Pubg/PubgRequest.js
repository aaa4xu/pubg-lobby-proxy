const PubgPacket = require('./PubgPacket');

class PubgRequest extends PubgPacket {
    setArguments(args) {
        this.interface = args[0];
        this.method = args[1];
        this.arguments = args.splice(2);
    }

    getArguments() {
        return [
            this.interface,
            this.method,
            ...this.arguments,
        ];
    }
}

module.exports = PubgRequest;