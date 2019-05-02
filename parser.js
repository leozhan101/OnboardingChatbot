var fs = require('fs');
// var map = { Questions: [], answerForms: [], Dependancies: [] };

function getTest() {
    var data = fs.readFileSync('./final.json');
    var map = new Map(JSON.parse(data));

    return map;
}

// console.log(getTest().get('Starting Section ').parent);

// console.log(getTest().get('Starting Section ').qSet[0]);

// console.log(getTest());

module.exports.getTest = getTest;
