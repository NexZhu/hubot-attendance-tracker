# hubot-attendance-tracker

#### An attendance logging script for hubot

## Description:

Attendance command using [Hubot](http://github.com/github/hubot).

This script is customized from [otsubot](https://github.com/rotsuya/otsubot) and [hubot-attendance]
(https://github.com/hirosat/hubot-attendance).

## Installation

Run the npm install command...

    npm install hubot-attendance-tracker

Add the script to the `external-scripts.json` file

    ["hubot-attendance-tracker"]

## Commands:

* `hi [-u <user>] [[<date>] <from time>[-<to time>]]` - Set a working start time.
* `bye [-u <user>] [[<date>] [<from time>-]<to time>]` - Set a working end time.
* `rm [-u <user>] <date>` - Remove a record.
* `list [-u <user>] [<month>]` - Print a working time list.
* `csvlist [-u <user>] [<month>]` - Print a working time list as a csv format.

### Formatting

* `<date>` is YYYY/MM/DD, YYYYMMDD, YY/MM/DD, YYMMDD, MM/DD, M/D or MDD
* `<time>` is HH:MM, HHMM, H:MM, HMM, HH or H
* `<month>` is YYYY/MM, YYYYMM, YY/MM, YYMM, MM or M

## Examples:

### Basics

* `hi` - Type this when you arrive your company.
* `bye` - Type this when you leave your company.
* `list` - Type this when you want to see a working time list of this month.

### Advanced

* `hi 9` - You arrived your company at 9:00.
* `bye 1730` - You left your company at 17:30.
* `hi 1224 0900` - December 24, you worked from 9:00.
* `hi 12/24 9-1730` - December 24, you worked from 9:00 to 17:30.
* `bye 12/24 9-1730` - Same as above.
* `bye -u rotsuya` - rotsuya left your company.
* `rm 12/24` - Remove the record of December 24.
* `list 201412` - You want to see a working time list of December 2014.
* `list -u rotsuya 201412` - You want to see a working time list for rotsuya of
December 2014.
