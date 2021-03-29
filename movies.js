var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var bcrypt = require('bcrypt-nodejs');

mongoose.Promise = global.Promise;

try {
    mongoose.connect( process.env.MONGODB_URI, () =>
        console.log("Connected"));
}catch (error) {
    console.log("Could Not Connect");
}
mongoose.set('useCreateIndex', true);


var MovieSchema = new Schema({
    Title: { type: String},
    YearReleased: {type: Number},
    Genre: { type:String},
    Actors: [{ actorName: String, characterName: String}]
});
MovieSchema.methods.find = function (err, movies)
{

    return movies

}

module.exports = mongoose.model('Movie', MovieSchema);