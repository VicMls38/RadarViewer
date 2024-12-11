import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import React, { useState } from "react";
import { View, Text, TextInput, Button, StyleSheet, TextInputProps, TouchableNativeFeedback } from "react-native";

// Définir le type pour les props de la fonction AboutScreen
interface AboutScreenProps {
  navigation: {
    navigate: (screen: string) => void;
  };
}

const AboutScreen: React.FC<AboutScreenProps> = ({ navigation }) => {
  const [email, setEmail] = useState<string>("lol@test.fr");
  const [userName, setUserName] = useState<string>("toto");
  const [password, setPassword] = useState<string>("test123");
  const [country, setCountry] = useState<string>("");
  const [state, setState] = useState<string>("");

  const handleRegister = async () => {
    try {
      // Define the registration data
      const registrationData = {
        username: userName,
        email: email,
        password: password,
      };

      
      // Send a POST request to the registration endpoint
      const response = await fetch("https://5ae0-37-64-102-102.ngrok-free.app/api/auth/local/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(registrationData),
      });
      const data = await response.json()
      await AsyncStorage.setItem('token', data.jwt)

      console.log(response, data);
      if (response.ok) {
        // Registration successful, navigate to the login screen
        router.navigate("/explore");
      } else {
        // Handle the case where registration is unsuccessful
        console.error("Registration failed");
      }
    } catch (error) {
      console.error("Error during registration:", error);
      // Handle the error, e.g., display an error message
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Registration</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#888" // placeholder color for better contrast
        onChangeText={(text) => setEmail(text)}
        value={email}
      />
      <TextInput
        style={styles.input}
        placeholder="Username"
        placeholderTextColor="#888" // placeholder color for better contrast
        onChangeText={(text) => setUserName(text)}
        value={userName}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#888" // placeholder color for better contrast
        onChangeText={(text) => setPassword(text)}
        value={password}
        secureTextEntry={true}
      />
      <Button title="Register" onPress={handleRegister} color="#4CAF50" /> {/* Customize button color */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "#121212", // Dark background for dark theme
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
    color: "#fff", // White text for title for contrast on dark background
  },
  input: {
    height: 40,
    borderColor: "#fff", // White border for better visibility
    borderWidth: 1,
    marginBottom: 15,
    paddingLeft: 10,
    color: "#fff", // White text color for inputs
    backgroundColor: "#333", // Dark background for inputs
  },
});

export default AboutScreen;
