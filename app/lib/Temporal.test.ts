// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Temporal, formatDate, formatDuration, isAfter, isBefore } from './Temporal';

describe('Temporal', () => {
    it('is able to parse formats correctly', () => {
        const instant = Temporal.Instant.from('2024-01-09T19:00:06.007Z');

        expect(formatDate(instant, 'YYYY-MM-DD')).toEqual('2024-01-09');
        expect(formatDate(instant, 'HH:mm:ss')).toEqual('19:00:06');
        expect(formatDate(instant, '[YYYY-MM-DD]')).toEqual('YYYY-MM-DD');
        expect(formatDate(instant, 'YYYY-[MM]-DD')).toEqual('2024-MM-09');
    });

    it('is able to format Instant', () => {
        const instant = Temporal.Instant.from('2024-01-09T19:00:06.007Z');

        expect(formatDate(instant, 'YY')).toEqual('24');
        expect(formatDate(instant, 'YYYY')).toEqual('2024');

        expect(formatDate(instant, 'M')).toEqual('1');
        expect(formatDate(instant, 'MM')).toEqual('01');
        expect(formatDate(instant, 'MMM')).toEqual('Jan');
        expect(formatDate(instant, 'MMM', 'nl')).toEqual('jan');
        expect(formatDate(instant, 'MMMM')).toEqual('January');
        expect(formatDate(instant, 'MMMM', 'nl')).toEqual('januari');

        expect(formatDate(instant, 'D')).toEqual('9');
        expect(formatDate(instant, 'DD')).toEqual('09');
        expect(formatDate(instant, 'Do')).toEqual('9th');
        expect(formatDate(instant, 'd')).toEqual('2');
        expect(formatDate(instant, 'dd')).toEqual('T');
        expect(formatDate(instant, 'dd', 'nl')).toEqual('D');
        expect(formatDate(instant, 'ddd')).toEqual('Tue');
        expect(formatDate(instant, 'ddd', 'nl')).toEqual('di');
        expect(formatDate(instant, 'dddd')).toEqual('Tuesday');
        expect(formatDate(instant, 'dddd', 'nl')).toEqual('dinsdag');

        expect(formatDate(instant, 'W')).toEqual('2');
        expect(formatDate(instant, 'w')).toEqual('2');
        expect(formatDate(instant, 'Wo')).toEqual('2nd');
        expect(formatDate(instant, 'WW')).toEqual('02');
        expect(formatDate(instant, 'ww')).toEqual('02');

        expect(formatDate(instant, 'H')).toEqual('19');
        expect(formatDate(instant, 'HH')).toEqual('19');
        expect(formatDate(instant, 'h')).toEqual('7');
        expect(formatDate(instant, 'hh')).toEqual('07');
        expect(formatDate(instant, 'k')).toEqual('20');
        expect(formatDate(instant, 'kk')).toEqual('20');

        expect(formatDate(instant, 'm')).toEqual('0');
        expect(formatDate(instant, 'mm')).toEqual('00');

        expect(formatDate(instant, 's')).toEqual('6');
        expect(formatDate(instant, 'ss')).toEqual('06');

        expect(formatDate(instant, 'X')).toEqual('1704826806');
        expect(formatDate(instant, 'x')).toEqual('1704826806007');

        expect(formatDate(instant, 'SSS')).toEqual('007');
        expect(formatDate(instant, 'SSSS')).toEqual('000');

        expect(formatDate(instant, 'Z')).toEqual('+00:00');
        expect(formatDate(instant, 'z')).toEqual('UTC');
        expect(formatDate(instant, 'ZZ')).toEqual('+0000');
        expect(formatDate(instant, 'zzz')).toEqual('UTC');

        expect(formatDate(instant, 'A')).toEqual('PM');
        expect(formatDate(instant, 'a')).toEqual('pm');

        expect(formatDate(instant, 'Q')).toEqual('1');
    });

    it('is able to format PlainDate', () => {
        const plainDate = Temporal.PlainDate.from('2024-02-24');

        expect(formatDate(plainDate, 'YY')).toEqual('24');
        expect(formatDate(plainDate, 'YYYY')).toEqual('2024');

        expect(formatDate(plainDate, 'M')).toEqual('2');
        expect(formatDate(plainDate, 'MM')).toEqual('02');
        expect(formatDate(plainDate, 'MMM')).toEqual('Feb');
        expect(formatDate(plainDate, 'MMM', 'nl')).toEqual('feb');
        expect(formatDate(plainDate, 'MMMM')).toEqual('February');
        expect(formatDate(plainDate, 'MMMM', 'nl')).toEqual('februari');

        expect(formatDate(plainDate, 'D')).toEqual('24');
        expect(formatDate(plainDate, 'DD')).toEqual('24');
        expect(formatDate(plainDate, 'Do')).toEqual('24th');
        expect(formatDate(plainDate, 'd')).toEqual('6');
        expect(formatDate(plainDate, 'dd')).toEqual('S');
        expect(formatDate(plainDate, 'dd', 'nl')).toEqual('Z');
        expect(formatDate(plainDate, 'ddd')).toEqual('Sat');
        expect(formatDate(plainDate, 'ddd', 'nl')).toEqual('za');
        expect(formatDate(plainDate, 'dddd')).toEqual('Saturday');
        expect(formatDate(plainDate, 'dddd', 'nl')).toEqual('zaterdag');

        expect(formatDate(plainDate, 'W')).toEqual('8');
        expect(formatDate(plainDate, 'w')).toEqual('8');
        expect(formatDate(plainDate, 'Wo')).toEqual('8th');
        expect(formatDate(plainDate, 'WW')).toEqual('08');
        expect(formatDate(plainDate, 'ww')).toEqual('08');

        expect(formatDate(plainDate, 'H')).toEqual('0');
        expect(formatDate(plainDate, 'HH')).toEqual('00');
        expect(formatDate(plainDate, 'h')).toEqual('0');
        expect(formatDate(plainDate, 'hh')).toEqual('00');
        expect(formatDate(plainDate, 'k')).toEqual('1');
        expect(formatDate(plainDate, 'kk')).toEqual('01');

        expect(formatDate(plainDate, 'm')).toEqual('0');
        expect(formatDate(plainDate, 'mm')).toEqual('00');

        expect(formatDate(plainDate, 's')).toEqual('0');
        expect(formatDate(plainDate, 'ss')).toEqual('00');

        expect(formatDate(plainDate, 'X')).toEqual('1708732800');
        expect(formatDate(plainDate, 'x')).toEqual('1708732800000');

        expect(formatDate(plainDate, 'SSS')).toEqual('000');
        expect(formatDate(plainDate, 'SSSS')).toEqual('000');

        expect(formatDate(plainDate, 'Z')).toEqual('+00:00');
        expect(formatDate(plainDate, 'z')).toEqual('UTC');
        expect(formatDate(plainDate, 'ZZ')).toEqual('+0000');
        expect(formatDate(plainDate, 'zzz')).toEqual('UTC');

        expect(formatDate(plainDate, 'A')).toEqual('AM');
        expect(formatDate(plainDate, 'a')).toEqual('am');

        expect(formatDate(plainDate, 'Q')).toEqual('1');
    });

    it('is able to format PlainDateTime', () => {
        const plainDateTime = Temporal.PlainDateTime.from('2024-03-09T20:01:45');

        expect(formatDate(plainDateTime, 'YY')).toEqual('24');
        expect(formatDate(plainDateTime, 'YYYY')).toEqual('2024');

        expect(formatDate(plainDateTime, 'M')).toEqual('3');
        expect(formatDate(plainDateTime, 'MM')).toEqual('03');
        expect(formatDate(plainDateTime, 'MMM')).toEqual('Mar');
        expect(formatDate(plainDateTime, 'MMM', 'nl')).toEqual('mrt');
        expect(formatDate(plainDateTime, 'MMMM')).toEqual('March');
        expect(formatDate(plainDateTime, 'MMMM', 'nl')).toEqual('maart');

        expect(formatDate(plainDateTime, 'D')).toEqual('9');
        expect(formatDate(plainDateTime, 'DD')).toEqual('09');
        expect(formatDate(plainDateTime, 'Do')).toEqual('9th');
        expect(formatDate(plainDateTime, 'd')).toEqual('6');
        expect(formatDate(plainDateTime, 'dd')).toEqual('S');
        expect(formatDate(plainDateTime, 'dd', 'nl')).toEqual('Z');
        expect(formatDate(plainDateTime, 'ddd')).toEqual('Sat');
        expect(formatDate(plainDateTime, 'ddd', 'nl')).toEqual('za');
        expect(formatDate(plainDateTime, 'dddd')).toEqual('Saturday');
        expect(formatDate(plainDateTime, 'dddd', 'nl')).toEqual('zaterdag');

        expect(formatDate(plainDateTime, 'W')).toEqual('10');
        expect(formatDate(plainDateTime, 'w')).toEqual('10');
        expect(formatDate(plainDateTime, 'Wo')).toEqual('10th');
        expect(formatDate(plainDateTime, 'WW')).toEqual('10');
        expect(formatDate(plainDateTime, 'ww')).toEqual('10');

        expect(formatDate(plainDateTime, 'H')).toEqual('20');
        expect(formatDate(plainDateTime, 'HH')).toEqual('20');
        expect(formatDate(plainDateTime, 'h')).toEqual('8');
        expect(formatDate(plainDateTime, 'hh')).toEqual('08');
        expect(formatDate(plainDateTime, 'k')).toEqual('21');
        expect(formatDate(plainDateTime, 'kk')).toEqual('21');

        expect(formatDate(plainDateTime, 'm')).toEqual('1');
        expect(formatDate(plainDateTime, 'mm')).toEqual('01');

        expect(formatDate(plainDateTime, 's')).toEqual('45');
        expect(formatDate(plainDateTime, 'ss')).toEqual('45');

        expect(formatDate(plainDateTime, 'X')).toEqual('1710014505');
        expect(formatDate(plainDateTime, 'x')).toEqual('1710014505000');

        expect(formatDate(plainDateTime, 'SSS')).toEqual('000');
        expect(formatDate(plainDateTime, 'SSSS')).toEqual('000');

        expect(formatDate(plainDateTime, 'Z')).toEqual('+00:00');
        expect(formatDate(plainDateTime, 'z')).toEqual('UTC');
        expect(formatDate(plainDateTime, 'ZZ')).toEqual('+0000');
        expect(formatDate(plainDateTime, 'zzz')).toEqual('UTC');

        expect(formatDate(plainDateTime, 'A')).toEqual('PM');
        expect(formatDate(plainDateTime, 'a')).toEqual('pm');

        expect(formatDate(plainDateTime, 'Q')).toEqual('1');
    });

    it('is able to format PlainTime', () => {
        const plainTime = Temporal.PlainTime.from('13:37');

        expect(formatDate(plainTime, 'YY')).toEqual('70');
        expect(formatDate(plainTime, 'YYYY')).toEqual('1970');

        expect(formatDate(plainTime, 'M')).toEqual('1');
        expect(formatDate(plainTime, 'MM')).toEqual('01');
        expect(formatDate(plainTime, 'MMM')).toEqual('Jan');
        expect(formatDate(plainTime, 'MMM', 'nl')).toEqual('jan');
        expect(formatDate(plainTime, 'MMMM')).toEqual('January');
        expect(formatDate(plainTime, 'MMMM', 'nl')).toEqual('januari');

        expect(formatDate(plainTime, 'D')).toEqual('1');
        expect(formatDate(plainTime, 'DD')).toEqual('01');
        expect(formatDate(plainTime, 'Do')).toEqual('1st');
        expect(formatDate(plainTime, 'd')).toEqual('4');
        expect(formatDate(plainTime, 'dd')).toEqual('T');
        expect(formatDate(plainTime, 'dd', 'nl')).toEqual('D');
        expect(formatDate(plainTime, 'ddd')).toEqual('Thu');
        expect(formatDate(plainTime, 'ddd', 'nl')).toEqual('do');
        expect(formatDate(plainTime, 'dddd')).toEqual('Thursday');
        expect(formatDate(plainTime, 'dddd', 'nl')).toEqual('donderdag');

        expect(formatDate(plainTime, 'W')).toEqual('1');
        expect(formatDate(plainTime, 'w')).toEqual('1');
        expect(formatDate(plainTime, 'Wo')).toEqual('1st');
        expect(formatDate(plainTime, 'WW')).toEqual('01');
        expect(formatDate(plainTime, 'ww')).toEqual('01');

        expect(formatDate(plainTime, 'H')).toEqual('13');
        expect(formatDate(plainTime, 'HH')).toEqual('13');
        expect(formatDate(plainTime, 'h')).toEqual('1');
        expect(formatDate(plainTime, 'hh')).toEqual('01');
        expect(formatDate(plainTime, 'k')).toEqual('14');
        expect(formatDate(plainTime, 'kk')).toEqual('14');

        expect(formatDate(plainTime, 'm')).toEqual('37');
        expect(formatDate(plainTime, 'mm')).toEqual('37');

        expect(formatDate(plainTime, 's')).toEqual('0');
        expect(formatDate(plainTime, 'ss')).toEqual('00');

        expect(formatDate(plainTime, 'X')).toEqual('49020');
        expect(formatDate(plainTime, 'x')).toEqual('49020000');

        expect(formatDate(plainTime, 'SSS')).toEqual('000');
        expect(formatDate(plainTime, 'SSSS')).toEqual('000');

        expect(formatDate(plainTime, 'Z')).toEqual('+00:00');
        expect(formatDate(plainTime, 'z')).toEqual('UTC');
        expect(formatDate(plainTime, 'ZZ')).toEqual('+0000');
        expect(formatDate(plainTime, 'zzz')).toEqual('UTC');

        expect(formatDate(plainTime, 'A')).toEqual('PM');
        expect(formatDate(plainTime, 'a')).toEqual('pm');

        expect(formatDate(plainTime, 'Q')).toEqual('1');
    });

    it('is able to format ZonedDateTime', () => {
        const zonedDateTime =
            Temporal.Instant.from('2024-06-05T12:30:00Z').toZonedDateTimeISO('Europe/Amsterdam');

        expect(formatDate(zonedDateTime, 'YY')).toEqual('24');
        expect(formatDate(zonedDateTime, 'YYYY')).toEqual('2024');

        expect(formatDate(zonedDateTime, 'M')).toEqual('6');
        expect(formatDate(zonedDateTime, 'MM')).toEqual('06');
        expect(formatDate(zonedDateTime, 'MMM')).toEqual('Jun');
        expect(formatDate(zonedDateTime, 'MMM', 'nl')).toEqual('jun');
        expect(formatDate(zonedDateTime, 'MMMM')).toEqual('June');
        expect(formatDate(zonedDateTime, 'MMMM', 'nl')).toEqual('juni');

        expect(formatDate(zonedDateTime, 'D')).toEqual('5');
        expect(formatDate(zonedDateTime, 'DD')).toEqual('05');
        expect(formatDate(zonedDateTime, 'Do')).toEqual('5th');
        expect(formatDate(zonedDateTime, 'd')).toEqual('3');
        expect(formatDate(zonedDateTime, 'dd')).toEqual('W');
        expect(formatDate(zonedDateTime, 'dd', 'nl')).toEqual('W');
        expect(formatDate(zonedDateTime, 'ddd')).toEqual('Wed');
        expect(formatDate(zonedDateTime, 'ddd', 'nl')).toEqual('wo');
        expect(formatDate(zonedDateTime, 'dddd')).toEqual('Wednesday');
        expect(formatDate(zonedDateTime, 'dddd', 'nl')).toEqual('woensdag');

        expect(formatDate(zonedDateTime, 'W')).toEqual('23');
        expect(formatDate(zonedDateTime, 'w')).toEqual('23');
        expect(formatDate(zonedDateTime, 'Wo')).toEqual('23rd');
        expect(formatDate(zonedDateTime, 'WW')).toEqual('23');
        expect(formatDate(zonedDateTime, 'ww')).toEqual('23');

        expect(formatDate(zonedDateTime, 'H')).toEqual('14');
        expect(formatDate(zonedDateTime, 'HH')).toEqual('14');
        expect(formatDate(zonedDateTime, 'h')).toEqual('2');
        expect(formatDate(zonedDateTime, 'hh')).toEqual('02');
        expect(formatDate(zonedDateTime, 'k')).toEqual('15');
        expect(formatDate(zonedDateTime, 'kk')).toEqual('15');

        expect(formatDate(zonedDateTime, 'm')).toEqual('30');
        expect(formatDate(zonedDateTime, 'mm')).toEqual('30');

        expect(formatDate(zonedDateTime, 's')).toEqual('0');
        expect(formatDate(zonedDateTime, 'ss')).toEqual('00');

        expect(formatDate(zonedDateTime, 'X')).toEqual('1717590600');
        expect(formatDate(zonedDateTime, 'x')).toEqual('1717590600000');

        expect(formatDate(zonedDateTime, 'SSS')).toEqual('000');
        expect(formatDate(zonedDateTime, 'SSSS')).toEqual('000');

        expect(formatDate(zonedDateTime, 'Z')).toEqual('+02:00');
        expect(formatDate(zonedDateTime, 'z')).toEqual('Europe/Amsterdam');
        expect(formatDate(zonedDateTime, 'ZZ')).toEqual('+0200');
        expect(formatDate(zonedDateTime, 'zzz')).toEqual('Europe/Amsterdam');

        expect(formatDate(zonedDateTime, 'A')).toEqual('PM');
        expect(formatDate(zonedDateTime, 'a')).toEqual('pm');

        expect(formatDate(zonedDateTime, 'Q')).toEqual('2');
    });

    test.each([
        [ 'P1Y', 'in 1 year' ],
        [ '-P1Y', '1 year ago' ],
        [ 'P2Y', 'in 2 years' ],
        [ 'P1Y363D', 'in 1 year' ],  // FIXME
        [ '-P1Y360D', '1 year ago' ],  // FIXME
        [ 'P11M', 'in 11 months' ],
        [ 'P3W', 'in 3 weeks' ],
        [ 'P20D', 'in 20 days' ],
        [ 'PT8H', 'in 8 hours' ],
        [ 'PT25M', 'in 25 minutes' ],
        [ 'PT1S', 'in 1 second' ],
        [ 'PT0.25S', 'now' ],
        [ 'P0D', 'now' ],
    ])('it is able to format durations (%s)', (duration, expected) => {
        expect(formatDuration(Temporal.Duration.from(duration))).toEqual(expected);
    });

    it('should export correct comparison helping functions', () => {
        const monday = Temporal.PlainDate.from('2024-02-05');
        const tuesday = Temporal.PlainDate.from('2024-02-06');

        expect(isAfter(monday, monday)).toBeFalsy();
        expect(isAfter(monday, tuesday)).toBeFalsy();
        expect(isAfter(tuesday, monday)).toBeTruthy();
        expect(isAfter(tuesday, tuesday)).toBeFalsy();

        expect(isBefore(monday, monday)).toBeFalsy();
        expect(isBefore(monday, tuesday)).toBeTruthy();
        expect(isBefore(tuesday, monday)).toBeFalsy();
        expect(isBefore(tuesday, tuesday)).toBeFalsy();

        const march = Temporal.ZonedDateTime.from('2024-03-01T00:00:00Z[UTC]');
        const april = Temporal.ZonedDateTime.from('2024-04-01T00:00:00Z[UTC]');

        expect(isAfter(march, march)).toBeFalsy();
        expect(isAfter(march, april)).toBeFalsy();
        expect(isAfter(april, march)).toBeTruthy();
        expect(isAfter(april, april)).toBeFalsy();

        expect(isBefore(march, march)).toBeFalsy();
        expect(isBefore(march, april)).toBeTruthy();
        expect(isBefore(april, march)).toBeFalsy();
        expect(isBefore(april, april)).toBeFalsy();
    });
});
