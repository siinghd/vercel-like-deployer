"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = require("express");
var dockerode_1 = require("dockerode");
var validator_1 = require("validator");
var portfinder_1 = require("portfinder");
var url_1 = require("url");
var ioredis_1 = require("ioredis");
var stream_1 = require("stream");
require("dotenv/config");
var app = (0, express_1.default)();
var docker = new dockerode_1.default();
var redisClient = new ioredis_1.default(process.env.REDIS_URL || '');
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
portfinder_1.default.basePort = 3001;
app.post('/deploy', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, githubUrl, envFile, slug, multiLine;
    return __generator(this, function (_b) {
        _a = req.body, githubUrl = _a.githubUrl, envFile = _a.envFile;
        console.log(githubUrl, envFile);
        if (!githubUrl || !validator_1.default.isURL(githubUrl, { require_protocol: true })) {
            res.status(400).send('A valid GitHub URL is required');
            return [2 /*return*/];
        }
        slug = generateSlug(githubUrl);
        multiLine = envFile || '';
        // let normalizedEnv = multiLine.trim().replace(/\s*=\s*"/g, '="');
        // normalizedEnv = multiLine.trim().replace(/\s+/g, ' ');
        // // Split the string into individual environment variable declarations
        // // This regex looks for a pattern of 'key=value' pairs
        // const envVariables = normalizedEnv.match(/(\w+=[^\s]+)/g);
        // // Join the variables with a newline character to create a multiline string
        // const envMultiline = envVariables.join('\n');
        deployApplication(githubUrl, envFile || '', slug)
            .then(function () { return console.log("Deployment process started for ".concat(slug)); })
            .catch(function (error) {
            return console.error("Error during deployment for ".concat(slug, ": "), error);
        });
        res.send({ message: 'Deployment started', logUrl: "/logs/".concat(slug) });
        return [2 /*return*/];
    });
}); });
app.get('/logs/:slug', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var slug, logs;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                slug = req.params.slug;
                return [4 /*yield*/, redisClient.get(slug)];
            case 1:
                logs = _a.sent();
                res.send({ logs: logs || 'No logs available yet.' });
                return [2 /*return*/];
        }
    });
}); });
var shouldLogMessage = function (message) {
    var lowerCaseMessage = message.toLowerCase();
    var keywords = ['error', 'ERROR', 'err', 'ERR'];
    return keywords.some(function (keyword) {
        return lowerCaseMessage.includes(keyword.toLowerCase());
    });
};
var deployApplication = function (githubUrl, envFile, slug) { return __awaiter(void 0, void 0, void 0, function () {
    var startLogging, availablePort, error_1, container, containerId, envContent, setupScript, exec, execStream_1, logStream_1, error_2;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                startLogging = false;
                _c.label = 1;
            case 1:
                _c.trys.push([1, 18, , 20]);
                return [4 /*yield*/, portfinder_1.default.getPortPromise()];
            case 2:
                availablePort = _c.sent();
                _c.label = 3;
            case 3:
                _c.trys.push([3, 5, , 9]);
                return [4 /*yield*/, docker.getImage('ubuntu').inspect()];
            case 4:
                _c.sent();
                return [3 /*break*/, 9];
            case 5:
                error_1 = _c.sent();
                if (!(error_1.statusCode === 404)) return [3 /*break*/, 7];
                console.log('Pulling ubuntu:focal image...');
                return [4 /*yield*/, docker.pull('ubuntu:focal')];
            case 6:
                _c.sent();
                return [3 /*break*/, 8];
            case 7: throw error_1;
            case 8: return [3 /*break*/, 9];
            case 9: return [4 /*yield*/, docker.createContainer({
                    name: slug,
                    Image: 'ubuntu:focal',
                    Cmd: ['/bin/bash'],
                    Tty: true,
                    ExposedPorts: (_a = {}, _a[availablePort] = {}, _a),
                    HostConfig: {
                        PortBindings: (_b = {}, _b[availablePort] = [{ HostPort: "".concat(availablePort) }], _b),
                    },
                    //   Env: parseEnvFile(envFile),
                })];
            case 10:
                container = _c.sent();
                return [4 /*yield*/, container.start()];
            case 11:
                _c.sent();
                containerId = container.id;
                return [4 /*yield*/, redisClient.set("container:".concat(slug), containerId)];
            case 12:
                _c.sent();
                return [4 /*yield*/, redisClient.set("port:".concat(slug), availablePort)];
            case 13:
                _c.sent();
                envContent = envFile.split('\n').join('\\n');
                setupScript = "\n            export DEBIAN_FRONTEND=noninteractive &&\n            apt-get update &&\n            apt-get install -y curl &&\n            curl -sL https://deb.nodesource.com/setup_20.x | bash - &&\n            apt-get upgrade -y &&\n            apt-get install -y git nodejs &&\n            git clone ".concat(githubUrl, " /app &&\n            cd /app &&\n            echo -e \"").concat(envContent, "\" > .env &&\n            npm install -g pnpm\n            npm install -g pm2 &&\n            pnpm install &&\n            pnpm run build &&\n            PORT=").concat(availablePort, " pm2 start \"pnpm run start\" --no-daemon -o out.log -e err.log\n        ");
                return [4 /*yield*/, container.exec({
                        AttachStdout: true,
                        AttachStderr: true,
                        Cmd: ['bash', '-c', setupScript],
                    })];
            case 14:
                exec = _c.sent();
                return [4 /*yield*/, exec.start({
                        Detach: false,
                    })];
            case 15:
                execStream_1 = (_c.sent());
                logStream_1 = new stream_1.PassThrough();
                docker.modem.demuxStream(execStream_1, logStream_1, logStream_1);
                logStream_1.on('data', function (chunk) { return __awaiter(void 0, void 0, void 0, function () {
                    var message;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                message = chunk.toString();
                                if (message.includes('npm')) {
                                    startLogging = true;
                                }
                                if (!startLogging) return [3 /*break*/, 2];
                                console.error("".concat(slug, ":"), message);
                                return [4 /*yield*/, redisClient.append(slug, message)];
                            case 1:
                                _a.sent();
                                _a.label = 2;
                            case 2: return [2 /*return*/];
                        }
                    });
                }); });
                return [4 /*yield*/, new Promise(function (resolve, reject) {
                        logStream_1.on('end', resolve);
                        logStream_1.on('error', reject);
                        execStream_1.on('end', resolve);
                        execStream_1.on('error', reject);
                    })];
            case 16:
                _c.sent();
                return [4 /*yield*/, redisClient.append(slug, 'Deployment completed successfully.\n')];
            case 17:
                _c.sent();
                return [3 /*break*/, 20];
            case 18:
                error_2 = _c.sent();
                console.error("Error deploying ".concat(slug, ":"), error_2);
                return [4 /*yield*/, redisClient.append(slug, "Error: ".concat(error_2, "\n"))];
            case 19:
                _c.sent();
                return [3 /*break*/, 20];
            case 20: return [2 /*return*/];
        }
    });
}); };
var generateSlug = function (githubUrl) {
    var parsedUrl = new url_1.URL(githubUrl);
    var pathname = parsedUrl.pathname;
    return pathname.split('/').slice(1, 3).join('-').toLowerCase();
};
var parseEnvFile = function (envFile) {
    return envFile
        .split('\n')
        .filter(function (line) { return line.trim() !== '' && !line.startsWith('#'); })
        .map(function (line) { return line.trim(); });
};
app.post('/destroy/:slug', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var slug, containerId, container, error_3;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                slug = req.params.slug;
                _a.label = 1;
            case 1:
                _a.trys.push([1, 6, , 7]);
                return [4 /*yield*/, redisClient.get("container:".concat(slug))];
            case 2:
                containerId = _a.sent();
                if (!containerId) {
                    res.status(404).send('Container not found');
                    return [2 /*return*/];
                }
                container = docker.getContainer(containerId);
                return [4 /*yield*/, container.stop()];
            case 3:
                _a.sent();
                return [4 /*yield*/, container.remove()];
            case 4:
                _a.sent();
                return [4 /*yield*/, redisClient.del("container:".concat(slug))];
            case 5:
                _a.sent(); // Remove the container ID from Redis
                res.send({ message: "Container for ".concat(slug, " has been destroyed.") });
                return [3 /*break*/, 7];
            case 6:
                error_3 = _a.sent();
                console.error(error_3);
                res.status(500).send("Error destroying container for ".concat(slug, ": ").concat(error_3));
                return [3 /*break*/, 7];
            case 7: return [2 /*return*/];
        }
    });
}); });
var PORT = 3000;
app.listen(PORT, function () {
    console.log("Server is running on port ".concat(PORT));
});
