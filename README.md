# jiraDetails
## Installation
  `npm install -g https://github.com/djak250/jiraDetails`

  `export JIRA_DOMAIN="{your_jira_domain}"`

  `export JIRA_USER="{jira_username}"`

  `export JIRA_PW="{jira_password}"`

  `export NODE_TLS_REJECT_UNAUTHORIZED='0'`, if using SSL. Most likely should always be true.

  ###Optional

  `export LOG_LEVEL='error'`, to view error output.

## Usage
`git branch | jiraDetails`

## Arguments
- `--git`
  - Use this option when passing in git branch out. Will return the branches in the same format with the jira summaries to the end of each line
  - NOTE: This will only match the first issue per line, to remain consistent with a single line for each branch. Eg., feature/ABC-1234-and-DEF-5678 will only match the ABC-1234, and display it's summary. 
  - Add `--color` to `git branch` and `git branch --all` maintain color output when piped through `jiraDetails`.
  ```shell
  * feature/ABC-100 | Detail JiraDetails
    feature/ABC-101 | Document JiraDetails
    feature/DEF-201 | Implement JiralDetails
    master
    nonJiraBranch
  ```
- `--html`
  - Outputs issues in an unordered list formatted in HTML
    ```html
    <ul>
        <li><b>TKA-1234</b> - Fix the problem with IRA's not being able to fill out the information</li>
    </ul>
    ```

- `--markdown`
  - Outputs issues in an unordered list formatted in Markdown
    ```
    - **TKA-1234** - Fix the problem with IRA's not being able to fill out the information
    ```

- `--summary`
  - Outputs only the summary for the input issues

## Example
```shell
$ git branch | jiraDetails --git
* feature/ABC-100 | Detail JiraDetails
  feature/ABC-101 | Document JiraDetails
  feature/DEF-201 | Implement JiralDetails
  master
  nonJiraBranch
```
