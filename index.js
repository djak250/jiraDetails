#! /usr/bin/env node

const stdin = process.stdin;
const stdout = process.stdout;
const stderr = process.stderr;
const request = require('request');
const fs = require('fs');

let error = false;
if (!process.env.JIRA_DOMAIN) {
    stderr.write('Missing JIRA_DOMAIN env variable\n');
    error = true;
}
if (!process.env.JIRA_USER) {
    stderr.write('Missing JIRA_USER env variable\n');
    error = true;
}
if (!process.env.JIRA_PW) {
    stderr.write('Missing JIRA_PW env variable\n');
    error = true;
}
if (process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0') {
    stderr.write(`Please set NODE_TLS_REJECT_UNAUTHORIZED='0'\n`);
    error = true;
}
if (error) {
    return;
}


const headers = {
    'Content-Type': 'application/json',
    url: `${process.env.JIRA_DOMAIN}/rest/api/2/search?fields=id,key,summary`,
    json: true,
    auth: {
        user: process.env.JIRA_USER,
        password: process.env.JIRA_PW
    }
};
let gitBranches = [];
let gitBranchesSanitized = [];

const buildQuery = function(keys) {
    let query = '&jql=';
    for (let i = 0; i < keys.length; i++) {
        if (i !== 0) {
            query += ' OR ';
        }
        query += `key=${keys[i]}`;
    }

    return query;
};


const buildBranchList = function() {
    fs.readFile('/tmp/jira.cache', (err, fileOutput) => {
        if (fileOutput) {
            const cachedIssuesMap = new Map();
            const cachedIssuesArray = !!fileOutput ? fileOutput.toString().trim().split('\n') : [];
            const cachedIssueKeys = [];
            for (let i = 0; i < cachedIssuesArray.length; i++) {
                const issue = cachedIssuesArray[i].split('|');
                cachedIssueKeys.push(issue[0]);
                cachedIssuesMap.set(issue[0], issue[1]);
            }
            const formattedJiraBranches = gitBranches.map((gb) => {
                if (/\S-\d/.test(gb)) {
                    const sanitizedBranch = gb.trim().replace(/^\*\s*/, '').replace(/^\S*\//, '');
                    return `${gb} | ${cachedIssuesMap.get(sanitizedBranch)}`;
                }
                return gb;
            }).map((gb) => {
                if (gb.indexOf('*') === 0) {
                    return `\x1b[32m${gb}\x1b[0m`;
                }
                return gb;
            });
            stdout.write(`${formattedJiraBranches.join('\n')}`);
        } else {
            gitBranches = gitBranches.map((gb) => {
                if (gb.indexOf('*') === 0) {
                    return `\x1b[32m${gb}\x1b[0m`;
                }
                return gb;
            });
            stdout.write(`${gitBranches.join('\n')}`);
        }
        process.exit(0);
    });
};


let piped = false;
stdin.on('readable', () => {
    const chunk = stdin.read();
    if (chunk !== null) {
        piped = true;
        gitBranches = chunk.toString().split('\n');
        gitBranchesSanitized = chunk
            .toString()
            .replace(/[ ,*]/g, '')
            .trim()
            .split('\n');
        const jiraIssues = gitBranchesSanitized
            .filter((b) => /\S-\d/.test(b))
            .map((b) => b.replace(/^\S*\//, ''));

        fs.readFile('/tmp/jira.cache', (err, fileOutput) => {
            const cachedIssuesMap = new Map();
            const cachedIssuesArray = !!fileOutput ? fileOutput.toString().trim().split('\n') : [];
            const cachedIssueKeys = [];
            for (let i = 0; i < cachedIssuesArray.length; i++) {
                const issue = cachedIssuesArray[i].split('|');
                cachedIssueKeys.push(issue[0]);
                cachedIssuesMap.set(issue[0], issue[1]);
            }
            const missingKeys = jiraIssues.filter((ji) => cachedIssueKeys.indexOf(ji));
            if (missingKeys.length !== 0) {
                headers.url += buildQuery(missingKeys);
                request(headers, (err, response, body) => {
                    if (!!err) return stderr.write(`${err.toString()}\n`);
                    if (!body) return stderr.write('MISSING BODY\n');
                    if (!body.issues || !body.issues.length) return stderr.write('EMPTY BODY\n');


                    const issueMap = new Map();
                    for (let i = 0; i < body.issues.length; i++) {
                        const issue = body.issues[i];
                        issueMap.set(issue.key, issue.fields.summary);
                    }


                    fs.appendFile('/tmp/jira.cache', `${Array.from(issueMap).map((i) => (`${i[0]}|${i[1]}`)).join('\n')}\n`, buildBranchList);
                });
            } else {
                buildBranchList(null);
            }
        });
    } else if (!piped) {
        stderr.write('Usage: git branch | jiraDetails\n');
        process.exit(1);
    }
});


