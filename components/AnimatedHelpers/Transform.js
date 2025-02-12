import { useAnimatedStyle } from "react-native-reanimated";

export const useTranslate = (vector) =>
  useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: vector.x.value },
        { translateY: vector.y.value },
      ],
    };
  });