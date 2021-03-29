var mongoose = require("mongoose");
var express = require('express');
var bodyParser = require('body-parser');
var passport = require('passport');
var authController = require('./auth');
var authJwtController = require('./auth_jwt');
var jwt = require('jsonwebtoken');
var cors = require('cors');
var User = require('./Users');
var Movie = require('./Movies');
var Review = require('./Reviews')
var app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(passport.initialize());

var router = express.Router();

function getJSONObjectForMovieRequirement(req) {
    var json = {
        headers: "No headers",
        key: process.env.UNIQUE_KEY,
        body: "No body"
    };

    if (req.body != null) {
        json.body = req.body;
    }

    if (req.headers != null) {
        json.headers = req.headers;
    }

    return json;
}

router.post('/signup', function(req, res) {
    if (!req.body.username || !req.body.password) {
        res.json({success: false, msg: 'Please include both username and password to signup.'})
    } else {
        var user = new User();
        user.name = req.body.name;
        user.username = req.body.username;
        user.password = req.body.password;

        user.save(function(err){
            if (err) {
                if (err.code == 11000)
                    return res.json({ success: false, message: 'A user with that username already exists.'});
                else
                    return res.json(err.message);
            }

            res.json({success: true, msg: 'Successfully created new user.'})
        });
    }
});

router.post('/signin', function (req, res) {
    var userNew = new User();
    userNew.username = req.body.username;
    userNew.password = req.body.password;

    User.findOne({ username: userNew.username }).select('name username password').exec(function(err, user) {
        if (err) {
            res.send(err);
        }

        user.comparePassword(userNew.password, function(isMatch) {
            if (isMatch) {
                var userToken = { id: user.id, username: user.username };
                var token = jwt.sign(userToken, process.env.SECRET_KEY);
                res.json ({success: true, token: 'JWT ' + token});
            }
            else {
                res.status(401).send({success: false, msg: 'Authentication failed.'});
            }
        })
    })
});
router
    .route("/reviews")
    .get((req, res) => {
        if(!req.body.title)
        {
            res.json({success: false, message: "no movie requested"})
        }
        else if(req.query.reviews === "true"){
            Movie.findOne({title:req.body.title}, function(err, movie) {
                if (err) {
                    res.json({success: false, message: "not found"})
                }
                else{
                    Movie.aggregate([{
                        $match: {title: req.body.title}
                    },
                        {
                            $lookup: {
                                from: "reviews",
                                localField: "title",
                                foreignField: "title",
                                as: "movieReview"
                            }
                        }]).exec(function (err, movie) {
                        if (err) {
                            return res.json({success: false, message:err});
                        } else {
                            return res.json({success: true, movie});
                        }
                    })
                }
            })
        }
        Review.find((err, reviewList) => {
            res.send(reviewList);
        });
    })
    .post(function(req,res)  {
        if(!req.body.title || !req.body.name || !req.body.rating || !req.body.quote)
        {
            res.status(403).json({success: false, message: "improper arguments"   });
        }
        else {
            var review = new Review();
            review.name = req.body.name;
            review.title = req.body.title;
            review.rating = req.body.rating;
            review.quote = req.body.quote;
            review.save(function(err){
                if (err) {
                    if (err.code == 11000)
                        return res.json({ success: false, message: 'already exists.'});
                    else
                        return res.json(err.message);
                }

                res.json({success: true, message: 'Successfully created new review.'})
            });
        }

    });
router.route('/movies')
    .get( function (req, res) {
        if (req.query.reviews == "true") {
            Movie.aggregate()
                .match(req.body)

                .lookup({
                    from: 'reviews',
                    localField: '_id',
                    foreignField: 'movieID',
                    as: 'reviews'
                })

                .exec(function (err, movie) {
                    if (err) return res.send(err);
                    if (movie && movie.length > 0) {
                        // Add avgRating
                        for (let j = 0; j < movie.length; j++) {
                            let total = 0;
                            for (let i = 0; i < movie[j].reviews.length; i++) {
                                total += movie[j].reviews[i].rating;
                            }
                            if (movie[j].reviews.length > 0) {
                                movie[j] = Object.assign({}, movie[j],
                                    {avgRating: (total/movie[j].reviews.length).toFixed(1)});
                            }
                        }
                        movie.sort((a,b) => {
                            return b.avgRating - a.avgRating;
                        });
                        return res.status(200).json(movie);
                    }

                    else return res.status(400).json({ success: false, message: "Movie not found."});
                })
        }

        else {
            Movie.find(function (err, movie) {
                if (err)
                    res.send(err);
                else res.json(movie);
            })
        }
    })
    .post(function (req, res) {
        if (!req.body.title || !req.body.genre || !req.body.year || !req.body.actors && req.body.actors.length) {
            res.json({success: false, message: 'Supply title, genre, year, actors and the characters they play'});
        }
        else {
            if(req.body.actors.length < 3) {
                res.json({ success: false, message: 'three actors needed'});
            }
            else {
                var movie = new Movie(req, res);
                movie.Title = req.body.title;
                movie.Year = req.body.year;
                movie.Genre = req.body.genre;
                movie.Actors= req.body.actors;

                movie.save(function(err) {
                    if (err) {
                        if (err.code == 11000)
                            return res.json({ success: false, message: 'movie already exists'});
                        else
                            return res.send(err);
                    }
                    res.json({ message: 'success' });
                });
            }
        }
    })

    .put(function(req, res) {
        var movie = new Movie();
        movie.title = req.body.title;
        movie.year = req.body.year;
        movie.genre = req.body.genre;
        movie.actors= req.body.actors;

        if (Movie.find({title: movie.title}, function (err, m) {
            movie.save(function (err, m) {
                if (err) throw err;
                else {
                    res = res.status(200);
                    res.json({success: true, message: 'updated'});
                }
            });
        }));
    })


    .delete(function(req, res) {
        if (!req.body.title){
            res.json({success: false, message: 'Please input title of movie to delete'});
        } else {

            var title = req.body.title;
            Movie.remove({title:title}, function(err, movie) {
                if (err) res.send(err);
                res.json({success: true, message: 'deleted'});
            });
        }
    });

app.use('/', router);
app.listen(process.env.PORT || 8080);
module.exports = app; // for testing only