// Description:
//   Attendance command using hubot.
//   This script is customized from otsubot(https://github.com/rotsuya/otsubot) and
//   hubot-attendance(https://github.com/hirosat/hubot-attendance)
//
// Dependencies:
//   None
//
// Configuration:
//   None
//
// Commands:
//   hi [-u <user>] [[<date>] <from time>[-<to time>]] - Set a working start time.
//   bye [-u <user>] [[<date>] [<from time>-]<to time>] - Set a working end time.
//   list [-u <user>] [<month>] - Print a working time list.
//   csvlist [-u <user>] [<month>] - Print a working time list as a csv format.
//
// Examples:
//   hi - Type this when you arrive your company.
//   bye - Type this when you leave your company.
//   list - Type this when you want to see a working time list of this month.
//   hi 9 - You arrived your company at 9:00.
//   bye 1730 - You left your company at 17:30.
//   hi 1224 0900 - December 24, you worked from 9:00.
//   hi 12/24 9-1730 - December 24, you worked from 9:00 to 17:30.
//   bye 12/24 9-1730 - Same as above.
//   bye -u rotsuya - rotsuya left your company.
//   list 201412 - You want to see a working time list of December 2014.
//   list -u rotsuya 201412 - You want to see a working time list for rotsuya of December 2014.
//
// Notes:
//   <date> is YYYY/MM/DD, YYYYMMDD, YY/MM/DD, YYMMDD, MM/DD, M/D or MDD
//   <time> is HH:MM, HHMM, H:MM, HMM, HH or H
//   <month> is YYYY/MM, YYYYMM, YY/MM, YYMM, MM or M
//
// Author:
//   Nex Zhu

module.exports = function (robot) {
  const RESPONSE_TO_FUTURE = ['Sure. %{user} will arrive at %{from}.']
  const RESPONSE_TO_HI = ['Good morning! %{user} started working at %{from}-%{to} on %{date}.']
  const RESPONSE_TO_BYE = ['Good bye! %{user} finished working at %{from}-%{to} on %{date}.']
  const RESPONSE_TO_REMOVE = ['Removed record for %{user} on %{date}.']
  const RESPONSE_BEFORE_TO_LIST = ['OK. There is %{user}\'s working time list on %{month}.']
  const RESPONSE_BEFORE_TO_CSV = ['OK. There is %{user}\'s working time list on %{month} with' +
  ' CSV format.']
  const RESPONSE_AFTER_TO_LIST = ['%{list}']
  const LIST_HEADER = "| date       | from  | to    | from' | to'   | delta | over  |\n| :--------- |:----- | :---- | :---- | :---- | :---- | :---- |"
  const LIST_FOOTER = '| sum        |       |       |       |       |       |       |'
  const CSV_HEADER = 'Date,Start,End,"Calc start","Calc end",Duration,Overtime'
  const CSV_FOOTER = 'Sum,,,,,'
  const RESPONSE_NONE_TO_LIST = ['The list of %{month} is nothing.']
  const RESPONSE_TO_ERROR = ['Error occurred: %{message}']
  const INCREMENT_MINUTES = 15
  const MILLISEC_PER_HOUR = 60 * 60 * 1000
  const MILLISEC_PER_MINUTE = 60 * 1000
  const BASE_WORK_DURATION = MILLISEC_PER_HOUR * 9
  const MONTH_NAME = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  robot.hear(/^list(?: -u ([^\s]+))?(?: (?:(\d{2}|\d{4})\/?)?(\d{1,2}))? *$/i, listCommand('list'))

  robot.hear(/^csvlist(?: -u ([^\s]+))?(?: (?:(\d{2}|\d{4})\/?)?(\d{1,2}))? *$/i, listCommand('csv'))

  robot.hear(/^(?:hi|hello)(?: -u ([^\s]+))?(?:(?: ([\d\/]+))?(?: (?:([\d:]+)-?)(?:-([\d:]+))?))? *$/i, hiByeCommand('hi'))

  robot.hear(/^(?:bye)(?: -u ([^\s]+))?(?:(?: ([\d\/]+))?(?: (?:([\d:]+)-)?(?:-?([\d:]+))))? *$/i, hiByeCommand('bye'))

  robot.hear(/^(?:del|delete|rm|remove)(?: -u ([^\s]+))?(?: ([\d\/]+))+ *$/i, removeCommand())

  function listCommand(command) {
    return function (msg) {
      try {
        let csvFlag = ''
        if (/csv/.test(command)) {
          csvFlag = 1
        }

        let user = msg.message.user.name
        if (msg.match[1]) {
          user = msg.match[1].replace(/^@/, '')
        }

        const date = getToday()
        if (msg.match[2]) {
          if (msg.match[2].length === 2) {
            msg.match[2] = '20' + msg.match[2]
          }
          date.setFullYear(msg.match[2] - 0)
        }

        if (msg.match[3]) {
          date.setMonth(msg.match[3] - 1)
        }

        const month = date.getMonth()
        let response = msg.random(RESPONSE_BEFORE_TO_LIST)
        if (csvFlag) {
          response = msg.random(RESPONSE_BEFORE_TO_CSV)
        }
        response = response.replace(/%{user}/, user)
        response = response.replace(/%{month}/, MONTH_NAME[month])
        msg.send(response)

        setTimeout(function () {
          let list = ''
          let durationSum = 0
          const increment = INCREMENT_MINUTES * MILLISEC_PER_MINUTE

          for (let day = 1; day <= 31; day++) {
            let from
            let fromString = ''
            let to
            let toString = ''
            let fromCalc
            let fromCalcString = ''
            let toCalc
            let toCalcString = ''
            let duration = 0
            let durationString = ''
            let durationDiff = 0
            let overtime = 0
            let overtimeString = ''
            let overtimeDiff = 0

            date.setDate(day)
            if (date.getMonth() !== month) {
              break
            }

            const dateString = getDateStringFromDate(date, '/')
            const key = [user, dateString]
            const values = robot.brain.get(JSON.stringify(key))

            values.forEach(value => {
              if (value) {
                fromString = value[0]
                toString = value[1]

                if (fromString) {
                  from = getDateFromTimeString(date, fromString)
                  fromCalc = new Date(Math.ceil(from.getTime() / increment) * increment)
                  fromCalcString = getTimeStringFromDate(fromCalc, ':')
                } else {
                  fromString = csvFlag ? '' : '     '
                  fromCalcString = csvFlag ? '' : '     '
                }

                if (toString) {
                  to = getDateFromTimeString(date, toString)
                  if (from > to) {
                    to = new Date(to.getTime() + 24 * 60 * 60 * 1000)
                  }
                  toCalc = new Date(Math.floor(to.getTime() / increment) * increment)
                  toCalcString = getTimeStringFromDate(toCalc, ':')
                } else {
                  toString = csvFlag ? '' : '     '
                  toCalcString = csvFlag ? '' : '     '
                }

                // Duration
                if (toCalc && fromCalc) {
                  durationDiff = toCalc - fromCalc
                  if (durationDiff > 0) {
                    duration = durationDiff
                  }
                }
                durationSum += duration
                if (duration) {
                  durationString = getTimeStringFromValue(duration, ':')
                  if (!csvFlag) {
                    durationString += '   '
                  }
                } else {
                  durationString = csvFlag ? '' : '        '
                }

                // Overtime
                overtimeDiff = duration - BASE_WORK_DURATION
                overtime = overtimeDiff > 0 ? overtimeDiff : 0
                overtimeString = overtime ? getTimeStringFromValue(overtime, ':') : ''

                if (csvFlag) {
                  list += [dateString, fromString, toString, fromCalcString, toCalcString, durationString, overtimeString].join(',') + '\n'
                } else {
                  list += '| ' + [dateString, fromString, toString, fromCalcString, toCalcString, durationString, overtimeString].join(' | ') + ' |\n'
                }
              } else if (csvFlag) {
                list += dateString + ',,,,,,\n'
              }
            })

            if (list) {
              if (csvFlag) {
                list = '```' + CSV_HEADER + '\n' + list + CSV_FOOTER + getTimeStringFromValue(durationSum, ':') + '```'
              } else {
                list = '```' + LIST_HEADER + '\n' + list + LIST_FOOTER + getTimeStringFromValue(durationSum, ':') + '```'
              }
            }

            let response = list ? msg.random(RESPONSE_AFTER_TO_LIST) : msg.random(RESPONSE_NONE_TO_LIST)
            response = response.replace(/%{list}/, list)
            response = response.replace(/%{month}/, MONTH_NAME[month])
            msg.send(response)
          }
        }, 1000)
      } catch (e) {
        error(e, msg)
      }
    }
  }

  function hiByeCommand(command) {
    return function (msg) {
      try {
        let user = msg.message.user.name
        if (msg.match[1]) {
          user = msg.match[1].replace(/^@/, '')
        }

        const dateInput = msg.match[2]
        const fromInput = msg.match[3]
        const toInput = msg.match[4]

        let date = getToday()
        let from
        let to
        let fromDate
        let fromNow
        let futureFlag = 0

        if (dateInput && !fromInput && !toInput) {
          throw (new Error('Argument error.'))
          return
        }

        if (!dateInput && !fromInput && !toInput) {
          if (/hi/.test(command)) {
            from = getNow()
          } else if (/bye/.test(command)) {
            to = getNow()
          }
        } else {
          if (dateInput) {
            date = getDateFromDateString(dateInput)
          }

          if (fromInput) {
            from = getDateFromTimeString(date, fromInput)
            fromDate = date - getToday()
            fromNow = from - getNow()

            if (fromDate === 0 && fromNow > 0) {
              futureFlag = 1
            }
          }

          if (toInput) {
            to = getDateFromTimeString(date, toInput)
          }
        }

        const dateOutput = getDateStringFromDate(date, '/')
        let fromOutput
        let toOutput
        if (from) {
          fromOutput = getTimeStringFromDate(from, ':')
        }
        if (to) {
          toOutput = getTimeStringFromDate(to, ':')
        }

        save(user, dateOutput, fromOutput, toOutput)
        respond(command, user, dateOutput, fromOutput, toOutput, futureFlag, msg)
      } catch (e) {
        error(e, msg)
      }
    }
  }

  function removeCommand() {
    return function (msg) {
      try {
        const user = msg.match[1] ?
          msg.match[1].replace(/^@/, '') :
          msg.message.user.name
        const dateInput = msg.match[2]
        if (!dateInput) {
          throw (new Error('日付が指定されてないよ。'))
        }

        const date = getDateFromDateString(dateInput)
        const dateOutput = getDateStringFromDate(date, '/')

        remove(user, dateOutput)

        let response = msg.random(RESPONSE_TO_REMOVE)
        response = response.replace(/%{user}/, user)
        response = response.replace(/%{date}/, dateOutput)
        msg.send(response)
      } catch (e) {
        error(e, msg)
      }
    }
  }

  function getTimeStringFromDate(time, separator) {
    const hour = zeroPadding(time.getHours(), 2)
    const minute = zeroPadding(time.getMinutes(), 2)
    return [hour, minute].join(separator || '')
  }

  function getDateStringFromDate(date, separator) {
    const year = zeroPadding(date.getFullYear(), 4)
    const month = zeroPadding(date.getMonth() + 1, 2)
    const day = zeroPadding(date.getDate(), 2)
    return [year, month, day].join(separator || '')
  }

  Math.sign = Math.sign || function (x) {
    x = +x // convert to a number
    if (x === 0 || isNaN(x)) {
      return x
    }
    return x > 0 ? 1 : -1
  }

  function getTimeStringFromValue(value, separator) {
    const sign = Math.sign(value)
    const hour = zeroPadding(Math.floor(value / MILLISEC_PER_HOUR), 2)
    const minute = zeroPadding((value % MILLISEC_PER_HOUR) / MILLISEC_PER_MINUTE, 2)
    return (sign === -1 ? '-' : '') + [hour, minute].join(separator || '')
  }

  function zeroPadding(number, length) {
    return (Array(length).join('0') + number).slice(-length)
  }

  function save(user, date, from, to) {
    const key = [user, date]
    const value = robot.brain.get(JSON.stringify(key)) || []
    const l = value.length
    let cur = value[l - 1]
    if (cur[1]) {
      cur = []
      value.push(cur)
    }
    if (from) {
      cur[0] = from
    }
    if (to) {
      cur[1] = to
    }
    robot.brain.set(JSON.stringify(key), value)
  }

  function remove(user, date) {
    const key = [user, date]
    const value = robot.brain.get(JSON.stringify(key)) || []
    robot.brain.remove(JSON.stringify(key), value)
  }

  function respond(command, user, date, from, to, flag, msg) {
    let response
    if (/hi/.test(command)) {
      if (flag === 1) {
        response = msg.random(RESPONSE_TO_FUTURE)
      } else {
        response = msg.random(RESPONSE_TO_HI)
      }
    } else if (/bye/.test(command)) {
      const response = msg.random(RESPONSE_TO_BYE)
    }
    response = response.replace(/%{user}/, user)
    response = response.replace(/%{date}/, date)
    response = response.replace(/%{from}/, from || '')
    response = response.replace(/%{to}/, to || '')
    msg.send(response)
  }

  function getDateFromTimeString(date, string) {
    const year = date.getFullYear()
    const month = date.getMonth()
    const day = date.getDate()

    let hm
    if (/:/.test(string)) {
      hm = /^(\d{1,2}):(\d{1,2})$/.exec(string)
    } else if (string.length === 3 || string.length === 4) {
      hm = /^(\d{1,2})(\d{2})$/.exec(string)
    } else {
      hm = /^(\d{1,2})$/.exec(string)
    }
    if (!hm) {
      throw (new Error('Time parse failed.'))
      return
    }
    const time = new Date(year, month, day, (hm[1] - 0) || 0, (hm[2] - 0) || 0)
    const today = new Date(year, month, day)
    const tomorrow = new Date(year, month, day + 1)
    if (time < today || time >= tomorrow) {
      throw (new Error('Time format error.'))
      return
    }
    return time
  }

  function getDateFromDateString(string) {
    const date = getToday()
    const year = date.getFullYear()
    const month = date.getMonth()
    const day = date.getDate()

    let ymd
    if (/\//.test(string)) {
      ymd = /^(?:(\d{2}|\d{4})\/)?(?:(\d{1,2})\/)(?:(\d{1,2})$)/.exec(string)
    } else {
      ymd = /^(\d{2}|\d{4})?(\d{1,2})(\d{2})$/.exec(string)
    }
    if (!ymd) {
      throw (new Error('Date parse failed.'))
      return
    }

    if (ymd[1] && ymd[1].length === 2) {
      ymd[1] = '20' + ymd[1]
    }

    return (new Date((ymd[1] - 0) || year, ymd[2] ? ymd[2] - 1 : month, (ymd[3] - 0) || day))
  }

  function getToday() {
    const date = new Date()
    date.setHours(0)
    date.setMinutes(0)
    date.setSeconds(0)
    date.setMilliseconds(0)
    return date
  }

  function getNow() {
    const time = new Date()
    return time
  }

  function error(e, msg) {
    let response = msg.random(RESPONSE_TO_ERROR)
    response = response.replace(/%{message}/, e.message)
    msg.send(response)
  }
}
