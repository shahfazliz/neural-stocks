import moment from 'moment';

export default class MomentAdaptor {
    constructor(strDate, strFormat) {
        this.__moment = moment.utc(strDate);
    }

    add(number, timeframe) {
        this
            .__moment
            .add(number, timeframe);

        return this;
    }

    subtract(number, timeframe) {
        this
            .__moment
            .subtract(number, timeframe);

        return this;
    }

    isSame(momentObj) {
        return this
            .__moment
            .valueOf() === momentObj.valueOf();
    }

    isBefore(momentObj) {
        return this
            .__moment
            .valueOf() < momentObj.valueOf();
    }

    isSameOrBefore(momentObj) {
        return this
            .__moment
            .valueOf() <= momentObj.valueOf();
    }

    isAfter(momentObj) {
        return this
            .__moment
            .valueOf() > momentObj.valueOf();
    }

    isSameOrAfter(momentObj) {
        return this
            .__moment
            .valueOf() >= momentObj.valueOf();
    }

    format(strFormat) {
        return this
            .__moment
            .format(strFormat);
    }

    day() {
        return this
            .__moment
            .day();
    }

    month() {
        return this
            .__moment
            .month();
    }

    addBusinessDays(number) {
        const Sunday = 0;
        const Saturday = 6;
        let daysRemaining = number;

        while (daysRemaining > 0) {
            this.add(1, 'day');

            daysRemaining -= this.day() !== Sunday
                && this.day() !== Saturday
                ? 1
                : 0;
        }

        return this;
    }

    subtractBusinessDay(number) {
        const Sunday = 0;
        const Saturday = 6;
        let daysRemaining = number;

        while (daysRemaining > 0) {
            this.subtract(1, 'day');

            daysRemaining -= this.day() !== Sunday
                && this.day() !== Saturday
                ? 1
                : 0;
        }

        return this;
    }

    valueOf() {
        return this
            .__moment
            .valueOf();
    }
}