let express = require('express');
let path = require('path');
let cookieParser = require('cookie-parser');
let bodyParser = require('body-parser');
let expressValidator = require('express-validator');
let flash = require('connect-flash');
let session = require('express-session');
let passport = require('passport');
let mongoose = require('mongoose');
let fileUpload = require('express-fileupload');
mongoose.connect('mongodb://localhost/loginapp');

let routes = require('./routes/index');
let users = require('./routes/users');
const MongoStore = require('connect-mongo')(session);

// Init App
let app = express();

// View Engine
app.set('view engine', 'ejs');

app.use(session({
    store: new MongoStore({
        mongooseConnection: mongoose.connection
    }),
    secret: 'secret',
    saveUninitialized: true,
    resave: true
}));

// BodyParser Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(cookieParser());
app.use(fileUpload());

// app.use(bodyParser({uploadDir:__dirname + '/uploads'}));


// Set Static Folder
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Passport init
app.use(passport.initialize());
app.use(passport.session());

// Express Validator
app.use(expressValidator({
    errorFormatter: function (param, msg, value) {
        let namespace = param.split('.')
            , root = namespace.shift()
            , formParam = root;

        while (namespace.length) {
            formParam += '[' + namespace.shift() + ']';
        }
        return {
            param: formParam,
            msg: msg,
            value: value
        };
    }
}));

// Connect Flash
app.use(flash());

// Global lets
app.use(function (req, res, next) {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.error = req.flash('error');
    res.locals.user = req.user || null;
    next();
});


app.use('/', routes);
app.use('/users', users);

// Set Port
app.set('port', (process.env.PORT || 3000));

app.listen(app.get('port'), function () {
    console.log('Server started on port ' + app.get('port'));
});