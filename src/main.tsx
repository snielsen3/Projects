import React, { useState, useRef } from 'react';
import { StyleSheet, Text, View, Dimensions, TouchableOpacity, StatusBar, Image, ImageBackground } from 'react-native';
import { GameEngine } from 'react-native-game-engine';
import Matter from 'matter-js';

// --- Import Ionic React Components ---
import { IonApp, IonContent, IonPage, setupIonicReact } from '@ionic/react';

// --- Import Ionic Core Styles ---
/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

// --- Initialize Ionic App ---
setupIonicReact();

// Get screen dimensions
const { width, height } = Dimensions.get('window');

// --- Game Constants ---
const BIRD_SIZE = 50;
const PIPE_WIDTH = 60;
const PIPE_GAP = 200; // Gap between the top and bottom pipe

// --- ENTITY COMPONENTS ---
// NOTE: These components use React Native's <View> and <Image>, which are compatible
// in an Ionic (web) environment thanks to React Native for Web.

const Bird = ({ body }) => {
    const { x, y } = body.position;
    const size = body.circleRadius * 2;
    return (
        <Image
            // This 'require' tells the app to look for 'bird.png' 
            // in a folder named 'assets'
            source={require('./assets/bird.png')}
            style={[styles.bird, {
                width: size,
                height: size,
                left: x - size / 2,
                top: y - size / 2,
            }]}
        />
    );
};

const Pipe = ({ body, size }) => {
    const { x, y } = body.position;
    const { width, height } = size;

    return (
        <View style={{
            position: 'absolute',
            left: x - width / 2,
            top: y - height / 2,
            width: width,
            height: height,
            overflow: 'hidden',
            flexDirection: 'column',
        }}>
            <ImageBackground 
                source={require('./assets/pipe-core.png')} 
                resizeMode="repeat" 
                style={styles.pipeCore} 
            />
            <Image 
                source={require('./assets/pipe-top.png')} 
                style={styles.pipeTop} 
                resizeMode="stretch"
            />
        </View>
    );
};

const Floor = ({ body }) => {
    const { x, y } = body.position;
    const { width, height } = body.bounds.max;
    return (
        <View style={[styles.floor, {
            width: width,
            height: height,
            left: x - width / 2,
            top: y - height / 2,
        }]} />
    );
};


// --- GAME SETUP ---
const setupWorld = () => {
    let engine = Matter.Engine.create({ enableSleeping: false });
    let world = engine.world;
    engine.gravity.y = 0.5;

    const bird = Matter.Bodies.circle(width / 4, height / 2, BIRD_SIZE / 2, { label: 'bird' });
    const floor = Matter.Bodies.rectangle(width / 2, height - 25, width, 50, { isStatic: true, label: 'floor' });

    Matter.World.add(world, [bird, floor]);

    return {
        physics: { engine, world },
        bird: { body: bird, renderer: Bird },
        floor: { body: floor, renderer: Floor },
        counter: { count: 0 },
    };
};

// --- PHYSICS & GAME LOGIC SYSTEM ---
const Physics = (entities, { touches, time, dispatch }) => {
    let engine = entities.physics.engine;

    touches.press?.forEach(() => {
        Matter.Body.setVelocity(entities.bird.body, { x: 0, y: -8 });
    });

    Matter.Engine.update(engine, time.delta);

    entities.counter.count++;
    if (entities.counter.count % 120 === 0) {
        const pipeY = Math.random() * (height - PIPE_GAP - 200) + 100;
        const pipeTop = Matter.Bodies.rectangle(width, pipeY - (PIPE_GAP / 2), PIPE_WIDTH, height, { isStatic: true, label: 'pipeTop' });
        const pipeBottom = Matter.Bodies.rectangle(width, pipeY + (PIPE_GAP / 2) + height, PIPE_WIDTH, height, { isStatic: true, label: 'pipeBottom' });

        Matter.World.add(entities.physics.world, [pipeTop, pipeBottom]);
        
        const pipeId = `pipe_${entities.counter.count}`;
        entities[`${pipeId}_top`] = { body: pipeTop, size: {width: PIPE_WIDTH, height}, renderer: Pipe, scored: false };
        entities[`${pipeId}_bottom`] = { body: pipeBottom, size: {width: PIPE_WIDTH, height}, renderer: Pipe, scored: false };
    }

    Object.keys(entities).forEach(key => {
        if (key.startsWith('pipe_')) {
            Matter.Body.translate(entities[key].body, { x: -3, y: 0 });

            if (!entities[key].scored && entities[key].body.position.x < entities.bird.body.position.x) {
                entities[key].scored = true;
                dispatch({ type: 'score' });
            }

            if (entities[key].body.position.x < -PIPE_WIDTH) {
                Matter.Composite.remove(entities.physics.world, entities[key].body);
                delete entities[key];
            }
        }
    });

    Matter.Events.on(engine, 'collisionStart', (event) => {
        const pairs = event.pairs;
        const birdBody = entities.bird.body;
        for (let i = 0; i < pairs.length; i++) {
            const pair = pairs[i];
            if (pair.bodyA === birdBody || pair.bodyB === birdBody) {
                dispatch({ type: 'game_over' });
                break;
            }
        }
    });

    return entities;
};


// --- MAIN IONIC APP COMPONENT ---
const App = () => {
    const [running, setRunning] = useState(true);
    const [score, setScore] = useState(0);
    const gameEngineRef = useRef(null);

    const reset = () => {
        gameEngineRef.current.swap(setupWorld());
        setRunning(true);
        setScore(0);
    };

    const handleEvent = (e) => {
        switch (e.type) {
            case 'game_over':
                setRunning(false);
                break;
            case 'score':
                setScore(s => s + 1);
                break;
        }
    };

    return (
        <IonApp>
            <IonPage>
                <IonContent fullscreen>
                    {/* The main game container uses React Native's View, which works in Ionic */}
                    <View style={styles.container}>
                        <StatusBar hidden={true} />
                        <Text style={styles.score}>{score}</Text>
                        <GameEngine
                            ref={gameEngineRef}
                            style={styles.gameContainer}
                            systems={[Physics]}
                            entities={setupWorld()}
                            running={running}
                            onEvent={handleEvent}
                        />
                        {!running && (
                            <View style={styles.overlay}>
                                <Text style={styles.overlayText}>Game Over</Text>
                                <Text style={styles.overlayText}>Score: {score}</Text>
                                <TouchableOpacity style={styles.button} onPress={reset}>
                                    <Text style={styles.buttonText}>Restart</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </IonContent>
            </IonPage>
        </IonApp>
    );
};

export default App;

// --- STYLES ---
// NOTE: React Native's StyleSheet is compatible with Ionic's web-based rendering.
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#87CEEB', // Sky blue background
    },
    gameContainer: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
    },
    score: {
        position: 'absolute',
        top: 50,
        left: 0,
        right: 0,
        textAlign: 'center',
        fontSize: 60,
        fontWeight: 'bold',
        color: 'white',
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 10,
        zIndex: 1,
    },
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    overlayText: {
        fontSize: 48,
        fontWeight: 'bold',
        color: 'white',
    },
    button: {
        marginTop: 20,
        paddingHorizontal: 30,
        paddingVertical: 15,
        backgroundColor: '#FFD700',
        borderRadius: 10,
    },
    buttonText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
    },
    bird: {
        position: 'absolute',
    },
    floor: {
        position: 'absolute',
        backgroundColor: '#A0522D',
        borderTopWidth: 5,
        borderTopColor: '#228B22',
    },
    pipeCore: {
        flex: 1,
        width: '100%',
    },
    pipeTop: {
        width: '100%',
        height: 40,
    }
});
