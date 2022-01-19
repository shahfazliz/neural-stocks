import * as tf from '@tensorflow/tfjs';
import tfn from '@tensorflow/tfjs-node';

export default class TensorFlowAdaptor {
    __epochs = 50000;
    __hiddenNodes = 15;
    __hiddenLayers = 3;
    __learnRate = 0.001;

    __compileParams = {
        loss: tf.losses.meanSquaredError,
        optimizer: tf.train.sgd(this.__learnRate),
        metrics: ['accuracy'],
    };

    __trainedFilePath = './data/tensorflowModel';

    setTrainedFilePath(filepath) {
        this.__trainedFilePath = filepath;
        return this;
    }

    getTrainedModel() {
        return tf
            .loadLayersModel(tfn.io.fileSystem(`${this.__trainedFilePath}/model.json`))
            .then(model => {
                console.log('Model available');
                model.compile(this.__compileParams);
                return model;
            })
    }

    createNewModel({
        numberOfInputNodes,
        numberOfOutputNodes,
    }) {
        const model = tf.sequential();
        // Input Layer
        model.add(tf.layers.dense({
            inputShape: [numberOfInputNodes],
            activation: 'relu6',
            useBias: true,
            units: this.__hiddenNodes, // Input nodes
        }));
        
        // Hidden layers
        for (let i = 0; i < this.__hiddenLayers; i++) {
            model.add(tf.layers.dense({
                inputShape: this.__hiddenNodes,
                activation: 'relu6',
                useBias: true,
                units: this.__hiddenNodes, // Hidden nodes
            }));
            // model.add(tf.layers.dropout({ rate: 0.0001 }));
        }

        // Output layer
        model.add(tf.layers.dense({
            inputShape: this.__hiddenNodes,
            activation: 'sigmoid',
            useBias: true,
            units: numberOfOutputNodes,
        }));

        model.compile(this.__compileParams);

        return model;
    }

    trainModel({
        model,
        trainingInputData,
        trainingOutputData,
        validateInputData,
        validateOutputData,
    }) {
        const trainingInputData2D = tf.tensor2d(trainingInputData);
        const trainingOutputData2D = tf.tensor2d(trainingOutputData);
        const validateInputData2D = tf.tensor2d(validateInputData);
        const validateOutputData2D = tf.tensor2d(validateOutputData);
        
        return model
            .fit(
                trainingInputData2D, 
                trainingOutputData2D,
                {
                    epochs: this.__epochs,
                    validationData: [
                        validateInputData2D,
                        validateOutputData2D,
                    ],
                    callbacks: tf.callbacks.earlyStopping({
                        monitor: 'loss',
                        mode: 'auto',
                    }),
                },
            )
            .then(() => {
                trainingInputData2D.dispose();
                trainingOutputData2D.dispose();
                validateInputData2D.dispose();
                validateOutputData2D.dispose();
                model.save(`file://${this.__trainedFilePath}`);
            });
    }

    predict({
        model,
        input,
    }) {
        return tf.tidy(() => {
            const input2D = tf.tensor2d([input]); 

            const result = model
                .predict(input2D)
                .arraySync()[0];
            
            input2D.dispose();

            return result;
        });
    }

    extractGenome() {
        return this
            .getTrainedModel()
            .then(model => {
                const totalLayers = model.layers.length;
                return Promise.all(Array
                    .from({length: totalLayers}, (_, k) => k)
                    .map(layerNumber => {
                        return Promise
                            .all([
                                model.layers[layerNumber].getWeights()[0].data(), // Weights
                                model.layers[layerNumber].getWeights()[1].data(), // Bias
                            ])
                            .then(data => {
                                let [weights, bias] = data;
                                const result = [];
                                bias.forEach((b, index) => {
                                    result.push([...weights.slice(index, index + weights.length / bias.length), b]);
                                })
                                return result;
                            });
                    }));
            });
    }

    clone(model) {
        return tf.tidy(() => {
            const newModel = this
            .createNewModel({
                numberOfInputNodes: model.inputs[0].shape[1],
                numberOfOutputNodes: model.outputs[0].shape[1],
            });

            newModel.setWeights(model
                .getWeights()
                .slice()
            );

            newModel.compile(this.__compileParams);
            return newModel;
        });
    }

    memory() {
        console.log(tf.memory());
        return this;
    }
}
