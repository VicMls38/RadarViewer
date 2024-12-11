import React, { useState, useEffect, useCallback } from 'react';
import MapView, { Circle, Region } from 'react-native-maps';
import { Alert, StyleSheet, View, Text, Button } from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import JWT from 'expo-jwt';

interface Coordinate {
  latitude: number;
  longitude: number;
}

const FIXED_CIRCLE = { latitude: 45.186840, longitude: 5.756056 }; // Position fixe
const RADIUS = 100; // Rayon en mètres

export default function App() {
  const [region, setRegion] = useState<Region>({
    latitude: FIXED_CIRCLE.latitude,
    longitude: FIXED_CIRCLE.longitude,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const [userLocation, setUserLocation] = useState<Coordinate | null>(null);
  const [isInCircle, setIsInCircle] = useState(false);
  const [timeInCircle, setTimeInCircle] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [bestTime, setBestTime] = useState<number | null>(null);
  const [coords, setCoords] = useState<Coordinate[]>([]);

  // Fonction de calcul de la distance Haversine entre deux points
  const haversineDistance = (coord1: Coordinate, coord2: Coordinate) => {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const R = 6371e3; // Rayon de la Terre en mètres
    const lat1 = toRad(coord1.latitude);
    const lat2 = toRad(coord2.latitude);
    const deltaLat = toRad(coord2.latitude - coord1.latitude);
    const deltaLon = toRad(coord2.longitude - coord1.longitude);

    const a =
      Math.sin(deltaLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance en mètres
  };

  // Vérifie si l'utilisateur est dans le cercle fixe
  const checkUserInCircle = useCallback(() => {
    if (!userLocation) return;

    const distance = haversineDistance(userLocation, FIXED_CIRCLE);
    const isInside = distance <= RADIUS;

    setIsInCircle(isInside);

    if (isInside) {
      if (!timerRunning) {
        setTimerRunning(true);
      }
    } else {
      if (timerRunning) {
        setTimerRunning(false);

        // Mettre à jour le meilleur temps si le temps actuel est supérieur
        if (timeInCircle > 0) {
          updateBestTime(timeInCircle);
        }

        // Réinitialiser le temps passé dans le cercle après 2 secondes
        setTimeout(() => {
          setTimeInCircle(0);
        }, 2000);
      }
    }
  }, [userLocation, timerRunning, timeInCircle]);

  // Met à jour le meilleur temps
  const updateBestTime = async (currentTime: number) => {
    try {
      const storedBestTime = await AsyncStorage.getItem('bestTime');
      const storedBestTimeNum = storedBestTime ? parseInt(storedBestTime, 10) : null;
  
      // Vérifiez si le nouveau temps est meilleur ou si aucun meilleur temps n'est enregistré
      if (storedBestTimeNum === null || currentTime < storedBestTimeNum) {
        await AsyncStorage.setItem('bestTime', currentTime.toString());
        setBestTime(currentTime); // Mise à jour locale du meilleur temps
  
        // Envoi à l'API
        await sendBestTimeToAPI(currentTime);
      } else {
        setBestTime(storedBestTimeNum); // Garde l'ancien meilleur temps
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour du meilleur temps :', error);
    }
  };
  
  // Fonction réutilisable pour envoyer le temps à l'API
  const sendBestTimeToAPI = async (bestTime: number) => {
    try {
      const token = await AsyncStorage.getItem("token");
  
      if (!token) {
        console.warn("Aucun token disponible pour envoyer les données à l'API.");
        return;
      }
  
      // Décoder le token si nécessaire
      const decodedToken = JWT.decode(token, null); // Assurez-vous que `JWT` est bien importé
  
      // Construire la requête
      const response = await fetch('https://5ae0-37-64-102-102.ngrok-free.app/api/radar-viewers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          data: {
            id_user: decodedToken?.id || "unknown_user", // Remplacez par le champ réel
            time: bestTime,
          },
        }),
      });
  
      if (!response.ok) {
        throw new Error(`Erreur API : ${response.status} - ${response.statusText}`);
      }
  
      console.log('Temps envoyé avec succès à l\'API.');
    } catch (error) {
      console.error('Erreur lors de l\'envoi du temps à l\'API :', error);
    }
  };
  

  // Charge le meilleur temps depuis AsyncStorage
  const loadBestTime = async () => {
    try {
      const storedBestTime = await AsyncStorage.getItem('bestTime');
      if (storedBestTime !== null) {
        setBestTime(parseInt(storedBestTime));
      }
    } catch (error) {
      console.error('Erreur lors du chargement du meilleur temps :', error);
    }
  };

  // Fonction pour obtenir la localisation de l'utilisateur
  const getUserLocation = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission refusée',
        'Vous devez autoriser l\'application à accéder à votre position.'
      );
      return;
    }

    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const { latitude, longitude } = location.coords;
      setUserLocation({ latitude, longitude });
      setRegion((prev) => ({
        ...prev,
        latitude,
        longitude,
      }));
    } catch (error) {
      console.error('Erreur de localisation :', error);
    }
  }, []);

  // Fonction pour charger les coordonnées à partir d'une source
  const fetchCoordinates = useCallback(async (url: string) => {
    try {
      const cachedCoords = await AsyncStorage.getItem('coords');
      if (cachedCoords) {
        setCoords(JSON.parse(cachedCoords));
        return;
      }

      const allCoords: Coordinate[] = [];
      let nextUrl = url;

      while (nextUrl) {
        const response = await fetch(nextUrl);
        const json = await response.json();

        if (Array.isArray(json.data)) {
          const extractedCoords = json.data.map(
            (item: { latitude: number; longitude: number }) => ({
              latitude: item.latitude,
              longitude: item.longitude,
            })
          );

          allCoords.push(...extractedCoords);
          nextUrl = json.links?.next || null;
        } else {
          console.error('Format des données API inattendu:', json);
          break;
        }
      }

      const uniqueCoords = filterDuplicates(allCoords);
      await AsyncStorage.setItem('coords', JSON.stringify(uniqueCoords));
      setCoords(uniqueCoords);
    } catch (error) {
      console.error('Erreur API:', error);
    }
  }, []);

  // Fonction pour filtrer les coordonnées dupliquées
  const filterDuplicates = (coords: Coordinate[]) =>
    coords.filter(
      (coord, index, self) =>
        index ===
        self.findIndex(
          (c) => c.latitude === coord.latitude && c.longitude === coord.longitude
        )
    );

  const clearStorageHandler = async () => {
    try {
      
      await AsyncStorage.clear(); // Effacer le stockage
      setBestTime(null); // Réinitialiser le meilleur temps localement
      Alert.alert('Le stockage a été effacé');
    } catch (error) {
      console.error('Erreur lors de l\'effacement du AsyncStorage', error);
    }
  };

  useEffect(() => {
    getUserLocation();
    loadBestTime(); // Charger le meilleur temps au démarrage
    fetchCoordinates(
      'https://tabular-api.data.gouv.fr/api/resources/8a22b5a8-4b65-41be-891a-7c0aead4ba51/data/'
    );
  }, [getUserLocation, fetchCoordinates]);

  // Vérifie si l'utilisateur est dans le cercle à chaque mise à jour de la localisation
  useEffect(() => {
    checkUserInCircle();
  }, [userLocation, checkUserInCircle]);

  // Met à jour le temps passé dans le cercle
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    if (timerRunning) {
      interval = setInterval(() => {
        setTimeInCircle((prev) => prev + 1);
      }, 1000);
    } else if (interval) {
      clearInterval(interval);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerRunning]);

  return (
    <View style={styles.container}>
      <View style={styles.infoContainer}>
        <Text style={styles.infoText}>
          {isInCircle
            ? 'Vous êtes dans le cercle défini.'
            : 'Vous n’êtes pas dans le cercle.'}
        </Text>
        <Text style={styles.infoText}>
          Temps passé dans le cercle : {timeInCircle} secondes
        </Text>
        {bestTime && (
          <Text style={styles.infoText}>
            Meilleur temps : {bestTime} secondes
          </Text>
        )}
      </View>

      <MapView
        style={styles.map}
        region={region}
        showsUserLocation={true}
        followsUserLocation={true}
      >
        <Circle
          center={FIXED_CIRCLE}
          radius={RADIUS}
          strokeWidth={2}
          strokeColor="red"
          fillColor="rgba(255, 0, 0, 0.3)"
        />

        {coords.map((coordinate, index) => (
          <Circle
            key={index}
            center={coordinate}
            radius={30}
            strokeWidth={2}
            strokeColor="blue"
            fillColor="rgba(0, 0, 255, 0.3)"
          />
        ))}
      </MapView>

      <Button title="Effacer le stockage" onPress={clearStorageHandler} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  infoContainer: {
    position: 'absolute',
    top: 50,
    left: 10,
    zIndex: 1,
  },
  infoText: {
    fontSize: 18,
    color: 'black',
    fontWeight: 900
  },
});
