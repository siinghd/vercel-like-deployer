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
var shouldDestroy = function (message) {
    var lowerCaseMessage = message.toLowerCase();
    return [
        'error',
        'ERROR',
        'err',
        'ERR',
        'fatal',
        'uncaughtException',
        'critical',
    ].some(function (keyword) { return lowerCaseMessage.includes(keyword.toLowerCase()); });
};
var destroyContainer = function (slug) { return __awaiter(void 0, void 0, void 0, function () {
    var containerId, container, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, redisClient.get("container:".concat(slug))];
            case 1:
                containerId = _a.sent();
                if (!containerId) {
                    console.error('Container not found for slug:', slug);
                    return [2 /*return*/];
                }
                _a.label = 2;
            case 2:
                _a.trys.push([2, 6, , 7]);
                container = docker.getContainer(containerId);
                return [4 /*yield*/, container.stop()];
            case 3:
                _a.sent();
                return [4 /*yield*/, container.remove()];
            case 4:
                _a.sent();
                return [4 /*yield*/, redisClient.del("container:".concat(slug))];
            case 5:
                _a.sent();
                return [2 /*return*/, [true, "Container for ".concat(slug, " has been destroyed.")]];
            case 6:
                error_1 = _a.sent();
                return [2 /*return*/, [false, "Error destroying container for ".concat(slug, ": ").concat(error_1)]];
            case 7: return [2 /*return*/];
        }
    });
}); };
app.post('/deploy', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, githubUrl, envFile, slug;
    return __generator(this, function (_b) {
        _a = req.body, githubUrl = _a.githubUrl, envFile = _a.envFile;
        if (!githubUrl || !validator_1.default.isURL(githubUrl, { require_protocol: true })) {
            return [2 /*return*/, res.status(400).send('A valid GitHub URL is required')];
        }
        slug = generateSlug(githubUrl);
        deployApplication(githubUrl, envFile || '', slug)
            .then(function () { return console.log("Deployment process started for ".concat(slug)); })
            .catch(function (error) {
            return console.error("Error during deployment for ".concat(slug, ": "), error);
        });
        res.send({
            message: 'Deployment started',
            siteUrl: "https://".concat(slug, "-x.hsingh.site"),
            logUrl: "https://api-deployer.hsingh.site/logs/".concat(slug),
        });
        return [2 /*return*/];
    });
}); });
app.get('/logs/:slug', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var slug, logs;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                slug = req.params.slug;
                return [4 /*yield*/, redisClient.get("logs:".concat(slug))];
            case 1:
                logs = _a.sent();
                res.send({ logs: logs || 'No logs available yet.' });
                return [2 /*return*/];
        }
    });
}); });
app.post('/destroy/:slug', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var slug, result, success, message;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                slug = req.params.slug;
                return [4 /*yield*/, destroyContainer(slug)];
            case 1:
                result = _a.sent();
                if (result) {
                    success = result[0], message = result[1];
                    if (success) {
                        res.send({ message: message });
                    }
                    else {
                        res.status(500).send({ message: message });
                    }
                }
                else {
                    res.status(500).send({ message: 'Error destroying container' });
                }
                return [2 /*return*/];
        }
    });
}); });
var deployApplication = function (githubUrl, envFile, slug) { return __awaiter(void 0, void 0, void 0, function () {
    var startLogging, existingContainerId, existingContainer, error_2, availablePort, container, setupScript, exec, error_3;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                startLogging = false;
                _c.label = 1;
            case 1:
                _c.trys.push([1, 19, , 21]);
                return [4 /*yield*/, redisClient.get("container:".concat(slug))];
            case 2:
                existingContainerId = _c.sent();
                if (!existingContainerId) return [3 /*break*/, 10];
                _c.label = 3;
            case 3:
                _c.trys.push([3, 9, , 10]);
                existingContainer = docker.getContainer(existingContainerId);
                return [4 /*yield*/, existingContainer.stop()];
            case 4:
                _c.sent();
                return [4 /*yield*/, existingContainer.remove()];
            case 5:
                _c.sent();
                return [4 /*yield*/, redisClient.del("container:".concat(slug))];
            case 6:
                _c.sent();
                return [4 /*yield*/, redisClient.del("port:".concat(slug))];
            case 7:
                _c.sent();
                return [4 /*yield*/, redisClient.del("logs:".concat(slug))];
            case 8:
                _c.sent();
                return [3 /*break*/, 10];
            case 9:
                error_2 = _c.sent();
                console.error("Error destroying existing container for ".concat(slug, ": "), error_2);
                redisClient.append("logs:".concat(slug), "Error: ".concat(error_2, "\n"));
                return [3 /*break*/, 10];
            case 10: return [4 /*yield*/, portfinder_1.default.getPortPromise()];
            case 11:
                availablePort = _c.sent();
                return [4 /*yield*/, handleDockerImage('ubuntu:focal', slug)];
            case 12:
                _c.sent();
                return [4 /*yield*/, docker.createContainer({
                        name: slug,
                        Image: 'ubuntu:focal',
                        Cmd: ['/bin/bash'],
                        Tty: true,
                        ExposedPorts: (_a = {}, _a[availablePort] = {}, _a),
                        HostConfig: {
                            PortBindings: (_b = {}, _b[availablePort] = [{ HostPort: "".concat(availablePort) }], _b),
                        },
                    })];
            case 13:
                container = _c.sent();
                return [4 /*yield*/, container.start()];
            case 14:
                _c.sent();
                return [4 /*yield*/, redisClient.set("container:".concat(slug), container.id)];
            case 15:
                _c.sent();
                return [4 /*yield*/, redisClient.set("port:".concat(slug), availablePort.toString())];
            case 16:
                _c.sent();
                setupScript = buildSetupScript(githubUrl, envFile, availablePort);
                return [4 /*yield*/, container.exec({
                        AttachStdout: true,
                        AttachStderr: true,
                        Cmd: ['bash', '-c', setupScript],
                    })];
            case 17:
                exec = _c.sent();
                redisClient.append("logs:".concat(slug), "Deployment started.\n");
                return [4 /*yield*/, executeSetupScript(exec, slug)];
            case 18:
                _c.sent();
                return [3 /*break*/, 21];
            case 19:
                error_3 = _c.sent();
                return [4 /*yield*/, redisClient.append("logs:".concat(slug), "Error: ".concat(error_3, "\n"))];
            case 20:
                _c.sent();
                return [3 /*break*/, 21];
            case 21: return [2 /*return*/];
        }
    });
}); };
var handleDockerImage = function (imageName, slug) { return __awaiter(void 0, void 0, void 0, function () {
    var error_4;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 6]);
                return [4 /*yield*/, docker.getImage(imageName).inspect()];
            case 1:
                _a.sent();
                return [3 /*break*/, 6];
            case 2:
                error_4 = _a.sent();
                if (!(error_4.statusCode === 404)) return [3 /*break*/, 4];
                return [4 /*yield*/, docker.pull(imageName)];
            case 3:
                _a.sent();
                redisClient.append("logs:".concat(slug), "Pulled ".concat(imageName, " image.\n"));
                return [3 /*break*/, 5];
            case 4: throw error_4;
            case 5: return [3 /*break*/, 6];
            case 6: return [2 /*return*/];
        }
    });
}); };
var buildSetupScript = function (githubUrl, envFile, availablePort) { return "\n    export DEBIAN_FRONTEND=noninteractive &&\n    apt-get update &&\n    apt-get install -y curl &&\n    curl -sL https://deb.nodesource.com/setup_20.x | bash - &&\n    apt-get upgrade -y &&\n    apt-get install -y git nodejs &&\n    git clone ".concat(githubUrl, " /app &&\n    cd /app &&\n    echo -e \"").concat(envFile.split('\n').join('\\n'), "\" > .env &&\n    npm install -g pnpm &&\n    npm install -g pm2 &&\n    npm install -g sharp &&\n    pnpm install &&\n    pnpm add sharp &&\n    pnpm run build &&\n    PORT=").concat(availablePort, " pm2 start \"pnpm run start\" --no-daemon -o out.log -e err.log\n"); };
var executeSetupScript = function (exec, slug) { return __awaiter(void 0, void 0, void 0, function () {
    var startLogging, execStream, logStream;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                startLogging = false;
                return [4 /*yield*/, exec.start({
                        Detach: false,
                    })];
            case 1:
                execStream = (_a.sent());
                logStream = new stream_1.PassThrough();
                docker.modem.demuxStream(execStream, logStream, logStream);
                logStream.on('data', function (chunk) { return __awaiter(void 0, void 0, void 0, function () {
                    var message;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                message = chunk.toString();
                                if (message.includes('npm'))
                                    startLogging = true;
                                if (!startLogging) return [3 /*break*/, 3];
                                console.error("".concat(slug, ":"), message);
                                return [4 /*yield*/, redisClient.append("logs:".concat(slug), message)];
                            case 1:
                                _a.sent();
                                if (!shouldDestroy(message)) return [3 /*break*/, 3];
                                console.error("Destructive error identified for ".concat(slug, ", initiating container destruction."));
                                return [4 /*yield*/, destroyContainer(slug)];
                            case 2:
                                _a.sent();
                                throw new Error("Deployment aborted for ".concat(slug, " due to critical errors."));
                            case 3: return [2 /*return*/];
                        }
                    });
                }); });
                return [4 /*yield*/, new Promise(function (resolve, reject) {
                        logStream.on('end', resolve);
                        logStream.on('error', reject);
                        execStream.on('end', resolve);
                        execStream.on('error', reject);
                    })];
            case 2:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
var PORT = process.env.PORT || 3000;
app.listen(PORT, function () {
    console.log("Server is running on port ".concat(PORT));
});
