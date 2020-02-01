import express, { Application, Request, Response, NextFunction } from "express";
import path from "path";
import logger from "morgan";
// import cookieParser from "cookie-parser";
const multer = require("multer");

import indexRouter from "./routes/index.route";
import usersRouter from "./routes/users/users.route";
import filesRouter from "./routes/files/ranger.route";

/**
 * Instantiate app
 */
var app: Application = express();

// view engine setup
// app.set('views', path.join(__dirname, 'views'));
// app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// app.use(express.static(path.join(__dirname, 'public')));

/**
 * Cross Origin Requests Service 
 */ 
app.use((req: Request, res: Response, next: NextFunction) => {
   res.header('Access-Control-Allow-Origin', '*');
   res.header('Access-Control-Allow-Headers', '*');

   console.log(`\n${getColor(req.method)}\t\x1b[36m'${req.originalUrl}'\x1b[0m\t `)

   if (req.method === 'OPTIONS') {
      res.header('Access-Control-Allow-Methods', '*');
      return res.json({});
   }
   return next();
});

/**
 * Routes
 */
app.use('/', (req: Request, res: Response, next: NextFunction) => {
   res.send("AYUDAMEDIOS")
})
app.use('/api/', indexRouter);
/* Archivos */
app.use('/api/files', filesRouter);
/* Usuarios */
app.use('/api/users', usersRouter);

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
const getColor = (method: string) => {
   method = method.toLowerCase();
   const color = (method === 'get') ? "\x1b[32m" :
      (method === 'post') ? "\x1b[33m" :
         (method === 'put') ? "\x1b[34m" :
            (method === 'delete') ? "\x1b[31m" : "\x1b[35m";
   return color + method.toUpperCase();
}


export default app;