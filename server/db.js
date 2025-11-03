const mongoose = require('mongoose');
// const mongoURI = 'mongodb+srv://katariaesha02:esha00046@cluster0.swwooje.mongodb.net/gofoomern?retryWrites=true&w=majority';
const mongoURI = 'mongodb+srv://eshajdwebservices:jdweb123@cluster0.evzfn2i.mongodb.net/manojcrm?retryWrites=true&w=majority';
const mongoDB = async() => {
    mongoose.connect(mongoURI, {useNewUrlParser: true },async (err, result) => {
    if(err) console.log('Some Error -- ', err)
        else { 
             const fetch_data = await mongoose.connection.db.collection("users");
    console.log("connect");
        }
    })
    
}


module.exports = mongoDB;