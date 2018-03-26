let express = require('express');
let router = express.Router();
let fs = require('fs');
let exec = require('child_process').exec;
let uuidv4 = require('uuid/v4');
let path = require('path');
let _ = require('lodash');
// let spawn = require('child_process').spawn;



// Get Homepage
router.get('/', ensureAuthenticated, function(req, res){
	res.render('index');
});

router.get('/gallery', ensureAuthenticated, function(req, res){
	res.render('gallery');
});

router.get('/compare', ensureAuthenticated, function(req, res){
    res.render('compare', {from: "", list: []});
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

        function sort(list){
		};
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
                console.log(JSON.stringify(list, null, 4), stdout.length);
                console.log(time);
                res.render('compare', {from: comparisons.from, list: list});
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
			req.flash('toast', 'Images uploaded');
			return res.redirect(req.headers.referer);
		});
	}).catch(function (e){
		console.log(e.stack || e);
	});
  })

function ensureAuthenticated(req, res, next){
	if(req.isAuthenticated()){
		return next();
	} else {
		//req.flash('error_msg','You are not logged in');
		res.redirect('/users/login');
	}
}

module.exports = router;