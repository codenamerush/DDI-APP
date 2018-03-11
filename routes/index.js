var express = require('express');
var router = express.Router();
var _ = require('lodash');
var fs = require('fs');
var exec = require('child_process').exec;



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
	user.images = [];
	_.each(req.files.file, function(file) {
		var promise = new Promise(function (resolve, reject){
			var filename = file.name;
			filename = filename.replace(/ /g, '');
			file.mv(dir + filename, function(err) {
				if (err)
				  return res.status(500).send(err);
			 
				user.images.push(filename);

				var child = exec(`java -jar DDI.jar /uploads/${user._id}/${filename} /uploads/${user._id}/conv-${filename}`,
					function (error, stdout, stderr){
						console.log('Output -> ' + stdout);
						if(error !== null){
							console.log("Error -> "+error);
						}
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