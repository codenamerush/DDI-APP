var express = require('express');
var router = express.Router();
var _ = require('lodash');

// Get Homepage
router.get('/', ensureAuthenticated, function(req, res){
	res.render('index');
});

router.get('/gallery', ensureAuthenticated, function(req, res){
	res.render('gallery');
});

router.post('/upload', function(req, res) {
	var promises = [];
	if (!req.files)
	  return res.status(400).send('No files were uploaded.');

	_.each(req.files.file, function(file) {
		var promise = new Promise(function (resolve, reject){
			file.mv(__dirname + '/../uploads/' + file.name, function(err) {
				if (err)
				  return res.status(500).send(err);
			 
				resolve("done");
			  });
		});
		promises.push(promise);		
	});
	return Promise.all(promises).then(function () {
		return res.end("Upload complete");
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