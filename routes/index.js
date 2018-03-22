var express = require('express');
var router = express.Router();
var _ = require('lodash');
var fs = require('fs');
var spawn = require('child_process').spawn;



// Get Homepage
router.get('/', ensureAuthenticated, function(req, res){
	res.render('index');
});

router.get('/gallery', ensureAuthenticated, function(req, res){
	res.render('gallery');
});

router.post('/upload', ensureAuthenticated, function(req, res) {
	var promises = [];
	var user = req.user;
	if (!req.files)
	  return res.status(400).send('No files were uploaded.');
	var dir = __dirname + '/../uploads/' + user._id + '/';
	if (!fs.existsSync(dir)){
		fs.mkdirSync(dir);
	}
	if (!Array.isArray(req.files.file)) {
		req.files.file = [req.files.file];
	}
	user.images = user.images || [];
	_.each(req.files.file, function(file) {
		var promise = new Promise(function (resolve, reject){
			var filename = file.name;
			filename = filename.replace(/ /g, '');
			file.mv(dir + filename, function(err) {
				if (err)
				  return res.status(500).send(err);
			 
				user.images.push(filename);
				var commandArgs = ["-jar","DDI.jar", `/uploads/${user._id}/${filename}`, `/uploads/${user._id}/conv-${filename}`, `/uploads/${user._id}/hist-${filename}`];
				console.log(`Executing : java -jar DDI.jar /uploads/${user._id}/${filename} /uploads/${user._id}/conv-${filename} /uploads/${user._id}/hist-${filename}`);
				var command = spawn("java", commandArgs);
				command.stdout.on("data", function(stdout){
					console.log('Output -> ' + stdout);
				});
				command.stderr.on("data", function(stderr){
					console.log('Error -> ' + stderr);
				});
				command.on("exit", function(code){
					console.log('Process done -> ', code);
				});				
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