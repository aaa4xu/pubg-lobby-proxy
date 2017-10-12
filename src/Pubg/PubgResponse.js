const PubgPacket = require('./PubgPacket');

class PubgResponse extends PubgPacket {
    setArguments(args) {
        if(typeof args[0] === 'string') {
            this.interface = args[0];
            this.method = args[1];
            this.arguments = args.splice(2);
        } else {
            this.success = args[0];
            this.arguments = args.splice(1);
        }
    }

    getArguments() {
        return [
            ...(this.interface ? [this.interface, this.method] : [this.success]),
            ...this.arguments,
        ];
    }
}

module.exports = PubgResponse;