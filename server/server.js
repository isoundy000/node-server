"use strict";
exports.__esModule = true;
var express = require("express");
var bodyParser = require("body-parser");
var morgan = require("morgan");
var path = require("path");
var ws_1 = require("ws");
var app = express();
app.use(morgan('dev'));
//json类型boby
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
// app.use(bodyParser.json());
// app.use(bodyParser.json({limit: '50mb'}));
// app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));
// query string 类型body
//app.use(bodyParser.urlencoded({extended:false}));
var Product = (function () {
    /**
     *
     */
    function Product(id, title, price, rating, desc, type) {
        this.id = id;
        this.title = title;
        this.price = price;
        this.rating = rating;
        this.desc = desc;
        this.type = type;
    }
    return Product;
}());
exports.Product = Product;
var ProductComment = (function () {
    /**
     *
     */
    function ProductComment(id, productId, timestamp, user, rating, content) {
        this.id = id;
        this.productId = productId;
        this.timestamp = timestamp;
        this.user = user;
        this.rating = rating;
        this.content = content;
    }
    return ProductComment;
}());
exports.ProductComment = ProductComment;
var products = [
    new Product(1, "商品1", 2.00, 3.5, "描述描述描述描述", ["手机", "菜刀"]),
    new Product(2, "商品2", 2.00, 3.5, "描述描述描述描述", ["手机", "菜刀"]),
];
var productComments = [
    new ProductComment(1, 1, "2017年5月31日", "小明1", 3, "还凑合"),
    new ProductComment(1, 1, "2017年5月30日", "小明12", 4, "还凑合"),
    new ProductComment(2, 1, "2017年5月31日", "小明221", 3, "还凑合"),
    new ProductComment(2, 2, "2017年5月30日", "小明223", 4, "还凑合")
];
app.use('/', express.static(path.join(__dirname, '..', 'client')));
app.get('/api/products', function (req, res) {
    var result = products;
    var params = req.query;
    console.log(params);
    if (params.title) {
        result = result.filter(function (item) { return item.title.indexOf(params.title) != -1; });
    }
    if (params.price && result.length > 0) {
        result = result.filter(function (item) { return item.price <= parseInt(params.price); });
    }
    if (params.category && params.category != -1 && result.length > 0) {
        result = result.filter(function (item) { return item.title.indexOf(params.category) != -1; });
    }
    res.json(result);
});
app.get('/api/product/:id', function (req, res) {
    res.json(products.find(function (product) { return product.id == req.params.id; }));
});
app.get('/api/product/:id/comments', function (req, res) {
    res.json(productComments.filter(function (comment) { return comment.productId == req.params.id; }));
});
app.post('/server', function (req, res) {
    var param = req.body.param;
    var cmd = req.body.cmd;
    var _function = req.body["function"];
    console.log("cmd>>" + cmd + "\n");
    console.log("param>>" + param + "\n");
    console.log("function>>" + _function + "\n");
    res.json({ msg: "hello" });
});
var server = app.listen(8000, 'localhost', function () {
    console.log(new Date().toString() + " server start ok!");
});
var subscription = new Map();
var wsServer = new ws_1.Server({ port: 8085 });
wsServer.on("connection", function (webSocket) {
    // webSocket.send("socket connection ok!");
    webSocket.on("message", function (msg) {
        var msgObj = JSON.parse(msg.toString());
        var productIds = subscription.get(webSocket) || [];
        subscription.set(webSocket, productIds.concat([msgObj.productId]));
    });
});
var currentBids = new Map();
setInterval(function () {
    products.forEach(function (item) {
        var currentBid = currentBids.get(item.id) || item.price;
        var newBid = currentBid + Math.random() * 5;
        currentBids.set(item.id, newBid);
    });
    subscription.forEach(function (productIds, ws) {
        if (ws.readyState === 1) {
            var newBids = productIds.map(function (pid) { return ({
                productId: pid,
                bid: currentBids.get(pid)
            }); });
            ws.send(JSON.stringify(newBids));
        }
        else {
            subscription["delete"](ws);
        }
    });
}, 2000);
