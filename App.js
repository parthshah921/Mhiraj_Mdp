import React, { useState, useEffect } from 'react';
import { SafeAreaView, View, Text, Button, StyleSheet, ActivityIndicator, Switch } from 'react-native';
import axios from 'axios';
import NetInfo from '@react-native-community/netinfo';
import Realm from 'realm';

const JokeSchema = {
  name: 'Joke',
  primaryKey: '_id',
  properties: {
    _id: 'int',
    setup: 'string',
    punchline: 'string',
  },
};

let realm;

const App = () => {
  const [joke, setJoke] = useState(null);
  const [error, setError] = useState(null);
  const [storedJokes, setStoredJokes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewedJokes, setViewedJokes] = useState([]);
  const [online, setOnline] = useState(true);

  const fetchJoke = async () => {
    setLoading(true);
    try {
      const netInfo = await NetInfo.fetch();

      if (online || netInfo.isConnected) {
        const response = await axios.get('https://official-joke-api.appspot.com/random_joke');
        setJoke(response.data);
        setViewedJokes(prevJokes => [...prevJokes, response.data].slice(-3));
        setError(null);
      } else {
        if (storedJokes.length > 0) {
          const nextJoke = storedJokes[currentIndex % storedJokes.length];
          setJoke(nextJoke);
          setCurrentIndex(currentIndex + 1);
        } else {
          setError('No stored jokes available. Please check your internet connection.');
        }
      }
    } catch (error) {
      console.error('Error fetching joke:', error);
      setError('Failed to fetch joke. Please check your internet connection.');
    } finally {
      setLoading(false);
    }
  };

  const toggleOnlineMode = () => {
    setOnline(!online);
  };

  const saveJokes = () => {
    try {
      realm.write(() => {
        realm.delete(realm.objects('Joke'));
        viewedJokes.forEach(joke => {
          realm.create('Joke', {
            _id: joke.id,
            setup: joke.setup,
            punchline: joke.punchline,
          }, Realm.UpdateMode.All);
        });
      });
      fetchStoredJokes();
    } catch (error) {
      console.error('Error saving jokes:', error);
    }
  };

  const fetchStoredJokes = () => {
    const jokes = realm.objects('Joke').sorted('_id');
    setStoredJokes(Array.from(jokes));
  };

  useEffect(() => {
    realm = new Realm({ schema: [JokeSchema], schemaVersion: 1 });

    fetchStoredJokes();
    if (storedJokes.length < 3) {
      Promise.all(new Array(3).fill(null).map(() => axios.get('https://official-joke-api.appspot.com/random_joke')))
        .then(responses => {
          responses.forEach(response => {
            realm.write(() => {
              realm.create('Joke', {
                _id: response.data.id,
                setup: response.data.setup,
                punchline: response.data.punchline,
              }, Realm.UpdateMode.All);
            });
          });
          fetchStoredJokes();
        })
        .catch(error => console.error('Initial joke fetch failed:', error));
    }

    const unsubscribe = NetInfo.addEventListener(state => {
      if (!state.isConnected) {
        fetchStoredJokes();
      }
    });

    return () => {
      unsubscribe();
      realm.close();
    };
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.jokeContainer}>
        {error ? (
          <Text style={styles.errorMessage}>{error}</Text>
        ) : (
          <View>
            {loading && <ActivityIndicator size="large" color="#0000ff" />}
            {joke ? (
              <View>
                <Text style={styles.jokeSetup}>{joke.setup}</Text>
                <Text style={styles.jokePunchline}>{joke.punchline}</Text>
              </View>
            ) : (
              <Text style={styles.noJokeMessage}>Press the button to get a joke!</Text>
            )}
          </View>
        )}
      </View>
      <View style={styles.buttonContainer}>
        <Button title="Get Another Joke" onPress={fetchJoke} disabled={loading} />
        <Button title="Save Jokes" onPress={saveJokes} />
        <Switch value={online} onValueChange={toggleOnlineMode} />
        <Text style={styles.onlineStatus}>{online ? 'Online' : 'Offline'}</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  jokeContainer: {
    width: '80%',
    alignItems: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: 'red',
    textAlign: 'center',
  },
  jokeSetup: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  jokePunchline: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  noJokeMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '80%',
    marginTop: 20,
  },
  onlineStatus: {
    fontSize: 16,
    textAlign: 'center',
    marginLeft: 10,
  },
});

export default App;