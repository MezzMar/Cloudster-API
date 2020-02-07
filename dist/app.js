"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const morgan_1 = __importDefault(require("morgan"));
// import cookieParser from "cookie-parser";
const multer = require("multer");
const index_route_1 = __importDefault(require("./routes/index.route"));
const usersRoute_1 = __importDefault(require("./routes/users/usersRoute"));
const rangerRoute_1 = __importDefault(require("./routes/files/rangerRoute"));
/**
 * Instantiate app
 */
var app = express_1.default();
// view engine setup
// app.set('views', path.join(__dirname, 'views'));
// app.set('view engine', 'jade');
app.use(morgan_1.default('dev'));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: false }));
// app.use(express.static(path.join(__dirname, 'public')));
/**
 * Cross Origin Requests Service
 */
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', '*');
    console.log(`\n${getColor(req.method)}\t\x1b[36m'${req.originalUrl}'\x1b[0m\t `);
    /* Pa que no aparezca en gris el req >///< */
    if (req.method === 'OPTIONS') {
        res.header('Access-Control-Allow-Methods', '*');
        return res.json({});
    }
    return next();
});
/**
 * Routes
 */
/* Usuarios */
app.use('/api/users', usersRoute_1.default);
/* Archivos */
app.use('/api/files', rangerRoute_1.default);
app.use('/api', index_route_1.default);
app.use('/', (req, res, next) => {
    res.send("AYUDAMEDIOS");
});
app.use('/*', (req, res) => {
    res.status(404).send();
});
// // catch 404 and forward to error handler
// app.use((req: Request, res: Response, next: NextFunction) => {
//    next(createError(404));
// });
/**
 * error handler
 */
// app.use((err: any, req: Request, res: Response, next: NextFunction) => {
//    // set locals, only providing error in development
//    res.locals.message = err.message;
//    res.locals.error = req.app.get('env') === 'development' ? err : {};
//    // render the error page
//    res.status(err.status || 500);
//    res.render('error');
// });
// module.exports = app;
/**
 * @Description Get the corresponding color for every route depending on the method
 * @param method Method
 */
const getColor = (method) => {
    method = method.toLowerCase();
    const color = (method === 'get') ? "\x1b[32m" :
        (method === 'post') ? "\x1b[33m" :
            (method === 'put') ? "\x1b[34m" :
                (method === 'delete') ? "\x1b[31m" : "\x1b[35m";
    return color + method.toUpperCase();
};
exports.default = app;
//# sourceMappingURL=app.js.map