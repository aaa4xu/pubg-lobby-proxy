const express = require('express');
const requestJs = require('request');
const path = require('path');
const fs = require('fs');
const md5 = require('md5');
const {promisify} = require('util');
const bodyParser = require('body-parser');
const PubgRequest = require('./Pubg/PubgRequest');
const url = require('url');
const dns = require('dns');

const exists = promisify(fs.exists);
const readFile = promisify(fs.readFile);
const mkdirp = promisify(require('mkdirp'));
const dnsResolve = promisify(dns.resolve4);
const request = promisify(requestJs);

const CACHE_EXTENSIONS = ['png', 'gif', 'jpg', 'woff', 'js'];

class AssetsServer {
    constructor(websocketServer, cachePath = null, port = 8000, assetsUrl = 'prod-live-front.playbattlegrounds.com') {
        this.assetsUrl = assetsUrl;
        this.cachePath = cachePath;
        this.port = port;
        this.wsServer = websocketServer;
        this.server = null;
        this.express = null;
        this.assetsIp = null;

        this.start();
    }

    start() {
        dnsResolve(this.assetsUrl).then(ips => {
            this.assetsIp = ips[Math.floor(Math.random()*ips.length)];
            this.express = express();
            this.express.use(bodyParser.json());
            this.express.get('/index.html', this.handleIndexRequest.bind(this));
            this.express.get('/index-outer.html', this.handleIndexRequest.bind(this));
            this.express.get('/debug.html', this.handleDebugRequest.bind(this));
            this.express.use('/api/:interface/:method', this.handleApiRequest.bind(this));
            this.express.use(this.proxyAssets.bind(this));
            this.server = this.express.listen(this.port, () => {
                console.log(`Assets server started at http://localhost:${this.port}`);
            });
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
        this.getFrontendUri(url.parse(req.url).pathname).then(this.getFrontend.bind(this)).then(html => {
            res.end(html);
        }).catch(err => {
            res.status(500).send(`<h1>Error: ${err.message}</h1>`);
        });
    }

    handleDebugRequest(req, res) {
        if(!this.wsServer.lastAuth) {
            return res.status(500).send('<h1>Error: Login to game first</h1>');
        }

        res.redirect(`/index.html?appid=578080&netid=${this.wsServer.lastAuth.playerNetId}&token=${this.wsServer.lastAuth.ticket}`);
    }

    proxyAssets(req, res, next) {
        console.log('Asset:', req.url);

        if(this.cachePath !== null && CACHE_EXTENSIONS.indexOf(req.url.split('.').pop()) >= 0) {
            const pathInfo = path.parse(req.url.substr(1));

            return this.getAssetCache(pathInfo).catch(err => null).then(content => {
                return this.downloadAsset(req.url, content).then(response => {
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
                const contentEtag = md5(content);

                if(req.headers['if-none-match'] === contentEtag) {
                    return res.status(304).end();
                }

                res.set('Etag', contentEtag);
                res.end(content);
            }).catch(err => {
                res.status(500).end(`<h1>Asset downloading error: ${err.message}</h1>`);
            });
        }

        request({
            url: 'https://' + this.assetsIp + req.url,
            headers: {
                ...req.headers,
                Host: this.assetsUrl,
            },
            encoding: null,
        }).then(response => {
            for(let header in response.headers) {
                res.set(header, response.headers[header]);
            }

            res.end(response.body);
        });
    }

    getFrontendUri(pageUrl = '/index.html') {
        return request({
            url: 'https://' + this.assetsIp + pageUrl,
            gzip: true,
            timeout: 5000,
            headers: {
                Host: this.assetsUrl,
            },
        }).then(response => {
            const uri = response.body.match(/location\.href='(.*?)\?'/i);
            if(!uri) throw new Error('Cant get frontend url');

            return uri[1];
        });
    }

    getFrontend(url) {
        console.log(`Frontend url: ${url}`);

        return request({
            url: 'https://13.32.118.8'+ url.split('https://prod-live-front.playbattlegrounds.com').join(''),
            headers: {
                Host: 'prod-live-front.playbattlegrounds.com',
            },
            gzip: true,
            timeout: 1000,
        }).then(response => this.patchFrontendConfig(response.body));
    }

    downloadAsset(url, currentCache = null) {
        const headers = { Host: this.assetsUrl };
        if(currentCache) {
            headers['If-None-Match'] = md5(currentCache);
        }

        return request({
            url: 'https://13.32.118.8'+ url,
            encoding: null,
            timeout: 5000,
            headers,
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