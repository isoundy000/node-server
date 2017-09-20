"use strict";
exports.__esModule = true;
var express = require("express");
var bodyParser = require("body-parser");
var multer = require('multer');
var morgan = require("morgan");
var path = require("path");
var CryptoJS = require('../lib/aes');
var CONFIG = require('../lib/config');
var fs = require("fs");
var app = express();
app.use(morgan('dev'));
//json类型boby
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use('/', express.static(path.join(__dirname, '..', 'client')));

// app.use(bodyParser.json());
// app.use(bodyParser.json({limit: '50mb'}));
// app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));
// query string 类型body
//app.use(bodyParser.urlencoded({extended:false}));



function Encrypt(word, key, iv) {
    var srcs = CryptoJS.enc.Utf8.parse(word);
    var encrypted = CryptoJS.AES.encrypt(srcs, key, { iv: iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 });
    //return encrypted.ciphertext.toString();
    return encrypted.toString();
}

function Decrypt(word, key, iv) {
    var encryptedHexStr = CryptoJS.enc.Hex.parse(word);
    var srcs = CryptoJS.enc.Base64.stringify(encryptedHexStr);
    var decrypt = CryptoJS.AES.decrypt(srcs, key, { iv: iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 });
    var decryptedStr = decrypt.toString(CryptoJS.enc.Utf8);
    return decryptedStr.toString();
}

/**
 * 上传文件
 * @param files     经过formidable处理过的文件
 * @param req        httpRequest对象
 * @param postData    额外提交的数据
 */
function uploadFile(files, req, postData) {
    var boundaryKey = Math.random().toString(16);
    var endData = '\r\n----' + boundaryKey + '--';
    var filesLength = 0,
        content;

    // 初始数据，把post过来的数据都携带上去
    content = (function(obj) {
        var rslt = [];
        Object.keys(obj).forEach(function(key) {
            var arr = ['\r\n----' + boundaryKey + '\r\n'];
            arr.push('Content-Disposition: form-data; name="' + key + '"\r\n\r\n');
            arr.push(obj[key]);
            rslt.push(arr.join(''));
        });
        return rslt.join('');
    })(postData);

    // 组装数据
    Object.keys(files).forEach(function(key) {
        if (!files.hasOwnProperty(key)) {
            delete files.key;
            return;
        }
        //第一个文件合并参数提交，后续文件提交自身参数
        if (key == 0) {
            content += '\r\n----' + boundaryKey + '\r\n' +
                'Content-Type: application/octet-stream\r\n' +
                'Content-Disposition: form-data; name="' + files[key].fieldname + '"; ' +
                'filename="' + files[key].filename + '"; \r\n' +
                'Content-Transfer-Encoding: binary\r\n\r\n';
            files[key].contentBinary = new Buffer(content, 'utf-8');
            filesLength += files[key].contentBinary.length + fs.statSync(files[key].path).size;
        } else {
            content = '\r\n----' + boundaryKey + '\r\n' +
                'Content-Type: application/octet-stream\r\n' +
                'Content-Disposition: form-data; name="' + files[key].fieldname + '"; ' +
                'filename="' + files[key].filename + '"; \r\n' +
                'Content-Transfer-Encoding: binary\r\n\r\n';
            files[key].contentBinary = new Buffer(content, 'utf-8');
            filesLength += files[key].contentBinary.length + fs.statSync(files[key].path).size;
        }
    });

    req.setHeader('Content-Type', 'multipart/form-data; boundary=--' + boundaryKey);
    req.setHeader('Content-Length', filesLength + Buffer.byteLength(endData));

    // 执行上传
    var allFiles = Object.keys(files);
    var fileNum = allFiles.length;
    var uploadedCount = 0;
    var doUpload = function() {
        req.write(files[uploadedCount].contentBinary);
        var fileStream = fs.createReadStream(files[uploadedCount].path, { bufferSize: 4 * 1024 });
        fileStream.on('end', function() {
            // 上传成功一个文件之后，把临时文件删了
            fs.unlink(files[uploadedCount].path);
            uploadedCount++;
            if (uploadedCount == fileNum) {
                // 如果已经是最后一个文件，那就正常结束
                req.end(endData);
            } else {
                doUpload();
            }
        });
        fileStream.pipe(req, { end: false });
    }
    doUpload();
}


app.all('*', function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Content-Length, Authorization, Accept, X-Requested-With , yourHeaderFeild');
    res.header('Access-Control-Allow-Methods', 'PUT, POST, GET, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Credentials', true);
    if (req.method == 'OPTIONS') {
        res.send(200);
        /让options请求快速返回/
    } else {
        next();
    }
});

var DIR = './uploads/';

// var upload = multer({ dest: DIR });

// app.use(multer({
//     dest: DIR,
//     rename: function (fieldname, filename) {
//         return filename + Date.now();
//     },
//     onFileUploadStart: function (file) {
//         console.log(file.originalname + ' is starting ...');
//     },
//     onFileUploadComplete: function (file) {
//         console.log(file.fieldname + ' uploaded to  ' + file.path);
//     }
// }));


// 文件上传插件

var storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, DIR)
    },
    filename: function(req, file, cb) {
        cb(null, file.originalname)
    }
});
var upload = multer({ storage: storage });
var cpUpload = upload.any();
app.use(cpUpload);

// 链景h5 + 批量上传
app.post('/serverH5', function(req, res) {


    var param = req.body.param;
    var cmd = req.body.cmd;

    if (!param || !cmd) {
        res.send(200, {
            State: 1,
            Msg: "server msg : cmd or param null",
            Value: ""
        });
        return;
    }

    console.log("cmd>>" + cmd + "\n");
    console.log("param>>" + param + "\n");

    var key = CryptoJS.enc.Utf8.parse(CONFIG.key);
    var iv = CryptoJS.enc.Utf8.parse(CONFIG.iv);
    var host = "api.lianjinglx.com";
    var tag = 10008;
    var path = CONFIG.path;

    var requestData = {
        "cmd": cmd,
        "p": JSON.parse(param),
        "unix": new Date().getTime()
    };
    var sign = Encrypt(JSON.stringify(requestData), key, iv);
    var sendData = require('querystring').stringify({ key: sign });

    var options = {
        method: "POST",
        host: host,
        port: 80,
        path: path,
        headers: {
            "Content-Type": 'application/x-www-form-urlencoded',
            "Content-Length": sendData.length,
            "tag": tag,
            "language": "zh",
            "version": "1"
        }
    };

    // options.path = 'http://' + options.host + ':' + options.port + options.path;
    // options.headers.host = options.host;
    // options.host = '127.0.0.1';
    // options.port = 8888;

    var http = require('http');
    var reqHppts = http.request(options, function(serverFeedback) {
        if (serverFeedback.statusCode == 200) {
            var body = "";
            serverFeedback.on('data', function(data) {
                    body += data;
                })
                .on('end', function() {
                    console.log(new Date().toString() + ' res:>>', body);
                    res.send(200, body);
                });
        } else {
            res.send(500, "error");
        }
    });
    reqHppts.on('error', function(e) {
        console.log('error', e.message);
    });


    //判断是否需要 文件+参数 合并上传
    if (req.files) {
        console.log("find file need upload!");
        uploadFile(req.files, reqHppts, { key: sign });
    } else {
        // write data to request body
        reqHppts.write(sendData);
        reqHppts.end();
    }

});
// diandian 
app.post('/serverDianDian', function(req, res) {

    var param = req.body.param;
    var cmd = req.body.cmd;

    if (!param || !cmd) {
        res.send(200, {
            State: 1,
            Msg: "server msg : cmd or param null",
            Value: ""
        });
        return;
    }

    console.log("cmd>>" + cmd + "\n");
    console.log("param>>" + param + "\n");

    var key = CryptoJS.enc.Utf8.parse(CONFIG.key);
    var iv = CryptoJS.enc.Utf8.parse(CONFIG.iv);
    var host = "d.aibyn.com";
    var tag = 10006;
    var path = "/User.ashx";

    var requestData = {
        "cmd": cmd,
        "p": JSON.parse(param),
        "unix": new Date().getTime()
    };
    var sign = Encrypt(JSON.stringify(requestData), key, iv);
    var sendData = require('querystring').stringify({ key: sign });

    var options = {
        method: "POST",
        host: host,
        port: 80,
        path: path,
        headers: {
            "Content-Type": 'application/x-www-form-urlencoded',
            "Content-Length": sendData.length,
            "tag": tag,
            "language": "zh",
            "version": "1",
            "guid":req.headers["guid"]||""
        }
    };

    // options.path = 'http://' + options.host + ':' + options.port + options.path;
    // options.headers.host = options.host;
    // options.host = '127.0.0.1';
    // options.port = 8888;

    var http = require('http');
    var reqHppts = http.request(options, function(serverFeedback) {
        if (serverFeedback.statusCode == 200) {
            var body = "";
            serverFeedback.on('data', function(data) {
                    body += data;
                })
                .on('end', function() {
                    console.log(new Date().toString() + ' res:>>', body);
                    res.send(200, body);
                });
        } else {
            res.send(500, "error");
        }
    });
    reqHppts.on('error', function(e) {
        console.log('error', e.message);
    });


    //判断是否需要 文件+参数 合并上传
    if (req.files) {
        console.log("find file need upload!");
        uploadFile(req.files, reqHppts, { key: sign });
    } else {
        // write data to request body
        reqHppts.write(sendData);
        reqHppts.end();
    }

});
//  巡洋舰
app.post('/server', function(req, res) {
    var param = req.body.param;
    var cmd = req.body.cmd;
    var _function = req.body["function"];
    console.log("cmd>>" + cmd + "\n");
    console.log("param>>" + param + "\n");
    console.log("function>>" + _function + "\n");


    var key = CryptoJS.enc.Utf8.parse(CONFIG.key);
    var iv = CryptoJS.enc.Utf8.parse(CONFIG.iv);
    var host = CONFIG.host;
    var tag = CONFIG.tag;
    var path = CONFIG.path;
    var language = _function;

    var requestData = {
        "cmd": cmd,
        "p": JSON.parse(param),
        "unix": new Date().getTime()
    };
    var sign = Encrypt(JSON.stringify(requestData), key, iv);
    var sendData = require('querystring').stringify({ key: sign });


    var opt = {
        method: "POST",
        host: host,
        port: 443,
        path: path,
        headers: {
            "Content-Type": 'application/x-www-form-urlencoded',
            "Content-Length": sendData.length,
            "tag": tag,
            "language": language,
            "version": "1"
        }
    };
    var http = require('https');
    var reqHppts = http.request(opt, function(serverFeedback) {
        if (serverFeedback.statusCode == 200) {
            var body = "";
            serverFeedback.on('data', function(data) {
                    body += data;
                })
                .on('end', function() {
                    console.log(new Date().toString() + ' res:>>', body);
                    res.send(200, body);
                });
        } else {
            res.send(500, "error");
        }
    });
    reqHppts.on('error', function(e) {
        console.log('error', e.message);
    });

    // write data to request body
    reqHppts.write(sendData);
    reqHppts.end();
});

var PORT = process.env.PORT || 3000;

var server = app.listen(PORT, '192.168.1.56', function() {
    console.log(new Date().toString() + "h5 server start ok!  port " + PORT);
});