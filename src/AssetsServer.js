const express = require('express');
const request = require('request');
const httpProxy = require('http-proxy');
const path = require('path');
const fs = require('fs');
const md5 = require('md5');
const {promisify} = require('util');
const bodyParser = require('body-parser');
const PubgRequest = require('./Pubg/PubgRequest');

const exists = promisify(fs.exists);
const readFile = promisify(fs.readFile);
const mkdirp = promisify(require('mkdirp'));

const CACHE_EXTENSIONS = ['png', 'gif', 'jpg', 'woff', 'js'];

class AssetsServer {
    constructor(websocketServer, cachePath = null, port = 80, originalFrontend = 'front.battlegroundsgame.com', assetsUrl = 'prod-live-front.playbattlegrounds.com') {
        this.frontend = originalFrontend;
        this.assetsUrl = assetsUrl;
        this.cachePath = cachePath;
        this.port = port;
        this.wsServer = websocketServer;
        this.server = null;
        this.express = null;
        this.proxy = httpProxy.createProxyServer({ rejectUnauthorized: false });

        this.start();
    }

    start() {
        this.express = express();
        this.express.use(bodyParser.json());
        this.express.get('/index.html', this.handleIndexRequest.bind(this));
        this.express.get('/debug.html', this.handleDebugRequest.bind(this));
        this.express.post('/api/:interface/:method', this.handleApiRequest.bind(this));
        this.express.use(this.proxyAssets.bind(this));
        this.server = this.express.listen(this.port, () => {
            console.log(`Assets server started at http://localhost:${this.port}`);
        });
    }

    handleApiRequest(req, res) {
        const params = {
            ...{type: PubgRequest.TYPES.NORMAL, flags: null, arguments: []},
            ...req.body,
            ...req.params,
        };

        if(!this.wsServer.lastPubgClient) {
            return res.json({
                success: false,
                error: 'Connection to game server dont exists',
            });
        }

        this.wsServer.lastPubgClient.execute(params.interface, params.method, params.arguments, params.flags, params.type).then(result => {
            res.json({
                success: true,
                result,
            });
        }).catch(err => {
            res.status(500).json({
                success: false,
                error: err.message,
            });
        })
    }

    handleIndexRequest(req, res) {
        // @TODO Cache
        this.getFrontendUri().then(this.getFrontend.bind(this)).then(html => {
            res.end(html);
        }).catch(err => {
            res.status(500).send('<h1>Error: ${err.message}</h1>');
        });
    }

    handleDebugRequest(req, res) {
        if(!this.wsServer.lastAuth) {
            return res.status(500).send('<h1>Error: Login to game first</h1>');
        }

        res.redirect(`/index.html?appid=578080&netid=${this.wsServer.lastAuth.playerNetId}&token=${this.wsServer.lastAuth.ticket}`);
    }

    proxyAssets(req, res, next) {
        console.log('Assets:', req.url);

        /*if(req.url === '/2017.09.14-2017.10.03-560/main.4a07a90c7d76689ac3c6.bundle.js') {
            console.log('============================');
            return promisify(fs.readFile)('./main.2955e9108ec5175f3c1c.bundle.js', 'utf8').then(content => res.end(content));
        }*/

        if(this.cachePath !== null && CACHE_EXTENSIONS.indexOf(req.url.split('.').pop()) >= 0) {
            const pathInfo = path.parse(req.url.substr(1));

            return this.getAssetCache(pathInfo).catch(err => null).then(content => {
                return this.downloadAsset(`https://${this.assetsUrl}${req.url}`, content).then(response => {
                    if(response.statusCode === 304) return content;
                    if(response.statusCode !== 200) throw new Error(`Asset downloading to cache error: statusCode=${response.statusCode}`);

                    // Write asset cache
                    const cacheAssetPath = path.join(this.cachePath, pathInfo.dir, `${pathInfo.name}${pathInfo.ext}`);
                    promisify(fs.writeFile)(cacheAssetPath, response.body).catch(err => {
                        console.log('Write asset cache error:', err);
                    });

                    return response.body;
                });
            }).then(content => {
                res.end(content);
            }).catch(err => {
                res.status(500).end(`<h1>Asset downloading error: ${err.message}</h1>`);
            });
        }

        req.headers.host = this.assetsUrl;
        this.proxy.web(req, res, { target: `https://${this.assetsUrl}/` });
    }

    getFrontendUri() {
        return new Promise((resolve, reject) => {
            request({
                url: 'http://13.32.118.176/index.html',
                gzip: true,
                timeout: 5000,
                headers: {
                    Host: this.frontend,
                },
            }, (err, response, html) => {
                if(err) return reject(new Error('Cant get frontend redirect'));

                const uri = html.match(/location\.href='(.*?)\?'/i);
                if(!uri) return reject(new Error('Cant get frontend url'));

                resolve(uri[1]);
            });
        });
    }

    getFrontend(url) {
        return new Promise((resolve, reject) => {
            request({
                url,
                gzip: true,
                timeout: 1000,
            }, (err, response, html) => err ? reject(err) : resolve(this.patchFrontendConfig(html)));
        });
    }

    downloadAsset(url, currentCache = null) {
        const headers = {};
        if(currentCache) {
            headers['If-None-Match'] = md5(currentCache);
        }

        return new Promise((resolve, reject) => {
            request({
                url,
                encoding: null,
                timeout: 5000,
                headers,
            }, (err, response) => err ? reject(err) : resolve(response));
        });
    }

    getAssetCache(pathInfo) {
        const cacheAssetDir = path.join(this.cachePath, pathInfo.dir);
        const cacheAssetPath = path.join(cacheAssetDir, `${pathInfo.name}${pathInfo.ext}`);

        return this.ensureAssetCacheDirectory(cacheAssetDir)
            .then(() => exists(cacheAssetPath))
            .then(exists => {
                if(!exists) throw new Error(`Asset cache dont exists`);
                return readFile(cacheAssetPath, null);
            });
    }

    ensureAssetCacheDirectory(path) {
        return exists(path).then(exists => exists || mkdirp(path));
    }

    patchFrontendConfig(html) {
        const config = html.match(/var broConfiguration =\W+(.*)/i);
        if(!config) throw new Error('Cant find broConfiguration');

        let broConfiguration = null;
        try {
            broConfiguration = JSON.parse(config[0].substr(22));
        } catch(ignored) {
            throw new Error('Cant parse broConfiguration json');
        }

        broConfiguration.gate = `http://127.0.0.1:${this.port}/index.html`;
        broConfiguration.uri = `http://127.0.0.1:${this.port}/publicproxy`;
        broConfiguration.entry = `ws://127.0.0.1:${this.wsServer.port}/${encodeURIComponent(broConfiguration.entry)}/`;
        broConfiguration.secureEntry = `ws://127.0.0.1:${this.wsServer.port}/${encodeURIComponent(broConfiguration.secureEntry)}/`;

        html = html.replace(config[0], `var broConfiguration = ${JSON.stringify(broConfiguration, null, 2)}`);

        return html;
    }
}

module.exports = AssetsServer;