const fs = require('fs');
const {promisify} = require('util');
const https = require('https');

const readFile = promisify(fs.readFile);

class SslStripServer {
    constructor(certificatePath, keyPath, assetsServer, port=443) {
        this.assetsServer = assetsServer;
        this.certificate = readFile(certificatePath);
        this.key = readFile(keyPath);
        this.port = port;
        this.start();
    }

    async start() {
        const [cert, key] = await Promise.all([this.certificate, this.key]);
        const redirectUri = `http://localhost:${this.assetsServer.port}/index.html`;

        this.httpsServer = https.createServer({key, cert}, (req, res) => {
            res.statusCode = 301;
            res.setHeader('Location', redirectUri);
            res.end();
        });

        this.httpsServer.listen(this.port, () => {
            console.log(`SSLStrip server started at http://localhost:${this.port}`);
        });
    }
}

module.exports = SslStripServer;