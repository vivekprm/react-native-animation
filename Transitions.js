import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { AnimatedCard } from "./AnimatedCard";
import { Button } from "./components/Button";
import { StyleGuide } from "./components/StyleGuide";
import { cards } from "./components/Card";
import { useDerivedValue, useSharedValue, withSpring, withTiming } from "react-native-reanimated";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: StyleGuide.palette.background,
    justifyContent: "flex-end",
  },
});

const useSpring = (state) => {
  const value = useSharedValue(0);
  useEffect(() => {
    value.value = typeof state === "number" ? state : (state ? 1 : 0);
  }, [state, value]);
  return useDerivedValue(() => {
    return withSpring(value.value);
  })
}

export const Transitions = () => {
  const toggled = useSharedValue(false);
  const transition = useDerivedValue(() => {
    return withSpring(toggled.value);
  });
  return (
    <View style={styles.container}>
      {cards.slice(0, 3).map((card, index) => (
        <AnimatedCard key={card} {...{ index, card, transition }} />
      ))}
      <Button
        label={toggled ? "Reset" : "Start"}
        primary
        onPress={() => toggled.value = !toggled.value}
      />
    </View>
  );
};
