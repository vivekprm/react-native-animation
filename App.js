import { StyleSheet, View } from "react-native";
import HeartOfTheMatter from "./HeartOfTheMatter";

export default function App() {
  return (
    <View style={styles.container}>
      <HeartOfTheMatter />
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
