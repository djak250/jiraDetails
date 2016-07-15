# jiraDetails

##Installation
  `npm install -g https://github.com/djak250/jiraDetails`

  `export JIRA_DOMAIN="{your_jira_domain}"`

  `export JIRA_USER="{jira_username}"`

  `export JIRA_PW="{jira_password}"`

  `export NODE_TLS_REJECT_UNAUTHORIZED='0'`, if using SSL. Most likely should always be true.

  ###Optional

  `export LOG_LEVEL='error'`, to view error output.

## Usage
`git branch | jiraDetails`

## Example
```shell
$ git branch | jiraDetails
* feature/ABC-100 | Detail JiraDetails
  feature/ABC-101 | Document JiraDetails
  feature/DEF-201 | Implement JiralDetails
  master
  nonJiraBranch
```
