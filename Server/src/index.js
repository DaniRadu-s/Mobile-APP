const Koa = require('koa');
const app = new Koa();
const server = require('http').createServer(app.callback());
const WebSocket = require('ws');
const wss = new WebSocket.Server({ server });
const jwt = require('jsonwebtoken');
const JWT_SECRET = 'supersecretsecret';

const Router = require('koa-router');
const cors = require('koa-cors');
const bodyparser = require('koa-bodyparser');

app.use(bodyparser());
app.use(cors());
app.use(async(ctx, next) => {
    const start = new Date();
    await next();
    const ms = new Date() - start;
    console.log(`${ctx.method} ${ctx.url} ${ctx.response.status} - ${ms}ms`);
});

app.use(async(ctx, next) => {
    await new Promise(resolve => setTimeout(resolve, 2000));
    await next();
});

app.use(async(ctx, next) => {
    try {
        await next();
    } catch (err) {
        ctx.response.body = { issue: [{ error: err.message || 'Unexpected error' }] };
        ctx.response.status = 500;
    }
});

const authenticateToken = async (ctx, next) => {
    const authHeader = ctx.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        ctx.status = 401;
        ctx.body = { message: 'Access token required' };
        return;
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        ctx.state.user = decoded;
        await next();
    } catch (err) {
        ctx.status = 403;
        ctx.body = { message: 'Invalid token' };
        return;
    }
};

class Movie {
    constructor(id, name, description, cinema, price, userId) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.date = new Date();
        this.cinema = cinema;
        this.price = price;
        this.userId = userId;
    }
}

const fs = require('fs');
const path = require('path');

const MOVIES_FILE = path.resolve(__dirname, 'movies.json');

function loadMovies() {
    try {
        if (fs.existsSync(MOVIES_FILE)) {
            const data = fs.readFileSync(MOVIES_FILE);
            return JSON.parse(data);
        }
    } catch (err) {
        console.error('Error reading movies file:', err);
    }
    return [];
}

function saveMovies(movies) {
    try {
        fs.writeFileSync(MOVIES_FILE, JSON.stringify(movies, null, 2));
    } catch (err) {
        console.error('Error writing movies file:', err);
    }
}
let movies = loadMovies();
// movies.push(new Movie("0", 'Terrifier', 'horror', true, 32.5));
let lastId = movies.length > 0 ? movies[movies.length - 1].id : "0";

const pageSize = 10;
const broadcastToUser = (data, userId) => {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN && client.userId === userId) {
            client.send(JSON.stringify(data));
        }
    });
};

const broadcast = data =>
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });

const router = new Router();

router.get('/ping', ctx => {
    ctx.response.body = { status: 'ok' };
    ctx.response.status = 200;
});

router.get('/item', authenticateToken, ctx => {
    const userMovies = movies.filter(movie => movie.userId === ctx.state.user.username);
    ctx.response.body = userMovies;
    ctx.response.status = 200;
});

router.get('/item/:id', authenticateToken, async(ctx) => {
    const itemId = ctx.request.params.id;
    const item = movies.find(item => itemId === item.id && item.userId === ctx.state.user.username);
    if (item) {
        ctx.response.body = item;
        ctx.response.status = 200; // ok
    } else {
        ctx.response.body = { message: `item with id ${itemId} not found` };
        ctx.response.status = 404; // NOT FOUND (if you know the resource was deleted, then return 410 GONE)
    }
});

const createItem = async(ctx) => {
    const item = ctx.request.body;
    if (!item.name) {
        ctx.response.body = { message: 'Name is missing' };
        ctx.response.status = 400;
        console.log('Name is missing')
        return;
    }

    item.id = `${parseInt(lastId) + 1}`;
    lastId = item.id;

    if (!item.id || item.id.startsWith('temp-')) {
        item.id = `${parseInt(lastId) + 1}`;
        lastId = item.id;
    }

    item.userId = ctx.state.user.username;

    console.log('Creating item for user:', ctx.state.user.username);
    console.log('Item userId:', item.userId);
    console.log('Item data:', item);

    movies.push(item);
    saveMovies(movies);

    console.log('Total movies now:', movies.length);
    console.log('Broadcasting to user:', ctx.state.user.username);

    ctx.response.body = item;
    ctx.response.status = 201;
    broadcastToUser({ event: 'created', payload: { item } }, ctx.state.user.username);
};

router.post('/item', authenticateToken, async(ctx) => {
    await createItem(ctx);
});

router.put('/item/:id', authenticateToken, async(ctx) => {
    const id = ctx.params.id;
    const item = ctx.request.body;
    const itemId = item.id;
    if (itemId && id !== item.id) {
        ctx.response.body = { message: `Param id and body id should be the same` };
        ctx.response.status = 400; // BAD REQUEST
        return;
    }
    if (!itemId) {
        await createItem(ctx);
        return;
    }
    const index = movies.findIndex(item => item.id === id && item.userId === ctx.state.user.username);
    if (index === -1) {
        ctx.response.body = { issue: [{ error: `item with id ${id} not found` }] };
        ctx.response.status = 400; // BAD REQUEST
        return;
    }

    item.userId = ctx.state.user.username;
    movies[index] = item;
    saveMovies(movies);
    ctx.response.body = item;
    ctx.response.status = 200; // OK
    broadcastToUser({ event: 'updated', payload: { item }}, ctx.state.user.username );
});

router.del('/item/:id', authenticateToken, ctx => {
    const id = ctx.params.id;
    const index = movies.findIndex(item => id === item.id && item.userId === ctx.state.user.username);
    if (index !== -1) {
        const item = movies[index];
        movies.splice(index, 1);
        saveMovies(movies);
        broadcastToUser({ event: 'deleted', payload: { item } }, ctx.state.user.username);
    }
    ctx.response.status = 204; // no content
});

router.post('/login', async (ctx) => {
    const { username, password } = ctx.request.body;
    if (username && password) {
        const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '1d' });
        ctx.response.body = { token };
        ctx.response.status = 200;
    } else {
        ctx.response.body = { message: 'Username sau parola lipsă' };
        ctx.response.status = 400;
    }
});

wss.on('connection', (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
        ws.close();
        return;
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        ws.userId = decoded.username;
        console.log(`WebSocket connected for user: ${ws.userId}`);
    } catch (err) {
        console.log('Invalid WebSocket token');
        ws.close();
        return;
    }
});


app.use(router.routes());
app.use(router.allowedMethods());

server.listen(3000);