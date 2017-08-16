import * as express from 'express';
import * as http from 'http';
import * as bodyParser from 'body-parser';
import * as morgan from 'morgan';
import * as path from 'path';
import { Server } from 'ws';

const app = express();
app.use(morgan('dev'));
//json类型boby

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());


// app.use(bodyParser.json());
// app.use(bodyParser.json({limit: '50mb'}));
// app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));
// query string 类型body
//app.use(bodyParser.urlencoded({extended:false}));

export class Product {
    /**
     *
     */
    constructor(
        public id: number,
        public title: string,
        public price: number,
        public rating: number,
        public desc: string,
        public type: Array<string>
    ) {
    }
}

export class ProductComment {
    /**
     *
     */
    constructor(
        public id: number,
        public productId: number,
        public timestamp: string,
        public user: string,
        public rating: number,
        public content: string
    ) {

    }
}

const products: Product[] = [
    new Product(1, "商品1", 2.00, 3.5, "描述描述描述描述", ["手机", "菜刀"]),
    new Product(2, "商品2", 2.00, 3.5, "描述描述描述描述", ["手机", "菜刀"]),
];
const productComments: ProductComment[] = [
    new ProductComment(1, 1, "2017年5月31日", "小明1", 3, "还凑合"),
    new ProductComment(1, 1, "2017年5月30日", "小明12", 4, "还凑合"),
    new ProductComment(2, 1, "2017年5月31日", "小明221", 3, "还凑合"),
    new ProductComment(2, 2, "2017年5月30日", "小明223", 4, "还凑合")
];


app.use('/', express.static(path.join(__dirname, '..', 'client')));

app.get('/api/products', (req, res) => {
    let result = products;
    let params = req.query;
    console.log(params);

    if (params.title) {
        result = result.filter((item) => item.title.indexOf(params.title) != -1);
    }
    if (params.price && result.length > 0) {
        result = result.filter((item) => item.price <= parseInt(params.price));
    }
    if (params.category && params.category != -1 && result.length > 0) {
        result = result.filter((item) => item.title.indexOf(params.category) != -1);
    }

    res.json(result);
});

app.get('/api/product/:id', (req, res) => {
    res.json(products.find((product) => product.id == req.params.id));
});

app.get('/api/product/:id/comments', (req, res) => {
    res.json(productComments.filter((comment: ProductComment) => comment.productId == req.params.id));
});

app.post('/server', (req, res) => {
    var param = req.body.param;
    var cmd = req.body.cmd;
    var _function = req.body.function;
    console.log(`cmd>>${cmd}\n`);
    console.log(`param>>${param}\n`);
    console.log(`function>>${_function}\n`);

    res.json({ msg: "hello" });
});
const server = app.listen(8000, 'localhost', () => {
    console.log(`${new Date().toString()} server start ok!`);
});


const subscription = new Map<any, number[]>();

const wsServer = new Server({ port: 8085 });
wsServer.on("connection", webSocket => {
    // webSocket.send("socket connection ok!");
    webSocket.on("message", msg => {
        let msgObj = JSON.parse(msg.toString());
        let productIds = subscription.get(webSocket) || [];
        subscription.set(webSocket, [...productIds, msgObj.productId]);
    })
});

const currentBids = new Map<number, number>();

setInterval(() => {
    products.forEach(item => {
        let currentBid = currentBids.get(item.id) || item.price;
        let newBid = currentBid + Math.random() * 5;
        currentBids.set(item.id, newBid);
    });

    subscription.forEach((productIds: number[], ws) => {
        if (ws.readyState === 1) {
            let newBids = productIds.map(pid => ({
                productId: pid,
                bid: currentBids.get(pid)
            }));
            ws.send(JSON.stringify(newBids));
        } else {
            subscription.delete(ws);
        }
    });

}, 2000);






