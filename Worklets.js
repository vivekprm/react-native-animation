import React from "react";
import { Button, StyleSheet, View } from "react-native";
import { runOnUI } from "react-native-reanimated";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});

const sayHello = (who) => {
  "worklet";
  console.log("Hello from the UI thread: " + who);
};
const Worklets = () => {
  return (
    <View style={styles.container}>
      <Button
        title="sayHello"
        label="sayHello"
        onPress={() => runOnUI(sayHello)("world")}
      />
    </View>
  );
};
export default Worklets;
