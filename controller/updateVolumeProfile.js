import App from '../app.js';
import VolumeProfile from '../model/VolumeProfile.js';

const app = new App();

Promise
    .all(app
        .__listOfTickers
        .map(tickerSymbol => {
            const volumeProfile = new VolumeProfile();
            return volumeProfile.reCreateVolumeProfile(tickerSymbol);
        })
    );