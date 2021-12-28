import GeneticAlgo from '../GeneticAlgo.js';
import VolumeProfile from '../model/VolumeProfile.js';


const algo = new GeneticAlgo();

Promise
    .all(algo
        .__listOfTickers
        .map(tickerSymbol => {
            const volumeProfile = new VolumeProfile();
            return volumeProfile.reCreateVolumeProfile(tickerSymbol);
        })
    );