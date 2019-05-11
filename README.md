# Welcome to Hobbs!

Hobbs (or Hiring and On-boarding Bot Service ) is a chatbot  designed to assist internal employees on-board new hires for contractor positions, full time positions and co-op positions. It is built with Microsoft BotFramework, written in Node.js, and displayed using React. The core idea behind Hobbs was to speed up the on-boarding processes. The advisor will fill in the details of a client using the chatbot and post their information into the database.
  
## Prerequisites

- [Git][2]
- [Python 2.7][51] is recommended.  However we might use [Python 3.7][52] in the future.
-  [Node.js][4] version 8.5 or higher
```bash
# determine node version
node --version
```

# Overview
Hobbs consists mainly of `excelparse.js`, `index.js`, `parse.js` and `bot.js`. However, the core of Hobbs resides on `bot.js`, which consists of a series of different `waterfall dialog`.   

## Sections
 The whole question flow are designed to be a series of sections. Refer to the following example to see what a section consists of. **Note**: when displaying section names in Hobbs, we removed all the `, Position Name` and both `Menue` and `End` sections.  



`conversationType`: refers to the position that users are hiring for.

`parent`: Contains the first question in the `qSet` of the current section

`qSet`: Consists of all the questions and related information for the current section

`qNumber`: Contains the index of the `answerForms`(an array to store user input) for each question.
 
`answer`: Provides all the choices that users can choose from.

`dependencies`: is not none if the current question depends on a certain previous question. 

`qType`: is `buttons` if the current question offers choices for users to choose from.

`isMainDialog`:  is true if current question is a required question.

**Note**: the second `Qset` has dependencies `'Q:3-A:(Answered!)'` which means we assume the question whose `qNumber = 3` has already been answered. That is, Hobbs will not ask for user input for that question and will automatically put `(Answered!)` into the corresponding position in the `answerForms`

```bash
   'Job Posting, Contractor' => Section {
    name: 'Job Posting, Contractor',
    conversationType: 'Contractor',
    parent:
     QSet {
       qNumber: 3,
       question:
        'The first part of the hiring process is creating a job posting.',
       answer: 'none',
       dependencies: 'none',
       qType: 'Text',
       isMainDialog: false },
    qSet:
     [ QSet {
         qNumber: 3,
         question:
          'The first part of the hiring process is creating a job posting.',
         answer: 'none',
         dependencies: 'none',
         qType: 'Text',
         isMainDialog: false },
       QSet {
         qNumber: 4,
         question: 'Have you written the job posting?',
         answer: [ 'Yes', 'No' ],
         dependencies: 'Q:3-A:(Answered!)',
         qType: 'Buttons',
         isMainDialog: true },
       QSet {
         qNumber: 5,
         question: 'Have you emailed role posting to the contracting partner?',
         answer: [ 'Yes', 'No' ],
         dependencies: 'Q:4-A:Yes',
         qType: 'Buttons',
         isMainDialog: true },
       QSet {
         qNumber: 69,
         question:
          'Please email your contracting partner with the role posting.',
         answer: 'none',
         dependencies: 'Q:5-A:No',
         qType: 'Text',
         isMainDialog: false },
       QSet {
         qNumber: 70,
         question:
          'Write the job posting using job posting best practices: https://source-cooperators.ca/home/HR-site/my-development/career-opportunities/Documents/Job%20Posting%20Best%20Practices%20%5bfinal%5d.pdf',
         answer: 'none',
         dependencies: 'Q:4-A:No',
         qType: 'Text',
         isMainDialog: false } ] },
```
## File Conversion
- `excelparse.js`  converts `hobbs.csv` file from `botsociety` to a `.json` file and gives us `final.json`.
- `hobbs.csv` will be automatically downloaded from`botsociety`
- `qOneDep` and `conFullCoOp`refer to the position (Contractor, Full Time and Coop) that a section belongs to. 
- You could uncomment line 252, `console.log(util.inspect(sectionMap, { showHidden:  false, depth:  null }));`, to look up detailed for all the sections. 
- **Note**: `excelparse.js` will be automatically called when you run the bot. 

## Getting Data
- `parse.js`  reads data from `final.json`  and stores them into a Map object.
- **Note**: `parse.js` will be automatically called when you run the bot. 

## Constructor
- `this.conversationData.lastSectionQuestion` refers to the last question whose isMainDialog is true in the `qSet` of a section
-  `this.conversationData.lastMainQuestionAsked` refers to last asked question whose isMainDialog is true.

## Waterfall Dialog
 `bot.js` contains all the waterfall dialog that we used. A `waterfall` is a specific implementation of a dialog that walks a user through a series of tasks. 
   
**Starting Dialog**
* `STARTING_DIALOG` gets called from `onTurn` function. Each time this function is called, it determines what question number to ask based on dependencies/question flow.
* It is the heart of the question flow. Assigns current questions in step 1, finds out if users are trying to skip or jump over sections(sends them to either continue or jump dialog depending on what they want), deals with dependencies, records user's answers, and everything in between. Basically if you're confused about where something is happening, your first bet is to look at starting dialog and try to trace it from there
* We assume all the URLs in the context started with `http`.

**Handle Undone**
* `HandleUndone` is a dialog that let's users decide if they want to move on to the next required question or end their conversation with the bot after they reach a premature end to the section or conversation they're currently having. It uses the question flow and the fact that the question flow map used `DFS` to find the next required question.

**Continue Dialog**
- `CONTINUE_DIALOG` allows users to continue at where they left off based on data the bot got from the database.
- This dialog is under contruction due to authentication issues.


 **Jump Dialog**
- `JUMP_DIALOG` is initialized in `STARTING_DIALOG`/ `onTurn`  if user invokes it. It allows the user to jump to a section.
- `options` stores all the section names that will be displayed and `temp` renders the adaptive card. Checkout [Action.Submit][1] to learn more about how adaptive cards work.

**Next Dialog**
* `nextDialog` checks if it needs to move to anther section or end the conversation if the bot has arrived at a question that marks the end of a section.
* It handles the movement to sections and revisions and acts as a hub whenever you switch sections or reach the end of your current one. It let's users update the current section, know if they revised the section that we're skipping to, and handles the termination of the bot.

## onTurn Function


**Skip**
* This function is called when the users type `skip`. All the unanswered questions in the section are skipped if none of them are marked mandatory. 

**Feedback**
* Feedback acts as a global interruption. When invoked, whatever dialog is in process gets "paused" and the feedback process is executed. Once finished, it again performs the last activity that the bot was doing before we invoked /feedback (for e.g. Resume the question/text again that is paused before typing `/feedback`.) 

# To run the bot
- Install modules
```bash
npm install
```
- Start the bot
```bash
npm start
or
node index.js
```

# Testing the bot using Bot Framework Emulator **v4**

[Bot Framework Emulator][5] is a desktop application that allows bot developers to test and debug their bots on localhost or running remotely through a tunnel.

- Install the Bot Framework Emulator version 4.2.0 or greater from [here][6]

## Connect to the bot using Bot Framework Emulator **v4**

- Launch Bot Framework Emulator

- File -> Open Bot Configuration

- Fill out Bot name, Endpoint URL, Microsoft App ID and Microsoft App password

- Checkout `Encrypt keys stored in your bot configuration`

- Save and connect `Bot_name.bot`

**Note**: 
- After you save and connect the bot, you could find your bot under `My Bot` 
- To run the bot requires an `.env` file which contains Microsoft App ID and Microsoft App password. 
- Please checkout `Starting-from-the-beginning.mp4` and `Jump.mp4` since Miscrosoft App ID and password will not be provided due to security issues.
  
# Deploy the bot to Azure

## Prerequisites
-  [Azure Deployment Prerequisites][41]

## Provision a Bot with Azure Bot Service
After creating the bot and testing it locally, you can deploy it to Azure to make it accessible from anywhere. To deploy your bot to Azure:
```bash
# login to Azure
az login
```

```bash

# provision Azure Bot Services resources to host your bot
msbot clone services --name "AIC" --code-dir "." --location <azure region like eastus, westus, westus2 etc.> --sdkLanguage "Node" --folder deploymentScripts/msbotClone --verbose
```

## Publishing Changes to Azure Bot Service

As you make changes to your bot running locally, and want to deploy those change to Azure Bot Service, you can _publish_ those change using either `publish.cmd` if you are on Windows or `./publish` if you are on a non-Windows platform. The following is an example of publishing

```bash
# run the publish helper (non-Windows) to update Azure Bot Service. Use publish.cmd if running on Windows
./publish
```

## Getting Additional Help with Deploying to Azure
To learn more about deploying a bot to Azure, see [Deploy your bot to Azure][40] for a complete list of deployment instructions.

# Further reading

-  [Bot Framework Documentation][20]

-  [Bot Basics][32]

-  [Azure Bot Service Introduction][21]

-  [Azure Bot Service Documentation][22]

-  [Deploy Your Bot to Azure][40]

-  [Azure CLI][7]

-  [msbot CLI][9]

-  [Azure Portal][10]

-  [Language Understanding using LUIS][11]

-  [Restify][30]

-  [dotenv][31]

  

[2]: https://git-scm.com/downloads

[4]: https://nodejs.org

[1]: https://adaptivecards.io/explorer/Action.Submit.html

[5]: https://github.com/microsoft/botframework-emulator

[6]: https://github.com/Microsoft/BotFramework-Emulator/releases

[41]: ./PREREQUISITES.md

[20]: https://docs.botframework.com

[32]: https://docs.microsoft.com/en-us/azure/bot-service/bot-builder-basics?view=azure-bot-service-4.0

[21]: https://docs.microsoft.com/en-us/azure/bot-service/bot-service-overview-introduction?view=azure-bot-service-4.0

[22]: https://docs.microsoft.com/en-us/azure/bot-service/?view=azure-bot-service-4.0

[40]: https://aka.ms/azuredeployment

[7]: https://docs.microsoft.com/en-us/cli/azure/?view=azure-cli-latest

[9]: https://github.com/Microsoft/botbuilder-tools/tree/master/packages/MSBot

[10]: https://portal.azure.com

[11]: https://www.luis.ai

[30]: https://www.npmjs.com/package/restify

[31]: https://www.npmjs.com/package/dotenv

[51]: https://www.python.org/downloads/release/python-2716/

[52]: https://www.python.org/downloads/release/python-373/


