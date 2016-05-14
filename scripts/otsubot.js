// Description:
//   タイムカード（勤務表）コマンドです。勤務開始/終了時刻の記録と勤務表の表示ができます。
//
// Commands:
//   hi [-u <user>] [[<date>] <from time>[-<to time>]] - 勤務開始時刻を記録します。
//   bye [-u <user>] [[<date>] [<from time>-]<to time>] - 勤務終了時刻を記録します。
//   list [-u <user>] [<month>] - 勤務表を表示します。
//   csvlist [-u <user>] [<month>] - 勤務表をCSV形式で表示。（使い方はlistと同じ）
//
// Examples:
//   hi - 今、会社に着いた。
//   bye - 今、会社を出る。
//   list - 今月の勤務表を見たい。
//   hi 9 - 今朝は9:00に出社した。
//   bye 1730 - 今日は17:30に退社した。
//   hi 12/24 9-1730 - 12月24日は9:00~17:30まで勤務した。
//   bye 12/24 9-1730 - 同上
//   bye -u rotsuya - rotsuyaが会社を出たので代わりに記録してあげる。
//   list 201412 - 2014年12月の勤務表を見たい。
//   list -u rotsuya 201412 - rotsuyaの2014年12月の勤務表を見たい。
//
// Notes:
//   <date> is YYYY/MM/DD, YYYYMMDD, YY/MM/DD, YYMMDD, MM/DD, M/D or MDD
//   <time> is HH:MM, HHMM, H:MM, HMM, HH or H
//   <month> is YYYY/MM, YYYYMM, YY/MM, YYMM, MM or M
//
// Author:
//   rotsuya

module.exports = function (robot) {
    var RESPONSE_TO_YOTEI = ['了解！ %{user} は本日、%{from} に出社予定です。'];
    var RESPONSE_TO_HI = ['おはようございます。%{user}の%{date}の勤務時間は%{from}~%{to}だね。'];
    var RESPONSE_TO_BYE = [
        'お疲れさま。%{user}の%{date}の勤務時間は%{from}~%{to}だね。'
        ,'お疲れさま。%{user}の%{date}の勤務時間は%{from}~%{to}だね。'
        ,'お疲れさま。%{user}の%{date}の勤務時間は%{from}~%{to}だね。'
        ,'お疲れさま。%{user}の%{date}の勤務時間は%{from}~%{to}だね。'
        ,'乙。%{user}の%{date}の勤務時間は%{from}~%{to}だね。'
    ];
    var RESPONSE_BEFORE_TO_LIST = ['%{user}の%{month}月の勤務表だね。'];
    var RESPONSE_BEFORE_TO_CSV = ['%{user}の%{month}月の勤務表をCSV出力するよ。'];
    var RESPONSE_AFTER_TO_LIST = ['%{list}'];
    var LIST_HEADER = 'date       | recorded      | calculated    | duration | overtime';
    var LIST_FOOTER = 'sum        |       |       |       |       | ';
    var CSV_HEADER = 'Date,Start,End,"Calc start","Calc end",Duration,Overtime';
    var CSV_FOOTER = 'Sum,,,,,';
    var RESPONSE_NONE_TO_LIST = ['なかったよ。'];
    var RESPONSE_TO_ERROR = ['エラーが起きちゃった。%{message}'];
    var INCREMENT_MINUTES = 15;
    var MILLISEC_PER_HOUR = 60 * 60 * 1000;
    var MILLISEC_PER_MINUTE =  60 * 1000;
    var BASE_WORK_DURATION = MILLISEC_PER_HOUR * 9;

    robot.hear(/^list(?: -u ([^\s]+))?(?: (?:(\d{2}|\d{4})\/?)?(\d{1,2}))? *$/i, listCommand('list'));

    robot.hear(/^csvlist(?: -u ([^\s]+))?(?: (?:(\d{2}|\d{4})\/?)?(\d{1,2}))? *$/i, listCommand('csv'));

    robot.hear(/^(?:hi|hello|おは\S*)(?: -u ([^\s]+))?(?:(?: ([\d\/]+))?(?: (?:([\d:]+)-?)(?:-([\d:]+))?))? *$/i, hiByeCommand('hi'));

    robot.hear(/^(?:bye|おつ\S*|お疲れ\S*|乙|さよ\S*)(?: -u ([^\s]+))?(?:(?: ([\d\/]+))?(?: (?:([\d:]+)-)?(?:-?([\d:]+))))? *$/i, hiByeCommand('bye'));

    function listCommand(command) {
        return function(msg) {
            try {
                var csvFlag = '';
                if (/csv/.test(command)) {
                    csvFlag = 1;
                }

                var user = msg.message.user.name;
                if (msg.match[1]) {
                    user = msg.match[1].replace(/^@/, '');
                }

                var date = getToday();
                if (msg.match[2]) {
                    if (msg.match[2].length === 2) {
                        msg.match[2] = '20' + msg.match[2];
                    }
                    date.setFullYear(msg.match[2] - 0);
                }

                if (msg.match[3]) {
                    date.setMonth(msg.match[3] - 1);
                }

                var month = date.getMonth();
                var response = msg.random(RESPONSE_BEFORE_TO_LIST);
                if (csvFlag) {
                    response = msg.random(RESPONSE_BEFORE_TO_CSV);
                }
                response = response.replace(/%\{user\}/, user);
                response = response.replace(/%\{month\}/, month + 1);
                msg.send(response);

                setTimeout(function() {
                    var key;
                    var value;
                    var list = '';
                    var durationSum = 0;
                    var increment = INCREMENT_MINUTES * MILLISEC_PER_MINUTE;

                    for (var day = 1; day <= 31; day++) {
                        var from;
                        var fromString = '';
                        var to;
                        var toString = '';
                        var fromCalc;
                        var fromCalcString = '';
                        var toCalc;
                        var toCalcString = '';
                        var duration = 0;
                        var durationString = '';
                        var durationDiff = 0;
                        var overtime = 0;
                        var overtimeString = '';
                        var overtimeDiff = 0;

                        date.setDate(day);
                        if (date.getMonth() !== month) {
                            break;
                        }

                        var dateString = getDateStringFromDate(date, '/');
                        key = [user, dateString];
                        value = robot.brain.get(JSON.stringify(key));

                        if (value) {
                            fromString = value[0];
                            toString = value[1];

                            if (fromString) {
                                from = getDateFromTimeString(date, fromString);
                                fromCalc = new Date(Math.ceil(from.getTime() / increment) * increment);
                                fromCalcString = getTimeStringFromDate(fromCalc, ':');
                            } else {
                                fromString = csvFlag ? '' : '     ';
                                fromCalcString = csvFlag ? '' : '     ';
                            }

                            if (toString) {
                                to = getDateFromTimeString(date, toString);
                                if (from > to) {
                                    to = new Date(to.getTime() + 24 * 60* 60 * 1000);
                                }
                                toCalc = new Date(Math.floor(to.getTime() / increment) * increment);
                                toCalcString = getTimeStringFromDate(toCalc, ':');
                            } else {
                                toString = csvFlag ? '' : '     ';
                                toCalcString = csvFlag ? '' : '     ';
                            }

                            // Duration
                            if (toCalc && fromCalc) {
                                durationDiff = toCalc - fromCalc;
                                if (durationDiff > 0) {
                                    duration = durationDiff;
                                }
                            }
                            durationSum += duration;
                            if (duration) {
                                durationString = getTimeStringFromValue(duration, ':')
                                if (!csvFlag) {
                                    durationString += '   ';
                                }
                            } else {
                                durationString = csvFlag ? '' : '        ';
                            }

                            // Overtime
                            overtimeDiff = duration - BASE_WORK_DURATION;
                            overtime = overtimeDiff > 0 ? overtimeDiff : 0;
                            overtimeString = overtime ? getTimeStringFromValue(overtime, ':') : '';

                            if (csvFlag) {
                                list += [dateString, fromString, toString, fromCalcString, toCalcString, durationString, overtimeString].join(',') + '\n';
                            } else {
                                list += [dateString, fromString, toString, fromCalcString, toCalcString, durationString, overtimeString].join(' | ') + '\n';
                            }
                        } else if (csvFlag) {
                            list += dateString + ',,,,,,\n';
                        }
                    }

                    if (list) {
                        if (csvFlag) {
                            list = '```' + CSV_HEADER + '\n' + list + CSV_FOOTER + getTimeStringFromValue(durationSum, ':') + '```';
                        } else {
                            list = '```' + LIST_HEADER + '\n' + list + LIST_FOOTER + getTimeStringFromValue(durationSum, ':') + '```';
                        }
                    }

                    var response = list ? msg.random(RESPONSE_AFTER_TO_LIST) : msg.random(RESPONSE_NONE_TO_LIST);
                    response = response.replace(/%\{list\}/, list);
                    msg.send(response);
                }, 1000);
            } catch (e) {
                error(e, msg);
            }
        };
    }

    function hiByeCommand(command) {
        return function(msg) {
            try {
                var user = msg.message.user.name;
                if (msg.match[1]) {
                    user = msg.match[1].replace(/^@/, '');
                }

                var dateInput = msg.match[2];
                var fromInput = msg.match[3];
                var toInput = msg.match[4];

                var date = getToday();
                var from;
                var to;
                var fromDate;
                var fromNow;
                var futureFlag = 0;

                if (dateInput && !fromInput && !toInput) {
                    throw (new Error('第1引数があるのに、第2、第3引数が無いよ。'));
                    return;
                }

                if (!dateInput && !fromInput && !toInput) {
                    if (/hi/.test(command)) {
                        from = getNow();
                    } else if (/bye/.test(command)) {
                        to = getNow();
                    }
                } else {
                    if (dateInput) {
                        date = getDateFromDateString(dateInput);
                    }

                    if (fromInput) {
                        from = getDateFromTimeString(date, fromInput);
                        fromDate = date - getToday();
                        fromNow = from - getNow();

                        if (fromDate === 0 && fromNow > 0) {
                            futureFlag = 1;
                        }
                    }

                    if (toInput) {
                        to = getDateFromTimeString(date, toInput);
                    }
                }

                var dateOutput = getDateStringFromDate(date, '/');
                if (from) {
                    var fromOutput = getTimeStringFromDate(from, ':');
                }
                if (to) {
                    var toOutput = getTimeStringFromDate(to, ':');
                }

                save(user, dateOutput, fromOutput, toOutput);
                respond(command, user, dateOutput, fromOutput, toOutput, futureFlag, msg);
            } catch (e) {
                error(e, msg);
            }
        };
    }

    function getTimeStringFromDate(time, separator) {
        var hour = zeroPadding(time.getHours(), 2);
        var minute = zeroPadding(time.getMinutes(), 2);
        return [hour, minute].join(separator || '');
    }

    function getDateStringFromDate(date, separator) {
        var year = zeroPadding(date.getFullYear(), 4);
        var month = zeroPadding(date.getMonth() + 1, 2);
        var day = zeroPadding(date.getDate(), 2);
        return [year, month, day].join(separator || '');
    }

    function getTimeStringFromValue(value, separator) {
        var hour = zeroPadding(Math.floor(value / MILLISEC_PER_HOUR), 2);
        var minute = zeroPadding((value % MILLISEC_PER_HOUR) / MILLISEC_PER_MINUTE, 2);
        return [hour, minute].join(separator || '');
    }

    function zeroPadding(number, length) {
        return (Array(length).join('0') + number).slice(-length);
    }

    function save(user, date, from, to) {
        var key = [user, date];
        var value = robot.brain.get(JSON.stringify(key)) || [];
        if (from) {
            value[0] = from;
        }
        if (to) {
            value[1] = to;
        }
        robot.brain.set(JSON.stringify(key), value);
    }

    function respond(command, user, date, from, to, flag, msg) {
        if (/hi/.test(command)) {
            if (flag === 1) {
                var response = msg.random(RESPONSE_TO_YOTEI);
            } else {
                var response = msg.random(RESPONSE_TO_HI);
            }
        } else if (/bye/.test(command)) {
            var response = msg.random(RESPONSE_TO_BYE);
        }
        response = response.replace(/%\{user\}/, user);
        response = response.replace(/%\{date\}/, date);
        response = response.replace(/%\{from\}/, from || '');
        response = response.replace(/%\{to\}/, to || '');
        msg.send(response);
    }

    function getDateFromTimeString(date, string) {
        var year = date.getFullYear();
        var month = date.getMonth();
        var day = date.getDate();

        if (/:/.test(string)) {
            var hm = /^(\d{1,2}):(\d{1,2})$/.exec(string);
        } else if (string.length === 3 || string.length === 4) {
            var hm = /^(\d{1,2})(\d{2})$/.exec(string);
        } else {
            var hm = /^(\d{1,2})$/.exec(string);
        }
        if (!hm) {
            throw (new Error('時刻がパースできないよ。'));
            return;
        }
        var time = new Date(year, month, day, (hm[1] - 0) || 0, (hm[2] - 0) || 0);
        var today = new Date(year, month, day);
        var tomorrow = new Date(year, month, day + 1);
        if (time < today || time >= tomorrow) {
            throw (new Error('時刻がおかしいよ。'));
            return;
        }
        return time;
    }

    function getDateFromDateString(string) {
        var date = getToday();
        var year = date.getFullYear();
        var month = date.getMonth();
        var day = date.getDate();

        if (/\//.test(string)) {
            var ymd = /^(?:(\d{2}|\d{4})\/)?(?:(\d{1,2})\/)(?:(\d{1,2})$)/.exec(string);
        } else {
            var ymd = /^(\d{2}|\d{4})?(\d{1,2})(\d{2})$/.exec(string);
        }
        if (!ymd) {
            throw (new Error('日付がパースできないよ。'));
            return;
        }

        if (ymd[1] && ymd[1].length === 2) {
            ymd[1] = '20' + ymd[1];
        }

        return (new Date((ymd[1] - 0) || year, ymd[2] ? ymd[2] - 1 : month, (ymd[3] - 0) || day));
    }

    function getToday() {
        var date = new Date();
        date.setHours(0);
        date.setMinutes(0);
        date.setSeconds(0);
        date.setMilliseconds(0);
        return date;
    }

    function getNow() {
        var time = new Date();
        return time;
    }

    function error(e, msg) {
        var response = msg.random(RESPONSE_TO_ERROR);
        response = response.replace(/%\{message\}/, e.message);
        msg.send(response);
    }
};
