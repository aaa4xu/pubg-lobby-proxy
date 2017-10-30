const fs = require('fs');
const {promisify} = require('util');
const https = require('https');

const readFile = promisify(fs.readFile);

class SslStripServer {
    constructor(certificatePath, keyPath, port=443) {
        this.certificate = readFile(certificatePath);
        this.key = readFile(keyPath);
        this.port = port;
        this.start();
    }

    async start() {
        const [cert, key] = await Promise.all([this.certificate, this.key]);
        this.httpsServer = https.createServer({key, cert}, (req, res) => {
            res.statusCode = 301;
            res.setHeader('Location', 'http://localhost:8000/index.html');
            res.end();
        });

        this.httpsServer.listen(this.port, () => {
            console.log(`SSLStrip server started at http://localhost:${this.port}`);
        });
    }
}

module.exports = SslStripServer;