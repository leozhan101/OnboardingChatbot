// @author Mohammad Solaiman Jawad
//
//
// // There is some detailed design on confluence that should be read before
// you make any changes to this file
//
// //
// https://confluence.cooperators.ca/pages/viewpage.action?pageId=661521817
//
//
// // ---------- IMPORTANT ----------
//
//
// // Anytime you make any changes to this project, you are expected to
// document it to the same standards as the documentation in this file.
//
// // You must also update the design on confluence. Not doing so will result
// in unintended consequences to your team's productivity.
//
// Contact Solaiman Jawad for questions.
//
// ^If unavailable contact Nikolas Pursiainen for details and help.
//
// // -------------------------------

var fs = require('fs');
var async = require('async');

var map = new Map(); // map used to traverse
var sectionMap = new Map(); // map used to store sections. final return value
var Qnumber = 0;
var util = require('util');
var csv = require('csv-parser');
util.inspect.defaultOptions.maxArrayLength = null; // used to console.log properly

// Implementation

// Class variable for storing Sections of Questions, to enable skipping
class Section {
    constructor(name, qOneDep, parentQ = 'none') {
        this.name = name;
        this.conversationType = qOneDep;
        this.parent = parentQ;
        this.qSet = [];
    }
    addQset(child) { // add a Qset to the current section's array of qSet
        this.qSet.push(child);
    }
    addQArr(arr) { // reassigns Qset(never used, but just in case);
        this.qSet = arr;
    }
    addDialogType(str) { // Make's section's DialogType str
        this.DialogType = str;
    }
    addParent(parentQ) { // adds a parent
        this.parent = parentQ;
    }
}

// Class Variable for storing the question, its type, and dependency
class QSet {
    constructor(Qnumber, question, answer, dependencies, questionType, mainDialog) {
        this.qNumber = Qnumber;
        this.question = question;
        this.answer = answer;
        this.dependencies = dependencies;
        this.qType = questionType;
        this.isMainDialog = mainDialog;
    }
}

// checks if the value is valid, if it is, it either sets itself with new key value
// pair or updates the map with new value
function updateMap(map, val) {
    if (val !== undefined && val.name !== '' && val.name !== undefined) {
        map.set(val.name, val);
    }
    return map;
}

// Main tree traversal function. traverses the tree in order to set the
// questions Uses Breath for search
function recurseMap(currVal, prevAns, prevDep, parentQnumber, currSection, conFullCoOp, isParent) {
    // stop condition. its important to know this isnt the stop condition for
    // the entire tree, rather a branch in the search tree.
    if (currVal === undefined || currVal === '') {
        sectionMap = updateMap(sectionMap, currSection); // update the last section before the change, then stop
        Qnumber--;
        return;
    }
    var currSet = map.get(currVal);
    var currQA = currSet[0].split('| '); // split the QA string into Question, Answer1,Answer2,....
    var currQuestion = currQA[0];

    var isMainDialog = false;

    // question fields are seperated into essential and non essential
    // questions. # denotes essential qs, * denotes sections, and lack thereof
    // denotes nonessential questions
    if (currQuestion[0] === '#') {
        currQuestion = currQuestion.slice(1, currQuestion.length);
        isMainDialog = true;
    }

    if (prevAns === undefined) {
        prevAns = 'none';
    }
    var parentQNum = Qnumber;
    if (prevAns[0] === ' ') {
        prevAns = prevAns.slice(1, prevAns.length); // get the answer str
    }
    var dependencies;
    var answerForm;

    // setting dependencies
    if (currVal === 'ID1' || currSet[6] === '' || isParent) {
        dependencies = 'none';
    } else if (prevAns === 'none') {
        dependencies = 'Q:' + parentQnumber.toString() + '-A:' + '(Answered!)';
    } else {
        dependencies = 'Q:' + parentQnumber.toString() + '-A:' + prevAns;
    }

    // remember how I said questions were seperated by * for section? think of
    // sections as superclasses of a question. they contain an array of
    // questions, and are in charge of skipping over stuff and everything. this
    // if condition handles the seperation of questions into their own
    // sections, making new sections, and ending current ones
    if (currQuestion[0] === '*') {
        if (currSection !== undefined) {
            sectionMap = updateMap(sectionMap, currSection);
        }
        isParent = true;

        var sectionName = currQuestion.slice(1, currQuestion.length);

        currSection = new Section(sectionName, conFullCoOp);
        recurseMap(currSet[5], undefined, currSet[4], parentQNum, currSection, conFullCoOp, isParent);

        return;
    } else {
        // two types of questions: Text and Buttons. even though code looks very
        // copy paste, there was a need to seperate them as their recursionary
        // values are different. Text Questions generally have only one child,
        // while buttons tend to have multiple
        if (currQA.length === 1 || currSet[2] === 'Text') {
            answerForm = 'none';
            var currArr = new QSet(Qnumber, currQuestion, answerForm, dependencies, currSet[2], isMainDialog);
            currSection.addQset(currArr);

            if (isParent) {
                currSection.addParent(new QSet(Qnumber, currQuestion, answerForm, dependencies, currSet[2], isMainDialog));
                isParent = false;
            }
            Qnumber++;
            recurseMap(currSet[5], undefined, currSet[4], parentQNum, currSection, conFullCoOp, isParent);
            return;
        } else {
            // handles button cases
            answerForm = currQA.slice(1, currQA.length);

            var currArray = new QSet(Qnumber, currQuestion, answerForm, dependencies, currSet[2], isMainDialog);
            currSection.addQset(currArray);

            if (isParent) {
                currSection.parent = new QSet(Qnumber, currQuestion, answerForm, dependencies, currSet[2], isMainDialog);
                isParent = false;
            }
            var childBranches = currSet[5].split(',');

            // iterates along a button's children, passing off values and
            // recurses inside them
            for (var i = 0; i < answerForm.length; i++) {
                Qnumber++;
                var nextID;
                var nextAns = answerForm[i];
                // this is in charge of declaring every question after this as
                // either a contractor section question, full time section
                // question, co-op question or as required.
                if (currVal === 'ID1') {
                    conFullCoOp = nextAns;
                }

                // if i have more answers than children, I'm probably going to
                // explore a dead end
                if (i >= childBranches.length) {
                    nextID = undefined;
                } else {
                    nextID = childBranches[i];
                }
                recurseMap(nextID, nextAns, currVal, parentQNum, currSection, conFullCoOp, isParent);
            }
            return;
        }
    }
}

var lineFragments = [];

// the parse function that takes a callback. the callback is generally meant to
// run the index.js file, to ensure that the procedures happen in the correct
// sequence, as per the parse runs first, then the bot starts up
async function runParse(callback) {
    async.waterfall([
        // we're basically cheating here. instead of pressing download buttons,
        // we're making a post request to post our credentials, open botsociety
        // up for a while, then use its credential cookies to get it's data. we
        // paste it into hobbs.csv file.
        function getCSV(csvCallback) {
            const request = require('request');
            let loginOptions = {
                url: 'https://app.botsociety.io/login',
                body: {
                    email: 'kitchener.dev.center@gmail.com',
                    password: 'Incubator2019'
                },
                method: 'POST',
                json: true
            };
            request(loginOptions, (err, res, body) => {
                if (err) {
                    console.log(err);
                } else {
                    let cookieString = res.headers['set-cookie'].join('; ');
                    let getOptions = {
                        url: 'https://app.botsociety.io/conversations/5c646a1a1b97daae7b26ac25/export_csv_cached?conversation_name=HOBBS',
                        method: 'GET',
                        headers: {
                            Cookie: cookieString
                        }
                    };
                    request.get(getOptions, (err, res, body) => {
                        if (err) {
                            console.log(err);
                        } else {
                            // be aware that it is faster to pass this value
                            // through instead of writing to and reading from
                            // a file. This is still the development phase tho
                            // so i thought a copy of the values passed
                            // would be good to have. feel free to overwrite
                            // the first two functions and make it optimal
                            fs.writeFile('./hobbs.csv', body, (err) => {
                                if (err) {
                                    throw err;
                                }
                                console.log('The csv file has been saved');
                                return csvCallback(null);
                            });
                        }
                    });
                }
            });
        },
        function getLine(getLineCallback) {
            // reads and formats the csv into an array of Row objects
            console.log('step 2 begins');
            var results = [];
            fs.createReadStream('hobbs.csv')
                .pipe(csv())
                .on('data', (data) => results.push(data))
                .on('end', () => {
                    return getLineCallback(null, results);
                });
        },
        function establishHashmap(results, processLineCallback) {
            // creates the map used for the tree traversal
            for (var i = 0; i < results.length; i++) {
                lineFragments[i] = Object.values(results[i]);

                map.set(results[i].Id, lineFragments[i]);
            }
            // console.log(map);
            return processLineCallback(null, results);
        },
        function useMap(results, processMapCallback) {
            // calls recurseMap function, that edits the sectionMap variable
            console.log(results[1].Id);
            recurseMap(results[1].Id, 'none', 'none', 0, undefined, '', false);
            processMapCallback(null);
        },
        function convertToJson(jsonCallback) {
            // converts the variable into a json object. tip: run parse to
            // parse the stringified object
            var str = JSON.stringify([...sectionMap]);
            return jsonCallback(null, str);
        },
        function writetoFile(data, fileWriteCallback) {
            // writes to file final.json (if youre getting error file might
            // need to exist beforehand. not prepopulated, just needs to exist
            fs.writeFile('./final.json', data, (err) => {
                if (err) {
                    throw err;
                }
                console.log('The file has been saved');
                return fileWriteCallback(null, 'done');
            });
        }
    ], function(err, result) {
        if (err) {
            throw err;
        } else {
            // log statements to see whats up in sectionMap. beware, first one
            // is huge
            // console.log(util.inspect(sectionMap, { showHidden: false, depth: null }));
            // console.log(sectionMap.keys());
            console.log(result);
            return callback();
        }
    });
}

module.exports.runParse = runParse;
