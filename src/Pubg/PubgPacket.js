class PubgPacket {
    static get TYPES() {
        return { VOID: 0, NORMAL: 1, BYPASS: 2 };
    }

    parse(packet) {
        const data = JSON.parse(packet);
        this.callbackId = data[0];
        this.flags = data[1];
        this.setArguments(data.splice(2));
        return this;
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

    get type() {
        return this.isVoid ? PubgPacket.TYPES.VOID : (this.isNormal ? PubgPacket.TYPES.NORMAL : PubgPacket.TYPES.BYPASS);
    }

    toJSON() {
        return [
            this.callbackId,
            this.flags,
            ...this.getArguments(),
        ];
    }

    static parse(packet) {
        return (new this()).parse(packet);
    }
}

module.exports = PubgPacket;