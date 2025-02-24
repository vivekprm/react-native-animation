import { StyleSheet, View } from "react-native";
import HeartOfTheMatter from "./HeartOfTheMatter";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Worklets from "./Worklets";

export default function App() {
  return (
    <View style={styles.container}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Worklets />
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
