import { StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Transitions } from "./Transitions";
export default function App() {
  return (
    <View style={styles.container}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Transitions />
      </GestureHandlerRootView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
});
