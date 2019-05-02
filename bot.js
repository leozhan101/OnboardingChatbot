// @author(s) Mohammad Solaiman Jawad, Zhikai Zhan, Akhil Talati
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
// in unintended consequences that will directly affect your team's efficiency.
//
// Contact Solaiman Jawad first If you need any help.
// Contact the following if you need any extra help with these topics:

// Zhikai Zhan: Jump Dialog, Adaptive cards display, Continue dialog

// Akhil Talati: Feedback Dialog, OAuth cards and login authentication,
// Postgress Database Management, Skip function.

// Solaiman Jawad: Starting Dialog, Next Dialog, Backend, Question workflow,
// Section movement, Revising Sections
//
// Side note(optional): Please download linter for ES and follow good style practices.
//
// // -------------------------------

const { ActivityTypes, CardFactory } = require('botbuilder');
const { ComponentDialog, ChoicePrompt, DialogSet, TextPrompt, WaterfallDialog, OAuthPrompt } = require('botbuilder-dialogs');
var request = require('request');
const getUrls = require('get-urls');
var test = require('./parser.js');
var util = require('util');
util.inspect.defaultOptions.maxArrayLength = null;
// map is a map of key to value, where key = section name, value = sections (objects)
var map = test.getTest(); // if you wanna see how it works, look at excelparse.js and parse.js

// import { client } from './index.js'
//
const handleUndone = 'HandleUndone';
const DIALOG_STATE_PROPERTY = 'dialogStatePropertyAccessor';
const USER_PROFILE_PROPERTY = 'userInfoPropertyAccessor';
const CONVERSATION_DATA_PROPERTY = 'conversationData';
const STARTING_DIALOG = 'starting_dialog';
const CONTINUE_DIALOG = 'continue_dialog';
const JUMP_DIALOG = 'jump_dialog';
let username = 'rpa.bug.reporter';
let password = 'co0pincub4t0r@41!';
let feedbackText = 'default123';
var nextDialog = 'nextDialog';
// Authentication Variables
// Names of the authentication prompts the bot uses.
const OAUTH_PROMPT = 'oAuth_prompt';
const CONFIRM_PROMPT = 'confirm_prompt';
// Name of the authentication WaterfallDialog the bot uses.
const AUTH_DIALOG = 'auth_dialog';
const CONNECTION_NAME = 'hobbs-bot';
const HELP_TEXT = ' Type anything to get logged in. Type \'logout\' to signout.' +
    ' Type \'help\' to view this message again';
// Create the settings for the OAuthPrompt.
var globalInterruption = ['cancel', 'logout', 'post', '/feedback'];

// helper functions
// This function returns the last required question (one that the user can answer)
function lastQfromSection(section) {
    // This is a set of all questions in the given section.
    var questionTable = map.get(section).qSet;
    var lastQuestion;
    var j;
    for (var i = 0; i < questionTable.length; i++) {
        if (questionTable[i].isMainDialog) {
            j = i;
            lastQuestion = questionTable[i];
        }
    }
    return [lastQuestion, j];
}

// helper functions
// This function returns the next required question in the current section
function findNextMainQuestion(sectionName, sectionNum) {
    var questionTable = map.get(sectionName).qSet;
    for (var i = sectionNum + 1; i < questionTable.length; i++) {
        if (questionTable[i].isMainDialog) {
            var val = [questionTable[i], i];
            return val;
        }
    }
    return false;
}

// helper functions
// This function returns true if all the requried questions of the current section have been skiped or answered.
function isSectionComplete(section, answerForms) {
    var questionTable = map.get(section).qSet;
    var lastQuestion;
    for (var i = 0; i < questionTable.length; i++) {
        if (questionTable[i].isMainDialog) {
            lastQuestion = questionTable[i];
        }
    }
    return ((answerForms[lastQuestion.qNumber] !== undefined) && (answerForms[lastQuestion.qNumber] !== 'skip'));
}

// Bot Framework
class onboardingBot extends ComponentDialog {
    /**
     *
     * @param {ConversationState} conversationState A ConversationState object used to store the dialog state.
     * @param {UserState} userState A UserState object used to store values specific to the user.
     */
    constructor(conversationState, userState) {
        // Create a new state accessor property. See https://aka.ms/about-bot-state-accessors to learn more about bot state and state accessors.
        super();

        this.conversationState = conversationState;

        this.userState = userState;

        this.dialogState = this.conversationState.createProperty(DIALOG_STATE_PROPERTY);

        this.conversationData = conversationState.createProperty(CONVERSATION_DATA_PROPERTY);

        this.userProfile = this.userState.createProperty(USER_PROFILE_PROPERTY);

        this.dialogs = new DialogSet(this.dialogState);

        // conversationData stores data that can be accessed at any point during the conversation.
        this.conversationData.qNum = 0; // the index of the current question

        this.conversationData.answerForms = []; // current answerForm of the person using it. specific to a conversation

        this.conversationData.isContinue = false; // has the user requested continue

        this.conversationData.revisedAnswers = []; // a container used later on

        this.conversationData.isRevised = false; // has the current section been revised? defaulted as false

        this.conversationData.alreadySkipped = []; // container of already skipped sections

        this.conversationData.continueIndex = undefined; // store the index of "contine" if the this.conversationData.answerForms

        this.conversationData.dependenciesMatch = true; // has dependencies matched? defaulted as true because nothing implies no dependencies, so question will always be asked

        this.conversationData.isAuth = false; // Auth stuff

        this.conversationData.walkthrough = false;

        this.conversationData.currSection = (Array.from(map.keys()))[0]; // name of current section user is on

        this.conversationData.sectionIndex = 0; // index of current section in a list of sections from the map's keys

        this.conversationData.skipContinue = false;
        // Initialize this.conversation.currQuestion to be the first first question in the currSection
        this.conversationData.currQuestion = map.get(this.conversationData.currSection).qSet[0];

        this.conversationData.lastSectionQuestion = lastQfromSection(this.conversationData.currSection);
        // This is an array of the form = [{},0], where {} is the question object (qset)
        // and 0 refers to the position of qSet inside the section.

        // lastMainQuestionAsked keeps track of the last asked question whose isMainDialog is true,
        // along with its position inside the section it is a part of -> ( {qSet, qNum} ).
        this.conversationData.lastMainQuestionAsked = [map.get(this.conversationData.currSection).qSet[0], 0];

        // Add prompts that will be used by the main dialogs.

        this.dialogs.add(new ChoicePrompt('choicePrompt'));
        this.dialogs.add(new TextPrompt('textPrompt'));

        // Starting dialog gets called from on turn function.
        // Each time this function is called, it determines what question number to ask based on dependencies/question flow
        // and gets the question from the .json file.
        // Output : Sends question to chatbot window
        // Input  : Uses conversationData to determine what question to ask
        // Effect : Updates conversationData variables such that when the function is
        // called again, appropriate question is asked.
        this.addDialog(new WaterfallDialog(STARTING_DIALOG, [
            // This step performs three checks
            // 1. Check weather continue is in the answer array
            // 2. Checks weather the bot has arrived at a question that marks the end of a section
            // 3. Depending on step 2, it further checks if it needs to move to another section or end the conversation (end of the question flow)
            async (step) => {
                this.conversationData.skipContinue = false;
                var foundContinue = false;
                // console.log(this.conversationData.currQuestion);
                // console.log(this.conversationData.qNum);
                // console.log(map.get(this.conversationData.currSection).qSet.length);
                // console.log(this.conversationData.answerForms);
                this.conversationData.continueIndex = this.conversationData.answerForms.indexOf('Continue');
                if (this.conversationData.continueIndex !== undefined && this.conversationData.continueIndex !== -1) {
                    foundContinue = true;
                }
                if (this.conversationData.answerForms.length > 2 && foundContinue) {
                    this.conversationData.isContinue = true;
                }

                if (this.conversationData.sectionIndex >= Array.from(map.keys()).length) {
                    // This is performed when you reach the end of all the sections.
                    // We reset all the values and end the dialog.
                    this.conversationData.isRevised = false;
                    this.conversationData.alreadySkipped = [];
                    this.conversationData.sectionIndex = 0;
                    this.conversationData.currSection = Array.from(map.keys())[0];
                    this.conversationData.qNum = 0;
                    this.conversationData.sectionIndex = 0;
                    console.log('Im updating!');
                    this.conversationData.currQuestion = undefined;
                    this.conversationData.answerForms = [];
                    this.conversationData.lastSectionQuestion = lastQfromSection(this.conversationData.currSection);
                    this.conversationData.lastMainQuestionAsked = [map.get(this.conversationData.currSection).qSet[0], 0];
                    this.conversationData.isContinue = false;

                    return await step.endDialog();
                } else if (this.conversationData.qNum === map.get(this.conversationData.currSection).qSet.length) {
                    console.log(' at start dialog. going to next');
                    return await step.replaceDialog(nextDialog);
                } else if (this.conversationData.isContinue) {
                    // ask user do they want to jump to a specific section or continue at where they left off
                    var temp = {
                        '$schema': 'http://adaptivecards.io/schemas/adaptive-card.json',
                        'version': '1.0',
                        'type': 'AdaptiveCard',
                        'body': [
                            {
                                'type': 'TextBlock',
                                // 'text': 'Where did you leave last time?',
                                'size': 'medium',
                                'color': 'alert',
                                'spacing': 'none'
                            }
                        ],
                        'actions': [
                            {
                                'type': 'Action.Submit',
                                'title': 'Jump to a specific section',
                                'button': 'Jump to a specific section',
                                'data': 'Jump to a specific section'
                                // 'data': {
                                //     'button': 'Jump to a specific section',
                                //     'data': 'Jump to a specific section'
                                // }
                            },

                            {
                                'type': 'Action.Submit',
                                'title': 'Continue where I left off',
                                'button': 'Continue where I left off',
                                'data': 'Continue where I left off'
                                // 'data': {
                                //     'button': 'Continue where I left off',
                                //     'data': 'Continue where I left off'
                                // }
                            }
                        ]
                    };

                    return await step.context.sendActivity({ text: 'Which action do you want?', attachments: [CardFactory.adaptiveCard(temp)] });
                }
                return await step.next();
            },

            async (step) => {
                // If in the starting dialog we decide to jump to a specific section, we replace this dialog with JUMP_DIALOG
                // If in the starting dialog we decide to continue at where they left off,  we replace the dialog with CONTINUE_DIALOG
                // If isContinue is false, we move to the next step to check depedencies
                if (this.conversationData.isContinue) {
                    if ((step.context.activity.text).toLowerCase() === 'jump to a specific section') {
                        return await step.replaceDialog(JUMP_DIALOG);
                    } else if ((step.context.activity.text).toLowerCase() === 'continue where i left off') {
                        return await step.replaceDialog(CONTINUE_DIALOG);
                    }
                } else {
                    return await step.next();
                }
            },
            // This step is for checking dependencies. It checks weather the current question should be asked or not.
            async (step) => {
                var fullSection = map.get(this.conversationData.currSection);
                var allQsets = fullSection.qSet;
                this.conversationData.currQuestion = allQsets[this.conversationData.qNum];
                var dependencies = this.conversationData.currQuestion.dependencies;
                this.conversationData.dependenciesMatch = true;

                if (this.conversationData.walkthrough) {
                    return await step.next();
                } else {
                    if (dependencies !== 'none') {
                        dependencies = dependencies.split(',');
                        for (var i = 0; i < dependencies.length; i++) {
                            var words = dependencies[i];
                            var arrWords = words.split(':');
                            var ansIndex = parseInt(arrWords[1].split('-'));
                            if (((arrWords[2] === '(Answered!)') &&
                                (this.conversationData.answerForms[ansIndex] === undefined)) ||
                                this.conversationData.answerForms[ansIndex] === undefined ||
                                this.conversationData.answerForms[ansIndex] === 'skip' ||
                                ((this.conversationData.answerForms[ansIndex].trim() !== arrWords[2]) &&
                                    (arrWords[2] !== '(Answered!)'))) {
                                this.conversationData.dependenciesMatch = false;
                            }
                        }
                    }
                    return await step.next();
                }
            },
            // This step asks the question (choice prompt, text prompt, adaptive cards).
            // It also checks if there is a url in the question, if so, it creates a card with a
            // button that redirects to a webpage.
            async (step) => {
                if (this.conversationData.dependenciesMatch) {
                    var qSet = this.conversationData.currQuestion;
                    if (qSet.isMainDialog === true) {
                        this.conversationData.lastMainQuestionAsked = [qSet, this.conversationData.qNum];
                    }
                    if (qSet.answer === 'none') {
                        if (qSet.qType === 'Text') {
                            // get the context of the current dialog
                            var text = qSet.question;
                            var url = getUrls(text);
                            if (url.size > 0) {
                                // if it includes url, store it into a set and get the link by storing it into a variable
                                // var url = getUrls(text);
                                var it = url.values();
                                var first = it.next();
                                var value = first.value;

                                var temp = {
                                    '$schema': 'http://adaptivecards.io/schemas/adaptive-card.json',
                                    'version': '1.0',
                                    'type': 'AdaptiveCard',
                                    'body': [
                                        {
                                            'type': 'TextBlock',
                                            // 'text': 'Where did you leave last time?',
                                            'size': 'medium',
                                            'color': 'alert',
                                            'spacing': 'none'
                                        }
                                    ],
                                    'actions': [
                                        {
                                            'type': 'Action.OpenUrl',
                                            'title': 'Click Here',
                                            'url': value
                                        }
                                    ]
                                };
                                // delete the url in the context and store the new string into str
                                var str = text.substr(0, text.indexOf('http'));

                                await step.context.sendActivity({ text: str, attachments: [CardFactory.adaptiveCard(temp)] });
                            } else {
                                await step.context.sendActivity(qSet.question);
                            }
                            return await step.next();
                        } else {
                            return await step.prompt('textPrompt', `${qSet.question}`);
                        }
                    } else {
                        var aArr = qSet.answer;
                        // uncomment and edit to switch between choicePrompt
                        // and adaptive cards
                        // const promptOptions = {
                        //     prompt: `${qSet.question}`,
                        //     reprompt: `That was not a valid choice, please select between ${aArr}`,
                        //     choices: aArr
                        // };
                        // return await step.prompt('choicePrompt', promptOptions);
                        var options = [];
                        for (var word of aArr) {
                            if (word.toString().length >= 1) {
                                options.push({
                                    'type': 'Action.Submit',
                                    'title': word.toString().trim(),
                                    'button': word.toString().trim(),
                                    'data': word.toString().trim()
                                    // 'data': {
                                    //     'type': 'imBack',
                                    //     'data': word.toString().trim()
                                    // }
                                });
                            }
                        }
                        var temp1 = {
                            '$schema': 'http://adaptivecards.io/schemas/adaptive-card.json',
                            'version': '1.0',
                            'type': 'AdaptiveCard',
                            'body': [
                                {
                                    'type': 'TextBlock',
                                    // 'text': 'Where did you leave last time?',
                                    'size': 'medium',
                                    'color': 'alert',
                                    'spacing': 'none'
                                }
                            ],
                            'actions': options
                        };

                        var sendQuestion = qSet.question;

                        if ((this.conversationData.isRevised) &&
                            (this.conversationData.revisedAnswers[this.conversationData.qNum] !== undefined) &&
                            (this.conversationData.revisedAnswers[this.conversationData.qNum] !== '(Answered!)')) {
                            sendQuestion = sendQuestion + ' Your previous answer for this question was ' +
                                this.conversationData.revisedAnswers[this.conversationData.qNum];
                        }
                        return await step.context.sendActivity({
                            text: `${sendQuestion}`,
                            attachments: [CardFactory.adaptiveCard(temp1)]
                        });
                    }
                } else {
                    (this.conversationData.qNum)++;
                    return await step.replaceDialog(STARTING_DIALOG);
                }
            },
            // This step catches the answer and stores it in the answerForms array, which we later push to database.
            async (step) => {
                var qSet = this.conversationData.currQuestion;
                var invalidInput = true;
                if (qSet.qType === 'Text') {
                    invalidInput = false;
                    this.conversationData.answerForms[qSet.qNumber] = '(Answered!)';
                } else {
                    var isGlobalInterruption = await this.checkGlobalInterruption(step.context.activity.text);
                    console.log(isGlobalInterruption);
                    if (!isGlobalInterruption) {
                        var answer = step.context.activity.text.toLowerCase();
                        var answerArrayLowerCase = [];

                        // answerArrayLowerCase will store the same answers in the qSet.answer, but all in lowercase
                        for (var i = 0; i < qSet.answer.length; i++) {
                            answerArrayLowerCase[i] = qSet.answer[i].toLowerCase();
                        }

                        // if users type in 'y' or 'n', treat them as 'yes or yes/not required' and 'no'
                        if (answer === 'y') {
                            if (answerArrayLowerCase.includes('yes')) {
                                answer = 'yes';
                            } else if (answerArrayLowerCase.includes('yes/not required')) {
                                answer = 'yes/not required';
                            }
                        } else if (answer === 'n') {
                            answer = 'no';
                        }

                        // check whether the user input in lowercase exists in the answerArrayLowerCase
                        // if it exists, the index returned will be the position of the same answer (not necessary in lowercase) in the qSet.answer
                        var indexOfInput = answerArrayLowerCase.indexOf(answer);

                        if (indexOfInput !== -1) {
                            invalidInput = false;
                            this.conversationData.answerForms[qSet.qNumber] = qSet.answer[indexOfInput];
                        }
                    }
                }

                this.conversationData.walkthrough = false;

                if (!invalidInput || isGlobalInterruption) {
                    (this.conversationData.qNum)++;
                }
                
                return await step.replaceDialog(STARTING_DIALOG);
            }
        ]));

        this.addDialog(new WaterfallDialog(handleUndone, [
            async (step) => {
                var aArr = ['Continue', 'Quit'];
                var option2 = [];
                for (var word of aArr) {
                    if (word.toString().length >= 1) {
                        option2.push({
                            'type': 'Action.Submit',
                            'title': word.toString().trim(),
                            'button': word.toString().trim(),
                            'data': word.toString().trim()
                        });
                    }
                }
                var temp2 = {
                    '$schema': 'http://adaptivecards.io/schemas/adaptive-card.json',
                    'version': '1.0',
                    'type': 'AdaptiveCard',
                    'body': [
                        {
                            'type': 'TextBlock',
                            // 'text': 'Where did you leave last time?',
                            'size': 'medium',
                            'color': 'alert',
                            'spacing': 'none'
                        }
                    ],
                    'actions': option2
                };

                return await step.context.sendActivity({
                    // text: 'Would you like to continue?',
                    attachments: [CardFactory.adaptiveCard(temp2)]
                });
            },
            async (step) => {
                // handles the skipping to next question if the last question answered
                // isnt the last question in the current section
                if (step.context.activity.text.toLowerCase() === 'continue') {
                    console.log(this.conversationData.answerForms);
                    var curr = map.get(this.conversationData.currSection);
                    for (var i = this.conversationData.lastMainQuestionAsked[1] + 1;
                        i < map.get(this.conversationData.currSection).qSet.length; i++) {
                        this.conversationData.answerForms[curr.qSet[i].qNumber] = undefined;
                    }
                    this.conversationData.answerForms[this.conversationData.lastMainQuestionAsked[0].qNumber] = undefined;
                    console.log(this.conversationData.answerForms);
                    var nextVal = findNextMainQuestion(this.conversationData.currSection,
                        this.conversationData.lastMainQuestionAsked[1]);
                    this.conversationData.currQuestion = nextVal[0];
                    this.conversationData.qNum = nextVal[1];
                    this.conversationData.walkthrough = true;
                    return await step.replaceDialog(STARTING_DIALOG);
                } else if (step.context.activity.text.toLowerCase() === 'Quit') {
                    step.endDialog();
                }
            }
        ]));

        this.addDialog(new WaterfallDialog(nextDialog, [
            // This step performs three checks
            // 1. Check weather continue is in the answer array
            // 2. Checks weather the bot has arrived at a question that marks the end of a section
            // 3. Depending on step 2, it further checks if it needs to move to another section or end the conversation (end of the question flow)
            async (step) => {
                // switch this to comparing integers once youre confident
                // the comparison is equivalent
                if (JSON.stringify(this.conversationData.lastMainQuestionAsked[0]) !==
                    JSON.stringify(this.conversationData.lastSectionQuestion[0])) {
                    // handles the skipping to previous question if the kast question answered
                    // isnt the last question in the current section
                    return await step.replaceDialog(handleUndone);
                } else {
                    for (var j = this.conversationData.sectionIndex + 1; j < Array.from(map.keys()).length; j++) {
                        var currentSec = map.get((Array.from(map.keys()))[j]);
                        var x = this.conversationData.answerForms.find((element) => {
                            return (!(this.conversationData.alreadySkipped.includes(currentSec)) &&
                                (element === currentSec.conversationType));
                        });
                        if (x !== undefined) {
                            if (isSectionComplete((Array.from(map.keys())[j]), this.conversationData.answerForms)) {
                                step.values.secNum = j;
                                // var cArr = ['Yes', 'No'];
                                // const promptOption = {
                                //     prompt: `You have already completed section ${Array.from(map.keys())[j].substr(0, Array.from(map.keys())[j].indexOf(','))}. 
                                //     Do you want to do it again?`,
                                //     reprompt: `That was not a valid choice, please select between ${cArr}`,
                                //     choices: cArr
                                // };
                                // return await step.prompt('choicePrompt', promptOption);
                                var cArr = ['Yes', 'No'];
                                var option3 = [];
                                for (var word of cArr) {
                                    if (word.toString().length >= 1) {
                                        option3.push({
                                            'type': 'Action.Submit',
                                            'title': word.toString().trim(),
                                            'button': word.toString().trim(),
                                            'data': word.toString().trim()
                                        });
                                    }
                                }
                                var temp3 = {
                                    '$schema': 'http://adaptivecards.io/schemas/adaptive-card.json',
                                    'version': '1.0',
                                    'type': 'AdaptiveCard',
                                    'body': [
                                        {
                                            'type': 'TextBlock',
                                            // 'text': 'Where did you leave last time?',
                                            'size': 'medium',
                                            'color': 'alert',
                                            'spacing': 'none'
                                        }
                                    ],
                                    'actions': option3
                                };

                                return await step.context.sendActivity({
                                    text: `You have already completed section ${Array.from(map.keys())[j].substr(0, Array.from(map.keys())[j].indexOf(','))}. 
                                        Do you want to do it again?`,
                                    attachments: [CardFactory.adaptiveCard(temp3)]
                                });
                            } else {
                                this.conversationData.currSection = Array.from(map.keys())[j];
                                this.conversationData.qNum = 0;
                                this.conversationData.isRevised = false;
                                this.conversationData.sectionIndex = j;
                                this.conversationData.lastSectionQuestion =
                                    lastQfromSection(this.conversationData.currSection);
                                this.conversationData.lastMainQuestionAsked =
                                    [map.get(this.conversationData.currSection).qSet[0], 0];
                                return await step.replaceDialog(STARTING_DIALOG);
                            }
                        }
                    }
                    if (x === undefined || !x) {
                        this.conversationData.currSection = Array.from(map.keys())[0];
                        this.conversationData.isRevised = false;
                        this.conversationData.alreadySkipped = [];
                        this.conversationData.qNum = 0;
                        this.conversationData.sectionIndex = 0;
                        this.conversationData.currQuestion = undefined;
                        this.conversationData.lastSectionQuestion = lastQfromSection(this.conversationData.currSection);
                        this.conversationData.lastMainQuestionAsked = [map.get(this.conversationData.currSection).qSet[0], 0];
                        return await step.endDialog();
                    }
                }
            },
            async (step) => {
                if (step.context.activity.text.toLowerCase() === 'yes' || step.context.activity.text.toLowerCase() === 'y') {
                    this.conversationData.currSection = Array.from(map.keys())[step.values.secNum];
                    this.conversationData.qNum = 0;
                    this.conversationData.sectionIndex = step.values.secNum;
                    this.conversationData.lastSectionQuestion =
                        lastQfromSection(this.conversationData.currSection);
                    this.conversationData.lastMainQuestionAsked =
                        [map.get(this.conversationData.currSection).qSet[0], 0];
                    this.conversationData.isRevised = true;
                    var qArr = map.get(this.conversationData.currSection).qSet;
                    for (var i = 0; i < qArr.length; i++) {
                        this.conversationData.revisedAnswers[i] = this.conversationData.answerForms[[qArr[i].qNumber]];
                        this.conversationData.answerForms[[qArr[i].qNumber]] = undefined;
                    }
                    return await step.replaceDialog(STARTING_DIALOG);
                } else if (step.context.activity.text.toLowerCase() === 'no' || step.context.activity.text.toLowerCase() === 'n') {

                    this.conversationData.isRevised = false;
                    this.conversationData.currSection = Array.from(map.keys())[step.values.secNum];
                    this.conversationData.alreadySkipped.push(this.conversationData.currSection);
                    this.conversationData.qNum = 0;
                    this.conversationData.sectionIndex = step.values.secNum;
                    this.conversationData.lastSectionQuestion =
                        lastQfromSection(this.conversationData.currSection);
                    this.conversationData.lastMainQuestionAsked = this.conversationData.lastSectionQuestion;
                    return await step.replaceDialog(nextDialog);
                }
            }
        ]));

        //  Jump dialog is initiated in starting dialog / onturn if user invokes it. It allows the user to jump to a section.
        // Output : Sends adaptive cards and prompts that allows the user to jump to a section they want.
        // Input  : Uses conversationData, and data inputed by user to find the appropriate section to jump to.
        // Effect : Updates conversationData variables
        this.addDialog(new WaterfallDialog(JUMP_DIALOG, [
            async (step) => {
                this.conversationData.skipContinue = true;
                /* Check whether isContinue is true. If so, check the answerArray[0] to find out the position users applied for.
                   Then pop up the correponding question/section numbers for users to choose from */
                if (this.conversationData.isContinue) {
                    // This step prevents isContinue setted to true again when we call the STARTING_DIALOG
                    this.conversationData.answerForms[this.conversationData.continueIndex] = 'Start from the beginning';
                    var cArr = [];

                    for (let item of map.keys()) {
                        var currentSec = map.get(item);
                        if (currentSec.conversationType === this.conversationData.answerForms[1]) {
                            var key = item.substr(0, item.indexOf(','));
                            if (key !== 'Menu' && key !== 'End') {
                                cArr.push(key);
                            }
                        }
                    }
                    var options = [];
                    for (var word of cArr) {
                        if (word.toString().length >= 1) {
                            options.push({
                                'type': 'Action.Submit',
                                'title': word.toString().trim(),
                                'button': word.toString().trim(),
                                'data': word.toString().trim()
                                // 'data': {
                                //     'button': word.toString().trim(),
                                //     'data': word.toString().trim()
                                // }
                            });
                        }
                    }

                    var temp = {
                        '$schema': 'http://adaptivecards.io/schemas/adaptive-card.json',
                        'version': '1.0',
                        'type': 'AdaptiveCard',
                        'body': [
                            {
                                'type': 'TextBlock',
                                // 'text': 'Where did you leave last time?',
                                'size': 'medium',
                                'color': 'alert',
                                'spacing': 'none'
                            }
                        ],
                        'actions': options
                    };

                    return await step.context.sendActivity({ text: 'Where did you leave off last time?', attachments: [CardFactory.adaptiveCard(temp)] });
                }

                //     const promptOption = {
                //         prompt: `Where did you leave last time?`,
                //         reprompt: `That was not a valid choice, please select between ${cArr}`,
                //         choices: cArr
                //     };
                //     return await step.prompt('choicePrompt', promptOption);
                // }
            },

            async (step) => {
                // after users select the question they want to go to, change current index to the correponding question's index (CONTINUE OPTION)
                if (step.context.activity.text) {
                    var isGlobalInterruption = await this.checkGlobalInterruption(step.context.activity.text);
                    if (isGlobalInterruption) {
                        // this is for not letting the global interruptions interfere.
                        console.log('should i be doing something in this case ? probably not.');
                    } else if (this.conversationData.isContinue) {
                        var lArr = [];
                        
                        // lArr stores all the section names in lowercase
                        for (let item of map.keys()) {
                            lArr.push(item.toLowerCase());
                        }

                        // we do not accept user input 'menu' and 'end' since the adpative card that we showed to users does not contain those two sections
                        if (step.context.activity.text.toLowerCase() !== 'menu' && step.context.activity.text.toLowerCase() !== 'end') {
                            // tempSection stores the position of user input in the lArr
                            var tempSectionIndex = lArr.indexOf(step.context.activity.text.toLowerCase() + ', ' + this.conversationData.answerForms[1].toLowerCase());

                            if (tempSectionIndex !== -1) {
                                this.conversationData.isContinue = false;
                                this.conversationData.continueIndex = undefined;
                                this.conversationData.qNum = 0;
                                this.conversationData.sectionIndex = tempSectionIndex;
                                this.conversationData.currSection = Array.from(map.keys())[this.conversationData.sectionIndex];
                                this.conversationData.lastSectionQuestion = lastQfromSection(this.conversationData.currSection);
                                this.conversationData.lastMainQuestionAsked = [map.get(this.conversationData.currSection).qSet[0], 0];
                            }
                        }
                    }
                }

                return await step.replaceDialog(STARTING_DIALOG);
            }
        ]));

        // Continue dialog is initiated in starting dialog / onturn if user invokes it. It allows the user to continue at where they left off.
        // Output : allows users to continue at where they left off based on data the bot got from the database.
        // Input  : Uses answerForms got from database to find the appropriate section to continue at.
        // Effect : Updates conversationData variables
        this.dialogs.add(new WaterfallDialog(CONTINUE_DIALOG, [
            // Continue past previously completed sections
            async (step) => {
                // get user data from database
                // store answers into answerForms and set this.conversation.answerFroms = answerForms
                step.sendActivity('this feature isnt available in the current LTS version of Hobbs');
                return await step.endDialog();
            }
        ]));

        // Authentication Dialogue Creation.
    }
    async checkGlobalInterruption(utterance) {
        var length = globalInterruption.length;
        for (var i = 0; i < length; i++) {
            if (utterance) {
                if (utterance === globalInterruption[i]) {
                    return true;
                } else if (utterance.substr(0, 9) === ('/feedback')) {
                    // I may have to use includes instead of substr function, because
                    // if I try to access substr(0,9) for utterance, and the
                    // length of utterance is less than 9, then it will cause a
                    // problem.
                    return true;
                }
            }
        }
        return false;
    }
    // Skip Function
    // This function is called when the user types "skip". All the unanswered
    // questions in the section are skipped if none of them are marked mandatory.
    async skip(dc) {
        // Run a for loop : from current question till the end of the section's question, and mark them "skipped"'
        // Update the current index so that the next section shows up in the main dialog flow.
        var currSection = map.get(this.conversationData.currSection).qSet;
        var sectionLength = currSection.length;
        var isSkip = true;
        if (this.conversationData.sectionIndex === 0 || this.conversationData.skipContinue) {
            isSkip = false;
        }
        if (isSkip) {
            await dc.context.sendActivity('Skipping and moving on to next section.');
            for (var i = 0; i < sectionLength; i++) {
                // I am looping through all the qSets inside the current section [accesed by :- map.get(this.conversationData.currSection).qSet]
                var currQSet = map.get(this.conversationData.currSection).qSet[i];
                this.conversationData.answerForms[currQSet.qNumber] = 'skip';
            };
            for (var j = this.conversationData.sectionIndex + 1; j < Array.from(map.keys()).length; j++) {
                // Gets the current section as an array of qSets.
                var currentSec = map.get((Array.from(map.keys()))[j]);
                var x = this.conversationData.answerForms.find(function(element) {
                    return element === currentSec.conversationType;
                });
                if (x !== undefined) {
                    // await step. context.sendActivity(`Moving to section ${ Array.from(map.keys())[i] }`);
                    this.conversationData.currSection = Array.from(map.keys())[j];
                    this.conversationData.qNum = 0;
                    this.conversationData.isRevised = false;
                    this.conversationData.sectionIndex = j;
                    this.conversationData.lastSectionQuestion = lastQfromSection(this.conversationData.currSection);
                    this.conversationData.lastMainQuestionAsked = [map.get(this.conversationData.currSection).qSet[0], 0];
                    return await dc.replaceDialog(STARTING_DIALOG);
                }
            }
            if (x === undefined || !x) {
                await dc.context.sendActivity('You reached the end of the bot. There are no sections left');
                this.conversationData.currSection = Array.from(map.keys())[0];
                this.conversationData.isRevised = false;
                this.conversationData.alreadySkipped = [];
                this.conversationData.qNum = 0;
                this.conversationData.sectionIndex = 0;
                this.conversationData.currQuestion = undefined;
                this.conversationData.lastSectionQuestion = lastQfromSection(this.conversationData.currSection);
                this.conversationData.lastMainQuestionAsked = [map.get(this.conversationData.currSection).qSet[0], 0];
                return await dc.endDialog();
            }
        } else {
            await dc.context.sendActivity("I am sorry, this section is mandatory. You can't skip this section. Type anything to continue.");
        };
    }

    // Update function
    // This function checks if the person we want to hire already exists in the
    // database, and if not then it creates a new entry.
    // If the person already exists then it updates that person's data in
    // database with the new answer array from the session.
    /**
     * Waterfall step that prompts the user to login if they have not already or their token has expired.
     */

    // returns an active token if it exists (For Login)
    // Checks if there was a token entered, and prompts if the user wants to view the token via choice prompt.

    // Waterfall step that will display the user's token. If the user's token is expired
    // or they are not logged in this will prompt them to log in first.

    async postToJira() {
        var bodyData = {
            'fields': {
                'project':
                {
                    'key': 'RBT'
                },
                'summary': 'Hobbs Testing Bug - AIC Chatbots',
                'description': feedbackText,
                'issuetype': {
                    'name': 'Bug'
                },
                'customfield_10022': 2
            }
        };

        var options = {
            method: 'POST',
            url: 'https://jira.cooperators.ca/rest/api/latest/issue/',
            auth: {
                user: username,
                password: password
            },
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: bodyData,
            json: true
        };
        request(options, function(error, response, body) {
            if (error) throw new Error(error);
            console.log(
                'Response: ' + response.statusCode + ' ' + response.statusMessage
            );
            console.log(body);
        });
    }

    //  @param {TurnContext} turnContext A TurnContext object that will be interpreted and acted upon by the bot.
    // Try to keep Onturn as clean as possible.
    async onTurn(turnContext) {
        // See https://aka.ms/about-bot-activity-message to learn more about the message and other activity types.
        if (turnContext.activity.type === ActivityTypes.Message) {
            // Create a dialog context object.
            const dc = await this.dialogs.createContext(turnContext);
            // const botAdapter = turnContext.adapter;
            const utterance = (turnContext.activity.text || '').trim().toLowerCase();
            // This if-else dialog is used for global interruptions.
            if (utterance === 'cancel' || utterance === 'logout') {
                if (dc.activeDialog) {
                    await dc.cancelAllDialogs();
                    // let botAdapter = turnContext.adapter;
                    // await botAdapter.signOutUser(turnContext, CONNECTION_NAME);
                    if (utterance === 'logout') {
                        await turnContext.sendActivity('You have been signed out.');
                    } else {
                        await dc.context.sendActivity(`Ok... canceled.`);
                    };
                }
                // Logout is currently commented out until a viable React.Js front end is established.
                // else if (utterance == 'logout') {
                //     let botAdapter = turnContext.adapter;
                //     await botAdapter.signOutUser(turnContext, CONNECTION_NAME);
                //     await turnContext.sendActivity('You have been signed out.');
                // }
                else {
                    await dc.context.sendActivity(`Nothing to cancel.`);
                };
            } else if (utterance.substr(0, 9) === '/feedback') {
                // this begins the feedback dialog.
                // await dc.beginDialog(FEEDBACK);
                feedbackText = utterance.substr(9);
                if (this.conversationData.currQuestion) {
                    feedbackText = feedbackText + '\n Question Number : ' + this.conversationData.currQuestion.qNumber;
                } else {
                    feedbackText = feedbackText + '\n General Feedback';
                }
                if (utterance.length <= 9) {
                    await dc.context.sendActivity('It seems like you did not enter any text after /feedback. Please try again.');
                } else {
                    await this.postToJira();
                }
            } else if (utterance === 'post') {
                // This is for posting the data you have to database
                // calling the update dialog when 'post" interruption is made
                // await dc.beginDialog(updateUserDialog);
            } else if (utterance === 'skip') {
                // await dc.context.sendActivity('Skipping the rest of the section');
                await this.skip(dc);
            };

            if (!turnContext.responded) {
                await dc.continueDialog();
                // if (this.conversationData.sectionIndex < Array.from(map.keys()).length) {
                //     // if user click continue, set isContinue to true and call the dialog
                //     var foundContinue = false;
                //     this.conversationData.continueIndex = this.conversationData.answerForms.indexOf('Continue');
                //     if (this.conversationData.continueIndex !== undefined && this.conversationData.continueIndex !== -1) {
                //         foundContinue = true;
                //     }
                //     if (this.conversationData.answerForms.length > 2 && foundContinue) {
                //         this.conversationData.isContinue = true;
                //         if (!turnContext.responded) {
                //             await dc.beginDialog(STARTING_DIALOG);
                //         }
                //     }
                // }
                // // call the dialog
                if (!turnContext.responded) {
                    //     // Checks if there is an active token, if not, prompts login.
                    //     // console.log('token LOG : ' + await botAdapter.getUserToken(turnContext, CONNECTION_NAME, ''));
                    //     // if (!await botAdapter.getUserToken(turnContext, CONNECTION_NAME, '')) {
                    //     //     await dc.cancelAllDialogs();
                    //     //     await dc.context.sendActivity('You are not signed in. Please Sign in');
                    //     //     await dc.beginDialog(AUTH_DIALOG);
                    //     // } else {
                    // // eslint-disable-next-line indent
                    await dc.beginDialog(STARTING_DIALOG);
                    //     // }
                }
            }
        } else if (turnContext.activity.type === ActivityTypes.ConversationUpdate) {
            if (turnContext.activity.membersAdded.length !== 0) {
                // Iterate over all new members added to the conversation
                for (var idx in turnContext.activity.membersAdded) {
                    // Greet anyone that was not the target (recipient) of this message.
                    // Since the bot is the recipient for events from the channel,
                    // context.activity.membersAdded === context.activity.recipient.Id indicates the
                    // bot was added to the conversation, and the opposite indicates this is a user.
                    if (turnContext.activity.membersAdded[idx].id !== turnContext.activity.recipient.id) {
                        // Send a 'this is what the bot does' message.

                        this.conversationData.isRevised = false;
                        this.conversationData.alreadySkipped = [];
                        this.conversationData.sectionIndex = 0;
                        const dc = await this.dialogs.createContext(turnContext);
                        this.conversationData.currSection = Array.from(map.keys())[0];
                        this.conversationData.qNum = 0;
                        this.conversationData.sectionIndex = 0;
                        console.log('Im updating!');
                        this.conversationData.currQuestion = undefined;
                        this.conversationData.answerForms = [];
                        this.conversationData.lastSectionQuestion = lastQfromSection(this.conversationData.currSection);
                        this.conversationData.lastMainQuestionAsked =
                            [map.get(this.conversationData.currSection).qSet[0], 0];
                        this.conversationData.isContinue = false;
                        // await dc.beginDialog(STARTING_DIALOG);
                    }
                }
            }
        }

        // Save changes to the user state.
        await this.userState.saveChanges(turnContext);

        // End thGis turn by saving changes to the conversation state.
        await this.conversationState.saveChanges(turnContext);
    }
}

module.exports.onboardingBot = onboardingBot;
