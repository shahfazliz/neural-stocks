import moment from 'moment';

export default class MomentAdaptor {
    constructor(strDate, strFormat) {
        this.__moment = moment(strDate, strFormat);
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

    isSameOrBefore(momentObj) {
        return this
            .__moment
            .isSameOrBefore(momentObj);
    }

    isSameOrAfter(momentObj) {
        return this
            .__moment
            .isSameOrAfter(momentObj);
    }

    format() {
        return this
            .__moment
            .format();
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
}