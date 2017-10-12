class PubgPacket {
    constructor(packet) {
        const data = JSON.parse(packet);
        this.callbackId = data[0];
        this.flags = data[1];
        this.setArguments(data.splice(2));
    }

    setArguments(args) {
        this.arguments = [];
    }

    getArguments() {
        return this.arguments;
    }

    get id() {
        return Math.abs(this.callbackId);
    }

    get isBypass() {
        return this.id >= 10000000;
    }

    get isVoid() {
        return this.id === 0;
    }

    get isNormal() {
        return this.id >= 10000 && !this.isBypass;
    }

    toJSON() {
        return [
            this.callbackId,
            this.flags,
            ...this.getArguments(),
        ];
    }
}

module.exports = PubgPacket;