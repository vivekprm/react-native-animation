import { StyleSheet, Dimensions } from "react-native";
import Animated, { interpolate, useAnimatedStyle } from "react-native-reanimated";
import { mix } from "react-native-redash";
import { Card } from "./components/Card";
import { StyleGuide } from "./components/StyleGuide";

const { width } = Dimensions.get("window");
const origin = -(width / 2 - StyleGuide.spacing * 2);
const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    padding: StyleGuide.spacing * 4,
  },
});

export const AnimatedCard = ({ card, transition, index }) => {
  const style = useAnimatedStyle(() => {
    const rotate = mix(transition.value, 0, (index - 1) * Math.PI / 6);
    return {
      transform: [
        { translateX: origin },
        { rotate: `${rotate}rad` },
        { translateX: -origin },
      ],
    }
  });
  return (
    <Animated.View key={card} style={[styles.overlay, style]}>
      <Card {...{ card }} />
    </Animated.View>
  );
};
