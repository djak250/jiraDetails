#! /usr/bin/env node
'use strict';

const request = require('request');
const fs = require('fs');
const columnify = require('columnify');

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const STDIN = process.stdin;
const STDOUT = process.stdout;
const STDERR = process.stderr;
const COLUMNCONFIG = {
    showHeaders: false,
    columns: ['current', 'issue', 'summary']
};

let READ_DATA = false;

let GIT_OUTPUT = false;
let gitBranches = [];
const gitBranchMap = new Map();

let HTML_OUTPUT = false;
let MARKDOWN_OUTPUT = false;
let SUMMARY_OUTPUT = false;

for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === '--git') {
        GIT_OUTPUT = true;
    } else if (process.argv[i] === '--html') {
        HTML_OUTPUT = true;
    } else if (process.argv[i] === '--markdown') {
        MARKDOWN_OUTPUT = true;
    } else if (process.argv[i] === '--summary') {
        SUMMARY_OUTPUT = true;
    }
}

let error = false;
if (!process.env.JIRA_DOMAIN) {
    STDERR.write('Missing JIRA_DOMAIN env variable\n');
    error = true;
}
if (!process.env.JIRA_USER) {
    STDERR.write('Missing JIRA_USER env variable\n');
    error = true;
}
if (!process.env.JIRA_PW) {
    STDERR.write('Missing JIRA_PW env variable\n');
    error = true;
}
if (process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0') {
    STDERR.write('Please set NODE_TLS_REJECT_UNAUTHORIZED=\'0\'\n');
    error = true;
}
if (error) {
    return;
}

const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    url: `${process.env.JIRA_DOMAIN}/rest/api/2/search`,
    auth: {
        user: process.env.JIRA_USER,
        password: process.env.JIRA_PW
    }
};

const loadCache = function(cb) {
    fs.readFile(`${__dirname}/.jira.cache`, 'utf8', (err, fileOutput) => {
        if (fileOutput) {
            const cachedIssuesMap = new Map(
                fileOutput.trim().split('\n')
                .map((line) => line.split('|'))
            );
            return cb(cachedIssuesMap);
        }
        cb(new Map());
    });
};

const appendCache = function(missingIssueMap, cb) {
    fs.appendFile(
        `${__dirname}/.jira.cache`,
        `${Array.from(missingIssueMap).map((i) => i.join('|')).join('\n')}\n`,
        'utf8',
        cb
    );
};

const buildJQL = function(keys) {
    let jql = '';
    for (let i = 0; i < keys.length; i++) {
        if (i !== 0) {
            jql += ' OR ';
        }
        jql += `key=${keys[i]}`;
    }

    return jql;
};

function fetchMissingIssues(missingKeys, cb, errCb) {
    if (missingKeys.length !== 0) {
        headers.json = {
            jql: buildJQL(missingKeys),
            fields: ['id', 'key', 'summary']
        };
        request.post(headers, (err, response, body) => {
            if (!!err) return errCb(new Error(`${err.toString()}\n`));
            if (!body) return errCb(new Error('MISSING BODY\n'));
            if (!!body.errorMessages) {
                let nonExistingKeys = [];
                nonExistingKeys = nonExistingKeys.concat(body.errorMessages.map((eM) => {
                    const matches = /An issue with key '(\S*)' does not exist/.exec(eM);
                    if (!!matches) {
                        return matches[1];
                    }
                    return null;
                }));
                nonExistingKeys = nonExistingKeys.concat(body.errorMessages.map((eM) => {
                    const matches = /The issue key '(\S*)' for field 'key' is invalid/.exec(eM);
                    if (!!matches) {
                        return matches[1];
                    }
                    return null;
                }));
                const newMissingKeys = missingKeys.filter((mk) => nonExistingKeys.indexOf(mk) === -1);
                return fetchMissingIssues(newMissingKeys, cb, errCb);
            }
            if (!body.issues || !body.issues.length) return errCb(new Error('EMPTY BODY\n'));
            const missingIssueMap = new Map(body.issues.map((issue) => [issue.key, issue.fields.summary]));
            appendCache(missingIssueMap, cb);
        });
    } else {
        cb();
    }
}

const printToScreen = function(issuesToPrintMap /* { Issue: Summary} */) {
    if (GIT_OUTPUT) {
        const gitOutputArray = [];
        for (let i = 0, l = gitBranches.length; i < l; i++) {
            const gitBranch = gitBranches[i];
            const gitBranchObj = {
                current: gitBranch.indexOf('*') === 0 ? '*' : '',
                issue: gitBranch.replace(/^\* /, ''),
                summary: issuesToPrintMap.get(gitBranchMap.get(gitBranch)) || ''
            };
            gitOutputArray.push(gitBranchObj);
        }
        STDOUT.write(columnify(gitOutputArray, COLUMNCONFIG));
    } else {
        const issuesArrayObject = Array.from(issuesToPrintMap.entries()).map(([issue, summary]) => ({ issue: issue, summary: summary }));
        if (HTML_OUTPUT) {
            let output = '<ul>\n';
            output += issuesArrayObject.map((issue) => `\t<li><b>${issue.issue}</b> - ${issue.summary}</li>`).join('\n');
            output += '\n</ul>';
            STDOUT.write(output);
        } else if (MARKDOWN_OUTPUT) {
            const output = issuesArrayObject.map((issue) => `- **${issue.issue}** - ${issue.summary}`);
            STDOUT.write(output.join('\n'));
        } else if (SUMMARY_OUTPUT /* Only prints out summary text*/) {
            STDOUT.write(Array.from(issuesToPrintMap.values()).join('\n'));
        } else {
            STDOUT.write(columnify(issuesArrayObject, COLUMNCONFIG));
        }
    }
    STDOUT.write('\n');
};

STDIN.on('readable', () => {
    const chunk = STDIN.read();
    if (chunk !== null) {
        READ_DATA = true; // Flag to prevent exit as data has been read regardless of future null reads
        let issueKeys = [];
        if (GIT_OUTPUT) {
            gitBranches = gitBranches.concat(chunk.toString().trim().split('\n'));
            issueKeys = gitBranches
                .filter((gb) => /\w+-\d+/.test(gb))
                .map((gb) => {
                    // Adds the jira issue ticket to the branch description key
                    gitBranchMap.set(gb, gb.match(/\w+-\d+/)[0].toUpperCase());
                    return gb.match(/\w+-\d+/)[0].toUpperCase();
                });
        } else {
            issueKeys = chunk.toString().trim().match(/\w+-\d+/g) || [];
            issueKeys = issueKeys.map(i => i.toUpperCase());
        }

        loadCache((cachedIssuesMap) => {
            const cachedIssueKeys = Array.from(cachedIssuesMap.keys());
            const missingKeys = issueKeys.filter((ji) => cachedIssueKeys.indexOf(ji) === -1);
            fetchMissingIssues(missingKeys,
            () => {
                loadCache((issues) => {
                    const outputIssueMap = new Map();
                    for (let i = 0, l = issueKeys.length; i < l; i++) {
                        const issue = issueKeys[i];
                        if (issues.has(issue)) {
                            outputIssueMap.set(issue, issues.get(issue));
                        }
                    }
                    printToScreen(outputIssueMap);
                });
            }, (fetchError) => {
                if (LOG_LEVEL === 'ERROR') STDERR.write(fetchError.toString());
            });
        });
    } else if (!READ_DATA) {
        STDERR.write('Usage: git branch | jiraDetails\n');
        process.exit(1);
    }
});
