let express = require('express');
let router = express.Router();
let fs = require('fs');
let exec = require('child_process').exec;
let uuidv4 = require('uuid/v4');
let path = require('path');
let _ = require('lodash');
let User = require('./../models/user');

// Get Homepage
router.get('/', ensureAuthenticated, function(req, res){
	res.render('index');
});

router.get('/info', ensureAuthenticated, function (req, res) {
	return res.json(req.user);
});

router.get('/gallery', ensureAuthenticated, function(req, res){
	res.render('gallery');
});

router.get('/compare', ensureAuthenticated, function(req, res){
    res.render('compare', {from: "", list: []});
});

router.get('/account', ensureAuthenticated, function(req, res){
    res.render('account');
});

router.post('/account', ensureAuthenticated, function(req, res){
	let user = req.user;
    res.render('account');
});


router.get('/regenerate', ensureAuthenticated, function(req, res){
    let user = req.user;
    user.apiKey = uuidv4();
    user.save();
    res.redirect('/account');
});

router.post('/compare', ensureAuthenticated, function(req, res){
	var comparisons;
	var response = {};
	try {
        comparisons =  JSON.parse(req.body.comparisons);

        let commandArgs = [
            "java",
            "-jar",
            "DDI.jar",
            "compare",
            comparisons.from
        ];

        var list = [];
        commandArgs = commandArgs.concat(req.user.images.map(function(i) {return i.imageId}));
        let time = process.hrtime();
        let child = exec(commandArgs.join(" "),
            {maxBuffer: 1024 * 500 * 500 },
            function (error, stdout, stderr){
                if(error !== null){
                    console.error("Error -> " + error);
                }
                response = JSON.parse(stdout);
                time = process.hrtime(time);
                _.each(response, function (val, key) {
                	val.imageId = key;
                	val.r = JSON.parse(val.r);
                	val.avg_r = val.r.reduce(function (i, c){ return i+c; }) / val.r.length;
                    val.g = JSON.parse(val.g);
                    val.avg_g = val.g.reduce(function (i, c){ return i+c; }) / val.g.length;
                    val.b = JSON.parse(val.b);
                    val.avg_b = val.b.reduce(function (i, c){ return i+c; }) / val.b.length;
                    val.avg_total = (val.avg_b + val.avg_g + val.avg_r) / 3;
                    val.avg_total = (val.avg_total * 0.4) + (val.score * 0.6);
                    if (key === comparisons.from) {
                        val.original = true;
					}
                    delete val.r;
                    delete val.g;
                    delete val.b;
                    val.filename = (req.user.images.find( function (u) { return u.imageId === key }) || {}).filename;
					list.push(val);
				});
                list = _.sortBy(list, function(node){ return node.avg_total});
                //list.sort(function (a, b){ return (a.avg_total).toFixed(20) > (b.avg_total).toFixed(20)});
                list = _.filter(list, function(node){
					return Math.abs(node.count_orig - node.count_target) < 500;
                });
				if (req.api || req.body.json) {
					res.json({from: comparisons.from, list: list, uid: req.user._id});
				} else {
                    res.render('compare', {from: comparisons.from, list: list});
				}
                stderr && console.error("ERR : ", stderr);
            });

        console.log(commandArgs.join(" "));
	} catch(e){
		console.error("Failed to parse", req.body)
	}
});


router.post('/upload', ensureAuthenticated, function(req, res) {
	let promises = [];
	let user = req.user;

	if (!req.files)
	  return res.status(400).send('No files were uploaded.');

	let dir = __dirname + '/../uploads/' + user._id + '/';

	if (!fs.existsSync(dir)){
		fs.mkdirSync(dir);
	}

	if (!Array.isArray(req.files.file)) {
		req.files.file = [req.files.file];
	}

	user.images = user.images || [];
	_.each(req.files.file, function(file) {
		let promise = new Promise(function (resolve, reject){
			let filename = file.name;
			let imageID = uuidv4().replace("-", "");
			filename = filename.replace(/ /g, '');
			filename = imageID + filename;
			file.mv(dir + filename, function(err) {
				if (err)
				  return res.status(500).send(err);
			 
				user.images.push({filename: filename, imageId: imageID});

				exec(`cp loading.jpg ./uploads/${user._id}/conv-${filename}`,
                    function (error, stdout, stderr){
                        if(error !== null){
                            console.error("Error -> " + error);
                        }
                        console.log("STDOUT :", stdout);
                        stderr && console.error("ERR : ", stderr);
                    });
                exec(`cp loading.jpg ./uploads/${user._id}/hist-${filename}`,
                    function (error, stdout, stderr){
                        if(error !== null){
                            console.error("Error -> " + error);
                        }
                        console.log("STDOUT :", stdout);
                        stderr && console.error("ERR : ", stderr);
                    });

                let commandArgs = [
                	"java",
					"-jar",
					"DDI.jar",
					"generate",
					`/uploads/${user._id}/${filename}`,
					`/uploads/${user._id}/conv-${filename}`,
					`/uploads/${user._id}/hist-${filename}`,
					imageID
				];

                let child = exec(commandArgs.join(" "),
                    function (error, stdout, stderr){
                        if(error !== null){
                            console.error("Error -> " + error);
                        }
                        console.log("STDOUT :", stdout);
                        stderr && console.error("ERR : ", stderr);
                    });

                // let command = spawn("java", commandArgs);
				// command.stdout.on("data", function(stdout){
				// 	console.log('Output -> ' + stdout);
				// });
				// command.stderr.on("data", function(stderr){
				// 	console.log('Error -> ' + stderr);
				// });
				// command.on("exit", function(code){
				// 	console.log('Process done -> ', code);
				// });
				resolve("done");
			  });
		});
		promises.push(promise);		
	});
	return Promise.all(promises).then(function () {
		return user.save().then( function (){
			if (req.api) {
				return res.json({
					status: "ok"
				});
			} else {
                req.flash('toast', 'Images uploaded');
                return res.redirect(req.headers.referer);
			}
		});
	}).catch(function (e){
		console.log(e.stack || e);
	});
  });

function ensureAuthenticated(req, res, next){
	if(req.isAuthenticated()){
		return next();
	} else {
		if (req.headers["api-key"]) {
			User.getUserByKey(req.headers["api-key"], function (err, user) {
				if (user) {
					req.user = user;
					req.api = true;
                    next();
                    return;
                } else {
                    return res.redirect('/users/login');
				}
            });
		} else {
            return res.redirect('/users/login');
        }
		//req.flash('error_msg','You are not logged in');
	}
}

module.exports = router;